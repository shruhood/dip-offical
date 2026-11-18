import { Hono } from 'hono';
import type { AppVariables, Env } from '../types';
import { buildApiResponse } from '../middleware/security';
import { requireAuth, requirePermission } from '../middleware/auth';
import { DatabaseRegistry } from '../config/database';
import { recordAuditEvent } from '../services/auditService';
import { COMPLETE_CATALOGUE_ITEMS } from '../../src/data/catalogue';
import { findCatalogueItem, resolveAuthoritativeCheckout } from '../../src/lib/catalogueServer';
import { canAccessApplication, isSuperAdminRole } from '../../src/lib/rbac';
import { calculatePartnerCommission, fromPaise, toPaise } from '../../src/lib/finance';
import { createCashfreeRefund, loadEffectiveCashfreeConfig } from '../services/cashfreeService';
import { reconcileRefundOutcome } from '../services/paymentReconciliation';

export const unifiedRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function maskApplicantName(name?: string | null): string {
  const parts = String(name || 'Verified Applicant').trim().split(/\s+/);
  if (parts.length > 1) {
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  }
  return parts[0] || 'Applicant';
}

// ==========================================
// 1. PUBLIC MASKED TRACKING VERIFICATION
// ==========================================
unifiedRouter.post('/applications/track', async (c) => {
  const reqId = c.get('requestId');
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const rawAppId = String(body?.applicationId || '').trim().toUpperCase();
  const rawContact = String(body?.contact || '').trim();
  const cleanEmail = rawContact.toLowerCase();
  const cleanDigits = rawContact.replace(/\D/g, '').slice(-10);

  if (!rawAppId || (!cleanEmail.includes('@') && cleanDigits.length < 10)) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Provide a valid Application ID and registered Email ID or 10-digit Mobile Number.',
        requestId: reqId,
        data: null,
        errorCode: 'INVALID_TRACKING_QUERY',
      }),
      400
    );
  }

  const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');
  if (!workflowDb) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Tracking registry unavailable in current runtime.',
        requestId: reqId,
        data: null,
        errorCode: 'TRACKING_UNAVAILABLE',
      }),
      503
    );
  }

  const row = await workflowDb
    .prepare(
      `SELECT a.id, a.service_id, a.status, a.form_data_json, a.customer_remarks,
              a.completion_file_name, a.created_at, a.updated_at,
              u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile,
              s.name AS service_name, s.slug AS service_slug
       FROM applications a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN services s ON s.id = a.service_id
       WHERE UPPER(a.id) = ? AND a.deleted_at IS NULL
       LIMIT 1`
    )
    .bind(rawAppId)
    .first<any>()
    .catch(() => null);

  if (!row) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: `No application found with ID ${rawAppId}.`,
        requestId: reqId,
        data: null,
        errorCode: 'APPLICATION_NOT_FOUND',
      }),
      404
    );
  }

  const formData = safeJsonParse<Record<string, any>>(row.form_data_json, {});
  const appEmails = [
    String(row.user_email || '').trim().toLowerCase(),
    String(formData.userEmail || formData.email || '').trim().toLowerCase(),
  ].filter(Boolean);

  const appMobileCandidates = [
    String(row.user_mobile || ''),
    String(formData.userMobile || formData.contact_mobile || formData.mobile || ''),
  ]
    .map((m) => m.replace(/\D/g, '').slice(-10))
    .filter((d) => d.length >= 10);

  const emailMatched = Boolean(cleanEmail.includes('@') && appEmails.includes(cleanEmail));
  const mobileMatched = Boolean(cleanDigits.length === 10 && appMobileCandidates.includes(cleanDigits));

  if (!emailMatched && !mobileMatched) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Contact verification failed. Email or mobile does not match our records for this Application ID.',
        requestId: reqId,
        data: null,
        errorCode: 'CONTACT_VERIFICATION_FAILED',
      }),
      403
    );
  }

  const eventsRes = await workflowDb
    .prepare(
      `SELECT id, event_type, previous_status, new_status, actor_role, customer_message, created_at
       FROM application_events
       WHERE application_id = ?
       ORDER BY created_at ASC`
    )
    .bind(row.id)
    .all<any>()
    .catch(() => ({ results: [] }));

  const maskedName = maskApplicantName(row.user_name || formData.full_name || formData.applicant_full_name);

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Verified tracking summary retrieved',
      requestId: reqId,
      data: {
        id: row.id,
        serviceId: row.service_id,
        serviceName: row.service_name || formData.serviceName || 'Digital India Service',
        serviceSlug: row.service_slug || '',
        applicantMaskedName: maskedName,
        status: row.status,
        customerRemarks: row.customer_remarks || '',
        completionFileName: row.completion_file_name || null,
        submissionDate: row.created_at,
        updatedAt: row.updated_at,
        statusHistory: (eventsRes.results || []).map((ev: any) => ({
          id: ev.id,
          previousStatus: ev.previous_status || 'Submitted',
          newStatus: ev.new_status || row.status,
          updatedBy: 'Operations Desk',
          updatedByRole: ev.actor_role || 'operator',
          timestamp: ev.created_at,
          customerMessage: ev.customer_message || '',
        })),
      },
    })
  );
});

// ==========================================
// 2. UNIFIED APPLICATION CREATION & SCOPED RETRIEVAL
// ==========================================
unifiedRouter.post('/applications', requireAuth, requirePermission('applications.create'), async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));

  const serviceSlug = String(body?.serviceSlug || body?.serviceId || '').trim();
  if (!serviceSlug) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'serviceSlug or serviceId is required.',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_SERVICE',
      }),
      400
    );
  }

  const checkout = resolveAuthoritativeCheckout({
    serviceSlug,
    serviceId: body?.serviceId,
    urgentProcessing: Boolean(body?.urgentProcessing),
    couponCode: typeof body?.couponCode === 'string' ? body.couponCode : undefined,
    fallbackServiceChargeInr: Number(body?.serviceChargeInr || 0),
    fallbackGovtFeesInr: Number(body?.govtFeesInr || 0),
    catalog: COMPLETE_CATALOGUE_ITEMS,
  });

  if (!checkout.ok || !checkout.service) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: checkout.message || 'Service not found in authoritative catalogue.',
        requestId: reqId,
        data: null,
        errorCode: checkout.errorCode || 'SERVICE_NOT_FOUND',
      }),
      (checkout.status || 404) as any
    );
  }

  const appId =
    typeof body?.applicationId === 'string' && /^DIP-\d{4}-\d{4,8}$/i.test(body.applicationId.trim())
      ? body.applicationId.trim().toUpperCase()
      : `DIP-2026-${Math.floor(10000 + Math.random() * 90000)}`;
  const nowIso = new Date().toISOString();
  const targetUserId =
    (user.role === 'operator' || user.role === 'partner' || user.role === 'manager' || isSuperAdminRole(user.role)) &&
    typeof body?.customerUserId === 'string' &&
    body.customerUserId.trim()
      ? body.customerUserId.trim()
      : user.id;

  const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');
  if (workflowDb) {
    await workflowDb
      .prepare(
        `INSERT OR IGNORE INTO users (id, name, email, mobile) VALUES (?, ?, ?, ?)`
      )
      .bind(
        targetUserId,
        String(body?.applicantName || user.name || 'Citizen Applicant').slice(0, 120),
        String(body?.applicantEmail || user.email || `${targetUserId}@digitalindiaproject.com`).slice(0, 150),
        String(body?.applicantMobile || (user as { mobile?: string }).mobile || '0000000000').slice(0, 25)
      )
      .run()
      .catch(() => null);

    await workflowDb
      .prepare(
        `INSERT INTO applications (
          id, user_id, service_id, status, form_data_json, customer_remarks, created_at, updated_at
        ) VALUES (?, ?, ?, 'Submitted', ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          form_data_json = excluded.form_data_json,
          updated_at = excluded.updated_at`
      )
      .bind(
        appId,
        targetUserId,
        checkout.service.id,
        JSON.stringify(body?.formData || {}),
        'Application submitted via Digital India Project unified API.',
        nowIso,
        nowIso
      )
      .run()
      .catch(() => null);

    const formDataEntries = Object.entries(body?.formData && typeof body.formData === 'object' ? body.formData : {});
    for (const [fieldKey, val] of formDataEntries.slice(0, 40)) {
      await workflowDb
        .prepare(
          `INSERT INTO application_answers (id, application_id, form_version, field_key, value_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(application_id, field_key) DO UPDATE SET
             value_json = excluded.value_json,
             updated_at = excluded.updated_at`
        )
        .bind(
          `ans_${crypto.randomUUID()}`,
          appId,
          checkout.service.formVersion || 1,
          String(fieldKey).slice(0, 80),
          JSON.stringify(val ?? null),
          nowIso
        )
        .run()
        .catch(() => null);
    }

    await workflowDb
      .prepare(
        `INSERT INTO application_events (
          id, application_id, event_type, previous_status, new_status, actor_user_id, actor_role, customer_message, created_at
        ) VALUES (?, ?, 'CREATED', 'Draft', 'Submitted', ?, ?, ?, ?)`
      )
      .bind(
        `evt_${crypto.randomUUID()}`,
        appId,
        user.id,
        user.role,
        `Application created for ${checkout.service.name}.`,
        nowIso
      )
      .run()
      .catch(() => null);
  }

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'APPLICATION_CREATED',
    resourceType: 'application',
    resourceId: appId,
    summary: `Created application for ${checkout.service.slug} (total INR ${checkout.totalInr})`,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Application created via unified API',
      requestId: reqId,
      data: {
        id: appId,
        userId: targetUserId,
        serviceId: checkout.service.id,
        serviceSlug: checkout.service.slug,
        serviceName: checkout.service.name,
        status: 'Submitted',
        totalInr: checkout.totalInr,
        breakdown: checkout.breakdown,
        createdAt: nowIso,
      },
    }),
    201
  );
});

unifiedRouter.get('/applications/:id', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const appId = c.req.param('id').trim();

  const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (!workflowDb) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Workflow D1 unavailable',
        requestId: reqId,
        data: null,
        errorCode: 'D1_UNBOUND',
      }),
      503
    );
  }

  const app = await workflowDb
    .prepare(
      `SELECT a.*, u.name AS user_name, u.email AS user_email, u.mobile AS user_mobile,
              s.name AS service_name, s.slug AS service_slug
       FROM applications a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN services s ON s.id = a.service_id
       WHERE a.id = ? AND a.deleted_at IS NULL
       LIMIT 1`
    )
    .bind(appId)
    .first<any>();

  if (!app) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Application not found',
        requestId: reqId,
        data: null,
        errorCode: 'NOT_FOUND',
      }),
      404
    );
  }

  const permitted = canAccessApplication(user, {
    userId: app.user_id,
    userEmail: app.user_email || '',
    assignedOperatorId: app.assigned_operator_id || undefined,
  });

  if (!permitted) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Access denied to this application dossier.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }

  const isStaff =
    user.role === 'operator' || user.role === 'manager' || isSuperAdminRole(user.role);

  const [docsRes, versionsRes, eventsRes, paymentsRes, invoicesRes] = await Promise.all([
    workflowDb
      .prepare(`SELECT * FROM application_documents WHERE application_id = ? ORDER BY uploaded_at DESC`)
      .bind(appId)
      .all()
      .catch(() => ({ results: [] })),
    workflowDb
      .prepare(`SELECT * FROM document_versions WHERE application_id = ? ORDER BY version_number DESC`)
      .bind(appId)
      .all()
      .catch(() => ({ results: [] })),
    workflowDb
      .prepare(`SELECT * FROM application_events WHERE application_id = ? ORDER BY created_at ASC`)
      .bind(appId)
      .all()
      .catch(() => ({ results: [] })),
    billingDb
      ? billingDb
          .prepare(`SELECT * FROM payments WHERE application_id = ? ORDER BY created_at DESC`)
          .bind(appId)
          .all()
          .catch(() => ({ results: [] }))
      : Promise.resolve({ results: [] }),
    billingDb
      ? billingDb
          .prepare(`SELECT * FROM invoices WHERE application_id = ? ORDER BY issued_at DESC`)
          .bind(appId)
          .all()
          .catch(() => ({ results: [] }))
      : Promise.resolve({ results: [] }),
  ]);

  const sanitizedPayload: Record<string, any> = {
    id: app.id,
    userId: app.user_id,
    userName: app.user_name,
    userEmail: app.user_email,
    userMobile: app.user_mobile,
    serviceId: app.service_id,
    serviceName: app.service_name,
    serviceSlug: app.service_slug,
    status: app.status,
    assignedOperatorId: app.assigned_operator_id,
    formData: safeJsonParse(app.form_data_json, {}),
    customerRemarks: app.customer_remarks,
    completionFileName: app.completion_file_name,
    completionFileUrl: app.completion_file_url,
    createdAt: app.created_at,
    updatedAt: app.updated_at,
    documents: docsRes.results || [],
    documentVersions: versionsRes.results || [],
    events: (eventsRes.results || []).map((e: any) => ({
      ...e,
      reason: isStaff ? e.reason : undefined,
    })),
    payments: paymentsRes.results || [],
    invoices: invoicesRes.results || [],
  };

  if (isStaff) {
    sanitizedPayload.internalNotes = app.internal_notes;
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Application dossier retrieved',
      requestId: reqId,
      data: sanitizedPayload,
    })
  );
});

// ==========================================
// 3. OPERATOR ASSIGNMENT, DOCUMENT REVIEW & COMPLETION
// ==========================================
unifiedRouter.patch(
  '/applications/:id/assign',
  requireAuth,
  requirePermission('applications.assign'),
  async (c) => {
    const reqId = c.get('requestId');
    const actor = c.get('user')!;
    const appId = c.req.param('id').trim();
    const body = await c.req.json().catch(() => ({} as Record<string, any>));
    const operatorUserId = String(body?.operatorUserId || '').trim();
    const operatorName = String(body?.operatorName || 'Operations Specialist').trim();

    if (!operatorUserId) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'FAILED',
          message: 'operatorUserId is required',
          requestId: reqId,
          data: null,
          errorCode: 'MISSING_OPERATOR_ID',
        }),
        400
      );
    }

    const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');
    const nowIso = new Date().toISOString();
    if (workflowDb) {
      const app = await workflowDb
        .prepare(`SELECT id, status FROM applications WHERE id = ? LIMIT 1`)
        .bind(appId)
        .first<{ id: string; status: string }>();
      if (!app) {
        return c.json(
          buildApiResponse({
            success: false,
            status: 'FAILED',
            message: 'Application not found',
            requestId: reqId,
            data: null,
            errorCode: 'NOT_FOUND',
          }),
          404
        );
      }

      const nextStatus =
        app.status === 'Payment Confirmed' || app.status === 'Submitted' ? 'Assigned' : app.status;

      await workflowDb
        .prepare(`UPDATE application_assignments SET is_active = 0, unassigned_at = ? WHERE application_id = ? AND is_active = 1`)
        .bind(nowIso, appId)
        .run()
        .catch(() => null);

      await workflowDb
        .prepare(
          `INSERT INTO application_assignments (id, application_id, operator_user_id, assigned_by_user_id, manager_user_id, is_active, assigned_at)
           VALUES (?, ?, ?, ?, ?, 1, ?)`
        )
        .bind(`asg_${crypto.randomUUID()}`, appId, operatorUserId, actor.id, actor.id, nowIso)
        .run()
        .catch(() => null);

      await workflowDb
        .prepare(`UPDATE applications SET assigned_operator_id = ?, status = ?, updated_at = ? WHERE id = ?`)
        .bind(operatorUserId, nextStatus, nowIso, appId)
        .run();

      await workflowDb
        .prepare(
          `INSERT INTO application_events (id, application_id, event_type, previous_status, new_status, actor_user_id, actor_role, customer_message, created_at)
           VALUES (?, ?, 'ASSIGNED', ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          `evt_${crypto.randomUUID()}`,
          appId,
          app.status,
          nextStatus,
          actor.id,
          actor.role,
          `Assigned to specialist officer ${operatorName}.`,
          nowIso
        )
        .run()
        .catch(() => null);
    }

    await recordAuditEvent(c.env, {
      actorId: actor.id,
      actorRole: actor.role,
      action: 'APPLICATION_ASSIGNED',
      resourceType: 'application',
      resourceId: appId,
      summary: `Assigned ${appId} to operator ${operatorUserId} (${operatorName})`,
      ip: c.req.header('cf-connecting-ip'),
    });

    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Application assigned to operator',
        requestId: reqId,
        data: { applicationId: appId, operatorUserId, operatorName, assignedAt: nowIso },
      })
    );
  }
);

unifiedRouter.post(
  '/applications/bulk-assign',
  requireAuth,
  requirePermission('applications.assign'),
  async (c) => {
    const reqId = c.get('requestId');
    const actor = c.get('user')!;
    const body = await c.req.json().catch(() => ({} as Record<string, any>));
    const appIds = Array.isArray(body?.applicationIds) ? body.applicationIds.slice(0, 50) : [];
    const operatorUserId = String(body?.operatorUserId || '').trim();
    const operatorName = String(body?.operatorName || 'Operations Specialist').trim();

    if (!operatorUserId || appIds.length === 0) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'FAILED',
          message: 'applicationIds[] and operatorUserId are required.',
          requestId: reqId,
          data: null,
          errorCode: 'INVALID_BULK_ASSIGN',
        }),
        400
      );
    }

    const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');
    const nowIso = new Date().toISOString();
    let updatedCount = 0;

    if (workflowDb) {
      for (const id of appIds) {
        const cleanId = String(id).trim();
        if (!cleanId) continue;
        await workflowDb
          .prepare(`UPDATE application_assignments SET is_active = 0, unassigned_at = ? WHERE application_id = ? AND is_active = 1`)
          .bind(nowIso, cleanId)
          .run()
          .catch(() => null);
        await workflowDb
          .prepare(
            `INSERT INTO application_assignments (id, application_id, operator_user_id, assigned_by_user_id, manager_user_id, is_active, assigned_at)
             VALUES (?, ?, ?, ?, ?, 1, ?)`
          )
          .bind(`asg_${crypto.randomUUID()}`, cleanId, operatorUserId, actor.id, actor.id, nowIso)
          .run()
          .catch(() => null);
        const res = await workflowDb
          .prepare(
            `UPDATE applications
             SET assigned_operator_id = ?,
                 status = CASE WHEN status IN ('Payment Confirmed', 'Submitted') THEN 'Assigned' ELSE status END,
                 updated_at = ?
             WHERE id = ?`
          )
          .bind(operatorUserId, nowIso, cleanId)
          .run();
        if ((res.meta?.changes || 0) > 0) updatedCount += 1;
      }
    }

    await recordAuditEvent(c.env, {
      actorId: actor.id,
      actorRole: actor.role,
      action: 'APPLICATIONS_BULK_ASSIGNED',
      resourceType: 'application',
      resourceId: appIds.join(',').slice(0, 120),
      summary: `Bulk assigned ${updatedCount} applications to ${operatorName} (${operatorUserId})`,
      ip: c.req.header('cf-connecting-ip'),
    });

    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: `Assigned ${updatedCount} application(s) to ${operatorName}`,
        requestId: reqId,
        data: { updatedCount, operatorUserId, operatorName },
      })
    );
  }
);

unifiedRouter.patch(
  '/applications/:id/documents/:docId/review',
  requireAuth,
  requirePermission('applications.verify_documents'),
  async (c) => {
    const reqId = c.get('requestId');
    const actor = c.get('user')!;
    const appId = c.req.param('id').trim();
    const docId = c.req.param('docId').trim();
    const body = await c.req.json().catch(() => ({} as Record<string, any>));
    const decision = String(body?.decision || '').trim();
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '';

    if (!['Verified', 'Rejected', 'Re-upload Requested'].includes(decision)) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'FAILED',
          message: 'decision must be Verified, Rejected, or Re-upload Requested',
          requestId: reqId,
          data: null,
          errorCode: 'INVALID_DECISION',
        }),
        400
      );
    }

    const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');
    const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
    if (workflowDb) {
      const app = await workflowDb
        .prepare(`SELECT id, user_id, assigned_operator_id FROM applications WHERE id = ? LIMIT 1`)
        .bind(appId)
        .first<any>();
      if (!app) {
        return c.json(
          buildApiResponse({
            success: false,
            status: 'FAILED',
            message: 'Application not found',
            requestId: reqId,
            data: null,
            errorCode: 'NOT_FOUND',
          }),
          404
        );
      }

      if (
        actor.role === 'operator' &&
        app.assigned_operator_id !== actor.id
      ) {
        return c.json(
          buildApiResponse({
            success: false,
            status: 'REJECTED',
            message: 'Operators can only review documents on their assigned applications.',
            requestId: reqId,
            data: null,
            errorCode: 'FORBIDDEN_UNASSIGNED',
          }),
          403
        );
      }

      const nowIso = new Date().toISOString();
      await workflowDb
        .prepare(
          `UPDATE application_documents SET verification_status = ?, rejection_reason = ? WHERE id = ? AND application_id = ?`
        )
        .bind(decision, reason || null, docId, appId)
        .run();

      await workflowDb
        .prepare(
          `UPDATE file_registry SET verification_status = ?, updated_at = ? WHERE id = ?`
        )
        .bind(decision, nowIso, docId)
        .run()
        .catch(() => null);

      await workflowDb
        .prepare(
          `INSERT INTO document_reviews (id, document_id, application_id, reviewer_user_id, decision, rejection_reason, reviewed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(`drev_${crypto.randomUUID()}`, docId, appId, actor.id, decision, reason || null, nowIso)
        .run()
        .catch(() => null);

      if (decision === 'Re-upload Requested' || decision === 'Rejected') {
        await workflowDb
          .prepare(
            `UPDATE applications SET status = 'Resubmission Required', customer_remarks = ?, updated_at = ? WHERE id = ?`
          )
          .bind(reason || `Document review marked ${decision}. Please re-upload corrected proof.`, nowIso, appId)
          .run();

        if (coreDb) {
          await coreDb
            .prepare(
              `INSERT INTO notifications (id, user_id, channel, title, content, is_read)
               VALUES (?, ?, 'in_app', ?, ?, 0)`
            )
            .bind(
              `notif_${crypto.randomUUID()}`,
              app.user_id,
              `Action Required on ${appId}`,
              reason || `Document marked ${decision}. Upload updated proof in your dashboard.`
            )
            .run()
            .catch(() => null);
        }
      }
    }

    await recordAuditEvent(c.env, {
      actorId: actor.id,
      actorRole: actor.role,
      action: 'DOCUMENT_REVIEWED',
      resourceType: 'application_document',
      resourceId: docId,
      summary: `Document ${docId} (${appId}) reviewed as ${decision}`,
      ip: c.req.header('cf-connecting-ip'),
    });

    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: `Document marked ${decision}`,
        requestId: reqId,
        data: { applicationId: appId, documentId: docId, decision, reason },
      })
    );
  }
);

unifiedRouter.post(
  '/applications/:id/completion',
  requireAuth,
  requirePermission('applications.complete'),
  async (c) => {
    const reqId = c.get('requestId');
    const actor = c.get('user')!;
    const appId = c.req.param('id').trim();
    const body = await c.req.json().catch(() => ({} as Record<string, any>));
    const fileName = String(body?.completionFileName || 'issued_certificate.pdf').trim().slice(0, 160);
    const fileUrl = String(body?.completionFileUrl || '').trim().slice(0, 400);

    if (!fileUrl) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'FAILED',
          message: 'completionFileUrl (R2 signed route or object URL) is required.',
          requestId: reqId,
          data: null,
          errorCode: 'MISSING_COMPLETION_URL',
        }),
        400
      );
    }

    const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');
    const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
    const nowIso = new Date().toISOString();

    if (workflowDb) {
      const app = await workflowDb
        .prepare(`SELECT id, user_id, status, assigned_operator_id FROM applications WHERE id = ? LIMIT 1`)
        .bind(appId)
        .first<any>();
      if (!app) {
        return c.json(
          buildApiResponse({
            success: false,
            status: 'FAILED',
            message: 'Application not found',
            requestId: reqId,
            data: null,
            errorCode: 'NOT_FOUND',
          }),
          404
        );
      }

      if (actor.role === 'operator' && app.assigned_operator_id !== actor.id) {
        return c.json(
          buildApiResponse({
            success: false,
            status: 'REJECTED',
            message: 'Operators can only complete applications assigned to them.',
            requestId: reqId,
            data: null,
            errorCode: 'FORBIDDEN_UNASSIGNED',
          }),
          403
        );
      }

      await workflowDb
        .prepare(
          `UPDATE applications
           SET status = 'Completed',
               completion_file_name = ?,
               completion_file_url = ?,
               customer_remarks = ?,
               updated_at = ?
           WHERE id = ?`
        )
        .bind(fileName, fileUrl, `Final issued certificate (${fileName}) is ready for download.`, nowIso, appId)
        .run();

      await workflowDb
        .prepare(
          `INSERT INTO application_events (id, application_id, event_type, previous_status, new_status, actor_user_id, actor_role, customer_message, created_at)
           VALUES (?, ?, 'STATUS_CHANGED', ?, 'Completed', ?, ?, ?, ?)`
        )
        .bind(
          `evt_${crypto.randomUUID()}`,
          appId,
          app.status,
          actor.id,
          actor.role,
          `Final deliverable (${fileName}) uploaded and ready.`,
          nowIso
        )
        .run()
        .catch(() => null);

      if (coreDb) {
        await coreDb
          .prepare(
            `INSERT INTO notifications (id, user_id, channel, title, content, is_read)
             VALUES (?, ?, 'in_app', ?, ?, 0)`
          )
          .bind(
            `notif_${crypto.randomUUID()}`,
            app.user_id,
            `Certificate Ready (${appId})`,
            `Your final deliverable ${fileName} is ready for download.`
          )
          .run()
          .catch(() => null);
      }
    }

    await recordAuditEvent(c.env, {
      actorId: actor.id,
      actorRole: actor.role,
      action: 'APPLICATION_COMPLETED',
      resourceType: 'application',
      resourceId: appId,
      summary: `Marked ${appId} Completed with deliverable ${fileName}`,
      ip: c.req.header('cf-connecting-ip'),
    });

    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Application completed and deliverable linked',
        requestId: reqId,
        data: { applicationId: appId, completionFileName: fileName, completionFileUrl: fileUrl, updatedAt: nowIso },
      })
    );
  }
);

// ==========================================
// 4. SUPPORT TICKETS & MESSAGES
// ==========================================
unifiedRouter.get('/tickets', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const isStaff = user.role === 'manager' || user.role === 'operator' || isSuperAdminRole(user.role);

  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  if (!coreDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Tickets endpoint ready', requestId: reqId, data: [] }));
  }

  const ticketsRes = isStaff
    ? await coreDb.prepare(`SELECT * FROM support_tickets ORDER BY updated_at DESC LIMIT 100`).all<any>().catch(() => ({ results: [] }))
    : await coreDb
        .prepare(`SELECT * FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100`)
        .bind(user.id)
        .all<any>()
        .catch(() => ({ results: [] }));

  const tickets = ticketsRes.results || [];
  const enriched = await Promise.all(
    tickets.slice(0, 30).map(async (t: any) => {
      const msgs = await coreDb
        .prepare(`SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC`)
        .bind(t.id)
        .all<any>()
        .catch(() => ({ results: [] }));
      return { ...t, messages: msgs.results || [] };
    })
  );

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Retrieved ${enriched.length} support ticket(s)`,
      requestId: reqId,
      data: enriched,
    })
  );
});

unifiedRouter.post('/tickets', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));

  const subject = String(body?.subject || '').trim().slice(0, 200);
  const message = String(body?.message || body?.initialMessage || '').trim().slice(0, 2000);
  const category = String(body?.category || 'General Query').trim().slice(0, 80);
  const priority = ['Low', 'Medium', 'High', 'Urgent'].includes(body?.priority) ? body.priority : 'Medium';
  const applicationId = body?.applicationId ? String(body.applicationId).trim().slice(0, 64) : null;

  if (!subject || !message) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'subject and message are required.',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_TICKET_FIELDS',
      }),
      400
    );
  }

  const ticketId = `tkt_${crypto.randomUUID().slice(0, 12)}`;
  const ticketNumber = `TKT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const nowIso = new Date().toISOString();

  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  if (coreDb) {
    await coreDb
      .prepare(`INSERT OR IGNORE INTO users (id, name, email, mobile) VALUES (?, ?, ?, ?)`)
      .bind(user.id, user.name, user.email, (user as { mobile?: string }).mobile || '0000000000')
      .run()
      .catch(() => null);

    await coreDb
      .prepare(
        `INSERT INTO support_tickets (id, ticket_number, user_id, application_id, category, subject, status, priority, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?)`
      )
      .bind(ticketId, ticketNumber, user.id, applicationId, category, subject, priority, nowIso, nowIso)
      .run();

    await coreDb
      .prepare(
        `INSERT INTO support_messages (id, ticket_id, sender_id, sender_role, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(`msg_${crypto.randomUUID()}`, ticketId, user.id, user.role, message, nowIso)
      .run();
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Support ticket ${ticketNumber} opened`,
      requestId: reqId,
      data: { id: ticketId, ticketNumber, userId: user.id, applicationId, category, subject, status: 'Open', priority, createdAt: nowIso },
    }),
    201
  );
});

unifiedRouter.post('/tickets/:id/reply', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const ticketId = c.req.param('id').trim();
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const message = String(body?.message || '').trim().slice(0, 2000);
  const nextStatus = typeof body?.status === 'string' && ['Open', 'In Progress', 'Resolved', 'Closed'].includes(body.status)
    ? body.status
    : undefined;

  if (!message && !nextStatus) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'message or status update is required',
        requestId: reqId,
        data: null,
        errorCode: 'EMPTY_REPLY',
      }),
      400
    );
  }

  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  if (!coreDb) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'D1 unavailable', requestId: reqId, data: null, errorCode: 'D1_UNBOUND' }), 503);
  }

  const ticket = await coreDb.prepare(`SELECT * FROM support_tickets WHERE id = ? LIMIT 1`).bind(ticketId).first<any>();
  if (!ticket) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'Ticket not found', requestId: reqId, data: null, errorCode: 'NOT_FOUND' }), 404);
  }

  const isStaff = user.role === 'manager' || user.role === 'operator' || isSuperAdminRole(user.role);
  if (ticket.user_id !== user.id && !isStaff) {
    return c.json(buildApiResponse({ success: false, status: 'REJECTED', message: 'Cannot reply to another user ticket', requestId: reqId, data: null, errorCode: 'FORBIDDEN' }), 403);
  }

  const nowIso = new Date().toISOString();
  if (message) {
    await coreDb
      .prepare(`INSERT INTO support_messages (id, ticket_id, sender_id, sender_role, message, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(`msg_${crypto.randomUUID()}`, ticketId, user.id, user.role, message, nowIso)
      .run();
  }

  const resolvedStatus = nextStatus || (isStaff ? 'In Progress' : ticket.status);
  await coreDb
    .prepare(`UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?`)
    .bind(resolvedStatus, nowIso, ticketId)
    .run();

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Support ticket updated',
      requestId: reqId,
      data: { ticketId, status: resolvedStatus, updatedAt: nowIso },
    })
  );
});

// ==========================================
// 5. GST INVOICES & REFUNDS (WITH COMMISSION REVERSAL)
// ==========================================
unifiedRouter.get('/invoices', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const isStaff = user.role === 'manager' || isSuperAdminRole(user.role);

  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (!billingDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Invoices endpoint active', requestId: reqId, data: [] }));
  }

  const res = isStaff
    ? await billingDb.prepare(`SELECT * FROM invoices ORDER BY issued_at DESC LIMIT 100`).all().catch(() => ({ results: [] }))
    : await billingDb.prepare(`SELECT * FROM invoices WHERE user_id = ? ORDER BY issued_at DESC LIMIT 100`).bind(user.id).all().catch(() => ({ results: [] }));

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Invoices retrieved',
      requestId: reqId,
      data: res.results || [],
    })
  );
});

unifiedRouter.get('/invoices/:id', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const id = c.req.param('id').trim();
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (!billingDb) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'Billing DB unavailable', requestId: reqId, data: null, errorCode: 'D1_UNBOUND' }), 503);
  }

  const inv = await billingDb.prepare(`SELECT * FROM invoices WHERE id = ? OR invoice_number = ? LIMIT 1`).bind(id, id).first<any>();
  if (!inv) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'Invoice not found', requestId: reqId, data: null, errorCode: 'NOT_FOUND' }), 404);
  }

  if (inv.user_id !== user.id && user.role !== 'manager' && !isSuperAdminRole(user.role)) {
    return c.json(buildApiResponse({ success: false, status: 'REJECTED', message: 'Unauthorized invoice access', requestId: reqId, data: null, errorCode: 'FORBIDDEN' }), 403);
  }

  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Invoice fetched', requestId: reqId, data: inv }));
});

unifiedRouter.get('/refunds', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const isAdmin = isSuperAdminRole(user.role) || user.role === 'manager';
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (!billingDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Refunds active', requestId: reqId, data: [] }));
  }

  const res = isAdmin
    ? await billingDb
        .prepare(
          `SELECT r.*, p.order_id, p.application_id, p.user_id
           FROM refunds r LEFT JOIN payments p ON p.id = r.payment_id
           ORDER BY r.created_at DESC LIMIT 100`
        )
        .all()
        .catch(() => ({ results: [] }))
    : await billingDb
        .prepare(
          `SELECT r.*, p.order_id, p.application_id, p.user_id
           FROM refunds r INNER JOIN payments p ON p.id = r.payment_id
           WHERE p.user_id = ?
           ORDER BY r.created_at DESC LIMIT 50`
        )
        .bind(user.id)
        .all()
        .catch(() => ({ results: [] }));

  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Refund records retrieved', requestId: reqId, data: res.results || [] }));
});

unifiedRouter.post('/refunds', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const applicationId = String(body?.applicationId || '').trim();
  const orderId = String(body?.orderId || '').trim();
  const reason = String(body?.reason || '').trim().slice(0, 500);

  if ((!applicationId && !orderId) || !reason) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'applicationId/orderId and reason are required to request a refund.',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_REFUND_FIELDS',
      }),
      400
    );
  }

  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (!billingDb) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'Billing D1 unavailable', requestId: reqId, data: null, errorCode: 'D1_UNBOUND' }), 503);
  }

  const payment = await billingDb
    .prepare(
      `SELECT * FROM payments
       WHERE (order_id = ? OR application_id = ?) AND status = 'Success'
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(orderId || '__none__', applicationId || '__none__')
    .first<any>();

  if (!payment) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'No eligible confirmed payment found for refund request.',
        requestId: reqId,
        data: null,
        errorCode: 'PAYMENT_NOT_ELIGIBLE',
      }),
      404
    );
  }

  if (payment.user_id !== user.id && !isSuperAdminRole(user.role)) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Cannot request refund for another user payment.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }

  const existingRefund = await billingDb
    .prepare(`SELECT id, status FROM refunds WHERE payment_id = ? AND status IN ('Pending', 'Approved', 'Processed') LIMIT 1`)
    .bind(payment.id)
    .first<any>()
    .catch(() => null);

  if (existingRefund) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: `A refund (${existingRefund.id}) is already ${existingRefund.status} for this payment.`,
        requestId: reqId,
        data: existingRefund,
        errorCode: 'DUPLICATE_REFUND_REQUEST',
      }),
      409
    );
  }

  const refundId = `ref_${crypto.randomUUID().slice(0, 12)}`;
  const requestedAmount = body?.amount && Number(body.amount) > 0 && Number(body.amount) <= Number(payment.total_amount)
    ? Math.round(Number(body.amount))
    : Number(payment.total_amount);

  await billingDb
    .prepare(`INSERT INTO refunds (id, payment_id, amount, reason, status, initiated_by) VALUES (?, ?, ?, ?, 'Pending', ?)`)
    .bind(refundId, payment.id, requestedAmount, reason, user.id)
    .run();

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'REFUND_REQUESTED',
    resourceType: 'refund',
    resourceId: refundId,
    summary: `Refund requested on payment ${payment.id} (app ${payment.application_id}) INR ${requestedAmount}`,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Refund request submitted for compliance review',
      requestId: reqId,
      data: { id: refundId, paymentId: payment.id, applicationId: payment.application_id, amount: requestedAmount, status: 'Pending' },
    }),
    201
  );
});

unifiedRouter.patch(
  '/refunds/:id/process',
  requireAuth,
  requirePermission('payments.refund'),
  async (c) => {
    const reqId = c.get('requestId');
    const actor = c.get('user')!;
    const refundId = c.req.param('id').trim();
    const body = await c.req.json().catch(() => ({} as Record<string, any>));
    const decision = String(body?.decision || '').trim();
    const refundSpeed: 'STANDARD' | 'INSTANT' = body?.refundSpeed === 'INSTANT' ? 'INSTANT' : 'STANDARD';

    if (!['Approved', 'Rejected', 'Processed'].includes(decision)) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'FAILED',
          message: 'decision must be Approved, Processed, or Rejected.',
          requestId: reqId,
          data: null,
          errorCode: 'INVALID_REFUND_DECISION',
        }),
        400
      );
    }

    const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
    if (!billingDb) {
      return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'Billing DB unavailable', requestId: reqId, data: null, errorCode: 'D1_UNBOUND' }), 503);
    }

    const refRow = await billingDb
      .prepare(
        `SELECT r.*, p.application_id, p.user_id, p.order_id, p.cf_payment_id, p.order_amount_paise, p.total_amount, p.refunded_paise
         FROM refunds r INNER JOIN payments p ON p.id = r.payment_id
         WHERE r.id = ? LIMIT 1`
      )
      .bind(refundId)
      .first<any>();

    if (!refRow) {
      return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'Refund not found', requestId: reqId, data: null, errorCode: 'NOT_FOUND' }), 404);
    }

    if (decision === 'Rejected') {
      await billingDb
        .prepare(`UPDATE refunds SET status = 'Rejected', gateway_status = 'CANCELLED', processed_by = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(actor.id, refundId)
        .run()
        .catch(async () => {
          await billingDb.prepare(`UPDATE refunds SET status = 'Rejected' WHERE id = ?`).bind(refundId).run();
        });

      await recordAuditEvent(c.env, {
        actorId: actor.id,
        actorRole: actor.role,
        action: 'REFUND_REJECTED',
        resourceType: 'refund',
        resourceId: refundId,
        summary: `Refund ${refundId} rejected for app ${refRow.application_id}`,
        ip: c.req.header('cf-connecting-ip'),
      });

      return c.json(
        buildApiResponse({
          success: true,
          status: 'SUCCESS',
          message: `Refund ${refundId} Rejected`,
          requestId: reqId,
          data: { refundId, status: 'Rejected', applicationId: refRow.application_id },
        })
      );
    }

    // Check remaining refundable balance
    const paidPaise = Number(refRow.order_amount_paise || toPaise(Number(refRow.total_amount || 0)));
    const alreadyRefundedPaise = Number(refRow.refunded_paise || 0);
    const refundAmountInr = body?.refundAmount !== undefined ? Number(body.refundAmount) : Number(refRow.amount || 0);
    const refundPaise = refRow.refund_amount_paise
      ? Number(refRow.refund_amount_paise)
      : toPaise(refundAmountInr);

    if (paidPaise > 0 && alreadyRefundedPaise + refundPaise > paidPaise) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'REJECTED',
          message: `Over-refund blocked: ₹${fromPaise(refundPaise)} requested exceeds remaining refundable balance ₹${fromPaise(Math.max(0, paidPaise - alreadyRefundedPaise))}.`,
          requestId: reqId,
          data: { refundableRemainingInr: fromPaise(Math.max(0, paidPaise - alreadyRefundedPaise)) },
          errorCode: 'OVER_REFUND_BLOCKED',
        }),
        409
      );
    }

    const orderRow = refRow.order_id
      ? await billingDb.prepare(`SELECT gateway_session_id FROM payment_orders WHERE id = ? LIMIT 1`).bind(refRow.order_id).first<{ gateway_session_id?: string | null }>().catch(() => null)
      : null;

    const cfConfig = await loadEffectiveCashfreeConfig(c.env);
    const isLiveGatewayOrder =
      cfConfig.configured &&
      Boolean(refRow.order_id) &&
      !String(refRow.order_id).startsWith('TEST_CF_') &&
      !String(orderRow?.gateway_session_id || '').startsWith('sim_') &&
      !refRow.cf_refund_id;

    let gatewayRes: Awaited<ReturnType<typeof createCashfreeRefund>> | null = null;
    if (isLiveGatewayOrder) {
      gatewayRes = await createCashfreeRefund(cfConfig, {
        orderId: refRow.order_id,
        refundId,
        refundAmountInr: fromPaise(refundPaise),
        refundNote: String(body?.note || refRow.reason || 'Approved refund'),
        refundSpeed,
        idempotencyKey: `ref_${refundId}`,
      });

      if (!gatewayRes.ok && body?.allowOfflineManualRefund !== true) {
        await billingDb
          .prepare(`UPDATE refunds SET gateway_status = 'FAILED', processed_by = ?, gateway_response_json = ? WHERE id = ?`)
          .bind(actor.id, gatewayRes.raw ? JSON.stringify(gatewayRes.raw).slice(0, 4000) : null, refundId)
          .run()
          .catch(() => null);

        return c.json(
          buildApiResponse({
            success: false,
            status: 'FAILED',
            message: gatewayRes.errorMessage || 'Cashfree refund API rejected this refund',
            requestId: reqId,
            data: { refundId, orderId: refRow.order_id, errorCode: gatewayRes.errorCode },
            errorCode: gatewayRes.errorCode || 'CASHFREE_REFUND_FAILED',
          }),
          gatewayRes.httpStatus >= 400 && gatewayRes.httpStatus < 600 ? (gatewayRes.httpStatus as any) : 502
        );
      }
    }

    const effectiveGatewayStatus = gatewayRes
      ? gatewayRes.refundStatus
      : decision === 'Processed'
      ? 'SUCCESS'
      : 'SUCCESS';

    await billingDb
      .prepare(
        `UPDATE refunds
         SET status = ?, order_id = COALESCE(order_id, ?), application_id = COALESCE(application_id, ?),
             refund_amount_paise = COALESCE(refund_amount_paise, ?), processed_by = ?,
             refund_mode = COALESCE(?, refund_mode), updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(
        effectiveGatewayStatus === 'SUCCESS' ? 'Processed' : decision,
        refRow.order_id,
        refRow.application_id,
        refundPaise,
        actor.id,
        refundSpeed,
        refundId
      )
      .run()
      .catch(async () => {
        await billingDb.prepare(`UPDATE refunds SET status = ? WHERE id = ?`).bind(decision, refundId).run();
      });

    const reconciled = await reconcileRefundOutcome(c.env, {
      refundId,
      orderId: refRow.order_id,
      cfRefundId: gatewayRes?.cfRefundId || refRow.cf_refund_id,
      cfPaymentId: gatewayRes?.cfPaymentId || refRow.cf_payment_id,
      refundAmountInr: fromPaise(refundPaise),
      refundArn: gatewayRes?.refundArn,
      refundMode: gatewayRes?.refundMode || refundSpeed,
      refundStatus: effectiveGatewayStatus,
      statusDescription: gatewayRes?.statusDescription || body?.note || refRow.reason,
      processedAt: gatewayRes?.processedAt || new Date().toISOString(),
      rawGatewayJson: gatewayRes?.raw ? JSON.stringify(gatewayRes.raw) : undefined,
      actorId: actor.id,
      ip: c.req.header('cf-connecting-ip'),
    });

    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: `Refund ${refundId} ${decision}`,
        requestId: reqId,
        data: {
          refundId,
          status: effectiveGatewayStatus === 'SUCCESS' ? 'Processed' : decision,
          gatewayStatus: effectiveGatewayStatus,
          cfRefundId: gatewayRes?.cfRefundId,
          refundArn: gatewayRes?.refundArn,
          paymentStatus: reconciled.paymentStatus,
          commissionReversed: reconciled.commissionReversed,
          applicationId: refRow.application_id,
        },
      })
    );
  }
);

// ==========================================
// 6. PARTNER OPERATIONS, LEDGER & SETTLEMENT REQUESTS
// ==========================================
unifiedRouter.post('/partners/enroll', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const businessName = String(body?.businessName || '').trim().slice(0, 140);

  if (!businessName) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'businessName is required',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_BUSINESS_NAME',
      }),
      400
    );
  }

  const { db: partnersDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_partners');
  const partnerId = `part_${user.id.slice(0, 16)}`;
  const partnerCode = `PART-DIP-${Math.floor(1000 + Math.random() * 9000)}`;
  const referralCode = `REF-${businessName.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 5) || 'DIP'}${Math.floor(100 + Math.random() * 900)}`;

  if (partnersDb) {
    await partnersDb
      .prepare(`INSERT OR IGNORE INTO users (id, name, email, mobile) VALUES (?, ?, ?, ?)`)
      .bind(user.id, user.name, user.email, (user as { mobile?: string }).mobile || '0000000000')
      .run()
      .catch(() => null);

    await partnersDb
      .prepare(
        `INSERT INTO partners (
          id, user_id, partner_code, partner_type, business_name, pan_masked, state, district,
          pincode, payout_bank_ifsc, payout_account_masked, approval_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending Approval')
        ON CONFLICT(user_id) DO UPDATE SET
          business_name = excluded.business_name,
          state = excluded.state,
          district = excluded.district,
          pincode = excluded.pincode,
          payout_bank_ifsc = excluded.payout_bank_ifsc,
          payout_account_masked = excluded.payout_account_masked,
          updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        partnerId,
        user.id,
        partnerCode,
        String(body?.partnerType || 'individual_agent'),
        businessName,
        body?.panMasked || null,
        body?.state || null,
        body?.district || null,
        body?.pincode || null,
        body?.bankIfsc || null,
        body?.bankAccountMasked || null
      )
      .run();

    await partnersDb
      .prepare(`INSERT OR IGNORE INTO referral_codes (id, partner_id, code, is_active) VALUES (?, ?, ?, 1)`)
      .bind(`ref_${crypto.randomUUID().slice(0, 10)}`, partnerId, referralCode)
      .run()
      .catch(() => null);
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Partner enrollment submitted for Admin approval',
      requestId: reqId,
      data: { id: partnerId, partnerCode, referralCode, businessName, approvalStatus: 'Pending Approval' },
    }),
    201
  );
});

unifiedRouter.get('/partners/customers', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const { db: partnersDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_partners');
  if (!partnersDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Partner customers ready', requestId: reqId, data: [] }));
  }

  const partnerRow = await partnersDb.prepare(`SELECT id FROM partners WHERE user_id = ? LIMIT 1`).bind(user.id).first<{ id: string }>().catch(() => null);
  if (!partnerRow && !isSuperAdminRole(user.role)) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'No partner record yet', requestId: reqId, data: [] }));
  }

  const res = isSuperAdminRole(user.role)
    ? await partnersDb
        .prepare(
          `SELECT pc.*, u.name, u.email, u.mobile
           FROM partner_customers pc LEFT JOIN users u ON u.id = pc.customer_user_id
           ORDER BY pc.onboarded_at DESC LIMIT 100`
        )
        .all()
        .catch(() => ({ results: [] }))
    : await partnersDb
        .prepare(
          `SELECT pc.*, u.name, u.email, u.mobile
           FROM partner_customers pc LEFT JOIN users u ON u.id = pc.customer_user_id
           WHERE pc.partner_id = ?
           ORDER BY pc.onboarded_at DESC LIMIT 100`
        )
        .bind(partnerRow!.id)
        .all()
        .catch(() => ({ results: [] }));

  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Partner customers retrieved', requestId: reqId, data: res.results || [] }));
});

unifiedRouter.post('/partners/customers', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const name = String(body?.name || '').trim().slice(0, 120);
  const email = String(body?.email || '').trim().toLowerCase().slice(0, 150);
  const mobile = String(body?.mobile || '').trim().slice(0, 25);

  if (!name || !email || !mobile) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'name, email, and mobile are required',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_CUSTOMER_FIELDS',
      }),
      400
    );
  }

  const { db: partnersDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_partners');
  const customerId = `cust_${crypto.randomUUID().slice(0, 12)}`;
  if (partnersDb) {
    const partner = await partnersDb
      .prepare(`SELECT id FROM partners WHERE user_id = ? LIMIT 1`)
      .bind(user.id)
      .first<{ id: string }>()
      .catch(() => null);

    if (!partner) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'REJECTED',
          message: 'Active partner profile required before onboarding customers.',
          requestId: reqId,
          data: null,
          errorCode: 'PARTNER_PROFILE_REQUIRED',
        }),
        403
      );
    }

    await partnersDb
      .prepare(`INSERT OR IGNORE INTO users (id, name, email, mobile) VALUES (?, ?, ?, ?)`)
      .bind(customerId, name, email, mobile)
      .run();

    await partnersDb
      .prepare(
        `INSERT OR IGNORE INTO partner_customers (id, partner_id, customer_user_id, consent_captured, consent_reference)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(`pc_${crypto.randomUUID().slice(0, 10)}`, partner.id, customerId, body?.consentCaptured === false ? 0 : 1, body?.consentReference || 'PARTNER-DESK-CONSENT')
      .run();
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Assisted customer registered under partner portfolio',
      requestId: reqId,
      data: { id: customerId, name, email, mobile },
    }),
    201
  );
});

unifiedRouter.get('/settlements', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const isAdmin = isSuperAdminRole(user.role) || user.role === 'manager';
  const { db: partnersDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_partners');
  if (!partnersDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Settlements active', requestId: reqId, data: [] }));
  }

  const partner = await partnersDb.prepare(`SELECT id FROM partners WHERE user_id = ? LIMIT 1`).bind(user.id).first<{ id: string }>().catch(() => null);
  const res = isAdmin
    ? await partnersDb.prepare(`SELECT * FROM settlement_requests ORDER BY requested_at DESC LIMIT 100`).all().catch(() => ({ results: [] }))
    : partner
    ? await partnersDb
        .prepare(`SELECT * FROM settlement_requests WHERE partner_id = ? ORDER BY requested_at DESC LIMIT 50`)
        .bind(partner.id)
        .all()
        .catch(() => ({ results: [] }))
    : { results: [] };

  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Settlement requests retrieved', requestId: reqId, data: res.results || [] }));
});

unifiedRouter.post('/settlements/request', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const requestedPaise =
    body?.requestedPaise !== undefined
      ? Math.round(Number(body.requestedPaise))
      : body?.amountInr !== undefined
      ? toPaise(Number(body.amountInr))
      : 0;

  if (!Number.isFinite(requestedPaise) || requestedPaise < 50000) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Minimum settlement payout request is INR 500 (50000 paise).',
        requestId: reqId,
        data: null,
        errorCode: 'MIN_SETTLEMENT_NOT_MET',
      }),
      400
    );
  }

  const { db: partnersDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_partners');
  if (!partnersDb) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'Partners DB unavailable', requestId: reqId, data: null, errorCode: 'D1_UNBOUND' }), 503);
  }

  const partner = await partnersDb
    .prepare(`SELECT * FROM partners WHERE user_id = ? LIMIT 1`)
    .bind(user.id)
    .first<any>()
    .catch(() => null);

  if (!partner || partner.approval_status !== 'Approved') {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Only Approved partners can submit settlement payout requests.',
        requestId: reqId,
        data: null,
        errorCode: 'PARTNER_NOT_APPROVED',
      }),
      403
    );
  }

  const ledgerAgg = await partnersDb
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN status IN ('Approved', 'Pending') THEN net_paise ELSE 0 END), 0) AS available_paise
       FROM commission_ledger WHERE partner_id = ?`
    )
    .bind(partner.id)
    .first<{ available_paise: number }>()
    .catch(() => ({ available_paise: 0 }));

  if (Number(ledgerAgg?.available_paise || 0) < requestedPaise) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: `Requested amount exceeds available commission balance (INR ${(Number(ledgerAgg?.available_paise || 0) / 100).toFixed(2)}).`,
        requestId: reqId,
        data: { availablePaise: Number(ledgerAgg?.available_paise || 0) },
        errorCode: 'INSUFFICIENT_COMMISSION_BALANCE',
      }),
      409
    );
  }

  const requestId = `stlreq_${crypto.randomUUID().slice(0, 12)}`;
  await partnersDb
    .prepare(`INSERT INTO settlement_requests (id, partner_id, requested_paise, status) VALUES (?, ?, ?, 'Requested')`)
    .bind(requestId, partner.id, requestedPaise)
    .run();

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'SETTLEMENT_REQUESTED',
    resourceType: 'settlement_request',
    resourceId: requestId,
    summary: `Partner ${partner.id} requested payout of ${requestedPaise} paise`,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Settlement payout request submitted for Super Admin review',
      requestId: reqId,
      data: { id: requestId, partnerId: partner.id, requestedPaise, status: 'Requested' },
    }),
    201
  );
});

unifiedRouter.get('/commissions/rules', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const { db: partnersDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_partners');
  if (!partnersDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Commission rules active', requestId: reqId, data: [] }));
  }
  const rows = await partnersDb.prepare(`SELECT * FROM commission_rules WHERE is_active = 1`).all().catch(() => ({ results: [] }));
  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Commission rules fetched', requestId: reqId, data: rows.results || [] }));
});

unifiedRouter.post('/commissions/rules', requireAuth, requirePermission('commissions.manage'), async (c) => {
  const reqId = c.get('requestId');
  const actor = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const id = String(body?.id || `rule_${crypto.randomUUID().slice(0, 10)}`);
  const name = String(body?.name || 'Partner Tier Rule').trim().slice(0, 120);
  const { db: partnersDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_partners');
  if (partnersDb) {
    await partnersDb
      .prepare(
        `INSERT INTO commission_rules (
          id, name, partner_id, partner_type, service_id, commission_type, fixed_amount_paise, percentage_bps, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          fixed_amount_paise = excluded.fixed_amount_paise,
          percentage_bps = excluded.percentage_bps,
          is_active = excluded.is_active`
      )
      .bind(
        id,
        name,
        body?.partnerId || null,
        body?.partnerType || null,
        body?.serviceId || null,
        body?.commissionType === 'fixed' ? 'fixed' : 'percentage',
        Math.round(Number(body?.fixedAmountPaise || 0)),
        Math.round(Number(body?.percentageBps ?? 1500)),
        body?.isActive === false ? 0 : 1
      )
      .run();
  }
  await recordAuditEvent(c.env, {
    actorId: actor.id,
    actorRole: actor.role,
    action: 'COMMISSION_RULE_SAVED',
    resourceType: 'commission_rule',
    resourceId: id,
    summary: `Saved commission rule ${name}`,
    ip: c.req.header('cf-connecting-ip'),
  });
  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Commission rule saved', requestId: reqId, data: { id, name } }));
});

// ==========================================
// 7. NOTIFICATIONS (IN-APP PERSISTENCE)
// ==========================================
unifiedRouter.get('/notifications', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  if (!coreDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Notifications active', requestId: reqId, data: [] }));
  }
  const res = await coreDb
    .prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY dispatched_at DESC LIMIT 50`)
    .bind(user.id)
    .all()
    .catch(() => ({ results: [] }));
  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Notifications loaded', requestId: reqId, data: res.results || [] }));
});

unifiedRouter.post('/notifications/read-all', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  if (coreDb) {
    await coreDb.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).bind(user.id).run().catch(() => null);
  }
  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'All notifications marked read', requestId: reqId, data: { ok: true } }));
});

// ==========================================
// 8. B2B ENTERPRISE PROFILE, TEAM MEMBERS, KEY ROTATION & BULK JOBS
// ==========================================
unifiedRouter.get('/b2b/profile', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
  if (!apiDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'B2B profile ready', requestId: reqId, data: null }));
  }
  const biz = await apiDb
    .prepare(
      `SELECT b.* FROM businesses b
       LEFT JOIN business_members m ON m.business_id = b.id
       WHERE b.contact_email = ? OR m.user_id = ?
       LIMIT 1`
    )
    .bind(user.email, user.id)
    .first<any>()
    .catch(() => null);

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: biz ? 'B2B business account loaded' : 'No B2B account onboarded yet',
      requestId: reqId,
      data: biz || null,
    })
  );
});

unifiedRouter.post('/b2b/profile', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const companyName = String(body?.companyName || user.name || 'Enterprise Client').trim().slice(0, 140);
  const gstin = String(body?.gstin || '').trim().toUpperCase().slice(0, 15) || null;
  const pan = String(body?.pan || '').trim().toUpperCase().slice(0, 10) || null;
  const contactPhone = String(body?.contactPhone || (user as { mobile?: string }).mobile || '9876543210').trim().slice(0, 20);
  const registeredAddress = String(body?.registeredAddress || 'India').trim().slice(0, 250);

  const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
  const businessId = `biz_${user.id.slice(0, 12)}`;
  const generatedKey = `dip_live_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

  if (apiDb) {
    await apiDb
      .prepare(`INSERT OR IGNORE INTO users (id, name, email, mobile) VALUES (?, ?, ?, ?)`)
      .bind(user.id, user.name, user.email, contactPhone)
      .run()
      .catch(() => null);

    await apiDb
      .prepare(
        `INSERT INTO businesses (
          id, company_name, trade_name, gstin, pan, business_type, industry,
          contact_email, contact_phone, registered_address, plan, api_credits_remaining,
          monthly_quota, api_key, webhook_url, is_kyc_verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Starter', 250, 1000, ?, ?, 0)
        ON CONFLICT(id) DO UPDATE SET
          company_name = excluded.company_name,
          gstin = COALESCE(excluded.gstin, businesses.gstin),
          pan = COALESCE(excluded.pan, businesses.pan),
          contact_phone = excluded.contact_phone,
          registered_address = excluded.registered_address,
          webhook_url = COALESCE(excluded.webhook_url, businesses.webhook_url),
          updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        businessId,
        companyName,
        companyName,
        gstin,
        pan,
        String(body?.businessType || 'Private Limited'),
        String(body?.industry || 'Fintech & Compliance'),
        user.email,
        contactPhone,
        registeredAddress,
        generatedKey,
        body?.webhookUrl ? String(body.webhookUrl).slice(0, 250) : null
      )
      .run();

    await apiDb
      .prepare(`INSERT OR IGNORE INTO business_members (id, business_id, user_id, role) VALUES (?, ?, ?, 'OWNER')`)
      .bind(`bm_${user.id.slice(0, 12)}`, businessId, user.id)
      .run()
      .catch(() => null);
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'B2B organization profile saved',
      requestId: reqId,
      data: { id: businessId, companyName, gstin, pan, plan: 'Starter' },
    })
  );
});

unifiedRouter.post('/b2b/rotate-key', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
  if (!apiDb) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'API D1 unavailable', requestId: reqId, data: null, errorCode: 'D1_UNBOUND' }), 503);
  }

  const biz = await apiDb
    .prepare(
      `SELECT b.id FROM businesses b
       LEFT JOIN business_members m ON m.business_id = b.id
       WHERE b.contact_email = ? OR (m.user_id = ? AND m.role IN ('OWNER', 'ADMIN'))
       LIMIT 1`
    )
    .bind(user.email, user.id)
    .first<{ id: string }>();

  if (!biz) {
    return c.json(buildApiResponse({ success: false, status: 'REJECTED', message: 'Authorized B2B owner account required.', requestId: reqId, data: null, errorCode: 'FORBIDDEN' }), 403);
  }

  const newKey = `dip_live_${crypto.randomUUID().replace(/-/g, '')}`;
  await apiDb.prepare(`UPDATE businesses SET api_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(newKey, biz.id).run();

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'B2B_API_KEY_ROTATED',
    resourceType: 'business',
    resourceId: biz.id,
    summary: `Rotated B2B live API key for business ${biz.id}`,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'API key rotated cleanly. Update your integrations with the new key.',
      requestId: reqId,
      data: { businessId: biz.id, apiKey: newKey },
    })
  );
});

unifiedRouter.get('/b2b/members', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
  if (!apiDb) return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'B2B members ready', requestId: reqId, data: [] }));

  const biz = await apiDb
    .prepare(
      `SELECT b.id FROM businesses b LEFT JOIN business_members m ON m.business_id = b.id
       WHERE b.contact_email = ? OR m.user_id = ? LIMIT 1`
    )
    .bind(user.email, user.id)
    .first<{ id: string }>()
    .catch(() => null);

  if (!biz) return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'No B2B account', requestId: reqId, data: [] }));

  const members = await apiDb
    .prepare(
      `SELECT m.*, u.name, u.email FROM business_members m
       LEFT JOIN users u ON u.id = m.user_id WHERE m.business_id = ?`
    )
    .bind(biz.id)
    .all()
    .catch(() => ({ results: [] }));

  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'B2B team members fetched', requestId: reqId, data: members.results || [] }));
});

unifiedRouter.post('/b2b/members', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const email = String(body?.email || '').trim().toLowerCase();
  const name = String(body?.name || email.split('@')[0] || 'Team Member').trim().slice(0, 100);
  const role = ['ADMIN', 'MEMBER', 'VIEWER'].includes(body?.role) ? body.role : 'MEMBER';

  if (!email.includes('@')) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'Valid member email required', requestId: reqId, data: null, errorCode: 'INVALID_EMAIL' }), 400);
  }

  const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
  if (!apiDb) return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'D1 unbound', requestId: reqId, data: null, errorCode: 'D1_UNBOUND' }), 503);

  const biz = await apiDb
    .prepare(`SELECT b.id FROM businesses b LEFT JOIN business_members m ON m.business_id = b.id WHERE b.contact_email = ? OR (m.user_id = ? AND m.role IN ('OWNER', 'ADMIN')) LIMIT 1`)
    .bind(user.email, user.id)
    .first<{ id: string }>();

  if (!biz) return c.json(buildApiResponse({ success: false, status: 'REJECTED', message: 'B2B Owner/Admin required', requestId: reqId, data: null, errorCode: 'FORBIDDEN' }), 403);

  const memberUserId = `usr_${crypto.randomUUID().slice(0, 12)}`;
  await apiDb.prepare(`INSERT OR IGNORE INTO users (id, name, email, mobile) VALUES (?, ?, ?, '0000000000')`).bind(memberUserId, name, email).run();
  const existingUser = await apiDb.prepare(`SELECT id FROM users WHERE email = ? LIMIT 1`).bind(email).first<{ id: string }>();
  const resolvedUid = existingUser?.id || memberUserId;

  await apiDb
    .prepare(`INSERT OR IGNORE INTO business_members (id, business_id, user_id, role) VALUES (?, ?, ?, ?)`)
    .bind(`bm_${crypto.randomUUID().slice(0, 10)}`, biz.id, resolvedUid, role)
    .run();

  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: `Added ${email} (${role}) to B2B workspace`, requestId: reqId, data: { businessId: biz.id, userId: resolvedUid, email, role } }), 201);
});

unifiedRouter.get('/b2b/bulk-jobs', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
  if (!apiDb) return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Bulk jobs ready', requestId: reqId, data: [] }));

  const biz = await apiDb
    .prepare(`SELECT b.id FROM businesses b LEFT JOIN business_members m ON m.business_id = b.id WHERE b.contact_email = ? OR m.user_id = ? LIMIT 1`)
    .bind(user.email, user.id)
    .first<{ id: string }>()
    .catch(() => null);

  if (!biz) return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'No B2B account', requestId: reqId, data: [] }));

  const jobs = await apiDb
    .prepare(`SELECT * FROM bulk_jobs WHERE business_id = ? ORDER BY created_at DESC LIMIT 50`)
    .bind(biz.id)
    .all()
    .catch(() => ({ results: [] }));

  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Bulk verification jobs loaded', requestId: reqId, data: jobs.results || [] }));
});

// ==========================================
// 9. CUSTOMER COMPLIANCE DOCUMENT VAULT & RENEWAL REMINDERS
// ==========================================
unifiedRouter.get('/vault', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');
  if (!workflowDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Vault ready', requestId: reqId, data: [] }));
  }
  const rows = await workflowDb
    .prepare(`SELECT * FROM customer_vault_items WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`)
    .bind(user.id)
    .all()
    .catch(() => ({ results: [] }));
  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Compliance vault items loaded', requestId: reqId, data: rows.results || [] }));
});

unifiedRouter.post('/vault', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const docType = String(body?.docType || 'Compliance Proof').trim().slice(0, 80);
  const docTitle = String(body?.docTitle || '').trim().slice(0, 140);
  if (!docTitle) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'docTitle is required', requestId: reqId, data: null, errorCode: 'MISSING_DOC_TITLE' }), 400);
  }
  const id = `vlt_${crypto.randomUUID().slice(0, 12)}`;
  const nowIso = new Date().toISOString();
  const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');
  if (workflowDb) {
    await workflowDb
      .prepare(
        `INSERT INTO customer_vault_items (id, user_id, doc_type, doc_title, doc_number_masked, file_id, r2_object_key, file_name, mime_type, file_size, expires_on, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        user.id,
        docType,
        docTitle,
        body?.docNumberMasked ? String(body.docNumberMasked).slice(0, 60) : null,
        body?.fileId || null,
        body?.r2ObjectKey || null,
        body?.fileName || null,
        body?.mimeType || null,
        Number(body?.fileSize || 0),
        body?.expiresOn || null,
        nowIso,
        nowIso
      )
      .run()
      .catch(() => null);
  }
  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Saved to Compliance Vault', requestId: reqId, data: { id, docType, docTitle, createdAt: nowIso } }), 201);
});

unifiedRouter.delete('/vault/:id', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const id = c.req.param('id').trim();
  const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');
  if (workflowDb) {
    await workflowDb.prepare(`DELETE FROM customer_vault_items WHERE id = ? AND user_id = ?`).bind(id, user.id).run().catch(() => null);
  }
  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Vault record removed', requestId: reqId, data: { id } }));
});

unifiedRouter.get('/reminders', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  if (!coreDb) return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Reminders active', requestId: reqId, data: [] }));
  const rows = await coreDb
    .prepare(`SELECT * FROM compliance_reminders WHERE user_id = ? ORDER BY due_date ASC LIMIT 100`)
    .bind(user.id)
    .all()
    .catch(() => ({ results: [] }));
  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Compliance reminders loaded', requestId: reqId, data: rows.results || [] }));
});

unifiedRouter.post('/reminders', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const title = String(body?.title || '').trim().slice(0, 140);
  const dueDate = String(body?.dueDate || '').trim().slice(0, 30);
  if (!title || !dueDate) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'title and dueDate are required', requestId: reqId, data: null, errorCode: 'MISSING_REMINDER_FIELDS' }), 400);
  }
  const id = `rem_${crypto.randomUUID().slice(0, 12)}`;
  const nowIso = new Date().toISOString();
  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  if (coreDb) {
    await coreDb
      .prepare(
        `INSERT INTO compliance_reminders (id, user_id, title, category, due_date, frequency, status, notes, related_service_slug, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'Upcoming', ?, ?, ?, ?)`
      )
      .bind(
        id,
        user.id,
        title,
        String(body?.category || 'Tax & GST').slice(0, 60),
        dueDate,
        String(body?.frequency || 'Monthly').slice(0, 40),
        body?.notes ? String(body.notes).slice(0, 400) : null,
        body?.relatedServiceSlug ? String(body.relatedServiceSlug).slice(0, 100) : null,
        nowIso,
        nowIso
      )
      .run()
      .catch(() => null);
  }
  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Compliance reminder scheduled', requestId: reqId, data: { id, title, dueDate, status: 'Upcoming' } }), 201);
});

unifiedRouter.patch('/reminders/:id', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const id = c.req.param('id').trim();
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const status = ['Upcoming', 'Completed', 'Snoozed'].includes(body?.status) ? body.status : 'Completed';
  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  if (coreDb) {
    await coreDb
      .prepare(`UPDATE compliance_reminders SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
      .bind(status, new Date().toISOString(), id, user.id)
      .run()
      .catch(() => null);
  }
  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: `Reminder marked ${status}`, requestId: reqId, data: { id, status } }));
});

unifiedRouter.delete('/reminders/:id', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const id = c.req.param('id').trim();
  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  if (coreDb) {
    await coreDb.prepare(`DELETE FROM compliance_reminders WHERE id = ? AND user_id = ?`).bind(id, user.id).run().catch(() => null);
  }
  return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Reminder deleted', requestId: reqId, data: { id } }));
});

export { findCatalogueItem, calculatePartnerCommission };

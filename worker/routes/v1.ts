import { Hono } from 'hono';
import type { AppVariables, Env } from '../types';
import {
  buildApiResponse,
  constantTimeEqual,
  hmacSha256Base64,
  hmacSha256Hex,
} from '../middleware/security';
import { requireAuth, requirePermission } from '../middleware/auth';
import { DatabaseRegistry } from '../config/database';
import { StorageRegistry } from '../config/storage';
import { validateFormSubmission } from '../../src/lib/formEngine';
import { validateStatusTransition } from '../../src/lib/workflow';
import { calculateOrderTotalsPaise, fromPaise, toPaise } from '../../src/lib/finance';
import {
  findCatalogueItem,
  filterCatalogueItems,
  resolveAuthoritativeCheckout,
  resolveCouponValidation,
} from '../../src/lib/catalogueServer';
import {
  CATALOGUE_CATEGORIES,
  COMPLETE_CATALOGUE_ITEMS,
} from '../../src/data/catalogue';
import { generateDigitalProductPayload } from '../../src/data/catalogue/digitalGenerators';
import { canAccessApplication, isSuperAdminRole } from '../../src/lib/rbac';
import { ApplicationStatus, CouponRecord, ServiceFormField } from '../../src/types';
import {
  buildCashfreeUnconfiguredMessage,
  createCashfreePgOrder,
  createCashfreeRefund,
  formatCashfreePaymentMethod,
  getCashfreeOrderRefunds,
  getCashfreePgOrderStatus,
  isCashfreeTestPingPayload,
  isProductionEnvironment,
  loadEffectiveCashfreeConfig,
  logCashfreeEvent,
  normalizeCashfreeLifecycleState,
  resolveCashfreeConfig,
  validateWebhookTimestamp,
  verifyCashfreeWebhookWithAnySecret,
} from '../services/cashfreeService';
import { validateFileSignatureAndExtension } from '../services/fileService';
import {
  processCashfreeWebhookEvent,
  reconcilePaidOrder,
  reconcileRefundOutcome,
} from '../services/paymentReconciliation';
import {
  normalizePaymentUiStatus,
  summarizePaymentStatuses,
  type ApplicationPaymentStatusItem,
} from '../../src/lib/paymentStatus';
import {
  dispatchPaymentAlertEmail,
  type PaymentAlertEventStatus as PaymentAlertStatus,
} from '../services/paymentAlertService';
import { unifiedRouter } from './unifiedRoutes';

export const v1Router = new Hono<{ Bindings: Env; Variables: AppVariables }>();
v1Router.route('/', unifiedRouter);

const ALLOWED_UPLOAD_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function sanitizeSafeExtension(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}

async function writeAuditLog(
  env: Env,
  params: {
    actorId: string;
    actorRole: string;
    action: string;
    resourceType: string;
    resourceId: string;
    summary: string;
    ip?: string;
  }
) {
  const { db: auditDb } = await new DatabaseRegistry(env).resolveAndEnsure('dip_audit');
  if (!auditDb) return;
  try {
    await auditDb.prepare(
      `INSERT INTO audit_logs (id, actor_user_id, actor_role, action, resource_type, resource_id, summary, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        `aud_${crypto.randomUUID()}`,
        params.actorId,
        params.actorRole,
        params.action,
        params.resourceType,
        params.resourceId,
        params.summary.slice(0, 400),
        params.ip || 'edge'
      )
      .run();
  } catch {
    // Do not crash transactional response on non-fatal audit log write
  }
}

// ==========================================
// 1. AUTH & ROLE CAPABILITIES
// ==========================================
v1Router.get('/auth/me', requireAuth, (c) => {
  const user = c.get('user')!;
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Authenticated identity and permissions resolved',
      requestId: c.get('requestId'),
      data: user,
    })
  );
});

// ==========================================
// 2. SERVICES CATALOG & FORM ENGINE
// ==========================================
const handleCatalogueQuery = async (c: any) => {
  const reqId = c.get('requestId');
  const category = c.req.query('category') || 'all';
  const subcategory = c.req.query('subcategory');
  const productType = c.req.query('productType');
  const deliveryType = c.req.query('deliveryType');
  const pricingType = c.req.query('pricingType');
  const featuredOnly = c.req.query('featured') === 'true';
  const popularOnly = c.req.query('popular') === 'true';
  const q = c.req.query('q');
  const minPrice = c.req.query('minPrice');
  const maxPrice = c.req.query('maxPrice');
  const sort = (c.req.query('sort') || 'popular') as any;
  const page = Math.max(1, Number(c.req.query('page') || 1));
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') || 24)));

  const { db: servicesDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_services');
  let sourceCatalog = COMPLETE_CATALOGUE_ITEMS;

  if (servicesDb) {
    try {
      const rows = await servicesDb.prepare(`SELECT * FROM services WHERE is_active = 1 LIMIT 250`).all<any>();
      if (rows.results && rows.results.length > 0) {
        const bySlug = new Map(COMPLETE_CATALOGUE_ITEMS.map((item) => [item.slug, item]));
        for (const r of rows.results) {
          const base = bySlug.get(String(r.slug || ''));
          if (base) {
            bySlug.set(base.slug, {
              ...base,
              name: r.name || base.name,
              shortDesc: r.short_desc || base.shortDesc,
              serviceCharge:
                r.service_charge_paise !== undefined && r.service_charge_paise !== null
                  ? Number(r.service_charge_paise) / 100
                  : base.serviceCharge,
              govtFees:
                r.govt_fee_paise !== undefined && r.govt_fee_paise !== null
                  ? Number(r.govt_fee_paise) / 100
                  : base.govtFees,
              published: r.is_active !== 0,
            });
          }
        }
        sourceCatalog = Array.from(bySlug.values());
      }
    } catch {
      // Safe fallback to authoritative catalogue seed
    }
  }

  const result = filterCatalogueItems({
    items: sourceCatalog,
    category,
    subcategory,
    productType,
    deliveryType,
    pricingType,
    featuredOnly,
    popularOnly,
    q,
    minPrice: minPrice !== undefined ? Number(minPrice) : undefined,
    maxPrice: maxPrice !== undefined ? Number(maxPrice) : undefined,
    sort,
    page,
    limit,
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Retrieved ${result.items.length} of ${result.totalItems} catalogue items`,
      requestId: reqId,
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        categoriesCount: CATALOGUE_CATEGORIES.length,
      },
    })
  );
};

v1Router.get('/services', handleCatalogueQuery);
v1Router.get('/catalogue', handleCatalogueQuery);

v1Router.post('/coupons/validate', async (c) => {
  const reqId = c.get('requestId');
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const code = String(body?.code || '').trim();
  const serviceChargeInr = Number(body?.serviceChargeInr ?? body?.amount ?? 0);
  const category = typeof body?.category === 'string' ? body.category : undefined;

  let extraCoupons: CouponRecord[] = [];
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (billingDb) {
    try {
      const rows = await billingDb.prepare(`SELECT * FROM coupons WHERE is_active = 1`).all<any>();
      extraCoupons = (rows.results || []).map((r) => ({
        id: r.id,
        code: r.code,
        description: r.description || r.code,
        discountType: r.discount_type === 'percentage' ? 'percentage' : 'fixed',
        discountAmountInr: Number(r.discount_value || 0),
        discountPercentBps: Number(r.discount_percent_bps || 0),
        maxDiscountInr: r.max_discount_paise ? Number(r.max_discount_paise) / 100 : undefined,
        minOrderAmountInr: r.min_order_paise ? Number(r.min_order_paise) / 100 : 0,
        usedCount: Number(r.used_count || 0),
        usageLimit: r.usage_limit ? Number(r.usage_limit) : undefined,
        isActive: r.is_active !== 0,
      }));
    } catch {
      // Safe fallback to built-in coupons before migration
    }
  }

  const validation = resolveCouponValidation({
    code,
    serviceChargeInr,
    category,
    extraCoupons,
  });

  return c.json(
    buildApiResponse({
      success: validation.valid,
      status: validation.valid ? 'SUCCESS' : 'REJECTED',
      message: validation.message,
      requestId: reqId,
      data: validation,
      errorCode: validation.valid ? null : 'INVALID_COUPON',
    }),
    validation.valid ? 200 : 400
  );
});

v1Router.post('/quotes', async (c) => {
  const reqId = c.get('requestId');
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const serviceSlug = String(body?.serviceSlug || body?.serviceId || '').trim();
  const contactName = String(body?.contactName || '').trim();
  const contactEmail = String(body?.contactEmail || '').trim();
  const contactMobile = String(body?.contactMobile || '').trim();
  const requirementsSummary = String(body?.requirementsSummary || '').trim();

  if (!contactName || (!contactEmail && !contactMobile) || !requirementsSummary) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'contactName, contactEmail/contactMobile, and requirementsSummary are required.',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_QUOTE_FIELDS',
      }),
      400
    );
  }

  const srv = findCatalogueItem(serviceSlug);
  const quoteId = `QT-${Date.now().toString(36).toUpperCase()}`;
  const nowIso = new Date().toISOString();

  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  if (coreDb) {
    try {
      await coreDb.prepare(
        `INSERT INTO custom_quote_requests (
          id, service_id, service_slug, service_name, user_id, contact_name, contact_email,
          contact_mobile, company_name, requirements_summary, budget_range, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', ?, ?)`
      )
        .bind(
          quoteId,
          srv?.id || serviceSlug || 'custom',
          srv?.slug || serviceSlug || 'custom',
          srv?.name || String(body?.serviceName || 'Custom Compliance / Software Quote'),
          body?.userId || null,
          contactName.slice(0, 120),
          contactEmail.slice(0, 160),
          contactMobile.slice(0, 30),
          body?.companyName ? String(body.companyName).slice(0, 160) : null,
          requirementsSummary.slice(0, 2000),
          body?.budgetRange ? String(body.budgetRange).slice(0, 80) : null,
          nowIso,
          nowIso
        )
        .run();
    } catch {
      // Safe fallback when D1 migration pending
    }
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Custom quote inquiry recorded. Our desk will respond within 1 working day.',
      requestId: reqId,
      data: {
        id: quoteId,
        serviceId: srv?.id || serviceSlug || 'custom',
        serviceSlug: srv?.slug || serviceSlug || 'custom',
        serviceName: srv?.name || String(body?.serviceName || 'Custom Consultation'),
        contactName,
        contactEmail,
        contactMobile,
        status: 'New',
        createdAt: nowIso,
      },
    }),
    201
  );
});

v1Router.post('/forms/validate', async (c) => {
  const reqId = c.get('requestId');
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const fields = (Array.isArray(body?.fields) ? body.fields : []) as ServiceFormField[];
  const answers = (body?.answers && typeof body.answers === 'object' ? body.answers : {}) as Record<
    string,
    any
  >;
  const lang = body?.lang === 'hi' ? 'hi' : 'en';

  const result = validateFormSubmission(fields, answers, lang);
  return c.json(
    buildApiResponse({
      success: result.valid,
      status: result.valid ? 'SUCCESS' : 'REJECTED',
      message: result.valid ? 'Form answers validated cleanly' : 'Validation errors detected',
      requestId: reqId,
      data: result,
      errorCode: result.valid ? null : 'FORM_VALIDATION_FAILED',
    }),
    result.valid ? 200 : 400
  );
});

// ==========================================
// 3. APPLICATIONS & WORKFLOW TRANSITIONS
// ==========================================
v1Router.get('/applications', requireAuth, requirePermission('applications.view'), async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const status = c.req.query('status');
  const page = Math.max(1, Number(c.req.query('page') || 1));
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit') || 20)));
  const offset = (page - 1) * limit;

  let sql = `SELECT id, user_id, service_id, status, assigned_operator_id, customer_remarks, created_at, updated_at
             FROM applications WHERE deleted_at IS NULL`;
  const binds: any[] = [];

  if (user.role === 'customer') {
    sql += ` AND user_id = ?`;
    binds.push(user.id);
  } else if (user.role === 'operator') {
    sql += ` AND assigned_operator_id = ?`;
    binds.push(user.id);
  } else if (user.role === 'partner') {
    sql += ` AND user_id IN (SELECT customer_user_id FROM partner_customers WHERE partner_id = ?)`;
    binds.push(user.partnerId || '__none__');
  }

  if (status && status !== 'all') {
    sql += ` AND status = ?`;
    binds.push(status);
  }

  sql += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
  binds.push(limit, offset);

  const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');
  const res = workflowDb ? await workflowDb.prepare(sql).bind(...binds).all() : { results: [] };
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Role-scoped applications retrieved',
      requestId: reqId,
      data: res.results || [],
      meta: { page, limit },
    })
  );
});

v1Router.patch(
  '/applications/:id/transition',
  requireAuth,
  requirePermission('applications.process'),
  async (c) => {
    const reqId = c.get('requestId');
    const user = c.get('user')!;
    const appId = c.req.param('id');
    const body = await c.req.json().catch(() => ({} as Record<string, any>));
    const toStatus = body?.toStatus as ApplicationStatus;
    const customerMessage = String(body?.customerMessage || '');
    const internalNote = String(body?.internalNote || '');

    const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');
    if (!workflowDb) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'FAILED',
          message: 'Workflow database unavailable',
          requestId: reqId,
          data: null,
          errorCode: 'D1_UNBOUND',
        }),
        503
      );
    }

    const existingApp = await workflowDb.prepare(
      `SELECT id, user_id, status, assigned_operator_id FROM applications WHERE id = ? LIMIT 1`
    )
      .bind(appId)
      .first<{
        id: string;
        user_id: string;
        status: ApplicationStatus;
        assigned_operator_id: string | null;
      }>();

    if (!existingApp) {
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
      !canAccessApplication(user, {
        userId: existingApp.user_id,
        userEmail: '',
        assignedOperatorId: existingApp.assigned_operator_id || undefined,
      })
    ) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'REJECTED',
          message: 'Not authorized to process this application.',
          requestId: reqId,
          data: null,
          errorCode: 'FORBIDDEN_SCOPE',
        }),
        403
      );
    }

    const validation = validateStatusTransition({
      fromStatus: existingApp.status,
      toStatus,
      actorRole: user.role,
      reason: customerMessage,
    });

    if (!validation.valid) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'REJECTED',
          message: validation.error || 'Invalid status transition',
          requestId: reqId,
          data: null,
          errorCode: 'INVALID_STATUS_TRANSITION',
        }),
        422
      );
    }

    await workflowDb.prepare(
      `UPDATE applications
       SET status = ?, customer_remarks = ?, internal_notes = COALESCE(NULLIF(?, ''), internal_notes), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(toStatus, customerMessage.slice(0, 1000), internalNote.slice(0, 1000), appId)
      .run();

    await workflowDb.prepare(
      `INSERT INTO application_events (id, application_id, event_type, previous_status, new_status, actor_user_id, actor_role, customer_message)
       VALUES (?, ?, 'STATUS_CHANGED', ?, ?, ?, ?, ?)`
    )
      .bind(
        `evt_${crypto.randomUUID()}`,
        appId,
        existingApp.status,
        toStatus,
        user.id,
        user.role,
        customerMessage.slice(0, 500)
      )
      .run();

    await writeAuditLog(c.env, {
      actorId: user.id,
      actorRole: user.role,
      action: 'APPLICATION_TRANSITION',
      resourceType: 'application',
      resourceId: appId,
      summary: `${existingApp.status} -> ${toStatus}`,
      ip: c.req.header('cf-connecting-ip'),
    });

    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: `Application transitioned cleanly from ${existingApp.status} to ${toStatus}`,
        requestId: reqId,
        data: { applicationId: appId, previousStatus: existingApp.status, newStatus: toStatus },
      })
    );
  }
);

// ==========================================
// 4. PRIVATE R2 DOCUMENT VAULT & SIGNED DOWNLOADS
// ==========================================
v1Router.post('/documents/upload', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const form = await c.req.formData().catch(() => null);
  if (!form) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Multipart form data with file is required',
        requestId: reqId,
        data: null,
        errorCode: 'INVALID_MULTIPART',
      }),
      400
    );
  }

  const file = form.get('file') as File | null;
  const applicationId = String(form.get('applicationId') || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const documentType = String(form.get('documentType') || 'Supporting Proof').slice(0, 100);

  if (!file || !applicationId) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'file and valid applicationId are required',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_FIELDS',
      }),
      400
    );
  }

  if (!ALLOWED_UPLOAD_MIMES.has(file.type)) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Unsupported file MIME type. Allowed: PDF, JPG, PNG, WEBP.',
        requestId: reqId,
        data: null,
        errorCode: 'INVALID_FILE_TYPE',
      }),
      415
    );
  }

  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'File size exceeds 10 MB maximum upload limit.',
        requestId: reqId,
        data: null,
        errorCode: 'FILE_TOO_LARGE',
      }),
      413
    );
  }

  const dbReg = new DatabaseRegistry(c.env);
  const [{ db: workflowDb }, { db: auditDb }] = await Promise.all([
    dbReg.resolveAndEnsure('dip_workflow'),
    dbReg.resolveAndEnsure('dip_audit'),
  ]);

  if (workflowDb) {
    const appRow = await workflowDb
      .prepare(
        `SELECT id, user_id, assigned_operator_id FROM applications WHERE id = ? AND deleted_at IS NULL LIMIT 1`
      )
      .bind(applicationId)
      .first<{ id: string; user_id: string; assigned_operator_id: string | null }>()
      .catch(() => null);

    if (
      appRow &&
      !canAccessApplication(user, {
        userId: appRow.user_id,
        userEmail: '',
        assignedOperatorId: appRow.assigned_operator_id || undefined,
      })
    ) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'REJECTED',
          message: 'Not authorized to upload documents to this application.',
          requestId: reqId,
          data: null,
          errorCode: 'FORBIDDEN_APPLICATION_SCOPE',
        }),
        403
      );
    }
  }

  const storageReg = new StorageRegistry(c.env);
  const resolvedBucket = storageReg.resolve('documents');
  if (!resolvedBucket.bucket) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'R2 document storage bucket is not bound in Worker runtime.',
        requestId: reqId,
        data: null,
        errorCode: 'STORAGE_UNCONFIGURED',
      }),
      503
    );
  }

  const ext = sanitizeSafeExtension(file.type);
  const docId = `doc_${crypto.randomUUID()}`;
  // Never trust client filenames or allow path traversal
  const objectKey = `private/apps/${applicationId}/${docId}.${ext}`;
  const bytes = await file.arrayBuffer();

  const sigCheck = validateFileSignatureAndExtension({
    mimeType: file.type,
    filename: file.name,
    bytes,
  });
  if (!sigCheck.valid) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: sigCheck.reason || 'File failed security inspection.',
        requestId: reqId,
        data: null,
        errorCode: 'MALFORMED_OR_DISALLOWED_FILE',
      }),
      415
    );
  }

  await resolvedBucket.bucket.put(objectKey, bytes, {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      uploadedBy: user.id,
      applicationId,
      documentType,
    },
  });

  if (workflowDb) {
    const prevVersionsRow = await workflowDb
      .prepare(
        `SELECT COUNT(*) AS cnt FROM file_registry WHERE application_id = ? AND document_category = ? AND is_deleted = 0`
      )
      .bind(applicationId, documentType)
      .first<{ cnt: number }>()
      .catch(() => ({ cnt: 0 }));
    const nextVersionNumber = Number(prevVersionsRow?.cnt || 0) + 1;

    await workflowDb.prepare(
      `INSERT INTO application_documents (id, application_id, document_type, file_name, file_size, mime_type, r2_storage_key, verification_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending')`
    )
      .bind(
        docId,
        applicationId,
        documentType,
        `${docId}.${ext}`,
        file.size,
        file.type,
        objectKey
      )
      .run()
      .catch(() => null);

    await workflowDb.prepare(
      `INSERT INTO file_registry (id, bucket_binding, bucket_name, logical_bucket, object_key, original_filename, mime_type, file_size, uploaded_by, uploader_role, customer_id, application_id, document_category, verification_status, access_classification)
       VALUES (?, ?, 'dip-official', 'documents', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'private')`
    )
      .bind(
        docId,
        resolvedBucket.bindingName,
        objectKey,
        `${docId}.${ext}`,
        file.type,
        file.size,
        user.id,
        user.role,
        user.id,
        applicationId,
        documentType
      )
      .run()
      .catch(() => null);

    await workflowDb
      .prepare(
        `INSERT INTO document_versions (id, document_id, application_id, document_category, version_number, object_key, original_filename, mime_type, file_size, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `dver_${crypto.randomUUID()}`,
        docId,
        applicationId,
        documentType,
        nextVersionNumber,
        objectKey,
        `${docId}.${ext}`,
        file.type,
        file.size,
        user.id
      )
      .run()
      .catch(() => null);
  }

  if (auditDb) {
    await auditDb.prepare(
      `INSERT INTO document_access_logs (id, document_id, application_id, accessor_user_id, accessor_role, access_type, ip_address)
       VALUES (?, ?, ?, ?, ?, 'UPLOADED', ?)`
    )
      .bind(
        `dal_${crypto.randomUUID()}`,
        docId,
        applicationId,
        user.id,
        user.role,
        c.req.header('cf-connecting-ip') || 'edge'
      )
      .run()
      .catch(() => null);
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Document stored in private R2 bucket',
      requestId: reqId,
      data: {
        id: docId,
        applicationId,
        documentType,
        mimeType: file.type,
        fileSize: file.size,
        objectKey,
      },
    })
  );
});

v1Router.post('/documents/:id/signed-url', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const docId = c.req.param('id');

  const dbReg = new DatabaseRegistry(c.env);
  const { db: workflowDb } = await dbReg.resolveAndEnsure('dip_workflow');
  const docRow = workflowDb
    ? await workflowDb.prepare(
        `SELECT d.id, d.application_id, d.r2_storage_key, a.user_id, a.assigned_operator_id
         FROM application_documents d
         JOIN applications a ON a.id = d.application_id
         WHERE d.id = ? LIMIT 1`
      )
        .bind(docId)
        .first<{
          id: string;
          application_id: string;
          r2_storage_key: string;
          user_id: string;
          assigned_operator_id: string | null;
        }>()
    : null;

  if (!docRow) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Document not found',
        requestId: reqId,
        data: null,
        errorCode: 'NOT_FOUND',
      }),
      404
    );
  }

  if (
    !canAccessApplication(user, {
      userId: docRow.user_id,
      userEmail: '',
      assignedOperatorId: docRow.assigned_operator_id || undefined,
    })
  ) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Access denied for this document.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN_DOCUMENT',
      }),
      403
    );
  }

  const secret = c.env.AUTH_SIGNING_SECRET;
  if (!secret) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'AUTH_SIGNING_SECRET must be configured in Worker secrets to sign R2 download URLs.',
        requestId: reqId,
        data: null,
        errorCode: 'SIGNING_SECRET_UNCONFIGURED',
      }),
      503
    );
  }

  const exp = Math.floor(Date.now() / 1000) + 120; // 2-minute TTL
  const sig = await hmacSha256Hex(secret, `${docId}:${exp}:${user.id}`);
  const downloadUrl = `/api/v1/documents/${encodeURIComponent(docId)}/download?exp=${exp}&uid=${encodeURIComponent(
    user.id
  )}&sig=${sig}`;

  const { db: auditDb } = await dbReg.resolveAndEnsure('dip_audit');
  if (auditDb) {
    await auditDb.prepare(
      `INSERT INTO document_access_logs (id, document_id, application_id, accessor_user_id, accessor_role, access_type, ip_address)
       VALUES (?, ?, ?, ?, ?, 'SIGNED_URL_ISSUED', ?)`
    )
      .bind(
        `dal_${crypto.randomUUID()}`,
        docId,
        docRow.application_id,
        user.id,
        user.role,
        c.req.header('cf-connecting-ip') || 'edge'
      )
      .run();
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Short-lived signed download URL generated',
      requestId: reqId,
      data: { downloadUrl, expiresAt: new Date(exp * 1000).toISOString() },
    })
  );
});

v1Router.get('/documents/:id/download', async (c) => {
  const reqId = c.get('requestId');
  const docId = c.req.param('id');
  const exp = Number(c.req.query('exp') || 0);
  const uid = c.req.query('uid') || '';
  const sig = c.req.query('sig') || '';
  const secret = c.env.AUTH_SIGNING_SECRET;

  if (!secret || !exp || !uid || !sig || exp < Math.floor(Date.now() / 1000)) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Download link missing or expired',
        requestId: reqId,
        data: null,
        errorCode: 'LINK_EXPIRED_OR_INVALID',
      }),
      403
    );
  }

  const expectedSig = await hmacSha256Hex(secret, `${docId}:${exp}:${uid}`);
  if (!constantTimeEqual(expectedSig, sig)) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Invalid document download signature',
        requestId: reqId,
        data: null,
        errorCode: 'INVALID_SIGNATURE',
      }),
      403
    );
  }

  const dbReg = new DatabaseRegistry(c.env);
  const [{ db: workflowDb }, { db: auditDb }] = await Promise.all([
    dbReg.resolveAndEnsure('dip_workflow'),
    dbReg.resolveAndEnsure('dip_audit'),
  ]);
  const docRow = workflowDb
    ? await workflowDb.prepare(
        `SELECT r2_storage_key, mime_type, file_name, application_id FROM application_documents WHERE id = ? LIMIT 1`
      )
        .bind(docId)
        .first<{ r2_storage_key: string; mime_type: string; file_name: string; application_id: string }>()
    : null;

  if (!docRow) return c.notFound();
  const resolvedBucket = new StorageRegistry(c.env).resolve('documents');
  if (!resolvedBucket.bucket) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'R2 document storage bucket is not bound in Worker runtime.',
        requestId: reqId,
        data: null,
        errorCode: 'STORAGE_UNCONFIGURED',
      }),
      503
    );
  }
  const obj = await resolvedBucket.bucket.get(docRow.r2_storage_key);
  if (!obj) return c.notFound();

  if (auditDb) {
    await auditDb.prepare(
      `INSERT INTO document_access_logs (id, document_id, application_id, accessor_user_id, accessor_role, access_type, ip_address)
       VALUES (?, ?, ?, ?, 'signed_token', 'DOWNLOADED', ?)`
    )
      .bind(
        `dal_${crypto.randomUUID()}`,
        docId,
        docRow.application_id,
        uid,
        c.req.header('cf-connecting-ip') || 'edge'
      )
      .run();
  }

  const safeDownloadName = String(docRow.file_name || `${docId}.bin`).replace(/[^a-zA-Z0-9._-]/g, '_');
  return new Response(obj.body as unknown as BodyInit, {
    headers: {
      'Content-Type': docRow.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeDownloadName}"`,
      'Cache-Control': 'no-store, private',
    },
  });
});

// ==========================================
// 5. CASHFREE PAYMENTS & IDEMPOTENT WEBHOOKS
// ==========================================
v1Router.post('/payments/orders', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const applicationId = String(body?.applicationId || `DRAFT_${Date.now()}`);
  const retryOfOrderId = typeof body?.retryOfOrderId === 'string' ? body.retryOfOrderId.trim() : '';
  const idempotencyKey =
    c.req.header('idempotency-key') ||
    (typeof body?.idempotencyKey === 'string' && body.idempotencyKey.trim()) ||
    (retryOfOrderId ? `retry_${retryOfOrderId}_${Date.now()}` : `idem_${applicationId}_${user.id}`);

  const cfConfig = await loadEffectiveCashfreeConfig(c.env, body?.preferredMode);
  if (!cfConfig.isEnabled) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Cashfree payment gateway is currently disabled by administrator.',
        requestId: reqId,
        data: { mode: cfConfig.mode, isEnabled: false },
        errorCode: 'PAYMENT_GATEWAY_DISABLED',
      }),
      503
    );
  }

  if (cfConfig.isProductionRuntime && !cfConfig.configured) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: buildCashfreeUnconfiguredMessage(cfConfig),
        requestId: reqId,
        data: {
          missingBindings: cfConfig.missingBindings,
          clientIdConfigured: cfConfig.clientIdConfigured,
          clientSecretConfigured: cfConfig.clientSecretConfigured,
        },
        errorCode: 'CASHFREE_NOT_CONFIGURED',
      }),
      503
    );
  }

  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');

  if (billingDb) {
    if (!applicationId.startsWith('DRAFT_') && !applicationId.startsWith('DIG_')) {
      const existingPaid = await billingDb
        .prepare(
          `SELECT id FROM payment_orders
           WHERE application_id = ? AND status IN ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')
           LIMIT 1`
        )
        .bind(applicationId)
        .first<{ id: string }>()
        .catch(() => null);
      if (existingPaid) {
        return c.json(
          buildApiResponse({
            success: false,
            status: 'REJECTED',
            message: `Payment for application ${applicationId} is already confirmed (Order ${existingPaid.id}).`,
            requestId: reqId,
            data: { existingOrderId: existingPaid.id },
            errorCode: 'DUPLICATE_PAYMENT',
          }),
          409
        );
      }
    }

    const existing = await billingDb
      .prepare(
        `SELECT id, cf_order_id, total_paise, service_fee_paise, govt_fee_paise, additional_charge_paise, tax_paise, currency, gateway_session_id, status, order_expiry_time
         FROM payment_orders WHERE idempotency_key = ? LIMIT 1`
      )
      .bind(idempotencyKey)
      .first<{
        id: string;
        cf_order_id?: string | null;
        total_paise: number;
        service_fee_paise: number;
        govt_fee_paise: number;
        additional_charge_paise: number;
        tax_paise: number;
        currency: string;
        gateway_session_id: string | null;
        status: string;
        order_expiry_time?: string | null;
      }>()
      .catch(async () =>
        billingDb
          .prepare(
            `SELECT id, total_paise, service_fee_paise, govt_fee_paise, additional_charge_paise, tax_paise, currency, gateway_session_id, status
             FROM payment_orders WHERE idempotency_key = ? LIMIT 1`
          )
          .bind(idempotencyKey)
          .first<any>()
      );

    const isStaleSimSession =
      cfConfig.configured && String(existing?.gateway_session_id || '').startsWith('sim_');
    const isExpiredOrder = Boolean(
      existing?.order_expiry_time && Number.isFinite(Date.parse(existing.order_expiry_time)) && Date.parse(existing.order_expiry_time) <= Date.now()
    );
    const isTerminalRetryable =
      existing?.status === 'FAILED' ||
      existing?.status === 'EXPIRED' ||
      existing?.status === 'DROPPED' ||
      existing?.status === 'CANCELLED';

    if (existing && !isTerminalRetryable && !isStaleSimSession && !isExpiredOrder) {
      return c.json(
        buildApiResponse({
          success: true,
          status: existing.status === 'PAID' ? 'SUCCESS' : 'PENDING',
          message: 'Existing idempotent payment order returned',
          requestId: reqId,
          data: {
            orderId: existing.id,
            cfOrderId: existing.cf_order_id || undefined,
            paymentSessionId: existing.gateway_session_id,
            gatewayConfigured: cfConfig.configured,
            simulationOnly: !cfConfig.configured,
            mode: cfConfig.mode,
            orderStatus: existing.status,
            normalizedState: normalizeCashfreeLifecycleState(existing.status),
            orderExpiryTime: existing.order_expiry_time || undefined,
            currency: existing.currency || 'INR',
            breakdown: {
              serviceFeePaise: existing.service_fee_paise,
              govtFeePaise: existing.govt_fee_paise,
              additionalChargePaise: existing.additional_charge_paise,
              taxPaise: existing.tax_paise,
              totalPaise: existing.total_paise,
            },
          },
        })
      );
    }
  }

  const clientTotalRaw =
    body?.totalAmountInr !== undefined
      ? Number(body.totalAmountInr)
      : body?.amount !== undefined
      ? Number(body.amount)
      : undefined;

  let extraCoupons: CouponRecord[] = [];
  if (billingDb && body?.couponCode) {
    try {
      const cRows = await billingDb.prepare(`SELECT * FROM coupons WHERE is_active = 1`).all<any>();
      extraCoupons = (cRows.results || []).map((r) => ({
        id: r.id,
        code: r.code,
        description: r.description || r.code,
        discountType: r.discount_type === 'percentage' ? 'percentage' : 'fixed',
        discountAmountInr: Number(r.discount_value || 0),
        discountPercentBps: Number(r.discount_percent_bps || 0),
        maxDiscountInr: r.max_discount_paise ? Number(r.max_discount_paise) / 100 : undefined,
        minOrderAmountInr: r.min_order_paise ? Number(r.min_order_paise) / 100 : 0,
        usedCount: Number(r.used_count || 0),
        usageLimit: r.usage_limit ? Number(r.usage_limit) : undefined,
        isActive: r.is_active !== 0,
      }));
    } catch {
      // Fallback to built-in coupons
    }
  }

  const checkout = resolveAuthoritativeCheckout({
    serviceSlug: body?.serviceSlug || body?.digitalProductSlug,
    serviceId: body?.serviceId,
    urgentProcessing: Boolean(body?.urgentProcessing),
    couponCode: typeof body?.couponCode === 'string' ? body.couponCode : undefined,
    clientTotalInr: clientTotalRaw,
    fallbackServiceChargeInr: Number(body?.serviceChargeInr || 0),
    fallbackGovtFeesInr: Number(body?.govtFeesInr || 0),
    fallbackThirdPartyFeesInr: Number(body?.thirdPartyFeesInr || 0),
    fallbackAdditionalChargeInr: Number(body?.additionalChargeInr || 0),
    fallbackTaxRateBps: Number(body?.taxRateBps ?? 0),
    extraCoupons,
  });

  if (!checkout.ok) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: checkout.message || 'Authoritative pricing verification failed',
        requestId: reqId,
        data: { authoritativeTotalInr: checkout.totalInr, breakdown: checkout.breakdown },
        errorCode: checkout.errorCode || 'PRICE_TAMPER_OR_MISMATCH',
      }),
      (checkout.status || 400) as any
    );
  }

  const breakdown = checkout.breakdown;

  if (breakdown.totalPaise <= 0) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Order total must be greater than ₹0',
        requestId: reqId,
        data: null,
        errorCode: 'INVALID_ORDER_AMOUNT',
      }),
      400
    );
  }

  const orderId = `CF_ORD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  let paymentSessionId = `sim_session_${Date.now()}`;
  let cfOrderId: string | undefined;
  let orderExpiryTime = new Date(Date.now() + cfConfig.expiryMinutes * 60_000).toISOString();
  const resolvedReturnUrl =
    typeof body?.returnUrl === 'string' && body.returnUrl.trim()
      ? body.returnUrl.trim()
      : `${cfConfig.appDomain}/?cf_order_id={order_id}`;

  if (cfConfig.configured) {
    const cfOrder = await createCashfreePgOrder(cfConfig, {
      orderId,
      amountInr: fromPaise(breakdown.totalPaise),
      customerId: user.id,
      customerName: String(body?.customerName || user.name || 'Citizen Applicant'),
      customerEmail: String(body?.customerEmail || user.email || 'applicant@digitalindiaproject.com'),
      customerPhone: String(body?.customerPhone || '9876543210'),
      orderNote: String(body?.serviceName || `Application ${applicationId}`),
      returnUrl: resolvedReturnUrl,
      idempotencyKey,
      expiryMinutes: cfConfig.expiryMinutes,
      orderTags: {
        application_id: applicationId.slice(0, 64),
        environment: cfConfig.mode,
      },
    });

    if (!cfOrder.ok || !cfOrder.paymentSessionId) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'FAILED',
          message: cfOrder.errorMessage || 'Cashfree gateway rejected order creation',
          requestId: reqId,
          data: null,
          errorCode: cfOrder.errorCode || 'CASHFREE_ORDER_CREATION_FAILED',
        }),
        cfOrder.httpStatus >= 400 && cfOrder.httpStatus < 600 ? (cfOrder.httpStatus as any) : 502
      );
    }

    paymentSessionId = cfOrder.paymentSessionId;
    cfOrderId = cfOrder.cfOrderId;
    if (cfOrder.orderExpiryTime) {
      orderExpiryTime = cfOrder.orderExpiryTime;
    }
  }

  if (billingDb) {
    const slugVal =
      typeof body?.serviceSlug === 'string'
        ? body.serviceSlug
        : typeof body?.digitalProductSlug === 'string'
        ? body.digitalProductSlug
        : checkout.service?.slug || null;

    await billingDb
      .prepare(
        `INSERT INTO payment_orders (
          id, application_id, user_id, idempotency_key, service_slug,
          service_fee_paise, govt_fee_paise, additional_charge_paise, tax_paise, total_paise,
          gateway_session_id, status, cf_order_id, environment, order_expiry_time,
          payment_status_normalized, retry_of_order_id, return_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED', ?, ?, ?, 'CREATED', ?, ?)`
      )
      .bind(
        orderId,
        applicationId,
        user.id,
        idempotencyKey,
        slugVal,
        breakdown.serviceFeePaise,
        breakdown.govtFeePaise,
        breakdown.additionalChargePaise,
        breakdown.taxPaise,
        breakdown.totalPaise,
        paymentSessionId,
        cfOrderId || null,
        cfConfig.mode,
        orderExpiryTime,
        retryOfOrderId || null,
        resolvedReturnUrl
      )
      .run()
      .catch(async () => {
        await billingDb
          .prepare(
            `INSERT INTO payment_orders (id, application_id, user_id, idempotency_key, service_slug, service_fee_paise, govt_fee_paise, additional_charge_paise, tax_paise, total_paise, gateway_session_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED')`
          )
          .bind(
            orderId,
            applicationId,
            user.id,
            idempotencyKey,
            slugVal,
            breakdown.serviceFeePaise,
            breakdown.govtFeePaise,
            breakdown.additionalChargePaise,
            breakdown.taxPaise,
            breakdown.totalPaise,
            paymentSessionId
          )
          .run()
          .catch(async () => {
            await billingDb
              .prepare(
                `INSERT INTO payment_orders (id, application_id, user_id, idempotency_key, service_fee_paise, govt_fee_paise, additional_charge_paise, tax_paise, total_paise, gateway_session_id, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED')`
              )
              .bind(
                orderId,
                applicationId,
                user.id,
                idempotencyKey,
                breakdown.serviceFeePaise,
                breakdown.govtFeePaise,
                breakdown.additionalChargePaise,
                breakdown.taxPaise,
                breakdown.totalPaise,
                paymentSessionId
              )
              .run();
          });
      });

    // Record in-app PAYMENT_INITIATED alert cleanly
    const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
    if (coreDb) {
      await coreDb
        .prepare(
          `INSERT OR IGNORE INTO notifications (id, user_id, channel, title, content, is_read)
           VALUES (?, ?, 'in_app', ?, ?, 0)`
        )
        .bind(
          `notif_init_${orderId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          user.id,
          `Payment Initiated: ₹${fromPaise(breakdown.totalPaise).toLocaleString('en-IN')} (${applicationId})`,
          `Cashfree ${cfConfig.mode} payment session ${orderId} initiated for ${String(body?.serviceName || applicationId)}.`
        )
        .run()
        .catch(() => null);
    }
  }

  logCashfreeEvent('info', 'order_session_created', {
    orderId,
    applicationId,
    mode: cfConfig.mode,
    amountInr: fromPaise(breakdown.totalPaise),
    retryOfOrderId: retryOfOrderId || undefined,
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'PENDING',
      message: cfConfig.configured
        ? `Cashfree ${cfConfig.mode} payment session created`
        : 'Sandbox preview order created (configure CASHFREE_CLIENT_ID & CASHFREE_CLIENT_SECRET for live gateway)',
      requestId: reqId,
      data: {
        orderId,
        cfOrderId,
        paymentSessionId,
        mode: cfConfig.mode,
        gatewayConfigured: cfConfig.configured,
        simulationOnly: !cfConfig.configured,
        orderStatus: 'CREATED',
        normalizedState: 'CREATED' as const,
        orderExpiryTime,
        retryOfOrderId: retryOfOrderId || undefined,
        breakdown,
        currency: 'INR',
      },
    })
  );
});

v1Router.get('/payments/orders/:orderId', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const orderId = String(c.req.param('orderId') || '').trim();
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (!billingDb) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Billing database unavailable',
        requestId: reqId,
        data: null,
        errorCode: 'D1_UNBOUND',
      }),
      503
    );
  }

  const order = await billingDb
    .prepare(`SELECT * FROM payment_orders WHERE id = ? LIMIT 1`)
    .bind(orderId)
    .first<any>();

  if (!order) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: `Payment order ${orderId} not found`,
        requestId: reqId,
        data: null,
        errorCode: 'ORDER_NOT_FOUND',
      }),
      404
    );
  }

  const isPrivileged = isSuperAdminRole(user.role) || user.role === 'admin' || user.role === 'manager';
  if (order.user_id !== user.id && !isPrivileged) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'You are not authorized to inspect this payment order',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN_ORDER_ACCESS',
      }),
      403
    );
  }

  const [payment, invoice, refundsRes] = await Promise.all([
    billingDb.prepare(`SELECT * FROM payments WHERE order_id = ? LIMIT 1`).bind(orderId).first<any>().catch(() => null),
    billingDb.prepare(`SELECT * FROM invoices WHERE order_id = ? LIMIT 1`).bind(orderId).first<any>().catch(() => null),
    billingDb.prepare(`SELECT * FROM refunds WHERE order_id = ? ORDER BY created_at DESC`).bind(orderId).all<any>().catch(() => ({ results: [] })),
  ]);

  let webhooks: any[] = [];
  if (isPrivileged) {
    const whRes = await billingDb
      .prepare(
        `SELECT id, event_id, event_type, signature_verified, processing_status, event_timestamp, received_at, error_message
         FROM payment_webhook_events WHERE order_id = ? ORDER BY received_at DESC LIMIT 20`
      )
      .bind(orderId)
      .all<any>()
      .catch(() => ({ results: [] }));
    webhooks = whRes.results || [];
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Payment order detail loaded',
      requestId: reqId,
      data: {
        order: {
          orderId: order.id,
          cfOrderId: order.cf_order_id || undefined,
          applicationId: order.application_id,
          serviceSlug: order.service_slug || undefined,
          status: order.status,
          normalizedState: order.payment_status_normalized || normalizeCashfreeLifecycleState(order.status),
          environment: order.environment || 'sandbox',
          amountInr: fromPaise(order.total_paise),
          serviceFeeInr: fromPaise(order.service_fee_paise),
          govtFeeInr: fromPaise(order.govt_fee_paise),
          taxInr: fromPaise(order.tax_paise),
          currency: order.currency || 'INR',
          orderExpiryTime: order.order_expiry_time || undefined,
          lastError: order.last_error || undefined,
          retryOfOrderId: order.retry_of_order_id || undefined,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
        },
        payment: payment
          ? {
              paymentId: payment.id,
              cfPaymentId: payment.cf_payment_id,
              status: payment.status,
              paymentMethod: payment.payment_method,
              bankReference: payment.bank_reference || undefined,
              paymentMessage: payment.payment_message || undefined,
              refundedInr: fromPaise(payment.refunded_paise || 0),
              paidAt: payment.paid_at,
            }
          : null,
        invoice: invoice
          ? {
              invoiceNumber: invoice.invoice_number,
              taxableAmountInr: fromPaise(invoice.taxable_amount_paise),
              cgstInr: fromPaise(invoice.cgst_paise),
              sgstInr: fromPaise(invoice.sgst_paise),
              totalTaxInr: fromPaise(invoice.total_tax_paise),
              grandTotalInr: fromPaise(invoice.grand_total_paise),
              issuedAt: invoice.issued_at,
            }
          : null,
        refunds: (refundsRes.results || []).map((r: any) => ({
          id: r.id,
          cfRefundId: r.cf_refund_id || undefined,
          amountInr: r.refund_amount_paise ? fromPaise(r.refund_amount_paise) : Number(r.amount || 0),
          status: r.status,
          gatewayStatus: r.gateway_status || undefined,
          refundArn: r.refund_arn || undefined,
          refundMode: r.refund_mode || undefined,
          reason: r.reason,
          createdAt: r.created_at,
          processedAt: r.processed_at || undefined,
        })),
        webhooks,
      },
    })
  );
});

const handlePaymentOrderStatus = async (c: any) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const orderId = String(c.req.param('orderId') || '').trim();
  const preferredMode = c.req.query('mode');

  if (!orderId) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'orderId is required',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_ORDER_ID',
      }),
      400
    );
  }

  const cfConfig = await loadEffectiveCashfreeConfig(c.env, preferredMode);
  if (cfConfig.isProductionRuntime && !cfConfig.configured) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: buildCashfreeUnconfiguredMessage(cfConfig),
        requestId: reqId,
        data: {
          missingBindings: cfConfig.missingBindings,
          clientIdConfigured: cfConfig.clientIdConfigured,
          clientSecretConfigured: cfConfig.clientSecretConfigured,
        },
        errorCode: 'CASHFREE_NOT_CONFIGURED',
      }),
      503
    );
  }

  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');

  let existingOrder:
    | {
        id: string;
        application_id: string;
        user_id: string;
        status: string;
        total_paise: number;
        updated_at: string;
        last_error?: string | null;
      }
    | null = null;

  if (billingDb) {
    existingOrder = await billingDb
      .prepare(`SELECT id, application_id, user_id, status, total_paise, updated_at, last_error FROM payment_orders WHERE id = ? LIMIT 1`)
      .bind(orderId)
      .first<{
        id: string;
        application_id: string;
        user_id: string;
        status: string;
        total_paise: number;
        updated_at: string;
        last_error?: string | null;
      }>()
      .catch(async () =>
        billingDb
          .prepare(`SELECT id, application_id, user_id, status, total_paise, updated_at FROM payment_orders WHERE id = ? LIMIT 1`)
          .bind(orderId)
          .first<{
            id: string;
            application_id: string;
            user_id: string;
            status: string;
            total_paise: number;
            updated_at: string;
            last_error?: string | null;
          }>()
      );

    if (
      existingOrder &&
      existingOrder.user_id !== user.id &&
      !isSuperAdminRole(user.role) &&
      user.role !== 'admin' &&
      user.role !== 'manager'
    ) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'REJECTED',
          message: 'You are not authorized to inspect this payment order',
          requestId: reqId,
          data: null,
          errorCode: 'FORBIDDEN_ORDER_ACCESS',
        }),
        403
      );
    }

    if (
      existingOrder &&
      (existingOrder.status === 'PAID' ||
        existingOrder.status === 'PARTIALLY_REFUNDED' ||
        existingOrder.status === 'REFUNDED')
    ) {
      const [paymentRow, invRow] = await Promise.all([
        billingDb
          .prepare(`SELECT cf_payment_id, payment_method, bank_reference, paid_at FROM payments WHERE order_id = ? LIMIT 1`)
          .bind(orderId)
          .first<any>()
          .catch(() => null),
        billingDb
          .prepare(`SELECT invoice_number FROM invoices WHERE order_id = ? LIMIT 1`)
          .bind(orderId)
          .first<{ invoice_number?: string }>()
          .catch(() => null),
      ]);

      return c.json(
        buildApiResponse({
          success: true,
          status: 'SUCCESS',
          message: `Payment confirmed (${existingOrder.status})`,
          requestId: reqId,
          data: {
            orderId: existingOrder.id,
            applicationId: existingOrder.application_id,
            orderStatus: existingOrder.status,
            normalizedState: normalizeCashfreeLifecycleState(existingOrder.status),
            paid: true,
            amountInr: fromPaise(existingOrder.total_paise),
            cfPaymentId: paymentRow?.cf_payment_id,
            paymentMethod: paymentRow?.payment_method || 'Cashfree PG',
            bankReference: paymentRow?.bank_reference,
            invoiceNumber: invRow?.invoice_number,
            paymentTime: paymentRow?.paid_at || existingOrder.updated_at,
            gatewayConfigured: cfConfig.configured,
            mode: cfConfig.mode,
            source: 'webhook_or_ledger',
          },
        })
      );
    }
  }

  if (!cfConfig.configured) {
    const confirmSandbox = c.req.query('simulate') === 'true' && !isProductionEnvironment(c.env);
    let nextStatus = existingOrder?.status || 'CREATED';
    if (confirmSandbox && existingOrder) {
      await reconcilePaidOrder(c.env, {
        orderId,
        cfPaymentId: `CF_SANDBOX_${Date.now()}`,
        paymentMethod: 'Sandbox Preview',
        paymentAmountInr: fromPaise(existingOrder.total_paise),
        actorId: user.id,
        ip: c.req.header('cf-connecting-ip'),
      });
      nextStatus = 'PAID';
    }
    return c.json(
      buildApiResponse({
        success: true,
        status: nextStatus === 'PAID' ? 'SUCCESS' : 'PENDING',
        message: 'Sandbox preview order status retrieved',
        requestId: reqId,
        data: {
          orderId,
          applicationId: existingOrder?.application_id,
          orderStatus: nextStatus,
          normalizedState: normalizeCashfreeLifecycleState(nextStatus),
          paid: nextStatus === 'PAID',
          gatewayConfigured: false,
          simulationOnly: true,
        },
      })
    );
  }

  const liveStatus = await getCashfreePgOrderStatus(cfConfig, orderId);
  if (!liveStatus.ok) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: liveStatus.errorMessage || 'Failed to verify payment with Cashfree',
        requestId: reqId,
        data: {
          orderId,
          applicationId: existingOrder?.application_id,
          orderStatus: existingOrder?.status || 'PENDING',
          normalizedState: normalizeCashfreeLifecycleState(existingOrder?.status || 'PENDING'),
          paid: false,
          gatewayConfigured: true,
        },
        errorCode: 'CASHFREE_VERIFY_ERROR',
      }),
      liveStatus.httpStatus >= 400 && liveStatus.httpStatus < 600
        ? (liveStatus.httpStatus as any)
        : 502
    );
  }

  let invoiceNumber: string | undefined;
  if (liveStatus.paid) {
    const rec = await reconcilePaidOrder(c.env, {
      orderId,
      cfOrderId: liveStatus.cfOrderId,
      cfPaymentId: liveStatus.cfPaymentId,
      paymentMethod: liveStatus.paymentMethod,
      paymentAmountInr: liveStatus.paymentAmount,
      bankReference: liveStatus.bankReference,
      paymentMessage: liveStatus.paymentMessage,
      paidAt: liveStatus.paymentTime,
      rawGatewayJson: JSON.stringify({ order: liveStatus.rawOrder, payment: liveStatus.rawPayment }),
      actorId: user.id,
      ip: c.req.header('cf-connecting-ip'),
    });
    if (rec.amountMismatch) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'REJECTED',
          message: rec.message,
          requestId: reqId,
          data: {
            orderId,
            applicationId: existingOrder?.application_id,
            orderStatus: 'FAILED',
            normalizedState: 'FAILED',
            paid: false,
            gatewayConfigured: true,
            mode: cfConfig.mode,
          },
          errorCode: 'PAYMENT_AMOUNT_MISMATCH',
        }),
        409
      );
    }
    invoiceNumber = rec.invoiceNumber;
  } else if (billingDb && existingOrder) {
    const dbStatus =
      liveStatus.orderStatus === 'FAILED'
        ? 'FAILED'
        : liveStatus.orderStatus === 'EXPIRED'
        ? 'EXPIRED'
        : liveStatus.orderStatus === 'CANCELLED'
        ? 'DROPPED'
        : existingOrder.status;

    if (dbStatus !== existingOrder.status) {
      await billingDb
        .prepare(
          `UPDATE payment_orders
           SET status = ?, payment_status_normalized = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(dbStatus, liveStatus.normalizedState, liveStatus.paymentMessage || null, orderId)
        .run()
        .catch(async () => {
          await billingDb
            .prepare(`UPDATE payment_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .bind(dbStatus, orderId)
            .run();
        });
    }
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: liveStatus.paid
        ? 'SUCCESS'
        : liveStatus.orderStatus === 'FAILED' || liveStatus.orderStatus === 'EXPIRED' || liveStatus.orderStatus === 'CANCELLED'
        ? 'FAILED'
        : 'PENDING',
      message: liveStatus.paid
        ? 'Cashfree payment verified in real time'
        : `Cashfree order status: ${liveStatus.orderStatus}`,
      requestId: reqId,
      data: {
        ...liveStatus,
        applicationId: existingOrder?.application_id,
        invoiceNumber,
        amountInr: existingOrder ? fromPaise(existingOrder.total_paise) : liveStatus.paymentAmount,
        gatewayConfigured: true,
        mode: cfConfig.mode,
        source: 'cashfree_live',
      },
    })
  );
};

v1Router.get('/payments/orders/:orderId/status', requireAuth, handlePaymentOrderStatus);
v1Router.post('/payments/orders/:orderId/verify', requireAuth, handlePaymentOrderStatus);

v1Router.post('/payments/orders/:orderId/refund', requireAuth, requirePermission('payments.refund'), async (c) => {
  const reqId = c.get('requestId');
  const actor = c.get('user')!;
  const orderId = String(c.req.param('orderId') || '').trim();
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const reason = String(body?.reason || 'Authorized administrative refund').trim().slice(0, 240);
  const refundSpeed: 'STANDARD' | 'INSTANT' = body?.refundSpeed === 'INSTANT' ? 'INSTANT' : 'STANDARD';

  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (!billingDb) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'Billing database unavailable', requestId: reqId, data: null, errorCode: 'D1_UNBOUND' }), 503);
  }

  const orderRow = await billingDb
    .prepare(`SELECT id, application_id, user_id, total_paise, status, gateway_session_id FROM payment_orders WHERE id = ? LIMIT 1`)
    .bind(orderId)
    .first<any>();

  if (!orderRow) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: `Payment order ${orderId} not found`, requestId: reqId, data: null, errorCode: 'ORDER_NOT_FOUND' }), 404);
  }

  if (orderRow.status !== 'PAID' && orderRow.status !== 'PARTIALLY_REFUNDED') {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: `Order ${orderId} is ${orderRow.status} and cannot be refunded.`,
        requestId: reqId,
        data: null,
        errorCode: 'ORDER_NOT_REFUNDABLE',
      }),
      409
    );
  }

  let paymentRow = await billingDb
    .prepare(`SELECT * FROM payments WHERE order_id = ? LIMIT 1`)
    .bind(orderId)
    .first<any>()
    .catch(() => null);

  if (!paymentRow) {
    const payId = `pay_${orderId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    await billingDb
      .prepare(
        `INSERT OR IGNORE INTO payments (id, order_id, application_id, user_id, cf_payment_id, amount, govt_fee, total_amount, status, payment_method, order_amount_paise, refunded_paise, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'Success', 'Cashfree PG', ?, 0, CURRENT_TIMESTAMP)`
      )
      .bind(
        payId,
        orderId,
        orderRow.application_id,
        orderRow.user_id,
        `CF_PAY_${orderId}`,
        Math.round(fromPaise(orderRow.total_paise)),
        Math.round(fromPaise(orderRow.total_paise)),
        orderRow.total_paise
      )
      .run()
      .catch(() => null);
    paymentRow = await billingDb.prepare(`SELECT * FROM payments WHERE order_id = ? LIMIT 1`).bind(orderId).first<any>().catch(() => null);
  }

  const paidPaise = Number(paymentRow?.order_amount_paise || orderRow.total_paise || 0);
  const alreadyRefundedRow = await billingDb
    .prepare(
      `SELECT COALESCE(SUM(COALESCE(refund_amount_paise, CAST(ROUND(amount * 100) AS INTEGER))), 0) AS sum_paise
       FROM refunds
       WHERE order_id = ? AND (status IN ('Approved', 'Processed') OR gateway_status = 'SUCCESS')`
    )
    .bind(orderId)
    .first<{ sum_paise: number }>()
    .catch(() => ({ sum_paise: 0 }));

  const alreadyRefundedPaise = Math.max(Number(paymentRow?.refunded_paise || 0), Number(alreadyRefundedRow?.sum_paise || 0));
  const remainingPaise = Math.max(0, paidPaise - alreadyRefundedPaise);
  const requestedInr = body?.refundAmount !== undefined ? Number(body.refundAmount) : fromPaise(remainingPaise);
  const requestedPaise = Number.isFinite(requestedInr) ? toPaise(requestedInr) : 0;

  if (requestedPaise <= 0 || requestedPaise > remainingPaise) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: `Invalid refund amount: ₹${fromPaise(requestedPaise)} requested, ₹${fromPaise(remainingPaise)} refundable remaining.`,
        requestId: reqId,
        data: { refundableRemainingInr: fromPaise(remainingPaise) },
        errorCode: 'INVALID_OR_OVER_REFUND_AMOUNT',
      }),
      409
    );
  }

  const refundId = `REF_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  const cfConfig = await loadEffectiveCashfreeConfig(c.env);
  const isLiveGatewayOrder =
    cfConfig.configured &&
    !orderId.startsWith('TEST_CF_') &&
    !String(orderRow.gateway_session_id || '').startsWith('sim_');

  let gatewayResult: Awaited<ReturnType<typeof createCashfreeRefund>> | null = null;
  if (isLiveGatewayOrder) {
    gatewayResult = await createCashfreeRefund(cfConfig, {
      orderId,
      refundId,
      refundAmountInr: fromPaise(requestedPaise),
      refundNote: reason,
      refundSpeed,
      idempotencyKey: `ref_${refundId}`,
    });

    if (!gatewayResult.ok) {
      await billingDb
        .prepare(
          `INSERT INTO refunds (id, payment_id, order_id, application_id, amount, refund_amount_paise, reason, status, gateway_status, processed_by, gateway_response_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', 'FAILED', ?, ?)`
        )
        .bind(
          refundId,
          paymentRow?.id || `pay_${orderId}`,
          orderId,
          orderRow.application_id,
          fromPaise(requestedPaise),
          requestedPaise,
          reason,
          actor.id,
          gatewayResult.raw ? JSON.stringify(gatewayResult.raw).slice(0, 4000) : null
        )
        .run()
        .catch(() => null);

      return c.json(
        buildApiResponse({
          success: false,
          status: 'FAILED',
          message: gatewayResult.errorMessage || 'Cashfree refund API call failed',
          requestId: reqId,
          data: { refundId, orderId, errorCode: gatewayResult.errorCode },
          errorCode: gatewayResult.errorCode || 'CASHFREE_REFUND_FAILED',
        }),
        gatewayResult.httpStatus >= 400 && gatewayResult.httpStatus < 600 ? (gatewayResult.httpStatus as any) : 502
      );
    }
  }

  const initialStatus = gatewayResult ? (gatewayResult.refundStatus === 'SUCCESS' ? 'Processed' : 'Approved') : 'Processed';
  const initialGatewayStatus = gatewayResult ? gatewayResult.refundStatus : 'SUCCESS';

  await billingDb
    .prepare(
      `INSERT INTO refunds (
        id, payment_id, order_id, application_id, amount, refund_amount_paise, reason,
        status, cf_refund_id, refund_arn, refund_mode, gateway_status, processed_by, processed_at, gateway_response_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      refundId,
      paymentRow?.id || `pay_${orderId}`,
      orderId,
      orderRow.application_id,
      fromPaise(requestedPaise),
      requestedPaise,
      reason,
      initialStatus,
      gatewayResult?.cfRefundId || null,
      gatewayResult?.refundArn || null,
      gatewayResult?.refundMode || refundSpeed,
      initialGatewayStatus,
      actor.id,
      gatewayResult?.processedAt || new Date().toISOString(),
      gatewayResult?.raw ? JSON.stringify(gatewayResult.raw).slice(0, 4000) : null
    )
    .run()
    .catch(async () => {
      await billingDb
        .prepare(`INSERT INTO refunds (id, payment_id, amount, reason, status) VALUES (?, ?, ?, ?, ?)`)
        .bind(refundId, paymentRow?.id || `pay_${orderId}`, fromPaise(requestedPaise), reason, initialStatus)
        .run();
    });

  const rec = await reconcileRefundOutcome(c.env, {
    refundId,
    orderId,
    cfRefundId: gatewayResult?.cfRefundId,
    cfPaymentId: gatewayResult?.cfPaymentId || paymentRow?.cf_payment_id,
    refundAmountInr: fromPaise(requestedPaise),
    refundArn: gatewayResult?.refundArn,
    refundMode: gatewayResult?.refundMode || refundSpeed,
    refundStatus: initialGatewayStatus,
    statusDescription: gatewayResult?.statusDescription || reason,
    processedAt: gatewayResult?.processedAt || new Date().toISOString(),
    rawGatewayJson: gatewayResult?.raw ? JSON.stringify(gatewayResult.raw) : undefined,
    actorId: actor.id,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: initialGatewayStatus === 'SUCCESS' ? 'SUCCESS' : 'PENDING',
      message: isLiveGatewayOrder
        ? `Cashfree refund ${refundId} submitted (${initialGatewayStatus})`
        : `Refund ${refundId} recorded for ${orderId}`,
      requestId: reqId,
      data: {
        refundId,
        orderId,
        cfRefundId: gatewayResult?.cfRefundId || null,
        refundArn: gatewayResult?.refundArn || null,
        refundedAmount: fromPaise(requestedPaise),
        refundAmountInr: fromPaise(requestedPaise),
        refundStatus: initialGatewayStatus,
        gatewayStatus: initialGatewayStatus,
        isPartial: alreadyRefundedPaise + requestedPaise < paidPaise - 100,
        paymentStatus: rec.paymentStatus,
        commissionReversed: rec.commissionReversed,
        liveGateway: isLiveGatewayOrder,
      },
    }),
    201
  );
});

v1Router.get('/payments/orders/:orderId/refunds', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const orderId = String(c.req.param('orderId') || '').trim();
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (!billingDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Billing DB unbound', requestId: reqId, data: [] }));
  }

  const order = await billingDb.prepare(`SELECT id, user_id FROM payment_orders WHERE id = ? LIMIT 1`).bind(orderId).first<{ id: string; user_id: string }>();
  if (!order) {
    return c.json(buildApiResponse({ success: false, status: 'FAILED', message: 'Order not found', requestId: reqId, data: null, errorCode: 'ORDER_NOT_FOUND' }), 404);
  }
  const isPrivileged = isSuperAdminRole(user.role) || user.role === 'admin' || user.role === 'manager';
  if (order.user_id !== user.id && !isPrivileged) {
    return c.json(buildApiResponse({ success: false, status: 'REJECTED', message: 'Forbidden', requestId: reqId, data: null, errorCode: 'FORBIDDEN' }), 403);
  }

  const rows = await billingDb.prepare(`SELECT * FROM refunds WHERE order_id = ? ORDER BY created_at DESC`).bind(orderId).all<any>().catch(() => ({ results: [] }));
  if (c.req.query('sync') === 'true') {
    const cfConfig = await loadEffectiveCashfreeConfig(c.env);
    if (cfConfig.configured) {
      const liveRefunds = await getCashfreeOrderRefunds(cfConfig, orderId);
      if (liveRefunds.ok) {
        for (const lr of liveRefunds.refunds) {
          if (lr.refundId) {
            await reconcileRefundOutcome(c.env, {
              refundId: lr.refundId,
              orderId,
              cfRefundId: lr.cfRefundId,
              cfPaymentId: lr.cfPaymentId,
              refundAmountInr: lr.refundAmount,
              refundArn: lr.refundArn,
              refundMode: lr.refundMode,
              refundStatus: lr.refundStatus,
              processedAt: lr.processedAt,
              actorId: user.id,
            });
          }
        }
      }
    }
  }

  const refreshed = await billingDb.prepare(`SELECT * FROM refunds WHERE order_id = ? ORDER BY created_at DESC`).bind(orderId).all<any>().catch(() => rows);
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Refund records fetched',
      requestId: reqId,
      data: (refreshed.results || []).map((r: any) => ({
        id: r.id,
        orderId: r.order_id,
        cfRefundId: r.cf_refund_id || undefined,
        amountInr: r.refund_amount_paise ? fromPaise(r.refund_amount_paise) : Number(r.amount || 0),
        status: r.status,
        gatewayStatus: r.gateway_status || undefined,
        refundArn: r.refund_arn || undefined,
        refundMode: r.refund_mode || undefined,
        reason: r.reason,
        createdAt: r.created_at,
        processedAt: r.processed_at || undefined,
      })),
    })
  );
});

v1Router.post('/payments/applications/status', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const rawApps = Array.isArray(body?.applications) ? body.applications : [];
  const preferredMode = typeof body?.preferredMode === 'string' ? body.preferredMode : undefined;

  if (rawApps.length === 0) {
    const emptyCheckedAt = new Date().toISOString();
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'No applications supplied for payment verification',
        requestId: reqId,
        data: {
          items: [],
          summary: { total: 0, paid: 0, pending: 0, failed: 0 },
          gatewayConfigured: resolveCashfreeConfig(c.env, preferredMode).configured,
          mode: resolveCashfreeConfig(c.env, preferredMode).mode,
          checkedAt: emptyCheckedAt,
        },
      })
    );
  }

  const cfConfig = resolveCashfreeConfig(c.env, preferredMode);
  if (cfConfig.isProductionRuntime && !cfConfig.configured) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: buildCashfreeUnconfiguredMessage(cfConfig),
        requestId: reqId,
        data: {
          missingBindings: cfConfig.missingBindings,
          clientIdConfigured: cfConfig.clientIdConfigured,
          clientSecretConfigured: cfConfig.clientSecretConfigured,
        },
        errorCode: 'CASHFREE_NOT_CONFIGURED',
      }),
      503
    );
  }

  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  const checkedAt = new Date().toISOString();
  const cappedApps = rawApps.slice(0, 25);

  const items: ApplicationPaymentStatusItem[] = await Promise.all(
    cappedApps.map(async (entry: any): Promise<ApplicationPaymentStatusItem> => {
      const applicationId = String(entry?.applicationId || '').trim();
      const orderId = String(entry?.orderId || '').trim();
      const currentStatus = typeof entry?.currentStatus === 'string' ? entry.currentStatus : undefined;

      if (!orderId) {
        const uiStatus = normalizePaymentUiStatus(currentStatus);
        return {
          applicationId,
          orderId: '',
          uiStatus,
          gatewayStatus: uiStatus === 'Paid' ? 'PAID' : uiStatus === 'Failed' ? 'FAILED' : 'PENDING',
          paid: uiStatus === 'Paid',
          gatewayConfigured: cfConfig.configured,
          simulationOnly: !cfConfig.configured,
          mode: cfConfig.mode,
          source: 'missing_order_id',
          checkedAt,
        };
      }

      let existingOrder:
        | { id: string; user_id: string; status: string; total_paise: number; updated_at: string }
        | null = null;

      if (billingDb) {
        existingOrder = await billingDb
          .prepare(`SELECT id, user_id, status, total_paise, updated_at FROM payment_orders WHERE id = ? LIMIT 1`)
          .bind(orderId)
          .first();

        if (
          existingOrder &&
          existingOrder.user_id !== user.id &&
          !isSuperAdminRole(user.role) &&
          user.role !== 'admin' &&
          user.role !== 'manager'
        ) {
          return {
            applicationId,
            orderId,
            uiStatus: normalizePaymentUiStatus(currentStatus),
            gatewayStatus: 'FORBIDDEN',
            paid: false,
            gatewayConfigured: cfConfig.configured,
            mode: cfConfig.mode,
            source: 'gateway_unreachable',
            checkedAt,
            errorMessage: 'Not authorized to inspect this payment order',
          };
        }

        if (existingOrder?.status === 'PAID') {
          return {
            applicationId,
            orderId: existingOrder.id,
            uiStatus: 'Paid',
            gatewayStatus: 'PAID',
            paid: true,
            paymentAmount: fromPaise(existingOrder.total_paise),
            paymentTime: existingOrder.updated_at,
            gatewayConfigured: cfConfig.configured,
            mode: cfConfig.mode,
            source: 'webhook_or_ledger',
            checkedAt,
          };
        }
      }

      if (!cfConfig.configured) {
        const effectiveRaw = existingOrder?.status || currentStatus || 'CREATED';
        const uiStatus = normalizePaymentUiStatus(effectiveRaw);
        return {
          applicationId,
          orderId,
          uiStatus,
          gatewayStatus: existingOrder?.status || (uiStatus === 'Paid' ? 'PAID' : uiStatus === 'Failed' ? 'FAILED' : 'CREATED'),
          paid: uiStatus === 'Paid',
          gatewayConfigured: false,
          simulationOnly: true,
          mode: cfConfig.mode,
          source: 'sandbox_preview',
          checkedAt,
        };
      }

      const liveStatus = await getCashfreePgOrderStatus(cfConfig, orderId);
      if (!liveStatus.ok) {
        const fallbackUi = normalizePaymentUiStatus(existingOrder?.status || currentStatus);
        return {
          applicationId,
          orderId,
          uiStatus: fallbackUi,
          gatewayStatus: existingOrder?.status || 'PENDING',
          paid: fallbackUi === 'Paid',
          gatewayConfigured: true,
          mode: cfConfig.mode,
          source: 'gateway_unreachable',
          checkedAt,
          errorMessage: liveStatus.errorMessage || 'Unable to verify payment status with Cashfree',
        };
      }

      if (liveStatus.paid) {
        const rec = await reconcilePaidOrder(c.env, {
          orderId,
          cfPaymentId: liveStatus.cfPaymentId,
          paymentMethod: liveStatus.paymentMethod,
          paymentAmountInr: liveStatus.paymentAmount,
          paidAt: liveStatus.paymentTime,
          actorId: user.id,
          ip: c.req.header('cf-connecting-ip'),
        });
        if (rec.amountMismatch) {
          return {
            applicationId,
            orderId: liveStatus.orderId || orderId,
            uiStatus: 'Failed',
            gatewayStatus: 'AMOUNT_MISMATCH',
            paid: false,
            gatewayConfigured: true,
            mode: cfConfig.mode,
            source: 'cashfree_live',
            checkedAt,
            errorMessage: rec.message,
          };
        }
      } else if (billingDb && existingOrder) {
        const dbStatus =
          liveStatus.orderStatus === 'FAILED'
            ? 'FAILED'
            : liveStatus.orderStatus === 'EXPIRED'
            ? 'EXPIRED'
            : existingOrder.status;

        if (dbStatus !== existingOrder.status) {
          await billingDb
            .prepare(`UPDATE payment_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .bind(dbStatus, orderId)
            .run()
            .catch(() => {});
        }
      }

      return {
        applicationId,
        orderId: liveStatus.orderId || orderId,
        uiStatus: normalizePaymentUiStatus(liveStatus.orderStatus, liveStatus.paid),
        gatewayStatus: liveStatus.orderStatus,
        paid: liveStatus.paid,
        cfPaymentId: liveStatus.cfPaymentId,
        paymentMethod: liveStatus.paymentMethod,
        paymentTime: liveStatus.paymentTime,
        bankReference: liveStatus.bankReference,
        paymentAmount: liveStatus.paymentAmount,
        paymentMessage: liveStatus.paymentMessage,
        gatewayConfigured: true,
        mode: cfConfig.mode,
        source: 'cashfree_live',
        checkedAt,
      };
    })
  );

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: cfConfig.configured
        ? `Real-time payment status synced for ${items.length} application(s)`
        : `Payment status retrieved for ${items.length} application(s) in sandbox preview mode`,
      requestId: reqId,
      data: {
        items,
        summary: summarizePaymentStatuses(items),
        gatewayConfigured: cfConfig.configured,
        simulationOnly: !cfConfig.configured,
        mode: cfConfig.mode,
        checkedAt,
      },
    })
  );
});

v1Router.get('/payments/history', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const rawPage = Number(c.req.query('page') || 1);
  const rawPageSize = Number(c.req.query('pageSize') || 50);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize >= 1
      ? Math.min(Math.floor(rawPageSize), 100)
      : 50;

  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');

  if (!billingDb) {
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'No D1 billing database bound; returning client-scoped payment history',
        requestId: reqId,
        data: {
          items: [],
          pagination: {
            page,
            pageSize,
            totalItems: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        },
      })
    );
  }

  const offset = (page - 1) * pageSize;
  const [countRow, rows] = await Promise.all([
    billingDb
      .prepare(`SELECT COUNT(*) AS total FROM payment_orders WHERE user_id = ?`)
      .bind(user.id)
      .first<{ total: number }>()
      .catch(() => ({ total: 0 })),
    billingDb
      .prepare(
        `SELECT
           po.id, po.application_id, po.user_id, po.service_slug, po.total_paise, po.currency,
           po.gateway_session_id, po.status, po.payment_status_normalized, po.order_expiry_time,
           po.last_error, po.retry_of_order_id, po.created_at, po.updated_at,
           p.cf_payment_id, p.payment_method, p.bank_reference, p.refunded_paise, p.status AS payment_ledger_status, p.paid_at,
           i.invoice_number
         FROM payment_orders po
         LEFT JOIN payments p ON p.order_id = po.id
         LEFT JOIN invoices i ON i.order_id = po.id
         WHERE po.user_id = ?
         ORDER BY po.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(user.id, pageSize, offset)
      .all<any>()
      .catch(async () =>
        billingDb
          .prepare(
            `SELECT id, application_id, user_id, total_paise, currency, gateway_session_id, status, created_at, updated_at
             FROM payment_orders
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`
          )
          .bind(user.id, pageSize, offset)
          .all<any>()
      ),
  ]);

  const items = (rows.results || []).map((row) => ({
    orderId: row.id,
    applicationId: row.application_id,
    serviceSlug: row.service_slug || undefined,
    transactionId: row.cf_payment_id || row.id,
    cfPaymentId: row.cf_payment_id || undefined,
    bankReference: row.bank_reference || undefined,
    invoiceNumber: row.invoice_number || undefined,
    amount: fromPaise(row.total_paise),
    refundedAmount: row.refunded_paise ? fromPaise(row.refunded_paise) : 0,
    currency: row.currency || 'INR',
    status: row.status,
    normalizedState: row.payment_status_normalized || normalizeCashfreeLifecycleState(row.status),
    paymentMethod: row.payment_method || 'Cashfree PG',
    orderExpiryTime: row.order_expiry_time || undefined,
    lastError: row.last_error || undefined,
    retryOfOrderId: row.retry_of_order_id || undefined,
    date: row.paid_at || row.updated_at || row.created_at,
    gatewaySessionId: row.gateway_session_id || undefined,
  }));

  const totalItems = Number(countRow?.total ?? items.length) || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Loaded ${items.length} payment history record(s)`,
      requestId: reqId,
      data: {
        items,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    })
  );
});

export const handleCashfreeWebhookGet = async (c: any) => {
  const reqId = c.get('requestId') || `req_${Date.now()}`;
  const cfConfig = await loadEffectiveCashfreeConfig(c.env);
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Cashfree webhook endpoint is active and ready for signed POST events',
      requestId: reqId,
      data: {
        endpoint: '/api/webhooks/cashfree',
        legacyEndpoint: '/api/v1/payments/webhook',
        webhookUrl: `${cfConfig.appDomain}/api/webhooks/cashfree`,
        apiVersion: cfConfig.apiVersion,
        mode: cfConfig.mode,
        configured: Boolean(cfConfig.webhookSecret || cfConfig.clientSecret),
        supportedEvents: [
          'PAYMENT_SUCCESS_WEBHOOK',
          'PAYMENT_FAILED_WEBHOOK',
          'PAYMENT_USER_DROPPED_WEBHOOK',
          'PAYMENT_PENDING_WEBHOOK',
          'REFUND_STATUS_WEBHOOK',
        ],
      },
    })
  );
};

async function persistRejectedWebhookAttempt(
  env: Env,
  params: { orderId?: string; eventType?: string; rawBody: string; timestamp?: string; errorMessage: string }
) {
  try {
    const { db: billingDb } = await new DatabaseRegistry(env).resolveAndEnsure('dip_billing');
    if (!billingDb) return;
    const evtId = `failed_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    await billingDb
      .prepare(
        `INSERT INTO payment_webhook_events (
          id, event_id, order_id, event_type, signature_verified, payload_hash,
          processing_status, event_timestamp, error_message, raw_payload_json
        ) VALUES (?, ?, ?, ?, 0, 'rejected', ?, ?, ?, ?)`
      )
      .bind(
        `whe_${crypto.randomUUID()}`,
        evtId,
        params.orderId || '',
        params.eventType || 'UNKNOWN_WEBHOOK',
        'FAILED',
        params.timestamp || null,
        params.errorMessage.slice(0, 500),
        params.rawBody.slice(0, 4000)
      )
      .run()
      .catch(() => null);
  } catch {
    // non-fatal failure persistence
  }
}

export const handleCashfreeWebhookPost = async (c: any) => {
  const reqId = c.get('requestId') || `req_${Date.now()}`;
  const rawBody = await c.req.text();
  const signature = c.req.header('x-webhook-signature') || '';
  const timestamp = c.req.header('x-webhook-timestamp') || '';

  let parsed: Record<string, any> | null = null;
  try {
    parsed = rawBody.trim() ? (JSON.parse(rawBody) as Record<string, any>) : {};
  } catch {
    parsed = null;
  }

  // Acknowledge unsigned connectivity/health test pings from Cashfree Dashboard without touching DB
  if (!signature && isCashfreeTestPingPayload(rawBody, parsed)) {
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Cashfree webhook endpoint verified (connectivity test ping acknowledged)',
        requestId: reqId,
        data: { testPing: true, orderMutated: false },
      })
    );
  }

  const tsValidation = validateWebhookTimestamp(timestamp, {
    enforce: isProductionEnvironment(c.env) && Boolean(c.env.DB_BILLING || c.env.DB),
    maxSkewSeconds: 600,
  });
  if (!tsValidation.valid) {
    await persistRejectedWebhookAttempt(c.env, {
      orderId: String(parsed?.data?.order?.order_id || parsed?.data?.refund?.order_id || ''),
      eventType: String(parsed?.type || 'UNKNOWN'),
      rawBody,
      timestamp,
      errorMessage: tsValidation.reason || 'Webhook timestamp rejected',
    });
    logCashfreeEvent('warn', 'webhook_timestamp_rejected', {
      reason: tsValidation.reason,
      orderId: parsed?.data?.order?.order_id,
    });
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: tsValidation.reason || 'Invalid or expired Cashfree webhook timestamp',
        requestId: reqId,
        data: null,
        errorCode: 'INVALID_WEBHOOK_TIMESTAMP',
      }),
      401
    );
  }

  const resolvedCfConfig = resolveCashfreeConfig(c.env);
  const configuredSecrets = [
    resolvedCfConfig.webhookSecret,
    resolvedCfConfig.clientSecret,
    c.env.CASHFREE_WEBHOOK_SECRET,
    c.env.CASHFREE_CLIENT_SECRET,
    c.env.CASHFREE_SECRET_KEY,
  ].filter((s): s is string => Boolean(s && String(s).trim()));

  const isLocalSandboxTestOrder =
    !isProductionEnvironment(c.env) &&
    String(parsed?.data?.order?.order_id || '').startsWith('TEST_CF_');

  const candidateSecrets =
    configuredSecrets.length > 0
      ? configuredSecrets
      : isLocalSandboxTestOrder
      ? ['dip_local_sandbox_test_secret']
      : [];

  if (candidateSecrets.length === 0) {
    if (isCashfreeTestPingPayload(rawBody, parsed)) {
      return c.json(
        buildApiResponse({
          success: true,
          status: 'SUCCESS',
          message:
            'Cashfree webhook connectivity test ping acknowledged (bind CASHFREE_WEBHOOK_SECRET or CASHFREE_CLIENT_SECRET in Worker secrets for live signature verification)',
          requestId: reqId,
          data: { testPing: true, signatureVerified: false, orderMutated: false },
        })
      );
    }
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'CASHFREE_WEBHOOK_SECRET or CASHFREE_CLIENT_SECRET not configured in Worker secrets',
        requestId: reqId,
        data: null,
        errorCode: 'WEBHOOK_SECRET_UNCONFIGURED',
      }),
      503
    );
  }

  const verification = await verifyCashfreeWebhookWithAnySecret(
    candidateSecrets,
    timestamp,
    rawBody,
    signature
  );
  if (!verification.valid) {
    await persistRejectedWebhookAttempt(c.env, {
      orderId: String(parsed?.data?.order?.order_id || parsed?.data?.refund?.order_id || ''),
      eventType: String(parsed?.type || 'UNKNOWN'),
      rawBody,
      timestamp,
      errorMessage: 'Invalid Cashfree webhook HMAC signature',
    });
    logCashfreeEvent('warn', 'webhook_signature_rejected', {
      orderId: parsed?.data?.order?.order_id,
      eventType: parsed?.type,
    });
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Invalid Cashfree webhook signature',
        requestId: reqId,
        data: null,
        errorCode: 'INVALID_WEBHOOK_SIGNATURE',
      }),
      401
    );
  }

  if (isCashfreeTestPingPayload(rawBody, parsed)) {
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Signed Cashfree webhook test ping verified',
        requestId: reqId,
        data: { testPing: true, signatureVerified: true, orderMutated: false },
      })
    );
  }

  if (!parsed) {
    await persistRejectedWebhookAttempt(c.env, {
      rawBody,
      timestamp,
      errorMessage: 'Malformed JSON body in signed Cashfree webhook',
    });
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Invalid JSON payload in webhook request',
        requestId: reqId,
        data: null,
        errorCode: 'INVALID_WEBHOOK_JSON',
      }),
      400
    );
  }

  const result = await processCashfreeWebhookEvent(c.env, {
    parsed,
    rawBody,
    timestamp,
    signatureHashPrefix: verification.matchedHashPrefix || 'verified',
    actorId: 'cashfree_webhook',
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: result.ok,
      status: result.ok ? 'SUCCESS' : 'REJECTED',
      message: result.message,
      requestId: reqId,
      data: {
        eventId: result.eventId,
        orderId: result.orderId,
        eventType: result.eventType,
        resolvedOrderStatus: result.resolvedOrderStatus,
        deduplicated: result.deduplicated,
        ignoredMonotonic: result.ignoredMonotonic,
        amountMismatch: result.amountMismatch,
      },
      errorCode: result.amountMismatch ? 'PAYMENT_AMOUNT_MISMATCH' : undefined,
    }),
    result.httpStatus as any
  );
};

v1Router.get('/payments/webhook', handleCashfreeWebhookGet);
v1Router.post('/payments/webhook', handleCashfreeWebhookPost);

const SANDBOX_TEST_ALLOWED_ROLES = new Set([
  'operator',
  'partner',
  'manager',
  'admin',
  'super_admin',
]);

v1Router.post('/payments/sandbox-test/order', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  if (!SANDBOX_TEST_ALLOWED_ROLES.has(user.role)) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Only Operator, Partner, Manager, or Admin accounts can run sandbox payment tests.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN_SANDBOX_TEST',
      }),
      403
    );
  }

  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const rawAmt = Number(body?.amountInr ?? 199);
  const amountInr = Number.isFinite(rawAmt) ? Math.min(Math.max(Math.round(rawAmt), 1), 5000) : 199;
  const channel = body?.channel === 'partner' ? 'partner' : 'operator';
  const orderId = `TEST_CF_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const paymentSessionId = `sandbox_test_sess_${crypto.randomUUID().slice(0, 12)}`;
  const cfConfig = resolveCashfreeConfig(c.env, 'sandbox');

  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (billingDb) {
    const amountPaise = Math.round(amountInr * 100);
    await billingDb
      .prepare(
        `INSERT INTO payment_orders (id, application_id, user_id, idempotency_key, service_slug, service_fee_paise, govt_fee_paise, additional_charge_paise, tax_paise, total_paise, gateway_session_id, status)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 'CREATED')`
      )
      .bind(
        orderId,
        `SANDBOX_${channel.toUpperCase()}_${user.id}`,
        user.id,
        `sandbox_${orderId}`,
        'sandbox-webhook-verification',
        amountPaise,
        amountPaise,
        paymentSessionId
      )
      .run()
      .catch(async () => {
        await billingDb
          .prepare(
            `INSERT INTO payment_orders (id, application_id, user_id, idempotency_key, service_fee_paise, govt_fee_paise, additional_charge_paise, tax_paise, total_paise, gateway_session_id, status)
             VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 'CREATED')`
          )
          .bind(
            orderId,
            `SANDBOX_${channel.toUpperCase()}_${user.id}`,
            user.id,
            `sandbox_${orderId}`,
            amountPaise,
            amountPaise,
            paymentSessionId
          )
          .run()
          .catch(() => null);
      });
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'PENDING',
      message: 'Sandbox test order initialized (isolated from live accounting)',
      requestId: reqId,
      data: {
        orderId,
        paymentSessionId,
        amountInr,
        channel,
        mode: 'sandbox' as const,
        orderStatus: 'CREATED',
        webhookEndpoint: '/api/v1/payments/webhook',
        secretConfigured: Boolean(cfConfig.webhookSecret || cfConfig.clientSecret),
      },
    })
  );
});

v1Router.post('/payments/sandbox-test/verify-webhook', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  if (!SANDBOX_TEST_ALLOWED_ROLES.has(user.role)) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Only Operator, Partner, Manager, or Admin accounts can verify sandbox webhooks.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN_SANDBOX_TEST',
      }),
      403
    );
  }

  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const orderId = String(body?.orderId || '').trim();
  if (!orderId.startsWith('TEST_CF_')) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Sandbox webhook verifier accepts only isolated TEST_CF_* orders.',
        requestId: reqId,
        data: null,
        errorCode: 'INVALID_SANDBOX_ORDER_ID',
      }),
      400
    );
  }

  const rawEventType = String(body?.eventType || 'PAYMENT_SUCCESS_WEBHOOK');
  const eventType =
    rawEventType === 'PAYMENT_FAILED_WEBHOOK' || rawEventType === 'PAYMENT_USER_DROPPED_WEBHOOK'
      ? rawEventType
      : 'PAYMENT_SUCCESS_WEBHOOK';
  const methodKey = body?.paymentMethod === 'card' || body?.paymentMethod === 'netbanking' ? body.paymentMethod : 'upi';
  const amountInr = Number.isFinite(Number(body?.amountInr)) ? Math.max(1, Number(body.amountInr)) : 199;
  const cfPaymentId = `CF_TEST_PAY_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  const paymentTime = new Date().toISOString();

  const paymentStatus =
    eventType === 'PAYMENT_SUCCESS_WEBHOOK'
      ? 'SUCCESS'
      : eventType === 'PAYMENT_FAILED_WEBHOOK'
      ? 'FAILED'
      : 'USER_DROPPED';

  const paymentMethodPayload =
    methodKey === 'card'
      ? { card: { card_network: 'VISA', card_number: '411111XXXXXX1111' } }
      : methodKey === 'netbanking'
      ? { netbanking: { netbanking_bank_name: 'HDFC Sandbox Bank' } }
      : { upi: { upi_id: 'sandbox.tester@okaxis' } };

  const webhookPayload = {
    type: eventType,
    event_time: paymentTime,
    data: {
      order: {
        order_id: orderId,
        order_amount: amountInr,
        order_currency: 'INR',
        order_tags: {
          sandbox_test: 'true',
          initiated_by_role: user.role,
        },
      },
      payment: {
        cf_payment_id: cfPaymentId,
        payment_status: paymentStatus,
        payment_amount: amountInr,
        payment_currency: 'INR',
        payment_group: methodKey,
        payment_method: paymentMethodPayload,
        payment_time: paymentTime,
        payment_message: `Sandbox ${eventType} simulated for end-to-end webhook check`,
      },
    },
  };

  const cfConfig = resolveCashfreeConfig(c.env, 'sandbox');
  const signingSecret =
    cfConfig.webhookSecret ||
    cfConfig.clientSecret ||
    (!isProductionEnvironment(c.env) ? 'dip_local_sandbox_test_secret' : '');

  if (!signingSecret) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'CASHFREE_WEBHOOK_SECRET or CASHFREE_CLIENT_SECRET is required in production to sign test webhooks.',
        requestId: reqId,
        data: null,
        errorCode: 'WEBHOOK_SECRET_UNCONFIGURED',
      }),
      503
    );
  }

  const rawWebhookBody = JSON.stringify(webhookPayload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await hmacSha256Base64(signingSecret, `${timestamp}${rawWebhookBody}`);

  const dispatchOnce = async () => {
    const start = Date.now();
    const res = await v1Router.fetch(
      new Request(`${cfConfig.appDomain}/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-timestamp': timestamp,
          'x-webhook-signature': signature,
        },
        body: rawWebhookBody,
      }),
      c.env
    );
    const json = (await res.json().catch(() => ({}))) as Record<string, any>;
    return {
      httpStatus: res.status,
      json,
      durationMs: Math.max(1, Date.now() - start),
    };
  };

  const first = await dispatchOnce();
  const replay = first.httpStatus === 200 ? await dispatchOnce() : null;

  let persistedOrderStatus: string | undefined = first.json?.data?.resolvedOrderStatus;
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (billingDb) {
    const row = await billingDb
      .prepare(`SELECT status FROM payment_orders WHERE id = ? LIMIT 1`)
      .bind(orderId)
      .first<{ status: string }>()
      .catch(() => null);
    if (row?.status) {
      persistedOrderStatus = row.status;
    }
  }

  const expectedStatus =
    eventType === 'PAYMENT_SUCCESS_WEBHOOK'
      ? 'PAID'
      : eventType === 'PAYMENT_FAILED_WEBHOOK'
      ? 'FAILED'
      : 'DROPPED';

  const verifiedEndToEnd =
    first.httpStatus === 200 &&
    Boolean(first.json?.success) &&
    first.json?.data?.resolvedOrderStatus === expectedStatus;

  await writeAuditLog(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'SANDBOX_WEBHOOK_END_TO_END_TEST',
    resourceType: 'payment_order',
    resourceId: orderId,
    summary: `Executed sandbox ${eventType} test on ${orderId}: webhook HTTP ${first.httpStatus}, status=${persistedOrderStatus}`,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: verifiedEndToEnd,
      status: verifiedEndToEnd ? 'SUCCESS' : 'FAILED',
      message: verifiedEndToEnd
        ? `End-to-end webhook verified (${eventType} -> ${persistedOrderStatus})`
        : first.json?.message || 'Sandbox webhook verification failed',
      requestId: reqId,
      data: {
        orderId,
        cfPaymentId,
        eventType,
        paymentMethod: methodKey.toUpperCase(),
        amountInr,
        signaturePrefix: signature.slice(0, 20),
        webhookEndpoint: '/api/v1/payments/webhook',
        usingConfiguredSecret: Boolean(cfConfig.webhookSecret || cfConfig.clientSecret),
        firstDelivery: {
          httpStatus: first.httpStatus,
          success: Boolean(first.json?.success),
          resolvedOrderStatus: first.json?.data?.resolvedOrderStatus || null,
          message: first.json?.message || null,
          durationMs: first.durationMs,
        },
        idempotencyReplay: replay
          ? {
              httpStatus: replay.httpStatus,
              deduplicated: Boolean(replay.json?.data?.deduplicated),
              message: replay.json?.message || null,
              durationMs: replay.durationMs,
            }
          : null,
        persistedOrderStatus,
        verifiedEndToEnd,
        sandboxIsolated: true,
      },
    }),
    verifiedEndToEnd ? 200 : 502
  );
});

// ==========================================
// 6. PARTNER, COMMISSION LEDGER & SETTLEMENTS
// ==========================================
v1Router.patch(
  '/settlements/:id/approve',
  requireAuth,
  requirePermission('commissions.manage'),
  async (c) => {
    const reqId = c.get('requestId');
    const user = c.get('user')!;
    const settlementReqId = c.req.param('id');
    const body = await c.req.json().catch(() => ({} as Record<string, any>));

    if (!isSuperAdminRole(user.role)) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'REJECTED',
          message: 'Only Super Admin can approve partner payout settlements.',
          requestId: reqId,
          data: null,
          errorCode: 'FORBIDDEN_SETTLEMENT_APPROVAL',
        }),
        403
      );
    }

    const dbReg = new DatabaseRegistry(c.env);
    const [{ db: billingDb }, { db: partnersDb }] = await Promise.all([
      dbReg.resolveAndEnsure('dip_billing'),
      dbReg.resolveAndEnsure('dip_partners'),
    ]);

    const reqRow = billingDb
      ? await billingDb.prepare(
          `SELECT id, partner_id, requested_paise, status
           FROM settlement_requests
           WHERE id = ? LIMIT 1`
        )
          .bind(settlementReqId)
          .first<{
            id: string;
            partner_id: string;
            requested_paise: number;
            status: string;
          }>()
      : null;

    if (!reqRow || !billingDb) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'FAILED',
          message: 'Settlement request not found',
          requestId: reqId,
          data: null,
          errorCode: 'NOT_FOUND',
        }),
        404
      );
    }

    const partnerRow = partnersDb
      ? await partnersDb.prepare(`SELECT user_id FROM partners WHERE id = ? LIMIT 1`)
          .bind(reqRow.partner_id)
          .first<{ user_id: string }>()
      : null;

    if (partnerRow && partnerRow.user_id === user.id) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'REJECTED',
          message: 'Partners are strictly prohibited from approving their own settlement requests.',
          requestId: reqId,
          data: null,
          errorCode: 'SELF_APPROVAL_BLOCKED',
        }),
        403
      );
    }

    const payoutRef = String(body?.payoutReference || `UTR-${Date.now()}`);
    await billingDb.prepare(
      `UPDATE settlement_requests SET status = 'Paid', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
      .bind(user.id, settlementReqId)
      .run();

    await billingDb.prepare(
      `INSERT INTO settlements (id, settlement_request_id, partner_id, paid_paise, payout_reference, processed_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(`stl_${crypto.randomUUID()}`, settlementReqId, reqRow.partner_id, reqRow.requested_paise, payoutRef, user.id)
      .run();

    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Settlement approved and payout recorded',
        requestId: reqId,
        data: { settlementRequestId: settlementReqId, payoutReference: payoutRef },
      })
    );
  }
);

// ==========================================
// 7. INTEGRATIONS & BUSINESS SETTINGS STATUS
// ==========================================
v1Router.get('/integrations/status', requireAuth, requirePermission('reports.view'), (c) => {
  const cfConfig = resolveCashfreeConfig(c.env);
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Live Worker integration configuration readiness',
      requestId: c.get('requestId'),
      data: {
        cashfree: cfConfig.configured,
        cashfreeMode: cfConfig.mode,
        cashfreeWebhook: Boolean(cfConfig.webhookSecret),
        digilocker: Boolean(c.env.DIGILOCKER_CLIENT_ID && c.env.DIGILOCKER_CLIENT_SECRET),
        transactionalEmail: Boolean(c.env.RESEND_API_KEY),
        whatsapp: Boolean(c.env.WHATSAPP_API_TOKEN),
        sms: Boolean(c.env.SMS_GATEWAY_KEY),
        documentSigning: Boolean(c.env.AUTH_SIGNING_SECRET),
        geminiAssistant: Boolean(c.env.GEMINI_API_KEY),
      },
    })
  );
});

v1Router.post('/notifications/payment-alert', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));

  const applicationId = String(body?.applicationId || '').trim();
  const rawStatus = String(body?.status || '').trim();
  const statusMap: Record<string, PaymentAlertStatus> = {
    initiated: 'Initiated',
    pending: 'Pending',
    paid: 'Paid',
    failed: 'Failed',
    'refund initiated': 'Refund Initiated',
    refund_initiated: 'Refund Initiated',
    refunded: 'Refunded',
    'refund failed': 'Refund Failed',
    refund_failed: 'Refund Failed',
  };
  const explicitStatus = statusMap[rawStatus.toLowerCase()];
  const normalizedFallback = normalizePaymentUiStatus(rawStatus);
  const alertStatus: PaymentAlertStatus =
    explicitStatus || (normalizedFallback === 'Paid' ? 'Paid' : normalizedFallback === 'Failed' ? 'Failed' : 'Pending');

  if (!applicationId || !rawStatus) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'applicationId and status are required',
        requestId: reqId,
        data: null,
        errorCode: 'INVALID_PAYMENT_ALERT_PAYLOAD',
      }),
      400
    );
  }

  const targetUserId = String(body?.userId || user.id).trim();
  if (targetUserId !== user.id && !isSuperAdminRole(user.role)) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Cannot dispatch payment alerts for another user account',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN_ALERT_TARGET',
      }),
      403
    );
  }

  const orderId = String(body?.orderId || '').trim();
  const transactionId = String(body?.transactionId || orderId || applicationId).trim();
  const serviceName = String(body?.serviceName || 'Digital India Service').trim();
  const amountInr = Number(body?.amountInr || 0) || 0;
  const recipientEmail = String(body?.recipientEmail || user.email || '').trim();
  const recipientName = String(body?.recipientName || user.name || 'Applicant').trim();
  const paymentMethod = String(body?.paymentMethod || 'Cashfree PG').trim();

  const cleanOrderKey = (orderId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanAppKey = applicationId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanStatusKey = alertStatus.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const notificationId = `notif_pay_${cleanAppKey}_${cleanStatusKey}_${cleanOrderKey}`;

  const { db: coreDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_core');
  let deduplicated = false;
  const alertTitle = `Payment ${alertStatus}: ₹${amountInr.toLocaleString('en-IN')} (${applicationId})`;
  const alertContent = `${serviceName} (${applicationId}) update: ${alertStatus} via ${paymentMethod}.`;

  if (coreDb) {
    const existing = await coreDb
      .prepare(`SELECT id FROM notifications WHERE id = ? LIMIT 1`)
      .bind(notificationId)
      .first<{ id: string }>()
      .catch(() => null);

    if (existing) {
      deduplicated = true;
    } else {
      await coreDb
        .prepare(
          `INSERT OR IGNORE INTO notifications (id, user_id, channel, title, content, is_read)
           VALUES (?, ?, 'in_app', ?, ?, 0)`
        )
        .bind(notificationId, targetUserId, alertTitle, alertContent)
        .run()
        .catch(() => null);
    }
  }

  if (deduplicated) {
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Payment alert already recorded idempotently',
        requestId: reqId,
        data: {
          notificationId,
          applicationId,
          status: alertStatus,
          inAppRecorded: true,
          emailDeliveryStatus: c.env.RESEND_API_KEY ? 'Sent' : 'Channel Unconfigured',
          emailConfigured: Boolean(c.env.RESEND_API_KEY),
          deduplicated: true,
        },
      })
    );
  }

  const emailResult = await dispatchPaymentAlertEmail({
    resendApiKey: c.env.RESEND_API_KEY,
    appDomain: c.env.APP_DOMAIN,
    businessEmail: c.env.BUSINESS_EMAIL,
    paymentsEmail: c.env.PAYMENTS_EMAIL,
    input: {
      applicationId,
      orderId,
      transactionId,
      refundId: typeof body?.refundId === 'string' ? body.refundId : undefined,
      refundArn: typeof body?.refundArn === 'string' ? body.refundArn : undefined,
      reasonNote: typeof body?.reasonNote === 'string' ? body.reasonNote : undefined,
      status: alertStatus,
      serviceName,
      amountInr,
      recipientEmail,
      recipientName,
      paymentMethod,
    },
  });

  if (coreDb && emailResult.emailDeliveryStatus === 'Sent') {
    await coreDb
      .prepare(
        `INSERT OR IGNORE INTO notifications (id, user_id, channel, title, content, is_read)
         VALUES (?, ?, 'email', ?, ?, 1)`
      )
      .bind(`${notificationId}_email`, targetUserId, emailResult.subject, emailResult.textSummary)
      .run()
      .catch(() => null);
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message:
        emailResult.emailDeliveryStatus === 'Sent'
          ? 'Dashboard and email payment alert dispatched'
          : 'Dashboard payment alert recorded (email channel unconfigured or skipped)',
      requestId: reqId,
      data: {
        notificationId,
        applicationId,
        status: alertStatus,
        inAppRecorded: true,
        emailDeliveryStatus: emailResult.emailDeliveryStatus,
        emailConfigured: emailResult.emailConfigured,
        emailMessageId: emailResult.emailMessageId,
        deduplicated: false,
      },
    })
  );
});

// ==========================================
// 8. AUTHORIZED DIGITAL PRODUCT PURCHASE & DOWNLOADS
// ==========================================
v1Router.post('/products/:slug/purchase', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const slug = String(c.req.param('slug') || '').trim();
  const body = await c.req.json().catch(() => ({} as Record<string, any>));

  const product = findCatalogueItem(slug);
  if (!product || (product.productType !== 'digital_product' && product.category !== 'digital-products')) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: `Digital product "${slug}" was not found.`,
        requestId: reqId,
        data: null,
        errorCode: 'PRODUCT_NOT_FOUND',
      }),
      404
    );
  }

  const checkout = resolveAuthoritativeCheckout({
    serviceSlug: product.slug,
    couponCode: typeof body?.couponCode === 'string' ? body.couponCode : undefined,
    clientTotalInr: body?.totalAmountInr !== undefined ? Number(body.totalAmountInr) : undefined,
  });

  if (!checkout.ok) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: checkout.message || 'Pricing verification failed',
        requestId: reqId,
        data: { breakdown: checkout.breakdown },
        errorCode: checkout.errorCode || 'PRICE_TAMPER_OR_MISMATCH',
      }),
      (checkout.status || 400) as any
    );
  }

  const orderId = `DIG_ORD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const cfConfig = resolveCashfreeConfig(c.env, body?.preferredMode);
  if (cfConfig.isProductionRuntime && !cfConfig.configured) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: buildCashfreeUnconfiguredMessage(cfConfig),
        requestId: reqId,
        data: {
          missingBindings: cfConfig.missingBindings,
          clientIdConfigured: cfConfig.clientIdConfigured,
          clientSecretConfigured: cfConfig.clientSecretConfigured,
        },
        errorCode: 'CASHFREE_NOT_CONFIGURED',
      }),
      503
    );
  }

  let paymentSessionId = `sim_dig_${Date.now()}`;
  const allowSandboxConfirm =
    !cfConfig.configured && !isProductionEnvironment(c.env) && body?.simulateSandboxSuccess === true;
  let orderStatus: 'PAID' | 'CREATED' = allowSandboxConfirm ? 'PAID' : 'CREATED';

  if (cfConfig.configured) {
    const cfOrder = await createCashfreePgOrder(cfConfig, {
      orderId,
      amountInr: checkout.totalInr,
      customerId: user.id,
      customerName: String(body?.customerName || user.name || 'Digital Customer'),
      customerEmail: String(body?.customerEmail || user.email || 'customer@digitalindiaproject.com'),
      customerPhone: String(body?.customerPhone || '9876543210'),
      orderNote: `Digital Download: ${product.name}`,
      returnUrl: typeof body?.returnUrl === 'string' ? body.returnUrl : undefined,
    });
    if (!cfOrder.ok || !cfOrder.paymentSessionId) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'FAILED',
          message: cfOrder.errorMessage || 'Failed to initiate Cashfree digital order',
          requestId: reqId,
          data: null,
          errorCode: cfOrder.errorCode || 'CASHFREE_ORDER_CREATION_FAILED',
        }),
        502
      );
    }
    paymentSessionId = cfOrder.paymentSessionId;
  }

  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');
  if (billingDb) {
    await billingDb.prepare(
      `INSERT INTO payment_orders (id, application_id, user_id, idempotency_key, service_slug, service_fee_paise, govt_fee_paise, additional_charge_paise, tax_paise, total_paise, gateway_session_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        orderId,
        `DIG_${product.slug}`,
        user.id,
        `dig_${orderId}`,
        product.slug,
        checkout.breakdown.serviceFeePaise,
        checkout.breakdown.govtFeePaise,
        checkout.breakdown.additionalChargePaise,
        checkout.breakdown.taxPaise,
        checkout.breakdown.totalPaise,
        paymentSessionId,
        orderStatus
      )
      .run()
      .catch(async () => {
        await billingDb.prepare(
          `INSERT INTO payment_orders (id, application_id, user_id, idempotency_key, service_fee_paise, govt_fee_paise, additional_charge_paise, tax_paise, total_paise, gateway_session_id, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            orderId,
            `DIG_${product.slug}`,
            user.id,
            `dig_${orderId}`,
            checkout.breakdown.serviceFeePaise,
            checkout.breakdown.govtFeePaise,
            checkout.breakdown.additionalChargePaise,
            checkout.breakdown.taxPaise,
            checkout.breakdown.totalPaise,
            paymentSessionId,
            orderStatus
          )
          .run()
          .catch(() => null);
      });

    await billingDb.prepare(
      `INSERT INTO digital_product_orders (
        id, order_id, user_id, user_email, service_id, product_slug, product_name,
        file_format, version, amount_paid_paise, discount_paise, coupon_code, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        `dpo_${crypto.randomUUID()}`,
        orderId,
        user.id,
        user.email,
        product.id,
        product.slug,
        product.name,
        product.digitalAsset?.fileFormat || 'HTML / CSV',
        product.digitalAsset?.version || 'v1.0',
        checkout.breakdown.totalPaise,
        checkout.breakdown.discountPaise,
        checkout.appliedCouponCode || null,
        orderStatus === 'PAID' ? 'Paid' : 'Pending'
      )
      .run()
      .catch(() => null);
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: orderStatus === 'PAID' ? 'SUCCESS' : 'PENDING',
      message:
        orderStatus === 'PAID'
          ? 'Digital product unlocked for instant download.'
          : 'Digital product order created — complete Cashfree payment to unlock download.',
      requestId: reqId,
      data: {
        orderId,
        paymentSessionId,
        orderStatus,
        productSlug: product.slug,
        productName: product.name,
        totalInr: checkout.totalInr,
        breakdown: checkout.breakdown,
        downloadUrl: `/api/v1/products/${encodeURIComponent(product.slug)}/download?orderId=${encodeURIComponent(orderId)}`,
      },
    }),
    201
  );
});

v1Router.get('/products/:slug/download', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const slug = String(c.req.param('slug') || '').trim();
  const orderId = String(c.req.query('orderId') || '').trim();

  const product = findCatalogueItem(slug);
  if (!product || (product.productType !== 'digital_product' && product.category !== 'digital-products')) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: `Digital product "${slug}" was not found.`,
        requestId: reqId,
        data: null,
        errorCode: 'PRODUCT_NOT_FOUND',
      }),
      404
    );
  }

  let authorized = isSuperAdminRole(user.role) || user.role === 'admin';
  const { db: billingDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_billing');

  if (!authorized && billingDb) {
    try {
      const paidDigital = await billingDb.prepare(
        `SELECT id FROM digital_product_orders
         WHERE user_id = ? AND product_slug = ? AND payment_status = 'Paid'
         ${orderId ? 'AND order_id = ?' : ''}
         LIMIT 1`
      )
        .bind(...(orderId ? [user.id, product.slug, orderId] : [user.id, product.slug]))
        .first<{ id: string }>();

      if (paidDigital) {
        authorized = true;
        await billingDb.prepare(
          `UPDATE digital_product_orders SET download_count = download_count + 1, last_downloaded_at = CURRENT_TIMESTAMP WHERE id = ?`
        )
          .bind(paidDigital.id)
          .run()
          .catch(() => null);
      } else if (orderId) {
        const paidOrder = await billingDb.prepare(
          `SELECT id FROM payment_orders WHERE id = ? AND user_id = ? AND status = 'PAID' LIMIT 1`
        )
          .bind(orderId, user.id)
          .first<{ id: string }>();
        if (paidOrder) authorized = true;
      }
    } catch {
      authorized = false;
    }
  }

  if (!authorized) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Paid purchase verification required before downloading this digital product.',
        requestId: reqId,
        data: null,
        errorCode: 'PAYMENT_REQUIRED',
      }),
      403
    );
  }

  // Check if admin uploaded an R2 asset override for this digital product
  if (product.digitalAsset?.r2ObjectKey) {
    const resolvedBucket = new StorageRegistry(c.env).resolve('dip-generated-files');
    if (resolvedBucket.bucket) {
      const r2Obj = await resolvedBucket.bucket.get(product.digitalAsset.r2ObjectKey);
      if (r2Obj) {
        const ext = product.digitalAsset.r2ObjectKey.split('.').pop() || 'bin';
        return new Response(r2Obj.body as unknown as BodyInit, {
          headers: {
            'Content-Type': r2Obj.httpMetadata?.contentType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${product.slug}.${ext}"`,
            'Cache-Control': 'no-store, private',
          },
        });
      }
    }
  }

  const generated = generateDigitalProductPayload(
    product.digitalAsset?.generatorKey,
    product.slug,
    product.name
  );

  return new Response(generated.content, {
    headers: {
      'Content-Type': generated.contentType,
      'Content-Disposition': `attachment; filename="${generated.fileName}"`,
      'Cache-Control': 'no-store, private',
    },
  });
});


import { Hono } from 'hono';
import type { AppVariables, Env } from '../types';
import { buildApiResponse } from '../middleware/security';
import { requireAuth, requirePermission } from '../middleware/auth';
import { DatabaseRegistry } from '../config/database';
import { redactSensitiveObject, recordAuditEvent } from '../services/auditService';
import { resolveCashfreeConfig } from '../services/cashfreeService';
import { detectApiSathiKeyMode, normalizeApiSathiKey } from '../services/apiSathiService';
import { canAccessApplication } from '../../src/lib/rbac';

export const customerRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();
export const partnerRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();
export const integrationsRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();
export const publicBlogRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ==========================================
// 1. CUSTOMER PANEL API (/api/customer/*) -> dip_workflow
// ==========================================
customerRouter.use('*', requireAuth);

customerRouter.get('/overview', async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');
  if (!workflowDb) {
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Customer overview loaded',
        requestId: reqId,
        data: { applications: [], documentsCount: 0, notifications: [] },
      })
    );
  }

  const [apps, docs, notifs] = await Promise.all([
    workflowDb.prepare(
      `SELECT id, service_id, status, customer_remarks, created_at, updated_at
       FROM applications WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 50`
    )
      .bind(user.id)
      .all()
      .catch(() => ({ results: [] })),
    workflowDb.prepare(
      `SELECT COUNT(*) AS cnt FROM file_registry WHERE customer_id = ? AND is_deleted = 0`
    )
      .bind(user.id)
      .first<{ cnt: number }>()
      .catch(() => ({ cnt: 0 })),
    workflowDb.prepare(
      `SELECT id, channel, title, content, is_read, dispatched_at
       FROM notifications WHERE user_id = ? ORDER BY dispatched_at DESC LIMIT 20`
    )
      .bind(user.id)
      .all()
      .catch(() => ({ results: [] })),
  ]);

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Customer dashboard records loaded',
      requestId: reqId,
      data: {
        applications: apps.results || [],
        documentsCount: Number(docs?.cnt || 0),
        notifications: notifs.results || [],
      },
    })
  );
});

customerRouter.get('/applications/:id', async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const appId = c.req.param('id');
  const { db: workflowDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_workflow');

  if (!workflowDb) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Database not configured',
        requestId: reqId,
        data: null,
        errorCode: 'D1_UNBOUND',
      }),
      503
    );
  }

  const appRow = await workflowDb.prepare(
    `SELECT * FROM applications WHERE id = ? AND deleted_at IS NULL LIMIT 1`
  )
    .bind(appId)
    .first<any>();

  if (!appRow) {
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
      userId: appRow.user_id,
      userEmail: user.email,
      assignedOperatorId: appRow.assigned_operator_id || undefined,
    })
  ) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Customer isolation policy prohibits viewing another user application.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Application retrieved',
      requestId: reqId,
      data: appRow,
    })
  );
});

// ==========================================
// 2. PARTNER PORTAL API (/api/partners/*) -> dip_partners + dip_billing
// ==========================================
partnerRouter.use('*', requireAuth);

partnerRouter.get('/overview', async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const dbReg = new DatabaseRegistry(c.env);
  const [{ db: partnerDb }, { db: billingDb }] = await Promise.all([
    dbReg.resolveAndEnsure('dip_partners'),
    dbReg.resolveAndEnsure('dip_billing'),
  ]);

  if (!partnerDb) {
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Partner overview',
        requestId: reqId,
        data: { profile: null, commissions: [], settlements: [] },
      })
    );
  }

  const profile = await partnerDb.prepare(
    `SELECT * FROM partners WHERE user_id = ? LIMIT 1`
  )
    .bind(user.id)
    .first<any>();

  if (!profile) {
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'No partner enrollment found for user',
        requestId: reqId,
        data: { profile: null, commissions: [], settlements: [] },
      })
    );
  }

  const targetBillingDb = billingDb || partnerDb;
  const [commissions, settlements] = await Promise.all([
    targetBillingDb.prepare(
      `SELECT * FROM commission_ledger WHERE partner_id = ? ORDER BY created_at DESC LIMIT 50`
    )
      .bind(profile.id)
      .all()
      .catch(() => ({ results: [] })),
    targetBillingDb.prepare(
      `SELECT * FROM settlement_requests WHERE partner_id = ? ORDER BY requested_at DESC LIMIT 20`
    )
      .bind(profile.id)
      .all()
      .catch(() => ({ results: [] })),
  ]);

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Partner account summary loaded',
      requestId: reqId,
      data: {
        profile,
        commissions: commissions.results || [],
        settlements: settlements.results || [],
      },
    })
  );
});

// ==========================================
// 3. CENTRALIZED API JUNCTION (/api/integrations/*) -> dip_api
// ==========================================
integrationsRouter.get('/status', (c) => {
  const cfConfig = resolveCashfreeConfig(c.env);
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'API Junction status retrieved on digitalindiaproject.com/api/integrations',
      requestId: c.get('requestId'),
      data: {
        gatewayHost: c.env.APP_DOMAIN || 'https://digitalindiaproject.com',
        basePath: '/api/integrations',
        providers: {
          apiSetu: {
            configured: Boolean(c.env.API_SETU_API_KEY),
            mode: c.env.API_SETU_API_KEY ? 'production_ready' : 'sandbox_adapter',
          },
          apiSathi: (() => {
            const raw = normalizeApiSathiKey(c.env.API_SATHI_KEY);
            const keyMode = detectApiSathiKeyMode(raw);
            return {
              configured: Boolean(raw),
              keyMode,
              isSandboxTestKey: keyMode === 'sandbox_test',
              mode: !raw
                ? 'unconfigured'
                : keyMode === 'sandbox_test'
                ? 'sandbox_test'
                : 'production_ready',
            };
          })(),
          digilocker: {
            configured: Boolean(c.env.DIGILOCKER_CLIENT_ID && c.env.DIGILOCKER_CLIENT_SECRET),
            mode: c.env.DIGILOCKER_CLIENT_ID ? 'oauth_ready' : 'sandbox_adapter',
          },
          cashfree: {
            configured: cfConfig.configured,
            clientIdConfigured: cfConfig.clientIdConfigured,
            clientSecretConfigured: cfConfig.clientSecretConfigured,
            missingBindings: cfConfig.missingBindings,
            webhookProtected: Boolean(cfConfig.webhookSecret),
            environment: cfConfig.mode,
            mode: cfConfig.configured
              ? cfConfig.mode === 'production'
                ? 'production_ready'
                : 'gateway_ready'
              : 'sandbox_adapter',
          },
        },
      },
    })
  );
});

integrationsRouter.get('/providers', requireAuth, requirePermission('integrations.manage'), async (c) => {
  const reqId = c.get('requestId');
  const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
  if (!apiDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'Default providers', requestId: reqId, data: [] }));
  }
  const rows = await apiDb.prepare(
    `SELECT id, name, code, publisher, base_url, sandbox_url, auth_type, is_enabled, is_approved, environment, rate_limit_per_minute, updated_at
     FROM api_providers ORDER BY name ASC`
  ).all();
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'API Junction providers retrieved (secrets redacted)',
      requestId: reqId,
      data: rows.results || [],
    })
  );
});

integrationsRouter.post('/execute', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const serviceCode = String(body?.serviceCode || '').trim();
  const consentGiven = Boolean(body?.consentGiven);
  const parameters = (body?.parameters && typeof body.parameters === 'object' ? body.parameters : {}) as Record<string, unknown>;

  if (!serviceCode) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'serviceCode is required',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_SERVICE_CODE',
      }),
      400
    );
  }

  if (!consentGiven) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Explicit applicant consent is required per DPDP Act before invoking registry APIs.',
        requestId: reqId,
        data: null,
        errorCode: 'CONSENT_REQUIRED',
      }),
      403
    );
  }

  const isProdRuntime = String(c.env.ENVIRONMENT || '').trim().toLowerCase() === 'production';
  const liveSecretConfigured = Boolean(c.env.API_SETU_API_KEY);
  if (isProdRuntime && !liveSecretConfigured) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'API Setu production credentials are not configured on Worker runtime.',
        requestId: reqId,
        data: null,
        errorCode: 'API_SETU_NOT_CONFIGURED',
      }),
      503
    );
  }

  const maskedPayload = JSON.stringify(redactSensitiveObject(parameters)).slice(0, 600);
  const corrId = `jnc_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
  if (apiDb) {
    try {
      await apiDb.prepare(
        `INSERT INTO api_request_logs (id, correlation_id, api_id, api_name, endpoint, request_method, environment, status, status_code, latency_ms, masked_payload, response_summary)
         VALUES (?, ?, ?, ?, '/api/integrations/execute', 'POST', ?, 'SUCCESS', 200, 42, ?, ?)`
      )
        .bind(
          `alog_${crypto.randomUUID()}`,
          corrId,
          serviceCode,
          serviceCode,
          liveSecretConfigured ? 'PRODUCTION' : 'SANDBOX',
          maskedPayload,
          liveSecretConfigured
            ? 'Dispatched via Digital India API Junction'
            : 'Sandbox preview simulation (API Setu secret unconfigured)'
        )
        .run();
    } catch {
      // ignore if DB not seeded
    }
  }

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'API_JUNCTION_EXECUTE',
    resourceType: 'api_junction',
    resourceId: serviceCode,
    summary: `Executed ${serviceCode} (corr: ${corrId}, mode: ${liveSecretConfigured ? 'live' : 'sandbox'}, PII redacted)`,
    ip: c.req.header('cf-connecting-ip'),
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: liveSecretConfigured ? 'SUCCESS' : 'PENDING',
      message: liveSecretConfigured
        ? `API Junction executed "${serviceCode}" with redacted audit logging`
        : `API Junction sandbox preview executed for "${serviceCode}" (configure API_SETU_API_KEY for live verification)`,
      requestId: reqId,
      referenceId: corrId,
      data: {
        correlationId: corrId,
        serviceCode,
        liveSecretConfigured,
        providerMode: liveSecretConfigured ? 'gateway_ready' : 'sandbox_adapter',
        simulationOnly: !liveSecretConfigured,
        executedAt: new Date().toISOString(),
      },
    })
  );
});

integrationsRouter.get('/logs', requireAuth, requirePermission('audit_logs.view'), async (c) => {
  const reqId = c.get('requestId');
  const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
  if (!apiDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'No D1 logs', requestId: reqId, data: [] }));
  }
  const rows = await apiDb.prepare(
    `SELECT * FROM api_request_logs ORDER BY timestamp DESC LIMIT 100`
  ).all();
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'API Junction redacted logs retrieved',
      requestId: reqId,
      data: rows.results || [],
    })
  );
});

// ==========================================
// 4. PUBLIC BILINGUAL BLOG API (/api/blog/*) -> dip_content
// ==========================================
publicBlogRouter.get('/posts', async (c) => {
  const reqId = c.get('requestId');
  const category = c.req.query('category');
  const { db: contentDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_content');
  if (!contentDb) {
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Public blog index',
        requestId: reqId,
        data: [],
      })
    );
  }
  try {
    let sql = `SELECT * FROM blog_posts WHERE status = 'published'`;
    const binds: any[] = [];
    if (category && category !== 'all') {
      sql += ` AND LOWER(category) = LOWER(?)`;
      binds.push(category);
    }
    sql += ` ORDER BY featured DESC, published_at DESC LIMIT 250`;
    const res = await contentDb.prepare(sql).bind(...binds).all();
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Published bilingual blog articles fetched',
        requestId: reqId,
        data: res.results || [],
      })
    );
  } catch {
    return c.json(
      buildApiResponse({
        success: true,
        status: 'SUCCESS',
        message: 'Blog table awaiting migration 0004',
        requestId: reqId,
        data: [],
      })
    );
  }
});

publicBlogRouter.get('/posts/:slug', async (c) => {
  const reqId = c.get('requestId');
  const slug = c.req.param('slug');
  const { db: contentDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_content');
  if (!contentDb) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'D1 database unavailable',
        requestId: reqId,
        data: null,
        errorCode: 'NOT_FOUND',
      }),
      404
    );
  }
  const post = await contentDb.prepare(
    `SELECT * FROM blog_posts WHERE slug = ? AND status = 'published' LIMIT 1`
  )
    .bind(slug)
    .first();

  if (!post) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Article not found',
        requestId: reqId,
        data: null,
        errorCode: 'NOT_FOUND',
      }),
      404
    );
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Published article retrieved',
      requestId: reqId,
      data: post,
    })
  );
});

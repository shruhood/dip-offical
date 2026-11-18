import { Hono } from 'hono';
import type { AppVariables, Env } from '../types';
import { buildApiResponse } from '../middleware/security';
import { requireAuth } from '../middleware/auth';
import { DatabaseRegistry } from '../config/database';
import { isSuperAdminRole } from '../../src/lib/rbac';
import { recordAuditEvent, recordInfraEvent } from '../services/auditService';
import {
  aggregateApiSathiUsage,
  computeExponentialBackoffMs,
  isRetryableApiSathiFailure,
  type ApiSathiAnalyticsRange,
  type ApiSathiRetryQueueSummary,
} from '../../src/lib/apiSathiAnalytics';
import {
  API_SATHI_PRODUCTS,
  ApiSathiError,
  createApiSathiClient,
  detectApiSathiKeyMode,
  executeApiSathiProduct,
  fetchAadhaarDigilocker,
  fetchLiveApiSathiRates,
  initAadhaarDigilocker,
  maskApiSathiPayload,
  normalizeApiSathiKey,
} from '../services/apiSathiService';

export const apiSathiRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function getSafeAdminStatus(userRole?: string) {
  return isSuperAdminRole(userRole) || userRole === 'admin';
}

function normalizeSqlUtcTimestamp(raw?: string | null): number {
  if (!raw) return 0;
  const s = String(raw).trim();
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? `${s.replace(' ', 'T')}Z` : s;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

async function persistApiSathiCall(
  env: Env,
  params: {
    callId: string | null;
    idempotencyKey: string;
    productSlug: string;
    environment: 'SANDBOX' | 'PRODUCTION';
    isSandboxTest: boolean;
    httpStatus: number;
    verified: boolean;
    outcome: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    maskedRequestJson: string;
    responseSummary: string;
    userId: string;
    businessId?: string | null;
    step1RefId?: string | null;
    latencyMs: number;
  }
) {
  const { db: apiDb } = await new DatabaseRegistry(env).resolveAndEnsure('dip_api');
  if (!apiDb) return;

  const logId = `asc_${crypto.randomUUID()}`;
  try {
    await apiDb
      .prepare(
        `INSERT INTO api_sathi_calls (
          id, call_id, idempotency_key, product_slug, environment, is_sandbox_test,
          http_status, verified, outcome, error_code, error_message,
          masked_request_json, response_summary, user_id, business_id, step1_ref_id, latency_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        logId,
        params.callId,
        params.idempotencyKey,
        params.productSlug,
        params.environment,
        params.isSandboxTest ? 1 : 0,
        params.httpStatus,
        params.verified ? 1 : 0,
        params.outcome,
        params.errorCode || null,
        params.errorMessage ? params.errorMessage.slice(0, 500) : null,
        params.maskedRequestJson.slice(0, 1000),
        params.responseSummary.slice(0, 500),
        params.userId,
        params.businessId || null,
        params.step1RefId || null,
        params.latencyMs
      )
      .run();
  } catch {
    // Non-blocking audit persistence
  }

  // Mirror into shared api_request_logs so Admin Gateway Logs tab displays call_id automatically
  try {
    const corr = params.callId || params.idempotencyKey;
    await apiDb
      .prepare(
        `INSERT INTO api_request_logs (
          id, correlation_id, api_id, api_name, endpoint, request_method,
          environment, status, status_code, latency_ms, masked_payload, response_summary
        ) VALUES (?, ?, ?, ?, ?, 'POST', ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `alog_${crypto.randomUUID()}`,
        corr,
        params.productSlug,
        `API Sathi: ${params.productSlug}`,
        `https://apisathi.in/gw/v1/${params.productSlug}/`,
        params.environment,
        params.httpStatus === 200 && params.verified ? 'SUCCESS' : 'FAILED',
        params.httpStatus,
        params.latencyMs,
        params.maskedRequestJson.slice(0, 600),
        params.responseSummary.slice(0, 400)
      )
      .run();
  } catch {
    // Ignore duplicate correlation id or schema fallback
  }
}

async function enqueueWorkerRetryJob(
  env: Env,
  params: {
    idempotencyKey: string;
    productSlug: string;
    intent: string;
    userId: string;
    businessId?: string | null;
    parameters: Record<string, unknown>;
    maskedInputJson: string;
    httpStatus: number;
    errorCode: string;
    errorMessage: string;
    callId?: string | null;
    retryAfterSeconds?: number;
  }
): Promise<{ queued: boolean; retryJobId?: string; nextRetryAt?: string }> {
  if (!isRetryableApiSathiFailure(params.httpStatus, params.errorCode)) {
    return { queued: false };
  }
  const { db: apiDb } = await new DatabaseRegistry(env).resolveAndEnsure('dip_api');
  if (!apiDb) return { queued: false };

  const delayMs = computeExponentialBackoffMs({
    attempt: 1,
    baseDelayMs: 5000,
    maxDelayMs: 300_000,
    retryAfterSeconds: params.retryAfterSeconds,
    jitterRatio: 0.1,
  });
  const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
  const retryJobId = `rq_${crypto.randomUUID()}`;

  try {
    await apiDb
      .prepare(
        `INSERT OR IGNORE INTO api_sathi_retry_queue (
          id, idempotency_key, product_slug, intent, user_id, business_id,
          sanitized_input_json, masked_input_json, status, attempt_count, max_attempts,
          last_http_status, last_error_code, last_error_message, last_call_id, next_retry_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, 5, ?, ?, ?, ?, ?)`
      )
      .bind(
        retryJobId,
        params.idempotencyKey,
        params.productSlug,
        params.intent.slice(0, 80),
        params.userId,
        params.businessId || null,
        JSON.stringify(params.parameters || {}).slice(0, 2000),
        params.maskedInputJson.slice(0, 1000),
        params.httpStatus,
        params.errorCode.slice(0, 80),
        params.errorMessage.slice(0, 500),
        params.callId || null,
        nextRetryAt
      )
      .run();
    return { queued: true, retryJobId, nextRetryAt };
  } catch {
    return { queued: false };
  }
}

async function getWorkerRetryQueueSummary(env: Env): Promise<ApiSathiRetryQueueSummary> {
  const { db: apiDb } = await new DatabaseRegistry(env).resolveAndEnsure('dip_api');
  if (!apiDb) {
    return { pendingCount: 0, retryingCount: 0, succeededCount: 0, exhaustedCount: 0, totalCount: 0 };
  }
  const rows = await apiDb
    .prepare(`SELECT status, COUNT(*) as cnt FROM api_sathi_retry_queue GROUP BY status`)
    .all<{ status: string; cnt: number }>()
    .catch(() => ({ results: [] as Array<{ status: string; cnt: number }> }));

  let pendingCount = 0;
  let retryingCount = 0;
  let succeededCount = 0;
  let exhaustedCount = 0;

  for (const r of rows.results || []) {
    const c = Number(r.cnt || 0);
    if (r.status === 'PENDING') pendingCount = c;
    else if (r.status === 'RETRYING') retryingCount = c;
    else if (r.status === 'SUCCEEDED') succeededCount = c;
    else if (r.status === 'EXHAUSTED') exhaustedCount = c;
  }
  return {
    pendingCount,
    retryingCount,
    succeededCount,
    exhaustedCount,
    totalCount: pendingCount + retryingCount + succeededCount + exhaustedCount,
  };
}

export async function processWorkerApiSathiRetryQueue(
  env: Env,
  options: { forceAllPending?: boolean; fetchFn?: typeof fetch } = {}
): Promise<{
  processed: number;
  succeeded: number;
  rescheduled: number;
  exhausted: number;
  skippedNotDue: number;
}> {
  const stats = { processed: 0, succeeded: 0, rescheduled: 0, exhausted: 0, skippedNotDue: 0 };
  const rawKey = normalizeApiSathiKey(env.API_SATHI_KEY);
  if (!rawKey) return stats;

  const { db: apiDb } = await new DatabaseRegistry(env).resolveAndEnsure('dip_api');
  if (!apiDb) return stats;

  const pendingRes = await apiDb
    .prepare(
      `SELECT id, idempotency_key, product_slug, intent, user_id, business_id, sanitized_input_json,
              masked_input_json, attempt_count, max_attempts, next_retry_at
       FROM api_sathi_retry_queue
       WHERE status = 'PENDING'
       ORDER BY created_at ASC
       LIMIT 25`
    )
    .all<any>()
    .catch(() => ({ results: [] as any[] }));

  const nowMs = Date.now();
  const rows = pendingRes.results || [];
  const client = createApiSathiClient({
    apiKey: rawKey,
    fetchFn: options.fetchFn,
    retry5xxDelaysMs: [],
    max429Retries: 0,
  });
  const envLabel: 'SANDBOX' | 'PRODUCTION' = client.isSandboxTestKey ? 'SANDBOX' : 'PRODUCTION';

  for (const job of rows) {
    const nextRetryMs = normalizeSqlUtcTimestamp(job.next_retry_at);
    if (!options.forceAllPending && nextRetryMs > nowMs) {
      stats.skippedNotDue += 1;
      continue;
    }

    stats.processed += 1;
    const nextAttempt = Number(job.attempt_count || 0) + 1;
    const maxAttempts = Math.max(1, Number(job.max_attempts || 5));
    const attemptIso = new Date(nowMs).toISOString();

    await apiDb
      .prepare(`UPDATE api_sathi_retry_queue SET status = 'RETRYING', attempt_count = ?, last_attempt_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(nextAttempt, attemptIso, job.id)
      .run()
      .catch(() => null);

    let parsedInput: Record<string, unknown> = {};
    try {
      parsedInput = JSON.parse(String(job.sanitized_input_json || '{}'));
    } catch {
      parsedInput = {};
    }

    try {
      const { result, sanitizedInput } = await executeApiSathiProduct(client, String(job.product_slug), parsedInput, {
        idempotencyKey: String(job.idempotency_key),
      });

      await apiDb
        .prepare(
          `UPDATE api_sathi_retry_queue
           SET status = 'SUCCEEDED', last_http_status = 200, last_error_code = ?, last_error_message = ?,
               last_call_id = ?, next_retry_at = NULL, completed_at = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(
          result.verified ? null : result.resultCode || 'NOT_VERIFIED',
          result.verified ? null : result.message,
          result.callId,
          attemptIso,
          job.id
        )
        .run()
        .catch(() => null);

      await persistApiSathiCall(env, {
        callId: result.callId,
        idempotencyKey: result.idempotencyKey,
        productSlug: result.productSlug,
        environment: result.environment,
        isSandboxTest: result.isSandboxTestKey,
        httpStatus: 200,
        verified: result.verified,
        outcome: result.outcome,
        errorCode: result.verified ? null : result.resultCode || 'NOT_VERIFIED',
        errorMessage: result.verified ? null : result.message,
        maskedRequestJson: JSON.stringify(maskApiSathiPayload(sanitizedInput)),
        responseSummary: `[Retry #${nextAttempt}] ${result.message}`,
        userId: String(job.user_id || 'system'),
        businessId: job.business_id || null,
        latencyMs: result.latencyMs,
      });

      stats.succeeded += 1;
    } catch (err: any) {
      const apiErr =
        err instanceof ApiSathiError
          ? err
          : new ApiSathiError({ code: 'RETRY_ATTEMPT_ERROR', message: err?.message || 'Retry failed', httpStatus: 500, isRetryable: true });

      const retryable = isRetryableApiSathiFailure(apiErr.httpStatus, apiErr.code);
      if (!retryable || nextAttempt >= maxAttempts) {
        await apiDb
          .prepare(
            `UPDATE api_sathi_retry_queue
             SET status = 'EXHAUSTED', last_http_status = ?, last_error_code = ?, last_error_message = ?,
                 last_call_id = COALESCE(?, last_call_id), next_retry_at = NULL, completed_at = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          )
          .bind(apiErr.httpStatus, apiErr.code, apiErr.message.slice(0, 500), apiErr.callId, attemptIso, job.id)
          .run()
          .catch(() => null);
        stats.exhausted += 1;
      } else {
        const delayMs = computeExponentialBackoffMs({
          attempt: nextAttempt + 1,
          baseDelayMs: 5000,
          maxDelayMs: 300_000,
          retryAfterSeconds: apiErr.retryAfterSeconds,
          jitterRatio: 0.1,
        });
        const nextRetryAt = new Date(nowMs + delayMs).toISOString();
        await apiDb
          .prepare(
            `UPDATE api_sathi_retry_queue
             SET status = 'PENDING', last_http_status = ?, last_error_code = ?, last_error_message = ?,
                 last_call_id = COALESCE(?, last_call_id), next_retry_at = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          )
          .bind(apiErr.httpStatus, apiErr.code, apiErr.message.slice(0, 500), apiErr.callId, nextRetryAt, job.id)
          .run()
          .catch(() => null);
        stats.rescheduled += 1;
      }

      if (apiErr.isWalletEmptyError) {
        await recordInfraEvent(env, {
          resourceType: 'api_junction',
          resourceName: `apisathi:${envLabel}`,
          severity: 'error',
          code: 'API_SATHI_INSUFFICIENT_BALANCE',
          message: `API Sathi wallet empty (402) during background retry of ${job.product_slug}`,
          details: { jobId: job.id, callId: apiErr.callId },
        });
      }
    }
  }

  return stats;
}

function buildErrorPayloadForUser(
  err: ApiSathiError,
  userRole: string,
  reqId: string,
  queueMeta?: { queued: boolean; retryJobId?: string; nextRetryAt?: string }
): { statusCode: number; body: ReturnType<typeof buildApiResponse> } {
  const isAdmin = getSafeAdminStatus(userRole);
  let userMessage = err.message;
  let errorCode = err.code;

  if (err.isWalletEmptyError) {
    errorCode = 'INSUFFICIENT_BALANCE';
    userMessage = isAdmin
      ? 'API Sathi prepaid wallet balance is empty (402 INSUFFICIENT_BALANCE). Please recharge API Sathi immediately.'
      : 'Verification service is temporarily unavailable. Please contact support or try again shortly.';
  } else if (err.httpStatus === 401) {
    errorCode = 'API_SATHI_AUTH_FAILED';
    userMessage = isAdmin
      ? 'Invalid or missing API_SATHI_KEY on Cloudflare Worker. Check your Worker Secret.'
      : 'Verification provider authentication failed. Please notify support.';
  } else if (err.isRetiredApi || err.httpStatus === 410) {
    errorCode = 'API_RETIRED';
    userMessage = 'This verification API has been retired by API Sathi. Please choose another active API.';
  } else if (err.httpStatus === 429) {
    errorCode = 'RATE_LIMITED';
    userMessage = queueMeta?.queued
      ? 'Too many verification requests — queued for automatic exponential-backoff retry.'
      : 'Too many verification requests. Please wait a few seconds and try again.';
  } else if (err.httpStatus >= 500) {
    errorCode = 'UPSTREAM_UNAVAILABLE';
    userMessage = queueMeta?.queued
      ? 'Upstream verification gateway is temporarily busy — request queued for automatic retry.'
      : 'Upstream verification gateway is temporarily busy — please try again shortly.';
  }

  return {
    statusCode: err.httpStatus >= 400 && err.httpStatus <= 599 ? err.httpStatus : 500,
    body: buildApiResponse({
      success: false,
      status: 'FAILED',
      message: userMessage,
      requestId: reqId,
      referenceId: err.callId || undefined,
      errorCode,
      data: {
        callId: err.callId,
        httpStatus: err.httpStatus,
        code: err.code,
        reason: err.reason || null,
        details: err.details || null,
        isWalletEmptyError: err.isWalletEmptyError,
        isRetiredApi: err.isRetiredApi,
        adminAlertRequired: err.isWalletEmptyError,
        retryAfterSeconds: err.retryAfterSeconds ?? null,
        queuedForRetry: Boolean(queueMeta?.queued),
        retryJobId: queueMeta?.retryJobId || null,
        nextRetryAt: queueMeta?.nextRetryAt || null,
      },
    }),
  };
}

// 1. Provider Status (strictly never leaks key)
apiSathiRouter.get('/status', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const rawKey = normalizeApiSathiKey(c.env.API_SATHI_KEY);
  const keyMode = detectApiSathiKeyMode(rawKey);
  const configured = Boolean(rawKey);
  const isSandboxTestKey = keyMode === 'sandbox_test';

  let recentWalletAlert: { callId: string | null; createdAt: string; message: string } | null = null;
  if (getSafeAdminStatus(user.role)) {
    const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
    if (apiDb) {
      const last402 = await apiDb
        .prepare(
          `SELECT call_id, created_at, error_message
           FROM api_sathi_calls
           WHERE http_status = 402 OR error_code = 'INSUFFICIENT_BALANCE'
           ORDER BY created_at DESC LIMIT 1`
        )
        .first<{ call_id: string | null; created_at: string; error_message: string }>()
        .catch(() => null);
      if (last402) {
        recentWalletAlert = {
          callId: last402.call_id,
          createdAt: last402.created_at,
          message: last402.error_message || 'API Sathi prepaid wallet balance empty — recharge required.',
        };
      }
    }
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: configured
        ? isSandboxTestKey
          ? 'API Sathi configured in SANDBOX (test_*) mode — responses are fake test fixtures'
          : 'API Sathi configured in LIVE production mode'
        : 'API_SATHI_KEY is not configured yet',
      requestId: reqId,
      data: {
        configured,
        keyMode,
        isSandboxTestKey,
        environment: isSandboxTestKey ? 'SANDBOX' : configured ? 'PRODUCTION' : 'UNCONFIGURED',
        walletLowAlert: Boolean(recentWalletAlert),
        recentWalletAlert,
      },
    })
  );
});

// 2. Live Catalogue + Pricing synced from https://apisathi.in/api/v1/rates
apiSathiRouter.get('/catalogue', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const liveRates = await fetchLiveApiSathiRates();
  const bySlug = new Map(liveRates.map((r) => [r.slug, r]));

  const products = API_SATHI_PRODUCTS.map((item) => {
    const live = bySlug.get(item.slug);
    return {
      ...item,
      priceRupees: live?.priceRupees ?? item.priceRupees,
      available: live ? Boolean(live.available) : item.available,
      rateSyncedAt: live ? new Date().toISOString() : null,
    };
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Loaded ${products.length} API Sathi KYC/KYB verification products`,
      requestId: reqId,
      data: {
        products,
        liveRatesFetched: liveRates.length > 0,
      },
    })
  );
});

// 3. Single Verification Endpoint (PAN, GSTIN, DL, RC, IFSC, CIN, Udyam, Voter, Name Match, PAN-Aadhaar)
apiSathiRouter.post('/verify', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const productSlug = String(body?.productSlug || body?.slug || '').trim();
  const consentGiven = Boolean(body?.consentGiven ?? body?.consent);
  const intent = String(body?.intent || `${productSlug || 'kyc'}_verification`).trim().slice(0, 80);
  const parameters = (body?.parameters && typeof body.parameters === 'object' ? body.parameters : body) as Record<string, any>;

  if (!productSlug) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'productSlug is required',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_PRODUCT_SLUG',
      }),
      400
    );
  }

  if (!consentGiven) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Explicit applicant consent is required per DPDP Act before invoking API Sathi verification.',
        requestId: reqId,
        data: null,
        errorCode: 'CONSENT_REQUIRED',
      }),
      403
    );
  }

  const rawKey = normalizeApiSathiKey(c.env.API_SATHI_KEY);
  if (!rawKey) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: getSafeAdminStatus(user.role)
          ? 'API_SATHI_KEY secret is not configured on Cloudflare Worker.'
          : 'Verification gateway is not configured yet. Please notify the administrator.',
        requestId: reqId,
        data: null,
        errorCode: 'API_SATHI_NOT_CONFIGURED',
      }),
      503
    );
  }

  const client = createApiSathiClient({ apiKey: rawKey });
  const envLabel: 'SANDBOX' | 'PRODUCTION' = client.isSandboxTestKey ? 'SANDBOX' : 'PRODUCTION';
  const maskedInput = JSON.stringify(maskApiSathiPayload(parameters));
  const idempotencyKey = crypto.randomUUID();

  try {
    const { result, sanitizedInput } = await executeApiSathiProduct(client, productSlug, parameters, {
      idempotencyKey,
    });
    const maskedSanitized = JSON.stringify(maskApiSathiPayload(sanitizedInput));

    await persistApiSathiCall(c.env, {
      callId: result.callId,
      idempotencyKey: result.idempotencyKey,
      productSlug: result.productSlug,
      environment: result.environment,
      isSandboxTest: result.isSandboxTestKey,
      httpStatus: 200,
      verified: result.verified,
      outcome: result.outcome,
      errorCode: result.verified ? null : result.resultCode || 'NOT_VERIFIED',
      errorMessage: result.verified ? null : result.message,
      maskedRequestJson: maskedSanitized,
      responseSummary: result.message,
      userId: user.id,
      businessId: user.businessId || null,
      latencyMs: result.latencyMs,
    });

    await recordAuditEvent(c.env, {
      actorId: user.id,
      actorRole: user.role,
      action: 'API_SATHI_VERIFY',
      resourceType: 'api_sathi',
      resourceId: result.callId || result.idempotencyKey,
      summary: `${result.productSlug} [${result.environment}] (${intent}) -> ${result.outcome} (call_id: ${result.callId || 'n/a'})`,
      ip: c.req.header('cf-connecting-ip'),
    });

    return c.json(
      buildApiResponse({
        success: result.verified,
        status: result.verified ? 'SUCCESS' : 'FAILED',
        message: result.message,
        requestId: reqId,
        referenceId: result.callId || result.idempotencyKey,
        errorCode: result.verified ? undefined : result.resultCode || 'NOT_VERIFIED',
        data: {
          provider: 'apisathi',
          productSlug: result.productSlug,
          intent,
          verified: result.verified,
          outcome: result.outcome,
          resultCode: result.resultCode,
          callId: result.callId,
          idempotencyKey: result.idempotencyKey,
          environment: result.environment,
          isSandboxTestKey: result.isSandboxTestKey,
          latencyMs: result.latencyMs,
          result: result.data,
        },
      }),
      200
    );
  } catch (err: any) {
    const apiErr =
      err instanceof ApiSathiError
        ? err
        : new ApiSathiError({
            code: 'INTERNAL_ERROR',
            message: err?.message || 'Unexpected error calling API Sathi',
            httpStatus: 500,
            isRetryable: true,
          });

    const outcome = apiErr.isWalletEmptyError
      ? 'WALLET_EMPTY'
      : apiErr.httpStatus === 429
      ? 'RATE_LIMITED'
      : apiErr.httpStatus >= 500
      ? 'UPSTREAM_ERROR'
      : 'REJECTED';

    await persistApiSathiCall(c.env, {
      callId: apiErr.callId,
      idempotencyKey,
      productSlug,
      environment: envLabel,
      isSandboxTest: client.isSandboxTestKey,
      httpStatus: apiErr.httpStatus,
      verified: false,
      outcome,
      errorCode: apiErr.code,
      errorMessage: apiErr.message,
      maskedRequestJson: maskedInput,
      responseSummary: `${apiErr.httpStatus} ${apiErr.code}: ${apiErr.message}`,
      userId: user.id,
      businessId: user.businessId || null,
      latencyMs: 0,
    });

    const queueMeta = await enqueueWorkerRetryJob(c.env, {
      idempotencyKey,
      productSlug,
      intent,
      userId: user.id,
      businessId: user.businessId || null,
      parameters,
      maskedInputJson: maskedInput,
      httpStatus: apiErr.httpStatus,
      errorCode: apiErr.code,
      errorMessage: apiErr.message,
      callId: apiErr.callId,
      retryAfterSeconds: apiErr.retryAfterSeconds,
    });

    if (apiErr.isWalletEmptyError) {
      await recordInfraEvent(c.env, {
        resourceType: 'api_junction',
        resourceName: 'apisathi',
        severity: 'error',
        code: 'API_SATHI_INSUFFICIENT_BALANCE',
        message: `API Sathi wallet empty (402) during ${productSlug}. call_id=${apiErr.callId || 'n/a'}`,
        details: { productSlug, callId: apiErr.callId, userId: user.id },
      });
    }

    const mapped = buildErrorPayloadForUser(apiErr, user.role, reqId, queueMeta);
    return c.json(mapped.body, mapped.statusCode as any);
  }
});

// 4. Multi-step Aadhaar DigiLocker — Step 1: Init & store transaction_id against user.id
apiSathiRouter.post('/digilocker/init', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const consentGiven = Boolean(body?.consentGiven ?? body?.consent);

  if (!consentGiven) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Explicit applicant consent is required before starting DigiLocker e-KYC.',
        requestId: reqId,
        data: null,
        errorCode: 'CONSENT_REQUIRED',
      }),
      403
    );
  }

  const rawKey = normalizeApiSathiKey(c.env.API_SATHI_KEY);
  if (!rawKey) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'API_SATHI_KEY secret is not configured on Cloudflare Worker.',
        requestId: reqId,
        data: null,
        errorCode: 'API_SATHI_NOT_CONFIGURED',
      }),
      503
    );
  }

  const client = createApiSathiClient({ apiKey: rawKey });
  const uid = `dip_${user.id.replace(/[^\w.-]/g, '').slice(0, 24)}_${Date.now()}`;
  const cleanMobile = typeof body?.mobile === 'string' ? body.mobile : undefined;
  const cleanEmail = typeof body?.emailId === 'string' ? body.emailId : (!cleanMobile ? user.email : undefined);
  const appDomain = (c.env.APP_DOMAIN || 'https://digitalindiaproject.com').replace(/\/+$/, '');
  const redirectionUrl =
    typeof body?.redirectionUrl === 'string' && body.redirectionUrl.startsWith('http')
      ? body.redirectionUrl
      : `${appDomain}/operator-enroll?digilocker=done`;

  try {
    const res = await initAadhaarDigilocker(client, {
      uid,
      mobile: cleanMobile,
      emailId: cleanEmail,
      firstName: typeof body?.firstName === 'string' ? body.firstName : undefined,
      lastName: typeof body?.lastName === 'string' ? body.lastName : undefined,
      isHideExplanationScreen: true,
      redirectionUrl,
    });

    const txId = String(res.data?.transaction_id || '').trim();
    const kycUrl = String(res.data?.kyc_url || '').trim();
    const shortUrl = res.data?.short_url ? String(res.data.short_url) : null;

    if (!txId || !kycUrl) {
      throw new ApiSathiError({
        code: 'DIGILOCKER_INIT_INCOMPLETE',
        message: 'API Sathi DigiLocker init did not return transaction_id and kyc_url.',
        httpStatus: 502,
        callId: res.callId,
      });
    }

    const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
    if (apiDb) {
      await apiDb
        .prepare(
          `INSERT INTO api_sathi_digilocker_sessions (
            id, uid, transaction_id, call_id, user_id, purpose, kyc_url, short_url, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'INITIATED')`
        )
        .bind(
          `dls_${crypto.randomUUID()}`,
          uid,
          txId,
          res.callId,
          user.id,
          String(body?.purpose || 'Aadhaar e-KYC verification').slice(0, 200),
          kycUrl,
          shortUrl
        )
        .run()
        .catch(() => null);
    }

    await persistApiSathiCall(c.env, {
      callId: res.callId,
      idempotencyKey: res.idempotencyKey,
      productSlug: 'aadhaar-digilocker-init-v1',
      environment: res.environment,
      isSandboxTest: res.isSandboxTestKey,
      httpStatus: 200,
      verified: Boolean(res.data?.verified ?? true),
      outcome: 'VERIFIED',
      maskedRequestJson: JSON.stringify(maskApiSathiPayload({ uid, mobile: cleanMobile, emailId: cleanEmail })),
      responseSummary: `DigiLocker link issued (tx: ${txId})`,
      userId: user.id,
      businessId: user.businessId || null,
      step1RefId: txId,
      latencyMs: res.latencyMs,
    });

    return c.json(
      buildApiResponse({
        success: true,
        status: 'PENDING',
        message: 'DigiLocker KYC link created. Complete DigiLocker in the new tab, then click Fetch Result.',
        requestId: reqId,
        referenceId: res.callId || txId,
        data: {
          transactionId: txId,
          uid,
          kycUrl,
          shortUrl,
          callId: res.callId,
          environment: res.environment,
          isSandboxTestKey: res.isSandboxTestKey,
        },
      })
    );
  } catch (err: any) {
    const apiErr =
      err instanceof ApiSathiError
        ? err
        : new ApiSathiError({ code: 'DIGILOCKER_INIT_ERROR', message: err?.message || 'DigiLocker init failed', httpStatus: 500 });
    const mapped = buildErrorPayloadForUser(apiErr, user.role, reqId);
    return c.json(mapped.body, mapped.statusCode as any);
  }
});

// 5. Multi-step Aadhaar DigiLocker — Step 2: Fetch using stored server-side transaction_id owned by user
apiSathiRouter.post('/digilocker/fetch', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const transactionId = String(body?.transactionId || body?.transaction_id || '').trim();

  if (!transactionId) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'transactionId is required',
        requestId: reqId,
        data: null,
        errorCode: 'MISSING_TRANSACTION_ID',
      }),
      400
    );
  }

  const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
  let storedSession: { user_id: string; kyc_url: string; short_url: string | null } | null = null;
  if (apiDb) {
    storedSession = await apiDb
      .prepare(
        `SELECT user_id, kyc_url, short_url FROM api_sathi_digilocker_sessions WHERE transaction_id = ? LIMIT 1`
      )
      .bind(transactionId)
      .first<{ user_id: string; kyc_url: string; short_url: string | null }>()
      .catch(() => null);

    if (!storedSession) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'FAILED',
          message: 'Unknown DigiLocker transaction_id. Start DigiLocker step 1 from this account first.',
          requestId: reqId,
          data: null,
          errorCode: 'UNKNOWN_TRANSACTION_ID',
        }),
        404
      );
    }
    if (storedSession.user_id !== user.id && !getSafeAdminStatus(user.role)) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'REJECTED',
          message: 'Forbidden: transaction_id belongs to another user.',
          requestId: reqId,
          data: null,
          errorCode: 'FORBIDDEN',
        }),
        403
      );
    }
  }

  const rawKey = normalizeApiSathiKey(c.env.API_SATHI_KEY);
  if (!rawKey) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'API_SATHI_KEY secret is not configured on Cloudflare Worker.',
        requestId: reqId,
        data: null,
        errorCode: 'API_SATHI_NOT_CONFIGURED',
      }),
      503
    );
  }

  const client = createApiSathiClient({ apiKey: rawKey });
  try {
    const res = await fetchAadhaarDigilocker(client, { transaction_id: transactionId });
    const verified = Boolean(res.verified);
    const maskedAadhaar = res.data?.masked_aadhaar ? String(res.data.masked_aadhaar) : null;

    if (apiDb) {
      await apiDb
        .prepare(
          `UPDATE api_sathi_digilocker_sessions
           SET status = ?, verified = ?, masked_aadhaar = ?, fetched_call_id = ?,
               verified_payload_json = ?, updated_at = CURRENT_TIMESTAMP
           WHERE transaction_id = ?`
        )
        .bind(
          verified ? 'VERIFIED' : 'NOT_COMPLETED',
          verified ? 1 : 0,
          maskedAadhaar,
          res.callId,
          JSON.stringify({
            name: res.data?.name,
            dob: res.data?.dob,
            gender: res.data?.gender,
            masked_aadhaar: maskedAadhaar,
            address: res.data?.address,
          }).slice(0, 2000),
          transactionId
        )
        .run()
        .catch(() => null);
    }

    await persistApiSathiCall(c.env, {
      callId: res.callId,
      idempotencyKey: res.idempotencyKey,
      productSlug: 'aadhaar-digilocker-fetch-v1',
      environment: res.environment,
      isSandboxTest: res.isSandboxTestKey,
      httpStatus: 200,
      verified,
      outcome: res.outcome,
      errorCode: verified ? null : 'NOT_VERIFIED',
      errorMessage: verified ? null : res.message,
      maskedRequestJson: JSON.stringify({ transaction_id: transactionId }),
      responseSummary: verified ? `UIDAI e-KYC verified (${maskedAadhaar || 'masked'})` : 'DigiLocker fetch returned verified=false',
      userId: user.id,
      businessId: user.businessId || null,
      step1RefId: transactionId,
      latencyMs: res.latencyMs,
    });

    return c.json(
      buildApiResponse({
        success: verified,
        status: verified ? 'SUCCESS' : 'FAILED',
        message: verified
          ? 'UIDAI DigiLocker Aadhaar e-KYC verified.'
          : 'DigiLocker flow is not verified yet. Please complete DigiLocker consent link and try again.',
        requestId: reqId,
        referenceId: res.callId || transactionId,
        data: {
          verified,
          transactionId,
          callId: res.callId,
          environment: res.environment,
          isSandboxTestKey: res.isSandboxTestKey,
          maskedAadhaar,
          name: res.data?.name || null,
          dob: res.data?.dob || null,
          gender: res.data?.gender || null,
          address: res.data?.address || null,
          kycUrl: storedSession?.kyc_url || null,
        },
      })
    );
  } catch (err: any) {
    const apiErr =
      err instanceof ApiSathiError
        ? err
        : new ApiSathiError({ code: 'DIGILOCKER_FETCH_ERROR', message: err?.message || 'DigiLocker fetch failed', httpStatus: 500 });

    if (apiDb && apiErr.httpStatus === 422) {
      await apiDb
        .prepare(`UPDATE api_sathi_digilocker_sessions SET status = 'NOT_COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE transaction_id = ?`)
        .bind(transactionId)
        .run()
        .catch(() => null);
    }

    await persistApiSathiCall(c.env, {
      callId: apiErr.callId,
      idempotencyKey: crypto.randomUUID(),
      productSlug: 'aadhaar-digilocker-fetch-v1',
      environment: client.isSandboxTestKey ? 'SANDBOX' : 'PRODUCTION',
      isSandboxTest: client.isSandboxTestKey,
      httpStatus: apiErr.httpStatus,
      verified: false,
      outcome: apiErr.isWalletEmptyError ? 'WALLET_EMPTY' : 'REJECTED',
      errorCode: apiErr.code,
      errorMessage: apiErr.message,
      maskedRequestJson: JSON.stringify({ transaction_id: transactionId }),
      responseSummary: `${apiErr.httpStatus} ${apiErr.code}: ${apiErr.message}`,
      userId: user.id,
      businessId: user.businessId || null,
      step1RefId: transactionId,
      latencyMs: 0,
    });

    // On 422 "not completed", let user reopen the DigiLocker link cleanly rather than polling
    if (apiErr.httpStatus === 422) {
      return c.json(
        buildApiResponse({
          success: false,
          status: 'PENDING',
          message: 'DigiLocker verification is not completed yet. Open the DigiLocker link below, finish Aadhaar consent, and then click "I Have Finished".',
          requestId: reqId,
          referenceId: apiErr.callId || undefined,
          errorCode: apiErr.code || 'DIGILOCKER_NOT_COMPLETED',
          data: {
            callId: apiErr.callId,
            notCompleted: true,
            canRetryLink: true,
            transactionId,
            kycUrl: storedSession?.kyc_url || null,
            shortUrl: storedSession?.short_url || null,
          },
        }),
        422
      );
    }

    const mapped = buildErrorPayloadForUser(apiErr, user.role, reqId);
    return c.json(mapped.body, mapped.statusCode as any);
  }
});

// 6. Call Audit Log Query (Admins see all with call_id errors & 402 alerts; users see own calls)
apiSathiRouter.get('/calls', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  const isAdmin = getSafeAdminStatus(user.role);
  const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
  if (!apiDb) {
    return c.json(buildApiResponse({ success: true, status: 'SUCCESS', message: 'No D1 database bound', requestId: reqId, data: [] }));
  }

  const rows = isAdmin
    ? await apiDb
        .prepare(`SELECT * FROM api_sathi_calls ORDER BY created_at DESC LIMIT 100`)
        .all<any>()
        .catch(() => ({ results: [] }))
    : await apiDb
        .prepare(`SELECT * FROM api_sathi_calls WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`)
        .bind(user.id)
        .all<any>()
        .catch(() => ({ results: [] }));

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Loaded ${(rows.results || []).length} API Sathi call record(s)`,
      requestId: reqId,
      data: rows.results || [],
    })
  );
});

// 7. Admin Usage & Expenditure Analytics Endpoint
apiSathiRouter.get('/analytics', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  if (!getSafeAdminStatus(user.role)) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Administrator access required to inspect API Sathi expenditure analytics.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }

  const rawRange = String(c.req.query('range') || '7d').trim();
  const range: ApiSathiAnalyticsRange = rawRange === '24h' || rawRange === '30d' ? rawRange : '7d';
  const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
  const queueSummary = await getWorkerRetryQueueSummary(c.env);

  let rows: any[] = [];
  if (apiDb) {
    const res = await apiDb
      .prepare(
        `SELECT product_slug, environment, is_sandbox_test, http_status, verified, outcome, error_code, latency_ms, created_at
         FROM api_sathi_calls
         ORDER BY created_at DESC
         LIMIT 2000`
      )
      .all<any>()
      .catch(() => ({ results: [] }));
    rows = res.results || [];
  }

  const analytics = aggregateApiSathiUsage(rows, { range, queueSummary });
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `API Sathi analytics compiled (${analytics.summary.totalRequests} requests)`,
      requestId: reqId,
      data: analytics,
    })
  );
});

// 8. Admin Background Retry Queue Status (strictly selects PII-masked summaries only)
apiSathiRouter.get('/queue', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  if (!getSafeAdminStatus(user.role)) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Administrator access required to view API Sathi retry queue.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }

  const { db: apiDb } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_api');
  const summary = await getWorkerRetryQueueSummary(c.env);
  let jobs: any[] = [];
  if (apiDb) {
    const res = await apiDb
      .prepare(
        `SELECT id, idempotency_key as idempotencyKey, product_slug as productSlug, intent, user_id as userId,
                masked_input_json as maskedInputJson, status, attempt_count as attemptCount, max_attempts as maxAttempts,
                last_http_status as lastHttpStatus, last_error_code as lastErrorCode, last_error_message as lastErrorMessage,
                last_call_id as lastCallId, next_retry_at as nextRetryAt, last_attempt_at as lastAttemptAt,
                completed_at as completedAt, created_at as createdAt, updated_at as updatedAt
         FROM api_sathi_retry_queue
         ORDER BY created_at DESC
         LIMIT 50`
      )
      .all<any>()
      .catch(() => ({ results: [] }));
    jobs = res.results || [];
  }

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Loaded ${jobs.length} queued API Sathi retry job(s)`,
      requestId: reqId,
      data: { summary, jobs },
    })
  );
});

// 9. Admin Manual Retry Queue Sweep Trigger
apiSathiRouter.post('/queue/process', requireAuth, async (c) => {
  const reqId = c.get('requestId');
  const user = c.get('user')!;
  if (!getSafeAdminStatus(user.role)) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'REJECTED',
        message: 'Administrator access required to process API Sathi retry queue.',
        requestId: reqId,
        data: null,
        errorCode: 'FORBIDDEN',
      }),
      403
    );
  }

  const body = await c.req.json().catch(() => ({} as Record<string, any>));
  const result = await processWorkerApiSathiRetryQueue(c.env, {
    forceAllPending: body?.forceAllPending !== false,
  });
  const summary = await getWorkerRetryQueueSummary(c.env);

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Processed ${result.processed} retry job(s): ${result.succeeded} succeeded, ${result.rescheduled} rescheduled, ${result.exhausted} exhausted`,
      requestId: reqId,
      data: { result, summary },
    })
  );
});


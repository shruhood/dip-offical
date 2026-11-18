import { constantTimeEqual, hmacSha256Base64 } from '../middleware/security';
import { DatabaseRegistry } from '../config/database';
import type { Env } from '../types';

export type CashfreeMode = 'sandbox' | 'production';

export type NormalizedPaymentLifecycleState =
  | 'CREATED'
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export interface CashfreeRuntimePublicConfig {
  environment: CashfreeMode;
  apiVersion: string;
  isEnabled: boolean;
  autoVerify: boolean;
  expiryMinutes: number;
  retryMaxAttempts: number;
  timeoutMs: number;
  webhookEndpoint: string;
  defaultReturnUrl: string;
}

export interface CashfreeResolvedConfig {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  apiVersion: string;
  mode: CashfreeMode;
  baseUrl: string;
  appDomain: string;
  configured: boolean;
  isEnabled: boolean;
  autoVerify: boolean;
  expiryMinutes: number;
  retryMaxAttempts: number;
  timeoutMs: number;
  isProductionRuntime: boolean;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  webhookSecretConfigured: boolean;
  missingBindings: string[];
}

function stripSurroundingQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function buildNormalizedEnvMap(env?: Record<string, any>): Map<string, string> {
  const map = new Map<string, string>();
  const addSource = (src?: Record<string, any>) => {
    if (!src || typeof src !== 'object') return;
    for (const [k, v] of Object.entries(src)) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'object') continue;
      const normKey = String(k).trim().toUpperCase();
      if (!normKey || map.has(normKey)) continue;
      const cleaned = stripSurroundingQuotes(String(v));
      if (cleaned) map.set(normKey, cleaned);
    }
  };
  // Worker c.env bindings take precedence over process.env
  addSource(env);
  const procEnv =
    typeof globalThis !== 'undefined' && (globalThis as any).process?.env
      ? ((globalThis as any).process.env as Record<string, any>)
      : undefined;
  addSource(procEnv);
  return map;
}

function readFirstEnvValue(envMap: Map<string, string>, candidateKeys: string[]): string {
  for (const key of candidateKeys) {
    const val = envMap.get(key.toUpperCase());
    if (val) return val;
  }
  return '';
}

export const CASHFREE_CLIENT_ID_ALIASES = [
  'CASHFREE_CLIENT_ID',
  'CASHFREE_APP_ID',
  'CASHFREE_PG_CLIENT_ID',
  'CASHFREE_PG_APP_ID',
  'CASHFREE_PRODUCTION_CLIENT_ID',
  'CASHFREE_PROD_CLIENT_ID',
  'CASHFREE_PRODUCTION_APP_ID',
  'CASHFREE_PROD_APP_ID',
  'CASHFREE_KEY_ID',
  'CASHFREE_API_KEY',
  'CASHFREE_ID',
  'CF_CLIENT_ID',
  'CF_APP_ID',
  'VITE_CASHFREE_CLIENT_ID',
  'VITE_CASHFREE_APP_ID',
];

export const CASHFREE_CLIENT_SECRET_ALIASES = [
  'CASHFREE_CLIENT_SECRET',
  'CASHFREE_SECRET_KEY',
  'CASHFREE_PG_CLIENT_SECRET',
  'CASHFREE_PG_SECRET_KEY',
  'CASHFREE_PRODUCTION_CLIENT_SECRET',
  'CASHFREE_PROD_CLIENT_SECRET',
  'CASHFREE_PRODUCTION_SECRET_KEY',
  'CASHFREE_PROD_SECRET_KEY',
  'CASHFREE_KEY_SECRET',
  'CASHFREE_API_SECRET',
  'CASHFREE_SECRET',
  'CF_CLIENT_SECRET',
  'CF_SECRET_KEY',
  'VITE_CASHFREE_CLIENT_SECRET',
  'VITE_CASHFREE_SECRET_KEY',
];

export const CASHFREE_SANDBOX_ID_ALIASES = [
  'CASHFREE_SANDBOX_CLIENT_ID',
  'CASHFREE_SANDBOX_APP_ID',
  'CASHFREE_TEST_CLIENT_ID',
  'CASHFREE_TEST_APP_ID',
];

export const CASHFREE_SANDBOX_SECRET_ALIASES = [
  'CASHFREE_SANDBOX_CLIENT_SECRET',
  'CASHFREE_SANDBOX_SECRET_KEY',
  'CASHFREE_TEST_CLIENT_SECRET',
  'CASHFREE_TEST_SECRET_KEY',
];

export const CASHFREE_WEBHOOK_SECRET_ALIASES = [
  'CASHFREE_WEBHOOK_SECRET',
  'CASHFREE_PG_WEBHOOK_SECRET',
  'CF_WEBHOOK_SECRET',
];

export function isProductionEnvironment(env?: Record<string, any>): boolean {
  const raw = String(env?.ENVIRONMENT || env?.NODE_ENV || '')
    .trim()
    .toLowerCase();
  return raw === 'production' || raw === 'prod';
}

export function isPaymentAmountMatching(
  expectedPaise: number,
  paidAmountInr?: number
): boolean {
  if (!Number.isFinite(expectedPaise) || expectedPaise <= 0) return false;
  if (typeof paidAmountInr !== 'number' || !Number.isFinite(paidAmountInr) || paidAmountInr <= 0) {
    return false;
  }
  const paidPaise = Math.round(paidAmountInr * 100);
  // Allow max ₹1 (100 paise) rounding delta
  return Math.abs(paidPaise - Math.round(expectedPaise)) <= 100;
}

export function normalizeCashfreeLifecycleState(
  rawStatus?: string | null,
  paymentStatus?: string | null
): NormalizedPaymentLifecycleState {
  const orderUpper = String(rawStatus || '').trim().toUpperCase().replace(/[_-]+/g, ' ');
  const payUpper = String(paymentStatus || '').trim().toUpperCase().replace(/[_-]+/g, ' ');

  if (orderUpper === 'REFUNDED' || payUpper === 'REFUNDED') return 'REFUNDED';
  if (orderUpper === 'PARTIALLY REFUNDED') return 'PARTIALLY_REFUNDED';
  if (orderUpper === 'PAID' || payUpper === 'SUCCESS' || payUpper === 'CAPTURED') return 'PAID';
  if (orderUpper === 'EXPIRED') return 'EXPIRED';
  if (
    orderUpper === 'CANCELLED' ||
    orderUpper === 'CANCELED' ||
    orderUpper === 'DROPPED' ||
    orderUpper === 'USER DROPPED' ||
    orderUpper === 'TERMINATED' ||
    payUpper === 'USER DROPPED' ||
    payUpper === 'CANCELLED' ||
    payUpper === 'CANCELED'
  ) {
    return 'CANCELLED';
  }
  if (orderUpper === 'FAILED' || payUpper === 'FAILED') return 'FAILED';
  if (orderUpper === 'PROCESSING') return 'PROCESSING';
  if (orderUpper === 'PENDING' || orderUpper === 'ACTIVE' || payUpper === 'PENDING') return 'PENDING';
  return 'CREATED';
}

export function maskEmailForLog(email?: string): string {
  const raw = String(email || '').trim();
  const at = raw.indexOf('@');
  if (at <= 1) return '***';
  return `${raw.slice(0, 2)}***${raw.slice(at)}`;
}

export function maskPhoneForLog(phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return '******';
  return `******${digits.slice(-4)}`;
}

export function logCashfreeEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  meta: Record<string, any> = {}
): void {
  const safeMeta: Record<string, any> = {};
  for (const [k, v] of Object.entries(meta)) {
    const lk = k.toLowerCase();
    if (
      lk.includes('secret') ||
      lk.includes('signature') ||
      lk.includes('token') ||
      lk.includes('password') ||
      lk.includes('pan') ||
      lk.includes('aadhaar')
    ) {
      safeMeta[k] = '[REDACTED]';
    } else if (lk.includes('email') && typeof v === 'string') {
      safeMeta[k] = maskEmailForLog(v);
    } else if ((lk.includes('phone') || lk.includes('mobile')) && typeof v === 'string') {
      safeMeta[k] = maskPhoneForLog(v);
    } else {
      safeMeta[k] = v;
    }
  }
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    component: 'cashfree-pg',
    level,
    event,
    ...safeMeta,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export interface CashfreeOrderRequest {
  orderId: string;
  amountInr: number;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderNote?: string;
  returnUrl?: string;
  notifyUrl?: string;
  idempotencyKey?: string;
  expiryMinutes?: number;
  orderTags?: Record<string, string>;
}

export interface CashfreeOrderResult {
  ok: boolean;
  httpStatus: number;
  orderId: string;
  cfOrderId?: string;
  paymentSessionId?: string;
  orderStatus?: string;
  orderExpiryTime?: string;
  mode: CashfreeMode;
  errorMessage?: string;
  errorCode?: string;
  requestId?: string;
}

export interface CashfreeOrderVerificationResult {
  ok: boolean;
  httpStatus: number;
  orderId: string;
  cfOrderId?: string;
  orderStatus: 'PAID' | 'ACTIVE' | 'EXPIRED' | 'FAILED' | 'PENDING' | 'CANCELLED';
  normalizedState: NormalizedPaymentLifecycleState;
  paid: boolean;
  cfPaymentId?: string;
  paymentMethod?: string;
  paymentTime?: string;
  bankReference?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  paymentMessage?: string;
  orderExpiryTime?: string;
  rawOrder?: Record<string, any>;
  rawPayment?: Record<string, any> | null;
  errorMessage?: string;
}

export interface CashfreeRefundRequest {
  orderId: string;
  refundId: string;
  refundAmountInr: number;
  refundNote?: string;
  refundSpeed?: 'STANDARD' | 'INSTANT';
  idempotencyKey?: string;
}

export interface CashfreeRefundResult {
  ok: boolean;
  httpStatus: number;
  orderId: string;
  refundId: string;
  cfRefundId?: string;
  cfPaymentId?: string;
  refundAmount?: number;
  refundCurrency?: string;
  refundStatus: 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED' | 'ONHOLD';
  refundArn?: string;
  refundMode?: string;
  statusDescription?: string;
  processedAt?: string;
  raw?: Record<string, any>;
  errorMessage?: string;
  errorCode?: string;
}

export function resolveCashfreeConfig(
  env: Record<string, any> | undefined,
  preferredMode?: string
): CashfreeResolvedConfig {
  const safeEnv = env || {};
  const envMap = buildNormalizedEnvMap(safeEnv);
  const isProductionRuntime = isProductionEnvironment(safeEnv);

  const primaryClientId = readFirstEnvValue(envMap, CASHFREE_CLIENT_ID_ALIASES);
  const primaryClientSecret = readFirstEnvValue(envMap, CASHFREE_CLIENT_SECRET_ALIASES);
  const explicitServerMode = readFirstEnvValue(envMap, [
    'CASHFREE_ENV',
    'CASHFREE_ENVIRONMENT',
    'CASHFREE_MODE',
  ]).toLowerCase();

  let mode: CashfreeMode;
  if (explicitServerMode === 'production' || explicitServerMode === 'prod' || explicitServerMode === 'live') {
    mode = 'production';
  } else if (explicitServerMode === 'sandbox' || explicitServerMode === 'test') {
    mode = 'sandbox';
  } else if (isProductionRuntime && Boolean(primaryClientId && primaryClientSecret)) {
    mode = 'production';
  } else {
    const reqMode = String(preferredMode || (isProductionRuntime ? 'production' : 'sandbox'))
      .trim()
      .toLowerCase();
    mode = reqMode === 'production' || reqMode === 'prod' || reqMode === 'live' ? 'production' : 'sandbox';
  }

  const clientId =
    primaryClientId ||
    (mode === 'sandbox' ? readFirstEnvValue(envMap, CASHFREE_SANDBOX_ID_ALIASES) : '');
  const clientSecret =
    primaryClientSecret ||
    (mode === 'sandbox' ? readFirstEnvValue(envMap, CASHFREE_SANDBOX_SECRET_ALIASES) : '');
  const webhookSecret =
    readFirstEnvValue(envMap, CASHFREE_WEBHOOK_SECRET_ALIASES) || clientSecret;
  const apiVersion =
    readFirstEnvValue(envMap, ['CASHFREE_API_VERSION']) || '2023-08-01';

  const clientIdConfigured = Boolean(clientId);
  const clientSecretConfigured = Boolean(clientSecret);
  const webhookSecretConfigured = Boolean(webhookSecret);
  const configured = clientIdConfigured && clientSecretConfigured;

  const missingBindings: string[] = [];
  if (!clientIdConfigured) missingBindings.push('CASHFREE_CLIENT_ID');
  if (!clientSecretConfigured) missingBindings.push('CASHFREE_CLIENT_SECRET');

  const baseUrl =
    mode === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';
  const appDomain = (
    readFirstEnvValue(envMap, ['APP_DOMAIN']) || 'https://digitalindiaproject.com'
  ).replace(/\/+$/, '');

  return {
    clientId,
    clientSecret,
    webhookSecret,
    apiVersion,
    mode,
    baseUrl,
    appDomain,
    configured,
    isEnabled: true,
    autoVerify: true,
    expiryMinutes: 30,
    retryMaxAttempts: 2,
    timeoutMs: 12000,
    isProductionRuntime,
    clientIdConfigured,
    clientSecretConfigured,
    webhookSecretConfigured,
    missingBindings,
  };
}

export async function loadEffectiveCashfreeConfig(
  env: Env | Record<string, any> | undefined,
  preferredMode?: string
): Promise<CashfreeResolvedConfig> {
  const base = resolveCashfreeConfig(env as Record<string, any>, preferredMode);
  try {
    if (!env || !('DB' in env || 'DB_INTEGRATIONS' in env)) {
      return base;
    }
    const { db: intDb } = await new DatabaseRegistry(env as Env).resolveAndEnsure('dip_integrations');
    if (!intDb) return base;

    const row = await intDb
      .prepare(`SELECT environment, is_enabled, public_config_json FROM api_integrations WHERE code = 'cashfree' LIMIT 1`)
      .first<{ environment?: string; is_enabled?: number; public_config_json?: string }>()
      .catch(() => null);

    if (!row) return base;

    let pub: Record<string, any> = {};
    if (row.public_config_json) {
      try {
        pub = JSON.parse(row.public_config_json) || {};
      } catch {
        pub = {};
      }
    }

    const dbEnvRaw = String(row.environment || '').trim().toLowerCase();
    const hasExplicitWorkerEnv = Boolean(
      (env as any)?.CASHFREE_ENV || (env as any)?.CASHFREE_ENVIRONMENT || (env as any)?.CASHFREE_MODE
    );
    const mode: CashfreeMode =
      !hasExplicitWorkerEnv && !preferredMode && (dbEnvRaw === 'production' || dbEnvRaw === 'sandbox')
        ? dbEnvRaw
        : base.mode;

    const apiVersion =
      typeof pub.apiVersion === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(pub.apiVersion.trim())
        ? pub.apiVersion.trim()
        : base.apiVersion;

    const expiryMinutes =
      typeof pub.expiryMinutes === 'number' && Number.isFinite(pub.expiryMinutes)
        ? Math.min(4320, Math.max(15, Math.round(pub.expiryMinutes)))
        : base.expiryMinutes;

    const retryMaxAttempts =
      typeof pub.retryMaxAttempts === 'number' && Number.isFinite(pub.retryMaxAttempts)
        ? Math.min(3, Math.max(1, Math.round(pub.retryMaxAttempts)))
        : base.retryMaxAttempts;

    const timeoutMs =
      typeof pub.timeoutMs === 'number' && Number.isFinite(pub.timeoutMs)
        ? Math.min(25000, Math.max(3000, Math.round(pub.timeoutMs)))
        : base.timeoutMs;

    const baseUrl =
      mode === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

    return {
      ...base,
      mode,
      baseUrl,
      apiVersion,
      isEnabled: row.is_enabled === undefined ? true : row.is_enabled !== 0,
      autoVerify: pub.autoVerify !== false,
      expiryMinutes,
      retryMaxAttempts,
      timeoutMs,
    };
  } catch {
    return base;
  }
}

export function buildCashfreeUnconfiguredMessage(config: CashfreeResolvedConfig): string {
  if (!config.clientIdConfigured && !config.clientSecretConfigured) {
    return 'Cashfree payment gateway is not configured in production environment: Worker runtime cannot see CASHFREE_CLIENT_ID (or CASHFREE_APP_ID) or CASHFREE_CLIENT_SECRET (or CASHFREE_SECRET_KEY). Ensure both are saved on the "digitalindiaproject" Worker in Cloudflare and redeploy with --keep-vars.';
  }
  if (!config.clientIdConfigured) {
    return 'Cashfree payment gateway is missing CASHFREE_CLIENT_ID (or CASHFREE_APP_ID) in production Worker settings.';
  }
  return 'Cashfree payment gateway is missing CASHFREE_CLIENT_SECRET (or CASHFREE_SECRET_KEY) in production Worker settings.';
}

export function normalizeIndianPhone(rawPhone: string | undefined): string {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) {
      return last10;
    }
  }
  return '9876543210';
}

export function sanitizeCustomerEmail(rawEmail: string | undefined): string {
  const cleaned = String(rawEmail || '').trim().slice(0, 100);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return cleaned;
  }
  return 'applicant@digitalindiaproject.com';
}

export function sanitizeCustomerId(rawId: string | undefined): string {
  const clean = String(rawId || 'guest')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 45);
  return clean || 'guest_applicant';
}

export function formatCashfreePaymentMethod(paymentMethodObj: any): string {
  if (!paymentMethodObj || typeof paymentMethodObj !== 'object') {
    return 'Cashfree Checkout';
  }
  if (paymentMethodObj.upi) {
    const vpa = paymentMethodObj.upi.upi_id ? ` (${paymentMethodObj.upi.upi_id})` : '';
    return `UPI${vpa}`;
  }
  if (paymentMethodObj.card) {
    const network = paymentMethodObj.card.card_network || 'Card';
    const last4 = paymentMethodObj.card.card_number
      ? ` ending ${String(paymentMethodObj.card.card_number).slice(-4)}`
      : '';
    return `${network}${last4}`;
  }
  if (paymentMethodObj.netbanking) {
    return `NetBanking (${paymentMethodObj.netbanking.netbanking_bank_name || 'Bank'})`;
  }
  if (paymentMethodObj.wallet) {
    return `Wallet (${paymentMethodObj.wallet.provider || 'Digital Wallet'})`;
  }
  if (paymentMethodObj.paylater) {
    return 'Pay Later';
  }
  return 'Cashfree Online Payment';
}

const RETRYABLE_HTTP_STATUSES = new Set([429, 502, 503, 504]);

async function cashfreeFetchJson<T = any>(
  config: CashfreeResolvedConfig,
  path: string,
  options: {
    method: 'GET' | 'POST';
    body?: Record<string, any>;
    idempotencyKey?: string;
    operationName: string;
  }
): Promise<{ ok: boolean; status: number; data: T | null; requestId: string; errorMessage?: string }> {
  const requestId = `cfreq_${crypto.randomUUID().slice(0, 16)}`;
  const canRetryPost = Boolean(options.idempotencyKey);
  const maxAttempts =
    options.method === 'GET' || canRetryPost
      ? Math.max(1, Math.min(3, config.retryMaxAttempts || 2))
      : 1;

  let lastStatus = 502;
  let lastError = 'Cashfree request failed';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const headers: Record<string, string> = {
      'x-api-version': config.apiVersion,
      'x-client-id': config.clientId,
      'x-client-secret': config.clientSecret,
      'x-request-id': `${requestId}_${attempt}`,
    };
    if (options.method === 'POST') {
      headers['Content-Type'] = 'application/json';
    }
    if (options.idempotencyKey) {
      headers['x-idempotency-key'] = options.idempotencyKey.slice(0, 64);
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort('CASHFREE_API_TIMEOUT'), config.timeoutMs || 12000)
      : null;

    try {
      const res = await fetch(`${config.baseUrl}${path}`, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller?.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      const json = (await res.json().catch(() => null)) as any;
      if (res.ok) {
        return { ok: true, status: res.status, data: json as T, requestId };
      }

      lastStatus = res.status || 502;
      lastError = String(json?.message || `Cashfree PG returned HTTP ${res.status}`);

      if (RETRYABLE_HTTP_STATUSES.has(lastStatus) && attempt < maxAttempts) {
        logCashfreeEvent('warn', `${options.operationName}_retry`, {
          attempt,
          status: lastStatus,
          requestId,
        });
        await new Promise((r) => setTimeout(r, 200 * attempt));
        continue;
      }

      return { ok: false, status: lastStatus, data: json as T, requestId, errorMessage: lastError };
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);
      const isTimeout = err?.name === 'AbortError' || String(err).includes('TIMEOUT');
      lastStatus = isTimeout ? 504 : 502;
      lastError = isTimeout
        ? `Cashfree API request timed out after ${config.timeoutMs || 12000}ms`
        : String(err?.message || 'Network failure contacting Cashfree PG');

      if (attempt < maxAttempts) {
        logCashfreeEvent('warn', `${options.operationName}_network_retry`, {
          attempt,
          error: lastError,
          requestId,
        });
        await new Promise((r) => setTimeout(r, 200 * attempt));
        continue;
      }
      return { ok: false, status: lastStatus, data: null, requestId, errorMessage: lastError };
    }
  }

  return { ok: false, status: lastStatus, data: null, requestId, errorMessage: lastError };
}

export async function createCashfreePgOrder(
  config: CashfreeResolvedConfig,
  params: CashfreeOrderRequest
): Promise<CashfreeOrderResult> {
  if (!config.configured) {
    return {
      ok: false,
      httpStatus: 503,
      orderId: params.orderId,
      mode: config.mode,
      errorCode: 'CASHFREE_NOT_CONFIGURED',
      errorMessage: 'Cashfree Client ID / Client Secret not configured',
    };
  }

  const returnUrl =
    params.returnUrl || `${config.appDomain}/?cf_order_id={order_id}`;
  const notifyUrl =
    params.notifyUrl || `${config.appDomain}/api/webhooks/cashfree`;

  const expiryMins = Math.min(4320, Math.max(15, params.expiryMinutes || config.expiryMinutes || 30));
  const orderExpiryTime = new Date(Date.now() + expiryMins * 60_000).toISOString();

  const payload: Record<string, any> = {
    order_id: params.orderId,
    order_amount: Number(Math.max(1, params.amountInr).toFixed(2)),
    order_currency: 'INR',
    order_expiry_time: orderExpiryTime,
    customer_details: {
      customer_id: sanitizeCustomerId(params.customerId),
      customer_name: String(params.customerName || 'Citizen Applicant').trim().slice(0, 100) || 'Citizen Applicant',
      customer_email: sanitizeCustomerEmail(params.customerEmail),
      customer_phone: normalizeIndianPhone(params.customerPhone),
    },
    order_meta: {
      return_url: returnUrl,
      notify_url: notifyUrl,
    },
    order_note: String(params.orderNote || 'Digital India Project Application Fee').slice(0, 200),
  };

  if (params.orderTags && Object.keys(params.orderTags).length > 0) {
    payload.order_tags = params.orderTags;
  }

  const res = await cashfreeFetchJson<Record<string, any>>(config, '/orders', {
    method: 'POST',
    body: payload,
    idempotencyKey: params.idempotencyKey || `ord_${params.orderId}`,
    operationName: 'create_order',
  });

  const data = res.data || {};
  if (!res.ok || !data?.payment_session_id) {
    logCashfreeEvent('error', 'create_order_failed', {
      orderId: params.orderId,
      mode: config.mode,
      httpStatus: res.status,
      errorCode: data?.code || 'CASHFREE_ORDER_ERROR',
      message: res.errorMessage || data?.message,
      requestId: res.requestId,
    });
    return {
      ok: false,
      httpStatus: res.status || 502,
      orderId: params.orderId,
      mode: config.mode,
      requestId: res.requestId,
      errorCode: String(data?.code || 'CASHFREE_ORDER_ERROR'),
      errorMessage: String(
        res.errorMessage || data?.message || `Cashfree PG returned HTTP ${res.status}`
      ),
    };
  }

  logCashfreeEvent('info', 'create_order_success', {
    orderId: String(data.order_id || params.orderId),
    cfOrderId: data.cf_order_id ? String(data.cf_order_id) : undefined,
    mode: config.mode,
    amountInr: payload.order_amount,
    customerEmail: params.customerEmail,
    requestId: res.requestId,
  });

  return {
    ok: true,
    httpStatus: 200,
    orderId: String(data.order_id || params.orderId),
    cfOrderId: data.cf_order_id ? String(data.cf_order_id) : undefined,
    paymentSessionId: String(data.payment_session_id),
    orderStatus: String(data.order_status || 'ACTIVE'),
    orderExpiryTime: data.order_expiry_time ? String(data.order_expiry_time) : orderExpiryTime,
    mode: config.mode,
    requestId: res.requestId,
  };
}

export async function getCashfreePgOrderStatus(
  config: CashfreeResolvedConfig,
  orderId: string
): Promise<CashfreeOrderVerificationResult> {
  if (!config.configured) {
    return {
      ok: false,
      httpStatus: 503,
      orderId,
      orderStatus: 'PENDING',
      normalizedState: 'PENDING',
      paid: false,
      errorMessage: 'Cashfree Client ID / Client Secret not configured',
    };
  }

  const encodedOrderId = encodeURIComponent(orderId);
  const [orderRes, paymentsRes] = await Promise.all([
    cashfreeFetchJson<Record<string, any>>(config, `/orders/${encodedOrderId}`, {
      method: 'GET',
      operationName: 'get_order',
    }),
    cashfreeFetchJson<any[]>(config, `/orders/${encodedOrderId}/payments`, {
      method: 'GET',
      operationName: 'get_order_payments',
    }),
  ]);

  const orderJson = orderRes.data || {};
  if (!orderRes.ok) {
    return {
      ok: false,
      httpStatus: orderRes.status || 502,
      orderId,
      orderStatus: 'PENDING',
      normalizedState: 'PENDING',
      paid: false,
      errorMessage: String(
        orderRes.errorMessage || orderJson?.message || `Unable to fetch Cashfree order status (HTTP ${orderRes.status})`
      ),
    };
  }

  const paymentsList = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];

  const successPayment = paymentsList.find(
    (p: any) => String(p?.payment_status || '').toUpperCase() === 'SUCCESS'
  );
  const latestPayment = successPayment || paymentsList[0] || null;
  const rawOrderStatus = String(orderJson?.order_status || 'ACTIVE').toUpperCase();
  const rawPaymentStatus = String(latestPayment?.payment_status || '').toUpperCase();

  let normalizedStatus: CashfreeOrderVerificationResult['orderStatus'] = 'ACTIVE';
  if (rawOrderStatus === 'PAID' || rawPaymentStatus === 'SUCCESS') {
    normalizedStatus = 'PAID';
  } else if (rawOrderStatus === 'EXPIRED') {
    normalizedStatus = 'EXPIRED';
  } else if (rawPaymentStatus === 'USER_DROPPED' || rawPaymentStatus === 'CANCELLED') {
    normalizedStatus = 'CANCELLED';
  } else if (rawPaymentStatus === 'FAILED' || rawOrderStatus === 'TERMINATED') {
    normalizedStatus = 'FAILED';
  } else if (rawPaymentStatus === 'PENDING') {
    normalizedStatus = 'PENDING';
  }

  const normalizedState = normalizeCashfreeLifecycleState(rawOrderStatus, rawPaymentStatus);

  return {
    ok: true,
    httpStatus: 200,
    orderId: String(orderJson?.order_id || orderId),
    cfOrderId: orderJson?.cf_order_id ? String(orderJson.cf_order_id) : undefined,
    orderStatus: normalizedStatus,
    normalizedState,
    paid: normalizedStatus === 'PAID',
    cfPaymentId: latestPayment?.cf_payment_id ? String(latestPayment.cf_payment_id) : undefined,
    paymentMethod: latestPayment
      ? formatCashfreePaymentMethod(latestPayment.payment_method)
      : undefined,
    paymentTime: latestPayment?.payment_time ? String(latestPayment.payment_time) : undefined,
    bankReference: latestPayment?.bank_reference ? String(latestPayment.bank_reference) : undefined,
    paymentAmount:
      typeof latestPayment?.payment_amount === 'number'
        ? latestPayment.payment_amount
        : typeof orderJson?.order_amount === 'number'
        ? orderJson.order_amount
        : undefined,
    paymentCurrency: String(latestPayment?.payment_currency || orderJson?.order_currency || 'INR'),
    paymentMessage: latestPayment?.payment_message
      ? String(latestPayment.payment_message)
      : undefined,
    orderExpiryTime: orderJson?.order_expiry_time ? String(orderJson.order_expiry_time) : undefined,
    rawOrder: orderJson,
    rawPayment: latestPayment,
  };
}

export async function createCashfreeRefund(
  config: CashfreeResolvedConfig,
  params: CashfreeRefundRequest
): Promise<CashfreeRefundResult> {
  if (!config.configured) {
    return {
      ok: false,
      httpStatus: 503,
      orderId: params.orderId,
      refundId: params.refundId,
      refundStatus: 'FAILED',
      errorCode: 'CASHFREE_NOT_CONFIGURED',
      errorMessage: 'Cashfree Client ID / Client Secret not configured for live refunds',
    };
  }

  const body: Record<string, any> = {
    refund_amount: Number(Math.max(0.01, params.refundAmountInr).toFixed(2)),
    refund_id: params.refundId,
    refund_note: String(params.refundNote || 'Authorized refund via Digital India Project').slice(0, 250),
  };
  if (params.refundSpeed === 'INSTANT' || params.refundSpeed === 'STANDARD') {
    body.refund_speed = params.refundSpeed;
  }

  const res = await cashfreeFetchJson<Record<string, any>>(
    config,
    `/orders/${encodeURIComponent(params.orderId)}/refunds`,
    {
      method: 'POST',
      body,
      idempotencyKey: params.idempotencyKey || `ref_${params.refundId}`,
      operationName: 'create_refund',
    }
  );

  const data = res.data || {};
  if (!res.ok) {
    logCashfreeEvent('error', 'create_refund_failed', {
      orderId: params.orderId,
      refundId: params.refundId,
      httpStatus: res.status,
      errorCode: data?.code || 'CASHFREE_REFUND_ERROR',
      message: res.errorMessage || data?.message,
    });
    return {
      ok: false,
      httpStatus: res.status || 502,
      orderId: params.orderId,
      refundId: params.refundId,
      refundStatus: 'FAILED',
      errorCode: String(data?.code || 'CASHFREE_REFUND_ERROR'),
      errorMessage: String(res.errorMessage || data?.message || `Cashfree refund failed (HTTP ${res.status})`),
      raw: data,
    };
  }

  const statusRaw = String(data?.refund_status || 'PENDING').toUpperCase();
  const refundStatus: CashfreeRefundResult['refundStatus'] =
    statusRaw === 'SUCCESS'
      ? 'SUCCESS'
      : statusRaw === 'CANCELLED'
      ? 'CANCELLED'
      : statusRaw === 'ONHOLD'
      ? 'ONHOLD'
      : statusRaw === 'FAILED'
      ? 'FAILED'
      : 'PENDING';

  logCashfreeEvent('info', 'create_refund_submitted', {
    orderId: params.orderId,
    refundId: String(data.refund_id || params.refundId),
    cfRefundId: data.cf_refund_id ? String(data.cf_refund_id) : undefined,
    refundStatus,
    refundAmount: data.refund_amount ?? body.refund_amount,
  });

  return {
    ok: true,
    httpStatus: res.status || 200,
    orderId: String(data.order_id || params.orderId),
    refundId: String(data.refund_id || params.refundId),
    cfRefundId: data.cf_refund_id ? String(data.cf_refund_id) : undefined,
    cfPaymentId: data.cf_payment_id ? String(data.cf_payment_id) : undefined,
    refundAmount: typeof data.refund_amount === 'number' ? data.refund_amount : body.refund_amount,
    refundCurrency: String(data.refund_currency || 'INR'),
    refundStatus,
    refundArn: data.refund_arn ? String(data.refund_arn) : undefined,
    refundMode: data.refund_mode ? String(data.refund_mode) : params.refundSpeed || 'STANDARD',
    statusDescription: data.status_description ? String(data.status_description) : undefined,
    processedAt: data.processed_at ? String(data.processed_at) : undefined,
    raw: data,
  };
}

export async function getCashfreeRefundStatus(
  config: CashfreeResolvedConfig,
  orderId: string,
  refundId: string
): Promise<CashfreeRefundResult> {
  if (!config.configured) {
    return {
      ok: false,
      httpStatus: 503,
      orderId,
      refundId,
      refundStatus: 'PENDING',
      errorMessage: 'Cashfree Client ID / Client Secret not configured',
    };
  }

  const res = await cashfreeFetchJson<Record<string, any>>(
    config,
    `/orders/${encodeURIComponent(orderId)}/refunds/${encodeURIComponent(refundId)}`,
    { method: 'GET', operationName: 'get_refund' }
  );

  const data = res.data || {};
  if (!res.ok) {
    return {
      ok: false,
      httpStatus: res.status || 502,
      orderId,
      refundId,
      refundStatus: 'PENDING',
      errorMessage: String(res.errorMessage || data?.message || 'Unable to fetch refund status'),
    };
  }

  const statusRaw = String(data?.refund_status || 'PENDING').toUpperCase();
  const refundStatus: CashfreeRefundResult['refundStatus'] =
    statusRaw === 'SUCCESS'
      ? 'SUCCESS'
      : statusRaw === 'CANCELLED'
      ? 'CANCELLED'
      : statusRaw === 'ONHOLD'
      ? 'ONHOLD'
      : statusRaw === 'FAILED'
      ? 'FAILED'
      : 'PENDING';

  return {
    ok: true,
    httpStatus: 200,
    orderId: String(data.order_id || orderId),
    refundId: String(data.refund_id || refundId),
    cfRefundId: data.cf_refund_id ? String(data.cf_refund_id) : undefined,
    cfPaymentId: data.cf_payment_id ? String(data.cf_payment_id) : undefined,
    refundAmount: typeof data.refund_amount === 'number' ? data.refund_amount : undefined,
    refundCurrency: String(data.refund_currency || 'INR'),
    refundStatus,
    refundArn: data.refund_arn ? String(data.refund_arn) : undefined,
    refundMode: data.refund_mode ? String(data.refund_mode) : undefined,
    statusDescription: data.status_description ? String(data.status_description) : undefined,
    processedAt: data.processed_at ? String(data.processed_at) : undefined,
    raw: data,
  };
}

export async function getCashfreeOrderRefunds(
  config: CashfreeResolvedConfig,
  orderId: string
): Promise<{ ok: boolean; refunds: CashfreeRefundResult[]; errorMessage?: string }> {
  if (!config.configured) {
    return { ok: false, refunds: [], errorMessage: 'Cashfree not configured' };
  }

  const res = await cashfreeFetchJson<any[]>(
    config,
    `/orders/${encodeURIComponent(orderId)}/refunds`,
    { method: 'GET', operationName: 'list_order_refunds' }
  );
  if (!res.ok) {
    return { ok: false, refunds: [], errorMessage: res.errorMessage };
  }
  const arr = Array.isArray(res.data) ? res.data : [];
  return {
    ok: true,
    refunds: arr.map((data: any) => {
      const statusRaw = String(data?.refund_status || 'PENDING').toUpperCase();
      const refundStatus: CashfreeRefundResult['refundStatus'] =
        statusRaw === 'SUCCESS'
          ? 'SUCCESS'
          : statusRaw === 'CANCELLED'
          ? 'CANCELLED'
          : statusRaw === 'ONHOLD'
          ? 'ONHOLD'
          : statusRaw === 'FAILED'
          ? 'FAILED'
          : 'PENDING';
      return {
        ok: true,
        httpStatus: 200,
        orderId: String(data?.order_id || orderId),
        refundId: String(data?.refund_id || ''),
        cfRefundId: data?.cf_refund_id ? String(data.cf_refund_id) : undefined,
        cfPaymentId: data?.cf_payment_id ? String(data.cf_payment_id) : undefined,
        refundAmount: typeof data?.refund_amount === 'number' ? data.refund_amount : undefined,
        refundCurrency: String(data?.refund_currency || 'INR'),
        refundStatus,
        refundArn: data?.refund_arn ? String(data.refund_arn) : undefined,
        refundMode: data?.refund_mode ? String(data.refund_mode) : undefined,
        statusDescription: data?.status_description ? String(data.status_description) : undefined,
        processedAt: data?.processed_at ? String(data.processed_at) : undefined,
        raw: data,
      };
    }),
  };
}

export function validateWebhookTimestamp(
  rawTimestamp: string,
  options?: boolean | { enforce?: boolean; maxSkewSeconds?: number; nowMs?: number }
): { valid: boolean; reason?: string; timestampSec?: number } {
  const opts = typeof options === 'boolean' ? { enforce: options } : (options || {});
  const clean = String(rawTimestamp || '').trim();
  if (!clean) {
    return opts.enforce
      ? { valid: false, reason: 'Missing x-webhook-timestamp header' }
      : { valid: true };
  }

  let tsSec: number;
  if (/^\d{10,13}$/.test(clean)) {
    const num = Number(clean);
    tsSec = clean.length === 13 ? Math.floor(num / 1000) : num;
  } else {
    const parsedMs = Date.parse(clean);
    if (!Number.isFinite(parsedMs)) {
      return { valid: false, reason: 'Malformed x-webhook-timestamp header' };
    }
    tsSec = Math.floor(parsedMs / 1000);
  }

  if (!opts.enforce) {
    return { valid: true, timestampSec: tsSec };
  }

  const maxSkew = Math.max(60, opts.maxSkewSeconds ?? 600);
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  const diff = Math.abs(nowSec - tsSec);
  if (diff > maxSkew) {
    return {
      valid: false,
      reason: `Webhook timestamp skew (${diff}s) exceeds anti-replay window (${maxSkew}s)`,
      timestampSec: tsSec,
    };
  }
  return { valid: true, timestampSec: tsSec };
}

export async function verifyCashfreeWebhookSignature(
  webhookSecret: string,
  timestamp: string,
  rawBody: string,
  signature: string
): Promise<boolean> {
  if (!webhookSecret || !timestamp || !signature) return false;
  const expectedSig = await hmacSha256Base64(webhookSecret, `${timestamp}${rawBody}`);
  return constantTimeEqual(expectedSig, signature);
}

export async function verifyCashfreeWebhookWithAnySecret(
  secrets: Array<string | undefined>,
  timestamp: string,
  rawBody: string,
  signature: string
): Promise<{ valid: boolean; matchedHashPrefix?: string }> {
  const uniqueSecrets = Array.from(
    new Set(secrets.map((s) => String(s || '').trim()).filter(Boolean))
  );
  for (const secret of uniqueSecrets) {
    const expectedSig = await hmacSha256Base64(secret, `${timestamp}${rawBody}`);
    if (signature && timestamp && constantTimeEqual(expectedSig, signature)) {
      return { valid: true, matchedHashPrefix: expectedSig.slice(0, 32) };
    }
  }
  return { valid: false };
}

export function isCashfreeTestPingPayload(rawBody: string, parsed: Record<string, any> | null): boolean {
  const trimmed = String(rawBody || '').trim();
  if (!trimmed || trimmed === '{}') return true;
  if (!parsed || typeof parsed !== 'object') return false;

  const hasOrderId = Boolean(parsed?.data?.order?.order_id || parsed?.order_id);
  const hasPaymentId = Boolean(parsed?.data?.payment?.cf_payment_id || parsed?.cf_payment_id);
  const hasPaymentStatus = Boolean(parsed?.data?.payment?.payment_status);
  const hasRefundId = Boolean(parsed?.data?.refund?.cf_refund_id || parsed?.data?.refund?.refund_id);
  if (hasOrderId || hasPaymentId || hasPaymentStatus || hasRefundId) {
    return false;
  }

  const eventType = String(parsed?.type || parsed?.event || '').toUpperCase();
  if (
    eventType === 'WEBHOOK' ||
    eventType === 'TEST_WEBHOOK' ||
    eventType === 'PING' ||
    eventType === 'TEST' ||
    eventType.startsWith('TEST_')
  ) {
    return true;
  }
  if (parsed?.data?.test_object || parsed?.data?.test === true || parsed?.test === true) {
    return true;
  }
  return Object.keys(parsed).length === 0;
}

export interface CashfreeCredentialProbeResult {
  configured: boolean;
  reachable: boolean;
  authenticated: boolean;
  httpStatus: number;
  mode: CashfreeMode;
  baseUrl: string;
  latencyMs: number;
  message: string;
}

export async function probeCashfreeGatewayCredentials(
  config: CashfreeResolvedConfig
): Promise<CashfreeCredentialProbeResult> {
  const startedAt = Date.now();
  if (!config.configured) {
    return {
      configured: false,
      reachable: false,
      authenticated: false,
      httpStatus: 0,
      mode: config.mode,
      baseUrl: config.baseUrl,
      latencyMs: 0,
      message: buildCashfreeUnconfiguredMessage(config),
    };
  }

  const probeOrderId = `CUTOVER_PROBE_${Date.now()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(config.timeoutMs || 12000, 6000));

  try {
    const res = await fetch(`${config.baseUrl}/orders/${encodeURIComponent(probeOrderId)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-client-id': config.clientId,
        'x-client-secret': config.clientSecret,
        'x-api-version': config.apiVersion,
        'x-request-id': `probe_${Date.now()}`,
      },
      signal: controller.signal,
    });
    const latencyMs = Math.max(1, Date.now() - startedAt);
    const bodyText = await res.text().catch(() => '');
    let parsed: Record<string, any> | null = null;
    try {
      parsed = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      parsed = null;
    }

    if (res.status === 401 || res.status === 403) {
      return {
        configured: true,
        reachable: true,
        authenticated: false,
        httpStatus: res.status,
        mode: config.mode,
        baseUrl: config.baseUrl,
        latencyMs,
        message:
          parsed?.message ||
          `Cashfree ${config.mode} rejected x-client-id / x-client-secret (HTTP ${res.status}). Confirm you bound ${config.mode} credentials.`,
      };
    }

    // 404 (order does not exist), 200, or 400 validation all confirm Cashfree accepted API authentication headers
    if (res.status === 404 || res.status === 200 || res.status === 400) {
      return {
        configured: true,
        reachable: true,
        authenticated: true,
        httpStatus: res.status,
        mode: config.mode,
        baseUrl: config.baseUrl,
        latencyMs,
        message: `Cashfree ${config.mode} API credentials authenticated cleanly (${latencyMs}ms).`,
      };
    }

    return {
      configured: true,
      reachable: true,
      authenticated: false,
      httpStatus: res.status,
      mode: config.mode,
      baseUrl: config.baseUrl,
      latencyMs,
      message: parsed?.message || `Unexpected Cashfree probe response (HTTP ${res.status}).`,
    };
  } catch (err: any) {
    return {
      configured: true,
      reachable: false,
      authenticated: false,
      httpStatus: 0,
      mode: config.mode,
      baseUrl: config.baseUrl,
      latencyMs: Math.max(1, Date.now() - startedAt),
      message: err?.name === 'AbortError'
        ? `Timed out connecting to Cashfree ${config.mode} endpoint (${config.baseUrl}).`
        : err?.message || `Network failure connecting to ${config.baseUrl}`,
    };
  } finally {
    clearTimeout(timer);
  }
}


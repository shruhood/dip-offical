/**
 * Server-Side API Sathi Gateway Client & Verification Handler
 * ----------------------------------------------------------------------------
 * SECURITY NOTICE:
 * - Strictly server-side ONLY. NEVER import this file from React UI components
 *   so `process.env.API_SATHI_KEY` never enters client-side Vite bundles.
 * - API Sathi rules enforced here:
 *   1. Endpoint format: POST https://apisathi.in/gw/v1/<product-slug>/ (trailing slash REQUIRED).
 *   2. Single auth header: `X-API-Key: <key>` (never `X-Tenant-ID`).
 *   3. `Idempotency-Key` UUID per logical request, reused across retries.
 *   4. Minimum 20-second HTTP timeout (`API_SATHI_TIMEOUT_MS = 20_000`).
 *   5. Retries: `429` honors `Retry-After`; `5xx`/`503` max 2 retries `[2000, 6000]` ms;
 *      `400/401/402/404/410/422` are NEVER retried.
 *   6. HTTP 200 verification responses branch on `verified` boolean (`verified: false` is NOT verified).
 *   7. Every response's `call_id` + user `intent` + PII-masked payload is persisted to Firestore.
 *   8. Aadhaar, PAN, mobile, and email fields are masked BEFORE any logging or DB persistence.
 */

export const API_SATHI_BASE_URL = 'https://apisathi.in/gw/v1';
export const API_SATHI_RATES_URL = 'https://apisathi.in/api/v1/rates';
export const API_SATHI_TIMEOUT_MS = 20_000;
export const API_SATHI_5XX_RETRY_BACKOFF_MS = [2000, 6000] as const;

export const DEFAULT_FIREBASE_TARGET = {
  projectId: 'gen-lang-client-0294214396',
  firestoreDatabaseId: 'ai-studio-digitalindiaproj-180a918f-2fe4-4760-acaa-188e54a6b013',
} as const;

export type ApiSathiKeyMode = 'unconfigured' | 'sandbox_test' | 'live_production' | 'unknown';

export type ApiSathiEnvironment = 'SANDBOX' | 'PRODUCTION';

export type ApiSathiProductSlug =
  | 'pan-verification-v1'
  | 'pan-basic-v1'
  | 'pan-aadhaar-link'
  | 'gstin-basic-v1'
  | 'gstin-verify-v1'
  | 'gstin-by-pan-v1'
  | 'driving-license-v1'
  | 'vehicle-rc-v1'
  | 'ifsc-lookup-v1'
  | 'cin-basic-v1'
  | 'mobile-to-udyam-v1'
  | 'voter-id-v1'
  | 'name-match'
  | 'aadhaar-digilocker-init-v1'
  | 'aadhaar-digilocker-fetch-v1';

export type ApiSathiVerificationOutcome =
  | 'VERIFIED'
  | 'NOT_VERIFIED'
  | 'WALLET_EMPTY'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'ERROR'
  | 'STEP1_INITIATED';

// ==============================================================================
// DOCUMENTED REQUEST / RESPONSE TYPES (API Sathi OpenAPI Specs)
// ==============================================================================

/** POST https://apisathi.in/gw/v1/pan-verification-v1/ */
export interface PanVerificationV1Request extends Record<string, unknown> {
  /** 10-character Permanent Account Number (e.g. "ABCDE1234F") */
  pan: string;
}

export interface PanVerificationV1Response {
  call_id?: string;
  verified: boolean;
  result_code?: string;
  message?: string;
  pan?: string;
  name?: string;
  fullname?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  dob?: string;
  category?: string;
  gender?: string;
  aadhaar_linked?: boolean;
  aadhaar_seeding_status?: string;
  masked_aadhaar?: string;
  aadhaar_number?: string;
  status?: string;
  [key: string]: unknown;
}

/** POST https://apisathi.in/gw/v1/gstin-basic-v1/ */
export interface GstinBasicV1Request extends Record<string, unknown> {
  /** 15-character Goods & Services Tax Identification Number (e.g. "26EXIPK0151F1ZQ") */
  gstin: string;
}

export interface GstinBasicV1Response {
  call_id?: string;
  verified: boolean;
  result_code?: string;
  message?: string;
  gstin?: string;
  status?: string;
  gstin_status?: string;
  legal_name?: string;
  trade_name?: string;
  constitution?: string;
  taxpayer_type?: string;
  registration_date?: string;
  cancellation_date?: string | null;
  state_jurisdiction?: string;
  center_jurisdiction?: string;
  principal_address?: Record<string, unknown> | string;
  nature_of_business?: string[];
  [key: string]: unknown;
}

export interface ApiSathiRateItem {
  slug: string;
  name: string;
  category: string;
  pricePaise: number | null;
  priceRupees: number | null;
  available: boolean;
}

export interface ApiSathiProductDescriptor {
  slug: ApiSathiProductSlug;
  name: string;
  category: 'kyc' | 'kyb' | 'vehicle';
  priceRupees: number;
  available: boolean;
  replacesApiSetuRef?: string;
  description: string;
  requiredFields: string[];
  optionalFields?: string[];
  stepType?: 'single' | 'digilocker_step1' | 'digilocker_step2';
}

export const API_SATHI_PRODUCTS: ApiSathiProductDescriptor[] = [
  {
    slug: 'pan-verification-v1',
    name: 'PAN Verification (ITD + Aadhaar Seeding)',
    category: 'kyc',
    priceRupees: 0.98,
    available: true,
    replacesApiSetuRef: 'in.gov.incometax.pan',
    description: 'Validate 10-character PAN, holder name, DOB, category, Aadhaar seeding status, and masked Aadhaar.',
    requiredFields: ['pan'],
    stepType: 'single',
  },
  {
    slug: 'pan-basic-v1',
    name: 'PAN Basic Verification',
    category: 'kyc',
    priceRupees: 0.52,
    available: true,
    description: 'Fast 10-character PAN status and ITD registered name lookup.',
    requiredFields: ['pan'],
    stepType: 'single',
  },
  {
    slug: 'pan-aadhaar-link',
    name: 'PAN–Aadhaar Link Status',
    category: 'kyc',
    priceRupees: 0.39,
    available: true,
    description: 'Check whether a PAN is linked to a 12-digit Aadhaar number.',
    requiredFields: ['pan', 'aadhaar'],
    stepType: 'single',
  },
  {
    slug: 'gstin-basic-v1',
    name: 'GSTIN Authentication Basic',
    category: 'kyb',
    priceRupees: 0.52,
    available: true,
    replacesApiSetuRef: 'in.gov.gst.verify',
    description: 'Verify 15-character GSTIN and retrieve legal name, trade name, constitution, and registration date.',
    requiredFields: ['gstin'],
    stepType: 'single',
  },
  {
    slug: 'gstin-verify-v1',
    name: 'GSTIN Authentication Advanced',
    category: 'kyb',
    priceRupees: 0.85,
    available: true,
    description: 'Detailed GSTN taxpayer status, legal name, constitution, and filing compliance details.',
    requiredFields: ['gstin'],
    stepType: 'single',
  },
  {
    slug: 'gstin-by-pan-v1',
    name: 'GSTIN Search by PAN',
    category: 'kyb',
    priceRupees: 0.46,
    available: true,
    description: 'Discover all active and inactive GST registrations registered against a PAN.',
    requiredFields: ['pan'],
    optionalFields: ['state', 'state_code'],
    stepType: 'single',
  },
  {
    slug: 'ifsc-lookup-v1',
    name: 'IFSC Bank & Branch Lookup',
    category: 'kyc',
    priceRupees: 0.50,
    available: true,
    description: 'Resolve 11-character IFSC into bank, branch, address, MICR, and UPI/IMPS/NEFT/RTGS support.',
    requiredFields: ['ifsc'],
    stepType: 'single',
  },
  {
    slug: 'aadhaar-digilocker-init-v1',
    name: 'Aadhaar DigiLocker — Step 1 (Start Link)',
    category: 'kyc',
    priceRupees: 1.00,
    available: true,
    description: 'Generate a consented DigiLocker URL and persist transaction_id for applicant Aadhaar e-KYC.',
    requiredFields: ['uid'],
    optionalFields: ['mobile', 'emailId', 'firstName', 'lastName', 'isSendOtp', 'isHideExplanationScreen', 'redirectionUrl'],
    stepType: 'digilocker_step1',
  },
  {
    slug: 'aadhaar-digilocker-fetch-v1',
    name: 'Aadhaar DigiLocker — Step 2 (Fetch UIDAI KYC)',
    category: 'kyc',
    priceRupees: 0.98,
    available: true,
    description: 'Fetch verified masked Aadhaar, name, DOB, and address after the applicant finishes DigiLocker.',
    requiredFields: ['transaction_id'],
    stepType: 'digilocker_step2',
  },
  {
    slug: 'driving-license-v1',
    name: 'Driving Licence Verification (Sarathi)',
    category: 'kyc',
    priceRupees: 1.30,
    available: true,
    replacesApiSetuRef: 'in.gov.morth.dl',
    description: 'Verify DL number and DOB (DD/MM/YYYY) against MoRTH transport records.',
    requiredFields: ['dl_number', 'dob'],
    stepType: 'single',
  },
  {
    slug: 'vehicle-rc-v1',
    name: 'Vehicle RC Verification (Vahan)',
    category: 'vehicle',
    priceRupees: 2.93,
    available: true,
    replacesApiSetuRef: 'in.gov.morth.rc',
    description: 'Fetch owner name, maker/model, fuel type, registration, fitness, and insurance validity.',
    requiredFields: ['rc_number'],
    stepType: 'single',
  },
  {
    slug: 'mobile-to-udyam-v1',
    name: 'Mobile to Udyam MSME Lookup',
    category: 'kyb',
    priceRupees: 6.50,
    available: true,
    replacesApiSetuRef: 'in.gov.msme.udyam',
    description: 'Look up Udyam MSME registrations associated with a 10-digit Indian mobile number.',
    requiredFields: ['mobile'],
    stepType: 'single',
  },
  {
    slug: 'cin-basic-v1',
    name: 'Company CIN Validation Basic',
    category: 'kyb',
    priceRupees: 0.65,
    available: true,
    description: 'Verify Corporate Identification Number (CIN) and resolve MCA company name & RoC code.',
    requiredFields: ['cin'],
    stepType: 'single',
  },
  {
    slug: 'voter-id-v1',
    name: 'Voter ID (EPIC) Verification',
    category: 'kyc',
    priceRupees: 0.65,
    available: true,
    description: 'Confirm 10-character EPIC number against electoral roll records.',
    requiredFields: ['epic_number'],
    stepType: 'single',
  },
  {
    slug: 'name-match',
    name: 'Fuzzy & Phonetic Name Match',
    category: 'kyc',
    priceRupees: 0.50,
    available: true,
    description: 'Compare names across PAN, Aadhaar, and bank records with configurable score threshold.',
    requiredFields: ['name1', 'name2'],
    optionalFields: ['threshold'],
    stepType: 'single',
  },
];

// ==============================================================================
// KEY RETRIEVAL & ENVIRONMENT DETECTION
// ==============================================================================

export function normalizeApiSathiKey(rawKey?: string | null): string {
  const trimmed = String(rawKey || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Extracts `API_SATHI_KEY` cleanly from server environment (`process.env.API_SATHI_KEY`
 * or an optional edge Worker `env` object). Never logs or returns the secret to browsers.
 */
export function getApiSathiKey(envOverride?: { API_SATHI_KEY?: string }): string {
  const envVal =
    envOverride?.API_SATHI_KEY ??
    (typeof process !== 'undefined' && process.env ? process.env.API_SATHI_KEY : '');
  return normalizeApiSathiKey(envVal);
}

export function detectApiSathiKeyMode(rawKey?: string | null): ApiSathiKeyMode {
  const key = normalizeApiSathiKey(rawKey);
  if (!key) return 'unconfigured';
  if (key.startsWith('test_')) return 'sandbox_test';
  if (key.startsWith('live_')) return 'live_production';
  return 'unknown';
}

// ==============================================================================
// PII MASKING & SAFE AUDIT LOGGING (Aadhaar / PAN / Mobile / Email)
// ==============================================================================

export function maskPanNumber(rawPan: string): string {
  const clean = String(rawPan || '').trim().toUpperCase();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean)) return 'REDACTED_PAN';
  return `${clean.slice(0, 2)}******${clean.slice(-2)}`;
}

export function maskAadhaarNumber(rawAadhaar: string): string {
  const digits = String(rawAadhaar || '').replace(/\D/g, '');
  if (digits.length < 4) return 'XXXXXXXXXXXX';
  return `XXXXXXXX${digits.slice(-4)}`;
}

export function maskMobileNumber(rawMobile: string): string {
  const digits = String(rawMobile || '').replace(/\D/g, '');
  if (digits.length < 4) return 'XXXXXX';
  return `XXXXXX${digits.slice(-4)}`;
}

export function maskEmailAddress(rawEmail: string): string {
  const s = String(rawEmail || '').trim();
  if (!s.includes('@')) return 'r***@redacted';
  const [local, domain] = s.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

function scrubInlinePiiAndSecrets(input: string): string {
  return input
    // Mask live_ / test_ API keys if accidentally echoed
    .replace(/\b(test|live)_[A-Za-z0-9]{8,}\b/g, '$1_[REDACTED]')
    // Mask inline 10-char PAN numbers (e.g. ABCDE1234F -> AB******4F)
    .replace(/\b([A-Z]{2})[A-Z]{3}[0-9]{4}([A-Z])\b/gi, (_m, p1, p2) => `${p1.toUpperCase()}******${p2.toUpperCase()}`)
    // Mask inline 12-digit Aadhaar numbers (with optional spaces/hyphens)
    .replace(/\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g, (_m, _a, _b, c) => `XXXXXXXX${c}`);
}

export function maskSensitiveValue(key: string, val: unknown, depth = 0): unknown {
  if (val === null || val === undefined) return val;
  if (depth > 6) return '[TRUNCATED]';

  if (Array.isArray(val)) {
    return val.map((item) => maskSensitiveValue(key, item, depth + 1));
  }

  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [childKey, childVal] of Object.entries(val as Record<string, unknown>)) {
      out[childKey] = maskSensitiveValue(childKey, childVal, depth + 1);
    }
    return out;
  }

  if (typeof val !== 'string') return val;

  const s = val.trim();
  const k = key.toLowerCase();

  if (k.includes('api_key') || k.includes('apikey') || k === 'x-api-key' || k === 'secret') {
    return '[REDACTED_SECRET]';
  }
  if (k.includes('pan') && /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(s)) {
    return maskPanNumber(s);
  }
  if (k.includes('aadhaar') || k.includes('aadhar')) {
    const digits = s.replace(/\D/g, '');
    if (digits.length === 12) return maskAadhaarNumber(digits);
    if (/^[Xx*]{6,8}\d{4}$/.test(s)) return `XXXXXXXX${s.slice(-4)}`;
    return s.length > 0 ? 'XXXXXXXX****' : s;
  }
  if ((k.includes('mobile') || k.includes('phone')) && s.replace(/\D/g, '').length >= 6) {
    return maskMobileNumber(s);
  }
  if (k.includes('email') && s.includes('@')) {
    return maskEmailAddress(s);
  }
  if (k.includes('account') && s.replace(/\D/g, '').length >= 6) {
    const d = s.replace(/\D/g, '');
    return `XXXXXX${d.slice(-4)}`;
  }

  return scrubInlinePiiAndSecrets(s);
}

/**
 * Recursively masks Aadhaar, PAN, mobile, email, bank account, and secret patterns
 * BEFORE any logging or Firestore persistence.
 */
export function maskSensitiveData<T extends Record<string, unknown>>(payload: T): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload || {})) {
    masked[k] = maskSensitiveValue(k, v, 0);
  }
  return masked;
}

export function safeLogApiSathiEvent(
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata: Record<string, unknown> = {}
): void {
  const sanitized = maskSensitiveData(metadata);
  const safeMsg = scrubInlinePiiAndSecrets(message);
  const line = `[API_SATHI] ${safeMsg} ${JSON.stringify(sanitized)}`;
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.info(line);
  }
}

// ==============================================================================
// TYPED INTERNAL EXCEPTIONS & ERROR MAPPER
// ==============================================================================

export interface ApiSathiExceptionOptions {
  code: string;
  message: string;
  httpStatus: number;
  callId?: string | null;
  idempotencyKey?: string;
  reason?: string;
  details?: unknown;
  retryAfterSeconds?: number;
  isWalletEmptyError?: boolean;
  isRetiredApi?: boolean;
  isRetryable?: boolean;
  userFriendlyMessage?: string;
  adminMessage?: string;
}

export class ApiSathiException extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly callId: string | null;
  public readonly idempotencyKey?: string;
  public readonly reason?: string;
  public readonly details?: unknown;
  public readonly retryAfterSeconds?: number;
  public readonly isWalletEmptyError: boolean;
  public readonly isRetiredApi: boolean;
  public readonly isRetryable: boolean;
  public readonly userFriendlyMessage: string;
  public readonly adminMessage: string;

  constructor(opts: ApiSathiExceptionOptions) {
    super(opts.message);
    this.name = 'ApiSathiException';
    this.code = opts.code;
    this.httpStatus = opts.httpStatus;
    this.callId = opts.callId ?? null;
    this.idempotencyKey = opts.idempotencyKey;
    this.reason = opts.reason;
    this.details = opts.details;
    this.retryAfterSeconds = opts.retryAfterSeconds;
    this.isWalletEmptyError = Boolean(
      opts.isWalletEmptyError || opts.httpStatus === 402 || opts.code === 'INSUFFICIENT_BALANCE'
    );
    this.isRetiredApi = Boolean(opts.isRetiredApi || opts.httpStatus === 410);
    this.isRetryable = Boolean(opts.isRetryable);
    this.userFriendlyMessage = opts.userFriendlyMessage || opts.message;
    this.adminMessage = opts.adminMessage || opts.message;
  }
}

export const ApiSathiError = ApiSathiException;

export function extractCallIdFromResponse(json: any, headers?: Headers): string | null {
  const fromBody =
    json?.call_id ||
    json?.callId ||
    json?.error?.call_id ||
    json?.meta?.call_id;
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();
  if (headers) {
    const fromHeader = headers.get('x-call-id') || headers.get('x-request-id');
    if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  }
  return null;
}

export function mapApiSathiErrorResponse(params: {
  httpStatus: number;
  productSlug: string;
  bodyJson: any;
  statusText?: string;
  callId: string | null;
  idempotencyKey?: string;
  retryAfterSeconds?: number;
}): ApiSathiException {
  const { httpStatus, productSlug, bodyJson, statusText, callId, idempotencyKey, retryAfterSeconds } = params;
  const errObj = bodyJson?.error && typeof bodyJson.error === 'object' ? bodyJson.error : {};
  const upstreamCode = String(errObj.code || bodyJson?.code || `HTTP_${httpStatus}`);
  const upstreamMsg = scrubInlinePiiAndSecrets(
    String(errObj.message || bodyJson?.message || statusText || 'API Sathi request failed')
  );
  const reason = typeof errObj.reason === 'string' ? errObj.reason : undefined;
  const details = errObj.details ?? bodyJson?.details;

  if (httpStatus === 402 || upstreamCode === 'INSUFFICIENT_BALANCE') {
    return new ApiSathiException({
      code: 'INSUFFICIENT_BALANCE',
      message: 'API Sathi prepaid wallet balance is empty. Admin action required: recharge API Sathi wallet.',
      adminMessage: `API Sathi prepaid wallet balance is empty (402 INSUFFICIENT_BALANCE). Recharge API Sathi wallet immediately. call_id=${callId || 'n/a'}`,
      userFriendlyMessage: 'Verification service is temporarily unavailable. Please contact support or try again shortly.',
      httpStatus: 402,
      callId,
      idempotencyKey,
      reason,
      isWalletEmptyError: true,
      isRetryable: false,
    });
  }

  if (httpStatus === 401) {
    return new ApiSathiException({
      code: upstreamCode || 'UNAUTHORIZED',
      message: 'Invalid or missing API_SATHI_KEY on server.',
      adminMessage: `API Sathi returned 401 UNAUTHORIZED. Check server API_SATHI_KEY. call_id=${callId || 'n/a'}`,
      userFriendlyMessage: 'Verification provider authentication failed. Please contact the platform administrator.',
      httpStatus: 401,
      callId,
      idempotencyKey,
      reason,
      isRetryable: false,
    });
  }

  if (httpStatus === 410) {
    return new ApiSathiException({
      code: upstreamCode || 'API_RETIRED',
      message: `API Sathi endpoint (${productSlug}) has been retired (HTTP 410).`,
      adminMessage: `API Sathi endpoint "${productSlug}" is retired (410). Migrate to active catalogue product. call_id=${callId || 'n/a'}`,
      userFriendlyMessage: 'This verification API is no longer supported. Please select another active verification service.',
      httpStatus: 410,
      callId,
      idempotencyKey,
      reason,
      isRetiredApi: true,
      isRetryable: false,
    });
  }

  if (httpStatus === 400) {
    const detailSuffix =
      Array.isArray(details) && details.length > 0
        ? ` (${details.map((d: any) => (typeof d === 'string' ? d : d?.field || JSON.stringify(d))).join(', ')})`
        : '';
    return new ApiSathiException({
      code: upstreamCode || 'INVALID_REQUEST',
      message: `${upstreamMsg}${detailSuffix}`,
      userFriendlyMessage: `${upstreamMsg}${detailSuffix}`,
      httpStatus: 400,
      callId,
      idempotencyKey,
      reason,
      details,
      isRetryable: false,
    });
  }

  if (httpStatus === 429) {
    return new ApiSathiException({
      code: upstreamCode || 'RATE_LIMITED',
      message: 'API Sathi rate limit reached. Please wait a moment and try again.',
      userFriendlyMessage: 'Too many verification requests. Please wait a few seconds and try again.',
      httpStatus: 429,
      callId,
      idempotencyKey,
      reason,
      retryAfterSeconds,
      isRetryable: true,
    });
  }

  if (httpStatus >= 500) {
    return new ApiSathiException({
      code: upstreamCode || 'UPSTREAM_UNAVAILABLE',
      message: 'API Sathi upstream is temporarily unavailable — please try again shortly.',
      userFriendlyMessage: 'Upstream verification service is temporarily busy — please try again shortly.',
      httpStatus,
      callId,
      idempotencyKey,
      reason,
      isRetryable: true,
    });
  }

  // 404 / 422 / other 4xx: reject input / unknown ref, NEVER retry
  return new ApiSathiException({
    code: upstreamCode,
    message: upstreamMsg,
    userFriendlyMessage: upstreamMsg,
    httpStatus,
    callId,
    idempotencyKey,
    reason,
    details,
    isRetryable: false,
  });
}

// ==============================================================================
// TYPED HTTP CLIENT (20-SECOND TIMEOUT + IDEMPOTENCY + RETRIES)
// ==============================================================================

export interface ApiSathiClientOptions {
  apiKey?: string;
  baseUrl?: string;
  /** Minimum enforced timeout is 20,000ms (20 seconds) per API Sathi specification. */
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
  uuidFn?: () => string;
  retry5xxDelaysMs?: readonly number[];
  max429Retries?: number;
}

export interface ApiSathiCallResult<TData = Record<string, any>> {
  ok: boolean;
  verified: boolean;
  outcome: 'VERIFIED' | 'NOT_VERIFIED';
  resultCode: string | null;
  message: string;
  callId: string | null;
  idempotencyKey: string;
  productSlug: string;
  environment: ApiSathiEnvironment;
  isSandboxTestKey: boolean;
  httpStatus: number;
  latencyMs: number;
  data: TData;
}

export interface ApiSathiHttpClient {
  readonly keyMode: ApiSathiKeyMode;
  readonly isSandboxTestKey: boolean;
  readonly timeoutMs: number;
  invoke<TReq extends Record<string, unknown>, TRes extends Record<string, any> = Record<string, any>>(
    productSlug: ApiSathiProductSlug | string,
    payload: TReq,
    options?: {
      idempotencyKey?: string;
    }
  ): Promise<ApiSathiCallResult<TRes>>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(headerVal: string | null): number {
  if (!headerVal) return 2000;
  const secs = Number(headerVal);
  if (Number.isFinite(secs) && secs >= 0) {
    return Math.min(15_000, Math.max(250, Math.round(secs * 1000)));
  }
  const dateMs = Date.parse(headerVal);
  if (Number.isFinite(dateMs)) {
    const diff = dateMs - Date.now();
    return Math.min(15_000, Math.max(250, diff));
  }
  return 2000;
}

export function createApiSathiClient(opts: ApiSathiClientOptions = {}): ApiSathiHttpClient {
  const apiKey = normalizeApiSathiKey(opts.apiKey ?? getApiSathiKey());
  if (!apiKey) {
    throw new ApiSathiException({
      code: 'API_SATHI_NOT_CONFIGURED',
      message: 'API_SATHI_KEY is not configured on the server.',
      userFriendlyMessage: 'Verification service is not configured yet. Please contact the administrator.',
      httpStatus: 503,
    });
  }

  const keyMode = detectApiSathiKeyMode(apiKey);
  const isSandboxTestKey = keyMode === 'sandbox_test';
  const baseUrl = String(opts.baseUrl || API_SATHI_BASE_URL).replace(/\/+$/, '');
  // Always enforce at least 20,000ms (20s) timeout per API Sathi specification
  const timeoutMs = Math.max(API_SATHI_TIMEOUT_MS, opts.timeoutMs ?? API_SATHI_TIMEOUT_MS);
  const fetchFn = opts.fetchFn || fetch;
  const sleepFn = opts.sleepFn || defaultSleep;
  const uuidFn = opts.uuidFn || (() => crypto.randomUUID());
  const retry5xxDelays = opts.retry5xxDelaysMs ?? API_SATHI_5XX_RETRY_BACKOFF_MS;
  const max429Retries = opts.max429Retries ?? 2;

  return {
    keyMode,
    isSandboxTestKey,
    timeoutMs,
    async invoke<TReq extends Record<string, unknown>, TRes extends Record<string, any>>(
      productSlug: ApiSathiProductSlug | string,
      payload: TReq,
      callOpts?: { idempotencyKey?: string }
    ): Promise<ApiSathiCallResult<TRes>> {
      const cleanSlug = String(productSlug || '').replace(/^\/+|\/+$/g, '');
      if (!cleanSlug) {
        throw new ApiSathiException({
          code: 'INVALID_REQUEST',
          message: 'Product slug is required.',
          httpStatus: 400,
        });
      }

      // Trailing slash is REQUIRED by API Sathi gateway (missing slash yields 404)
      const url = `${baseUrl}/${cleanSlug}/`;
      const idempotencyKey = callOpts?.idempotencyKey || uuidFn();
      const startedAt = Date.now();

      let fiveXxAttempt = 0;
      let rateLimitAttempt = 0;

      while (true) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let response: Response;
        try {
          response = await fetchFn(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey,
              'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        } catch (err: any) {
          clearTimeout(timer);
          if (fiveXxAttempt < retry5xxDelays.length) {
            const delay = retry5xxDelays[fiveXxAttempt];
            fiveXxAttempt += 1;
            await sleepFn(delay);
            continue;
          }
          const isAbort = err?.name === 'AbortError';
          throw new ApiSathiException({
            code: isAbort ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_NETWORK_ERROR',
            message: isAbort
              ? 'API Sathi request timed out after 20s — please try again shortly.'
              : 'Unable to reach API Sathi upstream — please try again shortly.',
            userFriendlyMessage: 'Upstream verification gateway timed out — please try again shortly.',
            httpStatus: 503,
            callId: null,
            idempotencyKey,
            isRetryable: true,
          });
        } finally {
          clearTimeout(timer);
        }

        const rawText = await response.text().catch(() => '');
        let json: any = null;
        if (rawText) {
          try {
            json = JSON.parse(rawText);
          } catch {
            json = null;
          }
        }

        const callId = extractCallIdFromResponse(json, response.headers);

        if (response.status === 200 && json && typeof json === 'object') {
          const data = json as TRes;
          let verified = true;
          if (typeof (data as any).verified === 'boolean') {
            verified = Boolean((data as any).verified);
          } else if (cleanSlug === 'name-match' && typeof (data as any).match === 'boolean') {
            verified = Boolean((data as any).match);
          } else if (cleanSlug === 'ifsc-lookup-v1') {
            verified = Boolean((data as any).ifsc || (data as any).bank);
          }

          const resultCode =
            typeof (data as any).result_code === 'string'
              ? (data as any).result_code
              : typeof (data as any).code === 'string'
              ? (data as any).code
              : null;

          const message =
            typeof (data as any).message === 'string' && (data as any).message.trim()
              ? (data as any).message.trim()
              : verified
              ? `Verification succeeded for ${cleanSlug}.`
              : `No matching record found for ${cleanSlug} (${resultCode || 'NOT_VERIFIED'}).`;

          return {
            ok: verified,
            verified,
            outcome: verified ? 'VERIFIED' : 'NOT_VERIFIED',
            resultCode,
            message,
            callId,
            idempotencyKey,
            productSlug: cleanSlug,
            environment: isSandboxTestKey ? 'SANDBOX' : 'PRODUCTION',
            isSandboxTestKey,
            httpStatus: 200,
            latencyMs: Math.max(1, Date.now() - startedAt),
            data,
          };
        }

        if (response.status === 429) {
          const retryMs = parseRetryAfterMs(response.headers.get('Retry-After'));
          if (rateLimitAttempt < max429Retries) {
            rateLimitAttempt += 1;
            await sleepFn(retryMs);
            continue;
          }
          throw mapApiSathiErrorResponse({
            httpStatus: 429,
            productSlug: cleanSlug,
            bodyJson: json,
            statusText: response.statusText,
            callId,
            idempotencyKey,
            retryAfterSeconds: Math.ceil(retryMs / 1000),
          });
        }

        if (response.status >= 500) {
          if (fiveXxAttempt < retry5xxDelays.length) {
            const delay = retry5xxDelays[fiveXxAttempt];
            fiveXxAttempt += 1;
            await sleepFn(delay);
            continue;
          }
          throw mapApiSathiErrorResponse({
            httpStatus: response.status,
            productSlug: cleanSlug,
            bodyJson: json,
            statusText: response.statusText,
            callId,
            idempotencyKey,
          });
        }

        // All other status codes (400, 401, 402, 404, 410, 422): map directly, never retry
        throw mapApiSathiErrorResponse({
          httpStatus: response.status,
          productSlug: cleanSlug,
          bodyJson: json,
          statusText: response.statusText,
          callId,
          idempotencyKey,
        });
      }
    },
  };
}

// ==============================================================================
// STRICT SCHEMA VALIDATORS & TYPED PRODUCT FUNCTIONS
// ==============================================================================

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAAR_REGEX = /^[0-9]{12}$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const DL_REGEX = /^[A-Za-z0-9/]{13,25}$/;
const DL_DOB_REGEX = /^[0-3][0-9]\/[01][0-9]\/[12][0-9]{3}$/;
const RC_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/;
const MOBILE_REGEX = /^[6-9][0-9]{9}$/;
const EPIC_REGEX = /^[A-Z]{3}[0-9]{7}$/;
const TX_ID_REGEX = /^[0-9]{6,32}$/;
const DL_UID_REGEX = /^[\w.@-]{1,80}$/;

function validationFail(message: string, field?: string): never {
  throw new ApiSathiException({
    code: 'INVALID_INPUT',
    message,
    userFriendlyMessage: message,
    httpStatus: 400,
    details: field ? [{ field, message }] : undefined,
  });
}

export function normalizeDobToDdMmYyyy(raw: string): string {
  const s = String(raw || '').trim();
  if (DL_DOB_REGEX.test(s)) return s;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const dash = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (dash) return `${dash[1]}/${dash[2]}/${dash[3]}`;
  return s;
}

/**
 * Typed verification function for `pan-verification-v1`.
 * Validated request shape: `{ pan: string }`. Unknown fields stripped before sending.
 */
export async function verifyPanVerificationV1(
  clientOrInput: ApiSathiHttpClient | PanVerificationV1Request,
  maybeInputOrOpts?: PanVerificationV1Request | { idempotencyKey?: string; envOverride?: { API_SATHI_KEY?: string } },
  maybeCallOpts?: { idempotencyKey?: string }
): Promise<ApiSathiCallResult<PanVerificationV1Response>> {
  const isClient = typeof (clientOrInput as ApiSathiHttpClient)?.invoke === 'function';
  const client = isClient
    ? (clientOrInput as ApiSathiHttpClient)
    : createApiSathiClient({
        apiKey: getApiSathiKey((maybeInputOrOpts as any)?.envOverride),
      });
  const input = isClient ? (maybeInputOrOpts as PanVerificationV1Request) : (clientOrInput as PanVerificationV1Request);
  const callOpts = isClient ? maybeCallOpts : (maybeInputOrOpts as { idempotencyKey?: string } | undefined);

  const pan = String(input?.pan || '').trim().toUpperCase();
  if (!PAN_REGEX.test(pan)) {
    validationFail('PAN must be 10 characters in format ABCDE1234F.', 'pan');
  }
  return client.invoke<PanVerificationV1Request, PanVerificationV1Response>('pan-verification-v1', { pan }, callOpts);
}

/**
 * Typed verification function for `gstin-basic-v1`.
 * Validated request shape: `{ gstin: string }`. Unknown fields stripped before sending.
 */
export async function verifyGstinBasicV1(
  clientOrInput: ApiSathiHttpClient | GstinBasicV1Request,
  maybeInputOrOpts?: GstinBasicV1Request | { idempotencyKey?: string; envOverride?: { API_SATHI_KEY?: string } },
  maybeCallOpts?: { idempotencyKey?: string }
): Promise<ApiSathiCallResult<GstinBasicV1Response>> {
  const isClient = typeof (clientOrInput as ApiSathiHttpClient)?.invoke === 'function';
  const client = isClient
    ? (clientOrInput as ApiSathiHttpClient)
    : createApiSathiClient({
        apiKey: getApiSathiKey((maybeInputOrOpts as any)?.envOverride),
      });
  const input = isClient ? (maybeInputOrOpts as GstinBasicV1Request) : (clientOrInput as GstinBasicV1Request);
  const callOpts = isClient ? maybeCallOpts : (maybeInputOrOpts as { idempotencyKey?: string } | undefined);

  const gstin = String(input?.gstin || '').trim().toUpperCase();
  if (!GSTIN_REGEX.test(gstin)) {
    validationFail('GSTIN must be a valid 15-character tax ID.', 'gstin');
  }
  return client.invoke<GstinBasicV1Request, GstinBasicV1Response>('gstin-basic-v1', { gstin }, callOpts);
}

// Aliases matching existing callers
export const verifyPan = verifyPanVerificationV1;
export const verifyGstinBasic = verifyGstinBasicV1;

export async function verifyPanBasic(
  client: ApiSathiHttpClient,
  input: { pan: string },
  callOpts?: { idempotencyKey?: string }
) {
  const pan = String(input.pan || '').trim().toUpperCase();
  if (!PAN_REGEX.test(pan)) validationFail('PAN must be 10 characters in format ABCDE1234F.', 'pan');
  return client.invoke<{ pan: string }, { verified: boolean; pan?: string; name?: string; status?: string }>(
    'pan-basic-v1',
    { pan },
    callOpts
  );
}

export async function checkPanAadhaarLink(
  client: ApiSathiHttpClient,
  input: { pan: string; aadhaar: string },
  callOpts?: { idempotencyKey?: string }
) {
  const pan = String(input.pan || '').trim().toUpperCase();
  const aadhaar = String(input.aadhaar || '').replace(/[\s-]/g, '');
  if (!PAN_REGEX.test(pan)) validationFail('PAN must be 10 characters in format ABCDE1234F.', 'pan');
  if (!AADHAAR_REGEX.test(aadhaar)) validationFail('Aadhaar must be a valid 12-digit number.', 'aadhaar');
  return client.invoke<{ pan: string; aadhaar: string }, { verified: boolean; linked?: boolean; message?: string; code?: string }>(
    'pan-aadhaar-link',
    { pan, aadhaar },
    callOpts
  );
}

export async function verifyGstinAdvanced(
  client: ApiSathiHttpClient,
  input: { gstin: string },
  callOpts?: { idempotencyKey?: string }
) {
  const gstin = String(input.gstin || '').trim().toUpperCase();
  if (!GSTIN_REGEX.test(gstin)) validationFail('GSTIN must be a valid 15-character tax ID.', 'gstin');
  return client.invoke<{ gstin: string }, GstinBasicV1Response>('gstin-verify-v1', { gstin }, callOpts);
}

export async function searchGstinByPan(
  client: ApiSathiHttpClient,
  input: { pan: string; state?: string; state_code?: string },
  callOpts?: { idempotencyKey?: string }
) {
  const pan = String(input.pan || '').trim().toUpperCase();
  if (!PAN_REGEX.test(pan)) validationFail('PAN must be 10 characters in format ABCDE1234F.', 'pan');
  const body: { pan: string; state?: string; state_code?: string } = { pan };
  if (typeof input.state === 'string' && input.state.trim()) body.state = input.state.trim();
  if (typeof input.state_code === 'string' && input.state_code.trim()) body.state_code = input.state_code.trim();
  return client.invoke<typeof body, { verified: boolean; count?: number; gstin_list?: any[] }>(
    'gstin-by-pan-v1',
    body,
    callOpts
  );
}

export async function verifyDrivingLicense(
  client: ApiSathiHttpClient,
  input: { dl_number: string; dob: string },
  callOpts?: { idempotencyKey?: string }
) {
  const dl_number = String(input.dl_number || '').replace(/[\s-]/g, '').toUpperCase();
  const dob = normalizeDobToDdMmYyyy(input.dob);
  if (!DL_REGEX.test(dl_number)) {
    validationFail('Driving Licence number must be 13–25 alphanumeric characters without spaces or hyphens.', 'dl_number');
  }
  if (!DL_DOB_REGEX.test(dob)) {
    validationFail('Date of birth must be formatted as DD/MM/YYYY (e.g. 15/01/1990).', 'dob');
  }
  return client.invoke<{ dl_number: string; dob: string }, Record<string, any>>(
    'driving-license-v1',
    { dl_number, dob },
    callOpts
  );
}

export async function verifyVehicleRc(
  client: ApiSathiHttpClient,
  input: { rc_number: string },
  callOpts?: { idempotencyKey?: string }
) {
  const rc_number = String(input.rc_number || '').replace(/[\s-]/g, '').toUpperCase();
  if (!RC_REGEX.test(rc_number)) {
    validationFail('Vehicle RC number must be a valid Indian registration number (e.g. MH12DE1433).', 'rc_number');
  }
  return client.invoke<{ rc_number: string }, Record<string, any>>('vehicle-rc-v1', { rc_number }, callOpts);
}

export async function lookupIfsc(
  client: ApiSathiHttpClient,
  input: { ifsc: string },
  callOpts?: { idempotencyKey?: string }
) {
  const ifsc = String(input.ifsc || '').trim().toUpperCase();
  if (!IFSC_REGEX.test(ifsc)) validationFail('IFSC code must be 11 characters (e.g. SBIN0001234).', 'ifsc');
  return client.invoke<{ ifsc: string }, Record<string, any>>('ifsc-lookup-v1', { ifsc }, callOpts);
}

export async function verifyCinBasic(
  client: ApiSathiHttpClient,
  input: { cin: string },
  callOpts?: { idempotencyKey?: string }
) {
  const cin = String(input.cin || '').trim().toUpperCase();
  if (cin.length < 15 || cin.length > 25) validationFail('CIN must be a valid Corporate Identification Number.', 'cin');
  return client.invoke<{ cin: string }, Record<string, any>>('cin-basic-v1', { cin }, callOpts);
}

export async function lookupUdyamByMobile(
  client: ApiSathiHttpClient,
  input: { mobile: string },
  callOpts?: { idempotencyKey?: string }
) {
  const mobile = String(input.mobile || '').replace(/\D/g, '').slice(-10);
  if (!MOBILE_REGEX.test(mobile)) validationFail('Mobile number must be 10 digits starting with 6–9.', 'mobile');
  return client.invoke<{ mobile: string }, Record<string, any>>('mobile-to-udyam-v1', { mobile }, callOpts);
}

export async function verifyVoterId(
  client: ApiSathiHttpClient,
  input: { epic_number: string },
  callOpts?: { idempotencyKey?: string }
) {
  const epic_number = String(input.epic_number || '').trim().toUpperCase();
  if (!EPIC_REGEX.test(epic_number)) {
    validationFail('EPIC number must be 3 letters followed by 7 digits (e.g. ABC1234567).', 'epic_number');
  }
  return client.invoke<{ epic_number: string }, Record<string, any>>('voter-id-v1', { epic_number }, callOpts);
}

export async function matchNames(
  client: ApiSathiHttpClient,
  input: { name1: string; name2: string; threshold?: number },
  callOpts?: { idempotencyKey?: string }
) {
  const name1 = String(input.name1 || '').trim().slice(0, 200);
  const name2 = String(input.name2 || '').trim().slice(0, 200);
  if (!name1 || !name2) validationFail('Both name1 and name2 are required.', 'name1');
  const payload: { name1: string; name2: string; threshold?: number } = { name1, name2 };
  if (typeof input.threshold === 'number' && input.threshold >= 0 && input.threshold <= 100) {
    payload.threshold = input.threshold;
  }
  return client.invoke<typeof payload, Record<string, any>>('name-match', payload, callOpts);
}

export async function initAadhaarDigilocker(
  client: ApiSathiHttpClient,
  input: {
    uid: string;
    mobile?: string;
    emailId?: string;
    firstName?: string;
    lastName?: string;
    isSendOtp?: boolean;
    isHideExplanationScreen?: boolean;
    redirectionUrl?: string;
  },
  callOpts?: { idempotencyKey?: string }
) {
  const uid = String(input.uid || '').trim();
  if (!DL_UID_REGEX.test(uid)) {
    validationFail('uid must be 1–80 chars using word chars, dots, @, or hyphens.', 'uid');
  }
  const cleanMobile = input.mobile ? String(input.mobile).replace(/\D/g, '').slice(-10) : '';
  const cleanEmail = input.emailId ? String(input.emailId).trim() : '';
  if (!cleanMobile && !cleanEmail) {
    validationFail('Either a 10-digit mobile number or emailId is required to initiate DigiLocker KYC.', 'mobile');
  }
  if (cleanMobile && !MOBILE_REGEX.test(cleanMobile)) {
    validationFail('Mobile number must be 10 digits starting with 6–9.', 'mobile');
  }

  const body: Record<string, unknown> = { uid };
  if (cleanMobile) body.mobile = cleanMobile;
  if (cleanEmail) body.emailId = cleanEmail;
  if (input.firstName?.trim()) body.firstName = input.firstName.trim().slice(0, 45);
  if (input.lastName?.trim()) body.lastName = input.lastName.trim().slice(0, 45);
  if (typeof input.isSendOtp === 'boolean') body.isSendOtp = input.isSendOtp;
  if (typeof input.isHideExplanationScreen === 'boolean') body.isHideExplanationScreen = input.isHideExplanationScreen;
  if (input.redirectionUrl?.trim()) body.redirectionUrl = input.redirectionUrl.trim().slice(0, 512);

  return client.invoke<typeof body, { transaction_id: string; kyc_url: string; short_url?: string; verified: boolean }>(
    'aadhaar-digilocker-init-v1',
    body,
    callOpts
  );
}

export async function fetchAadhaarDigilocker(
  client: ApiSathiHttpClient,
  input: { transaction_id: string },
  callOpts?: { idempotencyKey?: string }
) {
  const transaction_id = String(input.transaction_id || '').trim();
  if (!TX_ID_REGEX.test(transaction_id)) {
    validationFail('transaction_id must be the numeric ID returned by DigiLocker step 1.', 'transaction_id');
  }
  return client.invoke<{ transaction_id: string }, Record<string, any>>(
    'aadhaar-digilocker-fetch-v1',
    { transaction_id },
    callOpts
  );
}

/**
 * Validates and allowlists ONLY documented request fields for a given productSlug before calling API Sathi.
 */
export function validateAndSanitizeApiSathiInput(
  slug: string,
  params: Record<string, any>
): { productSlug: string; sanitizedInput: Record<string, unknown> } {
  const cleanSlug = String(slug || '').trim();
  const p = params && typeof params === 'object' ? params : {};

  switch (cleanSlug) {
    case 'pan-verification-v1':
    case 'pan-basic-v1': {
      const pan = String(p.pan || p.identifier || '').trim().toUpperCase();
      if (!PAN_REGEX.test(pan)) validationFail('PAN must be 10 characters in format ABCDE1234F.', 'pan');
      return { productSlug: cleanSlug, sanitizedInput: { pan } };
    }
    case 'pan-aadhaar-link': {
      const pan = String(p.pan || p.identifier || '').trim().toUpperCase();
      const aadhaar = String(p.aadhaar || '').replace(/[\s-]/g, '');
      if (!PAN_REGEX.test(pan)) validationFail('PAN must be 10 characters in format ABCDE1234F.', 'pan');
      if (!AADHAAR_REGEX.test(aadhaar)) validationFail('Aadhaar must be a valid 12-digit number.', 'aadhaar');
      return { productSlug: cleanSlug, sanitizedInput: { pan, aadhaar } };
    }
    case 'gstin-basic-v1':
    case 'gstin-verify-v1': {
      const gstin = String(p.gstin || p.identifier || '').trim().toUpperCase();
      if (!GSTIN_REGEX.test(gstin)) validationFail('GSTIN must be a valid 15-character tax ID.', 'gstin');
      return { productSlug: cleanSlug, sanitizedInput: { gstin } };
    }
    case 'gstin-by-pan-v1': {
      const pan = String(p.pan || p.identifier || '').trim().toUpperCase();
      if (!PAN_REGEX.test(pan)) validationFail('PAN must be 10 characters in format ABCDE1234F.', 'pan');
      const out: Record<string, unknown> = { pan };
      if (typeof p.state === 'string' && p.state.trim()) out.state = p.state.trim();
      if (typeof p.state_code === 'string' && p.state_code.trim()) out.state_code = p.state_code.trim();
      return { productSlug: cleanSlug, sanitizedInput: out };
    }
    case 'driving-license-v1': {
      const dl_number = String(p.dl_number || p.dlNumber || p.identifier || '').replace(/[\s-]/g, '').toUpperCase();
      const dob = normalizeDobToDdMmYyyy(String(p.dob || ''));
      if (!DL_REGEX.test(dl_number)) {
        validationFail('Driving Licence number must be 13–25 alphanumeric characters without spaces or hyphens.', 'dl_number');
      }
      if (!DL_DOB_REGEX.test(dob)) {
        validationFail('Date of birth must be formatted as DD/MM/YYYY (e.g. 15/01/1990).', 'dob');
      }
      return { productSlug: cleanSlug, sanitizedInput: { dl_number, dob } };
    }
    case 'vehicle-rc-v1': {
      const rc_number = String(p.rc_number || p.rcNumber || p.identifier || '').replace(/[\s-]/g, '').toUpperCase();
      if (!RC_REGEX.test(rc_number)) {
        validationFail('Vehicle RC number must be a valid Indian registration number (e.g. MH12DE1433).', 'rc_number');
      }
      return { productSlug: cleanSlug, sanitizedInput: { rc_number } };
    }
    case 'ifsc-lookup-v1': {
      const ifsc = String(p.ifsc || p.identifier || '').trim().toUpperCase();
      if (!IFSC_REGEX.test(ifsc)) validationFail('IFSC code must be 11 characters (e.g. SBIN0001234).', 'ifsc');
      return { productSlug: cleanSlug, sanitizedInput: { ifsc } };
    }
    case 'cin-basic-v1': {
      const cin = String(p.cin || p.identifier || '').trim().toUpperCase();
      if (cin.length < 15 || cin.length > 25) validationFail('CIN must be a valid Corporate Identification Number.', 'cin');
      return { productSlug: cleanSlug, sanitizedInput: { cin } };
    }
    case 'mobile-to-udyam-v1': {
      const mobile = String(p.mobile || p.identifier || '').replace(/\D/g, '').slice(-10);
      if (!MOBILE_REGEX.test(mobile)) validationFail('Mobile number must be 10 digits starting with 6–9.', 'mobile');
      return { productSlug: cleanSlug, sanitizedInput: { mobile } };
    }
    case 'voter-id-v1': {
      const epic_number = String(p.epic_number || p.identifier || '').trim().toUpperCase();
      if (!EPIC_REGEX.test(epic_number)) {
        validationFail('EPIC number must be 3 letters followed by 7 digits (e.g. ABC1234567).', 'epic_number');
      }
      return { productSlug: cleanSlug, sanitizedInput: { epic_number } };
    }
    case 'name-match': {
      const name1 = String(p.name1 || '').trim().slice(0, 200);
      const name2 = String(p.name2 || '').trim().slice(0, 200);
      if (!name1 || !name2) validationFail('Both name1 and name2 are required.', 'name1');
      const out: Record<string, unknown> = { name1, name2 };
      if (p.threshold !== undefined && p.threshold !== '') {
        const t = Number(p.threshold);
        if (Number.isFinite(t) && t >= 0 && t <= 100) out.threshold = t;
      }
      return { productSlug: cleanSlug, sanitizedInput: out };
    }
    default:
      throw new ApiSathiException({
        code: 'UNSUPPORTED_PRODUCT',
        message: `Product "${cleanSlug}" is not enabled in API Sathi router.`,
        userFriendlyMessage: `Verification product "${cleanSlug}" is not supported.`,
        httpStatus: 400,
      });
  }
}

export async function executeApiSathiProduct(
  client: ApiSathiHttpClient,
  slug: string,
  params: Record<string, any>,
  callOpts?: { idempotencyKey?: string }
): Promise<{ result: ApiSathiCallResult; sanitizedInput: Record<string, unknown> }> {
  const { productSlug, sanitizedInput } = validateAndSanitizeApiSathiInput(slug, params);
  const result = await client.invoke(productSlug, sanitizedInput, callOpts);
  return { result, sanitizedInput };
}

export async function fetchLiveApiSathiRates(fetchFn: typeof fetch = fetch): Promise<ApiSathiRateItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetchFn(API_SATHI_RATES_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data: any = await res.json().catch(() => null);
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data?.products)
      ? data.products
      : Array.isArray(data?.rates)
      ? data.rates
      : [];
    return list as ApiSathiRateItem[];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ==============================================================================
// FIRESTORE PERSISTENCE (api_sathi_verifications WITH call_id + intent + MASKED PII)
// ==============================================================================

export interface ApiSathiFirestoreVerificationRecord {
  id: string;
  userId: string;
  intent: string;
  productSlug: string;
  callId: string;
  idempotencyKey: string;
  environment: ApiSathiEnvironment;
  isSandboxTest: boolean;
  httpStatus: number;
  verified: boolean;
  outcome: ApiSathiVerificationOutcome;
  errorCode?: string;
  errorMessage?: string;
  maskedRequestJson: string;
  maskedResponseJson: string;
  latencyMs: number;
  createdAt: string;
}

export interface PersistFirestoreResult {
  persisted: boolean;
  documentId: string;
  collection: 'api_sathi_verifications';
  path: string;
  httpStatus?: number;
  reason?: string;
}

type FirestoreTypedValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { nullValue: null };

export function toFirestoreFields(record: ApiSathiFirestoreVerificationRecord): Record<string, FirestoreTypedValue> {
  const fields: Record<string, FirestoreTypedValue> = {
    id: { stringValue: record.id.slice(0, 80) },
    userId: { stringValue: record.userId.slice(0, 128) },
    intent: { stringValue: record.intent.slice(0, 80) },
    productSlug: { stringValue: record.productSlug.slice(0, 80) },
    callId: { stringValue: (record.callId || '').slice(0, 128) },
    idempotencyKey: { stringValue: record.idempotencyKey.slice(0, 80) },
    environment: { stringValue: record.environment },
    isSandboxTest: { booleanValue: Boolean(record.isSandboxTest) },
    httpStatus: { integerValue: String(Math.max(0, Math.min(599, Math.round(record.httpStatus)))) },
    verified: { booleanValue: Boolean(record.verified) },
    outcome: { stringValue: record.outcome },
    maskedRequestJson: { stringValue: record.maskedRequestJson.slice(0, 1500) },
    maskedResponseJson: { stringValue: record.maskedResponseJson.slice(0, 2000) },
    latencyMs: { integerValue: String(Math.max(0, Math.round(record.latencyMs))) },
    createdAt: { stringValue: record.createdAt.slice(0, 50) },
  };
  if (record.errorCode) {
    fields.errorCode = { stringValue: record.errorCode.slice(0, 80) };
  }
  if (record.errorMessage) {
    fields.errorMessage = { stringValue: record.errorMessage.slice(0, 500) };
  }
  return fields;
}

export function buildFirestoreVerificationRecord(input: {
  id?: string;
  userId: string;
  intent: string;
  productSlug: string;
  callId: string | null;
  idempotencyKey: string;
  environment: ApiSathiEnvironment;
  isSandboxTest: boolean;
  httpStatus: number;
  verified: boolean;
  outcome: ApiSathiVerificationOutcome;
  errorCode?: string | null;
  errorMessage?: string | null;
  rawRequestPayload: Record<string, unknown>;
  rawResponsePayload?: Record<string, unknown> | null;
  latencyMs: number;
  createdAt?: string;
}): ApiSathiFirestoreVerificationRecord {
  const safeId = String(input.id || `asv_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80);

  const maskedReq = JSON.stringify(maskSensitiveData(input.rawRequestPayload || {})).slice(0, 1500);
  const maskedRes = JSON.stringify(maskSensitiveData(input.rawResponsePayload || {})).slice(0, 2000);

  return {
    id: safeId,
    userId: String(input.userId || 'local_dev_user').slice(0, 128),
    intent: String(input.intent || 'kyc_verification').trim().slice(0, 80) || 'kyc_verification',
    productSlug: String(input.productSlug || '').trim().slice(0, 80),
    callId: String(input.callId || '').slice(0, 128),
    idempotencyKey: String(input.idempotencyKey || crypto.randomUUID()).slice(0, 80),
    environment: input.environment,
    isSandboxTest: Boolean(input.isSandboxTest),
    httpStatus: Number(input.httpStatus || 0),
    verified: Boolean(input.verified),
    outcome: input.outcome,
    ...(input.errorCode ? { errorCode: String(input.errorCode).slice(0, 80) } : {}),
    ...(input.errorMessage ? { errorMessage: scrubInlinePiiAndSecrets(String(input.errorMessage)).slice(0, 500) } : {}),
    maskedRequestJson: maskedReq,
    maskedResponseJson: maskedRes,
    latencyMs: Math.max(0, Math.round(Number(input.latencyMs || 0))),
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

/**
 * Persists a PII-masked API Sathi verification audit document (including `call_id` + `intent`)
 * to Cloud Firestore via the Firestore REST API using the authenticated user's Bearer ID token
 * so `firestore.rules` ownership/schema validation is enforced automatically.
 */
export async function persistApiSathiVerificationToFirestore(
  record: ApiSathiFirestoreVerificationRecord,
  options: {
    userIdToken?: string | null;
    projectId?: string;
    databaseId?: string;
    fetchFn?: typeof fetch;
  } = {}
): Promise<PersistFirestoreResult> {
  const projectId =
    options.projectId ||
    (typeof process !== 'undefined' && process.env?.FIREBASE_PROJECT_ID) ||
    DEFAULT_FIREBASE_TARGET.projectId;
  const databaseId =
    options.databaseId ||
    (typeof process !== 'undefined' && process.env?.FIREBASE_DATABASE_ID) ||
    DEFAULT_FIREBASE_TARGET.firestoreDatabaseId;
  const path = `projects/${projectId}/databases/${databaseId}/documents/api_sathi_verifications/${record.id}`;

  const token = String(options.userIdToken || '').trim();
  if (!token) {
    return {
      persisted: false,
      documentId: record.id,
      collection: 'api_sathi_verifications',
      path,
      reason: 'NO_FIREBASE_ID_TOKEN',
    };
  }

  const fetchFn = options.fetchFn || fetch;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents/api_sathi_verifications?documentId=${encodeURIComponent(record.id)}`;

  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fields: toFirestoreFields(record),
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      safeLogApiSathiEvent('warn', 'Firestore REST persistence skipped/rejected', {
        httpStatus: res.status,
        documentId: record.id,
        reason: errText.slice(0, 200),
      });
      return {
        persisted: false,
        documentId: record.id,
        collection: 'api_sathi_verifications',
        path,
        httpStatus: res.status,
        reason: `FIRESTORE_HTTP_${res.status}`,
      };
    }

    return {
      persisted: true,
      documentId: record.id,
      collection: 'api_sathi_verifications',
      path,
      httpStatus: res.status,
    };
  } catch (err: any) {
    safeLogApiSathiEvent('warn', 'Firestore REST persistence network error', {
      documentId: record.id,
      error: err?.message || 'Unknown error',
    });
    return {
      persisted: false,
      documentId: record.id,
      collection: 'api_sathi_verifications',
      path,
      reason: err?.message || 'NETWORK_ERROR',
    };
  }
}

// ==============================================================================
// UNIFIED 6-STEP BACKEND ENDPOINT ORCHESTRATOR
// ==============================================================================

export interface HandleApiSathiVerificationInput {
  productSlug: string;
  parameters: Record<string, unknown>;
  consentGiven: boolean;
  intent?: string;
  userId: string;
  isAdmin?: boolean;
  firebaseIdToken?: string | null;
  envOverride?: { API_SATHI_KEY?: string };
  fetchFn?: typeof fetch;
  firestoreFetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
  uuidFn?: () => string;
  timeoutMs?: number;
}

export interface HandleApiSathiVerificationOutput {
  httpStatus: number;
  body: {
    success: boolean;
    status: 'SUCCESS' | 'FAILED' | 'REJECTED';
    message: string;
    referenceId?: string;
    errorCode?: string;
    data: Record<string, unknown> | null;
  };
  auditRecord: ApiSathiFirestoreVerificationRecord | null;
  firestoreResult: PersistFirestoreResult | null;
  idempotencyKey?: string;
  sanitizedInput?: Record<string, unknown>;
  isRetryable?: boolean;
  retryAfterSeconds?: number;
}

/**
 * Executes the 6-step verification flow:
 * 1) Extract `API_SATHI_KEY`
 * 2) Validate input against expected product request schema
 * 3) Generate `Idempotency-Key` UUID
 * 4) Execute API Sathi call
 * 5) Mask PII & log safely + persist response, `call_id`, and `intent` to Firestore
 * 6) Return verified result or user-friendly error message
 */
export async function handleApiSathiVerification(
  input: HandleApiSathiVerificationInput
): Promise<HandleApiSathiVerificationOutput> {
  const userId = String(input.userId || '').trim() || 'anonymous';
  const isAdmin = Boolean(input.isAdmin);
  const slug = String(input.productSlug || '').trim();
  const intent = String(input.intent || `${slug || 'kyc'}_verification`).trim().slice(0, 80);

  if (!input.consentGiven) {
    return {
      httpStatus: 403,
      body: {
        success: false,
        status: 'REJECTED',
        message: 'Explicit user/customer consent is required before verification.',
        errorCode: 'CONSENT_DENIED',
        data: null,
      },
      auditRecord: null,
      firestoreResult: null,
    };
  }

  // Step 1: Extract API Key
  const apiKey = getApiSathiKey(input.envOverride);
  if (!apiKey) {
    return {
      httpStatus: 503,
      body: {
        success: false,
        status: 'FAILED',
        message: isAdmin
          ? 'API_SATHI_KEY is not configured on the server.'
          : 'Verification gateway is currently unavailable. Please contact support.',
        errorCode: 'API_SATHI_NOT_CONFIGURED',
        data: null,
      },
      auditRecord: null,
      firestoreResult: null,
    };
  }

  // Step 2: Validate input against expected request fields (strips unknown fields)
  let validatedSlug = slug;
  let sanitizedInput: Record<string, unknown> = {};
  try {
    const validated = validateAndSanitizeApiSathiInput(slug, input.parameters || {});
    validatedSlug = validated.productSlug;
    sanitizedInput = validated.sanitizedInput;
  } catch (err: any) {
    const apiErr =
      err instanceof ApiSathiException
        ? err
        : new ApiSathiException({
            code: 'INVALID_INPUT',
            message: err?.message || 'Invalid verification input',
            httpStatus: 400,
          });
    safeLogApiSathiEvent('warn', 'Input validation rejected', {
      productSlug: slug,
      intent,
      userId,
      code: apiErr.code,
      input: input.parameters || {},
    });
    return {
      httpStatus: apiErr.httpStatus,
      body: {
        success: false,
        status: 'FAILED',
        message: apiErr.userFriendlyMessage,
        errorCode: apiErr.code,
        data: { details: apiErr.details || null },
      },
      auditRecord: null,
      firestoreResult: null,
    };
  }

  // Step 3: Generate fresh Idempotency-Key UUID
  const uuidFn = input.uuidFn || (() => crypto.randomUUID());
  const idempotencyKey = uuidFn();

  const client = createApiSathiClient({
    apiKey,
    timeoutMs: input.timeoutMs ?? API_SATHI_TIMEOUT_MS,
    fetchFn: input.fetchFn,
    sleepFn: input.sleepFn,
    uuidFn: () => idempotencyKey,
  });

  // Step 4: Execute API Sathi Call
  try {
    const result = await client.invoke(validatedSlug, sanitizedInput, { idempotencyKey });

    // Step 5a: Mask PII BEFORE logging
    safeLogApiSathiEvent('info', 'Verification completed', {
      productSlug: validatedSlug,
      intent,
      userId,
      callId: result.callId,
      verified: result.verified,
      outcome: result.outcome,
      environment: result.environment,
      request: sanitizedInput,
      response: result.data,
    });

    // Step 5b: Persist masked response + call_id + intent to Firestore
    const auditRecord = buildFirestoreVerificationRecord({
      userId,
      intent,
      productSlug: validatedSlug,
      callId: result.callId,
      idempotencyKey: result.idempotencyKey,
      environment: result.environment,
      isSandboxTest: result.isSandboxTestKey,
      httpStatus: 200,
      verified: result.verified,
      outcome: result.outcome,
      errorCode: result.verified ? null : result.resultCode || 'NOT_VERIFIED',
      errorMessage: result.verified ? null : result.message,
      rawRequestPayload: sanitizedInput,
      rawResponsePayload: result.data,
      latencyMs: result.latencyMs,
    });

    const firestoreResult = await persistApiSathiVerificationToFirestore(auditRecord, {
      userIdToken: input.firebaseIdToken,
      fetchFn: input.firestoreFetchFn,
    });

    // Step 6: Return structured response
    return {
      httpStatus: 200,
      body: {
        success: result.verified,
        status: result.verified ? 'SUCCESS' : 'FAILED',
        message: result.message,
        referenceId: result.callId || result.idempotencyKey,
        ...(result.verified ? {} : { errorCode: result.resultCode || 'NOT_VERIFIED' }),
        data: {
          verified: result.verified,
          outcome: result.outcome,
          resultCode: result.resultCode,
          callId: result.callId,
          idempotencyKey: result.idempotencyKey,
          intent,
          environment: result.environment,
          isSandboxTestKey: result.isSandboxTestKey,
          latencyMs: result.latencyMs,
          firestorePersisted: firestoreResult.persisted,
          firestoreDocumentId: firestoreResult.documentId,
          result: result.data,
        },
      },
      auditRecord,
      firestoreResult,
      idempotencyKey: result.idempotencyKey,
      sanitizedInput,
      isRetryable: false,
    };
  } catch (err: any) {
    const apiErr =
      err instanceof ApiSathiException
        ? err
        : new ApiSathiException({
            code: 'API_SATHI_ERROR',
            message: err?.message || 'Verification failed',
            httpStatus: 500,
            isRetryable: true,
          });

    const outcome: ApiSathiVerificationOutcome = apiErr.isWalletEmptyError
      ? 'WALLET_EMPTY'
      : apiErr.httpStatus === 429
      ? 'RATE_LIMITED'
      : apiErr.httpStatus >= 500
      ? 'UPSTREAM_ERROR'
      : 'ERROR';

    // Mask PII before error logging
    safeLogApiSathiEvent('error', 'Verification failed', {
      productSlug: validatedSlug,
      intent,
      userId,
      callId: apiErr.callId,
      httpStatus: apiErr.httpStatus,
      code: apiErr.code,
      request: sanitizedInput,
    });

    const auditRecord = buildFirestoreVerificationRecord({
      userId,
      intent,
      productSlug: validatedSlug,
      callId: apiErr.callId,
      idempotencyKey,
      environment: client.isSandboxTestKey ? 'SANDBOX' : 'PRODUCTION',
      isSandboxTest: client.isSandboxTestKey,
      httpStatus: apiErr.httpStatus,
      verified: false,
      outcome,
      errorCode: apiErr.code,
      errorMessage: apiErr.message,
      rawRequestPayload: sanitizedInput,
      rawResponsePayload: { error: apiErr.code, reason: apiErr.reason || null },
      latencyMs: 0,
    });

    const firestoreResult = await persistApiSathiVerificationToFirestore(auditRecord, {
      userIdToken: input.firebaseIdToken,
      fetchFn: input.firestoreFetchFn,
    });

    const status = apiErr.httpStatus >= 400 && apiErr.httpStatus < 600 ? apiErr.httpStatus : 500;
    const responseMessage = apiErr.isWalletEmptyError
      ? isAdmin
        ? apiErr.adminMessage
        : apiErr.userFriendlyMessage
      : isAdmin
      ? apiErr.adminMessage
      : apiErr.userFriendlyMessage;

    return {
      httpStatus: status,
      body: {
        success: false,
        status: 'FAILED',
        message: responseMessage,
        referenceId: apiErr.callId || undefined,
        errorCode: apiErr.code,
        data: {
          callId: apiErr.callId,
          code: apiErr.code,
          intent,
          isWalletEmptyError: apiErr.isWalletEmptyError,
          isRetiredApi: apiErr.isRetiredApi,
          firestorePersisted: firestoreResult.persisted,
          firestoreDocumentId: firestoreResult.documentId,
        },
      },
      auditRecord,
      firestoreResult,
      idempotencyKey,
      sanitizedInput,
      isRetryable: apiErr.isRetryable,
      retryAfterSeconds: apiErr.retryAfterSeconds,
    };
  }
}

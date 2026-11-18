import { redactSensitiveObject, redactSensitiveString } from './auditService';

export const API_SATHI_BASE_URL = 'https://apisathi.in/gw/v1';
export const API_SATHI_RATES_URL = 'https://apisathi.in/api/v1/rates';
export const API_SATHI_MIN_TIMEOUT_MS = 20_000;
export const API_SATHI_DEFAULT_TIMEOUT_MS = 25_000;
export const API_SATHI_5XX_RETRY_DELAYS_MS = [2000, 6000] as const;

export type ApiSathiKeyMode = 'unconfigured' | 'sandbox_test' | 'live_production' | 'unknown';

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

export interface ApiSathiErrorOptions {
  code: string;
  message: string;
  httpStatus: number;
  callId?: string | null;
  reason?: string;
  details?: unknown;
  retryAfterSeconds?: number;
  isWalletEmptyError?: boolean;
  isRetiredApi?: boolean;
  isRetryable?: boolean;
}

export class ApiSathiError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly callId: string | null;
  public readonly reason?: string;
  public readonly details?: unknown;
  public readonly retryAfterSeconds?: number;
  public readonly isWalletEmptyError: boolean;
  public readonly isRetiredApi: boolean;
  public readonly isRetryable: boolean;

  constructor(opts: ApiSathiErrorOptions) {
    super(opts.message);
    this.name = 'ApiSathiError';
    this.code = opts.code;
    this.httpStatus = opts.httpStatus;
    this.callId = opts.callId ?? null;
    this.reason = opts.reason;
    this.details = opts.details;
    this.retryAfterSeconds = opts.retryAfterSeconds;
    this.isWalletEmptyError = Boolean(opts.isWalletEmptyError || opts.httpStatus === 402 || opts.code === 'INSUFFICIENT_BALANCE');
    this.isRetiredApi = Boolean(opts.isRetiredApi || opts.httpStatus === 410);
    this.isRetryable = Boolean(opts.isRetryable);
  }
}

export function detectApiSathiKeyMode(rawKey?: string | null): ApiSathiKeyMode {
  const key = String(rawKey || '').trim();
  if (!key) return 'unconfigured';
  if (key.startsWith('test_')) return 'sandbox_test';
  if (key.startsWith('live_')) return 'live_production';
  return 'unknown';
}

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

export function maskApiSathiValue(key: string, val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'string') return redactSensitiveObject(val);
  const s = val.trim();
  const k = key.toLowerCase();
  if (k.includes('pan') && /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(s)) {
    return `${s.slice(0, 2).toUpperCase()}******${s.slice(-2).toUpperCase()}`;
  }
  if ((k.includes('aadhaar') || k.includes('aadhar')) && /^\d{12}$/.test(s)) {
    return `XXXXXXXX${s.slice(-4)}`;
  }
  if (k.includes('mobile') || k.includes('phone')) {
    const digits = s.replace(/\D/g, '');
    if (digits.length >= 6) return `XXXXXX${digits.slice(-4)}`;
  }
  if (k.includes('email') && s.includes('@')) {
    const [local, domain] = s.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }
  if (k.includes('account') && digitsOnly(s).length >= 6) {
    const d = digitsOnly(s);
    return `XXXXXX${d.slice(-4)}`;
  }
  return redactSensitiveString(s);
}

function digitsOnly(v: string): string {
  return v.replace(/\D/g, '');
}

export function maskApiSathiPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload || {})) {
    masked[k] = maskApiSathiValue(k, v);
  }
  return masked;
}

export interface ApiSathiClientOptions {
  apiKey: string;
  baseUrl?: string;
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
  environment: 'SANDBOX' | 'PRODUCTION';
  isSandboxTestKey: boolean;
  httpStatus: number;
  latencyMs: number;
  data: TData;
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

function extractCallId(json: any, headers: Headers): string | null {
  const fromBody =
    json?.call_id ||
    json?.callId ||
    json?.error?.call_id ||
    json?.meta?.call_id;
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();
  const fromHeader = headers.get('x-call-id') || headers.get('x-request-id');
  return fromHeader && fromHeader.trim() ? fromHeader.trim() : null;
}

export interface ApiSathiClient {
  readonly keyMode: ApiSathiKeyMode;
  readonly isSandboxTestKey: boolean;
  invoke<TReq extends Record<string, unknown>, TRes extends Record<string, any> = Record<string, any>>(
    productSlug: ApiSathiProductSlug | string,
    payload: TReq,
    options?: {
      idempotencyKey?: string;
      treatFalseAsNotVerified?: boolean;
    }
  ): Promise<ApiSathiCallResult<TRes>>;
}

export function createApiSathiClient(opts: ApiSathiClientOptions): ApiSathiClient {
  const apiKey = normalizeApiSathiKey(opts.apiKey);
  if (!apiKey) {
    throw new ApiSathiError({
      code: 'API_SATHI_NOT_CONFIGURED',
      message: 'API_SATHI_KEY is not configured on the server.',
      httpStatus: 503,
    });
  }

  const keyMode = detectApiSathiKeyMode(apiKey);
  const isSandboxTestKey = keyMode === 'sandbox_test';
  const baseUrl = String(opts.baseUrl || API_SATHI_BASE_URL).replace(/\/+$/, '');
  const timeoutMs = Math.max(API_SATHI_MIN_TIMEOUT_MS, opts.timeoutMs ?? API_SATHI_DEFAULT_TIMEOUT_MS);
  const fetchFn = opts.fetchFn || fetch;
  const sleepFn = opts.sleepFn || defaultSleep;
  const uuidFn = opts.uuidFn || (() => crypto.randomUUID());
  const retry5xxDelays = opts.retry5xxDelaysMs ?? API_SATHI_5XX_RETRY_DELAYS_MS;
  const max429Retries = opts.max429Retries ?? 2;

  return {
    keyMode,
    isSandboxTestKey,
    async invoke<TReq extends Record<string, unknown>, TRes extends Record<string, any>>(
      productSlug: ApiSathiProductSlug | string,
      payload: TReq,
      callOpts?: { idempotencyKey?: string; treatFalseAsNotVerified?: boolean }
    ): Promise<ApiSathiCallResult<TRes>> {
      const cleanSlug = String(productSlug || '').replace(/^\/+|\/+$/g, '');
      if (!cleanSlug) {
        throw new ApiSathiError({
          code: 'INVALID_REQUEST',
          message: 'Product slug is required.',
          httpStatus: 400,
        });
      }

      // Trailing slash is REQUIRED by API Sathi gateway (without it, gateway returns 404)
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
          throw new ApiSathiError({
            code: isAbort ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_NETWORK_ERROR',
            message: isAbort
              ? 'API Sathi request timed out — please try again shortly.'
              : 'Unable to reach API Sathi upstream — please try again shortly.',
            httpStatus: 503,
            callId: null,
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

        const callId = extractCallId(json, response.headers);

        if (response.status === 200 && json && typeof json === 'object') {
          // Strip call_id wrapper noise if present; preserve response fields
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

        const errObj = json?.error && typeof json.error === 'object' ? json.error : {};
        const upstreamCode = String(errObj.code || json?.code || `HTTP_${response.status}`);
        const upstreamMsg = String(errObj.message || json?.message || response.statusText || 'API Sathi request failed');
        const reason = typeof errObj.reason === 'string' ? errObj.reason : undefined;
        const details = errObj.details ?? json?.details;

        if (response.status === 429) {
          const retryMs = parseRetryAfterMs(response.headers.get('Retry-After'));
          if (rateLimitAttempt < max429Retries) {
            rateLimitAttempt += 1;
            await sleepFn(retryMs);
            continue;
          }
          throw new ApiSathiError({
            code: upstreamCode || 'RATE_LIMITED',
            message: 'API Sathi rate limit reached. Please wait a moment and try again.',
            httpStatus: 429,
            callId,
            reason,
            retryAfterSeconds: Math.ceil(retryMs / 1000),
            isRetryable: true,
          });
        }

        if (response.status >= 500) {
          if (fiveXxAttempt < retry5xxDelays.length) {
            const delay = retry5xxDelays[fiveXxAttempt];
            fiveXxAttempt += 1;
            await sleepFn(delay);
            continue;
          }
          throw new ApiSathiError({
            code: upstreamCode || 'UPSTREAM_UNAVAILABLE',
            message: 'API Sathi upstream is temporarily unavailable — please try again shortly.',
            httpStatus: response.status,
            callId,
            reason,
            isRetryable: true,
          });
        }

        if (response.status === 402 || upstreamCode === 'INSUFFICIENT_BALANCE') {
          throw new ApiSathiError({
            code: 'INSUFFICIENT_BALANCE',
            message: 'API Sathi prepaid wallet balance is empty. Admin action required: recharge API Sathi wallet.',
            httpStatus: 402,
            callId,
            reason,
            isWalletEmptyError: true,
            isRetryable: false,
          });
        }

        if (response.status === 410) {
          throw new ApiSathiError({
            code: upstreamCode || 'API_RETIRED',
            message: `This API Sathi endpoint (${cleanSlug}) has been retired and is no longer available.`,
            httpStatus: 410,
            callId,
            reason,
            isRetiredApi: true,
            isRetryable: false,
          });
        }

        if (response.status === 401) {
          throw new ApiSathiError({
            code: upstreamCode || 'UNAUTHORIZED',
            message: 'Invalid or missing API_SATHI_KEY on server. Please contact the platform administrator.',
            httpStatus: 401,
            callId,
            reason,
            isRetryable: false,
          });
        }

        if (response.status === 400) {
          const detailSuffix = Array.isArray(details) && details.length > 0
            ? ` (${details.map((d: any) => (typeof d === 'string' ? d : d?.field || JSON.stringify(d))).join(', ')})`
            : '';
          throw new ApiSathiError({
            code: upstreamCode || 'INVALID_REQUEST',
            message: `${upstreamMsg}${detailSuffix}`,
            httpStatus: 400,
            callId,
            reason,
            details,
            isRetryable: false,
          });
        }

        // 404 / 422 and any other 4xx: reject input / missing reference, NEVER retry
        throw new ApiSathiError({
          code: upstreamCode || `HTTP_${response.status}`,
          message: upstreamMsg,
          httpStatus: response.status,
          callId,
          reason,
          details,
          isRetryable: false,
        });
      }
    },
  };
}

// ==============================================================================
// STRICT SCHEMA VALIDATORS & TYPED PRODUCT WRAPPERS (ZERO UNKNOWN FIELDS SENT)
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
  throw new ApiSathiError({
    code: 'INVALID_INPUT',
    message,
    httpStatus: 400,
    details: field ? [{ field, message }] : undefined,
  });
}

export function normalizeDobToDdMmYyyy(raw: string): string {
  const s = String(raw || '').trim();
  if (DL_DOB_REGEX.test(s)) return s;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }
  const dash = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (dash) {
    return `${dash[1]}/${dash[2]}/${dash[3]}`;
  }
  return s;
}

export async function verifyPan(client: ApiSathiClient, input: { pan: string }, callOpts?: { idempotencyKey?: string }) {
  const pan = String(input.pan || '').trim().toUpperCase();
  if (!PAN_REGEX.test(pan)) validationFail('PAN must be 10 characters in format ABCDE1234F.', 'pan');
  return client.invoke<{ pan: string }, {
    verified: boolean;
    name?: string;
    dob?: string;
    category?: string;
    aadhaar_linked?: boolean;
    aadhaar_number?: string;
    result_code?: string;
    message?: string;
  }>('pan-verification-v1', { pan }, callOpts);
}

export async function verifyPanBasic(client: ApiSathiClient, input: { pan: string }, callOpts?: { idempotencyKey?: string }) {
  const pan = String(input.pan || '').trim().toUpperCase();
  if (!PAN_REGEX.test(pan)) validationFail('PAN must be 10 characters in format ABCDE1234F.', 'pan');
  return client.invoke<{ pan: string }, {
    verified: boolean;
    pan?: string;
    name?: string;
    status?: string;
  }>('pan-basic-v1', { pan }, callOpts);
}

export async function checkPanAadhaarLink(client: ApiSathiClient, input: { pan: string; aadhaar: string }, callOpts?: { idempotencyKey?: string }) {
  const pan = String(input.pan || '').trim().toUpperCase();
  const aadhaar = String(input.aadhaar || '').replace(/[\s-]/g, '');
  if (!PAN_REGEX.test(pan)) validationFail('PAN must be 10 characters in format ABCDE1234F.', 'pan');
  if (!AADHAAR_REGEX.test(aadhaar)) validationFail('Aadhaar must be a valid 12-digit number.', 'aadhaar');
  return client.invoke<{ pan: string; aadhaar: string }, {
    verified: boolean;
    linked?: boolean;
    message?: string;
    code?: string;
  }>('pan-aadhaar-link', { pan, aadhaar }, callOpts);
}

export async function verifyGstinBasic(client: ApiSathiClient, input: { gstin: string }, callOpts?: { idempotencyKey?: string }) {
  const gstin = String(input.gstin || '').trim().toUpperCase();
  if (!GSTIN_REGEX.test(gstin)) validationFail('GSTIN must be a valid 15-character tax ID.', 'gstin');
  return client.invoke<{ gstin: string }, {
    verified: boolean;
    gstin?: string;
    status?: string;
    legal_name?: string;
    trade_name?: string;
    constitution?: string;
    registration_date?: string;
  }>('gstin-basic-v1', { gstin }, callOpts);
}

export async function verifyGstinAdvanced(client: ApiSathiClient, input: { gstin: string }, callOpts?: { idempotencyKey?: string }) {
  const gstin = String(input.gstin || '').trim().toUpperCase();
  if (!GSTIN_REGEX.test(gstin)) validationFail('GSTIN must be a valid 15-character tax ID.', 'gstin');
  return client.invoke<{ gstin: string }, {
    verified: boolean;
    gstin?: string;
    status?: string;
    legal_name?: string;
    trade_name?: string;
    constitution?: string;
    registration_date?: string;
  }>('gstin-verify-v1', { gstin }, callOpts);
}

export async function searchGstinByPan(
  client: ApiSathiClient,
  input: { pan: string; state?: string; state_code?: string },
  callOpts?: { idempotencyKey?: string }
) {
  const pan = String(input.pan || '').trim().toUpperCase();
  if (!PAN_REGEX.test(pan)) validationFail('PAN must be 10 characters in format ABCDE1234F.', 'pan');
  const body: { pan: string; state?: string; state_code?: string } = { pan };
  if (typeof input.state === 'string' && input.state.trim()) body.state = input.state.trim();
  if (typeof input.state_code === 'string' && input.state_code.trim()) body.state_code = input.state_code.trim();
  return client.invoke<typeof body, { verified: boolean; count?: number; gstin_list?: any[] }>('gstin-by-pan-v1', body, callOpts);
}

export async function verifyDrivingLicense(client: ApiSathiClient, input: { dl_number: string; dob: string }, callOpts?: { idempotencyKey?: string }) {
  const dl_number = String(input.dl_number || '').replace(/[\s-]/g, '').toUpperCase();
  const dob = normalizeDobToDdMmYyyy(input.dob);
  if (!DL_REGEX.test(dl_number)) validationFail('Driving Licence number must be 13–25 alphanumeric characters without spaces or hyphens.', 'dl_number');
  if (!DL_DOB_REGEX.test(dob)) validationFail('Date of birth must be formatted as DD/MM/YYYY (e.g. 15/01/1990).', 'dob');
  return client.invoke<{ dl_number: string; dob: string }, {
    verified: boolean;
    name?: string;
    dob?: string;
    dl_number?: string;
    valid_from?: string;
    valid_upto?: string;
    vehicle_classes?: string[];
    issuing_authority?: string;
  }>('driving-license-v1', { dl_number, dob }, callOpts);
}

export async function verifyVehicleRc(client: ApiSathiClient, input: { rc_number: string }, callOpts?: { idempotencyKey?: string }) {
  const rc_number = String(input.rc_number || '').replace(/[\s-]/g, '').toUpperCase();
  if (!RC_REGEX.test(rc_number)) validationFail('Vehicle RC number must be a valid Indian registration number (e.g. MH12DE1433).', 'rc_number');
  return client.invoke<{ rc_number: string }, {
    verified: boolean;
    rc_number?: string;
    owner_name?: string;
    maker_model?: string;
    fuel_type?: string;
    vehicle_class?: string;
    registration_date?: string;
    fitness_upto?: string;
    insurance_upto?: string;
  }>('vehicle-rc-v1', { rc_number }, callOpts);
}

export async function lookupIfsc(client: ApiSathiClient, input: { ifsc: string }, callOpts?: { idempotencyKey?: string }) {
  const ifsc = String(input.ifsc || '').trim().toUpperCase();
  if (!IFSC_REGEX.test(ifsc)) validationFail('IFSC code must be 11 characters (e.g. SBIN0001234).', 'ifsc');
  return client.invoke<{ ifsc: string }, {
    ifsc?: string;
    bank?: string;
    branch?: string;
    address?: string;
    city?: string;
    state?: string;
    micr?: string;
    upi?: boolean;
    imps?: boolean;
    neft?: boolean;
    rtgs?: boolean;
  }>('ifsc-lookup-v1', { ifsc }, callOpts);
}

export async function verifyCinBasic(client: ApiSathiClient, input: { cin: string }, callOpts?: { idempotencyKey?: string }) {
  const cin = String(input.cin || '').trim().toUpperCase();
  if (cin.length < 15 || cin.length > 25) validationFail('CIN must be a valid Corporate Identification Number.', 'cin');
  return client.invoke<{ cin: string }, { verified: boolean; cin?: string; roc_code?: string; company_name?: string }>(
    'cin-basic-v1',
    { cin },
    callOpts
  );
}

export async function lookupUdyamByMobile(client: ApiSathiClient, input: { mobile: string }, callOpts?: { idempotencyKey?: string }) {
  const mobile = String(input.mobile || '').replace(/\D/g, '').slice(-10);
  if (!MOBILE_REGEX.test(mobile)) validationFail('Mobile number must be 10 digits starting with 6–9.', 'mobile');
  return client.invoke<{ mobile: string }, { verified: boolean; mobile?: string; udyams?: any[] }>(
    'mobile-to-udyam-v1',
    { mobile },
    callOpts
  );
}

export async function verifyVoterId(client: ApiSathiClient, input: { epic_number: string }, callOpts?: { idempotencyKey?: string }) {
  const epic_number = String(input.epic_number || '').trim().toUpperCase();
  if (!EPIC_REGEX.test(epic_number)) validationFail('EPIC number must be 3 letters followed by 7 digits (e.g. ABC1234567).', 'epic_number');
  return client.invoke<{ epic_number: string }, {
    verified: boolean;
    epic_number?: string;
    name?: string;
    relation_name?: string;
    state?: string;
    district?: string;
  }>('voter-id-v1', { epic_number }, callOpts);
}

export async function matchNames(
  client: ApiSathiClient,
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
  return client.invoke<typeof payload, {
    score: number;
    match: boolean;
    threshold: number;
    match_type: string;
    name1_normalized?: string;
    name2_normalized?: string;
  }>('name-match', payload, callOpts);
}

export async function initAadhaarDigilocker(
  client: ApiSathiClient,
  input: {
    uid: string;
    mobile?: string;
    emailId?: string;
    firstName?: string;
    lastName?: string;
    isSendOtp?: boolean;
    isHideExplanationScreen?: boolean;
    redirectionUrl?: string;
  }
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

  return client.invoke<typeof body, {
    transaction_id: string;
    kyc_url: string;
    short_url?: string;
    verified: boolean;
  }>('aadhaar-digilocker-init-v1', body);
}

export async function fetchAadhaarDigilocker(client: ApiSathiClient, input: { transaction_id: string }) {
  const transaction_id = String(input.transaction_id || '').trim();
  if (!TX_ID_REGEX.test(transaction_id)) {
    validationFail('transaction_id must be the numeric ID returned by DigiLocker step 1.', 'transaction_id');
  }
  return client.invoke<{ transaction_id: string }, {
    verified: boolean;
    status?: string;
    masked_aadhaar?: string;
    name?: string;
    dob?: string;
    gender?: string;
    care_of?: string;
    address?: Record<string, string>;
    photo_base64?: string;
    documents?: Array<{ docLink?: string; docType?: string; docExtension?: string }>;
  }>('aadhaar-digilocker-fetch-v1', { transaction_id });
}

export async function executeApiSathiProduct(
  client: ApiSathiClient,
  slug: string,
  params: Record<string, any>,
  callOpts?: { idempotencyKey?: string }
): Promise<{ result: ApiSathiCallResult; sanitizedInput: Record<string, unknown> }> {
  const cleanSlug = String(slug || '').trim();
  switch (cleanSlug) {
    case 'pan-verification-v1': {
      const sanitizedInput = { pan: String(params.pan || params.identifier || '').trim().toUpperCase() };
      return { result: await verifyPan(client, sanitizedInput, callOpts), sanitizedInput };
    }
    case 'pan-basic-v1': {
      const sanitizedInput = { pan: String(params.pan || params.identifier || '').trim().toUpperCase() };
      return { result: await verifyPanBasic(client, sanitizedInput, callOpts), sanitizedInput };
    }
    case 'pan-aadhaar-link': {
      const sanitizedInput = {
        pan: String(params.pan || params.identifier || '').trim().toUpperCase(),
        aadhaar: String(params.aadhaar || '').replace(/[\s-]/g, ''),
      };
      return { result: await checkPanAadhaarLink(client, sanitizedInput, callOpts), sanitizedInput };
    }
    case 'gstin-basic-v1': {
      const sanitizedInput = { gstin: String(params.gstin || params.identifier || '').trim().toUpperCase() };
      return { result: await verifyGstinBasic(client, sanitizedInput, callOpts), sanitizedInput };
    }
    case 'gstin-verify-v1': {
      const sanitizedInput = { gstin: String(params.gstin || params.identifier || '').trim().toUpperCase() };
      return { result: await verifyGstinAdvanced(client, sanitizedInput, callOpts), sanitizedInput };
    }
    case 'gstin-by-pan-v1': {
      const sanitizedInput: { pan: string; state?: string; state_code?: string } = {
        pan: String(params.pan || params.identifier || '').trim().toUpperCase(),
      };
      if (params.state) sanitizedInput.state = String(params.state);
      if (params.state_code) sanitizedInput.state_code = String(params.state_code);
      return { result: await searchGstinByPan(client, sanitizedInput, callOpts), sanitizedInput };
    }
    case 'driving-license-v1': {
      const sanitizedInput = {
        dl_number: String(params.dl_number || params.dlNumber || params.identifier || '').replace(/[\s-]/g, '').toUpperCase(),
        dob: normalizeDobToDdMmYyyy(String(params.dob || '')),
      };
      return { result: await verifyDrivingLicense(client, sanitizedInput, callOpts), sanitizedInput };
    }
    case 'vehicle-rc-v1': {
      const sanitizedInput = {
        rc_number: String(params.rc_number || params.rcNumber || params.identifier || '').replace(/[\s-]/g, '').toUpperCase(),
      };
      return { result: await verifyVehicleRc(client, sanitizedInput, callOpts), sanitizedInput };
    }
    case 'ifsc-lookup-v1': {
      const sanitizedInput = { ifsc: String(params.ifsc || params.identifier || '').trim().toUpperCase() };
      return { result: await lookupIfsc(client, sanitizedInput, callOpts), sanitizedInput };
    }
    case 'cin-basic-v1': {
      const sanitizedInput = { cin: String(params.cin || params.identifier || '').trim().toUpperCase() };
      return { result: await verifyCinBasic(client, sanitizedInput, callOpts), sanitizedInput };
    }
    case 'mobile-to-udyam-v1': {
      const sanitizedInput = { mobile: String(params.mobile || params.identifier || '').replace(/\D/g, '').slice(-10) };
      return { result: await lookupUdyamByMobile(client, sanitizedInput, callOpts), sanitizedInput };
    }
    case 'voter-id-v1': {
      const sanitizedInput = { epic_number: String(params.epic_number || params.identifier || '').trim().toUpperCase() };
      return { result: await verifyVoterId(client, sanitizedInput, callOpts), sanitizedInput };
    }
    case 'name-match': {
      const sanitizedInput: { name1: string; name2: string; threshold?: number } = {
        name1: String(params.name1 || '').trim(),
        name2: String(params.name2 || '').trim(),
      };
      if (params.threshold !== undefined && params.threshold !== '') {
        sanitizedInput.threshold = Number(params.threshold);
      }
      return { result: await matchNames(client, sanitizedInput, callOpts), sanitizedInput };
    }
    default:
      throw new ApiSathiError({
        code: 'UNSUPPORTED_PRODUCT',
        message: `Product "${cleanSlug}" is not enabled in the verification router. Check /api/v1/apisathi/catalogue for live products.`,
        httpStatus: 400,
      });
  }
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
    const list = Array.isArray(data) ? data : Array.isArray(data?.products) ? data.products : Array.isArray(data?.rates) ? data.rates : [];
    return list as ApiSathiRateItem[];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

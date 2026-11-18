export interface ApiSathiStatusInfo {
  configured: boolean;
  keyMode: 'unconfigured' | 'sandbox_test' | 'live_production' | 'unknown';
  isSandboxTestKey: boolean;
  environment: 'SANDBOX' | 'PRODUCTION' | 'UNCONFIGURED';
  walletLowAlert: boolean;
  recentWalletAlert: {
    callId: string | null;
    createdAt: string;
    message: string;
  } | null;
}

export interface ApiSathiCatalogueProduct {
  slug: string;
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

export interface ApiSathiVerificationResponse {
  ok: boolean;
  verified: boolean;
  outcome: 'VERIFIED' | 'NOT_VERIFIED' | 'ERROR' | 'PENDING';
  httpStatus: number;
  message: string;
  callId: string | null;
  errorCode?: string | null;
  isWalletEmptyError?: boolean;
  isRetiredApi?: boolean;
  isSandboxTestKey?: boolean;
  environment?: 'SANDBOX' | 'PRODUCTION';
  latencyMs?: number;
  result?: Record<string, any> | null;
}

export interface ApiSathiDigilockerInitResult {
  ok: boolean;
  httpStatus: number;
  message: string;
  transactionId?: string;
  uid?: string;
  kycUrl?: string;
  shortUrl?: string | null;
  callId: string | null;
  errorCode?: string | null;
  isWalletEmptyError?: boolean;
  isSandboxTestKey?: boolean;
}

export interface ApiSathiDigilockerFetchResult {
  ok: boolean;
  verified: boolean;
  notCompleted?: boolean;
  canRetryLink?: boolean;
  httpStatus: number;
  message: string;
  transactionId: string;
  callId: string | null;
  maskedAadhaar?: string | null;
  name?: string | null;
  dob?: string | null;
  gender?: string | null;
  address?: Record<string, any> | null;
  kycUrl?: string | null;
  errorCode?: string | null;
  isWalletEmptyError?: boolean;
  isSandboxTestKey?: boolean;
}

export interface ApiSathiCallLogRow {
  id: string;
  call_id: string | null;
  idempotency_key: string;
  product_slug: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  is_sandbox_test: number;
  http_status: number;
  verified: number;
  outcome: string;
  error_code: string | null;
  error_message: string | null;
  masked_request_json: string | null;
  response_summary: string | null;
  user_id: string | null;
  step1_ref_id: string | null;
  latency_ms: number;
  created_at: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { auth } = await import('./firebase');
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function getApiSathiStatus(): Promise<ApiSathiStatusInfo | null> {
  try {
    const headers = await authHeaders();
    const res = await fetch('/api/v1/apisathi/status', { headers });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.data) return null;
    return json.data as ApiSathiStatusInfo;
  } catch {
    return null;
  }
}

export async function getApiSathiCatalogue(): Promise<ApiSathiCatalogueProduct[]> {
  try {
    const headers = await authHeaders();
    const res = await fetch('/api/v1/apisathi/catalogue', { headers });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(json?.data?.products)) return [];
    return json.data.products as ApiSathiCatalogueProduct[];
  } catch {
    return [];
  }
}

export async function verifyWithApiSathi(
  productSlug: string,
  parameters: Record<string, unknown>,
  consentGiven = true,
  intent?: string
): Promise<ApiSathiVerificationResponse> {
  try {
    const headers = await authHeaders();
    const res = await fetch('/api/v1/apisathi/verify', {
      method: 'POST',
      headers,
      body: JSON.stringify({ productSlug, consentGiven, parameters, intent }),
    });
    const json: any = await res.json().catch(() => null);
    const data = json?.data || {};

    if (res.ok && json) {
      const verified = Boolean(data.verified);
      return {
        ok: verified,
        verified,
        outcome: verified ? 'VERIFIED' : 'NOT_VERIFIED',
        httpStatus: res.status,
        message: json.message || (verified ? 'Verified' : 'No matching record found'),
        callId: data.callId || json.referenceId || null,
        errorCode: json.errorCode || data.resultCode || null,
        isSandboxTestKey: Boolean(data.isSandboxTestKey),
        environment: data.environment,
        latencyMs: data.latencyMs,
        result: data.result || null,
      };
    }

    return {
      ok: false,
      verified: false,
      outcome: 'ERROR',
      httpStatus: res.status,
      message: json?.message || `Verification request failed (HTTP ${res.status})`,
      callId: data.callId || json?.referenceId || null,
      errorCode: json?.errorCode || data.code || `HTTP_${res.status}`,
      isWalletEmptyError: Boolean(data.isWalletEmptyError || res.status === 402),
      isRetiredApi: Boolean(data.isRetiredApi || res.status === 410),
      result: data || null,
    };
  } catch (err: any) {
    return {
      ok: false,
      verified: false,
      outcome: 'ERROR',
      httpStatus: 0,
      message: err?.message || 'Unable to reach verification backend.',
      callId: null,
      errorCode: 'NETWORK_ERROR',
    };
  }
}

export async function initApiSathiDigilocker(params: {
  mobile?: string;
  emailId?: string;
  firstName?: string;
  lastName?: string;
  purpose?: string;
  redirectionUrl?: string;
  consentGiven: boolean;
}): Promise<ApiSathiDigilockerInitResult> {
  try {
    const headers = await authHeaders();
    const res = await fetch('/api/v1/apisathi/digilocker/init', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const json: any = await res.json().catch(() => null);
    const data = json?.data || {};
    if (res.ok && data.transactionId && data.kycUrl) {
      return {
        ok: true,
        httpStatus: res.status,
        message: json.message || 'DigiLocker link issued.',
        transactionId: data.transactionId,
        uid: data.uid,
        kycUrl: data.kycUrl,
        shortUrl: data.shortUrl || null,
        callId: data.callId || json.referenceId || null,
        isSandboxTestKey: Boolean(data.isSandboxTestKey),
      };
    }
    return {
      ok: false,
      httpStatus: res.status,
      message: json?.message || 'Failed to initiate DigiLocker KYC',
      callId: data.callId || json?.referenceId || null,
      errorCode: json?.errorCode || `HTTP_${res.status}`,
      isWalletEmptyError: Boolean(data.isWalletEmptyError || res.status === 402),
    };
  } catch (err: any) {
    return {
      ok: false,
      httpStatus: 0,
      message: err?.message || 'Network error initiating DigiLocker KYC',
      callId: null,
      errorCode: 'NETWORK_ERROR',
    };
  }
}

export async function fetchApiSathiDigilocker(transactionId: string): Promise<ApiSathiDigilockerFetchResult> {
  try {
    const headers = await authHeaders();
    const res = await fetch('/api/v1/apisathi/digilocker/fetch', {
      method: 'POST',
      headers,
      body: JSON.stringify({ transactionId }),
    });
    const json: any = await res.json().catch(() => null);
    const data = json?.data || {};
    if (res.ok && json) {
      return {
        ok: Boolean(data.verified),
        verified: Boolean(data.verified),
        httpStatus: res.status,
        message: json.message || 'DigiLocker fetch completed',
        transactionId,
        callId: data.callId || json.referenceId || null,
        maskedAadhaar: data.maskedAadhaar || null,
        name: data.name || null,
        dob: data.dob || null,
        gender: data.gender || null,
        address: data.address || null,
        kycUrl: data.kycUrl || null,
        isSandboxTestKey: Boolean(data.isSandboxTestKey),
      };
    }
    return {
      ok: false,
      verified: false,
      notCompleted: Boolean(data.notCompleted || res.status === 422),
      canRetryLink: Boolean(data.canRetryLink),
      httpStatus: res.status,
      message: json?.message || 'DigiLocker verification not completed yet',
      transactionId,
      callId: data.callId || json?.referenceId || null,
      kycUrl: data.kycUrl || null,
      errorCode: json?.errorCode || `HTTP_${res.status}`,
      isWalletEmptyError: Boolean(data.isWalletEmptyError || res.status === 402),
    };
  } catch (err: any) {
    return {
      ok: false,
      verified: false,
      httpStatus: 0,
      message: err?.message || 'Network error fetching DigiLocker result',
      transactionId,
      callId: null,
      errorCode: 'NETWORK_ERROR',
    };
  }
}

export async function getApiSathiCallLogs(): Promise<ApiSathiCallLogRow[]> {
  try {
    const headers = await authHeaders();
    const res = await fetch('/api/v1/apisathi/calls', { headers });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(json?.data)) return [];
    return json.data as ApiSathiCallLogRow[];
  } catch {
    return [];
  }
}

export interface ApiSathiRetryJobView {
  id: string;
  productSlug: string;
  intent: string;
  userId: string;
  idempotencyKey: string;
  maskedInputJson: string;
  status: 'PENDING' | 'RETRYING' | 'SUCCEEDED' | 'EXHAUSTED' | 'CANCELLED';
  attemptCount: number;
  maxAttempts: number;
  lastHttpStatus: number;
  lastErrorCode: string;
  lastErrorMessage: string;
  lastCallId: string | null;
  nextRetryAt: string | null;
  lastAttemptAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSathiRetryQueueSnapshot {
  summary: import('../lib/apiSathiAnalytics').ApiSathiRetryQueueSummary;
  jobs: ApiSathiRetryJobView[];
}

export async function getApiSathiUsageAnalytics(
  range: import('../lib/apiSathiAnalytics').ApiSathiAnalyticsRange = '7d'
): Promise<import('../lib/apiSathiAnalytics').ApiSathiUsageAnalytics | null> {
  try {
    const headers = await authHeaders();
    const res = await fetch(`/api/v1/apisathi/analytics?range=${encodeURIComponent(range)}`, { headers });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.data) return null;
    return json.data as import('../lib/apiSathiAnalytics').ApiSathiUsageAnalytics;
  } catch {
    return null;
  }
}

export async function getApiSathiRetryQueue(): Promise<ApiSathiRetryQueueSnapshot | null> {
  try {
    const headers = await authHeaders();
    const res = await fetch('/api/v1/apisathi/queue', { headers });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.data) return null;
    return json.data as ApiSathiRetryQueueSnapshot;
  } catch {
    return null;
  }
}

export async function processApiSathiRetryQueueNow(forceAllPending = true): Promise<{
  ok: boolean;
  message: string;
  processed?: number;
  succeeded?: number;
  rescheduled?: number;
  exhausted?: number;
}> {
  try {
    const headers = await authHeaders();
    const res = await fetch('/api/v1/apisathi/queue/process', {
      method: 'POST',
      headers,
      body: JSON.stringify({ forceAllPending }),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, message: json?.message || `Queue sweep failed (HTTP ${res.status})` };
    }
    const r = json?.data?.result || {};
    return {
      ok: true,
      message: json?.message || 'Retry sweep completed.',
      processed: Number(r.processed || 0),
      succeeded: Number(r.succeeded || 0),
      rescheduled: Number(r.rescheduled || 0),
      exhausted: Number(r.exhausted || 0),
    };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Unable to trigger retry queue sweep.' };
  }
}

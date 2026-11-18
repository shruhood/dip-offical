/**
 * Shared Browser-Safe API Sathi Analytics, Pricing & Exponential Backoff Helpers
 * -----------------------------------------------------------------------------
 * Zero server secrets (`API_SATHI_KEY` NEVER touches this module).
 * Safe to import from React Admin UI, Node Express, and Cloudflare Workers.
 */

export type ApiSathiAnalyticsRange = '24h' | '7d' | '30d';

export interface ApiSathiProductMeta {
  slug: string;
  name: string;
  priceRupees: number;
  category: 'kyc' | 'kyb' | 'vehicle';
}

export const API_SATHI_PRICING_CATALOG: Record<string, ApiSathiProductMeta> = {
  'pan-verification-v1': {
    slug: 'pan-verification-v1',
    name: 'PAN Verification (ITD)',
    priceRupees: 0.98,
    category: 'kyc',
  },
  'pan-basic-v1': {
    slug: 'pan-basic-v1',
    name: 'PAN Basic Lookup',
    priceRupees: 0.52,
    category: 'kyc',
  },
  'pan-aadhaar-link': {
    slug: 'pan-aadhaar-link',
    name: 'PAN–Aadhaar Link',
    priceRupees: 0.39,
    category: 'kyc',
  },
  'gstin-basic-v1': {
    slug: 'gstin-basic-v1',
    name: 'GSTIN Basic',
    priceRupees: 0.52,
    category: 'kyb',
  },
  'gstin-verify-v1': {
    slug: 'gstin-verify-v1',
    name: 'GSTIN Advanced',
    priceRupees: 0.85,
    category: 'kyb',
  },
  'gstin-by-pan-v1': {
    slug: 'gstin-by-pan-v1',
    name: 'GSTIN Search by PAN',
    priceRupees: 0.46,
    category: 'kyb',
  },
  'ifsc-lookup-v1': {
    slug: 'ifsc-lookup-v1',
    name: 'IFSC Branch Lookup',
    priceRupees: 0.5,
    category: 'kyc',
  },
  'aadhaar-digilocker-init-v1': {
    slug: 'aadhaar-digilocker-init-v1',
    name: 'DigiLocker Step 1 (Init)',
    priceRupees: 1.0,
    category: 'kyc',
  },
  'aadhaar-digilocker-fetch-v1': {
    slug: 'aadhaar-digilocker-fetch-v1',
    name: 'DigiLocker Step 2 (Fetch)',
    priceRupees: 0.98,
    category: 'kyc',
  },
  'driving-license-v1': {
    slug: 'driving-license-v1',
    name: 'Driving Licence',
    priceRupees: 1.3,
    category: 'kyc',
  },
  'vehicle-rc-v1': {
    slug: 'vehicle-rc-v1',
    name: 'Vehicle RC (Vahan)',
    priceRupees: 2.93,
    category: 'vehicle',
  },
  'mobile-to-udyam-v1': {
    slug: 'mobile-to-udyam-v1',
    name: 'Mobile to Udyam MSME',
    priceRupees: 6.5,
    category: 'kyb',
  },
  'cin-basic-v1': {
    slug: 'cin-basic-v1',
    name: 'Company CIN Basic',
    priceRupees: 0.65,
    category: 'kyb',
  },
  'voter-id-v1': {
    slug: 'voter-id-v1',
    name: 'Voter ID (EPIC)',
    priceRupees: 0.65,
    category: 'kyc',
  },
  'name-match': {
    slug: 'name-match',
    name: 'Name Match',
    priceRupees: 0.5,
    category: 'kyc',
  },
};

export function getApiSathiUnitPriceInr(
  productSlug: string,
  priceOverrides?: Record<string, number>
): number {
  if (priceOverrides && Number.isFinite(priceOverrides[productSlug])) {
    return Number(priceOverrides[productSlug]);
  }
  return API_SATHI_PRICING_CATALOG[productSlug]?.priceRupees ?? 0;
}

/**
 * Per API Sathi billing rules:
 * HTTP 200 responses (including `verified: false` "no record" lookups and DigiLocker init)
 * are charged against the prepaid wallet. 400, 401, 402, 404, 410, 422, 429, and 5xx are NOT charged.
 */
export function isBillableApiSathiHttpStatus(httpStatus: number): boolean {
  return Number(httpStatus) === 200;
}

export function isSuccessfulApiSathiOutcome(row: {
  http_status?: number;
  verified?: number | boolean;
  outcome?: string;
}): boolean {
  const status = Number(row.http_status || 0);
  if (status !== 200) return false;
  const outcome = String(row.outcome || '').toUpperCase();
  if (outcome === 'VERIFIED' || outcome === 'STEP1_INITIATED') return true;
  if (outcome === 'NOT_VERIFIED') return false;
  return row.verified === 1 || row.verified === true;
}

export function isRetryableApiSathiFailure(httpStatus: number, errorCode?: string | null): boolean {
  const status = Number(httpStatus || 0);
  const code = String(errorCode || '').toUpperCase();
  if (status === 400 || status === 401 || status === 402 || status === 404 || status === 410 || status === 422) {
    return false;
  }
  if (
    code === 'INVALID_INPUT' ||
    code === 'INVALID_REQUEST' ||
    code === 'INSUFFICIENT_BALANCE' ||
    code === 'UNAUTHORIZED' ||
    code === 'API_RETIRED' ||
    code === 'UNSUPPORTED_PRODUCT'
  ) {
    return false;
  }
  if (status === 429 || status >= 500 || status === 0) {
    return true;
  }
  return (
    code === 'RATE_LIMITED' ||
    code === 'UPSTREAM_UNAVAILABLE' ||
    code === 'UPSTREAM_TIMEOUT' ||
    code === 'UPSTREAM_NETWORK_ERROR'
  );
}

export function computeExponentialBackoffMs(params: {
  attempt: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryAfterSeconds?: number | null;
  jitterRatio?: number;
}): number {
  const attempt = Math.max(1, Math.floor(params.attempt || 1));
  const baseDelayMs = Math.max(250, params.baseDelayMs ?? 5000);
  const maxDelayMs = Math.max(baseDelayMs, params.maxDelayMs ?? 300_000);
  const exponential = baseDelayMs * Math.pow(2, attempt - 1);
  const retryAfterFloor =
    typeof params.retryAfterSeconds === 'number' && Number.isFinite(params.retryAfterSeconds) && params.retryAfterSeconds > 0
      ? Math.round(params.retryAfterSeconds * 1000)
      : 0;
  const rawDelay = Math.min(maxDelayMs, Math.max(exponential, retryAfterFloor));
  const jitterRatio = params.jitterRatio ?? 0;
  if (jitterRatio <= 0) return Math.round(rawDelay);
  const jitterMs = Math.round(rawDelay * Math.min(0.5, Math.max(0, jitterRatio)));
  return Math.min(maxDelayMs, rawDelay + jitterMs);
}

export interface ApiSathiCallAnalyticsInputRow {
  product_slug: string;
  environment?: string;
  is_sandbox_test?: number | boolean;
  http_status: number;
  verified?: number | boolean;
  outcome?: string;
  error_code?: string | null;
  latency_ms?: number | null;
  created_at?: string | null;
}

export interface ApiSathiTimeSeriesBucket {
  bucketKey: string;
  label: string;
  totalRequests: number;
  successfulRequests: number;
  notVerifiedRequests: number;
  failedRequests: number;
  costInr: number;
  liveCostInr: number;
  sandboxCostInr: number;
}

export interface ApiSathiProductUsageRow {
  productSlug: string;
  productName: string;
  category: 'kyc' | 'kyb' | 'vehicle';
  unitPriceInr: number;
  totalRequests: number;
  successfulRequests: number;
  notVerifiedRequests: number;
  failedRequests: number;
  chargedRequests: number;
  costInr: number;
  liveCostInr: number;
  sandboxCostInr: number;
  avgLatencyMs: number;
  successRatePercent: number;
}

export interface ApiSathiUsageSummary {
  totalRequests: number;
  successfulRequests: number;
  notVerifiedRequests: number;
  failedRequests: number;
  chargedRequests: number;
  successRatePercent: number;
  totalCostInr: number;
  liveCostInr: number;
  sandboxEstimatedCostInr: number;
  savedOnUnchargedErrorsInr: number;
  avgLatencyMs: number;
  rateLimitedCount: number;
  upstreamErrorCount: number;
  walletEmptyCount: number;
}

export interface ApiSathiRetryQueueSummary {
  pendingCount: number;
  retryingCount: number;
  succeededCount: number;
  exhaustedCount: number;
  totalCount: number;
}

export interface ApiSathiUsageAnalytics {
  range: ApiSathiAnalyticsRange;
  generatedAt: string;
  summary: ApiSathiUsageSummary;
  timeSeries: ApiSathiTimeSeriesBucket[];
  byProduct: ApiSathiProductUsageRow[];
  queueSummary: ApiSathiRetryQueueSummary;
}

function roundInr(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseTimestampMs(raw?: string | null): number | null {
  if (!raw) return null;
  // Normalize SQLite/D1 UTC "YYYY-MM-DD HH:MM:SS" safely
  const trimmed = String(raw).trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatBucketKey(ms: number, range: ApiSathiAnalyticsRange): { bucketKey: string; label: string } {
  const d = new Date(ms);
  if (range === '24h') {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    return {
      bucketKey: `${yyyy}-${mm}-${dd}T${hh}:00Z`,
      label: `${hh}:00`,
    };
  }
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    bucketKey: `${yyyy}-${mm}-${dd}`,
    label: `${Number(dd)} ${months[d.getUTCMonth()] || mm}`,
  };
}

export function aggregateApiSathiUsage(
  calls: ApiSathiCallAnalyticsInputRow[],
  options: {
    range?: ApiSathiAnalyticsRange;
    nowMs?: number;
    priceOverrides?: Record<string, number>;
    queueSummary?: Partial<ApiSathiRetryQueueSummary>;
  } = {}
): ApiSathiUsageAnalytics {
  const range: ApiSathiAnalyticsRange = options.range || '7d';
  const nowMs = options.nowMs ?? Date.now();
  const windowMs =
    range === '24h'
      ? 24 * 60 * 60 * 1000
      : range === '30d'
      ? 30 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;
  const minTs = nowMs - windowMs;

  // Pre-seed continuous empty timeline buckets so Recharts shows clean full axes
  const buckets = new Map<string, ApiSathiTimeSeriesBucket>();
  if (range === '24h') {
    const hourMs = 60 * 60 * 1000;
    const endHour = Math.floor(nowMs / hourMs) * hourMs;
    for (let i = 23; i >= 0; i -= 1) {
      const ts = endHour - i * hourMs;
      const { bucketKey, label } = formatBucketKey(ts, '24h');
      buckets.set(bucketKey, {
        bucketKey,
        label,
        totalRequests: 0,
        successfulRequests: 0,
        notVerifiedRequests: 0,
        failedRequests: 0,
        costInr: 0,
        liveCostInr: 0,
        sandboxCostInr: 0,
      });
    }
  } else {
    const dayCount = range === '30d' ? 30 : 7;
    const dayMs = 24 * 60 * 60 * 1000;
    const endDay = Math.floor(nowMs / dayMs) * dayMs;
    for (let i = dayCount - 1; i >= 0; i -= 1) {
      const ts = endDay - i * dayMs;
      const { bucketKey, label } = formatBucketKey(ts, range);
      buckets.set(bucketKey, {
        bucketKey,
        label,
        totalRequests: 0,
        successfulRequests: 0,
        notVerifiedRequests: 0,
        failedRequests: 0,
        costInr: 0,
        liveCostInr: 0,
        sandboxCostInr: 0,
      });
    }
  }

  let totalRequests = 0;
  let successfulRequests = 0;
  let notVerifiedRequests = 0;
  let failedRequests = 0;
  let chargedRequests = 0;
  let totalCostInr = 0;
  let liveCostInr = 0;
  let sandboxEstimatedCostInr = 0;
  let savedOnUnchargedErrorsInr = 0;
  let latencySum = 0;
  let latencyCount = 0;
  let rateLimitedCount = 0;
  let upstreamErrorCount = 0;
  let walletEmptyCount = 0;

  const productMap = new Map<
    string,
    {
      productSlug: string;
      productName: string;
      category: 'kyc' | 'kyb' | 'vehicle';
      unitPriceInr: number;
      totalRequests: number;
      successfulRequests: number;
      notVerifiedRequests: number;
      failedRequests: number;
      chargedRequests: number;
      costInr: number;
      liveCostInr: number;
      sandboxCostInr: number;
      latencySum: number;
      latencyCount: number;
    }
  >();

  for (const row of calls || []) {
    const ts = parseTimestampMs(row.created_at) ?? nowMs;
    if (ts < minTs) continue;

    const slug = String(row.product_slug || 'unknown').trim();
    const meta = API_SATHI_PRICING_CATALOG[slug];
    const unitPrice = getApiSathiUnitPriceInr(slug, options.priceOverrides);
    const httpStatus = Number(row.http_status || 0);
    const isBillable = isBillableApiSathiHttpStatus(httpStatus);
    const isSuccess = isSuccessfulApiSathiOutcome(row);
    const isNotVerified = isBillable && !isSuccess;
    const isFailed = !isBillable;
    const isSandbox =
      row.is_sandbox_test === 1 ||
      row.is_sandbox_test === true ||
      String(row.environment || '').toUpperCase() === 'SANDBOX';

    totalRequests += 1;
    if (isSuccess) successfulRequests += 1;
    else if (isNotVerified) notVerifiedRequests += 1;
    else failedRequests += 1;

    if (httpStatus === 429 || String(row.outcome || '').toUpperCase() === 'RATE_LIMITED') {
      rateLimitedCount += 1;
    }
    if (httpStatus >= 500 || String(row.outcome || '').toUpperCase() === 'UPSTREAM_ERROR') {
      upstreamErrorCount += 1;
    }
    if (httpStatus === 402 || String(row.error_code || '').toUpperCase() === 'INSUFFICIENT_BALANCE') {
      walletEmptyCount += 1;
    }

    const rowCost = isBillable ? unitPrice : 0;
    if (isBillable) {
      chargedRequests += 1;
      totalCostInr += rowCost;
      if (isSandbox) sandboxEstimatedCostInr += rowCost;
      else liveCostInr += rowCost;
    } else {
      savedOnUnchargedErrorsInr += unitPrice;
    }

    const lat = Number(row.latency_ms || 0);
    if (Number.isFinite(lat) && lat > 0) {
      latencySum += lat;
      latencyCount += 1;
    }

    const { bucketKey, label } = formatBucketKey(ts, range);
    const bucket = buckets.get(bucketKey) || {
      bucketKey,
      label,
      totalRequests: 0,
      successfulRequests: 0,
      notVerifiedRequests: 0,
      failedRequests: 0,
      costInr: 0,
      liveCostInr: 0,
      sandboxCostInr: 0,
    };
    bucket.totalRequests += 1;
    if (isSuccess) bucket.successfulRequests += 1;
    else if (isNotVerified) bucket.notVerifiedRequests += 1;
    else bucket.failedRequests += 1;
    bucket.costInr = roundInr(bucket.costInr + rowCost);
    if (isSandbox) bucket.sandboxCostInr = roundInr(bucket.sandboxCostInr + rowCost);
    else bucket.liveCostInr = roundInr(bucket.liveCostInr + rowCost);
    buckets.set(bucketKey, bucket);

    const existingProd = productMap.get(slug) || {
      productSlug: slug,
      productName: meta?.name || slug,
      category: meta?.category || 'kyc',
      unitPriceInr: unitPrice,
      totalRequests: 0,
      successfulRequests: 0,
      notVerifiedRequests: 0,
      failedRequests: 0,
      chargedRequests: 0,
      costInr: 0,
      liveCostInr: 0,
      sandboxCostInr: 0,
      latencySum: 0,
      latencyCount: 0,
    };
    existingProd.totalRequests += 1;
    if (isSuccess) existingProd.successfulRequests += 1;
    else if (isNotVerified) existingProd.notVerifiedRequests += 1;
    else existingProd.failedRequests += 1;
    if (isBillable) {
      existingProd.chargedRequests += 1;
      existingProd.costInr = roundInr(existingProd.costInr + rowCost);
      if (isSandbox) existingProd.sandboxCostInr = roundInr(existingProd.sandboxCostInr + rowCost);
      else existingProd.liveCostInr = roundInr(existingProd.liveCostInr + rowCost);
    }
    if (Number.isFinite(lat) && lat > 0) {
      existingProd.latencySum += lat;
      existingProd.latencyCount += 1;
    }
    productMap.set(slug, existingProd);
  }

  const timeSeries = Array.from(buckets.values()).sort((a, b) => a.bucketKey.localeCompare(b.bucketKey));

  const byProduct: ApiSathiProductUsageRow[] = Array.from(productMap.values())
    .map((p) => ({
      productSlug: p.productSlug,
      productName: p.productName,
      category: p.category,
      unitPriceInr: p.unitPriceInr,
      totalRequests: p.totalRequests,
      successfulRequests: p.successfulRequests,
      notVerifiedRequests: p.notVerifiedRequests,
      failedRequests: p.failedRequests,
      chargedRequests: p.chargedRequests,
      costInr: roundInr(p.costInr),
      liveCostInr: roundInr(p.liveCostInr),
      sandboxCostInr: roundInr(p.sandboxCostInr),
      avgLatencyMs: p.latencyCount > 0 ? Math.round(p.latencySum / p.latencyCount) : 0,
      successRatePercent:
        p.totalRequests > 0 ? Math.round((p.successfulRequests / p.totalRequests) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.costInr - a.costInr || b.totalRequests - a.totalRequests);

  const q = options.queueSummary || {};
  const pendingCount = Number(q.pendingCount || 0);
  const retryingCount = Number(q.retryingCount || 0);
  const succeededCount = Number(q.succeededCount || 0);
  const exhaustedCount = Number(q.exhaustedCount || 0);

  return {
    range,
    generatedAt: new Date(nowMs).toISOString(),
    summary: {
      totalRequests,
      successfulRequests,
      notVerifiedRequests,
      failedRequests,
      chargedRequests,
      successRatePercent:
        totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 1000) / 10 : 0,
      totalCostInr: roundInr(totalCostInr),
      liveCostInr: roundInr(liveCostInr),
      sandboxEstimatedCostInr: roundInr(sandboxEstimatedCostInr),
      savedOnUnchargedErrorsInr: roundInr(savedOnUnchargedErrorsInr),
      avgLatencyMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
      rateLimitedCount,
      upstreamErrorCount,
      walletEmptyCount,
    },
    timeSeries,
    byProduct,
    queueSummary: {
      pendingCount,
      retryingCount,
      succeededCount,
      exhaustedCount,
      totalCount: Number(q.totalCount ?? pendingCount + retryingCount + succeededCount + exhaustedCount),
    },
  };
}

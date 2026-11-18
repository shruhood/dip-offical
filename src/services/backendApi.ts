import { auth } from './firebase';
import type {
  ApplicationPaymentStatusItem,
  ApplicationPaymentStatusQueryItem,
  BackendPaymentHistoryRecord,
  PaymentStatusSummary,
} from '../lib/paymentStatus';

async function getAuthHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...(extra || {}) };
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Allow anonymous calls where permitted
  }
  return headers;
}

async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T | null; message: string; errorCode?: string | null }> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const authHeaders = await getAuthHeaders(
    isFormData ? undefined : { 'Content-Type': 'application/json' }
  );

  const res = await fetch(path, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const json = await res.json().catch(() => null);
  return {
    ok: res.ok && (json?.success ?? true),
    status: res.status,
    data: json?.data ?? json ?? null,
    message: json?.message || json?.error || (res.ok ? 'OK' : `HTTP ${res.status}`),
    errorCode: json?.error_code ?? null,
  };
}

export interface InfraOverviewResponse {
  plan: string;
  environment: string;
  domain: string;
  runtimeMode?: string;
  databases: {
    freePlanLimits: {
      maxPhysicalDatabases: number;
      maxDatabaseSizeBytes: number;
      maxTotalStorageBytes: number;
      dailyReadRowsLimit: number;
      dailyWriteRowsLimit: number;
    };
    physicalDatabasesBound: number;
    withinFreePlanLimit: boolean;
    databases: Array<{
      logicalName: string;
      slotNumber: number;
      activeBinding: string;
      dedicatedBindingConfigured: boolean;
      consolidatedOntoPrimary: boolean;
      purpose: string;
      modules: string[];
      ownedTablesCount: number;
      status: 'CONNECTED' | 'UNCONFIGURED' | 'ERROR';
      latencyMs: number;
      detectedTablesCount: number;
      appliedMigrations: string[];
      errorMessage?: string;
    }>;
  };
  storage: {
    freePlanLimits: {
      maxRecommendedLogicalBuckets: number;
      freeStorageLimitBytes: number;
      safetyThresholdBytes: number;
      warningThresholdBytes: number;
      freeClassAOpsPerMonth: number;
      freeClassBOpsPerMonth: number;
      maxSingleUploadBytes: number;
    };
    configuredSafetyThresholdBytes: number;
    physicalBucketsBound: number;
    totalBytesTrackedInRegistry: number;
    totalFilesTrackedInRegistry: number;
    quotaState: 'OK' | 'WARNING' | 'CRITICAL_STOP';
    buckets: Array<{
      logicalName: string;
      slotNumber: number;
      activeBinding: string;
      dedicatedBindingConfigured: boolean;
      consolidatedOntoPrimary: boolean;
      prefix: string;
      purpose: string;
      accessClassification: 'private' | 'internal' | 'public-read';
      status: 'CONNECTED' | 'UNCONFIGURED' | 'ERROR';
      fileCount: number;
      bytesUsed: number;
      maxFileSizeBytes: number;
      retentionDays: number | null;
      associatedModules: string[];
      errorMessage?: string;
    }>;
  };
  backups: Array<{
    id: string;
    backupType: string;
    logicalBucket: string;
    objectKey: string;
    databaseScope: string;
    tablesCount: number;
    rowsCount: number;
    byteSize: number;
    checksum: string;
    status: string;
    verificationStatus: string;
    createdBy: string;
    createdAt: string;
  }>;
  secretsReadiness: {
    authSigning: boolean;
    cashfreeGateway: boolean;
    cashfreeWebhook: boolean;
    digilocker: boolean;
    apiSetu: boolean;
    resendEmail: boolean;
    aiProvidersConfiguredCount: number;
  };
  recentEvents: Array<{
    id: string;
    resource_type: string;
    resource_name: string;
    severity: string;
    code: string;
    message: string;
    created_at: string;
  }>;
}

export async function fetchAdminInfrastructure() {
  return apiRequest<InfraOverviewResponse>('/api/admin/infrastructure', { method: 'GET' });
}

export async function runInfrastructureHealthCheck() {
  return apiRequest<{ databases: InfraOverviewResponse['databases']; storage: InfraOverviewResponse['storage'] }>(
    '/api/admin/infrastructure/health-check',
    { method: 'POST', body: '{}' }
  );
}

export async function createD1BackupToR2() {
  return apiRequest('/api/admin/backups/export', { method: 'POST', body: '{}' });
}

export async function verifyD1BackupInR2(backupId: string) {
  return apiRequest(`/api/admin/backups/${encodeURIComponent(backupId)}/verify`, {
    method: 'POST',
    body: '{}',
  });
}

export async function listR2Files(params?: { bucket?: string; applicationId?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.bucket) qs.set('bucket', params.bucket);
  if (params?.applicationId) qs.set('applicationId', params.applicationId);
  if (params?.limit) qs.set('limit', String(params.limit));
  const queryStr = qs.toString();
  return apiRequest(`/api/storage/files${queryStr ? `?${queryStr}` : ''}`, { method: 'GET' });
}

export async function uploadFileToR2(params: {
  file: File;
  bucket: string;
  applicationId?: string;
  documentCategory?: string;
  customerId?: string;
}) {
  const form = new FormData();
  form.append('file', params.file);
  form.append('bucket', params.bucket);
  if (params.applicationId) form.append('applicationId', params.applicationId);
  if (params.documentCategory) form.append('documentCategory', params.documentCategory);
  if (params.customerId) form.append('customerId', params.customerId);
  return apiRequest('/api/storage/upload', { method: 'POST', body: form });
}

export async function issueSignedFileDownloadUrl(fileId: string) {
  return apiRequest<{ downloadUrl: string; expiresAt: string }>(
    `/api/storage/files/${encodeURIComponent(fileId)}/signed-url`,
    { method: 'POST', body: '{}' }
  );
}

export async function deleteR2File(fileId: string) {
  return apiRequest(`/api/storage/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}

export async function syncBlogPostToD1(post: Record<string, any>) {
  return apiRequest('/api/admin/blog', {
    method: 'POST',
    body: JSON.stringify(post),
  });
}

export async function fetchD1BlogRevisions(postId: string) {
  return apiRequest<Array<{
    id: string;
    post_id: string;
    version: number;
    title: string;
    editor_uid: string;
    created_at: string;
  }>>(`/api/admin/blog/${encodeURIComponent(postId)}/revisions`, { method: 'GET' });
}

export async function downloadD1BackupFile(backupId: string): Promise<{ ok: boolean; message?: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/admin/backups/${encodeURIComponent(backupId)}/download`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    return { ok: false, message: errJson?.message || `Download failed (${res.status})` };
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${backupId}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true };
}

export async function fetchApiJunctionStatus() {
  return apiRequest('/api/integrations/status', { method: 'GET' });
}

export async function executeApiJunctionCall(params: {
  serviceCode: string;
  consentGiven: boolean;
  parameters: Record<string, unknown>;
}) {
  return apiRequest('/api/integrations/execute', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export interface CashfreeCreateOrderPayload {
  applicationId?: string;
  retryOfOrderId?: string;
  serviceId?: string;
  serviceSlug?: string;
  serviceName: string;
  serviceChargeInr: number;
  govtFeesInr: number;
  thirdPartyFeesInr?: number;
  additionalChargeInr?: number;
  urgentProcessing?: boolean;
  couponCode?: string;
  taxRateBps?: number;
  totalAmountInr: number;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  preferredMode?: 'sandbox' | 'production';
  idempotencyKey?: string;
  returnUrl?: string;
}

export interface CashfreeCreateOrderResponse {
  orderId: string;
  cfOrderId?: string;
  paymentSessionId: string;
  mode: 'sandbox' | 'production';
  gatewayConfigured: boolean;
  simulationOnly?: boolean;
  orderStatus?: string;
  normalizedState?: string;
  orderExpiryTime?: string;
  currency?: string;
}

export interface CashfreeOrderStatusResponse {
  orderId: string;
  cfOrderId?: string;
  applicationId?: string;
  invoiceNumber?: string;
  orderStatus: 'PAID' | 'ACTIVE' | 'CREATED' | 'EXPIRED' | 'FAILED' | 'PENDING' | 'DROPPED';
  normalizedState?: string;
  paid: boolean;
  cfPaymentId?: string;
  paymentMethod?: string;
  paymentTime?: string;
  bankReference?: string;
  paymentAmount?: number;
  amountInr?: number;
  paymentMessage?: string;
  gatewayConfigured: boolean;
  simulationOnly?: boolean;
  mode?: 'sandbox' | 'production';
}

export async function createCashfreePaymentOrder(
  payload: CashfreeCreateOrderPayload
): Promise<{ ok: boolean; data: CashfreeCreateOrderResponse | null; message: string }> {
  const isSignedIn = Boolean(auth.currentUser);

  if (isSignedIn) {
    const v1Res = await apiRequest<CashfreeCreateOrderResponse>('/api/v1/payments/orders', {
      method: 'POST',
      headers: payload.idempotencyKey ? { 'idempotency-key': payload.idempotencyKey } : undefined,
      body: JSON.stringify(payload),
    });

    if (v1Res.ok && v1Res.data?.orderId) {
      return { ok: true, data: v1Res.data, message: v1Res.message };
    }
    if (v1Res.status !== 401 && v1Res.status !== 404) {
      return { ok: false, data: null, message: v1Res.message };
    }
  }

  const fallbackHeaders = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const fallbackRes = await fetch('/api/payments/create-order', {
    method: 'POST',
    headers: fallbackHeaders,
    body: JSON.stringify({
      amount: payload.totalAmountInr,
      serviceId: payload.serviceId,
      serviceSlug: payload.serviceSlug,
      urgentProcessing: payload.urgentProcessing,
      couponCode: payload.couponCode,
      customerId: payload.customerId,
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      customerPhone: payload.customerPhone,
      serviceName: payload.serviceName,
      preferredMode: payload.preferredMode,
      returnUrl: payload.returnUrl,
    }),
  });
  const json = await fallbackRes.json().catch(() => null);
  if (!fallbackRes.ok || !json?.orderId) {
    const rawMsg = json?.error || json?.message || `Order creation failed (${fallbackRes.status})`;
    const friendlyMsg =
      fallbackRes.status === 401 && !isSignedIn
        ? 'Please sign in to your account before completing online payment.'
        : rawMsg;
    return {
      ok: false,
      data: null,
      message: friendlyMsg,
    };
  }
  return {
    ok: true,
    data: {
      orderId: json.orderId,
      cfOrderId: json.cfOrderId,
      paymentSessionId: json.paymentSessionId,
      mode: json.mode === 'production' ? 'production' : 'sandbox',
      gatewayConfigured: Boolean(json.gatewayConfigured),
      simulationOnly: Boolean(json.simulationOnly),
      orderStatus: json.status,
      currency: json.currency || 'INR',
    },
    message: 'Order created',
  };
}

export async function checkCashfreePaymentStatus(
  orderId: string,
  preferredMode?: 'sandbox' | 'production',
  simulateSandboxSuccess = false
): Promise<{ ok: boolean; data: CashfreeOrderStatusResponse | null; message: string }> {
  const isSignedIn = Boolean(auth.currentUser);
  const qsParts: string[] = [];
  if (preferredMode) qsParts.push(`mode=${encodeURIComponent(preferredMode)}`);
  if (simulateSandboxSuccess) qsParts.push('simulate=true');
  const modeQs = qsParts.length > 0 ? `?${qsParts.join('&')}` : '';

  if (isSignedIn) {
    const v1Res = await apiRequest<CashfreeOrderStatusResponse>(
      `/api/v1/payments/orders/${encodeURIComponent(orderId)}/status${modeQs}`,
      { method: 'GET' }
    );
    if (v1Res.ok && v1Res.data) {
      return { ok: true, data: v1Res.data, message: v1Res.message };
    }
    if (v1Res.status !== 401 && v1Res.status !== 404) {
      return { ok: false, data: v1Res.data, message: v1Res.message };
    }
  }

  const verifyHeaders = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const fallbackRes = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: verifyHeaders,
    body: JSON.stringify({ orderId, preferredMode, simulateSandboxSuccess }),
  });
  const json = await fallbackRes.json().catch(() => null);
  if (!fallbackRes.ok || !json) {
    return {
      ok: false,
      data: null,
      message: json?.error || json?.message || `Verification failed (${fallbackRes.status})`,
    };
  }
  return {
    ok: true,
    data: {
      orderId: String(json.orderId || orderId),
      orderStatus: json.orderStatus || (json.paid ? 'PAID' : 'ACTIVE'),
      paid: Boolean(json.paid ?? json.status === 'SUCCESS'),
      cfPaymentId: json.cfPaymentId,
      paymentMethod: json.paymentMethod,
      paymentTime: json.paymentTime,
      bankReference: json.bankReference,
      paymentMessage: json.paymentMessage,
      gatewayConfigured: Boolean(json.gatewayConfigured),
      simulationOnly: Boolean(json.simulationOnly),
      mode: json.mode,
    },
    message: json.paymentMessage || 'Status retrieved',
  };
}

export interface ApplicationsPaymentStatusResponse {
  items: ApplicationPaymentStatusItem[];
  summary: PaymentStatusSummary;
  gatewayConfigured: boolean;
  simulationOnly?: boolean;
  mode?: 'sandbox' | 'production';
  checkedAt: string;
}

export async function fetchApplicationsPaymentStatus(
  applications: ApplicationPaymentStatusQueryItem[],
  preferredMode?: 'sandbox' | 'production'
): Promise<{ ok: boolean; data: ApplicationsPaymentStatusResponse | null; message: string }> {
  const payload = {
    applications: applications.slice(0, 25),
    preferredMode,
  };
  const isSignedIn = Boolean(auth.currentUser);

  if (isSignedIn) {
    const v1Res = await apiRequest<ApplicationsPaymentStatusResponse>(
      '/api/v1/payments/applications/status',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    if (v1Res.ok && v1Res.data) {
      return { ok: true, data: v1Res.data, message: v1Res.message };
    }
    if (v1Res.status !== 401 && v1Res.status !== 404) {
      return { ok: false, data: v1Res.data, message: v1Res.message };
    }
  }

  const fallbackRes = await fetch('/api/payments/applications/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await fallbackRes.json().catch(() => null);
  if (!fallbackRes.ok || !json?.data) {
    return {
      ok: false,
      data: null,
      message: json?.message || json?.error || `Failed to query payment status (${fallbackRes.status})`,
    };
  }
  return {
    ok: true,
    data: json.data as ApplicationsPaymentStatusResponse,
    message: json.message || 'Payment statuses retrieved',
  };
}

export interface PaymentHistoryPageResponse {
  items: BackendPaymentHistoryRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export async function fetchPaymentHistoryPage(params?: {
  page?: number;
  pageSize?: number;
}): Promise<{
  ok: boolean;
  data: PaymentHistoryPageResponse;
  message: string;
}> {
  const page = Math.max(1, Math.floor(params?.page || 1));
  const pageSize = Math.min(Math.max(1, Math.floor(params?.pageSize || 20)), 100);
  const qs = `?page=${encodeURIComponent(String(page))}&pageSize=${encodeURIComponent(String(pageSize))}`;

  const isSignedIn = Boolean(auth.currentUser);
  if (isSignedIn) {
    const v1Res = await apiRequest<{
      items?: BackendPaymentHistoryRecord[];
      pagination?: PaymentHistoryPageResponse['pagination'];
    }>(`/api/v1/payments/history${qs}`, { method: 'GET' });
    if (v1Res.ok && v1Res.data) {
      const items = Array.isArray(v1Res.data.items) ? v1Res.data.items : [];
      return {
        ok: true,
        data: {
          items,
          pagination: v1Res.data.pagination || {
            page,
            pageSize,
            totalItems: items.length,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: page > 1,
          },
        },
        message: v1Res.message,
      };
    }
    if (v1Res.status !== 401 && v1Res.status !== 404) {
      return {
        ok: false,
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
        message: v1Res.message,
      };
    }
  }

  const fallbackRes = await fetch(`/api/payments/history${qs}`, { method: 'GET' });
  const json = await fallbackRes.json().catch(() => null);
  if (!fallbackRes.ok || !json?.data) {
    return {
      ok: false,
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
      message: json?.message || `Failed to load payment history (${fallbackRes.status})`,
    };
  }
  const items: BackendPaymentHistoryRecord[] = Array.isArray(json.data.items)
    ? json.data.items
    : [];
  return {
    ok: true,
    data: {
      items,
      pagination: json.data.pagination || {
        page,
        pageSize,
        totalItems: items.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: page > 1,
      },
    },
    message: json.message || 'Payment history retrieved',
  };
}

export async function fetchPaymentHistory(): Promise<{
  ok: boolean;
  data: BackendPaymentHistoryRecord[];
  message: string;
}> {
  const res = await fetchPaymentHistoryPage({ page: 1, pageSize: 50 });
  return {
    ok: res.ok,
    data: res.data.items,
    message: res.message,
  };
}

export interface DispatchPaymentAlertPayload {
  applicationId: string;
  orderId?: string;
  transactionId?: string;
  status: 'Paid' | 'Failed';
  serviceName: string;
  amountInr: number;
  recipientEmail: string;
  recipientName?: string;
  userId?: string;
  paymentMethod?: string;
}

export interface DispatchPaymentAlertResult {
  notificationId: string;
  applicationId: string;
  status: 'Paid' | 'Failed';
  inAppRecorded: boolean;
  emailDeliveryStatus: 'Sent' | 'Queued' | 'Failed' | 'Channel Unconfigured';
  emailConfigured: boolean;
  emailMessageId?: string;
  deduplicated?: boolean;
}

export async function dispatchPaymentStatusAlert(
  payload: DispatchPaymentAlertPayload
): Promise<{ ok: boolean; data: DispatchPaymentAlertResult | null; message: string }> {
  const isSignedIn = Boolean(auth.currentUser);
  if (isSignedIn) {
    const v1Res = await apiRequest<DispatchPaymentAlertResult>('/api/v1/notifications/payment-alert', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (v1Res.ok && v1Res.data) {
      return { ok: true, data: v1Res.data, message: v1Res.message };
    }
    if (v1Res.status !== 401 && v1Res.status !== 404) {
      return { ok: false, data: v1Res.data, message: v1Res.message };
    }
  }

  const fallbackRes = await fetch('/api/payments/payment-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await fallbackRes.json().catch(() => null);
  if (!fallbackRes.ok || !json?.data) {
    return {
      ok: false,
      data: null,
      message: json?.message || `Alert dispatch failed (${fallbackRes.status})`,
    };
  }
  return {
    ok: true,
    data: json.data as DispatchPaymentAlertResult,
    message: json.message || 'Payment alert processed',
  };
}

export async function validatePromoCoupon(params: {
  code: string;
  serviceChargeInr: number;
  category?: string;
}) {
  return apiRequest<{ valid: boolean; discountInr: number; message: string; coupon?: any }>(
    '/api/v1/coupons/validate',
    {
      method: 'POST',
      body: JSON.stringify(params),
    }
  );
}

export async function submitCustomQuote(params: {
  serviceSlug: string;
  serviceName: string;
  contactName: string;
  contactEmail: string;
  contactMobile: string;
  companyName?: string;
  requirementsSummary: string;
  budgetRange?: string;
  userId?: string;
}) {
  return apiRequest('/api/v1/quotes', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function createDigitalProductPurchase(params: {
  slug: string;
  couponCode?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  totalAmountInr?: number;
}) {
  return apiRequest<{
    orderId: string;
    paymentSessionId: string;
    orderStatus: 'PAID' | 'CREATED';
    productSlug: string;
    productName: string;
    totalInr: number;
    downloadUrl: string;
  }>(`/api/v1/products/${encodeURIComponent(params.slug)}/purchase`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function downloadAuthorizedDigitalProduct(params: {
  slug: string;
  orderId?: string;
  fallbackFileName?: string;
  fallbackGenerator?: () => { fileName: string; contentType: string; content: string };
}): Promise<{ ok: boolean; message?: string }> {
  const qs = params.orderId ? `?orderId=${encodeURIComponent(params.orderId)}` : '';
  const triggerBlobSave = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `/api/v1/products/${encodeURIComponent(params.slug)}/download${qs}`,
      { method: 'GET', headers }
    );
    if (res.ok) {
      const disp = res.headers.get('content-disposition') || '';
      const match = disp.match(/filename="?([^"]+)"?/i);
      const fileName = match?.[1] || params.fallbackFileName || `${params.slug}-download.csv`;
      const blob = await res.blob();
      triggerBlobSave(blob, fileName);
      return { ok: true };
    }
    const errJson = await res.json().catch(() => null);
    return {
      ok: false,
      message:
        errJson?.message ||
        errJson?.error ||
        (res.status === 401 || res.status === 403
          ? 'Authorized paid purchase verification required to download this digital product.'
          : `Download error (${res.status})`),
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Unable to verify product entitlement with server.',
    };
  }
}

export async function importCatalogueToBackend(params: {
  rawInput: any;
  formatHint?: 'json' | 'csv' | 'system_sync';
  actorName?: string;
}) {
  return apiRequest<{ report: any; totalCatalogueCount: number }>('/api/admin/catalogue/import', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function syncCatalogueServicesBackend(params?: {
  includePackages?: boolean;
  dryRun?: boolean;
  forceRefreshSeo?: boolean;
}) {
  return apiRequest<{
    report: any;
    totalCatalogueCount: number;
    createdIds: string[];
    updatedIds: string[];
    skippedIds: string[];
    dryRun: boolean;
  }>('/api/admin/catalogue/sync', {
    method: 'POST',
    body: JSON.stringify(params || {}),
  });
}

export interface TrackApplicationVerifiedResult {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceSlug: string;
  applicantMaskedName: string;
  status: string;
  customerRemarks: string;
  completionFileName: string | null;
  submissionDate: string;
  updatedAt: string;
  statusHistory: Array<{
    id: string;
    previousStatus: string;
    newStatus: string;
    updatedBy: string;
    updatedByRole: string;
    timestamp: string;
    customerMessage: string;
  }>;
}

export async function trackApplicationVerified(applicationId: string, contact: string) {
  return apiRequest<TrackApplicationVerifiedResult>('/api/v1/applications/track', {
    method: 'POST',
    body: JSON.stringify({ applicationId, contact }),
  });
}

export async function createUnifiedApplicationBackend(payload: {
  applicationId?: string;
  serviceSlug?: string;
  serviceId?: string;
  applicantName?: string;
  applicantEmail?: string;
  applicantMobile?: string;
  customerUserId?: string;
  urgentProcessing?: boolean;
  couponCode?: string;
  serviceChargeInr?: number;
  govtFeesInr?: number;
  formData?: Record<string, any>;
}) {
  return apiRequest('/api/v1/applications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function assignApplicationBackend(
  appId: string,
  operatorUserId: string,
  operatorName: string
) {
  return apiRequest(`/api/v1/applications/${encodeURIComponent(appId)}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ operatorUserId, operatorName }),
  });
}

export async function bulkAssignApplicationsBackend(
  applicationIds: string[],
  operatorUserId: string,
  operatorName: string
) {
  return apiRequest('/api/v1/applications/bulk-assign', {
    method: 'POST',
    body: JSON.stringify({ applicationIds, operatorUserId, operatorName }),
  });
}

export async function reviewApplicationDocumentBackend(
  appId: string,
  docId: string,
  decision: 'Verified' | 'Rejected' | 'Re-upload Requested',
  reason?: string
) {
  return apiRequest(
    `/api/v1/applications/${encodeURIComponent(appId)}/documents/${encodeURIComponent(docId)}/review`,
    {
      method: 'PATCH',
      body: JSON.stringify({ decision, reason }),
    }
  );
}

export async function completeApplicationBackend(
  appId: string,
  completionFileName: string,
  completionFileUrl: string
) {
  return apiRequest(`/api/v1/applications/${encodeURIComponent(appId)}/completion`, {
    method: 'POST',
    body: JSON.stringify({ completionFileName, completionFileUrl }),
  });
}

export async function createSupportTicketBackend(payload: {
  subject: string;
  category: string;
  message: string;
  priority?: string;
  applicationId?: string;
}) {
  return apiRequest('/api/v1/tickets', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function replySupportTicketBackend(
  ticketId: string,
  message: string,
  status?: 'Open' | 'In Progress' | 'Resolved' | 'Closed'
) {
  return apiRequest(`/api/v1/tickets/${encodeURIComponent(ticketId)}/reply`, {
    method: 'POST',
    body: JSON.stringify({ message, status }),
  });
}

export async function requestRefundBackend(payload: {
  applicationId: string;
  orderId: string;
  amount: number;
  reason: string;
}) {
  return apiRequest('/api/v1/refunds', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function processRefundBackend(
  refundId: string,
  decision: 'Approved' | 'Processed' | 'Rejected'
) {
  return apiRequest(`/api/v1/refunds/${encodeURIComponent(refundId)}/process`, {
    method: 'PATCH',
    body: JSON.stringify({ decision }),
  });
}

export async function enrollPartnerBackend(payload: Record<string, any>) {
  return apiRequest('/api/v1/partners/enroll', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function addPartnerCustomerBackend(payload: {
  name: string;
  email: string;
  mobile: string;
}) {
  return apiRequest('/api/v1/partners/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function requestSettlementBackend(amountInr: number) {
  return apiRequest('/api/v1/settlements/request', {
    method: 'POST',
    body: JSON.stringify({ amountInr }),
  });
}

export async function markAllNotificationsReadBackend() {
  return apiRequest('/api/v1/notifications/read-all', {
    method: 'POST',
    body: '{}',
  });
}

export interface CustomerVaultItemRecord {
  id: string;
  user_id: string;
  doc_type: string;
  doc_title: string;
  doc_number_masked?: string | null;
  file_id?: string | null;
  r2_object_key?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  expires_on?: string | null;
  created_at: string;
}

export async function fetchCustomerVault() {
  return apiRequest<CustomerVaultItemRecord[]>('/api/v1/vault', { method: 'GET' });
}

export async function createVaultItem(payload: {
  docType: string;
  docTitle: string;
  docNumberMasked?: string;
  fileId?: string;
  r2ObjectKey?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  expiresOn?: string;
}) {
  return apiRequest('/api/v1/vault', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteVaultItem(id: string) {
  return apiRequest(`/api/v1/vault/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export interface ComplianceReminderRecord {
  id: string;
  user_id: string;
  title: string;
  category: string;
  due_date: string;
  frequency: string;
  status: 'Upcoming' | 'Completed' | 'Snoozed';
  notes?: string | null;
  related_service_slug?: string | null;
  created_at: string;
}

export async function fetchComplianceReminders() {
  return apiRequest<ComplianceReminderRecord[]>('/api/v1/reminders', { method: 'GET' });
}

export async function createComplianceReminder(payload: {
  title: string;
  category: string;
  dueDate: string;
  frequency: string;
  notes?: string;
  relatedServiceSlug?: string;
}) {
  return apiRequest('/api/v1/reminders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateComplianceReminder(
  id: string,
  status: 'Upcoming' | 'Completed' | 'Snoozed'
) {
  return apiRequest(`/api/v1/reminders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteComplianceReminder(id: string) {
  return apiRequest(`/api/v1/reminders/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchB2BProfile() {
  return apiRequest<Record<string, any> | null>('/api/v1/b2b/profile', { method: 'GET' });
}

export async function saveB2BProfile(payload: {
  companyName: string;
  gstin?: string;
  pan?: string;
  businessType?: string;
  industry?: string;
  contactPhone?: string;
  registeredAddress?: string;
  webhookUrl?: string;
}) {
  return apiRequest('/api/v1/b2b/profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function rotateB2BApiKey() {
  return apiRequest<{ businessId: string; apiKey: string }>('/api/v1/b2b/rotate-key', {
    method: 'POST',
    body: '{}',
  });
}

export async function fetchB2BMembers() {
  return apiRequest<any[]>('/api/v1/b2b/members', { method: 'GET' });
}

export async function addB2BMember(payload: { email: string; name?: string; role?: 'ADMIN' | 'MEMBER' | 'VIEWER' }) {
  return apiRequest('/api/v1/b2b/members', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchB2BBulkJobs() {
  return apiRequest<any[]>('/api/v1/b2b/bulk-jobs', { method: 'GET' });
}

export async function enforceR2Retention(dryRun = true) {
  return apiRequest<{
    scannedCount: number;
    expiredCount: number;
    deletedCount: number;
    dryRun: boolean;
    deletedFileIds: string[];
  }>('/api/admin/storage/enforce-retention', {
    method: 'POST',
    body: JSON.stringify({ dryRun, limit: 100 }),
  });
}

export interface SandboxTestOrderData {
  orderId: string;
  paymentSessionId: string;
  amountInr: number;
  channel: 'operator' | 'partner';
  mode: 'sandbox';
  orderStatus: string;
  webhookEndpoint: string;
  secretConfigured: boolean;
}

export interface SandboxWebhookVerifyResult {
  orderId: string;
  cfPaymentId: string;
  eventType: string;
  paymentMethod: string;
  amountInr: number;
  signaturePrefix: string;
  webhookEndpoint: string;
  usingConfiguredSecret: boolean;
  firstDelivery: {
    httpStatus: number;
    success: boolean;
    resolvedOrderStatus: string | null;
    message: string | null;
    durationMs: number;
  };
  idempotencyReplay: {
    httpStatus: number;
    deduplicated: boolean;
    message: string | null;
    durationMs: number;
  } | null;
  persistedOrderStatus?: string;
  verifiedEndToEnd: boolean;
  sandboxIsolated: boolean;
}

export async function createSandboxTestOrder(params: {
  amountInr?: number;
  channel: 'operator' | 'partner';
}) {
  const v1Res = await apiRequest<SandboxTestOrderData>('/api/v1/payments/sandbox-test/order', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  if (v1Res.ok || v1Res.status !== 404) {
    return v1Res;
  }
  return apiRequest<SandboxTestOrderData>('/api/payments/sandbox-test/order', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function verifySandboxWebhookEndToEnd(params: {
  orderId: string;
  eventType: 'PAYMENT_SUCCESS_WEBHOOK' | 'PAYMENT_FAILED_WEBHOOK' | 'PAYMENT_USER_DROPPED_WEBHOOK';
  paymentMethod: 'upi' | 'card' | 'netbanking';
  amountInr: number;
}) {
  const v1Res = await apiRequest<SandboxWebhookVerifyResult>(
    '/api/v1/payments/sandbox-test/verify-webhook',
    {
      method: 'POST',
      body: JSON.stringify(params),
    }
  );
  if (v1Res.ok || v1Res.status !== 404) {
    return v1Res;
  }
  return apiRequest<SandboxWebhookVerifyResult>('/api/payments/sandbox-test/verify-webhook', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function verifyCashfreePaymentOrder(
  orderId: string,
  preferredMode?: 'sandbox' | 'production'
) {
  return apiRequest<CashfreeOrderStatusResponse>(
    `/api/v1/payments/orders/${encodeURIComponent(orderId)}/verify`,
    {
      method: 'POST',
      body: JSON.stringify({ preferredMode }),
    }
  );
}

export async function fetchPaymentOrderDetail(orderId: string) {
  return apiRequest<{
    order: Record<string, any>;
    payment: Record<string, any> | null;
    invoice: Record<string, any> | null;
    refunds: any[];
    webhooks: any[];
  }>(`/api/v1/payments/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
}

export async function executeOrderRefund(
  orderId: string,
  payload: { refundAmount?: number; refundSpeed?: 'STANDARD' | 'INSTANT'; reason?: string }
) {
  return apiRequest<{
    refundId: string;
    cfRefundId?: string | null;
    refundArn?: string | null;
    refundStatus: string;
    refundedAmount: number;
    isPartial: boolean;
  }>(`/api/v1/payments/orders/${encodeURIComponent(orderId)}/refund`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface AdminPaymentAnalytics {
  totalCollectedInr: number;
  todayCollectedInr: number;
  monthCollectedInr: number;
  totalRefundedInr: number;
  netRevenueInr: number;
  paidCount: number;
  failedOrExpiredCount: number;
  pendingCount: number;
  averageTicketInr: number;
  unresolvedRefundsCount: number;
  failedWebhooksCount: number;
}

export async function fetchAdminPaymentAnalytics() {
  return apiRequest<AdminPaymentAnalytics>('/api/admin/payments/analytics', { method: 'GET' });
}

export async function fetchAdminPayments(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  method?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params?.status) qs.set('status', params.status);
  if (params?.method) qs.set('method', params.method);
  if (params?.search) qs.set('search', params.search);
  if (params?.fromDate) qs.set('fromDate', params.fromDate);
  if (params?.toDate) qs.set('toDate', params.toDate);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<{
    items: any[];
    pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
  }>(`/api/admin/payments${query}`, { method: 'GET' });
}

export async function fetchAdminPaymentRefunds() {
  return apiRequest<any[]>('/api/admin/payments/refunds', { method: 'GET' });
}

export async function fetchAdminPaymentWebhooks(params?: {
  processingStatus?: string;
  orderId?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.processingStatus) qs.set('processingStatus', params.processingStatus);
  if (params?.orderId) qs.set('orderId', params.orderId);
  if (params?.limit) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<any[]>(`/api/admin/payments/webhooks${query}`, { method: 'GET' });
}

export async function replayAdminPaymentWebhook(eventId: string) {
  return apiRequest<any>(
    `/api/admin/payments/webhooks/${encodeURIComponent(eventId)}/replay`,
    { method: 'POST', body: '{}' }
  );
}

export async function runAdminPaymentReconcile(limit = 25) {
  return apiRequest<{
    checkedCount: number;
    reconciledPaidCount: number;
    updatedFailedCount: number;
    skippedCount: number;
    details: Array<{ orderId: string; previousStatus: string; nextStatus: string; action: string }>;
  }>('/api/admin/payments/reconcile', {
    method: 'POST',
    body: JSON.stringify({ limit }),
  });
}

export interface AdminCashfreeGatewayConfig {
  mode: 'sandbox' | 'production';
  apiVersion: string;
  isEnabled: boolean;
  autoVerify: boolean;
  orderExpiryMinutes: number;
  retryAttempts: number;
  clientIdConfigured: boolean;
  clientIdMasked: string | null;
  clientSecretConfigured: boolean;
  webhookSecretConfigured: boolean;
  webhookUrl: string;
  returnUrlTemplate: string;
  paymentsEmail: string;
}

export async function fetchAdminPaymentConfig() {
  return apiRequest<AdminCashfreeGatewayConfig>('/api/admin/payments/config', { method: 'GET' });
}

export async function saveAdminPaymentConfig(payload: {
  mode?: 'sandbox' | 'production';
  apiVersion?: string;
  isEnabled?: boolean;
  autoVerify?: boolean;
  orderExpiryMinutes?: number;
  retryAttempts?: number;
}) {
  return apiRequest<AdminCashfreeGatewayConfig>('/api/admin/payments/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export interface AdminPaymentCutoverCheckItem {
  key: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface AdminPaymentCutoverCheckResult {
  readyForProduction: boolean;
  mode: 'sandbox' | 'production';
  apiVersion: string;
  isEnabled: boolean;
  checkedAt: string;
  probe: {
    configured: boolean;
    reachable: boolean;
    authenticated: boolean;
    httpStatus: number;
    mode: 'sandbox' | 'production';
    baseUrl: string;
    latencyMs: number;
    message: string;
  };
  checks: AdminPaymentCutoverCheckItem[];
  webhookSetup: {
    url: string;
    legacyUrl: string;
    events: string[];
  };
  cliCommands: {
    setSecret: string;
    migrateD1: string;
    deployWorker: string;
  };
}

export async function runAdminPaymentCutoverCheck() {
  return apiRequest<AdminPaymentCutoverCheckResult>('/api/admin/payments/cutover-check', {
    method: 'POST',
    body: '{}',
  });
}

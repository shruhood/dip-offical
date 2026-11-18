import type {
  Application,
  PaymentStatus as ApplicationPaymentRecordStatus,
  PaymentTransaction,
} from '../types';

export type PaymentUiStatus = 'Pending' | 'Paid' | 'Failed';
export type PaymentBadgeStatus = 'pending' | 'paid' | 'failed';

export function toPaymentBadgeStatus(
  status?: PaymentUiStatus | PaymentBadgeStatus | string | null,
  paidFlag?: boolean
): PaymentBadgeStatus {
  const ui = normalizePaymentUiStatus(status, paidFlag);
  if (ui === 'Paid') return 'paid';
  if (ui === 'Failed') return 'failed';
  return 'pending';
}

export interface ApplicationPaymentStatusQueryItem {
  applicationId: string;
  orderId?: string;
  currentStatus?: string;
}

export interface ApplicationPaymentStatusItem {
  applicationId: string;
  orderId: string;
  uiStatus: PaymentUiStatus;
  gatewayStatus: string;
  paid: boolean;
  cfPaymentId?: string;
  paymentMethod?: string;
  paymentTime?: string;
  bankReference?: string;
  paymentAmount?: number;
  paymentMessage?: string;
  gatewayConfigured: boolean;
  simulationOnly?: boolean;
  mode?: 'sandbox' | 'production';
  source:
    | 'webhook_or_ledger'
    | 'cashfree_live'
    | 'sandbox_preview'
    | 'gateway_unreachable'
    | 'missing_order_id';
  checkedAt: string;
  errorMessage?: string;
}

export interface PaymentStatusSummary {
  total: number;
  paid: number;
  pending: number;
  failed: number;
}

export interface BackendPaymentHistoryRecord {
  orderId: string;
  applicationId: string;
  transactionId?: string;
  cfPaymentId?: string;
  bankReference?: string;
  invoiceNumber?: string;
  amount: number;
  currency?: string;
  status: string;
  normalizedState?: string;
  refundedAmount?: number;
  orderExpiryTime?: string;
  lastError?: string;
  paymentMethod?: string;
  date: string;
  serviceName?: string;
  gatewaySessionId?: string;
}

export interface PaymentHistoryEntry {
  id: string;
  transactionId: string;
  orderId: string;
  applicationId: string;
  serviceName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  date: string;
  uiStatus: PaymentUiStatus;
  gatewayStatus?: string;
  normalizedState?: string;
  refundedAmount?: number;
  orderExpiryTime?: string;
  lastError?: string;
  receiptNumber?: string;
  invoiceNumber?: string;
  bankReference?: string;
  source: 'transaction' | 'gateway_sync' | 'application' | 'backend_order';
}

const PAID_STATUS_SET = new Set([
  'PAID',
  'SUCCESS',
  'SUCCEEDED',
  'CAPTURED',
  'SETTLED',
  'COMPLETED',
  'PAYMENT CONFIRMED',
  'PAYMENT SUCCESSFUL',
]);

const FAILED_STATUS_SET = new Set([
  'FAILED',
  'FAILURE',
  'EXPIRED',
  'CANCELLED',
  'CANCELED',
  'DROPPED',
  'USER DROPPED',
  'TERMINATED',
  'DECLINED',
  'VOID',
  'REJECTED',
  'PAYMENT FAILED',
]);

export function normalizePaymentUiStatus(
  rawStatus?: string | null,
  paidFlag?: boolean
): PaymentUiStatus {
  if (paidFlag === true) return 'Paid';
  const normalized = String(rawStatus || '')
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, ' ');

  if (!normalized) return 'Pending';
  if (PAID_STATUS_SET.has(normalized)) return 'Paid';
  if (FAILED_STATUS_SET.has(normalized)) return 'Failed';
  return 'Pending';
}

export function mapUiStatusToRecordStatus(
  uiStatus: PaymentUiStatus
): ApplicationPaymentRecordStatus {
  if (uiStatus === 'Paid') return 'Success';
  if (uiStatus === 'Failed') return 'Failed';
  return 'Pending';
}

export function deriveInitialPaymentUiStatus(app: Application): PaymentUiStatus {
  if (app.payment?.status) {
    const fromPayment = normalizePaymentUiStatus(app.payment.status);
    if (fromPayment !== 'Pending') return fromPayment;
  }
  if (app.status === 'Payment Confirmed' || app.status === 'Payment Successful') {
    return 'Paid';
  }
  return normalizePaymentUiStatus(app.payment?.status);
}

export function summarizePaymentStatuses(
  statuses: Array<{ uiStatus: PaymentUiStatus }>
): PaymentStatusSummary {
  let paid = 0;
  let pending = 0;
  let failed = 0;
  for (const item of statuses) {
    if (item.uiStatus === 'Paid') paid += 1;
    else if (item.uiStatus === 'Failed') failed += 1;
    else pending += 1;
  }
  return {
    total: statuses.length,
    paid,
    pending,
    failed,
  };
}

export function buildPaymentHistoryEntries(params: {
  applications?: Application[];
  transactions?: PaymentTransaction[];
  statusMap?: Record<string, ApplicationPaymentStatusItem>;
  backendHistory?: BackendPaymentHistoryRecord[];
}): PaymentHistoryEntry[] {
  const {
    applications = [],
    transactions = [],
    statusMap = {},
    backendHistory = [],
  } = params;

  const entryMap = new Map<string, PaymentHistoryEntry>();
  const appById = new Map<string, Application>();
  for (const app of applications) {
    appById.set(app.id, app);
  }

  // 1. Seed from explicit PaymentTransaction ledger records
  for (const tx of transactions) {
    const key = tx.orderId?.trim() || tx.id;
    const matchedApp = appById.get(tx.applicationId);
    const live = matchedApp ? statusMap[matchedApp.id] : undefined;
    const sameOrderLive =
      live && (!live.orderId || !tx.orderId || live.orderId === tx.orderId) ? live : undefined;

    const uiStatus = sameOrderLive
      ? sameOrderLive.uiStatus
      : normalizePaymentUiStatus(tx.status);

    entryMap.set(key, {
      id: key,
      transactionId:
        sameOrderLive?.cfPaymentId ||
        (matchedApp?.payment?.orderId === tx.orderId ? matchedApp?.payment?.cfPaymentId : undefined) ||
        tx.id ||
        tx.orderId,
      orderId: tx.orderId || key,
      applicationId: tx.applicationId,
      serviceName: tx.serviceName || matchedApp?.serviceName || 'Digital India Service',
      amount:
        typeof sameOrderLive?.paymentAmount === 'number'
          ? sameOrderLive.paymentAmount
          : tx.amount,
      currency: tx.currency || 'INR',
      paymentMethod: sameOrderLive?.paymentMethod || tx.paymentMethod || 'Online Payment',
      date: sameOrderLive?.paymentTime || tx.transactionDate,
      uiStatus,
      gatewayStatus: sameOrderLive?.gatewayStatus || tx.status,
      receiptNumber: tx.receiptNumber || `RCPT-${tx.orderId || tx.id}`,
      invoiceNumber: tx.invoiceNumber || matchedApp?.payment?.invoiceNumber,
      bankReference: sameOrderLive?.bankReference,
      source: sameOrderLive ? 'gateway_sync' : 'transaction',
    });
  }

  // 2. Merge backend persisted payment_orders rows (if any new or more recent gateway state)
  for (const rec of backendHistory) {
    const key = rec.orderId?.trim() || rec.transactionId || rec.applicationId;
    if (!key) continue;
    const existing = entryMap.get(key);
    const matchedApp = appById.get(rec.applicationId);
    const uiStatus = normalizePaymentUiStatus(rec.status);

    if (existing) {
      entryMap.set(key, {
        ...existing,
        transactionId:
          existing.source === 'gateway_sync'
            ? existing.transactionId
            : rec.cfPaymentId || rec.transactionId || existing.transactionId,
        amount: existing.amount || rec.amount,
        date: existing.date || rec.date,
        paymentMethod:
          existing.paymentMethod && existing.paymentMethod !== 'Online Payment'
            ? existing.paymentMethod
            : rec.paymentMethod || existing.paymentMethod,
        uiStatus: existing.source === 'gateway_sync' ? existing.uiStatus : uiStatus,
        gatewayStatus: existing.gatewayStatus || rec.status,
        normalizedState: rec.normalizedState || existing.normalizedState,
        refundedAmount:
          typeof rec.refundedAmount === 'number' ? rec.refundedAmount : existing.refundedAmount,
        orderExpiryTime: rec.orderExpiryTime || existing.orderExpiryTime,
        lastError: rec.lastError || existing.lastError,
        invoiceNumber: existing.invoiceNumber || rec.invoiceNumber,
        bankReference: existing.bankReference || rec.bankReference,
      });
    } else {
      entryMap.set(key, {
        id: key,
        transactionId: rec.cfPaymentId || rec.transactionId || rec.orderId || key,
        orderId: rec.orderId || key,
        applicationId: rec.applicationId,
        serviceName: rec.serviceName || matchedApp?.serviceName || 'Service Application',
        amount: rec.amount,
        currency: rec.currency || 'INR',
        paymentMethod: rec.paymentMethod || 'Cashfree PG',
        date: rec.date,
        uiStatus,
        gatewayStatus: rec.status,
        normalizedState: rec.normalizedState,
        refundedAmount: rec.refundedAmount,
        orderExpiryTime: rec.orderExpiryTime,
        lastError: rec.lastError,
        invoiceNumber: rec.invoiceNumber || matchedApp?.payment?.invoiceNumber,
        bankReference: rec.bankReference,
        source: 'backend_order',
      });
    }
  }

  // 3. Ensure every application's payment record (and live gateway sync) appears in history
  for (const app of applications) {
    const live = statusMap[app.id];
    const orderId = live?.orderId || app.payment?.orderId || '';
    const key = orderId || `APP_PAY_${app.id}`;
    const existing = entryMap.get(key);
    const uiStatus: PaymentUiStatus = live?.uiStatus ?? deriveInitialPaymentUiStatus(app);
    const resolvedAmount =
      typeof live?.paymentAmount === 'number'
        ? live.paymentAmount
        : app.payment?.totalAmount ?? 0;
    const resolvedDate =
      live?.paymentTime ||
      app.payment?.paidAt ||
      app.updatedAt ||
      app.submissionDate;

    if (existing) {
      entryMap.set(key, {
        ...existing,
        transactionId:
          live?.cfPaymentId ||
          app.payment?.cfPaymentId ||
          existing.transactionId ||
          orderId ||
          app.id,
        orderId: orderId || existing.orderId,
        applicationId: existing.applicationId || app.id,
        serviceName: existing.serviceName || app.serviceName,
        amount: resolvedAmount || existing.amount,
        paymentMethod:
          live?.paymentMethod ||
          app.payment?.paymentMethod ||
          existing.paymentMethod ||
          'Online Payment',
        date: live?.paymentTime || app.payment?.paidAt || existing.date,
        uiStatus,
        gatewayStatus: live?.gatewayStatus || existing.gatewayStatus,
        invoiceNumber: app.payment?.invoiceNumber || existing.invoiceNumber,
        bankReference: live?.bankReference || existing.bankReference,
        source: live ? 'gateway_sync' : existing.source,
      });
    } else if (orderId || resolvedAmount > 0 || app.payment) {
      entryMap.set(key, {
        id: key,
        transactionId: live?.cfPaymentId || app.payment?.cfPaymentId || orderId || `TXN-${app.id}`,
        orderId: orderId || 'Unassigned',
        applicationId: app.id,
        serviceName: app.serviceName,
        amount: resolvedAmount,
        currency: 'INR',
        paymentMethod: live?.paymentMethod || app.payment?.paymentMethod || 'Online Payment',
        date: resolvedDate,
        uiStatus,
        gatewayStatus: live?.gatewayStatus || app.payment?.status,
        invoiceNumber: app.payment?.invoiceNumber,
        bankReference: live?.bankReference,
        source: live ? 'gateway_sync' : 'application',
      });
    }
  }

  return Array.from(entryMap.values()).sort((a, b) => {
    const tA = new Date(a.date).getTime();
    const tB = new Date(b.date).getTime();
    return (Number.isFinite(tB) ? tB : 0) - (Number.isFinite(tA) ? tA : 0);
  });
}

function escapeCsvField(value: string | number | undefined): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatPaymentHistoryCsv(entries: PaymentHistoryEntry[]): string {
  const header = [
    'Date',
    'Transaction ID',
    'Order ID',
    'Application ID',
    'Service Name',
    'Payment Method',
    'Amount (INR)',
    'Currency',
    'Status',
    'Receipt / Invoice',
    'Bank Reference',
  ].join(',');

  const rows = entries.map((e) =>
    [
      escapeCsvField(e.date),
      escapeCsvField(e.transactionId),
      escapeCsvField(e.orderId),
      escapeCsvField(e.applicationId),
      escapeCsvField(e.serviceName),
      escapeCsvField(e.paymentMethod),
      escapeCsvField(e.amount),
      escapeCsvField(e.currency),
      escapeCsvField(e.uiStatus),
      escapeCsvField(e.invoiceNumber || e.receiptNumber || ''),
      escapeCsvField(e.bankReference || ''),
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

export interface PaymentOverviewItem {
  applicationId: string;
  serviceName: string;
  orderId: string;
  amount: number;
  uiStatus: PaymentUiStatus;
  date: string;
}

export interface PaymentOverviewMetrics {
  totalApplications: number;
  completedCount: number;
  completedAmount: number;
  pendingCount: number;
  pendingAmount: number;
  failedCount: number;
  failedAmount: number;
  totalBilledAmount: number;
  completionPercent: number;
  pendingItems: PaymentOverviewItem[];
  completedItems: PaymentOverviewItem[];
}

export function computePaymentOverviewMetrics(
  applications: Application[],
  statusMap: Record<string, ApplicationPaymentStatusItem> = {}
): PaymentOverviewMetrics {
  let completedCount = 0;
  let completedAmount = 0;
  let pendingCount = 0;
  let pendingAmount = 0;
  let failedCount = 0;
  let failedAmount = 0;

  const pendingItems: PaymentOverviewItem[] = [];
  const completedItems: PaymentOverviewItem[] = [];

  for (const app of applications) {
    const live = statusMap[app.id];
    const uiStatus: PaymentUiStatus = live?.uiStatus ?? deriveInitialPaymentUiStatus(app);
    const amount =
      typeof live?.paymentAmount === 'number'
        ? live.paymentAmount
        : Number(app.payment?.totalAmount ?? 0) || 0;
    const orderId = live?.orderId || app.payment?.orderId || 'Unassigned';
    const date = live?.paymentTime || app.payment?.paidAt || app.updatedAt || app.submissionDate;

    if (uiStatus === 'Paid') {
      completedCount += 1;
      completedAmount += amount;
      completedItems.push({
        applicationId: app.id,
        serviceName: app.serviceName,
        orderId,
        amount,
        uiStatus,
        date,
      });
    } else if (uiStatus === 'Failed') {
      failedCount += 1;
      failedAmount += amount;
      pendingItems.push({
        applicationId: app.id,
        serviceName: app.serviceName,
        orderId,
        amount,
        uiStatus,
        date,
      });
    } else {
      pendingCount += 1;
      pendingAmount += amount;
      pendingItems.push({
        applicationId: app.id,
        serviceName: app.serviceName,
        orderId,
        amount,
        uiStatus,
        date,
      });
    }
  }

  const sortNewest = (a: PaymentOverviewItem, b: PaymentOverviewItem) => {
    const tA = new Date(a.date).getTime();
    const tB = new Date(b.date).getTime();
    return (Number.isFinite(tB) ? tB : 0) - (Number.isFinite(tA) ? tA : 0);
  };

  pendingItems.sort(sortNewest);
  completedItems.sort(sortNewest);

  const totalBilledAmount = completedAmount + pendingAmount + failedAmount;
  const completionPercent =
    totalBilledAmount > 0
      ? Math.round((completedAmount / totalBilledAmount) * 100)
      : applications.length > 0
      ? Math.round((completedCount / applications.length) * 100)
      : 0;

  return {
    totalApplications: applications.length,
    completedCount,
    completedAmount,
    pendingCount,
    pendingAmount,
    failedCount,
    failedAmount,
    totalBilledAmount,
    completionPercent,
    pendingItems,
    completedItems,
  };
}

export interface PaymentStatusAlertPayload {
  dedupeKey: string;
  eventKey: 'PAYMENT_PAID' | 'PAYMENT_FAILED';
  status: 'Paid' | 'Failed';
  applicationId: string;
  orderId: string;
  transactionId: string;
  serviceName: string;
  amountInr: number;
  recipientEmail: string;
  recipientName: string;
  userId: string;
  paymentMethod: string;
  title: string;
  titleHi: string;
  message: string;
  messageHi: string;
  emailSubject: string;
  eventTime: string;
}

export function buildPaymentStatusAlertNotification(params: {
  app: Application;
  nextUiStatus: PaymentUiStatus;
  orderId?: string;
  cfPaymentId?: string;
  paymentMethod?: string;
  eventTime?: string;
}): PaymentStatusAlertPayload | null {
  const { app, nextUiStatus } = params;
  if (nextUiStatus !== 'Paid' && nextUiStatus !== 'Failed') {
    return null;
  }

  const effectiveOrderId = (params.orderId || app.payment?.orderId || '').trim();
  const transactionId =
    params.cfPaymentId || app.payment?.cfPaymentId || effectiveOrderId || app.id;
  const amountInr = Number(app.payment?.totalAmount ?? 0) || 0;
  const paymentMethod = params.paymentMethod || app.payment?.paymentMethod || 'Cashfree PG';
  const eventTime = params.eventTime || new Date().toISOString();
  const formattedAmount = `₹${amountInr.toLocaleString('en-IN')}`;
  const dedupeKey = `${app.id}:${effectiveOrderId || 'NO_ORDER'}:${nextUiStatus}`;

  if (nextUiStatus === 'Paid') {
    return {
      dedupeKey,
      eventKey: 'PAYMENT_PAID',
      status: 'Paid',
      applicationId: app.id,
      orderId: effectiveOrderId || app.id,
      transactionId,
      serviceName: app.serviceName,
      amountInr,
      recipientEmail: app.userEmail,
      recipientName: app.userName,
      userId: app.userId,
      paymentMethod,
      title: `Payment Confirmed: ${formattedAmount} for ${app.serviceName}`,
      titleHi: `भुगतान सफल: ${app.serviceName} के लिए ${formattedAmount}`,
      message: `Payment of ${formattedAmount} via ${paymentMethod} succeeded for application ${app.id}${
        effectiveOrderId ? ` (Order ${effectiveOrderId})` : ''
      }. Your application is cleared for compliance review.`,
      messageHi: `आवेदन ${app.id} के लिए ${formattedAmount} का भुगतान (${paymentMethod}) सफल रहा।`,
      emailSubject: `[Digital India Project] Payment Confirmed (${formattedAmount}) — ${app.id}`,
      eventTime,
    };
  }

  return {
    dedupeKey,
    eventKey: 'PAYMENT_FAILED',
    status: 'Failed',
    applicationId: app.id,
    orderId: effectiveOrderId || app.id,
    transactionId,
    serviceName: app.serviceName,
    amountInr,
    recipientEmail: app.userEmail,
    recipientName: app.userName,
    userId: app.userId,
    paymentMethod,
    title: `Payment Failed: ${formattedAmount} for ${app.serviceName}`,
    titleHi: `भुगतान विफल: ${app.serviceName} के लिए ${formattedAmount}`,
    message: `Payment attempt of ${formattedAmount} for application ${app.id}${
      effectiveOrderId ? ` (Order ${effectiveOrderId})` : ''
    } did not complete. Please retry from Payments & Invoices to avoid processing delays.`,
    messageHi: `आवेदन ${app.id} के लिए ${formattedAmount} का भुगतान पूरा नहीं हो सका। कृपया पुनः प्रयास करें।`,
    emailSubject: `[Digital India Project] Action Needed: Payment Failed — ${app.id}`,
    eventTime,
  };
}

export type PaymentTrendRange = '7d' | '30d' | '6m';

export interface PaymentTrendBucket {
  key: string;
  label: string;
  rangeLabel: string;
  paidAmount: number;
  pendingAmount: number;
  failedAmount: number;
  totalAmount: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  totalCount: number;
}

export interface PaymentTrendSummary {
  range: PaymentTrendRange;
  buckets: PaymentTrendBucket[];
  totalVolume: number;
  paidVolume: number;
  pendingVolume: number;
  failedVolume: number;
  totalCount: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  averageTicketInr: number;
  successRatePercent: number;
  previousPeriodPaidVolume: number;
  paidDeltaPercent: number | null;
  maxBucketTotal: number;
  peakBucket: PaymentTrendBucket | null;
}

function startOfDayUtcMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function computePaymentTrendSeries(params: {
  applications: Application[];
  transactions?: PaymentTransaction[];
  statusMap?: Record<string, ApplicationPaymentStatusItem>;
  range: PaymentTrendRange;
  now?: Date;
}): PaymentTrendSummary {
  const { applications, transactions = [], statusMap = {}, range } = params;
  const now = params.now ?? new Date();
  const entries = buildPaymentHistoryEntries({
    applications,
    transactions,
    statusMap,
  });

  const DAY_MS = 24 * 60 * 60 * 1000;
  const todayStart = startOfDayUtcMs(now);

  interface BucketSpec {
    key: string;
    label: string;
    rangeLabel: string;
    startMs: number;
    endMs: number;
  }

  const specs: BucketSpec[] = [];
  let prevWindowStart = 0;
  let prevWindowEnd = 0;

  if (range === '7d') {
    for (let i = 6; i >= 0; i--) {
      const startMs = todayStart - i * DAY_MS;
      const endMs = startMs + DAY_MS - 1;
      const d = new Date(startMs);
      specs.push({
        key: `7d-${d.toISOString().slice(0, 10)}`,
        label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
        rangeLabel: d.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        }),
        startMs,
        endMs,
      });
    }
    prevWindowEnd = specs[0].startMs - 1;
    prevWindowStart = specs[0].startMs - 7 * DAY_MS;
  } else if (range === '30d') {
    // 6 buckets of 5 days each covering the trailing 30 days
    for (let b = 5; b >= 0; b--) {
      const endDayOffset = b * 5;
      const startDayOffset = endDayOffset + 4;
      const startMs = todayStart - startDayOffset * DAY_MS;
      const endMs = todayStart - endDayOffset * DAY_MS + DAY_MS - 1;
      const sDate = new Date(startMs);
      const eDate = new Date(endMs);
      specs.push({
        key: `30d-${b}`,
        label: `${sDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`,
        rangeLabel: `${sDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        })} – ${eDate.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        })}`,
        startMs,
        endMs,
      });
    }
    prevWindowEnd = specs[0].startMs - 1;
    prevWindowStart = specs[0].startMs - 30 * DAY_MS;
  } else {
    // 6m: 6 monthly buckets ending with current month
    const baseYear = now.getUTCFullYear();
    const baseMonth = now.getUTCMonth();
    for (let m = 5; m >= 0; m--) {
      const startMs = Date.UTC(baseYear, baseMonth - m, 1);
      const nextMonthStart = Date.UTC(baseYear, baseMonth - m + 1, 1);
      const endMs = nextMonthStart - 1;
      const d = new Date(startMs);
      specs.push({
        key: `6m-${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
        rangeLabel: d.toLocaleDateString('en-IN', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
        startMs,
        endMs,
      });
    }
    const prevStartDate = new Date(specs[0].startMs);
    prevWindowStart = Date.UTC(prevStartDate.getUTCFullYear(), prevStartDate.getUTCMonth() - 6, 1);
    prevWindowEnd = specs[0].startMs - 1;
  }

  const buckets: PaymentTrendBucket[] = specs.map((s) => ({
    key: s.key,
    label: s.label,
    rangeLabel: s.rangeLabel,
    paidAmount: 0,
    pendingAmount: 0,
    failedAmount: 0,
    totalAmount: 0,
    paidCount: 0,
    pendingCount: 0,
    failedCount: 0,
    totalCount: 0,
  }));

  let previousPeriodPaidVolume = 0;

  for (const entry of entries) {
    const ts = new Date(entry.date).getTime();
    if (!Number.isFinite(ts)) continue;
    const amt = Number(entry.amount || 0) || 0;

    if (ts >= prevWindowStart && ts <= prevWindowEnd && entry.uiStatus === 'Paid') {
      previousPeriodPaidVolume += amt;
    }

    const idx = specs.findIndex((s) => ts >= s.startMs && ts <= s.endMs);
    if (idx === -1) continue;

    const bucket = buckets[idx];
    bucket.totalCount += 1;
    bucket.totalAmount += amt;

    if (entry.uiStatus === 'Paid') {
      bucket.paidCount += 1;
      bucket.paidAmount += amt;
    } else if (entry.uiStatus === 'Failed') {
      bucket.failedCount += 1;
      bucket.failedAmount += amt;
    } else {
      bucket.pendingCount += 1;
      bucket.pendingAmount += amt;
    }
  }

  let paidVolume = 0;
  let pendingVolume = 0;
  let failedVolume = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let failedCount = 0;
  let maxBucketTotal = 0;
  let peakBucket: PaymentTrendBucket | null = null;

  for (const bucket of buckets) {
    paidVolume += bucket.paidAmount;
    pendingVolume += bucket.pendingAmount;
    failedVolume += bucket.failedAmount;
    paidCount += bucket.paidCount;
    pendingCount += bucket.pendingCount;
    failedCount += bucket.failedCount;
    if (bucket.totalAmount > maxBucketTotal) {
      maxBucketTotal = bucket.totalAmount;
      peakBucket = bucket;
    }
  }

  const totalVolume = paidVolume + pendingVolume + failedVolume;
  const totalCount = paidCount + pendingCount + failedCount;
  const averageTicketInr = totalCount > 0 ? Math.round(totalVolume / totalCount) : 0;
  const successRatePercent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  let paidDeltaPercent: number | null = null;
  if (previousPeriodPaidVolume > 0) {
    paidDeltaPercent = Math.round(
      ((paidVolume - previousPeriodPaidVolume) / previousPeriodPaidVolume) * 100
    );
  } else if (paidVolume > 0) {
    paidDeltaPercent = 100;
  }

  return {
    range,
    buckets,
    totalVolume,
    paidVolume,
    pendingVolume,
    failedVolume,
    totalCount,
    paidCount,
    pendingCount,
    failedCount,
    averageTicketInr,
    successRatePercent,
    previousPeriodPaidVolume,
    paidDeltaPercent,
    maxBucketTotal,
    peakBucket,
  };
}

export interface DailyCompletedPaymentPoint {
  dateKey: string;
  label: string;
  fullDateLabel: string;
  completedAmount: number;
  completedCount: number;
}

export interface CompletedPayments30DaySummary {
  days: DailyCompletedPaymentPoint[];
  totalCompletedAmount: number;
  totalCompletedCount: number;
  previous30DaysAmount: number;
  deltaPercent: number | null;
  averageCompletedPayment: number;
  activeDaysCount: number;
  peakDay: DailyCompletedPaymentPoint | null;
}

export function computeCompletedPayments30DaySeries(params: {
  applications: Application[];
  transactions?: PaymentTransaction[];
  statusMap?: Record<string, ApplicationPaymentStatusItem>;
  now?: Date;
}): CompletedPayments30DaySummary {
  const { applications, transactions = [], statusMap = {} } = params;
  const now = params.now ?? new Date();
  const entries = buildPaymentHistoryEntries({
    applications,
    transactions,
    statusMap,
  });

  const DAY_MS = 24 * 60 * 60 * 1000;
  const todayStart = startOfDayUtcMs(now);
  const windowStart = todayStart - 29 * DAY_MS;
  const prevWindowStart = windowStart - 30 * DAY_MS;
  const prevWindowEnd = windowStart - 1;

  const days: DailyCompletedPaymentPoint[] = [];
  const byDateKey = new Map<string, DailyCompletedPaymentPoint>();

  for (let i = 29; i >= 0; i--) {
    const dayStart = todayStart - i * DAY_MS;
    const d = new Date(dayStart);
    const dateKey = d.toISOString().slice(0, 10);
    const point: DailyCompletedPaymentPoint = {
      dateKey,
      label: d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }),
      fullDateLabel: d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      completedAmount: 0,
      completedCount: 0,
    };
    days.push(point);
    byDateKey.set(dateKey, point);
  }

  let previous30DaysAmount = 0;

  for (const entry of entries) {
    if (entry.uiStatus !== 'Paid') continue;
    const ts = new Date(entry.date).getTime();
    if (!Number.isFinite(ts)) continue;
    const amt = Number(entry.amount || 0) || 0;

    if (ts >= prevWindowStart && ts <= prevWindowEnd) {
      previous30DaysAmount += amt;
      continue;
    }

    if (ts < windowStart || ts >= todayStart + DAY_MS) continue;

    const dateKey = new Date(ts).toISOString().slice(0, 10);
    const bucket = byDateKey.get(dateKey);
    if (!bucket) continue;
    bucket.completedAmount += amt;
    bucket.completedCount += 1;
  }

  let totalCompletedAmount = 0;
  let totalCompletedCount = 0;
  let activeDaysCount = 0;
  let peakDay: DailyCompletedPaymentPoint | null = null;

  for (const day of days) {
    totalCompletedAmount += day.completedAmount;
    totalCompletedCount += day.completedCount;
    if (day.completedCount > 0) {
      activeDaysCount += 1;
    }
    if (
      day.completedAmount > 0 &&
      (!peakDay || day.completedAmount > peakDay.completedAmount)
    ) {
      peakDay = day;
    }
  }

  const averageCompletedPayment =
    totalCompletedCount > 0 ? Math.round(totalCompletedAmount / totalCompletedCount) : 0;

  let deltaPercent: number | null = null;
  if (previous30DaysAmount > 0) {
    deltaPercent = Math.round(
      ((totalCompletedAmount - previous30DaysAmount) / previous30DaysAmount) * 100
    );
  } else if (totalCompletedAmount > 0) {
    deltaPercent = 100;
  }

  return {
    days,
    totalCompletedAmount,
    totalCompletedCount,
    previous30DaysAmount,
    deltaPercent,
    averageCompletedPayment,
    activeDaysCount,
    peakDay,
  };
}

export interface PaymentHistoryPaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedPaymentHistoryResult {
  items: PaymentHistoryEntry[];
  filteredTotalPaidAmount: number;
  pagination: PaymentHistoryPaginationMeta;
}

export function paginatePaymentHistoryEntries(params: {
  entries: PaymentHistoryEntry[];
  page?: number;
  pageSize?: number;
  statusFilter?: 'all' | PaymentUiStatus;
  searchQuery?: string;
}): PaginatedPaymentHistoryResult {
  const { entries, statusFilter = 'all', searchQuery = '' } = params;
  const safePageSize = Math.min(Math.max(Math.floor(params.pageSize || 10), 1), 100);
  const query = searchQuery.trim().toLowerCase();

  const filtered = entries.filter((entry) => {
    if (statusFilter !== 'all' && entry.uiStatus !== statusFilter) return false;
    if (!query) return true;
    return (
      entry.transactionId.toLowerCase().includes(query) ||
      entry.orderId.toLowerCase().includes(query) ||
      entry.applicationId.toLowerCase().includes(query) ||
      entry.serviceName.toLowerCase().includes(query) ||
      entry.paymentMethod.toLowerCase().includes(query) ||
      (entry.receiptNumber || '').toLowerCase().includes(query) ||
      (entry.invoiceNumber || '').toLowerCase().includes(query) ||
      (entry.bankReference || '').toLowerCase().includes(query)
    );
  });

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(Math.floor(params.page || 1), 1), totalPages);
  const startIndex = (safePage - 1) * safePageSize;
  const items = filtered.slice(startIndex, startIndex + safePageSize);

  const filteredTotalPaidAmount = filtered.reduce(
    (sum, item) => (item.uiStatus === 'Paid' ? sum + (Number(item.amount) || 0) : sum),
    0
  );

  return {
    items,
    filteredTotalPaidAmount,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
    },
  };
}

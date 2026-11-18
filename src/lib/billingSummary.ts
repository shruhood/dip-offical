import type {
  Application,
  DigitalProductOrder,
  PaymentTransaction,
} from '../types';
import {
  getPlanDefinition,
  TOOL_SINGLE_USE_PRICE_INR,
  type ToolPlanCode,
  type ToolPlanDefinition,
} from '../data/toolPlans';
import type { PaidToolPurchaseRecord, ToolSingleUsePass } from '../types/tool';
import {
  buildPaymentHistoryEntries,
  type ApplicationPaymentStatusItem,
} from './paymentStatus';

export interface ActiveToolSubscriptionMeta {
  planCode: ToolPlanCode;
  billingCycle: 'monthly' | 'annual';
  amountInr: number;
  orderId?: string;
  paymentMethod?: string;
  activatedAt: string;
}

export interface MonthlyBillingBucket {
  monthKey: string; // e.g. "2026-11"
  label: string; // e.g. "Nov '26"
  fullMonthLabel: string; // e.g. "November 2026"
  servicesSpend: number;
  oneTimeToolsSpend: number;
  subscriptionsSpend: number;
  totalSpend: number;
  activeSubscriptions: number;
  oneTimePassesCount: number;
  transactionsCount: number;
}

export interface BillingSummaryMetrics {
  monthsWindow: 6 | 12;
  buckets: MonthlyBillingBucket[];
  currentMonthSpend: number;
  previousMonthSpend: number;
  monthOverMonthDeltaPercent: number | null;
  totalWindowSpend: number;
  totalServicesSpend: number;
  totalOneTimeToolsSpend: number;
  totalSubscriptionsSpend: number;
  activePlanCode: ToolPlanCode;
  activePlanDefinition: ToolPlanDefinition;
  billingCycle: 'monthly' | 'annual';
  monthlyRecurringEquivalentInr: number;
  activePaidSubscriptionsCount: number;
  activePassesCount: number;
  totalPaidToolPurchases: number;
  peakMonth: MonthlyBillingBucket | null;
}

function toMonthKey(dateInput?: string | Date | null): string | null {
  if (!dateInput) return null;
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function addUtcMonths(baseYear: number, baseMonthZeroBased: number, offset: number): Date {
  return new Date(Date.UTC(baseYear, baseMonthZeroBased + offset, 1));
}

function isToolTransaction(applicationId?: string, serviceName?: string): boolean {
  const appId = applicationId || '';
  const name = serviceName || '';
  return (
    appId.startsWith('tool-pass:') ||
    appId.startsWith('tool-plan:') ||
    name.includes('1-Time Tool Use Pass') ||
    name.includes('One-time Use') ||
    name.startsWith('Digital Tools Tray —')
  );
}

export function computeMonthlyBillingSummary(params: {
  applications: Application[];
  transactions?: PaymentTransaction[];
  statusMap?: Record<string, ApplicationPaymentStatusItem>;
  digitalOrders?: DigitalProductOrder[];
  paidToolHistory?: PaidToolPurchaseRecord[];
  activePlanCode: ToolPlanCode;
  billingCycle: 'monthly' | 'annual';
  lastSubscription?: ActiveToolSubscriptionMeta;
  activeSingleUsePassList?: ToolSingleUsePass[];
  months?: 6 | 12;
  now?: Date;
}): BillingSummaryMetrics {
  const {
    applications,
    transactions = [],
    statusMap = {},
    digitalOrders = [],
    paidToolHistory = [],
    activePlanCode,
    billingCycle,
    lastSubscription,
    activeSingleUsePassList = [],
  } = params;
  const monthsWindow: 6 | 12 = params.months === 12 ? 12 : 6;
  const now = params.now ?? new Date();
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();

  const buckets: MonthlyBillingBucket[] = [];
  const bucketMap = new Map<string, MonthlyBillingBucket>();
  const monthOrderIndex = new Map<string, number>();

  for (let i = monthsWindow - 1; i >= 0; i--) {
    const monthDate = addUtcMonths(nowYear, nowMonth, -i);
    const key = toMonthKey(monthDate)!;
    const shortMonth = monthDate.toLocaleDateString('en-IN', {
      month: 'short',
      timeZone: 'UTC',
    });
    const shortYear = String(monthDate.getUTCFullYear()).slice(-2);
    const fullMonthLabel = monthDate.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    const bucket: MonthlyBillingBucket = {
      monthKey: key,
      label: `${shortMonth} '${shortYear}`,
      fullMonthLabel,
      servicesSpend: 0,
      oneTimeToolsSpend: 0,
      subscriptionsSpend: 0,
      totalSpend: 0,
      activeSubscriptions: 0,
      oneTimePassesCount: 0,
      transactionsCount: 0,
    };

    monthOrderIndex.set(key, buckets.length);
    buckets.push(bucket);
    bucketMap.set(key, bucket);
  }

  const currentMonthKey = buckets[buckets.length - 1]?.monthKey;

  // 1. Track merged Paid Tool Orders (₹10 One-Time Passes & Subscriptions) without double counting
  const seenToolOrderIds = new Set<string>();
  const activeSubKeysPerMonth = Array.from(
    { length: buckets.length },
    () => new Set<string>()
  );

  const registerSubscriptionCoverage = (
    startMonthKey: string | null,
    cycle: 'monthly' | 'annual',
    subKey: string
  ) => {
    if (!startMonthKey) return;
    const [yStr, mStr] = startMonthKey.split('-');
    const startYear = Number(yStr);
    const startMonthZero = Number(mStr) - 1;
    if (!Number.isFinite(startYear) || !Number.isFinite(startMonthZero)) return;

    const span = cycle === 'annual' ? 12 : 1;
    for (let offset = 0; offset < span; offset++) {
      const mKey = toMonthKey(addUtcMonths(startYear, startMonthZero, offset));
      if (!mKey) continue;
      const idx = monthOrderIndex.get(mKey);
      if (idx !== undefined) {
        activeSubKeysPerMonth[idx].add(subKey);
      }
    }
  };

  let totalPaidToolPurchases = 0;

  for (const record of paidToolHistory) {
    totalPaidToolPurchases += 1;
    if (record.orderId) seenToolOrderIds.add(record.orderId);

    const mKey = toMonthKey(record.purchasedAt);
    const amount = Number(record.amountInr || 0) || 0;
    const bucket = mKey ? bucketMap.get(mKey) : undefined;

    if (record.purchaseType === 'one_time') {
      if (bucket) {
        bucket.oneTimeToolsSpend += amount;
        bucket.oneTimePassesCount += 1;
        bucket.transactionsCount += 1;
      }
    } else if (record.purchaseType === 'subscription') {
      if (bucket) {
        bucket.subscriptionsSpend += amount;
        bucket.transactionsCount += 1;
      }
      registerSubscriptionCoverage(
        mKey,
        record.billingCycle === 'annual' ? 'annual' : 'monthly',
        `sub:${record.planCode || record.toolName}:${mKey}`
      );
    }
  }

  // Merge any Cashfree tool transactions not yet mirrored in paidToolHistory
  for (const tx of transactions) {
    if (tx.status !== 'Success') continue;
    const appRef = tx.applicationId || '';
    const srvName = tx.serviceName || '';
    if (!isToolTransaction(appRef, srvName)) continue;

    if (tx.orderId && seenToolOrderIds.has(tx.orderId)) continue;
    if (tx.orderId) seenToolOrderIds.add(tx.orderId);
    totalPaidToolPurchases += 1;

    const mKey = toMonthKey(tx.transactionDate);
    const bucket = mKey ? bucketMap.get(mKey) : undefined;
    const isPassTx =
      appRef.startsWith('tool-pass:') ||
      srvName.includes('1-Time Tool Use Pass') ||
      srvName.includes('One-time Use');
    const amount = Number(tx.amount || 0) || (isPassTx ? TOOL_SINGLE_USE_PRICE_INR : 0);

    if (isPassTx) {
      if (bucket) {
        bucket.oneTimeToolsSpend += amount;
        bucket.oneTimePassesCount += 1;
        bucket.transactionsCount += 1;
      }
    } else {
      if (bucket) {
        bucket.subscriptionsSpend += amount;
        bucket.transactionsCount += 1;
      }
      const cycle =
        appRef.includes(':annual') || srvName.toLowerCase().includes('annual')
          ? 'annual'
          : 'monthly';
      registerSubscriptionCoverage(mKey, cycle, `txsub:${tx.orderId || tx.id}:${mKey}`);
    }
  }

  // 2. Service Applications & Gateway Ledger Entries (excluding tool pass/plan entries)
  const nonToolApplications = applications.filter(
    (app) => !isToolTransaction(app.id, app.serviceName)
  );
  const nonToolTransactions = transactions.filter(
    (tx) => !isToolTransaction(tx.applicationId, tx.serviceName)
  );
  const servicePaymentEntries = buildPaymentHistoryEntries({
    applications: nonToolApplications,
    transactions: nonToolTransactions,
    statusMap,
  });

  const seenDigitalOrderIds = new Set<string>();
  for (const entry of servicePaymentEntries) {
    if (entry.orderId) seenDigitalOrderIds.add(entry.orderId);
    if (entry.uiStatus !== 'Paid') continue;
    const mKey = toMonthKey(entry.date);
    const bucket = mKey ? bucketMap.get(mKey) : undefined;
    if (!bucket) continue;
    bucket.servicesSpend += Number(entry.amount || 0) || 0;
    bucket.transactionsCount += 1;
  }

  // 3. Digital Store Orders (deduplicated against transaction orderIds)
  for (const order of digitalOrders) {
    if (order.paymentStatus !== 'Paid') continue;
    if (order.orderId && seenDigitalOrderIds.has(order.orderId)) continue;
    const mKey = toMonthKey(order.createdAt);
    const bucket = mKey ? bucketMap.get(mKey) : undefined;
    if (!bucket) continue;
    bucket.servicesSpend += Number(order.amountPaid || 0) || 0;
    bucket.transactionsCount += 1;
  }

  // 4. Current Active Subscription Plan coverage
  const activePlanDefinition = getPlanDefinition(activePlanCode);
  const activePaidSubscriptionsCount = activePlanCode !== 'free' ? 1 : 0;

  if (activePlanCode !== 'free') {
    const startKey =
      toMonthKey(lastSubscription?.activatedAt) || currentMonthKey || null;
    registerSubscriptionCoverage(startKey, billingCycle, `current:${activePlanCode}`);
    // Ensure current month reflects active subscription even if activated earlier
    if (currentMonthKey) {
      const currentIdx = monthOrderIndex.get(currentMonthKey);
      if (currentIdx !== undefined) {
        activeSubKeysPerMonth[currentIdx].add(`current:${activePlanCode}`);
      }
    }
  }

  // 5. Finalize bucket totals & KPI rollups
  let totalServicesSpend = 0;
  let totalOneTimeToolsSpend = 0;
  let totalSubscriptionsSpend = 0;
  let peakMonth: MonthlyBillingBucket | null = null;

  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    b.activeSubscriptions = activeSubKeysPerMonth[i].size;
    b.totalSpend = b.servicesSpend + b.oneTimeToolsSpend + b.subscriptionsSpend;

    totalServicesSpend += b.servicesSpend;
    totalOneTimeToolsSpend += b.oneTimeToolsSpend;
    totalSubscriptionsSpend += b.subscriptionsSpend;

    if (b.totalSpend > 0 && (!peakMonth || b.totalSpend > peakMonth.totalSpend)) {
      peakMonth = b;
    }
  }

  const totalWindowSpend =
    totalServicesSpend + totalOneTimeToolsSpend + totalSubscriptionsSpend;
  const currentMonthSpend = buckets[buckets.length - 1]?.totalSpend ?? 0;
  const previousMonthSpend =
    buckets.length >= 2 ? buckets[buckets.length - 2].totalSpend : 0;

  let monthOverMonthDeltaPercent: number | null = null;
  if (previousMonthSpend > 0) {
    monthOverMonthDeltaPercent = Math.round(
      ((currentMonthSpend - previousMonthSpend) / previousMonthSpend) * 100
    );
  } else if (currentMonthSpend > 0) {
    monthOverMonthDeltaPercent = 100;
  }

  const monthlyRecurringEquivalentInr =
    activePlanCode === 'free'
      ? 0
      : billingCycle === 'annual'
      ? Math.round((activePlanDefinition.priceAnnualInr ?? 0) / 12)
      : activePlanDefinition.priceMonthlyInr ?? 0;

  return {
    monthsWindow,
    buckets,
    currentMonthSpend,
    previousMonthSpend,
    monthOverMonthDeltaPercent,
    totalWindowSpend,
    totalServicesSpend,
    totalOneTimeToolsSpend,
    totalSubscriptionsSpend,
    activePlanCode,
    activePlanDefinition,
    billingCycle,
    monthlyRecurringEquivalentInr,
    activePaidSubscriptionsCount,
    activePassesCount: activeSingleUsePassList.length,
    totalPaidToolPurchases,
    peakMonth,
  };
}

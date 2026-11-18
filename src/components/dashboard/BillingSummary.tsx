import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BarChart3,
  Crown,
  Minus,
  Ticket,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  Application,
  DigitalProductOrder,
  PaymentTransaction,
} from '../../types';
import type { ApplicationPaymentStatusItem } from '../../lib/paymentStatus';
import {
  computeMonthlyBillingSummary,
  type ActiveToolSubscriptionMeta,
  type MonthlyBillingBucket,
} from '../../lib/billingSummary';
import type { ToolPlanCode } from '../../data/toolPlans';
import type { PaidToolPurchaseRecord, ToolSingleUsePass } from '../../types/tool';

export type BillingChartMode = 'combined' | 'spending' | 'subscriptions';

export interface BillingSummaryProps {
  applications: Application[];
  transactions?: PaymentTransaction[];
  statusMap?: Record<string, ApplicationPaymentStatusItem>;
  digitalOrders?: DigitalProductOrder[];
  paidToolHistory?: PaidToolPurchaseRecord[];
  activePlanCode: ToolPlanCode;
  billingCycle: 'monthly' | 'annual';
  lastSubscription?: ActiveToolSubscriptionMeta;
  activeSingleUsePassList?: ToolSingleUsePass[];
  creditsRemaining: number;
  dailyJobsUsed: number;
  loading?: boolean;
  onManagePlans?: () => void;
  onOpenUsageHistory?: () => void;
  onOpenPaymentsLedger?: () => void;
  onStartNewApplication?: () => void;
}

function formatInr(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatCompactAxisInr(value: number): string {
  if (value === 0) return '₹0';
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return `₹${value}`;
}

interface BillingTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: MonthlyBillingBucket }>;
  chartMode: BillingChartMode;
}

const BillingChartTooltip: React.FC<BillingTooltipProps> = ({
  active,
  payload,
  chartMode,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const bucket = payload[0]?.payload;
  if (!bucket) return null;

  return (
    <div className="bg-slate-900 dark:bg-slate-950 text-white border border-slate-700 rounded-xl px-3.5 py-2.5 shadow-lg text-xs space-y-1.5 tabular-nums min-w-[215px]">
      <div className="font-semibold text-slate-100 border-b border-slate-800 pb-1">
        {bucket.fullMonthLabel}
      </div>

      {chartMode !== 'subscriptions' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-300 inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-[#138808]" />
              Services &amp; Filings
            </span>
            <span className="font-mono font-bold text-white">
              {formatInr(bucket.servicesSpend)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-300 inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-[#0284C7]" />
              ₹10 Tool Passes
            </span>
            <span className="font-mono font-bold text-white">
              {formatInr(bucket.oneTimeToolsSpend)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-300 inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs bg-[#FF671F]" />
              Subscriptions Spend
            </span>
            <span className="font-mono font-bold text-white">
              {formatInr(bucket.subscriptionsSpend)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800">
            <span className="text-slate-300 font-semibold">Monthly Total</span>
            <span className="font-mono font-bold text-[#FF671F]">
              {formatInr(bucket.totalSpend)}
            </span>
          </div>
        </div>
      )}

      <div
        className={`space-y-1 ${
          chartMode !== 'subscriptions' ? 'pt-1 border-t border-slate-800' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-300 inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-xs bg-[#7C3AED]" />
            Active Subscriptions
          </span>
          <span className="font-mono font-bold text-violet-300">
            {bucket.activeSubscriptions}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400">
          <span>₹10 1-Time Unlocks</span>
          <span className="font-mono font-semibold text-sky-300">
            {bucket.oneTimePassesCount}
          </span>
        </div>
        {chartMode === 'subscriptions' && (
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800 text-[11px] text-slate-400">
            <span>Monthly Spend</span>
            <span className="font-mono font-semibold text-emerald-400">
              {formatInr(bucket.totalSpend)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const BillingSummary: React.FC<BillingSummaryProps> = ({
  applications,
  transactions = [],
  statusMap = {},
  digitalOrders = [],
  paidToolHistory = [],
  activePlanCode,
  billingCycle,
  lastSubscription,
  activeSingleUsePassList = [],
  creditsRemaining,
  dailyJobsUsed,
  loading = false,
  onManagePlans,
  onOpenUsageHistory,
  onOpenPaymentsLedger,
  onStartNewApplication,
}) => {
  const [monthsWindow, setMonthsWindow] = useState<6 | 12>(6);
  const [chartMode, setChartMode] = useState<BillingChartMode>('combined');

  const summary = useMemo(
    () =>
      computeMonthlyBillingSummary({
        applications,
        transactions,
        statusMap,
        digitalOrders,
        paidToolHistory,
        activePlanCode,
        billingCycle,
        lastSubscription,
        activeSingleUsePassList,
        months: monthsWindow,
      }),
    [
      applications,
      transactions,
      statusMap,
      digitalOrders,
      paidToolHistory,
      activePlanCode,
      billingCycle,
      lastSubscription,
      activeSingleUsePassList,
      monthsWindow,
    ]
  );

  const deltaPositive = (summary.monthOverMonthDeltaPercent ?? 0) > 0;
  const deltaNegative = (summary.monthOverMonthDeltaPercent ?? 0) < 0;

  const hasSubscriptionBars = summary.buckets.some(
    (b) => b.activeSubscriptions > 0 || b.oneTimePassesCount > 0
  );
  const hasSpendingBars = summary.totalWindowSpend > 0;
  const showEmptyChart =
    chartMode === 'combined'
      ? !hasSpendingBars && !hasSubscriptionBars
      : chartMode === 'spending'
      ? !hasSpendingBars
      : !hasSubscriptionBars;

  const activePlanPriceLabel =
    summary.activePlanCode === 'free'
      ? '₹0 / month'
      : summary.billingCycle === 'annual' && summary.activePlanDefinition.priceAnnualInr !== null
      ? `₹${summary.activePlanDefinition.priceAnnualInr.toLocaleString('en-IN')} / year`
      : summary.activePlanDefinition.priceMonthlyInr !== null
      ? `₹${summary.activePlanDefinition.priceMonthlyInr.toLocaleString('en-IN')} / month`
      : 'Custom SLA';

  const dailyQuotaLabel =
    summary.activePlanDefinition.dailyJobLimit === null
      ? 'Unlimited browser jobs'
      : `${Math.max(0, summary.activePlanDefinition.dailyJobLimit - dailyJobsUsed)} of ${summary.activePlanDefinition.dailyJobLimit} daily jobs left`;

  const recentSubscriptions = useMemo(
    () =>
      paidToolHistory
        .filter((item) => item.purchaseType === 'subscription')
        .slice(0, 3),
    [paidToolHistory]
  );

  return (
    <section
      aria-label="Billing Summary"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
    >
      {/* Header Row */}
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#FF671F] shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Billing Summary
            </h3>
            <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Monthly Spending &amp; Active Subscriptions
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-2.5 tabular-nums pt-0.5">
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
              {formatInr(summary.currentMonthSpend)}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              spent this month
            </span>

            {summary.monthOverMonthDeltaPercent !== null && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  deltaPositive
                    ? 'text-[#D97706] dark:text-amber-400'
                    : deltaNegative
                    ? 'text-[#138808] dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {deltaPositive ? (
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                ) : deltaNegative ? (
                  <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Minus className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {deltaPositive ? '+' : ''}
                  {summary.monthOverMonthDeltaPercent}% vs last month
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Interactive Controls: Chart Metric + Month Window */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="tablist"
            aria-label="Billing visualization mode"
            className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl"
          >
            {(
              [
                { id: 'combined', label: 'Spend & Subs' },
                { id: 'spending', label: 'Spending (₹)' },
                { id: 'subscriptions', label: 'Subscriptions' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={chartMode === mode.id}
                onClick={() => setChartMode(mode.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  chartMode === mode.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div
            role="tablist"
            aria-label="Billing month range"
            className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl"
          >
            {([6, 12] as const).map((win) => (
              <button
                key={win}
                type="button"
                role="tab"
                aria-selected={monthsWindow === win}
                onClick={() => setMonthsWindow(win)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  monthsWindow === win
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {win}M
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4-Column Financial & Subscription Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800 tabular-nums text-xs">
        <div className="p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {monthsWindow}-Month Total Spend
          </div>
          <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
            {formatInr(summary.totalWindowSpend)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {summary.peakMonth
              ? `Peak: ${summary.peakMonth.label} (${formatInr(summary.peakMonth.totalSpend)})`
              : 'Across services & tools'}
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Active Subscription
          </div>
          <div className="text-lg font-black font-mono text-[#FF671F] truncate">
            {summary.activePlanDefinition.name}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {activePlanPriceLabel} ·{' '}
            {summary.activePaidSubscriptionsCount > 0 ? 'Paid Active' : 'Starter Tier'}
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Monthly Recurring Rate
          </div>
          <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
            {formatInr(summary.monthlyRecurringEquivalentInr)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {summary.activePaidSubscriptionsCount > 0
              ? `Billed ${summary.billingCycle}`
              : 'No recurring charge'}
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            ₹10 Passes &amp; AI Credits
          </div>
          <div className="text-lg font-black font-mono text-[#138808] dark:text-emerald-400">
            {summary.activePassesCount} pass{summary.activePassesCount === 1 ? '' : 'es'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {creditsRemaining} AI credits remaining
          </div>
        </div>
      </div>

      {/* Chart Viewport: Loading / Empty / Recharts BarChart */}
      <div className="p-4 sm:p-5 space-y-4">
        {loading ? (
          <div
            className="h-60 w-full flex items-end gap-3 pt-4 animate-pulse"
            aria-busy="true"
            aria-label="Loading billing summary chart"
          >
            {Array.from({ length: monthsWindow }).map((_, idx) => (
              <div
                key={idx}
                className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-t-md"
                style={{ height: `${30 + ((idx * 19) % 60)}%` }}
              />
            ))}
          </div>
        ) : showEmptyChart ? (
          <div className="py-8 text-center space-y-3 text-xs">
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {chartMode === 'subscriptions'
                ? `No active paid subscriptions or ₹10 tool unlocks recorded in the last ${monthsWindow} months.`
                : `No completed spending recorded in the last ${monthsWindow} months.`}
            </p>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Your monthly bar breakdown for digital service filings, ₹10 one-time tool passes, and active tool subscriptions will appear here automatically after your first checkout.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              {onManagePlans && (
                <button
                  type="button"
                  onClick={onManagePlans}
                  className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Explore ₹10 Passes &amp; Plans</span>
                </button>
              )}
              {onStartNewApplication && (
                <button
                  type="button"
                  onClick={onStartNewApplication}
                  className="border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-4 py-2 rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                >
                  Start an Application
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'combined' ? (
                <BarChart
                  data={summary.buckets}
                  margin={{ top: 8, right: 4, left: -8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(148, 163, 184, 0.2)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="spend"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tickFormatter={(val: number) => formatCompactAxisInr(val)}
                  />
                  <YAxis
                    yAxisId="subs"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#7C3AED' }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                    content={<BillingChartTooltip chartMode="combined" />}
                  />
                  <Bar
                    yAxisId="spend"
                    dataKey="servicesSpend"
                    name="Services & Filings (₹)"
                    stackId="spend"
                    fill="#138808"
                    radius={[0, 0, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    yAxisId="spend"
                    dataKey="oneTimeToolsSpend"
                    name="₹10 Tool Passes (₹)"
                    stackId="spend"
                    fill="#0284C7"
                    radius={[0, 0, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    yAxisId="spend"
                    dataKey="subscriptionsSpend"
                    name="Subscriptions Spend (₹)"
                    stackId="spend"
                    fill="#FF671F"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    yAxisId="subs"
                    dataKey="activeSubscriptions"
                    name="Active Subscriptions"
                    fill="#7C3AED"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={18}
                  />
                </BarChart>
              ) : chartMode === 'spending' ? (
                <BarChart
                  data={summary.buckets}
                  margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(148, 163, 184, 0.2)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tickFormatter={(val: number) => formatCompactAxisInr(val)}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                    content={<BillingChartTooltip chartMode="spending" />}
                  />
                  <Bar
                    dataKey="servicesSpend"
                    name="Services & Filings"
                    stackId="spend"
                    fill="#138808"
                    radius={[0, 0, 0, 0]}
                    maxBarSize={36}
                  />
                  <Bar
                    dataKey="oneTimeToolsSpend"
                    name="₹10 Tool Passes"
                    stackId="spend"
                    fill="#0284C7"
                    radius={[0, 0, 0, 0]}
                    maxBarSize={36}
                  />
                  <Bar
                    dataKey="subscriptionsSpend"
                    name="Subscriptions"
                    stackId="spend"
                    fill="#FF671F"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              ) : (
                <BarChart
                  data={summary.buckets}
                  margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(148, 163, 184, 0.2)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                    content={<BillingChartTooltip chartMode="subscriptions" />}
                  />
                  <Bar
                    dataKey="activeSubscriptions"
                    name="Active Subscriptions"
                    fill="#7C3AED"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={26}
                  />
                  <Bar
                    dataKey="oneTimePassesCount"
                    name="₹10 1-Time Unlocks"
                    fill="#0284C7"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={26}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* Active Subscription & Quota Strip */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 dark:text-slate-300 tabular-nums">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                <Crown className="w-3.5 h-3.5 text-[#FF671F] shrink-0" />
                <span>Plan: {summary.activePlanDefinition.name}</span>
              </span>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
              <span>{activePlanPriceLabel}</span>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
              <span>{dailyQuotaLabel}</span>
              {activeSingleUsePassList.length > 0 && (
                <>
                  <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-[#0284C7] dark:text-sky-400 font-semibold">
                    <Ticket className="w-3.5 h-3.5 shrink-0" />
                    <span>{activeSingleUsePassList.length} ready ₹10 pass{activeSingleUsePassList.length === 1 ? '' : 'es'}</span>
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {onOpenUsageHistory && (
                <button
                  type="button"
                  onClick={onOpenUsageHistory}
                  className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#FF671F] cursor-pointer whitespace-nowrap"
                >
                  Usage History
                </button>
              )}
              {onOpenPaymentsLedger && (
                <button
                  type="button"
                  onClick={onOpenPaymentsLedger}
                  className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#FF671F] cursor-pointer whitespace-nowrap"
                >
                  Invoices
                </button>
              )}
              {onManagePlans && (
                <button
                  type="button"
                  onClick={onManagePlans}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#FF671F] hover:underline cursor-pointer whitespace-nowrap"
                >
                  <span>{activePlanCode === 'free' ? 'Upgrade Plan' : 'Manage Subscription'}</span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                </button>
              )}
            </div>
          </div>

          {recentSubscriptions.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 pt-2">
              {recentSubscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="py-1.5 flex items-center justify-between gap-3 text-[11px] tabular-nums"
                >
                  <div className="min-w-0 truncate text-slate-700 dark:text-slate-200 font-medium">
                    {sub.toolName}{' '}
                    <span className="text-slate-400 dark:text-slate-500">
                      · {sub.billingCycle === 'annual' ? 'Annual' : 'Monthly'} ·{' '}
                      {new Date(sub.purchasedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white shrink-0">
                    {formatInr(sub.amountInr)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chart Color Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
          <div className="flex flex-wrap items-center gap-4">
            {chartMode !== 'subscriptions' && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#138808]" />
                  Services &amp; Filings ({formatInr(summary.totalServicesSpend)})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#0284C7]" />
                  ₹10 Tool Passes ({formatInr(summary.totalOneTimeToolsSpend)})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#FF671F]" />
                  Subscriptions ({formatInr(summary.totalSubscriptionsSpend)})
                </span>
              </>
            )}
            {chartMode !== 'spending' && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#7C3AED]" />
                  Active Subscriptions
                </span>
                {chartMode === 'subscriptions' && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#0284C7]" />
                    ₹10 One-Time Tool Unlocks
                  </span>
                )}
              </>
            )}
          </div>

          {lastSubscription?.activatedAt && activePlanCode !== 'free' && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Activated{' '}
              <span className="font-mono text-slate-700 dark:text-slate-200">
                {new Date(lastSubscription.activatedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
};

export default BillingSummary;

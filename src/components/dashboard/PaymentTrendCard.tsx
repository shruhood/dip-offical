import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { Application, PaymentTransaction } from '../../types';
import {
  computePaymentTrendSeries,
  type ApplicationPaymentStatusItem,
  type PaymentTrendBucket,
  type PaymentTrendRange,
} from '../../lib/paymentStatus';

export type PaymentTrendFilterTarget = 'all' | 'Paid' | 'Pending' | 'Failed';

interface PaymentTrendCardProps {
  applications: Application[];
  transactions?: PaymentTransaction[];
  statusMap?: Record<string, ApplicationPaymentStatusItem>;
  onFilterByStatus?: (status: PaymentTrendFilterTarget) => void;
  onStartNewApplication?: () => void;
}

const RANGE_OPTIONS: Array<{ id: PaymentTrendRange; label: string; caption: string }> = [
  { id: '7d', label: '7D', caption: 'Last 7 days' },
  { id: '30d', label: '30D', caption: 'Last 30 days' },
  { id: '6m', label: '6M', caption: 'Last 6 months' },
];

function formatInr(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export const PaymentTrendCard: React.FC<PaymentTrendCardProps> = ({
  applications,
  transactions = [],
  statusMap = {},
  onFilterByStatus,
  onStartNewApplication,
}) => {
  const [range, setRange] = useState<PaymentTrendRange>(() => {
    const thirty = computePaymentTrendSeries({
      applications,
      transactions,
      statusMap,
      range: '30d',
    });
    if (thirty.totalCount === 0 && applications.length > 0) {
      return '6m';
    }
    return '30d';
  });
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);

  const summary = useMemo(
    () =>
      computePaymentTrendSeries({
        applications,
        transactions,
        statusMap,
        range,
      }),
    [applications, transactions, statusMap, range]
  );

  const activeBucket: PaymentTrendBucket | null = useMemo(() => {
    if (summary.buckets.length === 0) return null;
    if (selectedBucketKey) {
      const found = summary.buckets.find((b) => b.key === selectedBucketKey);
      if (found) return found;
    }
    return summary.peakBucket && summary.peakBucket.totalAmount > 0
      ? summary.peakBucket
      : summary.buckets[summary.buckets.length - 1];
  }, [summary, selectedBucketKey]);

  const activeRangeMeta = RANGE_OPTIONS.find((r) => r.id === range) ?? RANGE_OPTIONS[1];

  const deltaPositive = (summary.paidDeltaPercent ?? 0) > 0;
  const deltaNegative = (summary.paidDeltaPercent ?? 0) < 0;

  return (
    <section
      aria-label="Payment trend card"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            <BarChart3 className="w-4 h-4 text-[#FF671F] shrink-0" />
            <span>Payment Trend</span>
            <span className="text-[11px] font-medium normal-case tracking-normal text-slate-400 dark:text-slate-500">
              · {activeRangeMeta.caption}
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-2.5 tabular-nums pt-0.5">
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {formatInr(summary.paidVolume)}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              settled across {summary.paidCount} {summary.paidCount === 1 ? 'payment' : 'payments'}
            </span>

            {summary.paidDeltaPercent !== null && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                  deltaPositive
                    ? 'bg-emerald-50 dark:bg-emerald-950/45 text-[#138808] dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : deltaNegative
                    ? 'bg-rose-50 dark:bg-rose-950/45 text-[#DC2626] dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {deltaPositive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : deltaNegative ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                <span>
                  {deltaPositive ? '+' : ''}
                  {summary.paidDeltaPercent}% vs prior period
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Range Switcher */}
        <div
          role="tablist"
          aria-label="Payment trend time window"
          className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start shrink-0"
        >
          {RANGE_OPTIONS.map((opt) => {
            const active = range === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setRange(opt.id);
                  setSelectedBucketKey(null);
                }}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State vs Chart */}
      {applications.length === 0 ? (
        <div className="py-6 border-t border-slate-100 dark:border-slate-800 text-center space-y-2.5 text-xs">
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            No payment activity recorded yet.
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            Payment settlement trends across Paid, Pending, and Failed states will appear automatically once you submit an application.
          </p>
          {onStartNewApplication && (
            <button
              type="button"
              onClick={onStartNewApplication}
              className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-4 py-2 rounded-lg text-xs cursor-pointer"
            >
              Start First Application
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Compact KPI Strip */}
          <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-100 dark:border-slate-800 tabular-nums text-xs">
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Settlement Rate
              </div>
              <div className="mt-0.5 text-base font-black font-mono text-[#138808] dark:text-emerald-400">
                {summary.successRatePercent}%
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Avg. Fee
              </div>
              <div className="mt-0.5 text-base font-black font-mono text-slate-900 dark:text-white">
                {formatInr(summary.averageTicketInr)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Peak Window
              </div>
              <div className="mt-0.5 text-base font-black font-mono text-[#FF671F] truncate">
                {summary.peakBucket && summary.peakBucket.totalAmount > 0
                  ? `${summary.peakBucket.label} (${formatInr(summary.peakBucket.totalAmount)})`
                  : '—'}
              </div>
            </div>
          </div>

          {/* Stacked Bar Visualization */}
          {summary.totalCount === 0 ? (
            <div className="py-5 text-center space-y-2 text-xs">
              <p className="text-slate-500 dark:text-slate-400">
                No transactions in the selected {activeRangeMeta.caption.toLowerCase()} window.
              </p>
              {range !== '6m' && (
                <button
                  type="button"
                  onClick={() => {
                    setRange('6m');
                    setSelectedBucketKey(null);
                  }}
                  className="text-xs font-bold text-[#FF671F] hover:underline cursor-pointer"
                >
                  Switch to 6M trend view →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className="grid gap-2 sm:gap-3 items-end h-36 pt-2"
                style={{
                  gridTemplateColumns: `repeat(${summary.buckets.length}, minmax(0, 1fr))`,
                }}
              >
                {summary.buckets.map((bucket) => {
                  const maxVal = Math.max(summary.maxBucketTotal, 1);
                  const totalHeightPct =
                    bucket.totalAmount > 0
                      ? Math.max(Math.round((bucket.totalAmount / maxVal) * 100), 10)
                      : 0;
                  const paidPct =
                    bucket.totalAmount > 0
                      ? Math.round((bucket.paidAmount / bucket.totalAmount) * 100)
                      : 0;
                  const pendingPct =
                    bucket.totalAmount > 0
                      ? Math.round((bucket.pendingAmount / bucket.totalAmount) * 100)
                      : 0;
                  const failedPct = Math.max(0, 100 - paidPct - pendingPct);
                  const isSelected = activeBucket?.key === bucket.key;

                  return (
                    <button
                      key={bucket.key}
                      type="button"
                      onMouseEnter={() => setSelectedBucketKey(bucket.key)}
                      onFocus={() => setSelectedBucketKey(bucket.key)}
                      onClick={() => setSelectedBucketKey(bucket.key)}
                      aria-label={`${bucket.rangeLabel}: Paid ${formatInr(bucket.paidAmount)}, Pending ${formatInr(bucket.pendingAmount)}, Failed ${formatInr(bucket.failedAmount)}`}
                      className={`group flex flex-col items-center justify-end h-full gap-1.5 rounded-lg px-1 py-1 transition cursor-pointer focus:outline-none ${
                        isSelected
                          ? 'bg-slate-50 dark:bg-slate-800/70'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 opacity-90 truncate max-w-full">
                        {bucket.totalAmount > 0 ? formatInr(bucket.totalAmount) : ''}
                      </span>

                      <div className="w-full max-w-[32px] flex-1 flex items-end">
                        {totalHeightPct > 0 ? (
                          <div
                            className="w-full rounded-t-md overflow-hidden flex flex-col-reverse transition-all duration-300"
                            style={{ height: `${totalHeightPct}%` }}
                          >
                            {bucket.paidAmount > 0 && (
                              <div
                                className="w-full bg-[#138808] dark:bg-emerald-500"
                                style={{ height: `${paidPct}%` }}
                              />
                            )}
                            {bucket.pendingAmount > 0 && (
                              <div
                                className="w-full bg-[#D97706] dark:bg-amber-500"
                                style={{ height: `${pendingPct}%` }}
                              />
                            )}
                            {bucket.failedAmount > 0 && (
                              <div
                                className="w-full bg-[#DC2626] dark:bg-rose-500"
                                style={{ height: `${failedPct}%` }}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
                        )}
                      </div>

                      <span
                        className={`text-[10px] font-semibold truncate max-w-full ${
                          isSelected
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {bucket.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Bucket Detail Readout */}
              {activeBucket && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[11px] tabular-nums">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    {activeBucket.rangeLabel}{' '}
                    <span className="text-slate-400 dark:text-slate-500 font-normal">
                      ({activeBucket.totalCount} {activeBucket.totalCount === 1 ? 'record' : 'records'})
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 font-mono">
                    <span className="text-[#138808] dark:text-emerald-400 font-bold">
                      Paid: {formatInr(activeBucket.paidAmount)} ({activeBucket.paidCount})
                    </span>
                    <span className="text-[#B45309] dark:text-amber-400 font-bold">
                      Pending: {formatInr(activeBucket.pendingAmount)} ({activeBucket.pendingCount})
                    </span>
                    <span className="text-[#DC2626] dark:text-rose-400 font-bold">
                      Failed: {formatInr(activeBucket.failedAmount)} ({activeBucket.failedCount})
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Legend & Quick Filter Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
            <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#138808] dark:bg-emerald-500" />
                Paid ({formatInr(summary.paidVolume)})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#D97706] dark:bg-amber-500" />
                Pending ({formatInr(summary.pendingVolume)})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#DC2626] dark:bg-rose-500" />
                Failed ({formatInr(summary.failedVolume)})
              </span>
            </div>

            {onFilterByStatus && (
              <button
                type="button"
                onClick={() =>
                  onFilterByStatus(
                    summary.failedCount > 0 ? 'Failed' : summary.pendingCount > 0 ? 'Pending' : 'Paid'
                  )
                }
                className="inline-flex items-center gap-1 font-bold text-[#FF671F] hover:underline cursor-pointer"
              >
                <span>
                  {summary.failedCount > 0
                    ? `Review ${summary.failedCount} Failed`
                    : summary.pendingCount > 0
                    ? `Track ${summary.pendingCount} Pending`
                    : 'Open Payment Ledger'}
                </span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
};

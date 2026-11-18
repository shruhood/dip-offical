import React, { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  IndianRupee,
} from 'lucide-react';
import type { Application } from '../../types';
import {
  computePaymentOverviewMetrics,
  type ApplicationPaymentStatusItem,
} from '../../lib/paymentStatus';
import { PaymentStatus } from './PaymentStatus';

export type PaymentOverviewFilter = 'all' | 'Pending' | 'Paid' | 'Failed';

export interface PaymentStatusOverviewProps {
  applications: Application[];
  statusMap?: Record<string, ApplicationPaymentStatusItem>;
  loading?: boolean;
  activeFilter?: PaymentOverviewFilter;
  onFilterByStatus?: (status: PaymentOverviewFilter) => void;
  onSelectApplication?: (app: Application) => void;
  onOpenPaymentsLedger?: () => void;
  onStartNewApplication?: () => void;
}

function formatInr(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export const PaymentStatusOverview: React.FC<PaymentStatusOverviewProps> = ({
  applications,
  statusMap = {},
  loading = false,
  activeFilter,
  onFilterByStatus,
  onSelectApplication,
  onOpenPaymentsLedger,
  onStartNewApplication,
}) => {
  const metrics = useMemo(
    () => computePaymentOverviewMetrics(applications, statusMap),
    [applications, statusMap]
  );

  const pendingSharePercent =
    metrics.totalBilledAmount > 0
      ? Math.round((metrics.pendingAmount / metrics.totalBilledAmount) * 100)
      : metrics.totalApplications > 0
      ? Math.round((metrics.pendingCount / metrics.totalApplications) * 100)
      : 0;

  const failedSharePercent = Math.max(
    0,
    100 - metrics.completionPercent - pendingSharePercent
  );

  const handleCardAction = (status: PaymentOverviewFilter) => {
    if (onFilterByStatus) {
      onFilterByStatus(status);
      return;
    }
    onOpenPaymentsLedger?.();
  };

  const isClickable = Boolean(onFilterByStatus || onOpenPaymentsLedger);

  return (
    <section
      aria-label="Application Payment Financial Overview"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
    >
      {/* Header Row */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Payment Status Overview
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
            {metrics.totalApplications} application{metrics.totalApplications === 1 ? '' : 's'} ·{' '}
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
              {metrics.completionPercent}% settled
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {metrics.failedCount > 0 && (
            <button
              type="button"
              onClick={() => handleCardAction('Failed')}
              className="text-xs font-semibold text-[#DC2626] dark:text-rose-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                {metrics.failedCount} Failed ({formatInr(metrics.failedAmount)})
              </span>
            </button>
          )}

          {onOpenPaymentsLedger && metrics.totalApplications > 0 && (
            <button
              type="button"
              onClick={onOpenPaymentsLedger}
              className="text-xs font-semibold text-[#FF671F] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Full Ledger →
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && metrics.totalApplications > 0 ? (
        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse" aria-busy="true">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="space-y-2">
              <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-7 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3 w-36 bg-slate-100 dark:bg-slate-800/70 rounded" />
            </div>
          ))}
        </div>
      ) : metrics.totalApplications === 0 ? (
        <div className="p-6 text-center text-xs space-y-2.5">
          <p className="font-bold text-slate-800 dark:text-slate-200">
            No application billing recorded yet.
          </p>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Your pending dues and completed Cashfree payments will appear here as soon as you submit an application.
          </p>
          {onStartNewApplication && (
            <button
              type="button"
              onClick={onStartNewApplication}
              className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Start First Application
            </button>
          )}
        </div>
      ) : (
        <>
          {/* 3-Column Financial Summary Strip (Single Elevation, Divider-Separated) */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800 tabular-nums">
            {/* Completed / Paid */}
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => handleCardAction('Paid')}
              className={`p-4 sm:p-5 text-left transition-colors space-y-1.5 ${
                isClickable
                  ? 'hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 cursor-pointer'
                  : 'cursor-default'
              } ${
                activeFilter === 'Paid'
                  ? 'bg-emerald-50/60 dark:bg-emerald-950/30'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#138808] dark:text-emerald-400 inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Completed Payments</span>
                </span>
                <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                  {metrics.completedCount} app{metrics.completedCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tracking-tight">
                {formatInr(metrics.completedAmount)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Confirmed &amp; cleared via gateway
              </div>
            </button>

            {/* Pending / Awaiting */}
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => handleCardAction('Pending')}
              className={`p-4 sm:p-5 text-left transition-colors space-y-1.5 ${
                isClickable
                  ? 'hover:bg-amber-50/40 dark:hover:bg-amber-950/20 cursor-pointer'
                  : 'cursor-default'
              } ${
                activeFilter === 'Pending'
                  ? 'bg-amber-50/60 dark:bg-amber-950/30'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#D97706] dark:text-amber-400 inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Pending Payments</span>
                </span>
                <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                  {metrics.pendingCount} app{metrics.pendingCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tracking-tight">
                {formatInr(metrics.pendingAmount)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {metrics.pendingCount > 0
                  ? 'Awaiting gateway confirmation'
                  : 'Zero pending dues'}
              </div>
            </button>

            {/* Total Billed */}
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => handleCardAction('all')}
              className={`p-4 sm:p-5 text-left transition-colors space-y-1.5 ${
                isClickable
                  ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer'
                  : 'cursor-default'
              } ${
                activeFilter === 'all'
                  ? 'bg-slate-50/70 dark:bg-slate-800/30'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
                  <IndianRupee className="w-3.5 h-3.5 text-[#FF671F] shrink-0" />
                  <span>Total Application Value</span>
                </span>
                <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                  {metrics.totalApplications} total
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white tracking-tight">
                {formatInr(metrics.totalBilledAmount)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Combined fees across all filings
              </div>
            </button>
          </div>

          {/* Settlement Ratio Progress Bar */}
          <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-1.5">
            <div
              role="progressbar"
              aria-label="Completed vs pending payment ratio"
              aria-valuenow={metrics.completionPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex"
            >
              {metrics.completionPercent > 0 && (
                <div
                  style={{ width: `${metrics.completionPercent}%` }}
                  className="bg-[#138808] dark:bg-emerald-500 transition-all duration-300"
                />
              )}
              {pendingSharePercent > 0 && (
                <div
                  style={{ width: `${pendingSharePercent}%` }}
                  className="bg-[#D97706] dark:bg-amber-500 transition-all duration-300"
                />
              )}
              {failedSharePercent > 0 && metrics.failedCount > 0 && (
                <div
                  style={{ width: `${failedSharePercent}%` }}
                  className="bg-[#DC2626] dark:bg-rose-500 transition-all duration-300"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              <span>
                Completed: <strong className="text-slate-800 dark:text-slate-200">{metrics.completionPercent}%</strong> ({formatInr(metrics.completedAmount)})
              </span>
              <span>
                Pending: <strong className="text-slate-800 dark:text-slate-200">{pendingSharePercent}%</strong> ({formatInr(metrics.pendingAmount)})
              </span>
            </div>
          </div>

          {/* Mini-List Split: Pending vs Completed Applications */}
          <div className="border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
            {/* Pending / Attention Mini-List */}
            <div className="p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  Pending &amp; Action Needed
                </span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {metrics.pendingItems.length}
                </span>
              </div>

              {metrics.pendingItems.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  All application payments are settled.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {metrics.pendingItems.slice(0, 3).map((item) => {
                    const matchedApp = applications.find((a) => a.id === item.applicationId);
                    return (
                      <li key={item.applicationId} className="py-2 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {item.serviceName}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              <span className="font-mono">{item.applicationId}</span>
                              <PaymentStatus status={item.uiStatus} size="sm" />
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {formatInr(item.amount)}
                            </span>
                            {matchedApp && onSelectApplication && (
                              <button
                                type="button"
                                onClick={() => onSelectApplication(matchedApp)}
                                aria-label={`Inspect ${item.applicationId}`}
                                className="p-1 rounded text-slate-400 hover:text-[#FF671F] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Recent Completed Mini-List */}
            <div className="p-4 sm:p-5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  Recent Completed Payments
                </span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {metrics.completedItems.length}
                </span>
              </div>

              {metrics.completedItems.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  No confirmed payments recorded yet.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {metrics.completedItems.slice(0, 3).map((item) => {
                    const matchedApp = applications.find((a) => a.id === item.applicationId);
                    return (
                      <li key={item.applicationId} className="py-2 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {item.serviceName}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              <span className="font-mono">{item.applicationId}</span>
                              <PaymentStatus status={item.uiStatus} size="sm" />
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {formatInr(item.amount)}
                            </span>
                            {matchedApp && onSelectApplication && (
                              <button
                                type="button"
                                onClick={() => onSelectApplication(matchedApp)}
                                aria-label={`Inspect ${item.applicationId}`}
                                className="p-1 rounded text-slate-400 hover:text-[#FF671F] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

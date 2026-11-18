import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BarChart3,
  Minus,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { Application, PaymentTransaction } from '../../types';
import {
  computeCompletedPayments30DaySeries,
  type ApplicationPaymentStatusItem,
  type DailyCompletedPaymentPoint,
} from '../../lib/paymentStatus';

export type PaymentTrendMetric = 'amount' | 'count';

export interface PaymentTrendChartProps {
  applications: Application[];
  transactions?: PaymentTransaction[];
  statusMap?: Record<string, ApplicationPaymentStatusItem>;
  loading?: boolean;
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

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DailyCompletedPaymentPoint }>;
}

const CompletedPaymentTooltip: React.FC<ChartTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="bg-slate-900 dark:bg-slate-950 text-white border border-slate-700 rounded-xl px-3 py-2.5 shadow-lg text-xs space-y-1 tabular-nums">
      <div className="font-semibold text-slate-200">{point.fullDateLabel}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Completed Amount</span>
        <span className="font-mono font-bold text-emerald-400">
          {formatInr(point.completedAmount)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Payments Settled</span>
        <span className="font-mono font-bold text-white">{point.completedCount}</span>
      </div>
    </div>
  );
};

export const PaymentTrendChart: React.FC<PaymentTrendChartProps> = ({
  applications,
  transactions = [],
  statusMap = {},
  loading = false,
  onOpenPaymentsLedger,
  onStartNewApplication,
}) => {
  const [metric, setMetric] = useState<PaymentTrendMetric>('amount');

  const summary = useMemo(
    () =>
      computeCompletedPayments30DaySeries({
        applications,
        transactions,
        statusMap,
      }),
    [applications, transactions, statusMap]
  );

  const deltaPositive = (summary.deltaPercent ?? 0) > 0;
  const deltaNegative = (summary.deltaPercent ?? 0) < 0;
  const peakDateKey = summary.peakDay?.dateKey;

  return (
    <section
      aria-label="Completed payments over the last 30 days"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            <BarChart3 className="w-4 h-4 text-[#138808] dark:text-emerald-400 shrink-0" />
            <span>Completed Payments · Last 30 Days</span>
          </div>

          <div className="flex flex-wrap items-baseline gap-2.5 tabular-nums pt-0.5">
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {formatInr(summary.totalCompletedAmount)}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              across {summary.totalCompletedCount} completed{' '}
              {summary.totalCompletedCount === 1 ? 'payment' : 'payments'}
            </span>

            {summary.deltaPercent !== null && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  deltaPositive
                    ? 'text-[#138808] dark:text-emerald-400'
                    : deltaNegative
                    ? 'text-[#DC2626] dark:text-rose-400'
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
                  {summary.deltaPercent}% vs prior 30d
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Interactive Metric Switcher */}
        <div
          role="tablist"
          aria-label="Chart metric view"
          className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={metric === 'amount'}
            onClick={() => setMetric('amount')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              metric === 'amount'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Amount (₹)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={metric === 'count'}
            onClick={() => setMetric('count')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              metric === 'count'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Count
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-100 dark:border-slate-800 tabular-nums text-xs">
        <div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Active Payment Days
          </div>
          <div className="mt-0.5 text-base font-black font-mono text-slate-900 dark:text-white">
            {summary.activeDaysCount} / 30
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Avg. Completed Fee
          </div>
          <div className="mt-0.5 text-base font-black font-mono text-slate-900 dark:text-white">
            {formatInr(summary.averageCompletedPayment)}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Peak Day
          </div>
          <div className="mt-0.5 text-base font-black font-mono text-[#138808] dark:text-emerald-400 truncate">
            {summary.peakDay
              ? `${summary.peakDay.label} (${formatInr(summary.peakDay.completedAmount)})`
              : '—'}
          </div>
        </div>
      </div>

      {/* Loading / Empty / Chart Body */}
      {loading ? (
        <div className="h-56 w-full flex items-end gap-1.5 pt-4 animate-pulse" aria-busy="true">
          {Array.from({ length: 18 }).map((_, idx) => (
            <div
              key={idx}
              className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-t"
              style={{ height: `${25 + ((idx * 17) % 65)}%` }}
            />
          ))}
        </div>
      ) : summary.totalCompletedCount === 0 ? (
        <div className="py-8 text-center space-y-2.5 text-xs">
          <p className="font-bold text-slate-800 dark:text-slate-200">
            No completed payments in the last 30 days.
          </p>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Daily settlement bars appear automatically as soon as Cashfree or portal payments are confirmed.
          </p>
          <div className="flex items-center justify-center gap-3 pt-1">
            {onStartNewApplication && (
              <button
                type="button"
                onClick={onStartNewApplication}
                className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-4 py-2 rounded-lg text-xs cursor-pointer"
              >
                Start Application
              </button>
            )}
            {onOpenPaymentsLedger && applications.length > 0 && (
              <button
                type="button"
                onClick={onOpenPaymentsLedger}
                className="border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-4 py-2 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Open Full Ledger
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="h-60 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={summary.days}
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
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickLine={false}
                axisLine={false}
                width={52}
                allowDecimals={metric === 'amount'}
                tickFormatter={(val: number) =>
                  metric === 'amount' ? formatCompactAxisInr(val) : String(val)
                }
              />
              <Tooltip
                cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                content={<CompletedPaymentTooltip />}
              />
              <Bar
                dataKey={metric === 'amount' ? 'completedAmount' : 'completedCount'}
                name={metric === 'amount' ? 'Completed Amount (₹)' : 'Completed Payments'}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              >
                {summary.days.map((entry) => {
                  const isPeak = Boolean(peakDateKey && entry.dateKey === peakDateKey);
                  return (
                    <Cell
                      key={entry.dateKey}
                      fill={
                        isPeak
                          ? '#FF671F'
                          : entry.completedAmount > 0
                          ? '#138808'
                          : 'rgba(148, 163, 184, 0.25)'
                      }
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Footer Legend & Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
        <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#138808]" />
            Completed Daily Volume
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#FF671F]" />
            Peak Settlement Day
          </span>
        </div>

        {onOpenPaymentsLedger && (
          <button
            type="button"
            onClick={onOpenPaymentsLedger}
            className="inline-flex items-center gap-1 font-bold text-[#FF671F] hover:underline cursor-pointer"
          >
            <span>View Full Payment Ledger</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </section>
  );
};

export default PaymentTrendChart;

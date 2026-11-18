import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  IndianRupee,
  Layers,
  RefreshCw,
  RotateCcw,
  ServerCrash,
  TrendingUp,
} from 'lucide-react';
import type {
  ApiSathiAnalyticsRange,
  ApiSathiUsageAnalytics,
} from '../../lib/apiSathiAnalytics';
import {
  getApiSathiRetryQueue,
  getApiSathiUsageAnalytics,
  processApiSathiRetryQueueNow,
  type ApiSathiRetryQueueSnapshot,
} from '../../services/apiSathiService';

interface ApiSathiUsageDashboardProps {
  refreshTrigger?: number;
  onQueueProcessed?: () => void;
}

const RANGE_OPTIONS: Array<{ value: ApiSathiAnalyticsRange; label: string }> = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

function formatInr(amount: number): string {
  return `₹${Number(amount || 0).toFixed(2)}`;
}

function formatShortTimestamp(iso?: string | null): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return iso;
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function queueStatusBadgeClass(status: string): string {
  switch (status) {
    case 'SUCCEEDED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    case 'RETRYING':
    case 'PENDING':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    case 'EXHAUSTED':
      return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export const ApiSathiUsageDashboard: React.FC<ApiSathiUsageDashboardProps> = ({
  refreshTrigger = 0,
  onQueueProcessed,
}) => {
  const [range, setRange] = useState<ApiSathiAnalyticsRange>('7d');
  const [analytics, setAnalytics] = useState<ApiSathiUsageAnalytics | null>(null);
  const [queue, setQueue] = useState<ApiSathiRetryQueueSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sweeping, setSweeping] = useState<boolean>(false);
  const [sweepNotice, setSweepNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadTelemetry = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, queueRes] = await Promise.all([
        getApiSathiUsageAnalytics(range),
        getApiSathiRetryQueue(),
      ]);
      if (analyticsRes) setAnalytics(analyticsRes);
      if (queueRes) setQueue(queueRes);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void loadTelemetry();
  }, [loadTelemetry, refreshTrigger]);

  const handleRunSweep = async () => {
    setSweeping(true);
    setSweepNotice(null);
    try {
      const result = await processApiSathiRetryQueueNow(true);
      setSweepNotice({ ok: result.ok, text: result.message });
      await loadTelemetry();
      onQueueProcessed?.();
    } finally {
      setSweeping(false);
    }
  };

  const summary = analytics?.summary;
  const queueSummary = queue?.summary || analytics?.queueSummary;
  const timeSeries = analytics?.timeSeries || [];
  const byProduct = analytics?.byProduct || [];
  const topProducts = useMemo(() => byProduct.slice(0, 6), [byProduct]);
  const jobs = queue?.jobs || [];
  const hasCalls = Boolean(summary && summary.totalRequests > 0);

  return (
    <section className="space-y-5 pt-2" aria-label="API Sathi Expenditure and Retry Telemetry">
      {/* Toolbar Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#FF671F]">
            API Sathi Billing &amp; Reliability Telemetry
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            API Usage, Success Rate, INR Expenditure &amp; Backoff Queue
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            HTTP 200 calls (verified and unverified lookups) are billed against prepaid balance. 402, 422, 429, and 5xx errors incur ₹0.00.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5"
            role="group"
            aria-label="Analytics Time Range"
          >
            {RANGE_OPTIONS.map((opt) => {
              const active = range === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRange(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-[#FF671F] border border-slate-200 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void loadTelemetry()}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#FF671F] text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => void handleRunSweep()}
            disabled={sweeping}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-[#FF671F] dark:hover:bg-[#e55a18] text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${sweeping ? 'animate-spin' : ''}`} />
            <span>{sweeping ? 'Sweeping...' : 'Run Retry Sweep'}</span>
          </button>
        </div>
      </div>

      {sweepNotice && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 ${
            sweepNotice.ok
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200'
          }`}
        >
          <span>{sweepNotice.text}</span>
          <button
            type="button"
            onClick={() => setSweepNotice(null)}
            className="text-[11px] font-bold underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            <span>Requests Made ({range.toUpperCase()})</span>
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {loading && !summary ? '—' : summary?.totalRequests ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {summary?.chargedRequests ?? 0} billed (200) · {summary?.notVerifiedRequests ?? 0} unverified
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            <span>Successful vs Failed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {loading && !summary ? '—' : `${summary?.successRatePercent ?? 0}%`}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {summary?.successfulRequests ?? 0} ok · {summary?.failedRequests ?? 0} failed (429:{summary?.rateLimitedCount ?? 0} / 5xx:{summary?.upstreamErrorCount ?? 0})
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            <span>Total Platform Cost</span>
            <IndianRupee className="w-4 h-4 text-[#FF671F]" />
          </div>
          <div className="text-2xl font-black font-mono text-[#FF671F]">
            {loading && !summary ? '—' : formatInr(summary?.totalCostInr ?? 0)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Live {formatInr(summary?.liveCostInr ?? 0)} · Sandbox {formatInr(summary?.sandboxEstimatedCostInr ?? 0)}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            <span>Retry Queue &amp; Latency</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {loading && !queueSummary
              ? '—'
              : `${(queueSummary?.pendingCount ?? 0) + (queueSummary?.retryingCount ?? 0)} queued`}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {queueSummary?.succeededCount ?? 0} recovered · {queueSummary?.exhaustedCount ?? 0} exhausted · {summary?.avgLatencyMs ?? 0}ms avg
          </div>
        </div>
      </div>

      {/* Main Recharts Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left Chart: Requests + INR Spend Over Time */}
        <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-[#FF671F]" />
                <span>Request Outcomes &amp; INR Expenditure Over Time</span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Stacked verification outcomes (bars) plotted against billed INR expenditure (line).
              </p>
            </div>
            {summary && summary.savedOnUnchargedErrorsInr > 0 && (
              <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 shrink-0">
                Uncharged errors saved {formatInr(summary.savedOnUnchargedErrorsInr)}
              </span>
            )}
          </div>

          {!hasCalls && !loading ? (
            <div className="h-72 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl px-6 space-y-2">
              <Layers className="w-7 h-7 text-slate-400" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                No API Sathi requests recorded in this {range.toUpperCase()} window
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md">
                Run a KYC/KYB verification using PAN, GSTIN, Vehicle RC, or DigiLocker to populate real-time cost and outcome telemetry.
              </p>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timeSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="count"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="cost"
                    orientation="right"
                    tickFormatter={(v) => `₹${v}`}
                    tick={{ fontSize: 11, fill: '#FF671F' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: any) => {
                      if (String(name).includes('Spend')) {
                        return [`₹${Number(value || 0).toFixed(2)}`, name];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    yAxisId="count"
                    dataKey="successfulRequests"
                    stackId="outcomes"
                    fill="#16A34A"
                    name="Successful (Verified)"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    yAxisId="count"
                    dataKey="notVerifiedRequests"
                    stackId="outcomes"
                    fill="#D97706"
                    name="Not Verified (200)"
                  />
                  <Bar
                    yAxisId="count"
                    dataKey="failedRequests"
                    stackId="outcomes"
                    fill="#DC2626"
                    name="Failed (4xx/5xx/429)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="cost"
                    type="monotone"
                    dataKey="costInr"
                    stroke="#FF671F"
                    strokeWidth={2.5}
                    dot={{ r: 2.5 }}
                    activeDot={{ r: 5 }}
                    name="Spend (₹ INR)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right Chart + Compact Ledger: Cost & Volume by Product */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4 text-[#FF671F]" />
              <span>Cost &amp; Volume by API Product</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Top products ranked by billed INR spend across live &amp; sandbox calls.
            </p>
          </div>

          {topProducts.length === 0 ? (
            <div className="h-44 flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 dark:text-slate-400">
              Product breakdown will appear once API calls are logged.
            </div>
          ) : (
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topProducts}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `₹${v}`}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="productSlug"
                    width={132}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: any) => [
                      String(name).includes('Cost') ? `₹${Number(value || 0).toFixed(2)}` : value,
                      name,
                    ]}
                  />
                  <Bar dataKey="costInr" fill="#FF671F" name="Cost (₹ INR)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {byProduct.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 overflow-x-auto">
              <table className="w-full text-[11px] tabular-nums">
                <thead>
                  <tr className="text-left text-slate-400 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
                    <th className="pb-1.5 pr-2">Product</th>
                    <th className="pb-1.5 px-2 text-right">Unit ₹</th>
                    <th className="pb-1.5 px-2 text-right">Calls</th>
                    <th className="pb-1.5 px-2 text-right">OK %</th>
                    <th className="pb-1.5 pl-2 text-right">Cost ₹</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {byProduct.slice(0, 6).map((row) => (
                    <tr key={row.productSlug} className="text-slate-700 dark:text-slate-300">
                      <td className="py-1.5 pr-2 font-medium truncate max-w-[150px]" title={row.productSlug}>
                        {row.productName}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono">{row.unitPriceInr.toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{row.totalRequests}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{row.successRatePercent}%</td>
                      <td className="py-1.5 pl-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatInr(row.costInr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Exponential-Backoff Retry Queue Monitor */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ServerCrash className="w-4 h-4 text-amber-600" />
              <span>Background Exponential-Backoff Retry Queue (429 &amp; 5xx Only)</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Transient failures preserve the exact original <span className="font-mono">Idempotency-Key</span> UUID so retries are never billed twice. Terminal errors (400, 401, 402, 404, 410, 422) are never queued.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono shrink-0">
            <span className="px-2 py-1 rounded-md border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
              Pending: {(queueSummary?.pendingCount ?? 0) + (queueSummary?.retryingCount ?? 0)}
            </span>
            <span className="px-2 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
              Succeeded: {queueSummary?.succeededCount ?? 0}
            </span>
            <span className="px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
              Exhausted: {queueSummary?.exhaustedCount ?? 0}
            </span>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              No transient 429 or 5xx failures queued — all API Sathi calls settled.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 text-left text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-2.5 px-4">Product &amp; Masked Input</th>
                  <th className="py-2.5 px-3">Last Failure</th>
                  <th className="py-2.5 px-3">Attempts</th>
                  <th className="py-2.5 px-3">Idempotency-Key</th>
                  <th className="py-2.5 px-3">Next Retry</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">{job.productSlug}</div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[240px]" title={job.maskedInputJson}>
                        {job.maskedInputJson}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        HTTP {job.lastHttpStatus} · {job.lastErrorCode}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]" title={job.lastErrorMessage}>
                        {job.lastErrorMessage}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {job.attemptCount}/{job.maxAttempts}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {job.idempotencyKey.slice(0, 12)}…
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {job.status === 'PENDING' || job.status === 'RETRYING'
                        ? formatShortTimestamp(job.nextRetryAt)
                        : formatShortTimestamp(job.completedAt || job.updatedAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${queueStatusBadgeClass(
                          job.status
                        )}`}
                      >
                        {job.status === 'EXHAUSTED' && <AlertTriangle className="w-3 h-3" />}
                        {job.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

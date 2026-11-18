import React, { useEffect, useState } from 'react';
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
  Activity,
  Gauge,
  MousePointerClick,
  RefreshCw,
  Smartphone,
  Tablet,
  Monitor,
  Trash2,
  Clock,
} from 'lucide-react';
import {
  clearPerfMetrics,
  getPerfSummary,
  subscribePerfMetrics,
  type PerfSummary,
} from '../../lib/perfMonitor';

export const PerformanceAnalyticsTab: React.FC = () => {
  const [summary, setSummary] = useState<PerfSummary>(() => getPerfSummary());

  useEffect(() => {
    const refresh = () => setSummary(getPerfSummary());
    refresh();
    return subscribePerfMetrics(refresh);
  }, []);

  const totalViewportSamples =
    summary.viewportBreakdown.mobile +
    summary.viewportBreakdown.tablet +
    summary.viewportBreakdown.desktop;

  const chartData = summary.routeStats.slice(0, 8).map((r) => ({
    route: `/${r.route === 'home' ? '' : r.route}`,
    avgMs: r.avgLoadMs,
    maxMs: r.maxLoadMs,
    views: r.views,
  }));

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#FF671F]">
            Client Telemetry &amp; UX Observability
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            Page Load Performance &amp; Interaction Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real browser Navigation Timing, route transition latency, and user interaction events captured across mobile, tablet, and desktop.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSummary(getPerfSummary())}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-[#FF671F] text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => {
              clearPerfMetrics();
              setSummary(getPerfSummary());
            }}
            className="px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-xs font-bold text-red-700 dark:text-red-300 inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Metrics</span>
          </button>
        </div>
      </div>

      {/* 4 Core KPI Blocks */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
            <span>Avg Route Load</span>
            <Gauge className="w-3.5 h-3.5 text-[#FF671F]" />
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {summary.avgPageLoadMs} ms
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Range: {summary.fastestRouteMs}–{summary.slowestRouteMs} ms
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
            <span>Initial Boot / FCP</span>
            <Clock className="w-3.5 h-3.5 text-[#138808]" />
          </div>
          <div className="text-2xl font-black font-mono text-[#138808] dark:text-emerald-400">
            {summary.fcpMs !== null ? `${summary.fcpMs} ms` : summary.initialLoadMs !== null ? `${summary.initialLoadMs} ms` : '—'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            TTFB: {summary.ttfbMs !== null ? `${summary.ttfbMs} ms` : 'N/A'}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
            <span>Tracked Page Views</span>
            <Activity className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
            {summary.totalPageViews}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Across {summary.routeStats.length} distinct routes
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
            <span>User Interactions</span>
            <MousePointerClick className="w-3.5 h-3.5 text-[#FF671F]" />
          </div>
          <div className="text-2xl font-black font-mono text-[#FF671F]">
            {summary.totalInteractions}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Clicks, filters, nav &amp; refreshes
          </div>
        </div>
      </div>

      {/* Chart + Device Viewport Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Average Load Time by Route (ms)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lower render latency indicates smoother client-side transitions.
              </p>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              Navigate across routes to populate route latency telemetry.
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="route"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    unit="ms"
                  />
                  <Tooltip
                    formatter={(value: any) => [`${value} ms`, 'Avg Load']}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="avgMs" fill="#FF671F" radius={[6, 6, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Viewport Distribution
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Recorded sessions across form factors
            </p>
          </div>

          <div className="space-y-3 tabular-nums">
            {[
              {
                key: 'mobile' as const,
                label: 'Phone (< 640px)',
                count: summary.viewportBreakdown.mobile,
                icon: Smartphone,
                color: 'bg-[#FF671F]',
              },
              {
                key: 'tablet' as const,
                label: 'Tablet (640–1023px)',
                count: summary.viewportBreakdown.tablet,
                icon: Tablet,
                color: 'bg-[#138808]',
              },
              {
                key: 'desktop' as const,
                label: 'Desktop (1024px+)',
                count: summary.viewportBreakdown.desktop,
                icon: Monitor,
                color: 'bg-slate-800 dark:bg-slate-300',
              },
            ].map((row) => {
              const Icon = row.icon;
              const pct =
                totalViewportSamples > 0
                  ? Math.round((row.count / totalViewportSamples) * 100)
                  : 0;
              return (
                <div key={row.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                      <Icon className="w-3.5 h-3.5 text-slate-500" />
                      <span>{row.label}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {row.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${row.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Top User Actions
            </div>
            {summary.topInteractions.length === 0 ? (
              <p className="text-xs text-slate-400">No interactions recorded yet.</p>
            ) : (
              <div className="space-y-1.5 text-xs tabular-nums">
                {summary.topInteractions.slice(0, 5).map((ix) => (
                  <div key={ix.key} className="flex items-center justify-between gap-2">
                    <span className="text-slate-700 dark:text-slate-300 truncate">
                      <span className="font-semibold">{ix.category}</span> · {ix.action}
                    </span>
                    <span className="font-mono font-bold text-[#FF671F] shrink-0">
                      {ix.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Route Stats & Recent Events Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
            Route Latency Breakdown
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left tabular-nums">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">Route</th>
                  <th className="px-4 py-2.5 text-right">Views</th>
                  <th className="px-4 py-2.5 text-right">Avg</th>
                  <th className="px-4 py-2.5 text-right">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {summary.routeStats.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                      No route measurements recorded yet.
                    </td>
                  </tr>
                ) : (
                  summary.routeStats.map((r) => (
                    <tr key={r.route} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        /{r.route === 'home' ? '' : r.route}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{r.views}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#138808] dark:text-emerald-400 font-bold">
                        {r.avgLoadMs} ms
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                        {r.maxLoadMs} ms
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">
            Recent Interaction Events
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto text-xs tabular-nums">
            {summary.recentInteractions.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400">
                Interact with cards, filters, or navigation to see live event telemetry.
              </div>
            ) : (
              summary.recentInteractions.map((ev) => (
                <div key={ev.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {ev.category} · {ev.action}
                      {ev.label ? ` (${ev.label})` : ''}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      /{ev.route} · {ev.viewport}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 shrink-0">
                    {new Date(ev.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

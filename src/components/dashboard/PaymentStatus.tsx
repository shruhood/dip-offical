import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import type { Application, PaymentTransaction, RefundRecord } from '../../types';
import {
  checkCashfreePaymentStatus,
  fetchApplicationsPaymentStatus,
  fetchPaymentHistory,
} from '../../services/backendApi';
import {
  buildPaymentHistoryEntries,
  deriveInitialPaymentUiStatus,
  formatPaymentHistoryCsv,
  normalizePaymentUiStatus,
  summarizePaymentStatuses,
  toPaymentBadgeStatus,
  type ApplicationPaymentStatusItem,
  type BackendPaymentHistoryRecord,
  type PaymentBadgeStatus,
  type PaymentHistoryEntry,
  type PaymentUiStatus,
} from '../../lib/paymentStatus';

export interface PaymentStatusBadgeProps {
  status: PaymentBadgeStatus | PaymentUiStatus | string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  label?: string;
  className?: string;
  applications?: never;
}

export interface PaymentStatusPanelProps {
  status?: never;
  applications: Application[];
  transactions?: PaymentTransaction[];
  refunds?: RefundRecord[];
  onSelectApplication?: (app: Application) => void;
  onPaymentStateSynced?: (appId: string, item: ApplicationPaymentStatusItem) => void;
  onViewAllPayments?: () => void;
  onStartNewApplication?: () => void;
  onRequestRefund?: (payload: {
    applicationId: string;
    orderId: string;
    amountInr: number;
    reason: string;
  }) => void;
  onRetryPayment?: (payload: {
    applicationId: string;
    orderId: string;
    amountInr: number;
    serviceName: string;
  }) => void;
  onPrintReceipt?: (entry: PaymentHistoryEntry) => void;
  externalStatusFilter?: StatusFilter;
  onStatusFilterChange?: (filter: StatusFilter) => void;
  onStatusMapChange?: (statusMap: Record<string, ApplicationPaymentStatusItem>) => void;
  compact?: boolean;
  hideHistory?: boolean;
  autoPollIntervalMs?: number;
}

export type PaymentStatusProps = PaymentStatusBadgeProps | PaymentStatusPanelProps;

type StatusFilter = 'all' | 'Pending' | 'Paid' | 'Failed';

function getStatusVisuals(status: PaymentUiStatus | PaymentBadgeStatus | string) {
  const uiStatus = normalizePaymentUiStatus(status);
  switch (uiStatus) {
    case 'Paid':
      return {
        key: 'paid' as PaymentBadgeStatus,
        label: 'Paid',
        textClass: 'text-[#138808] dark:text-emerald-300',
        surfaceClass: 'bg-emerald-50/90 dark:bg-emerald-950/45 border-emerald-200 dark:border-emerald-800/80',
        Icon: CheckCircle2,
      };
    case 'Failed':
      return {
        key: 'failed' as PaymentBadgeStatus,
        label: 'Failed',
        textClass: 'text-[#DC2626] dark:text-rose-300',
        surfaceClass: 'bg-rose-50/90 dark:bg-rose-950/45 border-rose-200 dark:border-rose-800/80',
        Icon: XCircle,
      };
    default:
      return {
        key: 'pending' as PaymentBadgeStatus,
        label: 'Pending',
        textClass: 'text-[#B45309] dark:text-amber-300',
        surfaceClass: 'bg-amber-50/90 dark:bg-amber-950/45 border-amber-200 dark:border-amber-800/80',
        Icon: Clock,
      };
  }
}

export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({
  status,
  size = 'sm',
  showIcon = true,
  label,
  className = '',
}) => {
  const badgeKey = toPaymentBadgeStatus(status);
  const visuals = getStatusVisuals(badgeKey);
  const StatusIcon = visuals.Icon;
  const displayLabel = label ?? visuals.label;
  const sizingClass =
    size === 'md'
      ? 'px-2.5 py-1 text-xs gap-1.5 rounded-md'
      : 'px-2 py-0.5 text-[11px] gap-1 rounded-md';
  const iconClass = size === 'md' ? 'w-3.5 h-3.5 shrink-0' : 'w-3 h-3 shrink-0';

  return (
    <span
      role="status"
      data-payment-status={visuals.key}
      aria-label={`Payment status: ${displayLabel}`}
      className={`inline-flex items-center font-bold border whitespace-nowrap shrink-0 ${sizingClass} ${visuals.surfaceClass} ${visuals.textClass} ${className}`.trim()}
    >
      {showIcon && <StatusIcon className={iconClass} />}
      <span>{displayLabel}</span>
    </span>
  );
};

function formatInr(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatHistoryDate(isoDate: string): { datePart: string; timePart: string } {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return { datePart: '—', timePart: '' };
  }
  return {
    datePart: parsed.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    timePart: parsed.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

const PaymentStatusPanel: React.FC<PaymentStatusPanelProps> = ({
  applications,
  transactions = [],
  refunds = [],
  onSelectApplication,
  onPaymentStateSynced,
  onViewAllPayments,
  onStartNewApplication,
  onRequestRefund,
  onRetryPayment,
  onPrintReceipt,
  externalStatusFilter,
  onStatusFilterChange,
  onStatusMapChange,
  compact = false,
  hideHistory = false,
  autoPollIntervalMs = 15000,
}) => {
  const [statusMap, setStatusMap] = useState<Record<string, ApplicationPaymentStatusItem>>({});
  const [backendHistory, setBackendHistory] = useState<BackendPaymentHistoryRecord[]>([]);
  const [initialLoading, setInitialLoading] = useState<boolean>(applications.length > 0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [verifyingAppId, setVerifyingAppId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [internalStatusFilter, setInternalStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  const statusFilter = externalStatusFilter ?? internalStatusFilter;
  const setStatusFilter = useCallback(
    (next: StatusFilter) => {
      setInternalStatusFilter(next);
      onStatusFilterChange?.(next);
    },
    [onStatusFilterChange]
  );

  useEffect(() => {
    onStatusMapChange?.(statusMap);
  }, [statusMap, onStatusMapChange]);

  const applicationsRef = useRef(applications);
  applicationsRef.current = applications;

  const onSyncedRef = useRef(onPaymentStateSynced);
  onSyncedRef.current = onPaymentStateSynced;

  const appSignature = useMemo(
    () =>
      applications
        .slice(0, 25)
        .map((a) => `${a.id}:${a.payment?.orderId || ''}:${a.payment?.status || ''}`)
        .join('|'),
    [applications]
  );

  const syncAllPaymentStatuses = useCallback(async (isInitial = false) => {
    const currentApps = applicationsRef.current.slice(0, 25);
    if (isInitial && currentApps.length > 0) setInitialLoading(true);
    setRefreshing(true);
    setErrorMsg(null);

    try {
      const historyPromise = fetchPaymentHistory().catch(() => ({
        ok: false,
        data: [] as BackendPaymentHistoryRecord[],
        message: '',
      }));

      if (currentApps.length === 0) {
        const histRes = await historyPromise;
        setStatusMap({});
        if (histRes.ok) {
          setBackendHistory(histRes.data);
        }
        setInitialLoading(false);
        setRefreshing(false);
        return;
      }

      const payload = currentApps.map((app) => ({
        applicationId: app.id,
        orderId: app.payment?.orderId || '',
        currentStatus: app.payment?.status || app.status,
      }));

      const [res, histRes] = await Promise.all([
        fetchApplicationsPaymentStatus(payload),
        historyPromise,
      ]);

      if (histRes.ok) {
        setBackendHistory(histRes.data);
      }

      if (!res.ok || !res.data) {
        setErrorMsg(res.message || 'Unable to reach payment verification service.');
        return;
      }

      const nextMap: Record<string, ApplicationPaymentStatusItem> = {};
      for (const item of res.data.items) {
        nextMap[item.applicationId] = item;
        const matchedApp = currentApps.find((a) => a.id === item.applicationId);
        if (matchedApp) {
          const prevUi = deriveInitialPaymentUiStatus(matchedApp);
          if (
            prevUi !== item.uiStatus ||
            (item.cfPaymentId && item.cfPaymentId !== matchedApp.payment?.cfPaymentId)
          ) {
            onSyncedRef.current?.(item.applicationId, item);
          }
        }
      }

      setStatusMap(nextMap);
      setLastSyncedAt(res.data.checkedAt || new Date().toISOString());
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error while checking payment status.');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void syncAllPaymentStatuses(true);
  }, [appSignature, syncAllPaymentStatuses]);

  const resolvedRows = useMemo(() => {
    return applications.map((app) => {
      const live = statusMap[app.id];
      const uiStatus: PaymentUiStatus = live?.uiStatus ?? deriveInitialPaymentUiStatus(app);
      return {
        app,
        live,
        uiStatus,
        orderId: live?.orderId || app.payment?.orderId || 'Unassigned',
        paymentMethod: live?.paymentMethod || app.payment?.paymentMethod || 'Online Payment',
        amountInr:
          typeof live?.paymentAmount === 'number'
            ? live.paymentAmount
            : app.payment?.totalAmount ?? 0,
      };
    });
  }, [applications, statusMap]);

  const summary = useMemo(
    () => summarizePaymentStatuses(resolvedRows.map((r) => ({ uiStatus: r.uiStatus }))),
    [resolvedRows]
  );

  const historyEntries = useMemo(
    () =>
      buildPaymentHistoryEntries({
        applications,
        transactions,
        statusMap,
        backendHistory,
      }),
    [applications, transactions, statusMap, backendHistory]
  );

  const totalPaidAmount = useMemo(
    () =>
      historyEntries
        .filter((e) => e.uiStatus === 'Paid')
        .reduce((acc, e) => acc + (Number.isFinite(e.amount) ? e.amount : 0), 0),
    [historyEntries]
  );

  useEffect(() => {
    if (!autoSyncEnabled || summary.pending === 0 || applications.length === 0) {
      return;
    }
    const timer = window.setInterval(() => {
      void syncAllPaymentStatuses(false);
    }, Math.max(5000, autoPollIntervalMs));

    return () => window.clearInterval(timer);
  }, [autoSyncEnabled, summary.pending, applications.length, autoPollIntervalMs, syncAllPaymentStatuses]);

  const handleVerifySingleApplication = async (app: Application) => {
    const orderId = statusMap[app.id]?.orderId || app.payment?.orderId;
    if (!orderId) {
      await syncAllPaymentStatuses(false);
      return;
    }

    setVerifyingAppId(app.id);
    setErrorMsg(null);
    try {
      const res = await checkCashfreePaymentStatus(orderId);
      if (!res.ok || !res.data) {
        setErrorMsg(res.message || `Failed to verify order ${orderId}.`);
        return;
      }

      const checkedAt = new Date().toISOString();
      const updatedItem: ApplicationPaymentStatusItem = {
        applicationId: app.id,
        orderId: res.data.orderId || orderId,
        uiStatus: normalizePaymentUiStatus(res.data.orderStatus, res.data.paid),
        gatewayStatus: res.data.orderStatus,
        paid: res.data.paid,
        cfPaymentId: res.data.cfPaymentId,
        paymentMethod: res.data.paymentMethod,
        paymentTime: res.data.paymentTime,
        bankReference: res.data.bankReference,
        paymentAmount: res.data.paymentAmount,
        paymentMessage: res.data.paymentMessage,
        gatewayConfigured: res.data.gatewayConfigured,
        simulationOnly: res.data.simulationOnly,
        mode: res.data.mode,
        source: res.data.gatewayConfigured ? 'cashfree_live' : 'sandbox_preview',
        checkedAt,
      };

      setStatusMap((prev) => ({
        ...prev,
        [app.id]: updatedItem,
      }));
      setLastSyncedAt(checkedAt);
      onSyncedRef.current?.(app.id, updatedItem);
    } catch (err: any) {
      setErrorMsg(err?.message || `Error verifying payment ${orderId}.`);
    } finally {
      setVerifyingAppId(null);
    }
  };

  const handleCopyTransactionId = async (txId: string) => {
    try {
      await navigator.clipboard?.writeText(txId);
    } catch {
      // Clipboard API unavailable in restricted iframe contexts
    }
    setCopiedTxId(txId);
    window.setTimeout(() => {
      setCopiedTxId((prev) => (prev === txId ? null : prev));
    }, 1800);
  };

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = resolvedRows.filter((row) => {
      if (statusFilter !== 'all' && row.uiStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        row.app.id.toLowerCase().includes(q) ||
        row.app.serviceName.toLowerCase().includes(q) ||
        row.orderId.toLowerCase().includes(q)
      );
    });
    return compact ? list.slice(0, 5) : list;
  }, [resolvedRows, statusFilter, searchQuery, compact]);

  const filteredHistoryAll = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return historyEntries.filter((entry) => {
      if (statusFilter !== 'all' && entry.uiStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        entry.transactionId.toLowerCase().includes(q) ||
        entry.orderId.toLowerCase().includes(q) ||
        entry.applicationId.toLowerCase().includes(q) ||
        entry.serviceName.toLowerCase().includes(q) ||
        entry.paymentMethod.toLowerCase().includes(q) ||
        (entry.receiptNumber || '').toLowerCase().includes(q) ||
        (entry.invoiceNumber || '').toLowerCase().includes(q) ||
        (entry.bankReference || '').toLowerCase().includes(q)
      );
    });
  }, [historyEntries, statusFilter, searchQuery]);

  const visibleHistoryRows = useMemo(
    () => (compact ? filteredHistoryAll.slice(0, 5) : filteredHistoryAll),
    [filteredHistoryAll, compact]
  );

  const handleExportCsv = () => {
    const csv = formatPaymentHistoryCsv(filteredHistoryAll);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payment-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filterButtons: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: summary.total },
    { key: 'Pending', label: 'Pending', count: summary.pending },
    { key: 'Paid', label: 'Paid', count: summary.paid },
    { key: 'Failed', label: 'Failed', count: summary.failed },
  ];

  const showHistoryActions = !compact && Boolean(onPrintReceipt || onRequestRefund);

  return (
    <section
      aria-label="Real-time Application Payment Status and Payment History"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
    >
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Real-Time Application Payment Status
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              <span>{summary.total} Applications</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#138808] dark:text-emerald-400 font-semibold">
                {summary.paid} Paid
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[#D97706] dark:text-amber-400 font-semibold">
                {summary.pending} Pending
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[#DC2626] dark:text-rose-400 font-semibold">
                {summary.failed} Failed
              </span>
              {lastSyncedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[11px]">
                    Synced{' '}
                    {new Date(lastSyncedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {summary.pending > 0 && (
              <button
                type="button"
                onClick={() => setAutoSyncEnabled((v) => !v)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF671F]"
              >
                {autoSyncEnabled ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Pause Auto-Sync</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-[#138808] dark:text-emerald-400" />
                    <span>Resume Auto-Sync</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => void syncAllPaymentStatuses(false)}
              disabled={refreshing || (applications.length === 0 && historyEntries.length === 0)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF671F]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing...' : 'Refresh Status'}</span>
            </button>

            {compact && onViewAllPayments && (applications.length > 0 || historyEntries.length > 0) && (
              <button
                type="button"
                onClick={onViewAllPayments}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#FF671F] hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Full Ledger →
              </button>
            )}
          </div>
        </div>

        {/* Segmented Filter Bar + Search */}
        {(applications.length > 0 || historyEntries.length > 0) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Filter payments by status"
              className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg self-start overflow-x-auto max-w-full"
            >
              {filterButtons.map((tab) => {
                const active = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="font-mono text-[11px] opacity-75">{tab.count}</span>
                  </button>
                );
              })}
            </div>

            {!compact && (
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Transaction ID, Order, App, Service..."
                  aria-label="Search application payments and history"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#FF671F]"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inline API Error Banner */}
      {errorMsg && (
        <div
          role="alert"
          className="px-4 sm:px-5 py-3 bg-rose-50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-medium min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => void syncAllPaymentStatuses(false)}
            className="text-xs font-bold text-rose-700 dark:text-rose-300 underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Real-Time Status Body */}
      {initialLoading && applications.length > 0 ? (
        <div className="divide-y divide-slate-100 dark:divide-slate-800" aria-busy="true">
          {Array.from({ length: Math.min(compact ? 3 : 4, applications.length) }).map((_, idx) => (
            <div
              key={idx}
              className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4 animate-pulse"
            >
              <div className="space-y-2 flex-1">
                <div className="h-3.5 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3 w-64 bg-slate-100 dark:bg-slate-800/70 rounded" />
              </div>
              <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-md shrink-0" />
            </div>
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="p-8 text-center text-xs space-y-2.5">
          <p className="font-bold text-slate-800 dark:text-slate-200">
            No application payments to monitor yet.
          </p>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Once you submit a service application, live Cashfree payment confirmation and transaction references will appear here.
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
      ) : filteredRows.length === 0 ? (
        <div className="p-7 text-center text-xs space-y-2">
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            No {statusFilter === 'all' ? '' : `${statusFilter.toLowerCase()} `}applications match your filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="text-xs font-bold text-[#FF671F] hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredRows.map(({ app, live, uiStatus, orderId, paymentMethod, amountInr }) => {
            const isRowVerifying = verifyingAppId === app.id;
            const refId = live?.cfPaymentId || app.payment?.cfPaymentId;

            return (
              <div
                key={app.id}
                className="px-4 sm:px-5 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-[#FF671F] tabular-nums">{app.id}</span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {app.serviceName}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span className="font-mono">Order {orderId}</span>
                    <span aria-hidden="true">·</span>
                    <span>{paymentMethod}</span>
                    {refId && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">Ref {refId}</span>
                      </>
                    )}
                    {live?.paymentMessage && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-600 dark:text-slate-300 truncate max-w-xs">
                          {live.paymentMessage}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                  <div className="text-left md:text-right tabular-nums">
                    <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                      {formatInr(amountInr)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {live?.paymentTime
                        ? new Date(live.paymentTime).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : app.payment?.paidAt
                        ? new Date(app.payment.paidAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : 'Awaiting gateway'}
                    </div>
                  </div>

                  <PaymentStatusBadge status={uiStatus} size="md" />

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onRetryPayment && uiStatus !== 'Paid' && (
                      <button
                        type="button"
                        onClick={() =>
                          onRetryPayment({
                            applicationId: app.id,
                            orderId,
                            amountInr,
                            serviceName: app.serviceName,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Retry Pay
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleVerifySingleApplication(app)}
                      disabled={isRowVerifying || refreshing}
                      title={`Query backend for ${orderId}`}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isRowVerifying ? 'animate-spin' : ''}`} />
                      <span>Check</span>
                    </button>

                    {onSelectApplication && (
                      <button
                        type="button"
                        onClick={() => onSelectApplication(app)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#FF671F] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-0.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payment History Table */}
      {!hideHistory && (
      <div
        aria-label="Payment History"
        className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30"
      >
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Payment History
            </h4>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              <span>{historyEntries.length} Transaction{historyEntries.length === 1 ? '' : 's'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                Total Paid {formatInr(totalPaidAmount)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!compact && filteredHistoryAll.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                aria-label="Export payment history CSV"
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </button>
            )}

            {compact && onViewAllPayments && filteredHistoryAll.length > 5 && (
              <button
                type="button"
                onClick={onViewAllPayments}
                className="text-xs font-semibold text-[#FF671F] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                View All ({filteredHistoryAll.length}) →
              </button>
            )}
          </div>
        </div>

        {initialLoading && historyEntries.length === 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800" aria-busy="true">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="px-4 sm:px-5 py-3 flex items-center justify-between gap-4 animate-pulse"
              >
                <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3.5 w-44 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        ) : visibleHistoryRows.length === 0 ? (
          <div className="px-4 sm:px-5 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            {historyEntries.length === 0
              ? 'No past transactions recorded yet. Completed and attempted payments will appear here with dates, amounts, and transaction IDs.'
              : 'No payment history entries match the active status filter or search query.'}
          </div>
        ) : (
          <div className="overflow-x-auto bg-white dark:bg-slate-900">
            <table className="w-full min-w-[660px] text-xs text-left tabular-nums">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-2.5">Date</th>
                  <th scope="col" className="px-4 py-2.5">Transaction ID</th>
                  <th scope="col" className="px-4 py-2.5">Application &amp; Service</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Amount</th>
                  <th scope="col" className="px-4 py-2.5">Status</th>
                  {showHistoryActions && (
                    <th scope="col" className="px-4 py-2.5 text-right">Receipt / Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleHistoryRows.map((entry) => {
                  const { datePart, timePart } = formatHistoryDate(entry.date);
                  const matchedApp = applications.find((a) => a.id === entry.applicationId);
                  const hasRefund = refunds.some((r) => r.orderId === entry.orderId);
                  const isCopied = copiedTxId === entry.transactionId;
                  const showDistinctOrder =
                    entry.orderId &&
                    entry.orderId !== 'Unassigned' &&
                    entry.orderId !== entry.transactionId;

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {datePart}
                        </div>
                        {timePart && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {timePart}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {entry.transactionId}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleCopyTransactionId(entry.transactionId)}
                            title="Copy Transaction ID"
                            aria-label={`Copy transaction ID ${entry.transactionId}`}
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-[#138808] dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                          {isCopied && (
                            <span className="text-[10px] font-semibold text-[#138808] dark:text-emerald-400">
                              Copied
                            </span>
                          )}
                        </div>

                        {(showDistinctOrder || entry.bankReference) && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            {showDistinctOrder && <span>Order {entry.orderId}</span>}
                            {showDistinctOrder && entry.bankReference && (
                              <span aria-hidden="true">·</span>
                            )}
                            {entry.bankReference && <span>UTR {entry.bankReference}</span>}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {entry.serviceName}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {matchedApp && onSelectApplication ? (
                            <button
                              type="button"
                              onClick={() => onSelectApplication(matchedApp)}
                              className="font-mono font-semibold text-[#FF671F] hover:underline cursor-pointer"
                            >
                              {entry.applicationId}
                            </button>
                          ) : (
                            <span className="font-mono">{entry.applicationId}</span>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>{entry.paymentMethod}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap align-top">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                          {formatInr(entry.amount)}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <PaymentStatusBadge status={entry.uiStatus} size="sm" />
                      </td>

                      {showHistoryActions && (
                        <td className="px-4 py-3 text-right whitespace-nowrap align-top">
                          <div className="inline-flex items-center justify-end gap-3">
                            {onRetryPayment && entry.uiStatus !== 'Paid' && (
                              <button
                                type="button"
                                onClick={() =>
                                  onRetryPayment({
                                    applicationId: entry.applicationId,
                                    orderId: entry.orderId,
                                    amountInr: entry.amount,
                                    serviceName: entry.serviceName,
                                  })
                                }
                                className="text-white bg-[#FF671F] hover:bg-[#E55B1B] px-2.5 py-1 rounded font-bold text-[11px] cursor-pointer"
                              >
                                Retry Pay
                              </button>
                            )}
                            {onPrintReceipt && (
                              <button
                                type="button"
                                onClick={() => onPrintReceipt(entry)}
                                className="text-[#FF671F] hover:underline font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3 h-3" />
                                <span>{entry.invoiceNumber || entry.receiptNumber || 'Receipt'}</span>
                              </button>
                            )}
                            {typeof entry.refundedAmount === 'number' && entry.refundedAmount > 0 && (
                              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                Refunded ₹{entry.refundedAmount.toLocaleString('en-IN')}
                              </span>
                            )}
                            {onRequestRefund &&
                              (!hasRefund ? (
                                entry.uiStatus === 'Paid' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onRequestRefund({
                                        applicationId: entry.applicationId,
                                        orderId: entry.orderId,
                                        amountInr: entry.amount,
                                        reason: 'Customer requested cancellation/refund review',
                                      })
                                    }
                                    className="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Refund</span>
                                  </button>
                                )
                              ) : (
                                <span className="text-[11px] font-semibold text-[#D97706] dark:text-amber-400">
                                  Refund Requested
                                </span>
                              ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </section>
  );
};

export const PaymentStatus: React.FC<PaymentStatusProps> = (props) => {
  if ('status' in props && props.status !== undefined) {
    return <PaymentStatusBadge {...props} />;
  }
  return <PaymentStatusPanel {...(props as PaymentStatusPanelProps)} />;
};

export default PaymentStatus;

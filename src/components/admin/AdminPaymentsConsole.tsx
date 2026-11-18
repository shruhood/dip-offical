import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { PaymentTransaction, RefundRecord } from '../../types';
import {
  executeOrderRefund,
  fetchAdminPaymentAnalytics,
  fetchAdminPaymentConfig,
  fetchAdminPaymentRefunds,
  fetchAdminPayments,
  fetchAdminPaymentWebhooks,
  fetchPaymentOrderDetail,
  replayAdminPaymentWebhook,
  runAdminPaymentCutoverCheck,
  runAdminPaymentReconcile,
  saveAdminPaymentConfig,
  verifyCashfreePaymentOrder,
  type AdminCashfreeGatewayConfig,
  type AdminPaymentAnalytics,
  type AdminPaymentCutoverCheckResult,
} from '../../services/backendApi';

interface AdminPaymentsConsoleProps {
  transactions: PaymentTransaction[];
  refunds: RefundRecord[];
  onProcessRefundRequest: (refundId: string, decision: 'Processed' | 'Rejected') => void;
}

type PaymentSubTab = 'overview' | 'refunds' | 'webhooks' | 'config';

function formatInr(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export const AdminPaymentsConsole: React.FC<AdminPaymentsConsoleProps> = ({
  transactions,
  refunds,
  onProcessRefundRequest,
}) => {
  const [subTab, setSubTab] = useState<PaymentSubTab>('overview');
  const [analytics, setAnalytics] = useState<AdminPaymentAnalytics | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [gatewayRefunds, setGatewayRefunds] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [gatewayConfig, setGatewayConfig] = useState<AdminCashfreeGatewayConfig | null>(null);

  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Filters for payments table
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Webhook filter + reconcile
  const [webhookStatusFilter, setWebhookStatusFilter] = useState<string>('');
  const [reconcileSummary, setReconcileSummary] = useState<string | null>(null);

  // Inspect modal
  const [inspectDetail, setInspectDetail] = useState<{ orderId: string; data: any } | null>(null);

  // Refund modal
  const [refundModalOrder, setRefundModalOrder] = useState<{
    orderId: string;
    paidAmountInr: number;
    refundedInr: number;
    applicantName?: string;
  } | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [refundSpeed, setRefundSpeed] = useState<'STANDARD' | 'INSTANT'>('STANDARD');
  const [refundReason, setRefundReason] = useState('Customer requested cancellation/refund review');
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  // Config form state
  const [cfgMode, setCfgMode] = useState<'sandbox' | 'production'>('production');
  const [cfgVersion, setCfgVersion] = useState('2023-08-01');
  const [cfgEnabled, setCfgEnabled] = useState(true);
  const [cfgAutoVerify, setCfgAutoVerify] = useState(true);
  const [cfgExpiryMins, setCfgExpiryMins] = useState(30);
  const [cfgRetryAttempts, setCfgRetryAttempts] = useState(3);
  const [savingConfig, setSavingConfig] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedCliKey, setCopiedCliKey] = useState<string | null>(null);
  const [cutoverResult, setCutoverResult] = useState<AdminPaymentCutoverCheckResult | null>(null);
  const [runningCutover, setRunningCutover] = useState(false);

  const flashNotice = (type: 'ok' | 'err', text: string) => {
    setActionMsg({ type, text });
    window.setTimeout(() => setActionMsg(null), 5000);
  };

  const loadAnalyticsAndPayments = useCallback(async () => {
    setLoading(true);
    try {
      const [anRes, payRes] = await Promise.all([
        fetchAdminPaymentAnalytics(),
        fetchAdminPayments({
          page,
          pageSize: 20,
          status: statusFilter || undefined,
          method: methodFilter || undefined,
          search: search.trim() || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        }),
      ]);
      if (anRes.ok && anRes.data) setAnalytics(anRes.data);
      if (payRes.ok && payRes.data) {
        setPayments(payRes.data.items || []);
        setTotalPages(Math.max(1, payRes.data.pagination?.totalPages || 1));
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, methodFilter, search, fromDate, toDate]);

  const loadRefunds = useCallback(async () => {
    const res = await fetchAdminPaymentRefunds();
    if (res.ok && res.data) {
      setGatewayRefunds(Array.isArray(res.data) ? res.data : []);
    }
  }, []);

  const loadWebhooks = useCallback(async () => {
    const res = await fetchAdminPaymentWebhooks({
      processingStatus: webhookStatusFilter || undefined,
      limit: 60,
    });
    if (res.ok && res.data) {
      setWebhooks(Array.isArray(res.data) ? res.data : []);
    }
  }, [webhookStatusFilter]);

  const loadConfig = useCallback(async () => {
    const res = await fetchAdminPaymentConfig();
    if (res.ok && res.data) {
      setGatewayConfig(res.data);
      setCfgMode(res.data.mode);
      setCfgVersion(res.data.apiVersion || '2023-08-01');
      setCfgEnabled(res.data.isEnabled);
      setCfgAutoVerify(res.data.autoVerify);
      setCfgExpiryMins(res.data.orderExpiryMinutes || 30);
      setCfgRetryAttempts(res.data.retryAttempts || 3);
    }
  }, []);

  useEffect(() => {
    void loadAnalyticsAndPayments();
  }, [loadAnalyticsAndPayments]);

  useEffect(() => {
    if (subTab === 'refunds') void loadRefunds();
    if (subTab === 'webhooks') void loadWebhooks();
    if (subTab === 'config') void loadConfig();
  }, [subTab, loadRefunds, loadWebhooks, loadConfig]);

  const handleVerifyOrder = async (orderId: string) => {
    const res = await verifyCashfreePaymentOrder(orderId);
    if (res.ok && res.data) {
      flashNotice(
        'ok',
        `Order ${orderId} synced: ${res.data.orderStatus}${res.data.cfPaymentId ? ` (Ref ${res.data.cfPaymentId})` : ''}.`
      );
      void loadAnalyticsAndPayments();
    } else {
      flashNotice('err', res.message || `Failed to verify ${orderId}.`);
    }
  };

  const handleInspectOrder = async (orderId: string) => {
    const res = await fetchPaymentOrderDetail(orderId);
    if (res.ok && res.data) {
      setInspectDetail({ orderId, data: res.data });
    } else {
      flashNotice('err', res.message || 'Unable to inspect order details.');
    }
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundModalOrder) return;
    const maxRefundable = Math.max(0, refundModalOrder.paidAmountInr - refundModalOrder.refundedInr);
    const parsedAmount = Number(refundAmountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > maxRefundable) {
      flashNotice('err', `Enter a refund amount between ₹1 and ₹${maxRefundable}.`);
      return;
    }
    setRefundSubmitting(true);
    try {
      const res = await executeOrderRefund(refundModalOrder.orderId, {
        refundAmount: parsedAmount,
        refundSpeed,
        reason: refundReason.trim() || 'Admin initiated Cashfree refund',
      });
      if (res.ok && res.data) {
        flashNotice(
          'ok',
          `Refund ${res.data.refundId} submitted (${res.data.refundStatus}) for ₹${res.data.refundedAmount}.`
        );
        setRefundModalOrder(null);
        void loadAnalyticsAndPayments();
        void loadRefunds();
      } else {
        flashNotice('err', res.message || 'Cashfree refund execution failed.');
      }
    } finally {
      setRefundSubmitting(false);
    }
  };

  const handleRunReconcile = async () => {
    setReconcileSummary(null);
    const res = await runAdminPaymentReconcile(25);
    if (res.ok && res.data) {
      setReconcileSummary(
        `Checked ${res.data.checkedCount} pending orders · Reconciled Paid: ${res.data.reconciledPaidCount} · Marked Failed/Expired: ${res.data.updatedFailedCount}`
      );
      void loadAnalyticsAndPayments();
      void loadWebhooks();
    } else {
      flashNotice('err', res.message || 'Reconciliation sweep failed.');
    }
  };

  const handleReplayWebhook = async (eventId: string) => {
    const res = await replayAdminPaymentWebhook(eventId);
    if (res.ok) {
      flashNotice('ok', `Webhook event ${eventId} replayed cleanly.`);
      void loadWebhooks();
      void loadAnalyticsAndPayments();
    } else {
      flashNotice('err', res.message || `Webhook replay failed for ${eventId}.`);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await saveAdminPaymentConfig({
        mode: cfgMode,
        apiVersion: cfgVersion,
        isEnabled: cfgEnabled,
        autoVerify: cfgAutoVerify,
        orderExpiryMinutes: cfgExpiryMins,
        retryAttempts: cfgRetryAttempts,
      });
      if (res.ok && res.data) {
        setGatewayConfig(res.data);
        flashNotice('ok', `Cashfree gateway settings updated (${res.data.mode.toUpperCase()} · ${res.data.apiVersion}).`);
      } else {
        flashNotice('err', res.message || 'Failed to save gateway config.');
      }
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRunCutoverCheck = async () => {
    setRunningCutover(true);
    try {
      const res = await runAdminPaymentCutoverCheck();
      if (res.ok && res.data) {
        setCutoverResult(res.data);
        flashNotice(
          res.data.readyForProduction ? 'ok' : 'err',
          res.data.readyForProduction
            ? 'All Cashfree production cutover checks passed cleanly.'
            : 'Cutover diagnostics completed — resolve pending items below.'
        );
      } else {
        flashNotice('err', res.message || 'Unable to run cutover diagnostics.');
      }
    } finally {
      setRunningCutover(false);
    }
  };

  const copyCliText = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedCliKey(key);
    window.setTimeout(() => setCopiedCliKey(null), 2000);
  };

  const displayRows =
    payments.length > 0
      ? payments
      : transactions.map((t) => ({
          order_id: t.orderId,
          application_id: t.applicationId,
          customer_name: t.userName,
          service_name: t.serviceName,
          total_amount_paise: Math.round((t.amount || 0) * 100),
          refunded_amount_paise: 0,
          status: t.status === 'Success' ? 'PAID' : t.status.toUpperCase(),
          payment_status_normalized: t.status === 'Success' ? 'PAID' : 'FAILED',
          payment_method: t.paymentMethod,
          invoice_number: t.receiptNumber,
          created_at: t.transactionDate,
        }));

  return (
    <div className="space-y-6">
      {/* Header + Sub-Tab Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Cashfree Payments, Refunds &amp; Reconciliation Console
          </h2>
          <p className="text-xs text-slate-500">
            Production &amp; Sandbox gateway analytics, live order verification, partial/full refunds, webhook replay, and configuration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
          {(
            [
              { id: 'overview', label: 'Transactions' },
              { id: 'refunds', label: `Refunds (${refunds.filter((r) => r.status === 'Pending').length})` },
              { id: 'webhooks', label: 'Webhooks & Reconcile' },
              { id: 'config', label: 'Gateway Config' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                subTab === tab.id
                  ? 'bg-[#FF671F] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {actionMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
            actionMsg.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-[#138808] dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}
        >
          {actionMsg.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase text-slate-400">Total Collected</div>
          <div className="text-xl font-black text-[#138808] dark:text-emerald-400 font-mono mt-1">
            {formatInr(
              analytics?.totalCollectedInr ??
                transactions.reduce((acc, t) => acc + (t.status === 'Success' ? t.amount : 0), 0)
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Today: {formatInr(analytics?.todayCollectedInr ?? 0)} · Month: {formatInr(analytics?.monthCollectedInr ?? 0)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase text-slate-400">Net Revenue</div>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
            {formatInr(analytics?.netRevenueInr ?? 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Avg Ticket: {formatInr(analytics?.averageTicketInr ?? 0)} · {analytics?.paidCount ?? 0} Paid
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase text-slate-400">Refunds Executed</div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
            {formatInr(analytics?.totalRefundedInr ?? 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Unresolved Queue: {analytics?.unresolvedRefundsCount ?? refunds.filter((r) => r.status === 'Pending').length}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase text-slate-400">Attention / Webhooks</div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1">
            {analytics?.failedWebhooksCount ?? 0} Failed Webhooks
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Pending: {analytics?.pendingCount ?? 0} · Failed/Expired: {analytics?.failedOrExpiredCount ?? 0}
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: TRANSACTIONS */}
      {subTab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center gap-2.5 text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search orderId, applicationId, CF Ref, UTR..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs"
            >
              <option value="">All Statuses</option>
              <option value="PAID">Paid</option>
              <option value="INITIATED">Initiated / Created</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="EXPIRED">Expired</option>
              <option value="USER_DROPPED">User Dropped</option>
              <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
              <option value="REFUNDED">Refunded</option>
            </select>

            <select
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs"
            >
              <option value="">All Methods</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="NETBANKING">NetBanking</option>
            </select>

            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-xs"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-xs"
            />

            <button
              type="button"
              onClick={() => void loadAnalyticsAndPayments()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-2xs">
            <table className="w-full min-w-[780px] text-xs text-left tabular-nums">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Order / App ID</th>
                  <th className="p-3.5">Customer &amp; Service</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Method &amp; UTR</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No payment orders match the selected filters.
                    </td>
                  </tr>
                ) : (
                  displayRows.map((row) => {
                    const orderId = row.order_id;
                    const amountInr = Math.round((Number(row.total_amount_paise || 0) / 100) * 100) / 100;
                    const refundedInr = Math.round((Number(row.refunded_amount_paise || 0) / 100) * 100) / 100;
                    const normState = String(row.payment_status_normalized || row.status || '').toUpperCase();
                    const isPaid = normState === 'PAID' || normState === 'PARTIALLY_REFUNDED';
                    const canRefund = isPaid && amountInr - refundedInr > 0.5;

                    return (
                      <tr key={orderId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3.5 align-top">
                          <div className="font-mono font-bold text-slate-900 dark:text-white">{orderId}</div>
                          <div className="font-mono text-[11px] text-[#FF671F]">{row.application_id}</div>
                          {row.cf_payment_id && (
                            <div className="font-mono text-[10px] text-slate-400">CF {row.cf_payment_id}</div>
                          )}
                        </td>
                        <td className="p-3.5 align-top">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {row.customer_name || 'Applicant'}
                          </div>
                          <div className="text-slate-600 dark:text-slate-300 truncate max-w-[220px]">
                            {row.service_name || 'Service Order'}
                          </div>
                        </td>
                        <td className="p-3.5 align-top">
                          <div className="font-mono font-bold text-emerald-800 dark:text-emerald-400">
                            {formatInr(amountInr)}
                          </div>
                          {refundedInr > 0 && (
                            <div className="font-mono text-[10px] text-amber-600">
                              Refunded {formatInr(refundedInr)}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 align-top">
                          <div>{row.payment_method || 'Cashfree'}</div>
                          {row.bank_reference && (
                            <div className="font-mono text-[10px] text-slate-400">UTR {row.bank_reference}</div>
                          )}
                        </td>
                        <td className="p-3.5 align-top">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              normState === 'PAID'
                                ? 'bg-green-100 text-[#138808]'
                                : normState.includes('REFUND')
                                ? 'bg-amber-100 text-amber-800'
                                : normState === 'FAILED' || normState === 'EXPIRED'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {normState}
                          </span>
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap align-top">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleInspectOrder(orderId)}
                              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspect</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleVerifyOrder(orderId)}
                              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-[#FF671F] hover:bg-orange-50 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              Verify
                            </button>
                            {canRefund && (
                              <button
                                type="button"
                                onClick={() => {
                                  const maxAvail = Math.max(0, amountInr - refundedInr);
                                  setRefundModalOrder({
                                    orderId,
                                    paidAmountInr: amountInr,
                                    refundedInr,
                                    applicantName: row.customer_name,
                                  });
                                  setRefundAmountInput(String(maxAvail));
                                }}
                                className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                              >
                                Refund
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 cursor-pointer"
              >
                Prev
              </button>
              <span className="font-mono">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: REFUNDS */}
      {subTab === 'refunds' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Customer Refund Requests Queue ({refunds.length})
            </h3>
            {refunds.length === 0 ? (
              <p className="text-slate-500">No customer refund requests submitted yet.</p>
            ) : (
              <div className="space-y-2.5">
                {refunds.map((rf) => (
                  <div
                    key={rf.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div>
                      <div className="font-mono font-bold text-[#FF671F]">
                        {rf.id} · Order {rf.orderId} · ₹{rf.amountInr}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">
                        App: {rf.applicationId} · Reason: {rf.reason}
                      </div>
                      <div className="text-[11px] text-slate-400">Status: {rf.status}</div>
                    </div>
                    {rf.status === 'Pending' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onProcessRefundRequest(rf.id, 'Processed')}
                          className="bg-[#138808] text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                        >
                          Approve &amp; Execute Cashfree Refund
                        </button>
                        <button
                          type="button"
                          onClick={() => onProcessRefundRequest(rf.id, 'Rejected')}
                          className="bg-red-600 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Cashfree Refunds Ledger ({gatewayRefunds.length})
              </h3>
              <button
                type="button"
                onClick={() => void loadRefunds()}
                className="text-xs font-semibold text-[#FF671F] hover:underline cursor-pointer"
              >
                Refresh Ledger
              </button>
            </div>
            {gatewayRefunds.length === 0 ? (
              <p className="text-slate-500">No gateway refunds executed in D1 ledger yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[660px] text-xs text-left tabular-nums">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Refund ID / CF Ref</th>
                      <th className="p-2.5">Order ID</th>
                      <th className="p-2.5">Amount</th>
                      <th className="p-2.5">Status / ARN</th>
                      <th className="p-2.5">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {gatewayRefunds.map((gr) => (
                      <tr key={gr.id}>
                        <td className="p-2.5 font-mono">
                          <div className="font-bold">{gr.refund_id || gr.id}</div>
                          {gr.cf_refund_id && <div className="text-[10px] text-slate-400">CF {gr.cf_refund_id}</div>}
                        </td>
                        <td className="p-2.5 font-mono">{gr.order_id}</td>
                        <td className="p-2.5 font-mono font-bold">
                          {formatInr((Number(gr.refund_amount_paise || 0) || 0) / 100)}
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-[10px]">
                            {gr.gateway_status || gr.status}
                          </span>
                          {gr.refund_arn && (
                            <div className="font-mono text-[10px] text-slate-400 mt-0.5">ARN {gr.refund_arn}</div>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">{gr.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: WEBHOOKS & RECONCILE */}
      {subTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              {(['', 'PROCESSED', 'FAILED'] as const).map((status) => (
                <button
                  key={status || 'ALL'}
                  type="button"
                  onClick={() => setWebhookStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                    webhookStatusFilter === status
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {status || 'ALL WEBHOOKS'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void handleRunReconcile()}
              className="inline-flex items-center gap-1.5 bg-[#138808] hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Run Cashfree Reconciliation Sweep</span>
            </button>
          </div>

          {reconcileSummary && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-[#138808] dark:text-emerald-300">
              {reconcileSummary}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs text-left tabular-nums">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Event ID &amp; Type</th>
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Signature</th>
                  <th className="p-3">Status &amp; Error</th>
                  <th className="p-3 text-right">Replay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {webhooks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No webhook events recorded yet.
                    </td>
                  </tr>
                ) : (
                  webhooks.map((wh) => (
                    <tr key={wh.id || wh.event_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono">
                        <div className="font-bold text-slate-900 dark:text-white">{wh.event_id}</div>
                        <div className="text-[11px] text-slate-500">{wh.event_type}</div>
                      </td>
                      <td className="p-3 font-mono">{wh.order_id}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            wh.signature_verified
                              ? 'bg-emerald-100 text-[#138808]'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {wh.signature_verified ? 'VERIFIED' : 'INVALID'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-[11px]">{wh.processing_status || 'PROCESSED'}</div>
                        {wh.processing_error && (
                          <div className="text-[11px] text-rose-600 max-w-xs truncate">{wh.processing_error}</div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => void handleReplayWebhook(wh.event_id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Replay</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: GATEWAY CONFIG */}
      {subTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <form
            onSubmit={handleSaveConfig}
            className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
              <Settings className="w-4 h-4 text-[#FF671F]" />
              <span>Cashfree Runtime Settings</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Environment Mode</label>
                <select
                  value={cfgMode}
                  onChange={(e) => setCfgMode(e.target.value as 'sandbox' | 'production')}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2"
                >
                  <option value="production">Production (api.cashfree.com)</option>
                  <option value="sandbox">Sandbox (sandbox.cashfree.com)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Cashfree API Version</label>
                <select
                  value={cfgVersion}
                  onChange={(e) => setCfgVersion(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono"
                >
                  <option value="2023-08-01">2023-08-01 (Configured)</option>
                  <option value="2025-01-01">2025-01-01</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Order Expiry (Minutes)</label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={cfgExpiryMins}
                  onChange={(e) => setCfgExpiryMins(Number(e.target.value) || 30)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Max Retry Attempts</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={cfgRetryAttempts}
                  onChange={(e) => setCfgRetryAttempts(Number(e.target.value) || 3)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfgEnabled}
                  onChange={(e) => setCfgEnabled(e.target.checked)}
                  className="accent-[#FF671F]"
                />
                <span>Gateway Enabled (Accept New Orders)</span>
              </label>

              <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfgAutoVerify}
                  onChange={(e) => setCfgAutoVerify(e.target.checked)}
                  className="accent-[#FF671F]"
                />
                <span>Auto-Verify Pending Orders on Callback</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {savingConfig ? 'Saving Settings...' : 'Save Cashfree Config'}
            </button>
          </form>

          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
              <ShieldCheck className="w-4 h-4 text-[#138808]" />
              <span>Worker Secrets &amp; Endpoint Readiness</span>
            </div>

            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-xl font-mono text-[11px]">
              <div className="flex justify-between">
                <span>CASHFREE_CLIENT_ID:</span>
                <span className={gatewayConfig?.clientIdConfigured ? 'text-[#138808] font-bold' : 'text-amber-600'}>
                  {gatewayConfig?.clientIdConfigured ? gatewayConfig.clientIdMasked : 'Missing'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>CASHFREE_CLIENT_SECRET:</span>
                <span className={gatewayConfig?.clientSecretConfigured ? 'text-[#138808] font-bold' : 'text-rose-600 font-bold'}>
                  {gatewayConfig?.clientSecretConfigured ? 'Bound in Worker Secrets' : 'Not Bound Yet'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Webhook Secret:</span>
                <span className={gatewayConfig?.webhookSecretConfigured ? 'text-[#138808]' : 'text-slate-500'}>
                  {gatewayConfig?.webhookSecretConfigured ? 'Configured' : 'Using Client Secret'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Payments Sender:</span>
                <span>{gatewayConfig?.paymentsEmail || 'payments@digitalindiaproject.com'}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                Cashfree Dashboard Webhook URL
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={gatewayConfig?.webhookUrl || 'https://digitalindiaproject.com/api/webhooks/cashfree'}
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const url = gatewayConfig?.webhookUrl || 'https://digitalindiaproject.com/api/webhooks/cashfree';
                    void navigator.clipboard?.writeText(url);
                    setCopiedWebhook(true);
                    window.setTimeout(() => setCopiedWebhook(false), 2000);
                  }}
                  className="px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              {copiedWebhook && <div className="text-[11px] text-[#138808] font-semibold">Webhook URL copied</div>}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              API secrets (`CASHFREE_CLIENT_SECRET`, `CASHFREE_WEBHOOK_SECRET`, `RESEND_API_KEY`) must be managed exclusively in Cloudflare Dashboard Workers &amp; Pages Secrets — never entered in browser forms.
            </p>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  Live Cutover Diagnostics
                </span>
                <button
                  type="button"
                  onClick={() => void handleRunCutoverCheck()}
                  disabled={runningCutover}
                  className="inline-flex items-center gap-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-[11px] px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 ${runningCutover ? 'animate-spin' : ''}`} />
                  <span>{runningCutover ? 'Probing Gateway...' : 'Run Live Cutover Check'}</span>
                </button>
              </div>

              {cutoverResult && (
                <div className="space-y-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span>
                      Status:{' '}
                      <span className={cutoverResult.readyForProduction ? 'text-[#138808]' : 'text-amber-600'}>
                        {cutoverResult.readyForProduction ? 'PRODUCTION READY' : 'ACTION REQUIRED'}
                      </span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {cutoverResult.probe.latencyMs > 0 ? `${cutoverResult.probe.latencyMs}ms probe` : cutoverResult.mode.toUpperCase()}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {cutoverResult.checks.map((item) => (
                      <div key={item.key} className="text-[11px] border-t border-slate-200/70 dark:border-slate-700/70 pt-1.5">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-slate-800 dark:text-slate-200">{item.label}</span>
                          <span
                            className={`font-mono text-[10px] font-bold uppercase ${
                              item.status === 'pass'
                                ? 'text-[#138808]'
                                : item.status === 'warn'
                                ? 'text-amber-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5 text-[11px]">
                <div className="font-semibold text-slate-700 dark:text-slate-300">
                  Cashfree Webhook Events to Enable
                </div>
                <div className="font-mono text-[10px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5 space-y-0.5">
                  <div>• PAYMENT_SUCCESS_WEBHOOK</div>
                  <div>• PAYMENT_FAILED_WEBHOOK</div>
                  <div>• PAYMENT_USER_DROPPED_WEBHOOK</div>
                  <div>• REFUND_STATUS_WEBHOOK</div>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="font-semibold text-slate-700 dark:text-slate-300">
                  Worker Secret &amp; D1 CLI Commands
                </div>
                {[
                  { key: 'secret', cmd: 'npx wrangler secret put CASHFREE_CLIENT_SECRET' },
                  { key: 'd1', cmd: 'npm run d1:migrate:remote' },
                ].map((row) => (
                  <div key={row.key} className="flex items-center gap-1.5">
                    <code className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-[10px] truncate">
                      {row.cmd}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyCliText(row.key, row.cmd)}
                      className="px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer text-[10px]"
                      title="Copy command"
                    >
                      {copiedCliKey === row.key ? 'Copied' : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Order Modal */}
      {inspectDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-3 max-h-[85vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-mono font-bold text-sm">Order Inspector — {inspectDetail.orderId}</h4>
              <button type="button" onClick={() => setInspectDetail(null)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl overflow-x-auto font-mono text-[11px]">
              {JSON.stringify(inspectDetail.data, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSubmitRefund}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Execute Cashfree Refund — {refundModalOrder.orderId}
              </h4>
              <button type="button" onClick={() => setRefundModalOrder(null)} className="p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 font-mono text-[11px] space-y-1">
              <div>Applicant: {refundModalOrder.applicantName || 'Citizen'}</div>
              <div>Paid Total: {formatInr(refundModalOrder.paidAmountInr)}</div>
              <div>
                Remaining Refundable:{' '}
                {formatInr(Math.max(0, refundModalOrder.paidAmountInr - refundModalOrder.refundedInr))}
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Refund Amount (INR)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                max={Math.max(1, refundModalOrder.paidAmountInr - refundModalOrder.refundedInr)}
                required
                value={refundAmountInput}
                onChange={(e) => setRefundAmountInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Refund Speed</label>
              <select
                value={refundSpeed}
                onChange={(e) => setRefundSpeed(e.target.value as 'STANDARD' | 'INSTANT')}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2"
              >
                <option value="STANDARD">STANDARD (5–7 Business Days)</option>
                <option value="INSTANT">INSTANT (If enabled on Cashfree account)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">Audit Reason</label>
              <textarea
                rows={2}
                required
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundModalOrder(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={refundSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer disabled:opacity-50"
              >
                {refundSubmitting ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

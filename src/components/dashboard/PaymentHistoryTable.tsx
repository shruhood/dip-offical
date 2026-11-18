import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import type { Application, PaymentTransaction, RefundRecord } from '../../types';
import { fetchPaymentHistoryPage } from '../../services/backendApi';
import {
  buildPaymentHistoryEntries,
  formatPaymentHistoryCsv,
  paginatePaymentHistoryEntries,
  type ApplicationPaymentStatusItem,
  type BackendPaymentHistoryRecord,
  type PaymentHistoryEntry,
  type PaymentUiStatus,
} from '../../lib/paymentStatus';
import { PaymentStatus } from './PaymentStatus';

export type PaymentHistoryFilter = 'all' | PaymentUiStatus;

export interface PaymentHistoryTableProps {
  applications: Application[];
  transactions?: PaymentTransaction[];
  refunds?: RefundRecord[];
  statusMap?: Record<string, ApplicationPaymentStatusItem>;
  externalStatusFilter?: PaymentHistoryFilter;
  onStatusFilterChange?: (filter: PaymentHistoryFilter) => void;
  defaultPageSize?: 5 | 10 | 20;
  title?: string;
  onSelectApplication?: (app: Application) => void;
  onPrintReceipt?: (entry: PaymentHistoryEntry) => void;
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
  onStartNewApplication?: () => void;
  onOpenFullLedger?: () => void;
}

function formatInr(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatTransactionDate(isoDate: string): { datePart: string; timePart: string } {
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

export const PaymentHistoryTable: React.FC<PaymentHistoryTableProps> = ({
  applications,
  transactions = [],
  refunds = [],
  statusMap = {},
  externalStatusFilter,
  onStatusFilterChange,
  defaultPageSize = 5,
  title = 'Payment History',
  onSelectApplication,
  onPrintReceipt,
  onRequestRefund,
  onRetryPayment,
  onStartNewApplication,
  onOpenFullLedger,
}) => {
  const [backendRecords, setBackendRecords] = useState<BackendPaymentHistoryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const [internalFilter, setInternalFilter] = useState<PaymentHistoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  const statusFilter = externalStatusFilter ?? internalFilter;
  const handleFilterChange = (next: PaymentHistoryFilter) => {
    setInternalFilter(next);
    setPage(1);
    onStatusFilterChange?.(next);
  };

  useEffect(() => {
    setPage(1);
  }, [externalStatusFilter]);

  const loadBackendHistory = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setRefreshing(true);
    setErrorMsg(null);

    try {
      const res = await fetchPaymentHistoryPage({ page: 1, pageSize: 100 });
      if (!res.ok) {
        setErrorMsg(res.message || 'Unable to sync backend payment ledger.');
      } else {
        setBackendRecords(res.data.items);
        setLastFetchedAt(new Date().toISOString());
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error while fetching past transactions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadBackendHistory(true);
  }, [loadBackendHistory]);

  const allEntries = useMemo(
    () =>
      buildPaymentHistoryEntries({
        applications,
        transactions,
        statusMap,
        backendHistory: backendRecords,
      }),
    [applications, transactions, statusMap, backendRecords]
  );

  const statusCounts = useMemo(() => {
    let paid = 0;
    let pending = 0;
    let failed = 0;
    for (const entry of allEntries) {
      if (entry.uiStatus === 'Paid') paid += 1;
      else if (entry.uiStatus === 'Failed') failed += 1;
      else pending += 1;
    }
    return { all: allEntries.length, paid, pending, failed };
  }, [allEntries]);

  const paginated = useMemo(
    () =>
      paginatePaymentHistoryEntries({
        entries: allEntries,
        page,
        pageSize,
        statusFilter,
        searchQuery,
      }),
    [allEntries, page, pageSize, statusFilter, searchQuery]
  );

  // Keep current page clamped if totalPages shrinks after filtering
  useEffect(() => {
    if (page !== paginated.pagination.page) {
      setPage(paginated.pagination.page);
    }
  }, [page, paginated.pagination.page]);

  const handleCopyTransactionId = async (txId: string) => {
    try {
      await navigator.clipboard?.writeText(txId);
    } catch {
      // Clipboard API may be restricted in embedded preview iframes
    }
    setCopiedTxId(txId);
    window.setTimeout(() => {
      setCopiedTxId((prev) => (prev === txId ? null : prev));
    }, 1800);
  };

  const handleExportCsv = () => {
    const filteredEntries = paginatePaymentHistoryEntries({
      entries: allEntries,
      page: 1,
      pageSize: 100,
      statusFilter,
      searchQuery,
    }).items;
    const csv = formatPaymentHistoryCsv(filteredEntries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payment-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const showActionsColumn = Boolean(onPrintReceipt || onRequestRefund);
  const { page: currentPage, totalPages, totalItems, hasNextPage, hasPrevPage } =
    paginated.pagination;
  const startRow = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, totalItems);

  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }
    const half = Math.floor(maxButtons / 2);
    let start = Math.max(1, currentPage - half);
    const end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  }, [currentPage, totalPages]);

  const filterTabs: Array<{ key: PaymentHistoryFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: statusCounts.all },
    { key: 'Paid', label: 'Paid', count: statusCounts.paid },
    { key: 'Pending', label: 'Pending', count: statusCounts.pending },
    { key: 'Failed', label: 'Failed', count: statusCounts.failed },
  ];

  return (
    <section
      aria-label={title}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
    >
      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              <span>
                {totalItems} {totalItems === 1 ? 'Transaction' : 'Transactions'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Settled{' '}
                <strong className="font-mono text-slate-800 dark:text-slate-200">
                  {formatInr(paginated.filteredTotalPaidAmount)}
                </strong>
              </span>
              {lastFetchedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[11px]">
                    Updated{' '}
                    {new Date(lastFetchedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {totalItems > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                aria-label="Export transactions CSV"
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void loadBackendHistory(false)}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>

            {onOpenFullLedger && (
              <button
                type="button"
                onClick={onOpenFullLedger}
                className="text-xs font-bold text-[#FF671F] hover:underline whitespace-nowrap cursor-pointer"
              >
                Open Ledger →
              </button>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div
            role="tablist"
            aria-label="Filter transactions by status"
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto scrollbar-none self-start"
          >
            {filterTabs.map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleFilterChange(tab.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              );
            })}
          </div>

          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search Txn ID, Order, Service..."
              aria-label="Search past transactions"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#FF671F]"
            />
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-[#D97706] dark:text-amber-400 shrink-0" />
              <span className="truncate">{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadBackendHistory(false)}
              className="font-bold underline shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Table Body: Loading / Empty / Data */}
      {loading && allEntries.length === 0 ? (
        <div className="divide-y divide-slate-100 dark:divide-slate-800" aria-busy="true">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4 animate-pulse"
            >
              <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3.5 w-44 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : paginated.items.length === 0 ? (
        <div className="px-4 sm:px-5 py-8 text-center text-xs space-y-2.5">
          <p className="font-bold text-slate-800 dark:text-slate-200">
            {allEntries.length === 0
              ? 'No past transactions recorded yet.'
              : 'No transactions match the selected filter or search query.'}
          </p>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {allEntries.length === 0
              ? 'Completed and attempted application payments will appear here with dates, amounts, and transaction IDs.'
              : 'Clear your status filter or search terms to view all recorded payment transactions.'}
          </p>
          {allEntries.length === 0 && onStartNewApplication && (
            <button
              type="button"
              onClick={onStartNewApplication}
              className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-4 py-2 rounded-lg text-xs cursor-pointer"
            >
              Start First Application
            </button>
          )}
          {allEntries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                handleFilterChange('all');
                setSearchQuery('');
              }}
              className="font-bold text-[#FF671F] hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs text-left tabular-nums">
            <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-2.5">
                  Date
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Transaction ID
                </th>
                <th scope="col" className="px-4 py-2.5 text-right">
                  Amount
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Status
                </th>
                {showActionsColumn && (
                  <th scope="col" className="px-4 py-2.5 text-right">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginated.items.map((entry) => {
                const { datePart, timePart } = formatTransactionDate(entry.date);
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

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {entry.serviceName}
                        </span>
                        <span aria-hidden="true">·</span>
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
                        {showDistinctOrder && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">Order {entry.orderId}</span>
                          </>
                        )}
                        {entry.bankReference && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">UTR {entry.bankReference}</span>
                          </>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap align-top">
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                        {formatInr(entry.amount)}
                      </span>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {entry.paymentMethod}
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap align-top">
                      <PaymentStatus status={entry.uiStatus} size="sm" />
                    </td>

                    {showActionsColumn && (
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

      {/* Pagination Footer */}
      {totalItems > 0 && (
        <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs tabular-nums">
          <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
            <span>
              Showing <strong className="text-slate-900 dark:text-white">{startRow}–{endRow}</strong> of{' '}
              <strong className="text-slate-900 dark:text-white">{totalItems}</strong>
            </span>
            <label className="inline-flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">Rows:</span>
              <select
                aria-label="Transactions per page"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#FF671F]"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </label>
          </div>

          <nav aria-label="Payment history pagination" className="flex items-center gap-1 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrevPage}
              aria-label="Previous page"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            {pageNumbers.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setPage(num)}
                aria-current={num === currentPage ? 'page' : undefined}
                className={`min-w-[30px] px-2.5 py-1.5 rounded-lg font-mono font-bold text-xs transition-colors cursor-pointer ${
                  num === currentPage
                    ? 'bg-[#FF671F] text-white'
                    : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={!hasNextPage}
              aria-label="Next page"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </nav>
        </div>
      )}
    </section>
  );
};

export default PaymentHistoryTable;

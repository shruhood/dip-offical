import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData, ApplicationDraft } from '../../context/DataContext';
import { Application, ApplicationStatus, SupportTicket } from '../../types';
import {
  LayoutDashboard,
  FileCheck2,
  FolderOpen,
  CreditCard,
  Headphones,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  ChevronRight,
  LogOut,
  FileText,
  X,
  Bell,
  Save,
  Trash2,
  XCircle,
  Mail,
  Calculator,
  Printer,
  ShieldCheck,
  Wrench,
  Crown,
  Ticket,
  Bookmark,
  ArrowUpRight,
  History,
  RotateCcw,
  Search,
} from 'lucide-react';
import { useToolTray } from '../../context/ToolTrayContext';
import { getToolBySlug, TOOLS_REGISTRY } from '../../data/toolsRegistry';
import {
  getPlanDefinition,
  getToolSingleUsePriceInr,
  hasPlanAccessForTier,
  TOOL_SINGLE_USE_PRICE_INR,
} from '../../data/toolPlans';
import type { PaidToolPurchaseRecord, ToolDefinition } from '../../types/tool';
import { CashfreeModal } from '../../components/payment/CashfreeModal';
import {
  getApplicationProgress,
  getKycVerificationProgress,
} from '../../lib/workflow';
import {
  ApplicationProgressTracker,
  KycVerificationProgressBanner,
} from '../../components/dashboard/StatusProgressBars';
import { PaymentStatus } from '../../components/dashboard/PaymentStatus';
import {
  PaymentStatusOverview,
  type PaymentOverviewFilter,
} from '../../components/dashboard/PaymentStatusOverview';
import { PaymentTrendCard } from '../../components/dashboard/PaymentTrendCard';
import { PaymentHistoryTable } from '../../components/dashboard/PaymentHistoryTable';
const PaymentTrendChart = React.lazy(() =>
  import('../../components/dashboard/PaymentTrendChart').then((m) => ({
    default: m.PaymentTrendChart,
  }))
);
const BillingSummary = React.lazy(() =>
  import('../../components/dashboard/BillingSummary').then((m) => ({
    default: m.BillingSummary,
  }))
);
import { TaxComplianceEstimator } from '../../components/dashboard/TaxComplianceEstimator';
import {
  CardGridSkeleton,
  InlineSkeletonPulse,
} from '../../components/common/SkeletonLoaders';
import { SwipeableActionItem } from '../../components/common/SwipeableActionItem';
import type {
  ApplicationPaymentStatusItem,
  PaymentHistoryEntry,
} from '../../lib/paymentStatus';
import {
  deriveInitialPaymentUiStatus,
  toPaymentBadgeStatus,
} from '../../lib/paymentStatus';
import {
  createVaultItem,
  deleteVaultItem,
  downloadAuthorizedDigitalProduct,
  fetchCustomerVault,
  issueSignedFileDownloadUrl,
  uploadFileToR2,
  type CustomerVaultItemRecord,
} from '../../services/backendApi';
import { generateDigitalProductPayload } from '../../data/catalogue/digitalGenerators';

interface CustomerDashboardProps {
  initialTab?: string;
  onNavigate: (route: string, param?: string) => void;
  onStartNewApplication: () => void;
  onResumeDraft?: (draft: ApplicationDraft) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  initialTab = 'overview',
  onNavigate,
  onStartNewApplication,
  onResumeDraft,
}) => {
  const { user, logout } = useAuth();
  const {
    applications,
    services,
    digitalOrders,
    quoteRequests,
    drafts,
    deleteDraft,
    transactions,
    refunds,
    tickets,
    notifications,
    operatorEnrollments,
    partners,
    businessSettings,
    createTicket,
    replyTicket,
    uploadAdditionalDocument,
    syncApplicationPaymentStatus,
    recordProductDownload,
    requestRefund,
    updateApplicationStatus,
    markNotificationRead,
    markAllNotificationsRead,
  } = useData();
  const {
    plan,
    planDefinition,
    billingCycle,
    creditsRemaining,
    dailyJobsUsed,
    lastSubscription,
    activeSingleUsePassList,
    favourites,
    history,
    paidToolHistory,
    getRemainingSingleUsePasses,
    grantSingleUsePass,
    setTrayOpen,
  } = useToolTray();
  const dailyJobsRemaining =
    planDefinition.dailyJobLimit === null
      ? null
      : Math.max(0, planDefinition.dailyJobLimit - dailyJobsUsed);

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentOverviewFilter, setPaymentOverviewFilter] = useState<PaymentOverviewFilter>('all');
  const [usageHistoryFilter, setUsageHistoryFilter] = useState<'all' | 'one_time' | 'subscription'>('all');
  const [usageHistoryQuery, setUsageHistoryQuery] = useState('');
  const [reaccessCheckoutTool, setReaccessCheckoutTool] = useState<ToolDefinition | null>(null);
  const [retryCheckoutTarget, setRetryCheckoutTarget] = useState<{
    applicationId: string;
    orderId: string;
    amountInr: number;
    serviceName: string;
  } | null>(null);
  const [livePaymentStatusMap, setLivePaymentStatusMap] = useState<Record<string, ApplicationPaymentStatusItem>>({});
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [resubmitFile, setResubmitFile] = useState<File | null>(null);
  const [resubmitMsg, setResubmitMsg] = useState<string | null>(null);
  const [vaultNotice, setVaultNotice] = useState<string | null>(null);
  const [swipeNotice, setSwipeNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const canCitizenCancel = (status: ApplicationStatus) =>
    status === 'Draft' || status === 'Submitted' || status === 'Payment Pending';

  const handleSwipeCancelApplication = async (app: Application) => {
    const res = await updateApplicationStatus(
      app.id,
      'Cancelled',
      'Application cancelled by applicant via quick swipe action.',
      'Citizen initiated cancellation from Customer Dashboard',
      user?.name || 'Applicant',
      user?.role || 'customer'
    );
    if (!res.ok) {
      setSwipeNotice({ type: 'err', text: res.error || 'Could not cancel this application.' });
    } else {
      setSwipeNotice({ type: 'ok', text: `Application ${app.id} marked as Cancelled.` });
    }
    window.setTimeout(() => setSwipeNotice(null), 3500);
  };

  useEffect(() => {
    setActiveTab(initialTab || 'overview');
    setSelectedApp(null);
  }, [initialTab]);

  // Tickets
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('Application Status');
  const [ticketMsg, setTicketMsg] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState('');

  // Document Vault upload & D1 Vault records
  const [vaultUploadOpen, setVaultUploadOpen] = useState(false);
  const [vaultDocName, setVaultDocName] = useState('');
  const [vaultFile, setVaultFile] = useState<File | null>(null);
  const [vaultItems, setVaultItems] = useState<CustomerVaultItemRecord[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [invoiceEntry, setInvoiceEntry] = useState<PaymentHistoryEntry | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    setVaultLoading(true);
    void fetchCustomerVault()
      .then((res) => {
        if (active && res.ok && Array.isArray(res.data)) {
          setVaultItems(res.data);
        }
      })
      .catch(() => null)
      .finally(() => {
        if (active) setVaultLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleDownloadCompletionCertificate = async (app: Application) => {
    const rawUrl = app.completionFileUrl || '';
    const match = rawUrl.match(/\/api\/storage\/files\/([^/?#]+)/);
    const extractedId = match ? match[1] : undefined;
    if (extractedId) {
      const signed = await issueSignedFileDownloadUrl(extractedId);
      if (signed.ok && signed.data?.downloadUrl) {
        window.open(signed.data.downloadUrl, '_blank', 'noopener,noreferrer');
        setVaultNotice(`Opened signed download for "${app.completionFileName || 'Certificate'}".`);
        return;
      }
    }
    if (/^(https?:|blob:|data:)/i.test(rawUrl)) {
      window.open(rawUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setVaultNotice(
      app.completionFileName
        ? `Certificate "${app.completionFileName}" is recorded for ${app.id}; please check with Operations Desk for signed R2 archival.`
        : 'Completion certificate is not yet uploaded.'
    );
  };

  const userDrafts = drafts.filter((d) => !user?.id || d.userId === user.id || d.userId === 'guest');
  const userNotifications = notifications.filter((n) => !user?.id || n.userId === user.id);
  const unreadCount = userNotifications.filter((n) => !n.isRead).length;
  const unreadPaymentAlerts = userNotifications.filter(
    (n) => !n.isRead && (n.eventKey === 'PAYMENT_PAID' || n.eventKey === 'PAYMENT_FAILED')
  );

  // Scope strictly to the signed-in user's applications (unless Admin)
  const userApplications = applications.filter(
    (a) =>
      user?.role === 'admin' ||
      user?.role === 'super_admin' ||
      a.userId === user?.id ||
      (user?.email && a.userEmail.toLowerCase() === user.email.toLowerCase())
  );

  const userAppIdSet = new Set(userApplications.map((a) => a.id));
  const userTransactions = transactions.filter(
    (tx) =>
      user?.role === 'admin' ||
      user?.role === 'super_admin' ||
      tx.userId === user?.id ||
      (user?.email && tx.userEmail.toLowerCase() === user.email.toLowerCase()) ||
      userAppIdSet.has(tx.applicationId)
  );

  const activeSelectedApp = selectedApp
    ? userApplications.find((a) => a.id === selectedApp.id) || selectedApp
    : null;

  const allPaidToolRecords: PaidToolPurchaseRecord[] = React.useMemo(() => {
    const merged: PaidToolPurchaseRecord[] = [...paidToolHistory];
    for (const tx of userTransactions) {
      if (tx.status !== 'Success') continue;
      const appRef = tx.applicationId || '';
      const srvName = tx.serviceName || '';
      const isPassTx =
        appRef.startsWith('tool-pass:') ||
        srvName.includes('1-Time Tool Use Pass') ||
        srvName.includes('One-time Use');
      const isPlanTx =
        appRef.startsWith('tool-plan:') || srvName.startsWith('Digital Tools Tray —');
      if (!isPassTx && !isPlanTx) continue;

      const alreadyTracked = merged.some(
        (item) => tx.orderId && item.orderId && item.orderId === tx.orderId
      );
      if (alreadyTracked) continue;

      if (isPassTx) {
        const slugFromRef = appRef.startsWith('tool-pass:')
          ? appRef.slice('tool-pass:'.length).trim()
          : '';
        const matchedTool =
          (slugFromRef ? getToolBySlug(slugFromRef) : undefined) ||
          TOOLS_REGISTRY.find((t) => srvName.startsWith(t.name));
        const resolvedSlug = matchedTool?.slug || slugFromRef;
        merged.push({
          id: `tx_${tx.id}`,
          ownerUid: user?.id || 'guest',
          purchaseType: 'one_time',
          toolSlug: resolvedSlug || undefined,
          toolName: matchedTool?.name || srvName,
          categoryLabel: matchedTool?.categoryLabel,
          amountInr: tx.amount || TOOL_SINGLE_USE_PRICE_INR,
          orderId: tx.orderId,
          paymentMethod: tx.paymentMethod || 'Cashfree PG',
          purchasedAt: tx.transactionDate,
          usesGranted: 1,
          usesConsumed: resolvedSlug && getRemainingSingleUsePasses(resolvedSlug) > 0 ? 0 : 1,
        });
      } else if (isPlanTx) {
        const parts = appRef.startsWith('tool-plan:') ? appRef.split(':') : [];
        const rawCode = parts[1] || '';
        const rawCycle = parts[2] || '';
        const planCode =
          rawCode === 'personal' ||
          rawCode === 'csc' ||
          rawCode === 'professional' ||
          rawCode === 'enterprise'
            ? rawCode
            : srvName.toLowerCase().includes('professional')
            ? 'professional'
            : srvName.toLowerCase().includes('csc')
            ? 'csc'
            : 'personal';
        const matchedPlan = getPlanDefinition(planCode);
        merged.push({
          id: `tx_${tx.id}`,
          ownerUid: user?.id || 'guest',
          purchaseType: 'subscription',
          toolName: `${matchedPlan.name} Subscription`,
          categoryLabel: 'Tool Subscription',
          planCode,
          billingCycle:
            rawCycle === 'annual' || srvName.toLowerCase().includes('annual')
              ? 'annual'
              : 'monthly',
          amountInr: tx.amount || matchedPlan.priceMonthlyInr || 0,
          orderId: tx.orderId,
          paymentMethod: tx.paymentMethod || 'Cashfree PG',
          purchasedAt: tx.transactionDate,
          usesGranted: 1,
          usesConsumed: 0,
        });
      }
    }
    return merged.sort(
      (a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
    );
  }, [getRemainingSingleUsePasses, paidToolHistory, user?.id, userTransactions]);

  const filteredPaidToolRecords = React.useMemo(() => {
    const q = usageHistoryQuery.trim().toLowerCase();
    return allPaidToolRecords.filter((item) => {
      if (usageHistoryFilter !== 'all' && item.purchaseType !== usageHistoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.toolName.toLowerCase().includes(q) ||
        (item.categoryLabel && item.categoryLabel.toLowerCase().includes(q)) ||
        (item.orderId && item.orderId.toLowerCase().includes(q))
      );
    });
  }, [allPaidToolRecords, usageHistoryFilter, usageHistoryQuery]);

  const handleReaccessOneTimeTool = (record: PaidToolPurchaseRecord) => {
    if (!record.toolSlug) return;
    const matchedTool = getToolBySlug(record.toolSlug);
    const remaining = getRemainingSingleUsePasses(record.toolSlug);
    const coveredByPlan = matchedTool ? hasPlanAccessForTier(plan, matchedTool.tier) : false;

    if (remaining > 0 || coveredByPlan || !matchedTool) {
      onNavigate('tool-detail', record.toolSlug);
      return;
    }

    setReaccessCheckoutTool(matchedTool);
  };

  const userDigitalOrders = digitalOrders.filter(
    (o) =>
      user?.role === 'admin' ||
      user?.role === 'super_admin' ||
      o.userId === user?.id ||
      (user?.email && o.userEmail?.toLowerCase() === user.email.toLowerCase())
  );

  const userQuoteRequests = quoteRequests.filter(
    (q) =>
      user?.role === 'admin' ||
      user?.role === 'super_admin' ||
      q.userId === user?.id ||
      (user?.email && q.contactEmail?.toLowerCase() === user.email.toLowerCase())
  );

  const handleDownloadDigitalProductOrder = async (
    serviceSlug: string,
    serviceName: string,
    orderId?: string
  ) => {
    const srv = services.find((s) => s.slug === serviceSlug);
    const generated = generateDigitalProductPayload(
      srv?.digitalAsset?.generatorKey || serviceSlug,
      serviceSlug,
      serviceName
    );
    const res = await downloadAuthorizedDigitalProduct({
      slug: serviceSlug,
      orderId,
      fallbackFileName: generated.fileName,
      fallbackGenerator: () => generated,
    });
    if (res.ok) {
      if (orderId) recordProductDownload(orderId);
      setVaultNotice(`Downloaded "${generated.fileName}".`);
    } else {
      setVaultNotice(res.message || 'Authorized download verification failed.');
    }
  };

  const handlePaymentStateSynced = (appId: string, item: ApplicationPaymentStatusItem) => {
    void syncApplicationPaymentStatus(appId, {
      uiStatus: item.uiStatus,
      orderId: item.orderId || undefined,
      cfPaymentId: item.cfPaymentId,
      paymentMethod: item.paymentMethod,
      paidAt: item.paymentTime,
    });
  };

  const getRealtimePaymentBadgeStatus = (app: Application) =>
    toPaymentBadgeStatus(
      livePaymentStatusMap[app.id]?.uiStatus ?? deriveInitialPaymentUiStatus(app)
    );

  // Compute Real KYC Progress from AuthContext + DataContext
  const userEnrollment = operatorEnrollments.find(
    (e) =>
      (user?.id && e.userId === user.id) ||
      (user?.operatorEnrollmentId && e.id === user.operatorEnrollmentId)
  );
  const userPartner = partners.find(
    (p) =>
      (user?.id && p.userId === user.id) ||
      (user?.partnerId && p.id === user.partnerId)
  );
  const userAppDocuments = userApplications.flatMap((a) => a.documents || []);
  const verifiedAppDocsCount = userAppDocuments.filter(
    (d) => d.verificationStatus === 'Verified'
  ).length;
  const kycProgress = getKycVerificationProgress({
    role: user?.role,
    accountType: user?.accountType,
    userKycStatus: user?.kycStatus,
    enrollmentKycStatus: userEnrollment?.kycStatus,
    enrollmentDocsCount: userEnrollment?.kycDocuments?.length ?? 0,
    verifiedEnrollmentDocsCount:
      userEnrollment?.kycDocuments?.filter((d) => d.status === 'Verified').length ?? 0,
    enrollmentRemarks: userEnrollment?.adminRemarks,
    partnerStatus: userPartner?.approvalStatus,
    businessId: user?.businessId,
    verifiedAppDocsCount,
    totalAppDocsCount: userAppDocuments.length,
  });

  const handleKycBannerAction = () => {
    if (kycProgress.ctaTarget.type === 'route') {
      onNavigate(kycProgress.ctaTarget.route);
      return;
    }
    setSelectedApp(null);
    setActiveTab(kycProgress.ctaTarget.tab);
    if (kycProgress.ctaTarget.tab === 'documents' && kycProgress.tone !== 'approved') {
      setVaultUploadOpen(true);
    }
  };

  // Compute Statistics
  const totalApps = userApplications.length;
  const pendingApps = userApplications.filter((a) =>
    ['Submitted', 'Payment Pending', 'Awaiting Payment', 'Payment Confirmed', 'Payment Successful', 'Under Review', 'Assigned'].includes(a.status)
  ).length;
  const inProgressApps = userApplications.filter((a) =>
    ['Document Verification', 'Resubmitted', 'Processing', 'Application Processing', 'Submitted to Provider', 'Submitted to External Authority', 'Awaiting External Authority', 'Awaiting External Approval', 'Verification Pending'].includes(a.status)
  ).length;
  const docsRequiredApps = userApplications.filter((a) =>
    ['Documents Required', 'Correction Required'].includes(a.status)
  ).length;
  const completedApps = userApplications.filter((a) => a.status === 'Completed').length;

  const filteredApps = userApplications.filter((a) => {
    if (statusFilter === 'all') return true;
    return a.status.toLowerCase().replace(/\s+/g, '-') === statusFilter;
  });

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'Completed':
        return {
          bg: 'bg-[#EAF7EC] dark:bg-emerald-950/50',
          text: 'text-[#138808] dark:text-emerald-300',
          border: 'border-[#138808]/20 dark:border-emerald-800',
          icon: CheckCircle2,
        };
      case 'Processing':
      case 'Application Processing':
      case 'Submitted to Provider':
      case 'Submitted to External Authority':
      case 'Payment Confirmed':
      case 'Payment Successful':
      case 'Resubmitted':
        return {
          bg: 'bg-[#FFF5EE] dark:bg-orange-950/40',
          text: 'text-[#C2410C] dark:text-orange-300',
          border: 'border-[#FF671F]/30 dark:border-orange-800',
          icon: Clock,
        };
      case 'Documents Required':
      case 'Correction Required':
      case 'Payment Pending':
      case 'Awaiting Payment':
        return {
          bg: 'bg-[#FEF2F2] dark:bg-rose-950/40',
          text: 'text-[#E53935] dark:text-rose-300',
          border: 'border-[#E53935]/30 dark:border-rose-800',
          icon: AlertTriangle,
        };
      case 'Rejected':
      case 'Cancelled':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/40',
          text: 'text-rose-700 dark:text-rose-300',
          border: 'border-rose-200 dark:border-rose-800',
          icon: XCircle,
        };
      case 'Document Verification':
      case 'Under Review':
      case 'Assigned':
      case 'Awaiting External Authority':
      case 'Awaiting External Approval':
      case 'Verification Pending':
        return {
          bg: 'bg-[#FFFBEB] dark:bg-amber-950/40',
          text: 'text-[#B45309] dark:text-amber-300',
          border: 'border-[#FFC928]/40 dark:border-amber-800',
          icon: Clock,
        };
      default:
        return {
          bg: 'bg-slate-100 dark:bg-slate-800',
          text: 'text-slate-700 dark:text-slate-200',
          border: 'border-slate-200 dark:border-slate-700',
          icon: Clock,
        };
    }
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMsg.trim()) return;

    createTicket(
      {
        userId: user?.id || 'usr-customer-1',
        userName: user?.name || 'Customer',
        userEmail: user?.email || 'customer@example.com',
        subject: ticketSubject,
        category: ticketCategory,
        status: 'Open',
        priority: 'Medium',
      },
      ticketMsg
    );

    setTicketSubject('');
    setTicketMsg('');
    setNewTicketOpen(false);
  };

  const handleReplyTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !ticketReplyText.trim()) return;

    replyTicket(
      selectedTicket.id,
      user?.id || 'usr-customer-1',
      user?.name || 'Customer',
      'customer',
      ticketReplyText
    );
    setTicketReplyText('');
    // refresh selected ticket
    const updated = tickets.find((t) => t.id === selectedTicket.id);
    if (updated) setSelectedTicket(updated);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {vaultNotice && (
        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0" />
            <span>{vaultNotice}</span>
          </div>
          <button onClick={() => setVaultNotice(null)} className="underline text-[11px] shrink-0 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Responsive Sidebar / Mobile Tab Navigation */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-2xs space-y-2 lg:sticky lg:top-24">
          <div className="p-2.5 sm:p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between lg:block">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{user?.name || 'Valued Customer'}</div>
                <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
              </div>
              <div className="lg:mt-1 text-[11px] font-semibold text-[#FF671F] capitalize shrink-0">
                {user?.role?.replace('_', ' ') || 'Customer'} Portal
              </div>
            </div>

            <button
              type="button"
              onClick={handleKycBannerAction}
              className="w-full text-left pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] cursor-pointer hover:opacity-85 transition"
            >
              <span className="text-slate-500 dark:text-slate-400 font-medium truncate">
                KYC: <strong className={kycProgress.tone === 'approved' ? 'text-[#138808] dark:text-emerald-400' : kycProgress.tone === 'warning' || kycProgress.tone === 'rejected' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}>{kycProgress.statusBadgeLabel}</strong>
              </span>
              <span className="font-mono font-bold tabular-nums text-slate-700 dark:text-slate-200 shrink-0">
                {kycProgress.percent}%
              </span>
            </button>
          </div>

          <div className="flex lg:flex-col gap-1.5 overflow-x-auto scrollbar-none pb-1 lg:pb-0">
            <button
              onClick={() => { setActiveTab('overview'); setSelectedApp(null); }}
              className={`shrink-0 lg:w-full text-left px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'overview' ? 'bg-[#FF671F] text-white shadow-xs' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => { setActiveTab('applications'); setSelectedApp(null); }}
              className={`shrink-0 lg:w-full text-left px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'applications' ? 'bg-[#FF671F] text-white shadow-xs' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 shrink-0" />
                <span>My Applications</span>
              </div>
              <span className="text-[10px] font-mono opacity-80">{userApplications.length}</span>
            </button>

            <button
              onClick={onStartNewApplication}
              className="shrink-0 lg:w-full text-left px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold text-[#138808] bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>New Application</span>
            </button>

            <button
              onClick={() => { setActiveTab('drafts'); setSelectedApp(null); }}
              className={`shrink-0 lg:w-full text-left px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'drafts' ? 'bg-[#FF671F] text-white shadow-xs' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 shrink-0" />
                <span>Saved Drafts</span>
              </div>
              <span className="text-[10px] font-mono opacity-80">{userDrafts.length}</span>
            </button>

            <button
              onClick={() => { setActiveTab('notifications'); setSelectedApp(null); }}
              className={`shrink-0 lg:w-full text-left px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'notifications' ? 'bg-[#FF671F] text-white shadow-xs' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 shrink-0" />
                <span>Notifications</span>
              </div>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500 text-white">{unreadCount}</span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('downloads'); setSelectedApp(null); }}
              className={`shrink-0 lg:w-full text-left px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'downloads' ? 'bg-[#FF671F] text-white shadow-xs' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 shrink-0" />
                <span>Digital Downloads</span>
              </div>
              {userDigitalOrders.length > 0 && (
                <span className="text-[10px] font-mono opacity-80">{userDigitalOrders.length}</span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('documents'); setSelectedApp(null); }}
              className={`shrink-0 lg:w-full text-left px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'documents' ? 'bg-[#FF671F] text-white shadow-xs' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              <span>Documents Vault</span>
            </button>

            <button
              onClick={() => { setActiveTab('payments'); setSelectedApp(null); }}
              className={`shrink-0 lg:w-full text-left px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'payments' ? 'bg-[#FF671F] text-white shadow-xs' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <CreditCard className="w-4 h-4 shrink-0" />
              <span>Payments &amp; Invoices</span>
            </button>

            <button
              onClick={() => { setActiveTab('usage-history'); setSelectedApp(null); }}
              className={`shrink-0 lg:w-full text-left px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'usage-history' ? 'bg-[#FF671F] text-white shadow-xs' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 shrink-0" />
                <span>Usage History</span>
              </div>
              {allPaidToolRecords.length > 0 && (
                <span className="text-[10px] font-mono opacity-80">{allPaidToolRecords.length}</span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('reminders'); setSelectedApp(null); }}
              className={`shrink-0 lg:w-full text-left px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'reminders' ? 'bg-[#FF671F] text-white shadow-xs' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Calculator className="w-4 h-4 shrink-0" />
              <span>Tax Calc &amp; Reminders</span>
            </button>

            <button
              onClick={() => { setActiveTab('support'); setSelectedApp(null); }}
              className={`shrink-0 lg:w-full text-left px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'support' ? 'bg-[#FF671F] text-white shadow-xs' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Headphones className="w-4 h-4 shrink-0" />
              <span>Support Tickets</span>
            </button>
          </div>

          <div className="hidden lg:block pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => { logout(); onNavigate('home'); }}
              className="w-full text-left px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Right Main Content Area */}
        <div className="lg:col-span-9 space-y-6">
          {/* Instant Payment Status Alert Banner (Paid / Failed Transitions) */}
          {unreadPaymentAlerts.length > 0 && (
            <div
              role="region"
              aria-live="polite"
              aria-label="Instant payment status alerts"
              className="space-y-2.5"
            >
              {unreadPaymentAlerts.slice(0, 2).map((alert) => {
                const isPaid = alert.eventKey === 'PAYMENT_PAID';
                const linkedApp = alert.applicationId
                  ? userApplications.find((a) => a.id === alert.applicationId)
                  : undefined;

                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                      isPaid
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-100'
                        : 'bg-rose-50/90 dark:bg-rose-950/35 border-rose-200 dark:border-rose-800/80 text-rose-950 dark:text-rose-100'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {isPaid ? (
                        <CheckCircle2 className="w-5 h-5 text-[#138808] dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-[#DC2626] dark:text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold">{alert.title}</span>
                          {alert.emailStatus && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border border-current/20 bg-white/70 dark:bg-slate-900/60">
                              <Mail className="w-3 h-3" />
                              <span>
                                {alert.emailStatus === 'Sent'
                                  ? 'Email Alert Sent'
                                  : alert.emailStatus === 'Queued'
                                  ? 'Sending Email…'
                                  : alert.emailStatus === 'Channel Unconfigured'
                                  ? 'In-App Alert Active (Email Unconfigured)'
                                  : 'Email Dispatch Failed'}
                              </span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] opacity-90 leading-relaxed">{alert.message}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {linkedApp && (
                        <button
                          type="button"
                          onClick={() => {
                            markNotificationRead(alert.id);
                            setSelectedApp(linkedApp);
                            setActiveTab('applications');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/85 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-[11px] hover:bg-white cursor-pointer whitespace-nowrap"
                        >
                          Inspect Case
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          markNotificationRead(alert.id);
                          setPaymentOverviewFilter(isPaid ? 'Paid' : 'Failed');
                          setSelectedApp(null);
                          setActiveTab('payments');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-white font-bold text-[11px] cursor-pointer whitespace-nowrap ${
                          isPaid ? 'bg-[#138808] hover:bg-emerald-700' : 'bg-[#DC2626] hover:bg-rose-700'
                        }`}
                      >
                        {isPaid ? 'View Receipt' : 'Retry Payment'}
                      </button>
                      <button
                        type="button"
                        onClick={() => markNotificationRead(alert.id)}
                        aria-label="Dismiss payment alert"
                        className="p-1.5 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Header Greeting */}
              <div className="bg-gradient-to-r from-[#FFFDF8] via-white to-[#F7F8FA] dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    Welcome back, {user?.name || 'Customer'}
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Manage your ongoing digital service applications, track status updates, and download issued certificates.
                  </p>
                </div>

                <button
                  onClick={onStartNewApplication}
                  className="bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer whitespace-nowrap shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Apply for a Service</span>
                </button>
              </div>

              {/* KYC Verification Progress & Status Indicator */}
              <KycVerificationProgressBanner
                progress={kycProgress}
                onAction={handleKycBannerAction}
              />

              {/* Coloured Statistics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 tabular-nums">
                {/* Total Apps */}
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Total Applications
                  </span>
                  <div className="text-2xl font-black text-[#FF671F] font-mono">{totalApps}</div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Across all categories</span>
                </div>

                {/* Pending */}
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Pending Review
                  </span>
                  <div className="text-2xl font-black text-[#D97706] font-mono">{pendingApps + inProgressApps}</div>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">Verification in progress</span>
                </div>

                {/* Action Required */}
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Attention Required
                  </span>
                  <div className="text-2xl font-black text-[#E53935] font-mono">{docsRequiredApps}</div>
                  <span className="text-[10px] text-red-600 dark:text-red-400">Docs requested</span>
                </div>

                {/* Completed */}
                <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Completed
                  </span>
                  <div className="text-2xl font-black text-[#138808] font-mono">{completedApps}</div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Certificates available</span>
                </div>
              </div>

              {/* Digital Tools Tray, Active Plan & ₹10 1-Time Passes */}
              <div className="p-4 sm:p-5 bg-gradient-to-br from-orange-50/70 via-white to-amber-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-orange-950/20 border border-orange-200/80 dark:border-slate-800 rounded-2xl shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#FF671F]">
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Digital Tools Studio · {planDefinition.name}</span>
                    </div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
                      150+ PDF, CSC Photo, OCR &amp; Invoice Utilities (Free + ₹10 Pass / Pro)
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 tabular-nums">
                      Daily jobs left: <strong>{dailyJobsRemaining === null ? 'Unlimited' : dailyJobsRemaining}</strong>
                      {' · '}
                      AI credits: <strong>{creditsRemaining}</strong>
                      {' · '}
                      Active ₹10 Passes: <strong>{activeSingleUsePassList.length}</strong>
                      {' · '}
                      Saved Tools: <strong>{favourites.length}</strong>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setTrayOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Open Tray</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('tools')}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] text-slate-800 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Browse 150+ Tools</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('tool-plans')}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>{plan === 'free' ? 'Upgrade / ₹10 Pass' : 'Manage Plan'}</span>
                    </button>
                  </div>
                </div>

                {(activeSingleUsePassList.length > 0 || favourites.length > 0 || history.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-orange-200/60 dark:border-slate-800 text-xs">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Ticket className="w-3.5 h-3.5 text-amber-500" />
                        <span>Active ₹10 1-Time Use Passes ({activeSingleUsePassList.length})</span>
                      </div>
                      {activeSingleUsePassList.length === 0 ? (
                        <p className="text-[11px] text-slate-500">
                          No unused ₹10 single-use passes. Unlock any paid tool for ₹10 whenever you need a single run.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {activeSingleUsePassList.map((pass) => {
                            const matchedTool = getToolBySlug(pass.toolSlug);
                            return (
                              <button
                                key={pass.toolSlug}
                                type="button"
                                onClick={() => onNavigate('tool-detail', pass.toolSlug)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-semibold text-[11px] inline-flex items-center gap-1.5 hover:border-[#138808] cursor-pointer"
                              >
                                <span>{matchedTool?.name || pass.toolSlug}</span>
                                <span className="font-mono font-bold">({pass.remainingUses} left)</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Bookmark className="w-3.5 h-3.5 text-[#FF671F]" />
                        <span>
                          {favourites.length > 0
                            ? `Saved Tools (${favourites.length})`
                            : `Recent Tool Runs (${history.length})`}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(favourites.length > 0
                          ? favourites.slice(0, 4).map((fav) => ({
                              slug: fav.toolSlug,
                              label: getToolBySlug(fav.toolSlug)?.name || fav.toolName,
                            }))
                          : history.slice(0, 4).map((item) => ({
                              slug: item.toolSlug,
                              label: item.toolName,
                            }))
                        ).map((entry) => (
                          <button
                            key={entry.slug}
                            type="button"
                            onClick={() => onNavigate('tool-detail', entry.slug)}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] text-slate-700 dark:text-slate-200 font-semibold text-[11px] cursor-pointer"
                          >
                            {entry.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Financial Payment Summary: Pending vs. Completed */}
              <PaymentStatusOverview
                applications={userApplications}
                statusMap={livePaymentStatusMap}
                onFilterByStatus={(nextFilter) => {
                  setPaymentOverviewFilter(nextFilter);
                  setSelectedApp(null);
                  setActiveTab('payments');
                }}
                onSelectApplication={(app) => {
                  setSelectedApp(app);
                  setActiveTab('applications');
                }}
                onOpenPaymentsLedger={() => {
                  setPaymentOverviewFilter('all');
                  setSelectedApp(null);
                  setActiveTab('payments');
                }}
                onStartNewApplication={onStartNewApplication}
              />

              {/* Completed Payments (Last 30 Days) Recharts Bar Chart */}
              <React.Suspense fallback={<InlineSkeletonPulse className="h-64 w-full rounded-2xl" />}>
                <PaymentTrendChart
                  applications={userApplications}
                  transactions={userTransactions}
                  statusMap={livePaymentStatusMap}
                  onOpenPaymentsLedger={() => {
                    setPaymentOverviewFilter('Paid');
                    setSelectedApp(null);
                    setActiveTab('payments');
                  }}
                  onStartNewApplication={onStartNewApplication}
                />
              </React.Suspense>

              {/* Monthly Spending & Active Subscriptions Recharts Bar Chart */}
              <React.Suspense fallback={<InlineSkeletonPulse className="h-64 w-full rounded-2xl" />}>
                <BillingSummary
                  applications={userApplications}
                  transactions={userTransactions}
                  statusMap={livePaymentStatusMap}
                  digitalOrders={userDigitalOrders}
                  paidToolHistory={allPaidToolRecords}
                  activePlanCode={plan}
                  billingCycle={billingCycle}
                  lastSubscription={lastSubscription}
                  activeSingleUsePassList={activeSingleUsePassList}
                  creditsRemaining={creditsRemaining}
                  dailyJobsUsed={dailyJobsUsed}
                  onManagePlans={() => onNavigate('tool-plans')}
                  onOpenUsageHistory={() => {
                    setSelectedApp(null);
                    setActiveTab('usage-history');
                  }}
                  onOpenPaymentsLedger={() => {
                    setPaymentOverviewFilter('all');
                    setSelectedApp(null);
                    setActiveTab('payments');
                  }}
                  onStartNewApplication={onStartNewApplication}
                />
              </React.Suspense>

              {/* Real-Time Application Payment Status */}
              <PaymentStatus
                applications={userApplications}
                transactions={userTransactions}
                compact
                hideHistory
                onStatusMapChange={setLivePaymentStatusMap}
                onSelectApplication={(app) => {
                  setSelectedApp(app);
                  setActiveTab('applications');
                }}
                onViewAllPayments={() => {
                  setPaymentOverviewFilter('all');
                  setSelectedApp(null);
                  setActiveTab('payments');
                }}
                onStartNewApplication={onStartNewApplication}
                onPaymentStateSynced={handlePaymentStateSynced}
              />

              {/* Paginated Past Transactions Table */}
              <PaymentHistoryTable
                applications={userApplications}
                transactions={userTransactions}
                refunds={refunds}
                statusMap={livePaymentStatusMap}
                defaultPageSize={5}
                onSelectApplication={(app) => {
                  setSelectedApp(app);
                  setActiveTab('applications');
                }}
                onOpenFullLedger={() => {
                  setPaymentOverviewFilter('all');
                  setSelectedApp(null);
                  setActiveTab('payments');
                }}
                onStartNewApplication={onStartNewApplication}
              />

              {/* Recent Applications Table Preview */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Recent Applications
                    </h3>
                    <p className="text-[10px] text-slate-400 md:hidden mt-0.5">
                      Swipe right to open dossier · Swipe left to cancel or track
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('applications')}
                    className="text-xs font-bold text-[#FF671F] hover:underline cursor-pointer shrink-0"
                  >
                    View All ({userApplications.length}) →
                  </button>
                </div>

                {swipeNotice && (
                  <div
                    className={`mx-4 mt-3 px-3 py-2 rounded-xl text-[11px] font-semibold border ${
                      swipeNotice.type === 'ok'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                        : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                    }`}
                  >
                    {swipeNotice.text}
                  </div>
                )}

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {userApplications.length === 0 ? (
                    <div className="p-8 text-center text-xs space-y-2.5">
                      <p className="font-bold text-slate-800 dark:text-slate-200">No applications submitted under this account yet.</p>
                      <p className="text-slate-500 dark:text-slate-400">
                        Explore our catalog to submit a new application or track an existing ID using the Track page.
                      </p>
                      <button
                        type="button"
                        onClick={onStartNewApplication}
                        className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-4 py-2 rounded-lg cursor-pointer"
                      >
                        Start First Application
                      </button>
                    </div>
                  ) : (
                    userApplications.slice(0, 3).map((app) => {
                      const badge = getStatusBadge(app.status);
                      const Icon = badge.icon;
                      const appProgress = getApplicationProgress(app.status);
                      const paymentBadgeState = getRealtimePaymentBadgeStatus(app);
                      const cancellable = canCitizenCancel(app.status);
                      return (
                        <SwipeableActionItem
                          key={app.id}
                          className="rounded-none"
                          contentClassName="bg-white dark:bg-slate-900"
                          onClick={() => { setSelectedApp(app); setActiveTab('applications'); }}
                          leftAction={{
                            label: 'Open Dossier',
                            shortLabel: 'Dossier',
                            icon: <FileText className="w-4 h-4" />,
                            tone: 'primary',
                            onAction: () => { setSelectedApp(app); setActiveTab('applications'); },
                          }}
                          rightAction={
                            cancellable
                              ? {
                                  label: 'Cancel Application',
                                  shortLabel: 'Cancel',
                                  icon: <Trash2 className="w-4 h-4" />,
                                  tone: 'danger',
                                  onAction: () => void handleSwipeCancelApplication(app),
                                }
                              : {
                                  label: 'Track Status',
                                  shortLabel: 'Track',
                                  icon: <Clock className="w-4 h-4" />,
                                  tone: 'neutral',
                                  onAction: () => onNavigate('track', app.id),
                                }
                          }
                        >
                          <div className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer space-y-2.5 text-xs">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-[#FF671F]">{app.id}</span>
                                  <span className="text-slate-400 dark:text-slate-600">·</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-100">{app.serviceName}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] tabular-nums">
                                  <span>
                                    Submitted on {new Date(app.submissionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>Fee ₹{app.payment.totalAmount}</span>
                                  <PaymentStatus status={paymentBadgeState} size="sm" />
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border whitespace-nowrap ${badge.bg} ${badge.text} ${badge.border}`}>
                                  <Icon className="w-3 h-3" />
                                  <span>{app.status}</span>
                                </span>
                                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                              </div>
                            </div>

                            <ApplicationProgressTracker progress={appProgress} variant="compact" />
                          </div>
                        </SwipeableActionItem>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: MY APPLICATIONS */}
          {activeTab === 'applications' && !selectedApp && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">My Registered Applications</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Track real-time verification progress and history for every service you requested.
                    <span className="md:hidden block text-[10px] text-[#FF671F] mt-0.5">
                      Swipe right on any card for Dossier · Swipe left to Cancel or Track
                    </span>
                  </p>
                </div>

                {/* Filter Selector */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:border-[#FF671F]"
                >
                  <option value="all">All Statuses ({userApplications.length})</option>
                  <option value="submitted">Submitted</option>
                  <option value="payment-confirmed">Payment Confirmed</option>
                  <option value="under-review">Under Review</option>
                  <option value="document-verification">Document Verification</option>
                  <option value="documents-required">Documents Required</option>
                  <option value="correction-required">Correction Required</option>
                  <option value="resubmitted">Resubmitted</option>
                  <option value="application-processing">In Processing</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {swipeNotice && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold border ${
                    swipeNotice.type === 'ok'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                  }`}
                >
                  {swipeNotice.text}
                </div>
              )}

              {filteredApps.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs space-y-2.5">
                  <p className="font-bold text-slate-800 dark:text-slate-200">No applications found in this category.</p>
                  <button
                    onClick={onStartNewApplication}
                    className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-4 py-2 rounded-lg cursor-pointer"
                  >
                    Start a New Application
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredApps.map((app) => {
                    const badge = getStatusBadge(app.status);
                    const Icon = badge.icon;
                    const appProgress = getApplicationProgress(app.status);
                    const cancellable = canCitizenCancel(app.status);
                    return (
                      <SwipeableActionItem
                        key={app.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs"
                        contentClassName="bg-white dark:bg-slate-900"
                        leftAction={{
                          label: 'View Dossier',
                          shortLabel: 'Dossier',
                          icon: <FileText className="w-4 h-4" />,
                          tone: 'primary',
                          onAction: () => setSelectedApp(app),
                        }}
                        rightAction={
                          cancellable
                            ? {
                                label: 'Cancel Application',
                                shortLabel: 'Cancel',
                                icon: <Trash2 className="w-4 h-4" />,
                                tone: 'danger',
                                onAction: () => void handleSwipeCancelApplication(app),
                              }
                            : {
                                label: 'Track Live Status',
                                shortLabel: 'Track',
                                icon: <Clock className="w-4 h-4" />,
                                tone: 'neutral',
                                onAction: () => onNavigate('track', app.id),
                              }
                        }
                      >
                        <div className="p-4 sm:p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition space-y-3.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-bold text-[#FF671F]">{app.id}</span>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{app.serviceName}</span>
                            </div>

                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold border self-start sm:self-auto whitespace-nowrap ${badge.bg} ${badge.text} ${badge.border}`}>
                              <Icon className="w-3.5 h-3.5" />
                              <span>{app.status}</span>
                            </span>
                          </div>

                          <ApplicationProgressTracker progress={appProgress} variant="compact" />

                          {app.customerRemarks && (
                            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <span className="font-bold text-[11px]">Latest Remarks:</span>
                                <p className="text-[11px] leading-relaxed">{app.customerRemarks}</p>
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pt-1">
                            <div className="flex flex-wrap items-center gap-2.5 text-slate-500 dark:text-slate-400 text-[11px] tabular-nums">
                              <span>Submitted: <strong className="text-slate-700 dark:text-slate-200">{new Date(app.submissionDate).toLocaleDateString()}</strong></span>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1.5">
                                <span>Fee: <strong className="text-slate-700 dark:text-slate-200">₹{app.payment.totalAmount}</strong></span>
                                <PaymentStatus status={getRealtimePaymentBadgeStatus(app)} size="sm" />
                              </span>
                              {app.assignedOperatorName && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>Officer: <strong className="text-slate-700 dark:text-slate-200">{app.assignedOperatorName}</strong></span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {app.completionFileName && (
                                <button
                                  onClick={() => void handleDownloadCompletionCertificate(app)}
                                  className="bg-[#138808] hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Certificate</span>
                                </button>
                              )}

                              <button
                                onClick={() => setSelectedApp(app)}
                                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs px-3.5 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap"
                              >
                                View Dossier & Timeline →
                              </button>
                            </div>
                          </div>
                        </div>
                      </SwipeableActionItem>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* APPLICATION DETAILS VIEW (Dossier & Timeline) */}
          {activeTab === 'applications' && activeSelectedApp && (
            <div className="space-y-6 animate-fadeIn">
              <button
                onClick={() => setSelectedApp(null)}
                className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                ← Back to Applications List
              </button>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <span className="font-mono text-sm font-bold text-[#FF671F]">{activeSelectedApp.id}</span>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{activeSelectedApp.serviceName}</h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                      <span>Applicant: {activeSelectedApp.userName} ({activeSelectedApp.userMobile})</span>
                      <span aria-hidden="true">·</span>
                      <span>Fee ₹{activeSelectedApp.payment.totalAmount}</span>
                      <PaymentStatus status={getRealtimePaymentBadgeStatus(activeSelectedApp)} size="sm" />
                    </div>
                  </div>

                  {(() => {
                    const b = getStatusBadge(activeSelectedApp.status);
                    const Icon = b.icon;
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border whitespace-nowrap ${b.bg} ${b.text} ${b.border}`}>
                        <Icon className="w-4 h-4" />
                        <span>{activeSelectedApp.status}</span>
                      </span>
                    );
                  })()}
                </div>

                {/* Detailed Visual Application Status & Lifecycle Progress */}
                <ApplicationProgressTracker
                  progress={getApplicationProgress(activeSelectedApp.status)}
                  variant="detailed"
                />

                {/* Operator comments */}
                {activeSelectedApp.completionFileName && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                      <ShieldCheck className="w-4 h-4 text-[#138808] shrink-0" />
                      <span>
                        Issued Certificate: <strong className="font-mono">{activeSelectedApp.completionFileName}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDownloadCompletionCertificate(activeSelectedApp)}
                      className="bg-[#138808] hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Certificate</span>
                    </button>
                  </div>
                )}

                {activeSelectedApp.customerRemarks && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <span className="font-bold">Desk Officer Updates:</span>
                    <p>{activeSelectedApp.customerRemarks}</p>
                  </div>
                )}

                {(activeSelectedApp.status === 'Documents Required' || activeSelectedApp.status === 'Correction Required') && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl space-y-2.5 text-xs">
                    <div className="font-bold text-red-800 dark:text-red-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Action Required: Upload Corrected / Requested Document</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setResubmitFile(e.target.files?.[0] || null)}
                        className="text-xs text-slate-700 dark:text-slate-200"
                      />
                      <button
                        type="button"
                        disabled={!resubmitFile}
                        onClick={async () => {
                          if (!resubmitFile) return;
                          let fileId: string | undefined;
                          let r2ObjectKey: string | undefined;
                          let fileUrl = '#stored-vault';
                          try {
                            const upRes = await uploadFileToR2({
                              file: resubmitFile,
                              bucket: 'dip-customer-uploads',
                              applicationId: activeSelectedApp.id,
                              documentCategory: 'Resubmitted Correction Proof',
                              customerId: user?.id,
                            });
                            if (upRes.ok && upRes.data) {
                              fileId = upRes.data.id;
                              r2ObjectKey = upRes.data.objectKey;
                              fileUrl = upRes.data.downloadEndpoint || fileUrl;
                            }
                          } catch {
                            // Keep workflow functional in local preview mode
                          }
                          await uploadAdditionalDocument(activeSelectedApp.id, {
                            applicationId: activeSelectedApp.id,
                            documentType: 'Resubmitted Correction Proof',
                            fileName: resubmitFile.name,
                            fileSize: resubmitFile.size,
                            mimeType: resubmitFile.type || 'application/pdf',
                            fileUrl,
                            fileId,
                            logicalBucket: fileId ? 'dip-customer-uploads' : undefined,
                            r2ObjectKey,
                          });
                          setResubmitFile(null);
                          setResubmitMsg(
                            fileId
                              ? 'Document uploaded to encrypted R2 storage and resubmitted to Verification Desk.'
                              : 'Document queued and application resubmitted to Verification Desk.'
                          );
                        }}
                        className="bg-[#138808] text-white font-bold px-3.5 py-1.5 rounded-lg disabled:opacity-40 cursor-pointer"
                      >
                        Upload & Resubmit
                      </button>
                    </div>
                    {resubmitMsg && <p className="text-emerald-700 dark:text-emerald-400 font-semibold">{resubmitMsg}</p>}
                  </div>
                )}

                {/* Form Data Summary */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-2">
                    Submitted Application Details
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                    {Object.entries(activeSelectedApp.formData).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-[10px] text-slate-400 capitalize block">{k.replace(/_/g, ' ')}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100 break-words">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Attached Documents */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-2">
                    Verified Documents
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeSelectedApp.documents.map((doc) => (
                      <div key={doc.id} className="p-3 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                          <div className="truncate">
                            <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{doc.documentType}</div>
                            <div className="text-[10px] text-slate-400 truncate">{doc.fileName}</div>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                          doc.verificationStatus === 'Verified' ? 'bg-green-100 dark:bg-emerald-950/60 text-[#138808] dark:text-emerald-300' :
                          doc.verificationStatus === 'Re-upload Requested' ? 'bg-red-100 dark:bg-rose-950/60 text-red-700 dark:text-rose-300' :
                          'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        }`}>
                          {doc.verificationStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Timeline */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-3">
                    Complete Progress Timeline
                  </h3>
                  <div className="border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-4 py-1">
                    {activeSelectedApp.statusHistory.map((sh) => (
                      <div key={sh.id} className="relative pl-6">
                        <div className="w-3 h-3 rounded-full bg-[#FF671F] absolute -left-[7px] top-1"></div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{sh.newStatus}</div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{sh.customerMessage}</p>
                        <span className="text-[10px] text-slate-400">
                          {new Date(sh.timestamp).toLocaleString()} · {sh.updatedBy}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: MY DOCUMENTS VAULT */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Encrypted Document Vault</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Store certified copies of your Aadhaar, PAN, Electricity bills, and business licenses securely.
                  </p>
                </div>
                <button
                  onClick={() => setVaultUploadOpen(true)}
                  className="bg-[#FF671F] text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload to Vault</span>
                </button>
              </div>

              <KycVerificationProgressBanner
                progress={kycProgress}
                onAction={handleKycBannerAction}
              />

              {vaultUploadOpen && (
                <div className="p-4 bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/60 rounded-xl space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-100">
                    <span>Upload New Identity or Business Proof</span>
                    <button onClick={() => setVaultUploadOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">Cancel</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <input
                      type="text"
                      placeholder="Document Title (e.g. Electricity Bill Oct 2026)"
                      value={vaultDocName}
                      onChange={(e) => setVaultDocName(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2"
                    />
                    <input
                      type="file"
                      onChange={(e) => setVaultFile(e.target.files?.[0] || null)}
                      className="text-xs text-slate-600 dark:text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#FF671F] file:text-white file:text-xs"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (!vaultFile) return;
                      const title = vaultDocName.trim() || vaultFile.name;
                      let uploadedId: string | undefined;
                      let uploadedKey: string | undefined;
                      try {
                        const res = await uploadFileToR2({
                          file: vaultFile,
                          bucket: 'dip-customer-uploads',
                          documentCategory: title,
                          customerId: user?.id,
                        });
                        if (res.ok && res.data) {
                          uploadedId = res.data.id;
                          uploadedKey = res.data.objectKey;
                        } else if (res.message) {
                          setVaultNotice(res.message);
                          return;
                        }
                      } catch {
                        // Continue to D1 vault registration if local preview
                      }
                      const saved = await createVaultItem({
                        docType: 'Compliance Proof',
                        docTitle: title,
                        fileId: uploadedId,
                        r2ObjectKey: uploadedKey,
                        fileName: vaultFile.name,
                        mimeType: vaultFile.type || 'application/octet-stream',
                        fileSize: vaultFile.size,
                      }).catch(() => null);
                      if (saved?.ok) {
                        const listRes = await fetchCustomerVault().catch(() => null);
                        if (listRes?.ok && Array.isArray(listRes.data)) {
                          setVaultItems(listRes.data);
                        }
                      }
                      setVaultNotice(
                        uploadedId
                          ? `Uploaded "${title}" securely to R2 (${uploadedId}) and registered in Compliance Vault.`
                          : `Document "${title}" registered in your Compliance Vault.`
                      );
                      setVaultUploadOpen(false);
                      setVaultDocName('');
                      setVaultFile(null);
                    }}
                    disabled={!vaultFile}
                    className="bg-[#138808] text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40 cursor-pointer"
                  >
                    Save Encrypted Document
                  </button>
                </div>
              )}

              {/* Saved D1 Compliance Vault Records */}
              {(vaultItems.length > 0 || vaultLoading) && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      Personal Vault Files ({vaultItems.length})
                    </span>
                    {vaultLoading && <InlineSkeletonPulse className="w-20" />}
                  </div>
                  {vaultLoading && vaultItems.length === 0 ? (
                    <CardGridSkeleton count={3} />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {vaultItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-[#138808] dark:text-emerald-300 text-[10px] font-bold">
                            {item.doc_type}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteVaultItem(item.id).catch(() => null);
                              setVaultItems((prev) => prev.filter((x) => x.id !== item.id));
                              setVaultNotice(`Removed "${item.doc_title}" from Compliance Vault.`);
                            }}
                            aria-label={`Delete ${item.doc_title}`}
                            className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white truncate">{item.doc_title}</div>
                          <div className="text-[11px] text-slate-400 truncate">{item.file_name || 'Vault Record'}</div>
                        </div>
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-mono">
                            {new Date(item.created_at).toLocaleDateString('en-IN')}
                          </span>
                          {item.file_id && (
                            <button
                              type="button"
                              onClick={async () => {
                                const signed = await issueSignedFileDownloadUrl(item.file_id!);
                                if (signed.ok && signed.data?.downloadUrl) {
                                  window.open(signed.data.downloadUrl, '_blank', 'noopener,noreferrer');
                                } else {
                                  setVaultNotice(signed.message || 'Unable to generate signed R2 link.');
                                }
                              }}
                              className="text-[#FF671F] hover:underline font-bold cursor-pointer"
                            >
                              Download
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    </div>
                  )}
                </div>
              )}

              {/* Aggregated documents from all user applications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {userApplications.flatMap((a) => a.documents).map((doc) => (
                  <div key={doc.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-[#FF671F] flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white truncate">{doc.documentType}</div>
                      <div className="text-[11px] text-slate-400 truncate">{doc.fileName}</div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{doc.verificationStatus}</span>
                      <button
                        onClick={async () => {
                          if (doc.fileId) {
                            const signed = await issueSignedFileDownloadUrl(doc.fileId);
                            if (signed.ok && signed.data?.downloadUrl) {
                              window.open(signed.data.downloadUrl, '_blank', 'noopener,noreferrer');
                              return;
                            }
                          }
                          setVaultNotice(`Prepared verified copy of "${doc.fileName}".`);
                        }}
                        className="text-[#FF671F] hover:underline font-bold cursor-pointer"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: SAVED DRAFTS */}
          {activeTab === 'drafts' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Saved Application Drafts</h2>
                <p className="text-xs text-slate-500">Pick up where you left off at any time before payment.</p>
              </div>

              {userDrafts.length === 0 ? (
                <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xs space-y-2">
                  <p className="font-bold text-slate-800 dark:text-slate-200">No saved drafts yet.</p>
                  <button
                    onClick={onStartNewApplication}
                    className="bg-[#FF671F] text-white font-bold px-4 py-2 rounded-lg cursor-pointer"
                  >
                    Start New Application
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {userDrafts.map((d) => (
                    <SwipeableActionItem
                      key={d.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800"
                      contentClassName="bg-white dark:bg-slate-900"
                      leftAction={{
                        label: 'Resume Draft',
                        shortLabel: 'Resume',
                        icon: <ChevronRight className="w-4 h-4" />,
                        tone: 'success',
                        onAction: () => onResumeDraft && onResumeDraft(d),
                      }}
                      rightAction={{
                        label: 'Delete Draft',
                        shortLabel: 'Delete',
                        icon: <Trash2 className="w-4 h-4" />,
                        tone: 'danger',
                        onAction: () => deleteDraft(d.id),
                      }}
                    >
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">{d.serviceName}</div>
                          <div className="text-[11px] text-slate-500">
                            Saved {new Date(d.savedAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onResumeDraft && onResumeDraft(d)}
                            className="bg-[#FF671F] text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                          >
                            Resume
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteDraft(d.id)}
                            aria-label="Delete draft"
                            className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </SwipeableActionItem>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Alerts & Status Notifications</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Instant dashboard and automated email alerts for payment confirmations, failures, and verification milestones.
                    <span className="md:hidden block text-[10px] text-[#FF671F] mt-0.5">
                      Swipe right to Mark Read · Swipe left to open Applications
                    </span>
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllNotificationsRead(user?.id)}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Mark All Read ({unreadCount})
                  </button>
                )}
              </div>
              <div className="space-y-2.5 text-xs">
                {userNotifications.length === 0 ? (
                  <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500">
                    All caught up. New status alerts will appear here automatically.
                  </div>
                ) : (
                  userNotifications.map((n) => {
                    const isPaymentPaid = n.eventKey === 'PAYMENT_PAID';
                    const isPaymentFailed = n.eventKey === 'PAYMENT_FAILED';
                    return (
                      <SwipeableActionItem
                        key={n.id}
                        onClick={() => markNotificationRead(n.id)}
                        className={`rounded-xl border ${
                          n.isRead
                            ? 'border-slate-200 dark:border-slate-800 opacity-80'
                            : isPaymentPaid
                            ? 'border-emerald-300 dark:border-emerald-800'
                            : isPaymentFailed
                            ? 'border-rose-300 dark:border-rose-800'
                            : 'border-[#FF671F]'
                        }`}
                        contentClassName={
                          n.isRead
                            ? 'bg-white dark:bg-slate-900'
                            : isPaymentPaid
                            ? 'bg-emerald-50/80 dark:bg-emerald-950/30'
                            : isPaymentFailed
                            ? 'bg-rose-50/80 dark:bg-rose-950/30'
                            : 'bg-[#FFF5EE] dark:bg-orange-950/20'
                        }
                        leftAction={
                          !n.isRead
                            ? {
                                label: 'Mark Read',
                                shortLabel: 'Read',
                                icon: <CheckCircle2 className="w-4 h-4" />,
                                tone: 'success',
                                onAction: () => markNotificationRead(n.id),
                              }
                            : undefined
                        }
                        rightAction={{
                          label: 'Open Applications',
                          shortLabel: 'Apps',
                          icon: <FileText className="w-4 h-4" />,
                          tone: 'primary',
                          onAction: () => {
                            markNotificationRead(n.id);
                            setActiveTab('applications');
                          },
                        }}
                      >
                        <div className="p-4 cursor-pointer transition">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-bold text-slate-900 dark:text-white">{n.title}</div>
                            <div className="flex items-center gap-1.5">
                              {n.emailStatus && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                  <Mail className="w-3 h-3" />
                                  <span>Email: {n.emailStatus}</span>
                                </span>
                              )}
                              {!n.isRead && (
                                <span className="px-1.5 py-0.5 rounded bg-[#FF671F] text-white text-[10px] font-bold">
                                  New
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 mt-1">{n.message}</p>
                          <div className="text-[10px] text-slate-400 mt-1.5 tabular-nums">
                            {new Date(n.createdAt).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </SwipeableActionItem>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB: PAYMENTS & INVOICES */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Payment Transactions & Receipts</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Billing Entity: {businessSettings.legalName} · GSTIN {businessSettings.gstin || '26EXIPK0151F1ZQ'} · UDYAM {businessSettings.udyamNumber || 'UDYAM-DD-03-0009994'} · D-U-N-S {businessSettings.dunsNumber || '308198649'}
                </p>
              </div>

              <PaymentStatusOverview
                applications={userApplications}
                statusMap={livePaymentStatusMap}
                activeFilter={paymentOverviewFilter}
                onFilterByStatus={setPaymentOverviewFilter}
                onSelectApplication={(app) => {
                  setSelectedApp(app);
                  setActiveTab('applications');
                }}
                onStartNewApplication={onStartNewApplication}
              />

              <React.Suspense fallback={<InlineSkeletonPulse className="h-64 w-full rounded-2xl" />}>
                <BillingSummary
                  applications={userApplications}
                  transactions={userTransactions}
                  statusMap={livePaymentStatusMap}
                  digitalOrders={userDigitalOrders}
                  paidToolHistory={allPaidToolRecords}
                  activePlanCode={plan}
                  billingCycle={billingCycle}
                  lastSubscription={lastSubscription}
                  activeSingleUsePassList={activeSingleUsePassList}
                  creditsRemaining={creditsRemaining}
                  dailyJobsUsed={dailyJobsUsed}
                  onManagePlans={() => onNavigate('tool-plans')}
                  onOpenUsageHistory={() => {
                    setSelectedApp(null);
                    setActiveTab('usage-history');
                  }}
                  onStartNewApplication={onStartNewApplication}
                />
              </React.Suspense>

              <PaymentTrendCard
                applications={userApplications}
                transactions={userTransactions}
                statusMap={livePaymentStatusMap}
                onFilterByStatus={setPaymentOverviewFilter}
                onStartNewApplication={onStartNewApplication}
              />

              <PaymentStatus
                applications={userApplications}
                transactions={userTransactions}
                refunds={refunds}
                hideHistory
                externalStatusFilter={paymentOverviewFilter}
                onStatusFilterChange={setPaymentOverviewFilter}
                onStatusMapChange={setLivePaymentStatusMap}
                onSelectApplication={(app) => {
                  setSelectedApp(app);
                  setActiveTab('applications');
                }}
                onStartNewApplication={onStartNewApplication}
                onPaymentStateSynced={handlePaymentStateSynced}
                onRequestRefund={requestRefund}
                onRetryPayment={(target) => setRetryCheckoutTarget(target)}
                onPrintReceipt={(entry) => setInvoiceEntry(entry)}
              />

              <PaymentHistoryTable
                applications={userApplications}
                transactions={userTransactions}
                refunds={refunds}
                statusMap={livePaymentStatusMap}
                externalStatusFilter={paymentOverviewFilter}
                onStatusFilterChange={setPaymentOverviewFilter}
                defaultPageSize={10}
                onSelectApplication={(app) => {
                  setSelectedApp(app);
                  setActiveTab('applications');
                }}
                onPrintReceipt={(entry) => setInvoiceEntry(entry)}
                onRequestRefund={requestRefund}
                onRetryPayment={(target) => setRetryCheckoutTarget(target)}
                onStartNewApplication={onStartNewApplication}
              />
            </div>
          )}

          {/* TAB: USAGE HISTORY (Previously Paid Tools & One-Time Passes) */}
          {activeTab === 'usage-history' && (() => {
            const totalSpentInr = allPaidToolRecords.reduce(
              (sum, item) => sum + Number(item.amountInr || 0),
              0
            );
            const oneTimeCount = allPaidToolRecords.filter(
              (item) => item.purchaseType === 'one_time'
            ).length;
            const subscriptionCount = allPaidToolRecords.filter(
              (item) => item.purchaseType === 'subscription'
            ).length;

            return (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <History className="w-5 h-5 text-[#FF671F]" />
                      <span>Paid Tools Usage History</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Review all previously paid ₹10 one-time tools and subscriptions, dates, costs, and re-access any one-time tool in one click.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onNavigate('tools')}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#FF671F] text-xs font-bold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5 text-[#FF671F]" />
                      <span>Browse Tools</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('tool-plans')}
                      className="px-3.5 py-2 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>₹10 Pass &amp; Plans</span>
                    </button>
                  </div>
                </div>

                {/* Usage History KPI Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 tabular-nums">
                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Paid Purchases
                    </span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                      {allPaidToolRecords.length}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {oneTimeCount} one-time · {subscriptionCount} plan{subscriptionCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Total Cost Paid
                    </span>
                    <div className="text-2xl font-black text-[#FF671F] font-mono">
                      ₹{totalSpentInr.toLocaleString('en-IN')}
                    </div>
                    <span className="text-[10px] text-slate-500">Cashfree verified spend</span>
                  </div>

                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Active ₹10 Passes
                    </span>
                    <div className="text-2xl font-black text-[#138808] dark:text-emerald-400 font-mono">
                      {activeSingleUsePassList.length}
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Ready to run now</span>
                  </div>

                  <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Tool Runs Logged
                    </span>
                    <div className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">
                      {history.length}
                    </div>
                    <span className="text-[10px] text-slate-500">Completed jobs in history</span>
                  </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'all', label: `All Paid Tools (${allPaidToolRecords.length})` },
                        { id: 'one_time', label: `One-Time Tools · ₹10 (${oneTimeCount})` },
                        { id: 'subscription', label: `Subscriptions (${subscriptionCount})` },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setUsageHistoryFilter(tab.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                          usageHistoryFilter === tab.id
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-[#FF671F]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative flex items-center sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                    <input
                      type="search"
                      value={usageHistoryQuery}
                      onChange={(e) => setUsageHistoryQuery(e.target.value)}
                      placeholder="Filter by tool or order ID..."
                      aria-label="Filter usage history"
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:border-[#FF671F]"
                    />
                  </div>
                </div>

                {/* Previously Paid Tools List */}
                {filteredPaidToolRecords.length === 0 ? (
                  <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xs space-y-3">
                    <div className="w-11 h-11 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 text-[#FF671F] flex items-center justify-center mx-auto">
                      <Ticket className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">
                        {allPaidToolRecords.length === 0
                          ? 'No paid tools purchased yet.'
                          : 'No paid tool entries matched your current filter.'}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        Unlock any Pro, CSC, or AI tool for ₹10 one-time use or activate a Monthly Subscription — every purchase and run appears here with one-click re-access.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigate('tools')}
                        className="px-4 py-2 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold cursor-pointer"
                      >
                        Explore 150+ Digital Tools
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('tool-plans')}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold cursor-pointer"
                      >
                        View ₹10 Passes &amp; Plans
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredPaidToolRecords.map((item) => {
                        const isOneTime = item.purchaseType === 'one_time';
                        const matchedTool = item.toolSlug ? getToolBySlug(item.toolSlug) : undefined;
                        const remainingPasses = item.toolSlug
                          ? getRemainingSingleUsePasses(item.toolSlug)
                          : 0;
                        const coveredByPlan = matchedTool
                          ? hasPlanAccessForTier(plan, matchedTool.tier)
                          : false;
                        const hasImmediateAccess = isOneTime
                          ? remainingPasses > 0 || coveredByPlan
                          : item.planCode === plan;

                        return (
                          <div
                            key={item.id}
                            className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3.5 text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                          >
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                {isOneTime && item.toolSlug ? (
                                  <button
                                    type="button"
                                    onClick={() => onNavigate('tool-detail', item.toolSlug)}
                                    className="font-bold text-sm text-slate-900 dark:text-white hover:text-[#FF671F] transition text-left cursor-pointer"
                                  >
                                    {item.toolName}
                                  </button>
                                ) : (
                                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                                    {item.toolName}
                                  </span>
                                )}

                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                    isOneTime
                                      ? 'bg-orange-50 dark:bg-orange-950/50 text-[#E55B1B] dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                                      : 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                                  }`}
                                >
                                  {isOneTime ? (
                                    <>
                                      <Ticket className="w-3 h-3" />
                                      <span>One-Time Tool</span>
                                    </>
                                  ) : (
                                    <>
                                      <Crown className="w-3 h-3" />
                                      <span>
                                        {item.billingCycle === 'annual' ? 'Annual Plan' : 'Monthly Plan'}
                                      </span>
                                    </>
                                  )}
                                </span>

                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    hasImmediateAccess
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#138808] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  {isOneTime
                                    ? remainingPasses > 0
                                      ? `Pass Active (${remainingPasses} use left)`
                                      : coveredByPlan
                                      ? `Included in ${planDefinition.name}`
                                      : `Used (${item.usesConsumed}/${item.usesGranted})`
                                    : item.planCode === plan
                                    ? 'Current Active Plan'
                                    : 'Previous Plan'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>
                                    Purchased: <strong className="text-slate-700 dark:text-slate-200">{new Date(item.purchasedAt).toLocaleString('en-IN')}</strong>
                                  </span>
                                </span>
                                {item.lastUsedAt && (
                                  <span>
                                    · Last used:{' '}
                                    <strong className="text-slate-700 dark:text-slate-200">
                                      {new Date(item.lastUsedAt).toLocaleString('en-IN')}
                                    </strong>
                                  </span>
                                )}
                                {item.categoryLabel && <span>· {item.categoryLabel}</span>}
                                {item.orderId && (
                                  <span className="font-mono text-[10px] text-slate-400">
                                    · Order #{item.orderId}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                              <div className="text-left md:text-right tabular-nums">
                                <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                                  ₹{Number(item.amountInr || 0).toLocaleString('en-IN')}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {item.paymentMethod || 'Cashfree PG'}
                                </div>
                              </div>

                              {isOneTime && item.toolSlug ? (
                                <button
                                  type="button"
                                  onClick={() => handleReaccessOneTimeTool(item)}
                                  className="px-3.5 py-2 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Re-access</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onNavigate('tool-plans')}
                                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-[#FF671F] text-slate-800 dark:text-slate-100 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                >
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                  <span>Manage Plan</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent Tool Execution Log */}
                {history.length > 0 && (
                  <div className="space-y-2.5 pt-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Recent Tool Activity Log ({history.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                      {history.slice(0, 8).map((run, idx) => (
                        <div
                          key={run.id || `${run.toolSlug}_${idx}`}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {run.toolName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {run.outputSummary || run.inputSummary || run.status} ·{' '}
                              {new Date(run.createdAt).toLocaleString('en-IN')}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onNavigate('tool-detail', run.toolSlug)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-slate-700 dark:text-slate-200 hover:text-[#FF671F] font-bold text-[11px] shrink-0 cursor-pointer"
                          >
                            Open
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB: TAX CALCULATORS & COMPLIANCE REMINDERS */}
          {activeTab === 'reminders' && (
            <TaxComplianceEstimator onNavigate={onNavigate} />
          )}

          {/* TAB: SUPPORT TICKETS */}
          {activeTab === 'support' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Customer Support Tickets</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Communicate directly with our legal and operations team regarding your applications.</p>
                </div>
                <button
                  onClick={() => setNewTicketOpen(true)}
                  className="bg-[#FF671F] text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1 cursor-pointer self-start sm:self-auto whitespace-nowrap shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Raise Support Ticket</span>
                </button>
              </div>

              {/* New Ticket Form Modal */}
              {newTicketOpen && (
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-900 dark:text-white">
                    <span>Create a New Support Request</span>
                    <button onClick={() => setNewTicketOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">Cancel</button>
                  </div>
                  <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Subject</label>
                      <input
                        type="text"
                        placeholder="Brief summary of your query"
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Category</label>
                      <select
                        value={ticketCategory}
                        onChange={(e) => setTicketCategory(e.target.value)}
                        className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2"
                      >
                        <option>Application Status</option>
                        <option>Document Verification</option>
                        <option>Payment & Receipt</option>
                        <option>General Service Inquiry</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Detailed Message</label>
                      <textarea
                        rows={3}
                        placeholder="Provide relevant details or Application ID"
                        value={ticketMsg}
                        onChange={(e) => setTicketMsg(e.target.value)}
                        className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-[#138808] text-white font-bold px-4 py-2 rounded-lg cursor-pointer"
                    >
                      Submit Ticket
                    </button>
                  </form>
                </div>
              )}

              {/* Tickets List */}
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-[#FF671F] shrink-0">{t.ticketNumber}</span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="font-bold text-slate-900 dark:text-white truncate">{t.subject}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                        {t.status}
                      </span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 line-clamp-1">{t.messages[0]?.message}</div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>Category: {t.category}</span>
                      <span>{t.messages.length} messages</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected Ticket Chat Drawer */}
              {selectedTicket && (
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-md space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#FF671F]">{selectedTicket.ticketNumber}</span>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">{selectedTicket.subject}</h3>
                    </div>
                    <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Messages thread */}
                  <div className="space-y-3 max-h-60 overflow-y-auto p-2">
                    {selectedTicket.messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl text-xs max-w-[85%] ${
                          m.senderRole === 'customer'
                            ? 'bg-orange-50 text-slate-800 ml-auto border border-orange-200'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        <div className="font-bold text-[11px] mb-1 text-slate-600">{m.senderName} ({m.senderRole})</div>
                        <p className="leading-relaxed">{m.message}</p>
                      </div>
                    ))}
                  </div>

                  {/* Reply Box */}
                  <form onSubmit={handleReplyTicket} className="flex gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Type your reply..."
                      value={ticketReplyText}
                      onChange={(e) => setTicketReplyText(e.target.value)}
                      className="flex-1 bg-[#F7F8FA] border border-slate-200 rounded-xl px-3 py-2"
                    />
                    <button
                      type="submit"
                      disabled={!ticketReplyText.trim()}
                      className="bg-[#FF671F] text-white font-bold px-4 py-2 rounded-xl disabled:opacity-40"
                    >
                      Reply
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
          {/* TAB: DIGITAL DOWNLOADS & CUSTOM QUOTES */}
          {activeTab === 'downloads' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Digital Products &amp; Downloads
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Verified access to your purchased spreadsheets, templates, and starter toolkits.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('products')}
                  className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
                >
                  Browse Digital Store
                </button>
              </div>

              {userDigitalOrders.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs space-y-2">
                  <p className="font-bold text-slate-800 dark:text-white">No digital product orders yet.</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Explore our invoice templates, GST calculators, and business toolkits for instant download.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('products')}
                    className="mt-2 bg-[#FF671F] text-white font-bold px-4 py-2 rounded-lg cursor-pointer"
                  >
                    Explore Digital Products
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userDigitalOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono text-[11px] font-bold text-[#FF671F]">
                            {order.orderId}
                          </div>
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {order.productName}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            order.paymentStatus === 'Paid'
                              ? 'bg-emerald-50 text-[#138808] border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {order.paymentStatus}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Paid: ₹{order.amountPaid}</span>
                        <span>·</span>
                        <span>Downloads: {order.downloadCount}</span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => onNavigate('service-detail', order.productSlug)}
                          className="text-slate-600 dark:text-slate-300 hover:underline font-semibold cursor-pointer"
                        >
                          Product Details
                        </button>
                        {order.paymentStatus === 'Paid' ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handleDownloadDigitalProductOrder(
                                order.productSlug,
                                order.productName,
                                order.orderId
                              )
                            }
                            className="bg-[#138808] hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download File</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-semibold">
                            Awaiting Payment Verification
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom Quote Requests */}
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  My Custom Quote Inquiries ({userQuoteRequests.length})
                </h3>
                {userQuoteRequests.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No custom project or retainer quotes submitted yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {userQuoteRequests.map((q) => (
                      <div
                        key={q.id}
                        className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {q.serviceName} <span className="font-mono text-[#FF671F] text-[11px]">({q.id})</span>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-[10px]">
                            {q.status}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{q.requirementsSummary}</p>
                        {(q.quotedAmountInr || q.adminNotes) && (
                          <div className="pt-1 text-[11px] text-[#138808] font-semibold">
                            {q.quotedAmountInr ? `Quoted Proposal: ₹${q.quotedAmountInr}` : ''}
                            {q.adminNotes ? ` · ${q.adminNotes}` : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GST Tax Invoice Preview & Print Modal */}
      {invoiceEntry && (() => {
        const matchedApp = userApplications.find((a) => a.id === invoiceEntry.applicationId);
        const totalInr = Number(invoiceEntry.amount || matchedApp?.payment.totalAmount || 0);
        const govtFee = Number(matchedApp?.payment.govtFee || 0);
        const taxableBase = Math.max(0, Math.round(((totalInr - govtFee) / 1.18) * 100) / 100);
        const gstTotal = Math.max(0, Math.round((totalInr - govtFee - taxableBase) * 100) / 100);
        const halfGst = Math.round((gstTotal / 2) * 100) / 100;
        const invoiceNo =
          invoiceEntry.invoiceNumber ||
          invoiceEntry.receiptNumber ||
          `INV-${invoiceEntry.applicationId.slice(-6).toUpperCase()}`;

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden text-xs">
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/70">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF671F]">
                    GST Tax Invoice (SAC 998599)
                  </span>
                  <h3 className="text-base font-black text-slate-900 dark:text-white font-mono">
                    {invoiceNo}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print / Save PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceEntry(null)}
                    aria-label="Close tax invoice modal"
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-4 text-slate-700 dark:text-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Supplier</div>
                    <div className="font-black text-slate-900 dark:text-white text-sm">
                      {businessSettings.legalName || 'Digital India Project'}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      GSTIN: {businessSettings.gstin || '26EXIPK0151F1ZQ'}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      UDYAM: {businessSettings.udyamNumber || 'UDYAM-DD-03-0009994'}
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Billed To</div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {matchedApp?.userName || user?.name || 'Customer'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {matchedApp?.userEmail || user?.email}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      App Ref: {invoiceEntry.applicationId} · Order: {invoiceEntry.orderId}
                    </div>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left tabular-nums">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase text-slate-500">
                      <tr>
                        <th className="p-3">Service Description &amp; SAC</th>
                        <th className="p-3 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {invoiceEntry.serviceName}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            SAC Code: 998599 · Taxable Professional Service Fee
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono">₹{taxableBase.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-500">CGST (9%)</td>
                        <td className="p-3 text-right font-mono">₹{halfGst.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="p-3 text-slate-500">SGST / UTGST (9%)</td>
                        <td className="p-3 text-right font-mono">
                          ₹{(gstTotal - halfGst).toFixed(2)}
                        </td>
                      </tr>
                      {govtFee > 0 && (
                        <tr>
                          <td className="p-3 text-slate-500">Statutory / Government Fee Reimbursement</td>
                          <td className="p-3 text-right font-mono">₹{govtFee.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr className="bg-emerald-50/70 dark:bg-emerald-950/30 font-black">
                        <td className="p-3 text-slate-900 dark:text-white">Total Paid ({invoiceEntry.uiStatus})</td>
                        <td className="p-3 text-right font-mono text-[#138808] dark:text-emerald-400 text-sm">
                          ₹{totalInr.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                  <span>
                    Payment Ref: <strong className="font-mono">{invoiceEntry.transactionId}</strong> ({invoiceEntry.paymentMethod})
                  </span>
                  <span>Date: {new Date(invoiceEntry.date).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Re-access ₹10 One-Time Tool Cashfree Modal */}
      {reaccessCheckoutTool && (
        <CashfreeModal
          isOpen
          onClose={() => setReaccessCheckoutTool(null)}
          serviceSlug={`tool-pass:${reaccessCheckoutTool.slug}`}
          serviceName={`${reaccessCheckoutTool.name} — Re-access (1-Time Use Pass)`}
          serviceCharge={getToolSingleUsePriceInr(reaccessCheckoutTool) || TOOL_SINGLE_USE_PRICE_INR}
          govtFees={0}
          applicantId={user?.id || 'guest_tools_user'}
          applicantName={user?.name || 'Citizen User'}
          applicantEmail={user?.email || 'citizen@digitalindiaproject.com'}
          applicantMobile={user?.mobile || '9876543210'}
          onPaymentSuccess={(details) => {
            const targetSlug = reaccessCheckoutTool.slug;
            const targetName = reaccessCheckoutTool.name;
            grantSingleUsePass(targetSlug, 1, {
              orderId: details.orderId,
              amountInr: details.amount,
              paymentMethod: details.paymentMethod,
            });
            setReaccessCheckoutTool(null);
            setVaultNotice(
              `Re-access unlocked for ${targetName} (Order #${details.orderId} · ₹${details.amount}).`
            );
            onNavigate('tool-detail', targetSlug);
          }}
        />
      )}

      {/* Failed / Pending Application Payment Retry Modal */}
      {retryCheckoutTarget && (() => {
        const matchedApp = userApplications.find((a) => a.id === retryCheckoutTarget.applicationId);
        const matchedService = services.find(
          (s) => s.id === matchedApp?.serviceId || s.slug === matchedApp?.serviceSlug
        );
        const totalInr =
          matchedApp?.payment?.totalAmount ?? retryCheckoutTarget.amountInr ?? matchedService?.serviceCharge ?? 0;
        const serviceCharge = matchedApp?.payment?.amount ?? matchedService?.serviceCharge ?? totalInr;
        const govtFees = matchedApp?.payment?.govtFee ?? matchedService?.govtFees ?? 0;
        const taxAmount = matchedApp?.payment?.taxAmount ?? Math.max(0, totalInr - serviceCharge - govtFees);

        return (
          <CashfreeModal
            isOpen
            onClose={() => setRetryCheckoutTarget(null)}
            applicationId={retryCheckoutTarget.applicationId}
            retryOfOrderId={
              retryCheckoutTarget.orderId && retryCheckoutTarget.orderId !== 'Unassigned'
                ? retryCheckoutTarget.orderId
                : undefined
            }
            serviceId={matchedApp?.serviceId || matchedService?.id}
            serviceSlug={matchedApp?.serviceSlug || matchedService?.slug}
            serviceName={retryCheckoutTarget.serviceName || matchedApp?.serviceName || 'Digital India Service'}
            serviceCharge={serviceCharge}
            govtFees={govtFees}
            taxAmount={taxAmount}
            applicantId={user?.id || matchedApp?.userId || 'citizen_retry'}
            applicantName={user?.name || matchedApp?.userName || 'Citizen User'}
            applicantEmail={user?.email || matchedApp?.userEmail || 'citizen@digitalindiaproject.com'}
            applicantMobile={user?.mobile || matchedApp?.userMobile || '9876543210'}
            onPaymentSuccess={(details) => {
              void syncApplicationPaymentStatus(retryCheckoutTarget.applicationId, {
                uiStatus: 'Paid',
                orderId: details.orderId,
                cfPaymentId: details.cfPaymentId,
                paymentMethod: details.paymentMethod,
                paidAt: details.paidAt,
              });
              setLivePaymentStatusMap((prev) => ({
                ...prev,
                [retryCheckoutTarget.applicationId]: {
                  applicationId: retryCheckoutTarget.applicationId,
                  orderId: details.orderId,
                  uiStatus: 'Paid',
                  gatewayStatus: 'PAID',
                  paid: true,
                  cfPaymentId: details.cfPaymentId,
                  paymentMethod: details.paymentMethod,
                  paymentTime: details.paidAt,
                  bankReference: details.bankReference,
                  paymentAmount: details.amount,
                  gatewayConfigured: Boolean(details.verifiedByGateway),
                  source: details.verifiedByGateway ? 'cashfree_live' : 'sandbox_preview',
                  checkedAt: new Date().toISOString(),
                },
              }));
              setVaultNotice(
                `Payment confirmed for ${retryCheckoutTarget.applicationId} (Order #${details.orderId}).`
              );
              setRetryCheckoutTarget(null);
            }}
          />
        );
      })()}
    </div>
  );
};

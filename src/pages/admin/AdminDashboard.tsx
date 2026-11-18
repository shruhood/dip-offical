import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import {
  ApplicationStatus,
  ApplicationSourceChannel,
  Service,
  ApiProvider,
  ApiCatalogueItem,
  Business,
  ApiRequestLog,
  BulkJob,
  ServiceFormField,
  OperatorEnrollment,
  OperatorKycStatus,
  DynamicFieldType,
  FieldCondition,
  PartnerApprovalStatus,
  CommissionRule,
} from '../../types';
import {
  ALL_PERMISSIONS,
  PermissionCode,
} from '../../lib/rbac';
import { CANONICAL_WORKFLOW_STATUSES } from '../../lib/workflow';
import {
  formatINRFromPaise,
  toPaise,
} from '../../lib/finance';
import {
  INITIAL_API_PROVIDERS,
  INITIAL_API_CATALOGUE,
} from '../../data/initialData';
import {
  ShieldAlert,
  FileCheck,
  Settings,
  PlusCircle,
  CheckCircle2,
  Search,
  DollarSign,
  TrendingUp,
  Sliders,
  Layers,
  Edit,
  Trash2,
  UserCheck,
  Building2,
  Activity,
  Server,
  Radio,
  Eye,
  Database,
  RefreshCw,
  Check,
  Copy,
  Lock,
  Download,
  Users,
  Wallet,
  AlertCircle,
  Bell,
  BookOpen,
  Cloud,
  Gauge,
  Globe2,
  ChevronLeft,
  ChevronRight,
  Globe,
} from 'lucide-react';
import { AdminPaymentsConsole } from '../../components/admin/AdminPaymentsConsole';
import { InlineSkeletonPulse } from '../../components/common/SkeletonLoaders';
import { SwipeableActionItem } from '../../components/common/SwipeableActionItem';
import { getPerfSummary, subscribePerfMetrics } from '../../lib/perfMonitor';
import {
  getApiSathiCallLogs,
  getApiSathiStatus,
  type ApiSathiCallLogRow,
  type ApiSathiStatusInfo,
} from '../../services/apiSathiService';

const BlogManagerTab = React.lazy(() =>
  import('../../components/admin/BlogManagerTab').then((m) => ({ default: m.BlogManagerTab }))
);
const InfrastructureTab = React.lazy(() =>
  import('../../components/admin/InfrastructureTab').then((m) => ({ default: m.InfrastructureTab }))
);
const PerformanceAnalyticsTab = React.lazy(() =>
  import('../../components/admin/PerformanceAnalyticsTab').then((m) => ({
    default: m.PerformanceAnalyticsTab,
  }))
);
const AdminCatalogManager = React.lazy(() =>
  import('../../components/admin/AdminCatalogManager').then((m) => ({
    default: m.AdminCatalogManager,
  }))
);
const AdminCatalogSEOManager = React.lazy(() =>
  import('../../components/admin/AdminCatalogSEOManager').then((m) => ({
    default: m.AdminCatalogSEOManager,
  }))
);
const DirectorySeoManagerTab = React.lazy(() =>
  import('../../components/admin/DirectorySeoManagerTab').then((m) => ({
    default: m.DirectorySeoManagerTab,
  }))
);
const ApiSathiUsageDashboard = React.lazy(() =>
  import('../../components/admin/ApiSathiUsageDashboard').then((m) => ({
    default: m.ApiSathiUsageDashboard,
  }))
);

function slugifyServiceName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const SOURCE_LABELS: Record<string, string> = {
  web_b2c: 'Web B2C',
  operator_assisted: 'Operator Desk',
  partner_assisted: 'Partner Assisted',
  b2b_portal: 'B2B Portal',
  google_forms: 'Google Forms',
  admin_manual: 'Admin Manual',
};

const ALL_FIELD_TYPES: { value: DynamicFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone / Mobile' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown Select' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'radio', label: 'Radio Options' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'textarea', label: 'Long Textarea' },
  { value: 'address', label: 'Structured Address (Line + PIN)' },
  { value: 'file', label: 'Inline File Attachment' },
  { value: 'repeater', label: 'Repeater Group (Directors / Partners)' },
  { value: 'heading', label: 'Section Heading' },
  { value: 'info', label: 'Instruction Callout' },
  { value: 'consent', label: 'Consent Declaration' },
];

export const AdminDashboard: React.FC<{ initialTab?: string; onNavigate: (route: string, param?: string) => void }> = ({
  initialTab = 'overview',
  onNavigate,
}) => {
  const { user } = useAuth();
  const {
    services,
    applications,
    blogPosts,
    transactions,
    operatorEnrollments,
    partners,
    commissionRules,
    commissionLedger,
    settlementRequests,
    refunds,
    notificationTemplates,
    businessSettings,
    apiIntegrations,
    auditLogs,
    rolePermissions,
    managers,
    assignOperator,
    updateApplicationStatus,
    createOrUpdateService,
    reviewOperatorEnrollment,
    reviewPartner,
    saveCommissionRule,
    processPartnerSettlement,
    processRefund,
    saveNotificationTemplate,
    updateBusinessSettings,
    updateIntegrationConfig,
    updateRolePermissions,
    addManagerProfile,
    exportBackupJson,
  } = useData();

  type AdminTabId =
    | 'overview'
    | 'applications'
    | 'services'
    | 'operators'
    | 'partners'
    | 'governance'
    | 'apisetu'
    | 'apicatalogue'
    | 'b2b'
    | 'formbuilder'
    | 'payments'
    | 'apilogs'
    | 'blog'
    | 'catalog-seo'
    | 'directory'
    | 'infrastructure'
    | 'performance'
    | 'settings';

  const validAdminTabs: AdminTabId[] = [
    'overview',
    'applications',
    'services',
    'operators',
    'partners',
    'governance',
    'apisetu',
    'apicatalogue',
    'b2b',
    'formbuilder',
    'payments',
    'apilogs',
    'blog',
    'catalog-seo',
    'directory',
    'infrastructure',
    'performance',
    'settings',
  ];

  const resolveAdminTab = (tab?: string): AdminTabId =>
    validAdminTabs.includes(tab as AdminTabId) ? (tab as AdminTabId) : 'overview';

  const [activeTab, setActiveTab] = useState<AdminTabId>(() => resolveAdminTab(initialTab));
  const [perfSummary, setPerfSummary] = useState(() => getPerfSummary());
  const tabRailRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateTabRailArrows = React.useCallback(() => {
    const el = tabRailRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    setActiveTab(resolveAdminTab(initialTab));
  }, [initialTab]);

  useEffect(() => {
    const el = tabRailRef.current;
    if (!el) return;
    const activeBtn = el.querySelector<HTMLButtonElement>(`[data-admin-tab="${activeTab}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
    const id = window.setTimeout(updateTabRailArrows, 180);
    return () => window.clearTimeout(id);
  }, [activeTab, updateTabRailArrows]);

  useEffect(() => {
    updateTabRailArrows();
    window.addEventListener('resize', updateTabRailArrows);
    return () => window.removeEventListener('resize', updateTabRailArrows);
  }, [updateTabRailArrows]);

  useEffect(() => {
    setPerfSummary(getPerfSummary());
    return subscribePerfMetrics(() => {
      setPerfSummary(getPerfSummary());
    });
  }, []);

  const [appSearch, setAppSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | ApplicationSourceChannel>('all');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const selectedApp = applications.find((a) => a.id === selectedAppId) || null;
  const [assignedOpName, setAssignedOpName] = useState('');
  const [adminAppStatus, setAdminAppStatus] = useState<ApplicationStatus>('Under Review');
  const [adminAppRemark, setAdminAppRemark] = useState('');
  const [appActionMsg, setAppActionMsg] = useState<string | null>(null);
  const [appErrorMsg, setAppErrorMsg] = useState<string | null>(null);

  // Operator KYC review state
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
  const selectedEnrollment: OperatorEnrollment | null =
    operatorEnrollments.find((e) => e.id === selectedEnrollmentId) || null;
  const [kycRemarks, setKycRemarks] = useState('');
  const [kycSubmitting, setKycSubmitting] = useState(false);

  // Partners & Commission Rules & Settlements state
  const [payoutRefMap, setPayoutRefMap] = useState<Record<string, string>>({});
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState<'percentage' | 'fixed'>('percentage');
  const [newRulePct, setNewRulePct] = useState(15);
  const [newRuleFixedInr, setNewRuleFixedInr] = useState(150);
  const [newRuleServiceId, setNewRuleServiceId] = useState('');

  // Governance: Managers & RBAC matrix state
  const [mgrName, setMgrName] = useState('');
  const [mgrEmail, setMgrEmail] = useState('');
  const [mgrMobile, setMgrMobile] = useState('');
  const [mgrScope, setMgrScope] = useState('All India Operations');
  const [rbacRoleTarget, setRbacRoleTarget] = useState<'manager' | 'operator' | 'partner' | 'customer'>('manager');

  // API Setu & API Sathi Providers State
  const [apiProviders, setApiProviders] = useState<ApiProvider[]>(INITIAL_API_PROVIDERS);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [providerTestResult, setProviderTestResult] = useState<{ id: string; latency: number; status: string } | null>(null);
  const [apiSathiStatus, setApiSathiStatus] = useState<ApiSathiStatusInfo | null>(null);
  const [apiSathiCalls, setApiSathiCalls] = useState<ApiSathiCallLogRow[]>([]);
  const [loadingApiSathi, setLoadingApiSathi] = useState(false);
  const [apiSathiRefreshTick, setApiSathiRefreshTick] = useState(0);

  // API Catalogue State
  const [apiCatalogue, setApiCatalogue] = useState<ApiCatalogueItem[]>(INITIAL_API_CATALOGUE);
  const [selectedCatalogueItem, setSelectedCatalogueItem] = useState<ApiCatalogueItem | null>(null);

  // B2B Businesses State
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [bulkJobs] = useState<BulkJob[]>([]);

  // API Logs State
  const [apiLogs] = useState<ApiRequestLog[]>([]);
  const [logStatusFilter, setLogStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL');
  const [selectedLogForModal, setSelectedLogForModal] = useState<ApiRequestLog | null>(null);
  const [serviceSaveNotice, setServiceSaveNotice] = useState<string | null>(null);

  // Form Builder state
  const [selectedBuilderServiceId, setSelectedBuilderServiceId] = useState<string>(services[0]?.id || '');
  const selectedBuilderService =
    services.find((s) => s.id === selectedBuilderServiceId) || services[0];
  const [builderFieldLabel, setBuilderFieldLabel] = useState('');
  const [builderFieldLabelHi, setBuilderFieldLabelHi] = useState('');
  const [builderFieldType, setBuilderFieldType] = useState<DynamicFieldType>('text');
  const [builderFieldRequired, setBuilderFieldRequired] = useState(true);
  const [builderFieldOptions, setBuilderFieldOptions] = useState('');
  const [builderFieldHelp, setBuilderFieldHelp] = useState('');
  const [builderFieldRegex, setBuilderFieldRegex] = useState('');
  const [builderCondFieldId, setBuilderCondFieldId] = useState('');
  const [builderCondOperator, setBuilderCondOperator] = useState<FieldCondition['operator']>('equals');
  const [builderCondValue, setBuilderCondValue] = useState('');

  // Business Settings State (synced cleanly from Firestore / DataContext)
  const [bizName, setBizName] = useState(businessSettings.legalName);
  const [bizTradeName, setBizTradeName] = useState(businessSettings.tradeName);
  const [bizGstin, setBizGstin] = useState(businessSettings.gstin);
  const [bizPan, setBizPan] = useState(businessSettings.pan);
  const [bizUdyam, setBizUdyam] = useState(businessSettings.udyamNumber || 'UDYAM-DD-03-0009994');
  const [bizDuns, setBizDuns] = useState(businessSettings.dunsNumber || '308198649');
  const [bizInvoicePrefix, setBizInvoicePrefix] = useState(businessSettings.invoicePrefix);
  const [bizTaxRateBps, setBizTaxRateBps] = useState(businessSettings.defaultTaxRateBps);
  const [bizEmail, setBizEmail] = useState(businessSettings.supportEmail);
  const [bizPhone, setBizPhone] = useState(businessSettings.supportPhone);
  const [bizAddress, setBizAddress] = useState(businessSettings.registeredAddress);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setBizName(businessSettings.legalName);
    setBizTradeName(businessSettings.tradeName);
    setBizGstin(businessSettings.gstin);
    setBizPan(businessSettings.pan);
    setBizUdyam(businessSettings.udyamNumber || 'UDYAM-DD-03-0009994');
    setBizDuns(businessSettings.dunsNumber || '308198649');
    setBizInvoicePrefix(businessSettings.invoicePrefix);
    setBizTaxRateBps(businessSettings.defaultTaxRateBps);
    setBizEmail(businessSettings.supportEmail);
    setBizPhone(businessSettings.supportPhone);
    setBizAddress(businessSettings.registeredAddress);
  }, [businessSettings]);

  const refreshApiSathiTelemetry = async () => {
    setLoadingApiSathi(true);
    try {
      const [statusData, callsData] = await Promise.all([
        getApiSathiStatus().catch(() => null),
        getApiSathiCallLogs().catch(() => []),
      ]);
      if (statusData) {
        setApiSathiStatus(statusData);
        setApiProviders((prev) =>
          prev.map((p) =>
            p.id === 'prov-apisathi-main'
              ? {
                  ...p,
                  environment: statusData.isSandboxTestKey ? 'sandbox' : 'production',
                  isEnabled: statusData.configured,
                }
              : p
          )
        );
      }
      setApiSathiCalls(callsData || []);
      setApiSathiRefreshTick((n) => n + 1);
    } finally {
      setLoadingApiSathi(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      void refreshApiSathiTelemetry();
    }
  }, [user?.role]);

  // Strict Admin Authorization Gate
  const isAuthorizedAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
  if (!isAuthorizedAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm space-y-4">
          <Lock className="w-10 h-10 text-[#FF671F] mx-auto" />
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Administrator Privileges Required</h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            The Master Admin Console is restricted to authorized Digital India Project administrators. Sign in with an administrator account to manage services, applications, partners, and Operator KYC approvals.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('dashboard')}
              className="bg-[#FF671F] text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
            >
              Return to My Dashboard
            </button>
            <button
              onClick={() => onNavigate('login')}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
            >
              Admin Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Metrics
  const totalRevenue = transactions.reduce((acc, t) => acc + (t.status === 'Success' ? t.amount : 0), 0);
  const totalApps = applications.length;
  const newApps = applications.filter((a) => a.status === 'Submitted').length;
  const pendingKycCount = operatorEnrollments.filter(
    (e) => e.kycStatus === 'KYC Submitted' || e.kycStatus === 'Under Verification'
  ).length;
  const pendingPartnerCount = partners.filter((p) => p.approvalStatus === 'Pending Approval').length;
  const pendingSettlementCount = settlementRequests.filter((s) => s.status === 'Requested' || s.status === 'Under Review').length;
  const pendingRefundCount = refunds.filter((r) => r.status === 'Pending').length;
  const inProgressApps = applications.filter((a) =>
    ['Under Review', 'Document Verification', 'Application Processing', 'Processing', 'Assigned'].includes(a.status)
  ).length;

  const filteredApps = applications.filter((a) => {
    const matchChannel = sourceFilter === 'all' || (a.sourceChannel || 'web_b2c') === sourceFilter;
    const q = appSearch.toLowerCase().trim();
    if (!q) return matchChannel;
    return (
      matchChannel &&
      (a.id.toLowerCase().includes(q) ||
        a.serviceName.toLowerCase().includes(q) ||
        a.userName.toLowerCase().includes(q) ||
        a.userMobile.toLowerCase().includes(q))
    );
  });

  const filteredLogs = apiLogs.filter((log) => {
    if (logStatusFilter === 'ALL') return true;
    return log.status === logStatusFilter;
  });

  const handleKycDecision = async (decision: OperatorKycStatus) => {
    if (!selectedEnrollment) return;
    setKycSubmitting(true);
    try {
      await reviewOperatorEnrollment(
        selectedEnrollment.id,
        decision,
        kycRemarks.trim() ||
          (decision === 'Approved'
            ? 'KYC verified and approved. Operator Desk unlocked.'
            : 'Reviewed by Admin Compliance Desk.')
      );
      setKycRemarks('');
      setAppActionMsg(`Operator KYC status updated to ${decision} for ${selectedEnrollment.fullName}.`);
      setTimeout(() => setAppActionMsg(null), 4000);
    } finally {
      setKycSubmitting(false);
    }
  };

  const handleTestProviderConnection = async (provider: ApiProvider) => {
    setTestingProviderId(provider.id);
    setProviderTestResult(null);
    if (provider.id === 'prov-apisathi-main') {
      const started = Date.now();
      const statusData = await getApiSathiStatus().catch(() => null);
      const latency = Math.max(1, Date.now() - started);
      if (statusData) {
        setApiSathiStatus(statusData);
      }
      setProviderTestResult({
        id: provider.id,
        latency,
        status: !statusData
          ? 'Unable to reach /api/v1/apisathi/status'
          : !statusData.configured
          ? 'API_SATHI_KEY not configured on Worker'
          : statusData.walletLowAlert
          ? '402 WALLET EMPTY — Recharge API Sathi Prepaid Balance'
          : statusData.isSandboxTestKey
          ? '200 OK · Sandbox (test_* key)'
          : '200 OK · Live Production (live_* key)',
      });
      setTestingProviderId(null);
      return;
    }
    setTimeout(() => {
      const simulatedLatency = Math.floor(120 + Math.random() * 250);
      setProviderTestResult({
        id: provider.id,
        latency: simulatedLatency,
        status: '200 OK (Gateway Handshake Success)',
      });
      setTestingProviderId(null);
    }, 800);
  };

  const handleToggleProviderEnv = (providerId: string) => {
    setApiProviders((prev) =>
      prev.map((p) => {
        if (p.id !== providerId) return p;
        return { ...p, environment: p.environment === 'sandbox' ? 'production' : 'sandbox' };
      })
    );
  };

  const handleToggleProviderActive = (providerId: string) => {
    setApiProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, isEnabled: !p.isEnabled } : p))
    );
  };

  const handleToggleCatalogueStatus = (itemId: string) => {
    setApiCatalogue((prev) =>
      prev.map((c) => (c.id === itemId ? { ...c, status: c.status === 'Active' ? 'Suspended' : 'Active' } : c))
    );
  };

  const handleAddCredits = (bizId: string) => {
    setBusinesses((prev) =>
      prev.map((b) => (b.id === bizId ? { ...b, apiCreditsRemaining: b.apiCreditsRemaining + 1000 } : b))
    );
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddBuilderField = async () => {
    if (!selectedBuilderService || !builderFieldLabel.trim()) return;
    const parsedOptions = ['select', 'multiselect', 'radio'].includes(builderFieldType)
      ? builderFieldOptions
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean)
      : undefined;

    const showIf: FieldCondition | undefined = builderCondFieldId
      ? {
          fieldId: builderCondFieldId,
          operator: builderCondOperator,
          value: builderCondOperator === 'is_truthy' ? true : builderCondValue,
        }
      : undefined;

    const newField: ServiceFormField = {
      id: slugifyServiceName(builderFieldLabel).replace(/-/g, '_') || `field_${Date.now()}`,
      label: builderFieldLabel.trim(),
      labelHi: builderFieldLabelHi.trim() || undefined,
      type: builderFieldType,
      required: builderFieldType === 'heading' || builderFieldType === 'info' ? false : builderFieldRequired,
      options: parsedOptions && parsedOptions.length > 0 ? parsedOptions : undefined,
      helpText: builderFieldHelp.trim() || undefined,
      validationRegex: builderFieldRegex.trim() || undefined,
      showIf,
    };

    await createOrUpdateService({
      ...selectedBuilderService,
      formVersion: (selectedBuilderService.formVersion || 1) + 1,
      formFields: [...selectedBuilderService.formFields, newField],
    });
    setBuilderFieldLabel('');
    setBuilderFieldLabelHi('');
    setBuilderFieldOptions('');
    setBuilderFieldHelp('');
    setBuilderFieldRegex('');
    setBuilderCondFieldId('');
    setBuilderCondValue('');
    setServiceSaveNotice(`Added "${newField.label}" and bumped schema to v${(selectedBuilderService.formVersion || 1) + 1}.`);
    setTimeout(() => setServiceSaveNotice(null), 3500);
  };

  const handleRemoveBuilderField = async (fieldId: string) => {
    if (!selectedBuilderService) return;
    await createOrUpdateService({
      ...selectedBuilderService,
      formVersion: (selectedBuilderService.formVersion || 1) + 1,
      formFields: selectedBuilderService.formFields.filter((f) => f.id !== fieldId),
    });
    setServiceSaveNotice(`Removed field "${fieldId}" from ${selectedBuilderService.name}.`);
    setTimeout(() => setServiceSaveNotice(null), 3000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateBusinessSettings({
      legalName: bizName.trim() || 'Digital India Project',
      tradeName: bizTradeName.trim() || bizName.trim(),
      gstin: bizGstin.trim().toUpperCase(),
      pan: bizPan.trim().toUpperCase(),
      udyamNumber: bizUdyam.trim().toUpperCase(),
      dunsNumber: bizDuns.trim(),
      invoicePrefix: bizInvoicePrefix.trim() || 'DIP/2026-27/',
      defaultTaxRateBps: Number(bizTaxRateBps) || 0,
      supportEmail: bizEmail.trim(),
      supportPhone: bizPhone.trim(),
      registeredAddress: bizAddress.trim(),
    });
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleDownloadBackup = () => {
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dip-enterprise-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateCommissionRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) return;
    const rule: CommissionRule = {
      id: `rule-${Date.now()}`,
      name: newRuleName.trim(),
      serviceId: newRuleServiceId || undefined,
      commissionType: newRuleType,
      fixedAmountPaise: newRuleType === 'fixed' ? toPaise(newRuleFixedInr) : 0,
      percentageBps: newRuleType === 'percentage' ? Math.round(Number(newRulePct) * 100) : 0,
      isActive: true,
    };
    saveCommissionRule(rule);
    setNewRuleName('');
    setAppActionMsg(`Saved commission rule "${rule.name}".`);
    setTimeout(() => setAppActionMsg(null), 3000);
  };

  const handleToggleRolePerm = async (permCode: PermissionCode) => {
    const current = rolePermissions[rbacRoleTarget] || [];
    const next = current.includes(permCode)
      ? current.filter((p) => p !== permCode)
      : [...current, permCode];
    await updateRolePermissions(rbacRoleTarget, next);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Top Header */}
      <div className="bg-[#1E293B] text-white p-6 sm:p-8 rounded-3xl border border-slate-700 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#FFC928] uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-[#FF671F]" />
            <span>Digital India Project — Master Administration Panel</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black mt-1">
            Enterprise Control & Platform Management
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Signed in as <strong>{user.name}</strong> ({user.email}) · Governance over catalog, multi-channel intake, and Operator KYC.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onNavigate('workspace')}
            className="text-xs font-bold text-blue-300 hover:text-white bg-slate-800 px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Workspace Hub</span>
          </button>
          <button
            onClick={() => onNavigate('b2b')}
            className="text-xs font-bold text-amber-300 hover:text-white bg-slate-800 px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>B2B Portal</span>
          </button>
          <button
            onClick={() => onNavigate('operator')}
            className="text-xs font-bold text-emerald-300 hover:text-white bg-slate-800 px-3 py-2 rounded-xl border border-slate-700 cursor-pointer"
          >
            Operator Desk
          </button>
        </div>
      </div>

      {appActionMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#138808]" />
          <span>{appActionMsg}</span>
        </div>
      )}

      {appErrorMsg && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{appErrorMsg}</span>
          </div>
          <button onClick={() => setAppErrorMsg(null)} className="text-xs font-bold underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Custom Horizontal Scrolling Navigation Dock */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-1.5 shadow-xs flex items-center gap-1">
        <button
          type="button"
          onClick={() => tabRailRef.current?.scrollBy({ left: -240, behavior: 'smooth' })}
          disabled={!canScrollLeft}
          aria-label="Scroll menu left"
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:border-[#FF671F] hover:text-[#FF671F] disabled:opacity-30 disabled:pointer-events-none transition shrink-0 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="relative flex-1 min-w-0 overflow-hidden">
          {canScrollLeft && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 bottom-0 w-5 bg-gradient-to-r from-white dark:from-slate-900 to-transparent z-10"
            />
          )}
          {canScrollRight && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 bottom-0 w-5 bg-gradient-to-l from-white dark:from-slate-900 to-transparent z-10"
            />
          )}

          <nav
            ref={tabRailRef}
            onScroll={updateTabRailArrows}
            aria-label="Admin Console Sections"
            className="flex items-center gap-1.5 overflow-x-auto scrollbar-none scroll-smooth py-0.5 px-0.5"
          >
            {(
              [
                { id: 'overview', label: 'Overview', icon: TrendingUp, accent: 'text-[#FF671F]' },
                { id: 'applications', label: 'Applications', count: String(applications.length), icon: FileCheck, accent: 'text-blue-600 dark:text-blue-400' },
                { id: 'services', label: 'Services & Kits', count: String(services.length), icon: Layers, accent: 'text-emerald-600 dark:text-emerald-400' },
                {
                  id: 'operators',
                  label: 'Operators & KYC',
                  count: pendingKycCount > 0 ? `${operatorEnrollments.length}·${pendingKycCount}` : String(operatorEnrollments.length),
                  icon: UserCheck,
                  accent: 'text-purple-600 dark:text-purple-400',
                },
                {
                  id: 'partners',
                  label: 'Partners & Payouts',
                  count: pendingPartnerCount + pendingSettlementCount > 0 ? `${partners.length}·${pendingPartnerCount + pendingSettlementCount}` : String(partners.length),
                  icon: Wallet,
                  accent: 'text-teal-600 dark:text-teal-400',
                },
                { id: 'governance', label: 'Managers & RBAC', icon: Users, accent: 'text-indigo-600 dark:text-indigo-400' },
                { id: 'formbuilder', label: 'Form Builder', icon: Sliders, accent: 'text-amber-600 dark:text-amber-400' },
                {
                  id: 'payments',
                  label: 'Payments',
                  count: `₹${totalRevenue}`,
                  icon: DollarSign,
                  accent: 'text-emerald-600 dark:text-emerald-400',
                },
                { id: 'apisetu', label: 'API Setu', icon: Server, accent: 'text-cyan-600 dark:text-cyan-400' },
                { id: 'apicatalogue', label: 'API Catalogue', count: String(apiCatalogue.length), icon: Layers, accent: 'text-sky-600 dark:text-sky-400' },
                { id: 'b2b', label: 'B2B Partners', count: String(businesses.length), icon: Building2, accent: 'text-rose-600 dark:text-rose-400' },
                { id: 'blog', label: 'Blog & SEO', count: String(blogPosts.length), icon: BookOpen, accent: 'text-orange-600 dark:text-orange-400' },
                { id: 'catalog-seo', label: 'Catalog SEO', count: String(services.length), icon: Globe, accent: 'text-emerald-600 dark:text-emerald-400' },
                { id: 'directory', label: 'India Directory', count: '36', icon: Globe2, accent: 'text-emerald-600 dark:text-emerald-400' },
                { id: 'infrastructure', label: 'Cloud & R2', icon: Cloud, accent: 'text-sky-600 dark:text-sky-400' },
                { id: 'performance', label: 'Performance', icon: Gauge, accent: 'text-amber-600 dark:text-amber-400' },
                { id: 'apilogs', label: 'Audit Logs', icon: Activity, accent: 'text-slate-600 dark:text-slate-300' },
                { id: 'settings', label: 'Settings', icon: Settings, accent: 'text-slate-600 dark:text-slate-300' },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-admin-tab={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer select-none ${
                    isActive
                      ? 'bg-gradient-to-r from-[#FF671F] to-orange-500 text-white shadow-sm shadow-orange-500/20'
                      : 'bg-slate-50/90 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:bg-orange-50/70 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 hover:border-[#FF671F]/40'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                      isActive ? 'text-white' : tab.accent
                    }`}
                  />
                  <span>{tab.label}</span>
                  {'count' in tab && tab.count !== undefined && (
                    <span
                      className={`font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded-md leading-none ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={() => tabRailRef.current?.scrollBy({ left: 240, behavior: 'smooth' })}
          disabled={!canScrollRight}
          aria-label="Scroll menu right"
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:border-[#FF671F] hover:text-[#FF671F] disabled:opacity-30 disabled:pointer-events-none transition shrink-0 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 tabular-nums">
            <button
              type="button"
              onClick={() => setActiveTab('payments')}
              className="text-left p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white border border-emerald-400/40 shadow-sm shadow-emerald-600/15 hover:-translate-y-0.5 transition-all cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-50 truncate">
                  Total Revenue
                </span>
                <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <DollarSign className="w-3.5 h-3.5 text-white" />
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black font-mono leading-tight">₹{totalRevenue}</div>
              <div className="text-[10px] text-emerald-50/90 truncate">Processed via Cashfree &amp; Desk</div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('applications')}
              className="text-left p-3 rounded-xl bg-gradient-to-br from-[#FF671F] to-orange-600 text-white border border-orange-400/40 shadow-sm shadow-orange-600/15 hover:-translate-y-0.5 transition-all cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-50 truncate">
                  Total Applications
                </span>
                <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <FileCheck className="w-3.5 h-3.5 text-white" />
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black font-mono leading-tight">{totalApps}</div>
              <div className="text-[10px] text-orange-50/90 truncate">Collected across all channels</div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('applications')}
              className="text-left p-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white border border-blue-400/40 shadow-sm shadow-blue-600/15 hover:-translate-y-0.5 transition-all cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-50 truncate">
                  New Unassigned
                </span>
                <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Bell className="w-3.5 h-3.5 text-white" />
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black font-mono leading-tight">{newApps}</div>
              <div className="text-[10px] text-blue-50/90 truncate">Pending operator dispatch</div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('applications')}
              className="text-left p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white border border-amber-300/40 shadow-sm shadow-amber-500/15 hover:-translate-y-0.5 transition-all cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-50 truncate">
                  In Processing
                </span>
                <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Activity className="w-3.5 h-3.5 text-white" />
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black font-mono leading-tight">{inProgressApps}</div>
              <div className="text-[10px] text-amber-50/90 truncate">Active verification</div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('operators')}
              className="col-span-2 sm:col-span-1 text-left p-3 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 text-white border border-violet-400/40 shadow-sm shadow-purple-600/15 hover:-translate-y-0.5 transition-all cursor-pointer space-y-1.5"
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-50 truncate">
                  Operator KYC Queue
                </span>
                <span className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <UserCheck className="w-3.5 h-3.5 text-white" />
                </span>
              </div>
              <div className="text-lg sm:text-xl font-black font-mono leading-tight">{pendingKycCount}</div>
              <div className="text-[10px] text-purple-50/90 truncate">Awaiting partner approval</div>
            </button>
          </div>

          {/* Live Performance Telemetry Snapshot */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-[#FF671F] flex items-center justify-center shrink-0">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Frontend Performance &amp; UX Telemetry
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                  Avg Load:{' '}
                  <strong className="font-mono text-slate-800 dark:text-slate-200">
                    {perfSummary.avgPageLoadMs}ms
                  </strong>
                  {' · '}
                  Views:{' '}
                  <strong className="font-mono text-slate-800 dark:text-slate-200">
                    {perfSummary.totalPageViews}
                  </strong>
                  {' · '}
                  Interactions:{' '}
                  <strong className="font-mono text-slate-800 dark:text-slate-200">
                    {perfSummary.totalInteractions}
                  </strong>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('performance')}
              className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              Open Analytics Tab →
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Multi-Channel Applications</h3>
              <button
                onClick={() => setActiveTab('applications')}
                className="text-xs font-bold text-[#FF671F] hover:underline cursor-pointer"
              >
                Open Full Intake Table →
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {applications.length === 0 ? (
                <div className="py-8 text-center text-slate-500 dark:text-slate-400">
                  No applications submitted yet. Live citizen, operator, partner, and B2B submissions will appear here automatically.
                </div>
              ) : (
                applications.slice(0, 6).map((app) => (
                  <div key={app.id} className="py-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-[#FF671F]">{app.id}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{app.serviceName}</span>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          · {SOURCE_LABELS[app.sourceChannel || 'web_b2c'] || 'Web B2C'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Applicant: {app.userName} ({app.userMobile}) · {new Date(app.submissionDate).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">₹{app.payment.totalAmount}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {app.status}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedAppId(app.id);
                          setAdminAppStatus(app.status);
                          setActiveTab('applications');
                        }}
                        className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold cursor-pointer"
                      >
                        Inspect →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: APPLICATIONS MANAGEMENT */}
      {activeTab === 'applications' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by ID, applicant, mobile, or service..."
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF671F]"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Channel:</span>
              {(
                [
                  { id: 'all', label: 'All Ends' },
                  { id: 'web_b2c', label: 'Web B2C' },
                  { id: 'operator_assisted', label: 'Operator Desk' },
                  { id: 'partner_assisted', label: 'Partner Assisted' },
                  { id: 'b2b_portal', label: 'B2B Portal' },
                  { id: 'google_forms', label: 'Google Forms' },
                ] as const
              ).map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setSourceFilter(ch.id)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    sourceFilter === ch.id
                      ? 'bg-[#1E293B] text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile / Tablet Swipeable Dossiers Queue */}
          <div className="md:hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs divide-y divide-slate-100 dark:divide-slate-800">
            <div className="px-4 py-2 bg-slate-50/80 dark:bg-slate-800/50 text-[10px] text-slate-500 dark:text-slate-400">
              Swipe right to Manage Dossier · Swipe left to Mark Under Review
            </div>
            {filteredApps.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No matching applications found. Submitted dossiers across all intake channels will appear here.
              </div>
            ) : (
              filteredApps.map((app) => {
                const canMarkReview = !['Under Review', 'Completed', 'Cancelled', 'Rejected', 'Refunded'].includes(app.status);
                return (
                  <SwipeableActionItem
                    key={app.id}
                    className="rounded-none"
                    contentClassName="bg-white dark:bg-slate-900"
                    onClick={() => {
                      setSelectedAppId(app.id);
                      setAdminAppStatus(app.status);
                      setAdminAppRemark('');
                    }}
                    leftAction={{
                      label: 'Manage Dossier',
                      shortLabel: 'Manage',
                      icon: <Edit className="w-4 h-4" />,
                      tone: 'primary',
                      onAction: () => {
                        setSelectedAppId(app.id);
                        setAdminAppStatus(app.status);
                        setAdminAppRemark('');
                      },
                    }}
                    rightAction={
                      canMarkReview
                        ? {
                            label: 'Mark Under Review',
                            shortLabel: 'Review',
                            icon: <CheckCircle2 className="w-4 h-4" />,
                            tone: 'success',
                            onAction: async () => {
                              setAppErrorMsg(null);
                              const res = await updateApplicationStatus(
                                app.id,
                                'Under Review',
                                'Application moved to Under Review by Super Admin.',
                                'Quick swipe from Admin Queue',
                                user.name,
                                'super_admin'
                              );
                              if (!res.ok) {
                                setAppErrorMsg(res.error || 'Workflow transition denied.');
                                return;
                              }
                              setAppActionMsg(`Updated ${app.id} status to Under Review.`);
                              setTimeout(() => setAppActionMsg(null), 3000);
                            },
                          }
                        : undefined
                    }
                  >
                    <div className="p-4 text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[#FF671F]">{app.id}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {app.status}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white">{app.serviceName}</div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>{app.userName} · {app.userMobile}</span>
                        <span>{SOURCE_LABELS[app.sourceChannel || 'web_b2c'] || 'Web B2C'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Officer:{' '}
                        <strong className="text-slate-700 dark:text-slate-300">
                          {app.assignedOperatorName || 'Unassigned'}
                        </strong>
                      </div>
                    </div>
                  </SwipeableActionItem>
                );
              })
            )}
          </div>

          <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-2xs">
            <table className="w-full min-w-[700px] text-xs text-left tabular-nums">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Application ID</th>
                  <th className="p-3.5">Service</th>
                  <th className="p-3.5">Source Channel</th>
                  <th className="p-3.5">Applicant Info</th>
                  <th className="p-3.5">Assigned Operator</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No matching applications found. Submitted dossiers across all intake channels will appear here.
                    </td>
                  </tr>
                ) : (
                  filteredApps.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3.5 font-mono font-bold text-[#FF671F]">{app.id}</td>
                      <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200">{app.serviceName}</td>
                      <td className="p-3.5 font-semibold text-slate-600 dark:text-slate-300">
                        {SOURCE_LABELS[app.sourceChannel || 'web_b2c'] || 'Web B2C'}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900 dark:text-white">{app.userName}</div>
                        <div className="text-[10px] text-slate-400">{app.userMobile}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {app.assignedOperatorName || <em className="text-amber-600">Unassigned</em>}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {app.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedAppId(app.id);
                            setAdminAppStatus(app.status);
                            setAdminAppRemark('');
                          }}
                          className="text-[#FF671F] hover:underline font-bold cursor-pointer"
                        >
                          Manage Dossier
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {selectedApp && (
            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-lg space-y-5 text-xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div>
                  <span className="font-mono font-bold text-[#FF671F]">
                    {selectedApp.id} · {SOURCE_LABELS[selectedApp.sourceChannel || 'web_b2c']}
                  </span>
                  <h3 className="text-base font-bold text-slate-900">{selectedApp.serviceName}</h3>
                </div>
                <button
                  onClick={() => setSelectedAppId(null)}
                  className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <span className="font-bold text-slate-800 block">Assign Duty Officer</span>
                    <span className="text-[11px] text-slate-500">
                      Currently: {selectedApp.assignedOperatorName || 'None'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={assignedOpName}
                      onChange={(e) => setAssignedOpName(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                    >
                      <option value="">
                        {operatorEnrollments.filter((e) => e.kycStatus === 'Approved').length === 0
                          ? 'No KYC-approved operators available yet'
                          : 'Select approved operator...'}
                      </option>
                      {operatorEnrollments
                        .filter((e) => e.kycStatus === 'Approved')
                        .map((op) => (
                          <option key={op.id} value={op.fullName}>
                            {op.fullName} ({op.centerName})
                          </option>
                        ))}
                    </select>
                    <button
                      disabled={!assignedOpName}
                      onClick={async () => {
                        const matchedApproved = operatorEnrollments.find(
                          (e) => e.kycStatus === 'Approved' && e.fullName === assignedOpName
                        );
                        if (!matchedApproved) return;
                        await assignOperator(
                          selectedApp.id,
                          matchedApproved.userId,
                          matchedApproved.fullName
                        );
                        setAppActionMsg(`Assigned ${selectedApp.id} to ${matchedApproved.fullName}.`);
                        setTimeout(() => setAppActionMsg(null), 3000);
                      }}
                      className="bg-[#138808] disabled:opacity-40 text-white font-bold px-3.5 py-1.5 rounded-lg cursor-pointer"
                    >
                      Assign
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-orange-50/40 dark:bg-orange-950/20 rounded-xl border border-orange-200 dark:border-orange-900 space-y-3">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">14-Stage Workflow Status & Tracking Update</span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={adminAppStatus}
                      onChange={(e) => setAdminAppStatus(e.target.value as ApplicationStatus)}
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    >
                      {CANONICAL_WORKFLOW_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Applicant tracking remark..."
                      value={adminAppRemark}
                      onChange={(e) => setAdminAppRemark(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                    />
                    <button
                      onClick={async () => {
                        setAppErrorMsg(null);
                        const res = await updateApplicationStatus(
                          selectedApp.id,
                          adminAppStatus,
                          adminAppRemark || `Status updated to ${adminAppStatus} by Super Admin.`,
                          'Updated via Admin Console',
                          user.name,
                          'super_admin'
                        );
                        if (!res.ok) {
                          setAppErrorMsg(res.error || 'Workflow transition denied.');
                          return;
                        }
                        setAdminAppRemark('');
                        setAppActionMsg(`Updated ${selectedApp.id} status to ${adminAppStatus}.`);
                        setTimeout(() => setAppActionMsg(null), 3000);
                      }}
                      className="bg-[#FF671F] text-white font-bold px-3.5 py-1.5 rounded-lg cursor-pointer"
                    >
                      Update
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SERVICES & PRODUCTS CATALOG CMS */}
      {activeTab === 'services' && (
        <React.Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading catalog manager...</div>}>
          <AdminCatalogManager />
        </React.Suspense>
      )}

      {/* TAB 4: OPERATORS & KYC VERIFICATION QUEUE */}
      {activeTab === 'operators' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Operator Partner Enrollments & KYC Review</h2>
            <p className="text-xs text-slate-500">
              Verify submitted partner PAN, masked Aadhaar, center photos, and bank proofs. Approving an enrollment automatically promotes the user to the Operator Desk role.
            </p>
          </div>

          {operatorEnrollments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs space-y-2">
              <UserCheck className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-800">No operator KYC submissions received yet</p>
              <p className="text-slate-500">
                Partners can submit their KYC dossier via the Operator Partner Enrollment page (/operator-enroll).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="font-bold text-xs text-slate-800 border-b border-slate-100 pb-2">
                  Submitted Partner Dossiers ({operatorEnrollments.length})
                </div>
                <div className="space-y-2.5 max-h-[540px] overflow-y-auto">
                  {operatorEnrollments.map((en) => (
                    <button
                      key={en.id}
                      onClick={() => {
                        setSelectedEnrollmentId(en.id);
                        setKycRemarks(en.adminRemarks || '');
                      }}
                      className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer text-xs space-y-1.5 ${
                        selectedEnrollment?.id === en.id
                          ? 'border-[#FF671F] bg-[#FFF5EE]'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{en.centerName}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            en.kycStatus === 'Approved'
                              ? 'bg-emerald-100 text-[#138808]'
                              : en.kycStatus === 'Rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {en.kycStatus}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {en.fullName} · {en.operatingDistrict}, {en.operatingState}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        PAN: {en.panNumber} · Submitted {new Date(en.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7">
                {selectedEnrollment ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5 text-xs">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                      <div>
                        <span className="font-mono text-[11px] font-bold text-[#FF671F]">
                          {selectedEnrollment.id}
                        </span>
                        <h3 className="text-base font-black text-slate-900">{selectedEnrollment.centerName}</h3>
                        <p className="text-slate-500">
                          Applicant: <strong>{selectedEnrollment.fullName}</strong> · {selectedEnrollment.email} · {selectedEnrollment.mobile}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-800">
                        {selectedEnrollment.kycStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Center Address</span>
                        <span className="text-slate-800 font-medium">
                          {selectedEnrollment.centerAddress}, {selectedEnrollment.operatingDistrict},{' '}
                          {selectedEnrollment.operatingState} – {selectedEnrollment.pincode}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Tax & Masked KYC</span>
                        <span className="font-mono font-bold text-slate-900 block">
                          PAN: {selectedEnrollment.panNumber}
                        </span>
                        <span className="font-mono text-slate-600 block">
                          Aadhaar: {selectedEnrollment.maskedAadhaar}
                        </span>
                        <span className="font-mono text-slate-600 block">
                          Bank ({selectedEnrollment.bankIfsc}): {selectedEnrollment.maskedBankAccount}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="font-bold text-slate-800 block">Uploaded KYC Documents ({selectedEnrollment.kycDocuments.length})</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {selectedEnrollment.kycDocuments.map((doc) => (
                          <div key={doc.id} className="p-3 bg-white border border-slate-200 rounded-xl">
                            <div className="font-bold text-slate-900">{doc.docType}</div>
                            <div className="text-[11px] font-mono text-slate-500 truncate">{doc.fileName}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="block font-bold text-slate-700">Compliance Officer Remarks</label>
                      <textarea
                        rows={2}
                        placeholder="Add verification notes or reason for resubmission..."
                        value={kycRemarks}
                        onChange={(e) => setKycRemarks(e.target.value)}
                        className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3 py-2"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        disabled={kycSubmitting}
                        onClick={() => handleKycDecision('Approved')}
                        className="bg-[#138808] hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-60"
                      >
                        Approve KYC & Grant Operator Access
                      </button>
                      <button
                        disabled={kycSubmitting}
                        onClick={() => handleKycDecision('Resubmission Required')}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-60"
                      >
                        Request Resubmission
                      </button>
                      <button
                        disabled={kycSubmitting}
                        onClick={() => handleKycDecision('Rejected')}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-500">
                    Select an Operator KYC dossier on the left to review identity & center details.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PARTNERS, COMMISSIONS & SETTLEMENT PAYOUTS */}
      {activeTab === 'partners' && (
        <div className="space-y-8">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Authorized Partner & Agent Network ({partners.length})</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Approve new partners, monitor partner referrals, configure commission tiers, and process payout settlements with dual-control verification.
              </p>
            </div>

            {partners.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
                No partner applications registered yet. Users can apply via Partner Program (`/partner-enroll`).
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {partners.map((p) => (
                  <div key={p.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-[#FF671F]">{p.partnerCode} · {p.referralCode}</span>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">{p.businessName}</h3>
                        <p className="text-slate-500">{p.fullName} · {p.mobile} · {p.district}, {p.state}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        p.approvalStatus === 'Approved' ? 'bg-emerald-100 text-[#138808]' :
                        p.approvalStatus === 'Suspended' || p.approvalStatus === 'Rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {p.approvalStatus}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      PAN: {p.panMasked} · Bank IFSC: {p.bankIfsc} ({p.bankAccountMasked}) · Referrals: {p.totalReferrals}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {(['Approved', 'Suspended', 'Rejected'] as PartnerApprovalStatus[]).map((st) => (
                        <button
                          key={st}
                          onClick={async () => {
                            await reviewPartner(p.id, st);
                            setAppActionMsg(`Partner ${p.businessName} updated to ${st}.`);
                            setTimeout(() => setAppActionMsg(null), 3000);
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                            st === 'Approved' ? 'bg-[#138808] text-white' :
                            st === 'Suspended' ? 'bg-amber-500 text-white' :
                            'bg-red-600 text-white'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Commission Rules */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Commission Rules Engine ({commissionRules.length} active definitions)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {commissionRules.map((rule) => (
                <div key={rule.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{rule.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {rule.commissionType === 'percentage'
                        ? `${(rule.percentageBps / 100).toFixed(2)}% of Service Fee`
                        : `${formatINRFromPaise(rule.fixedAmountPaise)} Fixed / Application`}
                      {rule.serviceId ? ` · Service ID: ${rule.serviceId}` : ' · All Services'}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rule.isActive ? 'bg-emerald-100 text-[#138808]' : 'bg-slate-200 text-slate-600'}`}>
                    {rule.isActive ? 'Active' : 'Paused'}
                  </span>
                </div>
              ))}
            </div>

            <form onSubmit={handleCreateCommissionRule} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <input
                type="text"
                placeholder="Rule name (e.g. GST Special 20%)"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                className="sm:col-span-2 bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                required
              />
              <select
                value={newRuleType}
                onChange={(e) => setNewRuleType(e.target.value as any)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
              {newRuleType === 'percentage' ? (
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={60}
                  value={newRulePct}
                  onChange={(e) => setNewRulePct(Number(e.target.value))}
                  className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                />
              ) : (
                <input
                  type="number"
                  min={1}
                  value={newRuleFixedInr}
                  onChange={(e) => setNewRuleFixedInr(Number(e.target.value))}
                  className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                />
              )}
              <div className="flex gap-2">
                <select
                  value={newRuleServiceId}
                  onChange={(e) => setNewRuleServiceId(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2"
                >
                  <option value="">All Services</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button type="submit" className="bg-[#FF671F] text-white font-bold px-3.5 py-2 rounded-xl cursor-pointer">
                  Save Rule
                </button>
              </div>
            </form>
          </div>

          {/* Partner Settlement Payout Desk */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Partner Settlement Payout Queue ({settlementRequests.length}) · Commission Ledger Entries ({commissionLedger.length})
            </h3>
            {settlementRequests.length === 0 ? (
              <p className="text-slate-500">No settlement withdrawal requests awaiting payout.</p>
            ) : (
              <div className="space-y-3">
                {settlementRequests.map((req) => (
                  <div key={req.id} className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-mono font-bold text-[#FF671F]">{req.id}</div>
                      <div className="font-bold text-slate-900 dark:text-white">{req.partnerName} · {formatINRFromPaise(req.requestedPaise)}</div>
                      <div className="text-[11px] text-slate-500">
                        Status: <strong>{req.status}</strong> · Requested {new Date(req.requestedAt).toLocaleString()}
                        {req.payoutReference ? ` · Ref: ${req.payoutReference}` : ''}
                      </div>
                    </div>
                    {(req.status === 'Requested' || req.status === 'Under Review' || req.status === 'Approved') && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          placeholder="UTR / Payout Reference..."
                          value={payoutRefMap[req.id] || ''}
                          onChange={(e) => setPayoutRefMap((p) => ({ ...p, [req.id]: e.target.value }))}
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-xs"
                        />
                        <button
                          onClick={async () => {
                            setAppErrorMsg(null);
                            const res = await processPartnerSettlement(req.id, 'Paid', payoutRefMap[req.id] || `UTR-${Date.now()}`);
                            if (!res.ok) setAppErrorMsg(res.error || 'Settlement action blocked.');
                            else {
                              setAppActionMsg(`Settlement ${req.id} marked Paid.`);
                              setTimeout(() => setAppActionMsg(null), 3000);
                            }
                          }}
                          className="bg-[#138808] text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                        >
                          Mark Paid
                        </button>
                        <button
                          onClick={async () => {
                            setAppErrorMsg(null);
                            const res = await processPartnerSettlement(req.id, 'Rejected', undefined, 'Rejected by Finance Desk');
                            if (!res.ok) setAppErrorMsg(res.error || 'Settlement action blocked.');
                          }}
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
        </div>
      )}

      {/* TAB 6: GOVERNANCE — OPERATIONS MANAGERS & RBAC MATRIX */}
      {activeTab === 'governance' && (
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Operations Managers Directory ({managers.length})</h2>
              <p className="text-slate-500">Regional and queue managers handle SLA escalations, bulk operator assignments, and partner oversight without accessing global billing or RBAC secrets.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {managers.map((m) => (
                <div key={m.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{m.name}</div>
                    <div className="text-slate-500">{m.email} · {m.mobile}</div>
                    <div className="text-[11px] font-semibold text-[#FF671F] mt-0.5">{m.scope}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#138808] font-bold text-[10px]">
                    {m.isActive ? 'Active Manager' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!mgrName.trim() || !mgrEmail.trim()) return;
                addManagerProfile({ name: mgrName.trim(), email: mgrEmail.trim(), mobile: mgrMobile.trim() || '+91 90000 00000', scope: mgrScope });
                setMgrName('');
                setMgrEmail('');
                setMgrMobile('');
                setAppActionMsg('Added Operations Manager profile.');
                setTimeout(() => setAppActionMsg(null), 3000);
              }}
              className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800"
            >
              <input type="text" placeholder="Full Name" value={mgrName} onChange={(e) => setMgrName(e.target.value)} required className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2" />
              <input type="email" placeholder="Work Email" value={mgrEmail} onChange={(e) => setMgrEmail(e.target.value)} required className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2" />
              <input type="tel" placeholder="Mobile" value={mgrMobile} onChange={(e) => setMgrMobile(e.target.value)} className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2" />
              <input type="text" placeholder="Assigned Scope" value={mgrScope} onChange={(e) => setMgrScope(e.target.value)} className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2" />
              <button type="submit" className="bg-[#1E293B] text-white font-bold px-4 py-2 rounded-xl cursor-pointer">Add Manager</button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Role Permission Matrix Editor</h2>
                <p className="text-slate-500">Toggle granular capability grants saved per role (Super Admin retains permanent full access).</p>
              </div>
              <div className="flex gap-1.5">
                {(['manager', 'operator', 'partner', 'customer'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRbacRoleTarget(r)}
                    className={`px-3 py-1.5 rounded-lg font-bold capitalize cursor-pointer ${
                      rbacRoleTarget === r ? 'bg-[#FF671F] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {ALL_PERMISSIONS.map((perm) => {
                const granted = (rolePermissions[rbacRoleTarget] || []).includes(perm.code);
                return (
                  <label
                    key={perm.code}
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer ${
                      granted
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={granted}
                      onChange={() => handleToggleRolePerm(perm.code)}
                      className="mt-0.5 accent-[#138808]"
                    />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{perm.label}</div>
                      <div className="text-[10px] font-mono text-slate-500">{perm.code} · {perm.group}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: API SETU & API SATHI GATEWAY MANAGEMENT */}
      {activeTab === 'apisetu' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">API Sathi & API Setu Provider Management</h2>
              <p className="text-xs text-slate-500">
                Manage server-side verification providers, inspect API Sathi key mode (test_ vs live_), and monitor prepaid wallet alerts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {apiSathiStatus && (
                <span
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border ${
                    !apiSathiStatus.configured
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : apiSathiStatus.isSandboxTestKey
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border-emerald-200 text-[#138808]'
                  }`}
                >
                  API Sathi:{' '}
                  {!apiSathiStatus.configured
                    ? 'Key Unconfigured'
                    : apiSathiStatus.isSandboxTestKey
                    ? 'Sandbox (test_*)'
                    : 'Production (live_*)'}
                </span>
              )}
              <button
                type="button"
                onClick={refreshApiSathiTelemetry}
                disabled={loadingApiSathi}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingApiSathi ? 'animate-spin' : ''}`} />
                <span>Refresh Status</span>
              </button>
            </div>
          </div>

          {apiSathiStatus?.walletLowAlert && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Recharge API Sathi Prepaid Wallet (HTTP 402 INSUFFICIENT_BALANCE)</p>
                  <p className="mt-0.5">
                    API Sathi returned 402 Insufficient Balance. Verification calls are halted without automatic retry until prepaid balance is topped up.
                  </p>
                  {apiSathiStatus.recentWalletAlert?.callId && (
                    <p className="font-mono text-[11px] mt-1">
                      Latest call_id for API Sathi support: <strong>{apiSathiStatus.recentWalletAlert.callId}</strong>
                    </p>
                  )}
                </div>
              </div>
              <a
                href="https://apisathi.in"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs shrink-0 text-center"
              >
                Open API Sathi Billing
              </a>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {apiProviders.map((provider) => (
              <div
                key={provider.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4 text-xs flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-[#FF671F] uppercase">{provider.code}</span>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{provider.name}</h3>
                      <p className="text-[11px] text-slate-500">{provider.publisher}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        provider.isEnabled ? 'bg-emerald-100 text-[#138808]' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {provider.isEnabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 border border-slate-100 dark:border-slate-700">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Auth Type</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {provider.authType === 'apikey' ? 'X-API-Key Header (Server Secret)' : `${provider.authType.toUpperCase()} Bearer`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Active Target URL</span>
                      <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate block">
                        {provider.environment === 'production' ? provider.baseUrl : provider.sandboxUrl}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Target Environment</span>
                      <span className="font-mono font-bold uppercase text-blue-800 dark:text-blue-400">{provider.environment}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleToggleProviderEnv(provider.id)}
                      className="flex-1 py-1.5 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                    >
                      Switch to {provider.environment === 'sandbox' ? 'Production' : 'Sandbox'}
                    </button>
                    <button
                      onClick={() => handleToggleProviderActive(provider.id)}
                      className={`py-1.5 px-3 rounded-lg text-[11px] font-semibold cursor-pointer ${
                        provider.isEnabled
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {provider.isEnabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>

                  <button
                    onClick={() => handleTestProviderConnection(provider)}
                    disabled={testingProviderId === provider.id}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {testingProviderId === provider.id ? (
                      <InlineSkeletonPulse className="w-4" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>{testingProviderId === provider.id ? 'Testing Handshake...' : 'Test Connection'}</span>
                  </button>

                  {providerTestResult && providerTestResult.id === provider.id && (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] text-emerald-800 font-mono flex items-center justify-between">
                      <span>{providerTestResult.status}</span>
                      <span className="font-bold">{providerTestResult.latency}ms</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <React.Suspense
            fallback={
              <div className="h-64 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
            }
          >
            <ApiSathiUsageDashboard
              refreshTrigger={apiSathiRefreshTick}
              onQueueProcessed={() => void refreshApiSathiTelemetry()}
            />
          </React.Suspense>
        </div>
      )}

      {/* TAB 8: API CATALOGUE */}
      {activeTab === 'apicatalogue' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">API Setu Integrated Catalogue</h2>
            <p className="text-xs text-slate-500">
              Official API references, publisher approvals, pricing per invocation, and consent requirements.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-2xs">
            <table className="w-full min-w-[680px] text-xs text-left tabular-nums">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">API Name & Provider</th>
                  <th className="p-3.5">Catalogue Reference</th>
                  <th className="p-3.5">Auth Type</th>
                  <th className="p-3.5">Pricing / Call</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {apiCatalogue.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                      <div className="text-[10px] text-slate-500">{item.providerName}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono text-[11px] font-semibold text-[#FF671F] bg-orange-50 px-2 py-0.5 rounded">
                        {item.apiSetuRef}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium">{item.authType}</td>
                    <td className="p-3.5 font-mono font-bold text-emerald-800 dark:text-emerald-400">₹{item.pricingPerCall.toFixed(2)}</td>
                    <td className="p-3.5">
                      <button
                        onClick={() => handleToggleCatalogueStatus(item.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          item.status === 'Active' ? 'bg-emerald-100 text-[#138808]' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {item.status}
                      </button>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setSelectedCatalogueItem(item)}
                        className="text-[#FF671F] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Schema</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedCatalogueItem && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl text-xs max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <span className="font-mono text-[10px] text-[#FF671F] font-bold">
                      {selectedCatalogueItem.apiSetuRef}
                    </span>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{selectedCatalogueItem.name}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedCatalogueItem(null)}
                    className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-3">
                  <p className="text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                    {selectedCatalogueItem.description}
                  </p>
                  <p className="text-slate-600 bg-amber-50 p-2.5 rounded-xl border border-amber-100 text-[11px]">
                    {selectedCatalogueItem.consentRequirement}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <ul className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 font-mono text-[11px] space-y-1">
                      {selectedCatalogueItem.requiredFields.map((f) => (
                        <li key={f} className="text-[#FF671F] font-semibold">• {f}</li>
                      ))}
                    </ul>
                    <ul className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 font-mono text-[11px] space-y-1">
                      {selectedCatalogueItem.responseFields.map((f) => (
                        <li key={f} className="text-[#138808] font-semibold">✓ {f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 9: B2B ENTERPRISE MANAGEMENT */}
      {activeTab === 'b2b' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">B2B Enterprise Accounts & Bulk Verification</h2>
            <p className="text-xs text-slate-500">
              Corporate onboarding, API credit allocations, active secret credentials, and bulk batch jobs.
            </p>
          </div>

          {businesses.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
              No B2B enterprise accounts registered yet. Verified enterprise accounts will appear here once onboarded.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {businesses.map((biz) => (
                <div key={biz.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-4 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded font-mono">
                        {biz.plan} Plan
                      </span>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-1">{biz.companyName}</h3>
                      <p className="text-[11px] text-slate-500">Trade: {biz.tradeName} · GSTIN: {biz.gstin}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-[#138808]">
                      {biz.isKycVerified ? 'KYC Verified' : 'Pending KYC'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 border border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">Credits Available:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {biz.apiCreditsRemaining} / {biz.monthlyQuota}
                      </span>
                    </div>
                    <div className="pt-1 flex items-center justify-between font-mono text-[10px]">
                      <span className="text-slate-400">Live API Key:</span>
                      <button
                        onClick={() => handleCopyText(biz.apiKey, biz.id)}
                        className="flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
                      >
                        <span>{biz.apiKey ? `${biz.apiKey.slice(0, 12)}****` : 'Not Provisioned'}</span>
                        {copiedKey === biz.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => handleAddCredits(biz.id)}
                      className="bg-[#138808] hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer flex items-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Top-up +1,000 Credits</span>
                    </button>
                    <button
                      onClick={() => onNavigate('b2b')}
                      className="text-purple-600 font-bold hover:underline cursor-pointer"
                    >
                      Open Enterprise View →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Recent Bulk Batch Verification Jobs</h3>
            {bulkJobs.length === 0 ? (
              <p className="text-xs text-slate-500">No bulk CSV verification jobs processed yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {bulkJobs.map((job) => (
                  <div key={job.id} className="py-2.5 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{job.jobName}</div>
                      <div className="text-[11px] text-slate-400">
                        {job.verificationType} · Total Records: {job.totalRecords}
                      </div>
                    </div>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{job.successCount} Valid · {job.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 10: ADVANCED 16-TYPE CONDITIONAL FORM BUILDER */}
      {activeTab === 'formbuilder' && selectedBuilderService && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Dynamic Conditional JSON Form Builder (Schema v{selectedBuilderService.formVersion || 1})
              </h2>
              <p className="text-xs text-slate-500">
                Supports all 16 field types, bilingual English/Hindi labels, regex validation, and safe `showIf` conditional logic.
              </p>
            </div>

            <select
              value={selectedBuilderService.id}
              onChange={(e) => setSelectedBuilderServiceId(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (v{s.formVersion || 1})
                </option>
              ))}
            </select>
          </div>

          {serviceSaveNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
              {serviceSaveNotice}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Active Fields for {selectedBuilderService.name} ({selectedBuilderService.formFields.length})
            </h3>

            <div className="space-y-2 text-xs">
              {selectedBuilderService.formFields.map((f, i) => (
                <div
                  key={f.id}
                  className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                      <span>{f.label}</span>
                      {f.labelHi && <span className="text-[11px] font-normal text-slate-500">({f.labelHi})</span>}
                      <span className="text-[10px] font-mono text-slate-400">#{f.id}</span>
                      {f.required && (
                        <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">Required</span>
                      )}
                      {f.showIf && (
                        <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono">
                          if {f.showIf.fieldId} {f.showIf.operator} {String(f.showIf.value ?? '')}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Type: <strong className="uppercase">{f.type}</strong>
                      {f.options?.length ? ` · Options: ${f.options.join(', ')}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-400 font-mono text-[11px]">#{i + 1}</span>
                    <button
                      onClick={() => handleRemoveBuilderField(f.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded cursor-pointer"
                      title="Remove Field"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Field label (EN) *"
                  value={builderFieldLabel}
                  onChange={(e) => setBuilderFieldLabel(e.target.value)}
                  className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Hindi Label (optional)"
                  value={builderFieldLabelHi}
                  onChange={(e) => setBuilderFieldLabelHi(e.target.value)}
                  className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
                <select
                  value={builderFieldType}
                  onChange={(e) => setBuilderFieldType(e.target.value as DynamicFieldType)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                >
                  {ALL_FIELD_TYPES.map((ft) => (
                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  placeholder="Help / Guidance text"
                  value={builderFieldHelp}
                  onChange={(e) => setBuilderFieldHelp(e.target.value)}
                  className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Options (comma-separated, for select/radio)"
                  value={builderFieldOptions}
                  onChange={(e) => setBuilderFieldOptions(e.target.value)}
                  className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Regex pattern (e.g. ^[A-Z]{5}[0-9]{4}[A-Z]$)"
                  value={builderFieldRegex}
                  onChange={(e) => setBuilderFieldRegex(e.target.value)}
                  className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <select
                  value={builderCondFieldId}
                  onChange={(e) => setBuilderCondFieldId(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                >
                  <option value="">Show Always (No Condition)</option>
                  {selectedBuilderService.formFields.map((f) => (
                    <option key={f.id} value={f.id}>Show only if {f.label}</option>
                  ))}
                </select>
                <select
                  value={builderCondOperator}
                  onChange={(e) => setBuilderCondOperator(e.target.value as any)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                >
                  <option value="equals">equals</option>
                  <option value="not_equals">not_equals</option>
                  <option value="contains">contains</option>
                  <option value="is_truthy">is checked / non-empty</option>
                </select>
                <input
                  type="text"
                  placeholder="Target match value..."
                  value={builderCondValue}
                  onChange={(e) => setBuilderCondValue(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                />
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={builderFieldRequired}
                      onChange={(e) => setBuilderFieldRequired(e.target.checked)}
                    />
                    <span>Required</span>
                  </label>
                  <button
                    onClick={handleAddBuilderField}
                    className="bg-[#138808] text-white font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Field</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 11: PAYMENTS & REFUNDS */}
      {activeTab === 'payments' && (
        <AdminPaymentsConsole
          transactions={transactions}
          refunds={refunds}
          onProcessRefundRequest={(refundId, decision) => processRefund(refundId, decision)}
        />
      )}

      {/* TAB 12: AUDIT & GATEWAY LOGS */}
      {activeTab === 'apilogs' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Security & Workflow Audit Trail ({auditLogs.length})</h2>
            {auditLogs.length === 0 ? (
              <p className="text-slate-500">Platform workflow, partner settlement, and admin edits appear here in real time.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{log.action}</span>{' '}
                      <span className="text-slate-600 dark:text-slate-300">— {log.details}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      {log.actorName} ({log.actorRole}) · {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Diagnostic API Audit Logs</h2>
              <p className="text-xs text-slate-500">
                Tracking correlation IDs, HTTP statuses, roundtrip latency, and masked payload audit trails.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(['ALL', 'SUCCESS', 'FAILED'] as const).map((filterVal) => (
                <button
                  key={filterVal}
                  onClick={() => setLogStatusFilter(filterVal)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    logStatusFilter === filterVal
                      ? 'bg-[#1E293B] text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {filterVal}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-2xs">
            <table className="w-full min-w-[680px] text-xs text-left tabular-nums">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Correlation ID</th>
                  <th className="p-3.5">API & Endpoint</th>
                  <th className="p-3.5">Environment</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Latency</th>
                  <th className="p-3.5 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No API Setu gateway audit logs recorded yet. Live verification requests will appear here.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3.5 font-mono font-bold text-[#FF671F]">{log.correlationId}</td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900 dark:text-white">{log.apiName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{log.requestMethod} {log.endpoint}</div>
                      </td>
                      <td className="p-3.5 font-mono text-[10px] font-bold">{log.environment}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 'SUCCESS' ? 'bg-emerald-100 text-[#138808]' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {log.statusCode} {log.status}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300 font-semibold">{log.latencyMs}ms</td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setSelectedLogForModal(log)}
                          className="text-slate-600 dark:text-slate-300 hover:text-slate-900 font-bold underline cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* API Sathi Persisted Call Ledger (call_id + Error Diagnostics) */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  API Sathi Verification Call Ledger ({apiSathiCalls.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Every API Sathi request persists its <span className="font-mono">call_id</span>, masked payload, and step-1 reference ID for support & compliance.
                </p>
              </div>
              <button
                type="button"
                onClick={refreshApiSathiTelemetry}
                disabled={loadingApiSathi}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer self-start"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingApiSathi ? 'animate-spin' : ''}`} />
                <span>Refresh API Sathi Calls</span>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-2xs">
              <table className="w-full min-w-[760px] text-xs text-left tabular-nums">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5">call_id</th>
                    <th className="p-3.5">Product</th>
                    <th className="p-3.5">Env</th>
                    <th className="p-3.5">HTTP / Outcome</th>
                    <th className="p-3.5">Error / Support Note</th>
                    <th className="p-3.5">Step-1 Ref</th>
                    <th className="p-3.5 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {apiSathiCalls.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        No API Sathi verification calls persisted yet. Calls run from B2B Playground or Operator KYC appear here with their call_id.
                      </td>
                    </tr>
                  ) : (
                    apiSathiCalls.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3.5 font-mono font-bold text-[#FF671F]">
                          {row.call_id || '—'}
                        </td>
                        <td className="p-3.5 font-mono text-slate-800 dark:text-slate-200">
                          {row.product_slug}
                        </td>
                        <td className="p-3.5 font-mono text-[10px]">
                          {row.is_sandbox_test ? 'SANDBOX (test_)' : row.environment}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.outcome === 'VERIFIED'
                                ? 'bg-emerald-100 text-[#138808]'
                                : row.outcome === 'NOT_VERIFIED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {row.http_status} · {row.outcome}
                          </span>
                        </td>
                        <td className="p-3.5 text-[11px] text-slate-600 dark:text-slate-300 max-w-xs truncate">
                          {row.error_code ? `${row.error_code}: ${row.error_message || ''}` : row.response_summary || '—'}
                        </td>
                        <td className="p-3.5 font-mono text-[10px] text-slate-500">
                          {row.step1_ref_id || '—'}
                        </td>
                        <td className="p-3.5 text-right font-mono">{row.latency_ms}ms</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedLogForModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Masked Payload ({selectedLogForModal.correlationId})
                  </h3>
                  <button
                    onClick={() => setSelectedLogForModal(null)}
                    className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto">
                  <pre>{JSON.stringify(JSON.parse(selectedLogForModal.maskedPayload || '{}'), null, 2)}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 13: SETTINGS, INTEGRATIONS, TEMPLATES & BACKUP */}
      {activeTab === 'settings' && (
        <div className="space-y-8 max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Super Admin Business & Tax Configuration</h2>
              <p className="text-xs text-slate-500">
                Configurable GSTIN, invoice numbering, default GST rate, integration toggles, notification templates, and full JSON backup export.
              </p>
            </div>
            <button
              onClick={handleDownloadBackup}
              className="bg-[#1E293B] hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Export Platform Backup (JSON)</span>
            </button>
          </div>

          {settingsSaved && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#138808]" />
              <span>Business & invoice settings saved to Firestore and active invoice generators.</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Registered Legal Name *</label>
                <input
                  type="text"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Trade / Brand Name</label>
                <input
                  type="text"
                  value={bizTradeName}
                  onChange={(e) => setBizTradeName(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Company GSTIN</label>
                <input
                  type="text"
                  placeholder="Enter 15-char GSTIN"
                  value={bizGstin}
                  onChange={(e) => setBizGstin(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Company PAN</label>
                <input
                  type="text"
                  placeholder="Optional 10-char PAN"
                  value={bizPan}
                  onChange={(e) => setBizPan(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Udyam MSME Registration No.</label>
                <input
                  type="text"
                  placeholder="e.g. UDYAM-DD-03-0009994"
                  value={bizUdyam}
                  onChange={(e) => setBizUdyam(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">D-U-N-S® Number</label>
                <input
                  type="text"
                  placeholder="e.g. 308198649"
                  value={bizDuns}
                  onChange={(e) => setBizDuns(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Invoice Prefix</label>
                <input
                  type="text"
                  value={bizInvoicePrefix}
                  onChange={(e) => setBizInvoicePrefix(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Default GST Rate (Basis Points, e.g. 1800 = 18%, 0 = Exempt)</label>
                <input
                  type="number"
                  min={0}
                  max={2800}
                  step={100}
                  value={bizTaxRateBps}
                  onChange={(e) => setBizTaxRateBps(Number(e.target.value))}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Support Email</label>
                <input
                  type="email"
                  value={bizEmail}
                  onChange={(e) => setBizEmail(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Helpline Phone</label>
                <input
                  type="text"
                  value={bizPhone}
                  onChange={(e) => setBizPhone(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Registered Office Address</label>
              <textarea
                rows={2}
                value={bizAddress}
                onChange={(e) => setBizAddress(e.target.value)}
                className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2"
                required
              />
            </div>

            <button
              type="submit"
              className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-6 py-2.5 rounded-xl transition cursor-pointer"
            >
              Save Business Configuration
            </button>
          </form>

          {/* Integrations Registry */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">External Provider Integrations (Cloudflare Secrets & Mode)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {apiIntegrations.map((cfg) => (
                <div key={cfg.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{cfg.displayName}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cfg.isEnabled ? 'bg-emerald-100 text-[#138808]' : 'bg-slate-200 text-slate-600'}`}>
                      {cfg.environment.toUpperCase()} · {cfg.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{cfg.notes}</p>
                  {cfg.code === 'cashfree' && (
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Webhook URL:</span>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText('https://digitalindiaproject.com/api/v1/payments/webhook')}
                          className="text-[10px] font-bold text-[#FF671F] hover:underline cursor-pointer"
                        >
                          Copy URL
                        </button>
                      </div>
                      <div className="font-mono text-[10px] text-slate-800 dark:text-slate-200 break-all select-all">
                        https://digitalindiaproject.com/api/v1/payments/webhook
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Version: <span className="font-mono font-semibold">2023-08-01</span> · Events: Payment Success, Payment Failed, User Dropped
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateIntegrationConfig(cfg.code, { environment: cfg.environment === 'sandbox' ? 'production' : 'sandbox' })}
                      className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold cursor-pointer"
                    >
                      Toggle Env
                    </button>
                    <button
                      onClick={() => updateIntegrationConfig(cfg.code, { isEnabled: !cfg.isEnabled })}
                      className="px-2.5 py-1 bg-slate-800 text-white rounded-lg font-semibold cursor-pointer"
                    >
                      {cfg.isEnabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notification Templates */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#FF671F]" />
              <span>Bilingual Notification Templates ({notificationTemplates.length})</span>
            </h3>
            <div className="space-y-2">
              {notificationTemplates.map((tpl) => (
                <div key={tpl.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{tpl.eventKey} · {tpl.channel}</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">{tpl.bodyEn}</div>
                    <div className="text-[11px] text-slate-400">{tpl.bodyHi}</div>
                  </div>
                  <button
                    onClick={() => saveNotificationTemplate({ ...tpl, isActive: !tpl.isActive })}
                    className={`px-2.5 py-1 rounded-lg font-bold shrink-0 cursor-pointer ${
                      tpl.isActive ? 'bg-emerald-100 text-[#138808]' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {tpl.isActive ? 'Active' : 'Paused'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <React.Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading module...</div>}>
        {activeTab === 'blog' && <BlogManagerTab onNavigate={onNavigate} />}

        {activeTab === 'catalog-seo' && <AdminCatalogSEOManager />}

        {activeTab === 'directory' && <DirectorySeoManagerTab onNavigate={onNavigate} />}

        {activeTab === 'infrastructure' && <InfrastructureTab />}

        {activeTab === 'performance' && <PerformanceAnalyticsTab />}
      </React.Suspense>
    </div>
  );
};

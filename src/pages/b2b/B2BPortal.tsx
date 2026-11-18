import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { apiSetuService } from '../../services/apiSetuService';
import { Business, VerificationRequest, BulkJob, StandardApiResponse } from '../../types';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  Download,
  Key,
  Webhook,
  Play,
  Clock,
  AlertCircle,
  Copy,
  Users,
  Search,
  RefreshCw,
  Sliders,
  DollarSign,
  ArrowRight,
  ExternalLink,
  Lock,
} from 'lucide-react';
import {
  fetchB2BProfile,
  saveB2BProfile,
  rotateB2BApiKey,
  fetchB2BMembers,
  addB2BMember,
  fetchB2BBulkJobs,
} from '../../services/backendApi';
import {
  InlineSkeletonPulse,
  SkeletonBlock,
} from '../../components/common/SkeletonLoaders';
import { ApiSathiVerificationConsole } from '../../components/verification/ApiSathiVerificationConsole';
import type { ApiSathiVerificationResponse } from '../../services/apiSathiService';

type B2BTabId = 'overview' | 'playground' | 'bulk' | 'apikeys' | 'team' | 'history';

export const B2BPortal: React.FC<{ initialTab?: string; onNavigate: (route: string) => void }> = ({
  initialTab = 'overview',
  onNavigate,
}) => {
  const { user } = useAuth();
  const { services, createApplication } = useData();
  const resolveB2bTab = (t?: string): B2BTabId =>
    (['overview', 'playground', 'bulk', 'apikeys', 'team', 'history'].includes(t || '')
      ? (t as B2BTabId)
      : 'overview');
  const [activeTab, setActiveTab] = useState<B2BTabId>(() => resolveB2bTab(initialTab));

  const [kybEditOpen, setKybEditOpen] = useState(initialTab === 'kyc');

  useEffect(() => {
    setActiveTab(resolveB2bTab(initialTab));
    if (initialTab === 'kyc') {
      setKybEditOpen(true);
    }
  }, [initialTab]);

  const [business, setBusiness] = useState<Business>(() => ({
    id: user?.businessId || user?.id || 'pending-b2b',
    companyName: user?.companyName || user?.name || 'Enterprise Account',
    tradeName: user?.companyName || user?.name || '—',
    gstin: '',
    pan: '',
    businessType: 'Private Limited',
    industry: 'Enterprise Services',
    registeredAddress: 'Corporate address & KYB details will appear after enterprise verification.',
    contactEmail: user?.email || '',
    contactPhone: user?.mobile || '',
    plan: 'Starter',
    apiCreditsRemaining: 0,
    monthlyQuota: 0,
    apiKey: '',
    webhookSecret: '',
    webhookUrl: '',
    isKycVerified: Boolean(user?.businessId),
    createdAt: user?.createdAt || new Date().toISOString(),
  }));

  const [kybForm, setKybForm] = useState({
    companyName: user?.companyName || user?.name || '',
    gstin: '',
    pan: '',
    contactPhone: user?.mobile || '',
    registeredAddress: '',
    webhookUrl: '',
  });
  const [savingKyb, setSavingKyb] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);

  const [b2bMembers, setB2bMembers] = useState<Array<{ id: string; email: string; name?: string; role: string }>>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'ADMIN' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [addingMember, setAddingMember] = useState(false);

  const [verifications, setVerifications] = useState<VerificationRequest[]>([]);
  const [bulkJobs, setBulkJobs] = useState<BulkJob[]>([]);
  const [bulkReportCsvs, setBulkReportCsvs] = useState<Record<string, string>>({});
  const [portalNotice, setPortalNotice] = useState<string | null>(null);
  const [b2bServiceSlug, setB2bServiceSlug] = useState(services.find((s) => s.b2bSupported)?.slug || services[0]?.slug || 'gst-registration');
  const [b2bContactPerson, setB2bContactPerson] = useState(user?.name || 'Authorized Signatory');
  const [b2bSubmitting, setB2bSubmitting] = useState(false);
  const [b2bCreatedId, setB2bCreatedId] = useState<string | null>(null);

  // Playground state
  const [playgroundProvider, setPlaygroundProvider] = useState<'apisathi' | 'apisetu'>('apisathi');
  const [playgroundApi, setPlaygroundApi] = useState<string>('in.gov.gst.verify');
  const [queryInput, setQueryInput] = useState<string>('');
  const [secondaryInput, setSecondaryInput] = useState<string>('');
  const [playgroundLoading, setPlaygroundLoading] = useState<boolean>(false);
  const [playgroundResult, setPlaygroundResult] = useState<StandardApiResponse | null>(null);

  // Bulk Upload state
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkType, setBulkType] = useState<string>('GSTIN Batch Verification');
  const [bulkProcessing, setBulkProcessing] = useState<boolean>(false);

  const showNotice = (msg: string) => {
    setPortalNotice(msg);
    setTimeout(() => setPortalNotice(null), 5000);
  };

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    void Promise.all([
      fetchB2BProfile().catch(() => null),
      fetchB2BMembers().catch(() => null),
      fetchB2BBulkJobs().catch(() => null),
    ]).then(([profRes, memRes, jobRes]) => {
      if (!mounted) return;
      if (profRes?.ok && profRes.data) {
        const d = profRes.data;
        const hydrated: Business = {
          id: d.id || user.businessId || user.id,
          companyName: d.company_name || user.companyName || user.name || 'Enterprise Account',
          tradeName: d.trade_name || d.company_name || '—',
          gstin: d.gstin || '',
          pan: d.pan || '',
          businessType: d.business_type || 'Private Limited',
          industry: d.industry || 'Enterprise Services',
          registeredAddress: d.registered_address || 'India',
          contactEmail: d.contact_email || user.email || '',
          contactPhone: d.contact_phone || user.mobile || '',
          plan: (d.plan as Business['plan']) || 'Starter',
          apiCreditsRemaining: Number(d.api_credits_remaining ?? 0),
          monthlyQuota: Number(d.monthly_quota ?? 0),
          apiKey: d.api_key || '',
          webhookSecret: d.webhook_secret || '',
          webhookUrl: d.webhook_url || '',
          isKycVerified: Boolean(d.is_kyc_verified),
          createdAt: d.created_at || user.createdAt || new Date().toISOString(),
        };
        setBusiness(hydrated);
        setKybForm({
          companyName: hydrated.companyName,
          gstin: hydrated.gstin,
          pan: hydrated.pan,
          contactPhone: hydrated.contactPhone,
          registeredAddress: hydrated.registeredAddress,
          webhookUrl: hydrated.webhookUrl || '',
        });
      }
      if (memRes?.ok && Array.isArray(memRes.data)) {
        setB2bMembers(
          memRes.data.map((m: any) => ({
            id: m.id,
            email: m.email || m.user_id,
            name: m.name || 'Team Member',
            role: m.role || 'MEMBER',
          }))
        );
      }
      if (jobRes?.ok && Array.isArray(jobRes.data) && jobRes.data.length > 0) {
        setBulkJobs(
          jobRes.data.map((j: any) => ({
            id: j.id,
            businessId: j.business_id,
            jobName: j.job_name,
            verificationType: j.verification_type,
            totalRecords: Number(j.total_records || 0),
            successCount: Number(j.success_count || 0),
            failureCount: Number(j.failure_count || 0),
            status: j.status || 'Completed',
            createdAt: j.created_at,
            completedAt: j.completed_at,
            downloadUrl: j.download_url,
          }))
        );
      }
    });
    return () => {
      mounted = false;
    };
  }, [user?.id, user?.businessId, user?.companyName, user?.name, user?.email, user?.mobile, user?.createdAt]);

  const handleSaveKybProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kybForm.companyName.trim()) return;
    setSavingKyb(true);
    try {
      const res = await saveB2BProfile({
        companyName: kybForm.companyName.trim(),
        gstin: kybForm.gstin.trim().toUpperCase(),
        pan: kybForm.pan.trim().toUpperCase(),
        contactPhone: kybForm.contactPhone.trim(),
        registeredAddress: kybForm.registeredAddress.trim(),
        webhookUrl: kybForm.webhookUrl.trim(),
      });
      if (res.ok) {
        const refreshed = await fetchB2BProfile().catch(() => null);
        if (refreshed?.ok && refreshed.data) {
          setBusiness((prev) => ({
            ...prev,
            id: refreshed.data!.id || prev.id,
            companyName: refreshed.data!.company_name || kybForm.companyName,
            gstin: refreshed.data!.gstin || kybForm.gstin,
            pan: refreshed.data!.pan || kybForm.pan,
            contactPhone: refreshed.data!.contact_phone || kybForm.contactPhone,
            registeredAddress: refreshed.data!.registered_address || kybForm.registeredAddress,
            webhookUrl: refreshed.data!.webhook_url || kybForm.webhookUrl,
            apiKey: refreshed.data!.api_key || prev.apiKey,
            apiCreditsRemaining: Number(refreshed.data!.api_credits_remaining ?? prev.apiCreditsRemaining),
            monthlyQuota: Number(refreshed.data!.monthly_quota ?? prev.monthlyQuota),
          }));
        } else {
          setBusiness((prev) => ({
            ...prev,
            companyName: kybForm.companyName,
            gstin: kybForm.gstin,
            pan: kybForm.pan,
            contactPhone: kybForm.contactPhone,
            registeredAddress: kybForm.registeredAddress,
            webhookUrl: kybForm.webhookUrl,
          }));
        }
        setKybEditOpen(false);
        showNotice('Enterprise KYB profile & webhook settings saved to D1.');
      } else {
        showNotice(res.message || 'Unable to save organization profile.');
      }
    } finally {
      setSavingKyb(false);
    }
  };

  const handleRotateKey = async () => {
    setRotatingKey(true);
    try {
      const res = await rotateB2BApiKey();
      if (res.ok && res.data?.apiKey) {
        setBusiness((prev) => ({ ...prev, apiKey: res.data!.apiKey }));
        showNotice('Production API Key rotated cleanly. Update your integrations with the new key.');
      } else {
        showNotice(res.message || 'Save your KYB profile first before rotating your API key.');
      }
    } finally {
      setRotatingKey(false);
    }
  };

  const handleRunPlayground = async () => {
    if (!queryInput.trim()) return;
    setPlaygroundLoading(true);
    setPlaygroundResult(null);

    const payload: Record<string, any> = { consent: true };
    if (playgroundApi === 'in.gov.gst.verify') payload.gstin = queryInput;
    else if (playgroundApi === 'in.gov.incometax.pan') payload.pan = queryInput;
    else if (playgroundApi === 'in.gov.morth.dl') {
      payload.dlNumber = queryInput;
      payload.dob = secondaryInput;
    } else if (playgroundApi === 'in.gov.msme.udyam') payload.udyamRegNo = queryInput;

    const res = await apiSetuService.executeVerification(playgroundApi, payload);
    setPlaygroundResult(res);
    setPlaygroundLoading(false);

    if (res.success && res.data) {
      const newV: VerificationRequest = {
        id: `vr-${Date.now()}`,
        businessId: business.id,
        verificationType:
          playgroundApi === 'in.gov.gst.verify'
            ? 'GSTIN'
            : playgroundApi === 'in.gov.incometax.pan'
            ? 'PAN'
            : playgroundApi === 'in.gov.morth.dl'
            ? 'Driving_Licence'
            : 'Udyam',
        identifierValue: queryInput,
        status: 'Verified',
        providerRef: res.provider_reference,
        verifiedData: res.data,
        performedAt: new Date().toISOString(),
      };
      setVerifications((prev) => [newV, ...prev]);
    }
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFile) return;

    setBulkProcessing(true);
    try {
      const rawText = await bulkFile.text();
      const rawLines = rawText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.toLowerCase().startsWith('identifier'));

      const rowsToProcess = rawLines.slice(0, 25);
      const apiCode = bulkType.includes('PAN')
        ? 'in.gov.incometax.pan'
        : bulkType.includes('Driving')
        ? 'in.gov.morth.dl'
        : bulkType.includes('Udyam')
        ? 'in.gov.msme.udyam'
        : 'in.gov.gst.verify';

      let successCount = 0;
      let failureCount = 0;
      const reportRows = ['identifier,status,provider_reference,message'];

      for (const line of rowsToProcess) {
        const [identifierRaw, noteRaw] = line.split(',').map((s) => (s || '').trim());
        if (!identifierRaw) continue;
        const payload: Record<string, any> = { consent: true };
        if (apiCode === 'in.gov.gst.verify') payload.gstin = identifierRaw;
        else if (apiCode === 'in.gov.incometax.pan') payload.pan = identifierRaw;
        else if (apiCode === 'in.gov.morth.dl') {
          payload.dlNumber = identifierRaw;
          payload.dob = noteRaw || '';
        } else {
          payload.udyamRegNo = identifierRaw;
        }
        const res = await apiSetuService.executeVerification(apiCode, payload);
        if (res.success) successCount += 1;
        else failureCount += 1;
        reportRows.push(
          `"${identifierRaw.replace(/"/g, '""')}","${res.status}","${res.provider_reference}","${(res.message || '').replace(/"/g, '""')}"`
        );
      }

      const jobId = `bjob-${Date.now()}`;
      const totalRecords = Math.max(rowsToProcess.length, 0);
      const newJob: BulkJob = {
        id: jobId,
        businessId: business.id,
        jobName: bulkFile.name,
        verificationType: bulkType,
        totalRecords,
        successCount,
        failureCount,
        status: totalRecords === 0 ? 'Failed' : 'Completed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      setBulkJobs((prev) => [newJob, ...prev]);
      setBulkReportCsvs((prev) => ({ ...prev, [jobId]: reportRows.join('\n') }));
      setBulkFile(null);
      showNotice(
        totalRecords === 0
          ? `No valid identifier rows found in "${newJob.jobName}".`
          : `Processed ${totalRecords} records (${successCount} succeeded, ${failureCount} failed).`
      );
    } finally {
      setBulkProcessing(false);
    }
  };

  const downloadCsvReport = (job: BulkJob) => {
    const csv =
      bulkReportCsvs[job.id] ||
      `job_id,job_name,verification_type,total_records,success_count,failure_count,status\n"${job.id}","${job.jobName}","${job.verificationType}",${job.totalRecords},${job.successCount},${job.failureCount},"${job.status}"\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${job.jobName.replace(/\.[^.]+$/, '')}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice(`Exported CSV report for ${job.jobName}.`);
  };

  const isAuthorizedB2B =
    user && (user.role === 'business' || user.role === 'admin' || user.role === 'super_admin');

  if (!isAuthorizedB2B) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-4">
          <Lock className="w-10 h-10 text-[#FF671F] mx-auto" />
          <h1 className="text-xl font-black text-slate-900">B2B Enterprise Account Required</h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            The API Setu Playground, Bulk CSV Verification, and Enterprise Quota Portal are reserved for verified Business Partner and Administrator accounts.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('dashboard')}
              className="bg-[#FF671F] text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
            >
              Return to My Dashboard
            </button>
            <button
              onClick={() => onNavigate('register')}
              className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
            >
              Register B2B Partner Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-xs text-slate-700 dark:text-slate-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#202124] to-[#1E293B] text-white p-6 sm:p-8 rounded-3xl border border-slate-700 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#FFC928] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#138808]" />
            <span>Digital India Project — B2B & Enterprise Portal</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black mt-1">
            {user.companyName || business.companyName}
          </h1>
          <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-3">
            <span>GSTIN: <strong className="text-white font-mono">{business.gstin || 'Pending KYB'}</strong></span>
            <span>Plan: <strong className="text-[#FFC928]">{business.plan}</strong></span>
            <span>API Credits: <strong className="text-emerald-400 font-mono">{business.apiCreditsRemaining} remaining</strong></span>
          </div>
        </div>

        {(user.role === 'admin' || user.role === 'super_admin') && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('admin')}
              className="text-xs font-bold text-blue-300 hover:text-white bg-blue-950 px-3 py-2 rounded-xl border border-blue-800 cursor-pointer"
            >
              Admin Console →
            </button>
          </div>
        )}
      </div>

      {portalNotice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2">
          <span>{portalNotice}</span>
          <button onClick={() => setPortalNotice(null)} className="text-emerald-700 dark:text-emerald-300 font-bold underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 text-xs font-bold scrollbar-none">
        {[
          { id: 'overview', label: 'Company Overview & Quota', icon: Building2 },
          { id: 'playground', label: 'API Setu Interactive Playground', icon: Play },
          { id: 'bulk', label: 'Bulk Batch Verification (CSV)', icon: FileSpreadsheet },
          { id: 'apikeys', label: 'API Credentials & Webhooks', icon: Key },
          { id: 'team', label: `Team Members (${b2bMembers.length})`, icon: Users },
          { id: 'history', label: `Verification Audit Trail (${verifications.length})`, icon: Clock },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs transition whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === t.id
                  ? 'bg-[#FF671F] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quota gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 tabular-nums">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Monthly API Quota Usage
              </span>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {business.monthlyQuota - business.apiCreditsRemaining} / {business.monthlyQuota}
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#FF671F] h-full rounded-full"
                  style={{
                    width: `${
                      business.monthlyQuota > 0
                        ? Math.min(100, ((business.monthlyQuota - business.apiCreditsRemaining) / business.monthlyQuota) * 100)
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
              <span className="text-[10px] text-slate-500">Resets on the 1st of next month</span>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Available Credits
              </span>
              <div className="text-2xl font-black text-[#138808] dark:text-emerald-400 font-mono">
                {business.apiCreditsRemaining}
              </div>
              <button
                onClick={() => showNotice('Contact enterprise support to provision API quota credits for your organization.')}
                className="text-[11px] font-bold text-[#FF671F] hover:underline block cursor-pointer"
              >
                + Request Quota Provisioning
              </button>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                KYC & Authorization Status
              </span>
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`w-5 h-5 ${business.isKycVerified ? 'text-[#138808]' : 'text-amber-500'}`} />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {business.isKycVerified ? 'Enterprise Verified' : 'KYB Pending Verification'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Authorized for live queries against API Setu &amp; national registries upon KYB approval.
              </p>
            </div>
          </div>

          {/* Company Details Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Corporate Identity & Tax Registrations</h3>
              <button
                type="button"
                onClick={() => setKybEditOpen((v) => !v)}
                className="text-xs font-bold text-[#FF671F] hover:underline cursor-pointer"
              >
                {kybEditOpen ? 'Cancel Edit' : 'Update KYB Details'}
              </button>
            </div>

            {kybEditOpen ? (
              <form onSubmit={handleSaveKybProfile} className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-semibold mb-1">Company Legal Name *</label>
                  <input
                    type="text"
                    value={kybForm.companyName}
                    onChange={(e) => setKybForm({ ...kybForm, companyName: e.target.value })}
                    required
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">GSTIN (15-char)</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={kybForm.gstin}
                    onChange={(e) => setKybForm({ ...kybForm, gstin: e.target.value.toUpperCase() })}
                    placeholder="26EXIPK0151F1ZQ"
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Company PAN (10-char)</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={kybForm.pan}
                    onChange={(e) => setKybForm({ ...kybForm, pan: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F"
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Contact Mobile</label>
                  <input
                    type="text"
                    value={kybForm.contactPhone}
                    onChange={(e) => setKybForm({ ...kybForm, contactPhone: e.target.value })}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-semibold mb-1">Registered Office Address</label>
                  <input
                    type="text"
                    value={kybForm.registeredAddress}
                    onChange={(e) => setKybForm({ ...kybForm, registeredAddress: e.target.value })}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingKyb}
                    className="bg-[#138808] hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {savingKyb ? 'Saving KYB...' : 'Save KYB & Provision Organization'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Legal Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{business.companyName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Trade Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{business.tradeName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">PAN</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{business.pan || 'Not Provided'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">GSTIN</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{business.gstin || 'Not Provided'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Registered Office</span>
                  <span className="text-slate-700 dark:text-slate-300 leading-relaxed">{business.registeredAddress}</span>
                </div>
              </>
            )}
          </div>

          {/* Direct B2B Application Filing into Unified Pipeline */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Submit Enterprise Service Request</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Initiate GST, DSC, MSME, or Corporate compliance filings billed to your enterprise account and tracked across the unified portal.
              </p>
            </div>

            {b2bCreatedId && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center justify-between gap-2">
                <span>Enterprise Dossier Queued: <strong className="font-mono">{b2bCreatedId}</strong></span>
                <button
                  onClick={() => onNavigate('track')}
                  className="text-[#138808] font-bold hover:underline cursor-pointer"
                >
                  Track Application →
                </button>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setB2bSubmitting(true);
                try {
                  const created = await createApplication(
                    b2bServiceSlug,
                    {
                      full_name: `${business.companyName} (${b2bContactPerson})`,
                      userEmail: user?.email || business.contactEmail,
                      userMobile: user?.mobile || business.contactPhone,
                      gstin: business.gstin,
                    },
                    [
                      {
                        documentType: 'Corporate Authorization & GSTIN',
                        fileName: `${business.gstin || business.id}_Board_Auth.pdf`,
                        fileSize: 420000,
                        mimeType: 'application/pdf',
                      },
                    ],
                    {
                      sourceChannel: 'b2b_portal',
                      businessId: business.id,
                    }
                  );
                  setB2bCreatedId(created.id);
                } finally {
                  setB2bSubmitting(false);
                }
              }}
              className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Enterprise Service</label>
                <select
                  value={b2bServiceSlug}
                  onChange={(e) => setB2bServiceSlug(e.target.value)}
                  className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3 py-2"
                >
                  {services.filter((s) => s.b2bSupported !== false).map((s) => (
                    <option key={s.id} value={s.slug}>
                      {s.name} (₹{s.serviceCharge + s.govtFees})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Authorized Signatory</label>
                <input
                  type="text"
                  value={b2bContactPerson}
                  onChange={(e) => setB2bContactPerson(e.target.value)}
                  required
                  className="w-full bg-[#F7F8FA] border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <button
                type="submit"
                disabled={b2bSubmitting}
                className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-60"
              >
                {b2bSubmitting ? 'Submitting...' : 'Submit B2B Application'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: INTERACTIVE PLAYGROUND */}
      {activeTab === 'playground' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Verification Gateway Provider</h3>
              <p className="text-[11px] text-slate-500">
                Use API Sathi Marketplace (recommended server-side proxy with Idempotency-Key & call_id tracking) or legacy API Setu.
              </p>
            </div>
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setPlaygroundProvider('apisathi')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  playgroundProvider === 'apisathi'
                    ? 'bg-[#FF671F] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                API Sathi Marketplace
              </button>
              <button
                type="button"
                onClick={() => setPlaygroundProvider('apisetu')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  playgroundProvider === 'apisetu'
                    ? 'bg-[#1E293B] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                API Setu
              </button>
            </div>
          </div>

          {playgroundProvider === 'apisathi' ? (
            <ApiSathiVerificationConsole
              isAdmin={user?.role === 'admin' || user?.role === 'super_admin'}
              onVerificationComplete={(res: ApiSathiVerificationResponse, slug: string, primaryInput: string) => {
                const mapSlugToType = (s: string): VerificationRequest['verificationType'] => {
                  if (s.includes('gstin')) return 'GSTIN';
                  if (s.includes('dl') || s.includes('driving')) return 'Driving_Licence';
                  if (s.includes('rc') || s.includes('vehicle')) return 'Vehicle_RC';
                  if (s.includes('udyam')) return 'Udyam';
                  if (s.includes('aadhaar')) return 'Aadhaar_Masked';
                  return 'PAN';
                };
                const newV: VerificationRequest = {
                  id: `vr-${Date.now()}`,
                  businessId: business.id,
                  verificationType: mapSlugToType(slug),
                  identifierValue: primaryInput || slug,
                  status: res.verified ? 'Verified' : res.outcome === 'ERROR' ? 'Failed' : 'Pending',
                  providerRef: res.callId || `apisathi:${slug}`,
                  verifiedData: res.result || undefined,
                  performedAt: new Date().toISOString(),
                };
                setVerifications((prev) => [newV, ...prev]);
              }}
            />
          ) : (
            <>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">API Setu Interactive Verification Console</h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Simulate real-time queries against authorized government endpoints with verified JSON output.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Target API Setu Endpoint</label>
                    <select
                      value={playgroundApi}
                      onChange={(e) => {
                        setPlaygroundApi(e.target.value);
                        setQueryInput('');
                        setPlaygroundResult(null);
                      }}
                      className="w-full bg-[#F7F8FA] border border-slate-300 rounded-xl px-3 py-2 font-medium"
                    >
                      <option value="in.gov.gst.verify">GSTIN Taxpayer Verification (GSTN)</option>
                      <option value="in.gov.incometax.pan">Instant PAN & Aadhaar Seeding (NSDL/ITD)</option>
                      <option value="in.gov.morth.dl">Driving Licence Verification (MoRTH Sarathi)</option>
                      <option value="in.gov.msme.udyam">Udyam MSME Certificate Registry (MSME)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Primary Identifier Value *</label>
                    <input
                      type="text"
                      value={queryInput}
                      onChange={(e) => setQueryInput(e.target.value.toUpperCase())}
                      placeholder={
                        playgroundApi === 'in.gov.gst.verify'
                          ? 'Enter 15-character GSTIN'
                          : playgroundApi === 'in.gov.incometax.pan'
                          ? 'Enter 10-character PAN'
                          : playgroundApi === 'in.gov.morth.dl'
                          ? 'Enter Driving Licence number'
                          : 'Enter Udyam Registration number'
                      }
                      className="w-full bg-[#F7F8FA] border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold"
                    />
                  </div>

                  {playgroundApi === 'in.gov.morth.dl' && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Date of Birth (YYYY-MM-DD)</label>
                      <input
                        type="date"
                        value={secondaryInput}
                        onChange={(e) => setSecondaryInput(e.target.value)}
                        className="w-full bg-[#F7F8FA] border border-slate-300 rounded-xl px-3 py-2 font-mono"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-500">
                    Environment: <strong>Cloudflare Worker Hono API Gateway</strong> · Correlation IDs Tracked
                  </span>
                  <button
                    onClick={handleRunPlayground}
                    disabled={playgroundLoading || !queryInput.trim()}
                    className="bg-[#138808] hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {playgroundLoading ? <InlineSkeletonPulse className="w-4" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{playgroundLoading ? 'Executing...' : 'Execute API Call'}</span>
                  </button>
                </div>
              </div>

              {/* Response Inspector Skeleton */}
              {playgroundLoading && (
                <div className="bg-[#1E293B] rounded-2xl p-6 border border-slate-700 shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <SkeletonBlock className="h-4 w-44 bg-slate-700" />
                    <SkeletonBlock className="h-4 w-20 bg-slate-700" />
                  </div>
                  <div className="space-y-2 pt-1">
                    <SkeletonBlock className="h-3 w-3/4 bg-slate-700/80" />
                    <SkeletonBlock className="h-3 w-5/6 bg-slate-700/80" />
                    <SkeletonBlock className="h-3 w-2/3 bg-slate-700/80" />
                    <SkeletonBlock className="h-3 w-4/5 bg-slate-700/80" />
                  </div>
                </div>
              )}

              {/* Response Inspector */}
              {!playgroundLoading && playgroundResult && (
                <div className="bg-[#1E293B] text-slate-200 rounded-2xl p-6 border border-slate-700 shadow-xl space-y-3 font-mono text-[11px] animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${playgroundResult.success ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
                        HTTP 200 {playgroundResult.status}
                      </span>
                      <span className="text-slate-400 text-[10px]">Reference: {playgroundResult.reference_id}</span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(playgroundResult, null, 2));
                        showNotice('Copied JSON response to clipboard.');
                      }}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[10px] cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy JSON</span>
                    </button>
                  </div>

                  <pre className="max-h-80 overflow-y-auto leading-relaxed text-emerald-400">
                    {JSON.stringify(playgroundResult, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 3: BULK VERIFICATION */}
      {activeTab === 'bulk' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Upload Bulk Data Batch (CSV / Excel)</h3>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Verify hundreds of GSTINs, PANs, or Driving Licences in a single batch with automated CSV report generation.
              </p>
            </div>

            <form onSubmit={handleBulkUpload} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Batch Verification Type</label>
                  <select
                    value={bulkType}
                    onChange={(e) => setBulkType(e.target.value)}
                    className="w-full bg-[#F7F8FA] border border-slate-300 rounded-xl px-3 py-2"
                  >
                    <option>GSTIN Batch Verification</option>
                    <option>PAN-Aadhaar Linking Batch Audit</option>
                    <option>Driving Licence Authenticity Check</option>
                    <option>Udyam MSME Status Batch Check</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Upload CSV Template File *</label>
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                    className="w-full text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#FF671F] file:text-white file:text-xs cursor-pointer"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const csv = 'identifier,dob_or_notes\n';
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'bulk-verification-template.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-[#FF671F] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV Format Template</span>
                </button>

                <button
                  type="submit"
                  disabled={!bulkFile || bulkProcessing}
                  className="bg-[#138808] hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {bulkProcessing ? (
                    <>
                      <InlineSkeletonPulse className="w-4" />
                      <span>Processing Batch Pipeline...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Process Batch Through API Setu</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Past Bulk Jobs Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-white">
              Bulk Processing History & Export Reports
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs text-left tabular-nums">
                <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5">Batch Name / Date</th>
                    <th className="p-3.5">Verification Scheme</th>
                    <th className="p-3.5">Records</th>
                    <th className="p-3.5">Success / Fail</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bulkJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No batch verification jobs run yet. Upload a CSV file above to begin.
                    </td>
                  </tr>
                ) : (
                  bulkJobs.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50">
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">{j.jobName}</div>
                        <div className="text-[10px] text-slate-400">{new Date(j.createdAt).toLocaleDateString()}</div>
                      </td>
                      <td className="p-3.5 font-medium text-slate-700">{j.verificationType}</td>
                      <td className="p-3.5 font-mono font-bold">{j.totalRecords}</td>
                      <td className="p-3.5">
                        <span className="text-[#138808] font-bold">{j.successCount}</span> / <span className="text-red-500">{j.failureCount}</span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-[#138808]">
                          {j.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => downloadCsvReport(j)}
                          className="text-[#FF671F] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Export CSV</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: API KEYS */}
      {activeTab === 'apikeys' && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Developer API Credentials &amp; Webhook Security</h3>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Connect your ERP, CRM, or custom application to the Digital India Project API Setu gateway.
                </p>
              </div>
              <button
                type="button"
                disabled={rotatingKey}
                onClick={() => void handleRotateKey()}
                className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {rotatingKey ? <InlineSkeletonPulse className="w-4" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>{rotatingKey ? 'Rotating...' : 'Rotate API Key'}</span>
              </button>
            </div>

            {!business.apiKey && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                Save your KYB Organization Profile on the Overview tab to provision your initial B2B API Key.
              </div>
            )}

            <div className="space-y-3 pt-2">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Production API Key</label>
                <div className="flex items-center gap-2">
                  <input
                    type={business.apiKey ? 'password' : 'text'}
                    readOnly
                    value={business.apiKey || 'Not provisioned yet'}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300"
                  />
                  <button
                    disabled={!business.apiKey}
                    onClick={() => {
                      navigator.clipboard.writeText(business.apiKey);
                      showNotice('API Key copied to clipboard.');
                    }}
                    className="bg-slate-800 disabled:opacity-40 text-white font-bold px-3 py-2 rounded-xl cursor-pointer"
                  >
                    Copy Key
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Webhook Secret Key</label>
                <div className="flex items-center gap-2">
                  <input
                    type={business.webhookSecret ? 'password' : 'text'}
                    readOnly
                    value={business.webhookSecret || 'Provisioned with live webhook'}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300"
                  />
                  <button
                    disabled={!business.webhookSecret}
                    onClick={() => {
                      navigator.clipboard.writeText(business.webhookSecret);
                      showNotice('Webhook secret copied to clipboard.');
                    }}
                    className="bg-slate-800 disabled:opacity-40 text-white font-bold px-3 py-2 rounded-xl cursor-pointer"
                  >
                    Copy Secret
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveKybProfile} className="space-y-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-200">Webhook Callback URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="https://api.yourdomain.com/webhooks/dip"
                    value={kybForm.webhookUrl}
                    onChange={(e) => setKybForm({ ...kybForm, webhookUrl: e.target.value })}
                    className="flex-1 bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={savingKyb}
                    className="bg-[#138808] hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    Save Webhook
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4B: TEAM MEMBERS */}
      {activeTab === 'team' && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Enterprise Workspace Team Members</h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                Invite finance, compliance, or engineering operators under your organization&apos;s API quota.
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newMemberEmail.includes('@')) return;
                setAddingMember(true);
                try {
                  const res = await addB2BMember({
                    email: newMemberEmail.trim(),
                    name: newMemberName.trim() || undefined,
                    role: newMemberRole,
                  });
                  if (res.ok) {
                    const refreshed = await fetchB2BMembers().catch(() => null);
                    if (refreshed?.ok && Array.isArray(refreshed.data)) {
                      setB2bMembers(
                        refreshed.data.map((m: any) => ({
                          id: m.id,
                          email: m.email || m.user_id,
                          name: m.name || 'Team Member',
                          role: m.role || 'MEMBER',
                        }))
                      );
                    } else {
                      setB2bMembers((prev) => [
                        ...prev,
                        { id: `bm_${Date.now()}`, email: newMemberEmail.trim(), name: newMemberName.trim() || newMemberEmail.split('@')[0], role: newMemberRole },
                      ]);
                    }
                    setNewMemberEmail('');
                    setNewMemberName('');
                    showNotice('Authorized team member added to B2B workspace.');
                  } else {
                    showNotice(res.message || 'Save KYB Organization Profile before adding team members.');
                  }
                } finally {
                  setAddingMember(false);
                }
              }}
              className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            >
              <div>
                <label className="block font-semibold mb-1">Member Email *</label>
                <input
                  type="email"
                  required
                  placeholder="ops@company.in"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="Compliance Lead"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Role</label>
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as 'ADMIN' | 'MEMBER' | 'VIEWER')}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="MEMBER">MEMBER</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={addingMember}
                className="bg-[#138808] hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {addingMember ? 'Inviting...' : 'Add Team Member'}
              </button>
            </form>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {b2bMembers.length === 0 ? (
                <p className="text-slate-500 py-4 text-center">No extra team members configured yet.</p>
              ) : (
                b2bMembers.map((m) => (
                  <div key={m.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{m.name || m.email}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{m.email}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                      {m.role}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900">Immutable Verification Audit Trail</h3>
            <span className="text-slate-500 text-[11px]">Logged in Cloudflare D1 with correlation IDs</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-2xs">
            <table className="w-full min-w-[640px] text-xs text-left tabular-nums">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Identifier Value</th>
                  <th className="p-3.5">Provider Ref</th>
                  <th className="p-3.5">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {verifications.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No API Setu verifications performed yet. Live verification queries will appear here.
                    </td>
                  </tr>
                ) : (
                  verifications.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="p-3.5 text-slate-500">{new Date(v.performedAt).toLocaleString()}</td>
                      <td className="p-3.5 font-bold text-slate-800">{v.verificationType}</td>
                      <td className="p-3.5 font-mono font-bold text-[#FF671F]">{v.identifierValue}</td>
                      <td className="p-3.5 font-mono text-slate-500 text-[11px]">{v.providerRef}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-[#138808]">
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

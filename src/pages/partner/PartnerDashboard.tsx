import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { PartnerType, Service } from '../../types';
import { formatINRFromPaise } from '../../lib/finance';
import { normalizeRole } from '../../lib/rbac';
import { SwipeableActionItem } from '../../components/common/SwipeableActionItem';
import {
  Handshake,
  Copy,
  Check,
  UserPlus,
  PlusCircle,
  Wallet,
  FileCheck2,
  Bell,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  FlaskConical,
} from 'lucide-react';
import { SandboxWebhookTestModal } from '../../components/payment/SandboxWebhookTestModal';

interface PartnerDashboardProps {
  initialTab?: string;
  onNavigate: (route: string, param?: string) => void;
  onStartAssistedApplication: (service?: Service, meta?: { partnerId?: string; applicantName?: string }) => void;
}

type PartnerTabId = 'overview' | 'customers' | 'applications' | 'wallet' | 'notifications';

export const PartnerDashboard: React.FC<PartnerDashboardProps> = ({
  initialTab = 'overview',
  onNavigate,
  onStartAssistedApplication,
}) => {
  const { user } = useAuth();
  const {
    services,
    partners,
    partnerCustomers,
    applications,
    commissionLedger,
    settlementRequests,
    notifications,
    registerPartner,
    addPartnerCustomer,
    requestPartnerSettlement,
    markNotificationRead,
  } = useData();

  const resolvePartnerTab = (t?: string): PartnerTabId =>
    (['overview', 'customers', 'applications', 'wallet', 'notifications'].includes(t || '')
      ? (t as PartnerTabId)
      : 'overview');

  const [activeTab, setActiveTab] = useState<PartnerTabId>(() => resolvePartnerTab(initialTab));
  const [sandboxTestOpen, setSandboxTestOpen] = useState(initialTab === 'test-payment');

  useEffect(() => {
    setActiveTab(resolvePartnerTab(initialTab));
    if (initialTab === 'test-payment') {
      setSandboxTestOpen(true);
    }
  }, [initialTab]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Partner onboarding form
  const [partnerType, setPartnerType] = useState<PartnerType>('individual_agent');
  const [businessName, setBusinessName] = useState(user?.companyName || '');
  const [stateName, setStateName] = useState('');
  const [district, setDistrict] = useState('');
  const [pincode, setPincode] = useState('');
  const [panMasked, setPanMasked] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankAccountMasked, setBankAccountMasked] = useState('');
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);

  // Add customer
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [custConsent, setCustConsent] = useState(false);

  // Settlement request
  const [settleAmount, setSettleAmount] = useState('');
  const [bannerMsg, setBannerMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const myPartnerProfile = useMemo(
    () => partners.find((p) => p.userId === user?.id || (user?.partnerId && p.id === user.partnerId)),
    [partners, user?.id, user?.partnerId]
  );

  const myPartnerId = myPartnerProfile?.id || user?.partnerId || '';

  const myPartnerApps = useMemo(
    () =>
      applications.filter(
        (a) =>
          (myPartnerId && a.partnerId === myPartnerId) ||
          (user?.id && a.collectedByUid === user.id && a.filingMode === 'assisted')
      ),
    [applications, myPartnerId, user?.id]
  );

  const myCustomers = useMemo(
    () => partnerCustomers.filter((c) => c.partnerId === myPartnerId),
    [partnerCustomers, myPartnerId]
  );

  const myLedger = useMemo(
    () => commissionLedger.filter((c) => c.partnerId === myPartnerId),
    [commissionLedger, myPartnerId]
  );

  const mySettlements = useMemo(
    () => settlementRequests.filter((s) => s.partnerId === myPartnerId),
    [settlementRequests, myPartnerId]
  );

  const myNotifications = useMemo(
    () => notifications.filter((n) => n.userId === user?.id),
    [notifications, user?.id]
  );

  const stats = useMemo(() => {
    const earnedPaise = myLedger
      .filter((c) => c.entryType === 'EARNED' && c.status !== 'Reversed')
      .reduce((acc, c) => acc + c.netPaise, 0);
    const availablePaise = myLedger
      .filter((c) => c.status === 'Approved')
      .reduce((acc, c) => acc + c.netPaise, 0);
    const settledPaise = myLedger
      .filter((c) => c.status === 'Settled')
      .reduce((acc, c) => acc + c.netPaise, 0);
    return { earnedPaise, availablePaise, settledPaise };
  }, [myLedger]);

  const handleCopy = (txt: string, key: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-4">
          <Handshake className="w-10 h-10 text-[#FF671F] mx-auto" />
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Authorized Partner & Agent Program
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Sign in or create a Partner account to assist citizens, track referral commissions, and request bank settlements.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => onNavigate('login')}
              className="bg-[#FF671F] text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => onNavigate('register', 'partner')}
              className="border border-slate-300 dark:border-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
            >
              Register Partner Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollSubmitting(true);
    try {
      await registerPartner({
        partnerType,
        fullName: user.name,
        businessName: businessName || `${user.name} Digital Desk`,
        email: user.email,
        mobile: user.mobile || '+91 98765 43210',
        state: stateName,
        district,
        pincode,
        panMasked,
        bankIfsc,
        bankAccountMasked,
      });
      setBannerMsg({
        type: 'ok',
        text: 'Partner application submitted for Super Admin review. Your unique Partner & Referral codes have been reserved.',
      });
    } finally {
      setEnrollSubmitting(false);
    }
  };

  const isApprovedPartner =
    myPartnerProfile?.approvalStatus === 'Approved' ||
    normalizeRole(user.role) === 'partner' ||
    normalizeRole(user.role) === 'admin' ||
    normalizeRole(user.role) === 'super_admin';

  if (!myPartnerProfile && !isApprovedPartner) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF671F]">
              Digital India Project · Authorized Partner Onboarding
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              Enroll as an Authorized Assisted Filing Partner
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Individual Agents, CSC Centers, and Corporate Connectors can enroll below to receive a verified Partner ID, Referral Code, and transparent commission ledger.
            </p>
          </div>

          <form onSubmit={handleEnrollSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Partner Category *
                </label>
                <select
                  value={partnerType}
                  onChange={(e) => setPartnerType(e.target.value as PartnerType)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5"
                >
                  <option value="individual_agent">Individual Facilitation Agent</option>
                  <option value="csc_center">CSC / Kendra Digital Center</option>
                  <option value="franchise">Franchise Network Partner</option>
                  <option value="corporate_connector">Corporate Connector</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Center / Firm Name *
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Bharat e-Seva Facilitation Desk"
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">State *</label>
                <input
                  type="text"
                  required
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  placeholder="e.g. Maharashtra"
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">District *</label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Pune"
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">PIN Code *</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="411001"
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  PAN (Last 4 or Masked) *
                </label>
                <input
                  type="text"
                  required
                  value={panMasked}
                  onChange={(e) => setPanMasked(e.target.value)}
                  placeholder="XXXXX1234F"
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Bank IFSC *</label>
                <input
                  type="text"
                  required
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value)}
                  placeholder="HDFC0001234"
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Masked Settlement Account *
                </label>
                <input
                  type="text"
                  required
                  value={bankAccountMasked}
                  onChange={(e) => setBankAccountMasked(e.target.value)}
                  placeholder="XXXXXX4589"
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={enrollSubmitting}
              className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-6 py-3 rounded-xl cursor-pointer flex items-center gap-2"
            >
              <span>{enrollSubmitting ? 'Submitting Enrollment...' : 'Submit Partner Enrollment'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Partner Hero */}
      <div className="bg-[#1E293B] text-white p-6 sm:p-8 rounded-2xl border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-[#FFC928] uppercase tracking-wider">
            <Handshake className="w-4 h-4 text-[#138808]" />
            <span>
              Partner Workspace · Status:{' '}
              <span className="text-emerald-300">{myPartnerProfile?.approvalStatus || 'Active'}</span>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black">
            {myPartnerProfile?.businessName || `${user.name} Partner Desk`}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 pt-1">
            <span>
              Partner ID:{' '}
              <strong className="font-mono text-white">{myPartnerProfile?.partnerCode || user.partnerId || 'PART-ADMIN'}</strong>
            </span>
            <button
              type="button"
              onClick={() => handleCopy(myPartnerProfile?.referralCode || user.referralCode || 'REF-DIP', 'ref')}
              className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg font-mono text-[11px] text-[#FFC928] cursor-pointer"
            >
              <span>Referral: {myPartnerProfile?.referralCode || user.referralCode || 'REF-DIP'}</span>
              {copiedCode === 'ref' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={!isApprovedPartner}
            onClick={() => onStartAssistedApplication(services[0], { partnerId: myPartnerId })}
            className="bg-[#FF671F] hover:bg-[#E55B1B] disabled:opacity-50 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>File Assisted Application</span>
          </button>

          <button
            type="button"
            onClick={() => setSandboxTestOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-600 font-bold text-xs px-4 py-3 rounded-xl flex items-center gap-1.5 cursor-pointer transition"
          >
            <FlaskConical className="w-4 h-4" />
            <span>Test Payment</span>
          </button>
        </div>
      </div>

      {myPartnerProfile?.approvalStatus === 'Pending Approval' && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2.5">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            Your Partner Enrollment is currently <strong>Pending Approval</strong> from our Compliance Admin Desk. Assisted filing unlocks automatically upon approval.
          </span>
        </div>
      )}

      {bannerMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold border flex items-center gap-2 ${
            bannerMsg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {bannerMsg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{bannerMsg.text}</span>
        </div>
      )}

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <span className="text-[11px] font-bold uppercase text-slate-400">Assisted Filings</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{myPartnerApps.length}</div>
          <span className="text-[11px] text-slate-500">Tracked customer dossiers</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <span className="text-[11px] font-bold uppercase text-slate-400">Net Commission Earned</span>
          <div className="text-2xl font-black text-[#138808] mt-1">{formatINRFromPaise(stats.earnedPaise)}</div>
          <span className="text-[11px] text-slate-500">After applicable TDS</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <span className="text-[11px] font-bold uppercase text-slate-400">Available for Settlement</span>
          <div className="text-2xl font-black text-[#FF671F] mt-1">{formatINRFromPaise(stats.availablePaise)}</div>
          <span className="text-[11px] text-slate-500">Min threshold ₹500</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <span className="text-[11px] font-bold uppercase text-slate-400">Total Settled</span>
          <div className="text-2xl font-black text-slate-700 dark:text-slate-200 mt-1">
            {formatINRFromPaise(stats.settledPaise)}
          </div>
          <span className="text-[11px] text-slate-500">Paid to bank account</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 text-xs font-bold">
        {[
          { id: 'overview', label: 'Quick Assisted Launch', icon: ShieldCheck },
          { id: 'customers', label: `Consented Customers (${myCustomers.length})`, icon: UserPlus },
          { id: 'applications', label: `Submitted Applications (${myPartnerApps.length})`, icon: FileCheck2 },
          { id: 'wallet', label: 'Commissions & Settlements', icon: Wallet },
          { id: 'notifications', label: `Alerts (${myNotifications.filter((n) => !n.isRead).length})`, icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs whitespace-nowrap transition cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#FF671F] text-white'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {services.slice(0, 6).map((srv) => (
            <div
              key={srv.id}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between gap-3"
            >
              <div>
                <div className="font-bold text-slate-900 dark:text-white text-sm">{srv.name}</div>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{srv.shortDesc}</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-mono font-bold text-[#138808]">
                  Fee: ₹{srv.serviceCharge + srv.govtFees}
                </span>
                <button
                  type="button"
                  disabled={!isApprovedPartner}
                  onClick={() => onStartAssistedApplication(srv, { partnerId: myPartnerId })}
                  className="text-xs font-bold text-[#FF671F] hover:underline disabled:opacity-40 cursor-pointer"
                >
                  Assist Customer →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!custConsent) return;
              addPartnerCustomer({
                partnerId: myPartnerId,
                name: custName,
                email: custEmail,
                mobile: custMobile,
              });
              setCustName('');
              setCustEmail('');
              setCustMobile('');
              setCustConsent(false);
              setBannerMsg({ type: 'ok', text: 'Customer onboarded with explicit DPDP consent.' });
            }}
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
          >
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Onboard Assisted Customer</h3>
            <input
              type="text"
              required
              placeholder="Customer Full Name"
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
              className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            />
            <input
              type="email"
              required
              placeholder="Customer Email"
              value={custEmail}
              onChange={(e) => setCustEmail(e.target.value)}
              className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            />
            <input
              type="tel"
              required
              placeholder="Customer Mobile (+91)"
              value={custMobile}
              onChange={(e) => setCustMobile(e.target.value)}
              className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            />
            <label className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={custConsent}
                onChange={(e) => setCustConsent(e.target.checked)}
                required
                className="mt-0.5"
              />
              <span>Customer consent obtained for assisted online service filing via Digital India Project.</span>
            </label>
            <button
              type="submit"
              className="w-full bg-[#138808] text-white font-bold py-2.5 rounded-xl cursor-pointer"
            >
              Add Customer Record
            </button>
          </form>

          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Verified Customer Roster</h3>
            {myCustomers.length === 0 ? (
              <p className="text-slate-500">No customers onboarded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {myCustomers.map((c) => (
                  <div key={c.id} className="py-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {c.mobile} · {c.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!isApprovedPartner}
                      onClick={() =>
                        onStartAssistedApplication(services[0], {
                          partnerId: myPartnerId,
                          applicantName: c.name,
                        })
                      }
                      className="text-xs font-bold text-[#FF671F] hover:underline cursor-pointer"
                    >
                      Launch Filing →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'applications' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden text-xs">
          {myPartnerApps.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No partner-assisted applications filed yet.</div>
          ) : (
            <>
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-800/40 text-[10px] text-slate-500">
                  Swipe right to Track · Swipe left to Start Similar Filing
                </div>
                {myPartnerApps.map((a) => (
                  <SwipeableActionItem
                    key={a.id}
                    className="rounded-none"
                    contentClassName="bg-white dark:bg-slate-900"
                    leftAction={{
                      label: 'Track Status',
                      shortLabel: 'Track',
                      icon: <ArrowRight className="w-4 h-4" />,
                      tone: 'primary',
                      onAction: () => onNavigate('track', a.id),
                    }}
                    rightAction={{
                      label: 'Re-Apply Service',
                      shortLabel: 'New',
                      icon: <PlusCircle className="w-4 h-4" />,
                      tone: 'success',
                      onAction: () => {
                        const matchedService = services.find((s) => s.slug === a.serviceSlug);
                        onStartAssistedApplication(matchedService, {
                          partnerId: myPartnerId,
                          applicantName: a.userName,
                        });
                      },
                    }}
                  >
                    <div className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[#FF671F]">{a.id}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-[10px]">
                          {a.status}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white">{a.serviceName}</div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Applicant: {a.userName}</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          ₹{a.payment.totalAmount}
                        </span>
                      </div>
                    </div>
                  </SwipeableActionItem>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[600px] text-left tabular-nums">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase font-bold text-slate-500">
                    <tr>
                      <th className="p-3.5">Application ID</th>
                      <th className="p-3.5">Applicant</th>
                      <th className="p-3.5">Service</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {myPartnerApps.map((a) => (
                      <tr key={a.id}>
                        <td className="p-3.5 font-mono font-bold text-[#FF671F]">{a.id}</td>
                        <td className="p-3.5 font-semibold text-slate-900 dark:text-white">{a.userName}</td>
                        <td className="p-3.5">{a.serviceName}</td>
                        <td className="p-3.5 font-bold">{a.status}</td>
                        <td className="p-3.5 font-mono">₹{a.payment.totalAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'wallet' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const res = requestPartnerSettlement(myPartnerId, Number(settleAmount));
              if (!res.ok) {
                setBannerMsg({ type: 'err', text: res.error || 'Could not request settlement.' });
              } else {
                setSettleAmount('');
                setBannerMsg({ type: 'ok', text: 'Settlement payout request submitted to Super Admin Finance Desk.' });
              }
            }}
            className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3"
          >
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Request Payout Settlement</h3>
            <p className="text-[11px] text-slate-500">
              Available balance: <strong className="text-[#138808]">{formatINRFromPaise(stats.availablePaise)}</strong>
            </p>
            <input
              type="number"
              min={500}
              required
              placeholder="Amount in INR (min ₹500)"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
            />
            <button
              type="submit"
              className="w-full bg-[#FF671F] text-white font-bold py-2.5 rounded-xl cursor-pointer"
            >
              Submit Settlement Request
            </button>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="font-bold text-slate-700 dark:text-slate-300">Settlement History</div>
              {mySettlements.length === 0 ? (
                <p className="text-slate-400">No settlement requests yet.</p>
              ) : (
                mySettlements.map((s) => (
                  <div key={s.id} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg flex justify-between">
                    <span className="font-mono font-bold">{formatINRFromPaise(s.requestedPaise)}</span>
                    <span className="font-semibold text-[#FF671F]">{s.status}</span>
                  </div>
                ))
              )}
            </div>
          </form>

          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Commission Ledger Entries</h3>
            {myLedger.length === 0 ? (
              <p className="text-slate-500">Commissions credit automatically upon verified assisted payments.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {myLedger.map((entry) => (
                  <div key={entry.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {entry.applicationId} · {entry.serviceName}
                      </div>
                      <div className="text-[11px] text-slate-500">{entry.notes}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-[#138808]">{formatINRFromPaise(entry.netPaise)}</div>
                      <div className="text-[10px] text-slate-400">{entry.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
          {myNotifications.length === 0 ? (
            <p className="text-slate-500">No notifications right now.</p>
          ) : (
            myNotifications.map((n) => (
              <SwipeableActionItem
                key={n.id}
                onClick={() => markNotificationRead(n.id)}
                className={`rounded-xl border ${
                  n.isRead
                    ? 'border-slate-200 dark:border-slate-800 opacity-75'
                    : 'border-[#FF671F]'
                }`}
                contentClassName={
                  n.isRead
                    ? 'bg-white dark:bg-slate-900'
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
                  label: 'Open Wallet',
                  shortLabel: 'Wallet',
                  icon: <Wallet className="w-4 h-4" />,
                  tone: 'primary',
                  onAction: () => {
                    markNotificationRead(n.id);
                    setActiveTab('wallet');
                  },
                }}
              >
                <div className="p-3 cursor-pointer">
                  <div className="font-bold text-slate-900 dark:text-white">{n.title}</div>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">{n.message}</p>
                </div>
              </SwipeableActionItem>
            ))
          )}
        </div>
      )}

      <SandboxWebhookTestModal
        isOpen={sandboxTestOpen}
        onClose={() => setSandboxTestOpen(false)}
        channel="partner"
        actorName={user.name || 'Partner'}
        onVerified={(res) => {
          setBannerMsg({
            type: 'ok',
            text: `Sandbox webhook verified (${res.orderId} -> ${res.persistedOrderStatus || res.firstDelivery.resolvedOrderStatus}, HTTP ${res.firstDelivery.httpStatus}).`,
          });
        }}
      />
    </div>
  );
};

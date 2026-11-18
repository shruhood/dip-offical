import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  Search,
  Play,
  ArrowRight,
  Lock,
  Building2,
  Car,
  Landmark,
  UserCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  API_SATHI_POWERED_SERVICES,
  type ApiSathiRetailService,
  type ApiSathiServiceVertical,
} from '../data/apiSathiServices';
import { ApiSathiVerificationConsole } from '../components/verification/ApiSathiVerificationConsole';

interface InstantVerificationPageProps {
  initialSlug?: string;
  onNavigate: (route: string, param?: string) => void;
}

const VERTICAL_TABS: Array<{
  id: 'all' | ApiSathiServiceVertical;
  label: string;
  labelHi: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'all', label: 'All Checks', labelHi: 'सभी सत्यापन', icon: ShieldCheck },
  { id: 'kyc', label: 'KYC & Identity', labelHi: 'KYC व पहचान', icon: UserCheck },
  { id: 'kyb', label: 'GST & Business', labelHi: 'GST व व्यापार', icon: Building2 },
  { id: 'vehicle', label: 'Transport & RC', labelHi: 'वाहन व लाइसेंस', icon: Car },
  { id: 'banking', label: 'Banking & IFSC', labelHi: 'बैंकिंग व IFSC', icon: Landmark },
];

export const InstantVerificationPage: React.FC<InstantVerificationPageProps> = ({
  initialSlug,
  onNavigate,
}) => {
  const { user, isAuthenticated } = useAuth();
  const { lang } = useLanguage();

  const [selectedVertical, setSelectedVertical] = useState<'all' | ApiSathiServiceVertical>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeApiSlug, setActiveApiSlug] = useState<string>(() => {
    if (initialSlug) {
      const byRetailSlug = API_SATHI_POWERED_SERVICES.find((s) => s.slug === initialSlug);
      if (byRetailSlug) return byRetailSlug.apiSathiProductSlug;
      const byApiSlug = API_SATHI_POWERED_SERVICES.find((s) => s.apiSathiProductSlug === initialSlug);
      if (byApiSlug) return byApiSlug.apiSathiProductSlug;
    }
    return 'pan-verification-v1';
  });

  useEffect(() => {
    if (!initialSlug) return;
    const match = API_SATHI_POWERED_SERVICES.find(
      (s) => s.slug === initialSlug || s.apiSathiProductSlug === initialSlug
    );
    if (match) {
      setActiveApiSlug(match.apiSathiProductSlug);
    }
  }, [initialSlug]);

  const roleNorm = String(user?.role || '').toLowerCase();
  const isAdmin = roleNorm === 'admin' || roleNorm === 'super_admin';
  const isStaffUser =
    isAuthenticated &&
    ['admin', 'super_admin', 'operator', 'partner', 'manager', 'business', 'b2b'].includes(roleNorm);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return API_SATHI_POWERED_SERVICES.filter((svc) => {
      const matchVertical = selectedVertical === 'all' || svc.vertical === selectedVertical;
      if (!matchVertical) return false;
      if (!q) return true;
      return (
        svc.name.toLowerCase().includes(q) ||
        (svc.nameHi && svc.nameHi.toLowerCase().includes(q)) ||
        svc.shortDesc.toLowerCase().includes(q) ||
        svc.apiSathiProductSlug.toLowerCase().includes(q) ||
        svc.sampleFieldsReturned.some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [selectedVertical, searchQuery]);

  const activeRetailService = useMemo(
    () =>
      API_SATHI_POWERED_SERVICES.find((s) => s.apiSathiProductSlug === activeApiSlug) ||
      API_SATHI_POWERED_SERVICES[0],
    [activeApiSlug]
  );

  const handleSelectCheck = (svc: ApiSathiRetailService) => {
    setActiveApiSlug(svc.apiSathiProductSlug);
    const el = document.getElementById('instant-verify-workbench');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF671F] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-Time Registry API Suite</span>
              <span>·</span>
              <span>{API_SATHI_POWERED_SERVICES.length} Instant Services</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {lang === 'hi'
                ? 'तत्काल ऑनलाइन सत्यापन सेवाएं (PAN, GSTIN, RC, DL, IFSC व डिजिलॉकर)'
                : 'Instant Online Verification Services'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Verify PAN, PAN–Aadhaar linkage, GSTIN taxpayers, Vahan Vehicle RC, Sarathi Driving Licences, MCA Company CIN, Voter EPIC, IFSC banking details, and consented UIDAI DigiLocker e-KYC in seconds with DPDP consent tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('services')}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap cursor-pointer transition"
            >
              Browse Full Catalogue
            </button>
            <a
              href="#instant-verify-workbench"
              className="px-4 py-2.5 rounded-xl bg-[#138808] hover:bg-emerald-700 text-xs font-bold text-white inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Open Live Workbench</span>
            </a>
          </div>
        </div>
      </section>

      {/* Staff / Partner Commercial Unit Economics Bar */}
      {isStaffUser && (
        <section
          aria-label="Partner unit economics"
          className="bg-slate-900 dark:bg-slate-950 text-white border border-slate-800 rounded-2xl p-5 grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums"
        >
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Wholesale API Cost Range
            </div>
            <div className="text-xl font-black font-mono text-emerald-400 mt-1">₹0.39 – ₹6.50</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Per live registry query</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Suggested Citizen Retail
            </div>
            <div className="text-xl font-black font-mono text-white mt-1">₹19 – ₹79</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Pay-per-check pricing</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Gross Margin Range
            </div>
            <div className="text-xl font-black font-mono text-[#FFC928] mt-1">91.8% – 98.8%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Instant settlement eligible</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Compliance &amp; Retries
            </div>
            <div className="text-xl font-black font-mono text-sky-400 mt-1">DPDP + Queue</div>
            <div className="text-[11px] text-slate-400 mt-0.5">PII masked · 429/5xx auto-retry</div>
          </div>
        </section>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {VERTICAL_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = selectedVertical === tab.id;
            const count =
              tab.id === 'all'
                ? API_SATHI_POWERED_SERVICES.length
                : API_SATHI_POWERED_SERVICES.filter((s) => s.vertical === tab.id).length;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedVertical(tab.id)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition ${
                  active
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-[#FF671F]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{lang === 'hi' ? tab.labelHi : tab.label}</span>
                <span className="font-mono text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter PAN, GSTIN, RC, IFSC..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#FF671F]"
          />
        </div>
      </div>

      {/* Verification Services Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 tabular-nums">
        {filteredServices.map((svc) => {
          const isSelected = activeApiSlug === svc.apiSathiProductSlug;
          return (
            <article
              key={svc.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 flex flex-col justify-between gap-4 transition ${
                isSelected
                  ? 'border-[#138808] ring-1 ring-[#138808]/40 shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider">
                  <span className="text-[#FF671F]">
                    {svc.vertical.toUpperCase()} · Instant API
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    {svc.apiSathiProductSlug}
                  </span>
                </div>

                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                    {svc.name}
                  </h2>
                  {svc.nameHi && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {svc.nameHi}
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {lang === 'hi' && svc.shortDescHi ? svc.shortDescHi : svc.shortDesc}
                </p>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Returned Data Fields
                  </div>
                  <div className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                    {svc.sampleFieldsReturned.join(' · ')}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                      Retail Verification Fee
                    </span>
                    <span className="text-lg font-black font-mono text-slate-900 dark:text-white">
                      ₹{svc.retailPriceInr}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-1">+ GST</span>
                  </div>
                  {isStaffUser && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                        API Cost ({svc.grossMarginPercent}% margin)
                      </span>
                      <span className="text-xs font-mono font-bold text-[#138808] dark:text-emerald-400">
                        ₹{svc.wholesaleCostInr.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectCheck(svc)}
                    className="flex-1 bg-[#138808] hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2.5 rounded-xl inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Instant Check</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('service-detail', svc.slug)}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition"
                  >
                    <span>Order &amp; Info</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Live Execution Workbench */}
      <section
        id="instant-verify-workbench"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#138808] dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Active Selection: {activeRetailService.name}</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
              Live Verification Workbench
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('service-detail', activeRetailService.slug)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <span>Checkout Page (₹{activeRetailService.retailPriceInr})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {!isAuthenticated && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-200">
              <Lock className="w-4 h-4 text-[#FF671F] shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Sign in or use Single-Service Checkout</div>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  Staff desks run unlimited checks below, while citizens can sign in or pay ₹{activeRetailService.retailPriceInr} directly on the service detail page to unlock an instant verification report.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="px-3.5 py-2 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold whitespace-nowrap cursor-pointer"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => onNavigate('service-detail', activeRetailService.slug)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 font-bold whitespace-nowrap cursor-pointer"
              >
                Pay ₹{activeRetailService.retailPriceInr}
              </button>
            </div>
          </div>
        )}

        <ApiSathiVerificationConsole
          defaultSlug={activeApiSlug}
          isAdmin={isAdmin}
        />
      </section>
    </div>
  );
};

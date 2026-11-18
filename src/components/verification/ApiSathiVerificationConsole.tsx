import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  ExternalLink,
  Copy,
  Download,
  Wallet,
  RefreshCw,
  FileCheck2,
  Building2,
} from 'lucide-react';
import {
  ApiSathiCatalogueProduct,
  ApiSathiDigilockerFetchResult,
  ApiSathiDigilockerInitResult,
  ApiSathiStatusInfo,
  ApiSathiVerificationResponse,
  fetchApiSathiDigilocker,
  getApiSathiCatalogue,
  getApiSathiStatus,
  initApiSathiDigilocker,
  verifyWithApiSathi,
} from '../../services/apiSathiService';
import { InlineSkeletonPulse, SkeletonBlock } from '../common/SkeletonLoaders';

interface ApiSathiVerificationConsoleProps {
  isAdmin?: boolean;
  defaultSlug?: string;
  lockProduct?: boolean;
  serviceName?: string;
  onVerificationComplete?: (res: ApiSathiVerificationResponse, slug: string, primaryInput: string) => void;
}

const FALLBACK_PRODUCTS: ApiSathiCatalogueProduct[] = [
  {
    slug: 'pan-verification-v1',
    name: 'PAN Verification (ITD + Aadhaar Seeding)',
    category: 'kyc',
    priceRupees: 0.98,
    available: true,
    description: 'Validate 10-character PAN, holder name, DOB, and Aadhaar linkage.',
    requiredFields: ['pan'],
    stepType: 'single',
  },
  {
    slug: 'gstin-basic-v1',
    name: 'GSTIN Authentication Basic',
    category: 'kyb',
    priceRupees: 0.52,
    available: true,
    description: 'Verify 15-character GSTIN and retrieve legal/trade name and status.',
    requiredFields: ['gstin'],
    stepType: 'single',
  },
  {
    slug: 'ifsc-lookup-v1',
    name: 'IFSC Bank & Branch Lookup',
    category: 'kyc',
    priceRupees: 0.50,
    available: true,
    description: 'Resolve 11-character IFSC into bank, branch, address, and UPI/IMPS/NEFT support.',
    requiredFields: ['ifsc'],
    stepType: 'single',
  },
  {
    slug: 'driving-license-v1',
    name: 'Driving Licence Verification (Sarathi)',
    category: 'kyc',
    priceRupees: 1.30,
    available: true,
    description: 'Verify DL number and DOB (DD/MM/YYYY) against MoRTH Sarathi.',
    requiredFields: ['dl_number', 'dob'],
    stepType: 'single',
  },
  {
    slug: 'vehicle-rc-v1',
    name: 'Vehicle RC Verification (Vahan)',
    category: 'vehicle',
    priceRupees: 2.93,
    available: true,
    description: 'Verify RC owner name, maker/model, fuel type, fitness & insurance dates.',
    requiredFields: ['rc_number'],
    stepType: 'single',
  },
  {
    slug: 'mobile-to-udyam-v1',
    name: 'Mobile to Udyam MSME Lookup',
    category: 'kyb',
    priceRupees: 6.50,
    available: true,
    description: 'Look up Udyam MSME registrations linked to a 10-digit Indian mobile.',
    requiredFields: ['mobile'],
    stepType: 'single',
  },
  {
    slug: 'cin-basic-v1',
    name: 'Company CIN Validation Basic',
    category: 'kyb',
    priceRupees: 0.65,
    available: true,
    description: 'Verify Company CIN against MCA records.',
    requiredFields: ['cin'],
    stepType: 'single',
  },
  {
    slug: 'voter-id-v1',
    name: 'Voter ID (EPIC) Verification',
    category: 'kyc',
    priceRupees: 0.65,
    available: true,
    description: 'Confirm 10-character EPIC number against electoral roll records.',
    requiredFields: ['epic_number'],
    stepType: 'single',
  },
  {
    slug: 'name-match',
    name: 'Fuzzy & Phonetic Name Match',
    category: 'kyc',
    priceRupees: 0.50,
    available: true,
    description: 'Compare two names (e.g. PAN vs Bank Account Holder) cleanly.',
    requiredFields: ['name1', 'name2'],
    stepType: 'single',
  },
  {
    slug: 'aadhaar-digilocker-init-v1',
    name: 'Aadhaar DigiLocker e-KYC (2-Step Flow)',
    category: 'kyc',
    priceRupees: 1.98,
    available: true,
    description: 'Step 1 issues consented DigiLocker URL -> Step 2 fetches UIDAI-verified masked Aadhaar.',
    requiredFields: ['mobile'],
    stepType: 'digilocker_step1',
  },
];

export const ApiSathiVerificationConsole: React.FC<ApiSathiVerificationConsoleProps> = ({
  isAdmin = false,
  defaultSlug = 'pan-verification-v1',
  lockProduct = false,
  serviceName,
  onVerificationComplete,
}) => {
  const [statusInfo, setStatusInfo] = useState<ApiSathiStatusInfo | null>(null);
  const [products, setProducts] = useState<ApiSathiCatalogueProduct[]>(FALLBACK_PRODUCTS);
  const [selectedSlug, setSelectedSlug] = useState<string>(defaultSlug);
  const [consentGiven, setConsentGiven] = useState<boolean>(true);

  const [primaryInput, setPrimaryInput] = useState('');
  const [secondaryInput, setSecondaryInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiSathiVerificationResponse | null>(null);

  // 2-Step DigiLocker State
  const [dlInit, setDlInit] = useState<ApiSathiDigilockerInitResult | null>(null);
  const [dlFetch, setDlFetch] = useState<ApiSathiDigilockerFetchResult | null>(null);

  useEffect(() => {
    setSelectedSlug(defaultSlug);
    setPrimaryInput('');
    setSecondaryInput('');
    setResponse(null);
    setDlInit(null);
    setDlFetch(null);
  }, [defaultSlug]);

  useEffect(() => {
    let active = true;
    void Promise.all([getApiSathiStatus(), getApiSathiCatalogue()]).then(([st, cat]) => {
      if (!active) return;
      if (st) setStatusInfo(st);
      if (cat.length > 0) {
        setProducts(cat.filter((p) => p.slug !== 'aadhaar-digilocker-fetch-v1'));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const currentProduct = products.find((p) => p.slug === selectedSlug) || products[0];
  const isDigiLocker = selectedSlug === 'aadhaar-digilocker-init-v1';

  const handleDownloadVerificationJson = (payload: unknown, labelSlug: string) => {
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `verification-${labelSlug}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Ignore browser download failure in restricted environments
    }
  };

  const getFieldLabels = (): { primaryLabel: string; primaryPlaceholder: string; secondaryLabel?: string; secondaryPlaceholder?: string; secondaryType?: string } => {
    switch (selectedSlug) {
      case 'pan-verification-v1':
      case 'pan-basic-v1':
      case 'gstin-by-pan-v1':
        return { primaryLabel: '10-Character PAN *', primaryPlaceholder: 'ABCDE1234F' };
      case 'pan-aadhaar-link':
        return {
          primaryLabel: '10-Character PAN *',
          primaryPlaceholder: 'ABCDE1234F',
          secondaryLabel: '12-Digit Aadhaar Number *',
          secondaryPlaceholder: '123456789012',
        };
      case 'gstin-basic-v1':
      case 'gstin-verify-v1':
        return { primaryLabel: '15-Character GSTIN *', primaryPlaceholder: '26EXIPK0151F1ZQ' };
      case 'ifsc-lookup-v1':
        return { primaryLabel: '11-Character Bank IFSC *', primaryPlaceholder: 'SBIN0001234' };
      case 'driving-license-v1':
        return {
          primaryLabel: 'Driving Licence Number *',
          primaryPlaceholder: 'RJ1420110012345',
          secondaryLabel: 'Date of Birth (DD/MM/YYYY or date picker) *',
          secondaryPlaceholder: '15/01/1990',
          secondaryType: 'date',
        };
      case 'vehicle-rc-v1':
        return { primaryLabel: 'Vehicle Registration Number *', primaryPlaceholder: 'MH12DE1433' };
      case 'mobile-to-udyam-v1':
        return { primaryLabel: '10-Digit Mobile Number *', primaryPlaceholder: '9876543210' };
      case 'cin-basic-v1':
        return { primaryLabel: 'Company CIN / COI Number *', primaryPlaceholder: 'U72900RJ2020PTC012345' };
      case 'voter-id-v1':
        return { primaryLabel: '10-Character EPIC Number *', primaryPlaceholder: 'ABC1234567' };
      case 'name-match':
        return {
          primaryLabel: 'First Name (e.g. PAN Record) *',
          primaryPlaceholder: 'RAJESH KUMAR SHARMA',
          secondaryLabel: 'Second Name (e.g. Bank Account) *',
          secondaryPlaceholder: 'RAJESH K SHARMA',
        };
      case 'aadhaar-digilocker-init-v1':
        return {
          primaryLabel: 'Applicant 10-Digit Mobile *',
          primaryPlaceholder: '9876543210',
          secondaryLabel: 'First Name (Optional)',
          secondaryPlaceholder: 'Applicant First Name',
        };
      default:
        return { primaryLabel: 'Identifier *', primaryPlaceholder: 'Enter identifier' };
    }
  };

  const labels = getFieldLabels();

  const buildPayload = (): Record<string, unknown> => {
    switch (selectedSlug) {
      case 'pan-verification-v1':
      case 'pan-basic-v1':
      case 'gstin-by-pan-v1':
        return { pan: primaryInput.trim().toUpperCase() };
      case 'pan-aadhaar-link':
        return {
          pan: primaryInput.trim().toUpperCase(),
          aadhaar: secondaryInput.replace(/\D/g, ''),
        };
      case 'gstin-basic-v1':
      case 'gstin-verify-v1':
        return { gstin: primaryInput.trim().toUpperCase() };
      case 'ifsc-lookup-v1':
        return { ifsc: primaryInput.trim().toUpperCase() };
      case 'driving-license-v1':
        return {
          dl_number: primaryInput.replace(/[\s-]/g, '').toUpperCase(),
          dob: secondaryInput.trim(),
        };
      case 'vehicle-rc-v1':
        return { rc_number: primaryInput.replace(/[\s-]/g, '').toUpperCase() };
      case 'mobile-to-udyam-v1':
        return { mobile: primaryInput.replace(/\D/g, '').slice(-10) };
      case 'cin-basic-v1':
        return { cin: primaryInput.trim().toUpperCase() };
      case 'voter-id-v1':
        return { epic_number: primaryInput.trim().toUpperCase() };
      case 'name-match':
        return { name1: primaryInput.trim(), name2: secondaryInput.trim() };
      default:
        return { identifier: primaryInput.trim() };
    }
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryInput.trim()) return;
    setLoading(true);
    setResponse(null);

    if (isDigiLocker) {
      setDlFetch(null);
      const initRes = await initApiSathiDigilocker({
        mobile: primaryInput.replace(/\D/g, '').slice(-10),
        firstName: secondaryInput.trim() || undefined,
        consentGiven,
      });
      setDlInit(initRes);
      setLoading(false);
      return;
    }

    const res = await verifyWithApiSathi(
      selectedSlug,
      buildPayload(),
      consentGiven,
      isAdmin ? 'admin_verification_console' : 'partner_verification_console'
    );
    setResponse(res);
    setLoading(false);
    if (onVerificationComplete) {
      onVerificationComplete(res, selectedSlug, primaryInput.trim());
    }
  };

  const handleFetchDigiLocker = async () => {
    if (!dlInit?.transactionId) return;
    setLoading(true);
    const res = await fetchApiSathiDigilocker(dlInit.transactionId);
    setDlFetch(res);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Provider Environment & Wallet Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#FF671F]" />
          <span className="font-bold text-slate-900 dark:text-white">API Sathi Gateway (India KYC / KYB)</span>
          <span className="text-[10px] font-mono text-slate-500">apisathi.in/gw/v1</span>
        </div>

        <div className="flex items-center gap-2">
          {statusInfo?.configured ? (
            statusInfo.isSandboxTestKey ? (
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                SANDBOX TEST KEY (test_*) — Fake Test Responses
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#138808] font-bold text-[10px]">
                LIVE PRODUCTION KEY
              </span>
            )
          ) : (
            <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[10px]">
              API_SATHI_KEY Not Set
            </span>
          )}
        </div>
      </div>

      {/* Admin 402 Prepaid Wallet Alert */}
      {isAdmin && (statusInfo?.walletLowAlert || response?.isWalletEmptyError || dlInit?.isWalletEmptyError || dlFetch?.isWalletEmptyError) && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl text-xs text-red-900 dark:text-red-200 flex items-start gap-2.5">
          <Wallet className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold">Admin Alert: API Sathi Prepaid Wallet Empty (402 INSUFFICIENT_BALANCE)</div>
            <p>
              Recharge your prepaid API Sathi wallet before running additional live KYC/KYB calls.
              {(response?.callId || statusInfo?.recentWalletAlert?.callId) && (
                <span className="ml-1 font-mono text-[11px]">
                  Reference call_id: {response?.callId || statusInfo?.recentWalletAlert?.callId}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Verification Input Form */}
      <form onSubmit={handleRun} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
              {lockProduct ? 'Selected Verification Service' : 'API Sathi Product *'}
            </label>
            {lockProduct ? (
              <div className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-900 dark:text-white">
                {serviceName || currentProduct?.name || selectedSlug}
              </div>
            ) : (
              <select
                value={selectedSlug}
                onChange={(e) => {
                  setSelectedSlug(e.target.value);
                  setPrimaryInput('');
                  setSecondaryInput('');
                  setResponse(null);
                  setDlInit(null);
                  setDlFetch(null);
                }}
                className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
              >
                {products.map((p) => (
                  <option key={p.slug} value={p.slug} disabled={!p.available}>
                    {p.name} (₹{p.priceRupees.toFixed(2)}){!p.available ? ' [Unavailable]' : ''}
                  </option>
                ))}
              </select>
            )}
            {currentProduct && (
              <p className="text-[10px] text-slate-500 mt-1">{currentProduct.description}</p>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">{labels.primaryLabel}</label>
            <input
              type="text"
              value={primaryInput}
              onChange={(e) => setPrimaryInput(e.target.value)}
              placeholder={labels.primaryPlaceholder}
              required
              className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold"
            />
          </div>

          {labels.secondaryLabel && (
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">{labels.secondaryLabel}</label>
              <input
                type={labels.secondaryType || 'text'}
                value={secondaryInput}
                onChange={(e) => setSecondaryInput(e.target.value)}
                placeholder={labels.secondaryPlaceholder}
                required={selectedSlug === 'driving-license-v1' || selectedSlug === 'pan-aadhaar-link' || selectedSlug === 'name-match'}
                className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
              />
            </div>
          )}
        </div>

        <label className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="mt-0.5 accent-[#FF671F]"
          />
          <span>
            Applicant express consent captured per DPDP Act before dispatching verification query. Server logs mask sensitive Aadhaar/PAN/mobile digits automatically.
          </span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[10px] text-slate-500">
            Idempotency-Key &amp; <code>call_id</code> tracked server-side · Key stays strictly in Worker Secrets
          </span>
          <button
            type="submit"
            disabled={loading || !primaryInput.trim() || !consentGiven}
            className="bg-[#138808] hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? <InlineSkeletonPulse className="w-4" /> : <Play className="w-3.5 h-3.5" />}
            <span>{loading ? 'Verifying via API Sathi...' : isDigiLocker ? 'Step 1: Issue DigiLocker Link' : 'Verify via API Sathi'}</span>
          </button>
        </div>
      </form>

      {/* Loading Skeleton */}
      {loading && (
        <div className="bg-slate-900 rounded-2xl p-5 border border-slate-700 space-y-2.5">
          <SkeletonBlock className="h-4 w-48 bg-slate-700" />
          <SkeletonBlock className="h-3 w-3/4 bg-slate-700/80" />
          <SkeletonBlock className="h-3 w-2/3 bg-slate-700/80" />
        </div>
      )}

      {/* 2-Step DigiLocker Step 1 & Step 2 Controls */}
      {isDigiLocker && dlInit && (
        <div className={`p-4 rounded-2xl border text-xs space-y-3 ${
          dlInit.ok
            ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800'
            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-sky-600" />
              <span>{dlInit.ok ? 'Step 1 Complete: Open DigiLocker Consent Link' : 'DigiLocker Init Failed'}</span>
            </div>
            {dlInit.callId && (
              <span className="font-mono text-[10px] text-slate-500">call_id: {dlInit.callId}</span>
            )}
          </div>

          {!dlInit.ok ? (
            <p className="text-red-700 dark:text-red-300 font-semibold">{dlInit.message}</p>
          ) : (
            <>
              <p className="text-slate-600 dark:text-slate-300">
                1. Open the DigiLocker link and finish Aadhaar authentication. 2. Return here and click <strong>I Have Finished — Fetch Result</strong>.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={dlInit.kycUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open DigiLocker Link</span>
                </a>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleFetchDigiLocker}
                  className="bg-[#138808] hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>I Have Finished — Fetch Result</span>
                </button>
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                Stored transaction_id: <strong>{dlInit.transactionId}</strong>
              </div>
            </>
          )}

          {dlFetch && (
            <div className={`mt-2 p-3.5 rounded-xl border space-y-1.5 ${
              dlFetch.verified
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : dlFetch.notCompleted
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}>
              <div className="flex items-center justify-between gap-2 font-bold">
                <span>
                  {dlFetch.verified
                    ? 'UIDAI DigiLocker Aadhaar Verified'
                    : dlFetch.notCompleted
                    ? 'DigiLocker Consent Not Completed Yet (422)'
                    : `Fetch Failed (${dlFetch.errorCode || dlFetch.httpStatus})`}
                </span>
                {dlFetch.callId && <span className="font-mono text-[10px]">call_id: {dlFetch.callId}</span>}
              </div>
              <p>{dlFetch.message}</p>
              {dlFetch.verified && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                  <div><span className="text-slate-500 block text-[10px]">Masked Aadhaar</span>{dlFetch.maskedAadhaar || '—'}</div>
                  <div><span className="text-slate-500 block text-[10px]">Name</span>{dlFetch.name || '—'}</div>
                  <div><span className="text-slate-500 block text-[10px]">DOB</span>{dlFetch.dob || '—'}</div>
                  <div><span className="text-slate-500 block text-[10px]">Gender</span>{dlFetch.gender || '—'}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Single-Step Result & Error Views */}
      {!loading && !isDigiLocker && response && (
        <div className="space-y-3">
          {/* Status Banner covering all API Sathi outcomes */}
          <div className={`p-4 rounded-2xl border text-xs flex items-start justify-between gap-3 ${
            response.verified
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : response.outcome === 'NOT_VERIFIED'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}>
            <div className="flex items-start gap-2.5">
              {response.verified ? (
                <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0 mt-0.5" />
              ) : response.outcome === 'NOT_VERIFIED' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold flex flex-wrap items-center gap-2">
                  <span>
                    {response.verified
                      ? 'Record Verified (verified: true)'
                      : response.outcome === 'NOT_VERIFIED'
                      ? 'No Matching Record Found (HTTP 200 · verified: false)'
                      : `Verification Error (${response.errorCode || `HTTP ${response.httpStatus}`})`}
                  </span>
                  {response.isSandboxTestKey && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px]">
                      SANDBOX TEST DATA
                    </span>
                  )}
                </div>
                <p>{response.message}</p>
              </div>
            </div>

            {response.callId && (
              <div className="text-right shrink-0 font-mono text-[10px]">
                <span className="text-slate-500 block">API Sathi call_id</span>
                <span className="font-bold">{response.callId}</span>
              </div>
            )}
          </div>

          {/* JSON Payload Inspector */}
          {response.result && (
            <div className="bg-[#1E293B] text-slate-200 rounded-2xl p-5 border border-slate-700 shadow-lg space-y-2.5 font-mono text-[11px]">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Response JSON (HTTP {response.httpStatus}{response.latencyMs ? ` · ${response.latencyMs}ms` : ''})</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleDownloadVerificationJson(response, selectedSlug)}
                    className="text-emerald-300 hover:text-white inline-flex items-center gap-1 text-[10px] cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download Summary</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(JSON.stringify(response, null, 2))}
                    className="text-slate-400 hover:text-white inline-flex items-center gap-1 text-[10px] cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy JSON</span>
                  </button>
                </div>
              </div>
              <pre className="max-h-72 overflow-y-auto leading-relaxed text-emerald-300">
                {JSON.stringify(response.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

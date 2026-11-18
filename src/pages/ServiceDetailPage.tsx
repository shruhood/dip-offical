import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  calculateOrderTotalsPaise,
  evaluatePackageOverlap,
  formatServicePriceLabel,
  fromPaise,
} from '../lib/finance';
import { generateDigitalProductPayload } from '../data/catalogue/digitalGenerators';
import { downloadAuthorizedDigitalProduct, submitCustomQuote } from '../services/backendApi';
import {
  findApiSathiServiceBySlugOrId,
  resolveApiSathiProductSlugForService,
} from '../data/apiSathiServices';
import { ApiSathiVerificationConsole } from '../components/verification/ApiSathiVerificationConsole';
import { CashfreeModal } from '../components/payment/CashfreeModal';
import { Service } from '../types';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  HelpCircle,
  Download,
  Tag,
  PackageCheck,
  Sparkles,
  Scale,
  Send,
  ChevronDown,
  Play,
  Lock,
} from 'lucide-react';

interface ServiceDetailPageProps {
  slug: string;
  onNavigate: (route: string, param?: string) => void;
  onApplyForService: (service: Service) => void;
}

export const ServiceDetailPage: React.FC<ServiceDetailPageProps> = ({
  slug,
  onNavigate,
  onApplyForService,
}) => {
  const {
    getServiceBySlug,
    services,
    applications,
    digitalOrders,
    validateCoupon,
    purchaseDigitalProduct,
    recordProductDownload,
    submitQuoteRequest,
  } = useData();
  const { user } = useAuth();
  const { t } = useLanguage();

  const service = getServiceBySlug(slug) || services[0];

  const [urgentProcessing, setUrgentProcessing] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');
  const [couponFeedback, setCouponFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [openFaqIndices, setOpenFaqIndices] = useState<number[]>([0]);

  useEffect(() => {
    setOpenFaqIndices([0]);
    setPaidVerificationOrderId(null);
    setVerificationCheckoutOpen(false);
  }, [service.id]);

  const [purchasingProduct, setPurchasingProduct] = useState(false);
  const [productCheckoutOpen, setProductCheckoutOpen] = useState(false);
  const [verificationCheckoutOpen, setVerificationCheckoutOpen] = useState(false);
  const [paidVerificationOrderId, setPaidVerificationOrderId] = useState<string | null>(null);
  const [downloadingProduct, setDownloadingProduct] = useState(false);
  const [productStatusMsg, setProductStatusMsg] = useState<string | null>(null);

  const apiSathiRetailService = useMemo(
    () => findApiSathiServiceBySlugOrId(service.slug),
    [service.slug]
  );
  const mappedApiSlug = useMemo(
    () => resolveApiSathiProductSlugForService(service.slug),
    [service.slug]
  );
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isPrivilegedVerifier = Boolean(
    user &&
      (isAdmin ||
        ((['operator', 'partner', 'business', 'b2b'].includes(
          String(user.role || '').toLowerCase()
        ) &&
          user.kycStatus === 'Approved')))
  );
  const isDevHost =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'digitalindiaproject.com' &&
    window.location.hostname !== 'www.digitalindiaproject.com';
  const isVerificationUnlocked = Boolean(
    paidVerificationOrderId || isPrivilegedVerifier || isDevHost
  );

  // Custom quote state
  const [quoteName, setQuoteName] = useState(user?.name || '');
  const [quoteEmail, setQuoteEmail] = useState(user?.email || '');
  const [quotePhone, setQuotePhone] = useState(user?.mobile || '');
  const [quoteCompany, setQuoteCompany] = useState('');
  const [quoteDetails, setQuoteDetails] = useState('');
  const [quoteBudget, setQuoteBudget] = useState('');
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteSuccessId, setQuoteSuccessId] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const isDigitalProduct = service.productType === 'digital_product';
  const isPackage = service.productType === 'compliance_package' || service.category === 'packages';
  const isCustomQuote = Boolean(service.isCustomQuote || service.pricingType === 'custom');

  const userApps = useMemo(() => {
    if (!user) return [];
    return applications.filter(
      (a) => a.userId === user.id || (user.email && a.userEmail.toLowerCase() === user.email.toLowerCase())
    );
  }, [applications, user]);

  const packageOverlap = useMemo(() => {
    if (!isPackage) return null;
    return evaluatePackageOverlap(service, services, userApps);
  }, [isPackage, service, services, userApps]);

  const activeCouponValidation = useMemo(() => {
    if (!appliedCouponCode) return null;
    const baseSubtotal = service.serviceCharge + (urgentProcessing ? service.urgentFee || 0 : 0);
    return validateCoupon(appliedCouponCode, baseSubtotal, service.category);
  }, [appliedCouponCode, service, urgentProcessing, validateCoupon]);

  const totals = useMemo(() => {
    const couponDiscount = activeCouponValidation?.valid ? activeCouponValidation.discountInr : 0;
    const totalDiscount = (service.discountInr || 0) + couponDiscount;
    return calculateOrderTotalsPaise({
      serviceChargeInr: service.serviceCharge,
      govtFeesInr: service.govtFees || 0,
      thirdPartyFeesInr: service.thirdPartyFees || 0,
      urgentFeeInr: urgentProcessing ? service.urgentFee || 0 : 0,
      discountInr: totalDiscount,
      taxRateBps: service.taxRateBps ?? 1800,
    });
  }, [service, urgentProcessing, activeCouponValidation]);

  const includedServices = useMemo(() => {
    if (!service.includedServiceIds?.length) return [];
    return service.includedServiceIds
      .map((id) => services.find((s) => s.id === id || s.slug === id))
      .filter((s): s is Service => Boolean(s));
  }, [service, services]);

  const existingPaidDigitalOrder = useMemo(() => {
    if (!isDigitalProduct) return undefined;
    return digitalOrders.find(
      (o) =>
        (o.serviceId === service.id || o.productSlug === service.slug) &&
        o.paymentStatus === 'Paid' &&
        (!user || o.userId === user.id || o.userEmail?.toLowerCase() === user.email?.toLowerCase())
    );
  }, [digitalOrders, isDigitalProduct, service.id, service.slug, user]);

  const relatedServices = useMemo(
    () =>
      services
        .filter(
          (s) =>
            s.published !== false &&
            s.category === service.category &&
            s.slug !== service.slug
        )
        .slice(0, 3),
    [services, service.category, service.slug]
  );

  const handleApplyCoupon = () => {
    const clean = couponInput.trim().toUpperCase();
    if (!clean) {
      setAppliedCouponCode('');
      setCouponFeedback(null);
      return;
    }
    const baseSubtotal = service.serviceCharge + (urgentProcessing ? service.urgentFee || 0 : 0);
    const res = validateCoupon(clean, baseSubtotal, service.category);
    if (res.valid) {
      setAppliedCouponCode(clean);
      setCouponFeedback({ ok: true, msg: res.message || `Saved ₹${res.discountInr}` });
    } else {
      setAppliedCouponCode('');
      setCouponFeedback({ ok: false, msg: res.message || 'Coupon could not be applied' });
    }
  };

  const handlePurchaseDigitalProduct = async () => {
    setPurchasingProduct(true);
    setProductStatusMsg(null);
    try {
      const orderId = `DPO-${Date.now().toString(36).toUpperCase()}`;
      const order = purchaseDigitalProduct({
        service,
        orderId,
        amountPaid: fromPaise(totals.totalPaise),
        discountAmount: fromPaise(totals.discountPaise),
        couponCode: appliedCouponCode || undefined,
      });
      setProductStatusMsg(`Order ${order.orderId} unlocked. Your digital asset is ready to download.`);
    } catch (err) {
      setProductStatusMsg(err instanceof Error ? err.message : 'Unable to unlock product order.');
    } finally {
      setPurchasingProduct(false);
    }
  };

  const handleDownloadAsset = async () => {
    setDownloadingProduct(true);
    setProductStatusMsg(null);
    try {
      const generated = generateDigitalProductPayload(
        service.digitalAsset?.generatorKey || service.slug,
        service.slug,
        service.name
      );
      const res = await downloadAuthorizedDigitalProduct({
        slug: service.slug,
        orderId: existingPaidDigitalOrder?.orderId,
        fallbackFileName: generated.fileName,
        fallbackGenerator: () => generated,
      });
      if (res.ok) {
        if (existingPaidDigitalOrder) {
          recordProductDownload(existingPaidDigitalOrder.orderId);
        }
        setProductStatusMsg(`Downloaded ${generated.fileName}`);
      } else {
        setProductStatusMsg(res.message || 'Authorized download verification failed.');
      }
    } finally {
      setDownloadingProduct(false);
    }
  };

  const handleCustomQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuoteError(null);
    if (!quoteName.trim() || !quoteEmail.trim() || !quotePhone.trim() || !quoteDetails.trim()) {
      setQuoteError('Please fill your name, email, phone, and project/filing scope.');
      return;
    }
    setQuoteSubmitting(true);
    try {
      const localRecord = await submitQuoteRequest({
        serviceId: service.id,
        serviceSlug: service.slug,
        serviceName: service.name,
        contactName: quoteName.trim(),
        contactEmail: quoteEmail.trim(),
        contactMobile: quotePhone.trim(),
        companyName: quoteCompany.trim() || undefined,
        requirementsSummary: quoteDetails.trim(),
        budgetRange: quoteBudget.trim() || undefined,
      });

      await submitCustomQuote({
        serviceSlug: service.slug,
        serviceName: service.name,
        contactName: quoteName.trim(),
        contactEmail: quoteEmail.trim(),
        contactMobile: quotePhone.trim(),
        companyName: quoteCompany.trim() || undefined,
        requirementsSummary: quoteDetails.trim(),
        budgetRange: quoteBudget.trim() || undefined,
        userId: user?.id,
      }).catch(() => undefined);

      setQuoteSuccessId(localRecord.id);
      setQuoteDetails('');
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Unable to submit quote request.');
    } finally {
      setQuoteSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Back button */}
      <button
        type="button"
        onClick={() => onNavigate('services', service.category)}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to {service.category.replace(/-/g, ' ')}</span>
      </button>

      {/* 1. Header & Overview Hero */}
      <div className="bg-gradient-to-r from-[#FFFDF8] via-white to-[#F7F8FA] dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6 sm:p-10 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#FF671F] bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-900 px-3 py-1 rounded-full uppercase tracking-wider">
                {service.category.replace(/-/g, ' ')}
              </span>
              {service.subcategory && (
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                  {service.subcategory}
                </span>
              )}
              <span className="text-xs font-semibold text-[#138808] dark:text-emerald-400 bg-green-50 dark:bg-emerald-950/40 border border-green-200 dark:border-emerald-900 px-3 py-1 rounded-full flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Est: {service.estimatedTime}</span>
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {service.name}
              </h1>
              {service.nameHi && (
                <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
                  {service.nameHi}
                </div>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              {service.fullDesc}
            </p>

            {/* Regulated Drafting Notice if present */}
            {service.regulatedNotice && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 max-w-2xl">
                <Scale className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Professional &amp; Regulated Compliance Notice:</strong> {service.regulatedNotice}
                </span>
              </div>
            )}

            {/* Private Consultancy Disclosure */}
            <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 max-w-2xl flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#138808] shrink-0 mt-0.5" />
              <span>
                <strong>Private Online Consultancy Service:</strong> Digital India Project is a private facilitation provider, not a government department. We prepare, review, and file documentation accurately; statutory approvals remain solely with respective authorities.
              </span>
            </div>
          </div>

          {/* Pricing & Apply / Buy / Quote Action Card */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {isCustomQuote ? 'Project / Scope Fee' : isDigitalProduct ? 'Instant Download Price' : 'Total Payable Estimate'}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                  {isCustomQuote ? formatServicePriceLabel(service) : `₹${fromPaise(totals.totalPaise)}`}
                </span>
                {!isCustomQuote && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    (Incl. GST &amp; statutory fees)
                  </span>
                )}
              </div>
              {(service.packageSavingsInr || 0) > 0 && (
                <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#138808] bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                  <Sparkles className="w-3 h-3" />
                  <span>Saves ₹{service.packageSavingsInr} vs individual filings</span>
                </div>
              )}
            </div>

            {!isCustomQuote ? (
              <>
                {/* Transparent Itemized Fee Breakdown */}
                <div className="space-y-2 text-xs border-y border-slate-100 dark:border-slate-800 py-3 font-mono tabular-nums">
                  <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Itemized Pricing Breakdown
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300 font-sans">
                    <span>Professional Fee:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      ₹{fromPaise(totals.serviceFeePaise)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300 font-sans">
                    <span>Government Fee (0% GST):</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {totals.govtFeePaise > 0 ? `₹${fromPaise(totals.govtFeePaise)}` : 'Actuals / ₹0'}
                    </span>
                  </div>
                  {totals.thirdPartyFeePaise > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-300 font-sans">
                      <span>3rd-Party Fees:</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        ₹{fromPaise(totals.thirdPartyFeePaise)}
                      </span>
                    </div>
                  )}
                  {totals.urgentFeePaise > 0 && (
                    <div className="flex justify-between text-[#FF671F] font-sans">
                      <span>Urgent Processing:</span>
                      <span className="font-mono font-semibold">+₹{fromPaise(totals.urgentFeePaise)}</span>
                    </div>
                  )}
                  {totals.discountPaise > 0 && (
                    <div className="flex justify-between text-[#138808] font-sans">
                      <span>Discount{appliedCouponCode ? ` (${appliedCouponCode})` : ''}:</span>
                      <span className="font-mono font-semibold">-₹{fromPaise(totals.discountPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600 dark:text-slate-300 font-sans">
                    <span>
                      GST ({((service.taxRateBps ?? 1800) / 100).toFixed(0)}% on net prof. fee):
                    </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      ₹{fromPaise(totals.taxPaise)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 mt-1 border-t border-slate-200/80 dark:border-slate-700 font-sans">
                    <span className="font-bold text-slate-900 dark:text-white">Total Payable:</span>
                    <span className="font-mono font-black text-sm text-[#138808] dark:text-emerald-400">
                      ₹{fromPaise(totals.totalPaise)}
                    </span>
                  </div>
                  {service.govtFeeNote && (
                    <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400 pt-1 leading-relaxed">
                      Statutory Note: {service.govtFeeNote}
                    </p>
                  )}
                </div>

                {/* Urgent Processing Option */}
                {(service.urgentFee || 0) > 0 && (
                  <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs cursor-pointer">
                    <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={urgentProcessing}
                        onChange={(e) => setUrgentProcessing(e.target.checked)}
                        className="accent-[#FF671F]"
                      />
                      <span>Priority / Urgent Desk</span>
                    </span>
                    <span className="font-mono font-bold text-[#FF671F]">+₹{service.urgentFee}</span>
                  </label>
                )}

                {/* Promo Coupon Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Promo code (e.g. DIGITAL10)"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-2 py-2 text-xs uppercase focus:outline-none focus:border-[#FF671F]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className="px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                  {couponFeedback && (
                    <p
                      className={`text-[11px] font-semibold ${
                        couponFeedback.ok ? 'text-[#138808]' : 'text-red-600'
                      }`}
                    >
                      {couponFeedback.msg}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-2 text-xs border-y border-slate-100 dark:border-slate-800 py-3 font-mono tabular-nums">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Itemized Scope Pricing Structure
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300 font-sans">
                  <span>Professional Fee:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {service.serviceCharge > 0 ? `From ₹${service.serviceCharge}` : 'Scope-Based'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300 font-sans">
                  <span>Government Fee (0% GST):</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {service.govtFees > 0 ? `₹${service.govtFees}` : 'Actuals / As applicable'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300 font-sans">
                  <span>GST ({((service.taxRateBps ?? 1800) / 100).toFixed(0)}% on prof. fee):</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {service.serviceCharge > 0 ? `₹${fromPaise(totals.taxPaise)}` : 'Applicable at invoice'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-slate-200/80 dark:border-slate-700 font-sans">
                  <span className="font-bold text-slate-900 dark:text-white">Total Payable:</span>
                  <span className="font-mono font-black text-sm text-[#138808] dark:text-emerald-400">
                    {service.serviceCharge > 0 ? `From ₹${fromPaise(totals.totalPaise)}` : 'Custom Proposal'}
                  </span>
                </div>
              </div>
            )}

            {/* Primary CTA */}
            {apiSathiRetailService ? (
              <div className="space-y-2">
                {isVerificationUnlocked ? (
                  <a
                    href="#instant-verify-section"
                    className="w-full bg-[#138808] hover:bg-emerald-700 text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>Run Instant Verification Below</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setVerificationCheckoutOpen(true)}
                    className="w-full bg-[#138808] hover:bg-emerald-700 text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Pay ₹{fromPaise(totals.totalPaise)} &amp; Unlock Check</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onApplyForService(service)}
                  className="w-full border border-slate-300 dark:border-slate-700 hover:border-[#FF671F] text-slate-700 dark:text-slate-200 font-semibold text-xs py-2.5 px-3 rounded-xl transition cursor-pointer"
                >
                  Request Operator-Assisted Check
                </button>
              </div>
            ) : isDigitalProduct ? (
              <div className="space-y-2.5">
                {existingPaidDigitalOrder || user?.role === 'admin' || user?.role === 'super_admin' ? (
                  <button
                    type="button"
                    disabled={downloadingProduct}
                    onClick={handleDownloadAsset}
                    className="w-full bg-[#138808] hover:bg-emerald-700 text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{downloadingProduct ? 'Preparing File...' : 'Download Digital Asset'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={purchasingProduct}
                    onClick={() => setProductCheckoutOpen(true)}
                    className="w-full bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Buy &amp; Unlock Instant Download (₹{fromPaise(totals.totalPaise)})</span>
                  </button>
                )}

                {!existingPaidDigitalOrder &&
                  typeof window !== 'undefined' &&
                  window.location.hostname !== 'digitalindiaproject.com' &&
                  window.location.hostname !== 'www.digitalindiaproject.com' && (
                    <button
                      type="button"
                      disabled={purchasingProduct}
                      onClick={handlePurchaseDigitalProduct}
                      className="w-full border border-slate-300 dark:border-slate-700 hover:border-[#FF671F] text-slate-700 dark:text-slate-200 font-semibold text-xs py-2.5 px-3 rounded-xl transition cursor-pointer"
                    >
                      {purchasingProduct ? 'Recording Order...' : 'Quick Order Unlock (Dev Sandbox)'}
                    </button>
                  )}

                {productStatusMsg && (
                  <p className="text-[11px] font-semibold text-[#138808] text-center">
                    {productStatusMsg}
                  </p>
                )}
              </div>
            ) : isCustomQuote ? (
              <a
                href="#custom-quote-form"
                className="w-full bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Request Custom Scope Quote</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onApplyForService(service)}
                className="w-full bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-sm py-3.5 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{t('common.applyNow')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <div className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#138808]" />
              <span>Protected by Cashfree Payments · Instant Receipt</span>
            </div>
          </div>
        </div>
      </div>

      {/* Package Bundle Details + Overlap Credit */}
      {isPackage && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-[#138808]" />
              <span>What&apos;s Included in This Package ({includedServices.length} Services)</span>
            </h2>
            {packageOverlap && packageOverlap.overlappingServiceIds.length > 0 && (
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-lg">
                Overlap Credit Eligible: {packageOverlap.overlappingServiceIds.length} completed service(s) (~₹
                {packageOverlap.suggestedDeductionInr} credit)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {includedServices.map((inc) => (
              <button
                key={inc.id}
                type="button"
                onClick={() => onNavigate('service-detail', inc.slug)}
                className="text-left p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] transition flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {inc.name}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{inc.estimatedTime}</div>
                </div>
                <span className="text-xs font-mono font-bold text-[#FF671F] shrink-0">
                  ₹{inc.serviceCharge}
                </span>
              </button>
            ))}
          </div>

          {service.exclusions && service.exclusions.length > 0 && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">
                Package Exclusions &amp; Statutory Notes
              </div>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
                {service.exclusions.map((ex, i) => (
                  <li key={i}>{ex}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Digital Product Asset Preview Card */}
      {isDigitalProduct && service.digitalAsset && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-[#FF671F]" />
              <span>Downloadable Asset Specifications</span>
            </h2>
            <span className="text-xs font-mono font-bold text-[#138808] bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg">
              {service.digitalAsset.fileFormat} · v{service.digitalAsset.version}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {service.digitalAsset.previewSummary}
          </p>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Format: <span className="font-mono">{service.digitalAsset.fileFormat}</span> ({service.digitalAsset.fileSizeLabel}) · Access verified automatically after payment inside your Customer Dashboard under Digital Downloads.
          </div>
        </div>
      )}

      {/* Instant API Sathi Verification Execution Section */}
      {apiSathiRetailService ? (
        <section
          id="instant-verify-section"
          className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#138808] dark:text-emerald-400">
                Instant Online Registry Execution
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {apiSathiRetailService.name}
              </h2>
            </div>
            <div className="text-xs font-mono text-slate-500">
              {paidVerificationOrderId
                ? `Unlocked Order: ${paidVerificationOrderId}`
                : isPrivilegedVerifier
                ? 'Authorized Partner/Admin Desk Access'
                : isDevHost
                ? 'Sandbox Preview Unlocked'
                : `Pay ₹${fromPaise(totals.totalPaise)} to unlock`}
            </div>
          </div>

          {isVerificationUnlocked ? (
            <ApiSathiVerificationConsole
              defaultSlug={apiSathiRetailService.apiSathiProductSlug}
              lockProduct
              serviceName={service.name}
              isAdmin={isAdmin}
            />
          ) : (
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3 text-xs text-slate-700 dark:text-slate-200">
                <Lock className="w-5 h-5 text-[#FF671F] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm">Instant Check Locked Until Payment</div>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Complete your ₹{fromPaise(totals.totalPaise)} Cashfree payment to immediately unlock live verification input and downloadable audit summary.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVerificationCheckoutOpen(true)}
                className="bg-[#138808] hover:bg-emerald-700 text-white font-bold text-xs px-5 py-3 rounded-xl whitespace-nowrap cursor-pointer shrink-0"
              >
                Pay ₹{fromPaise(totals.totalPaise)} &amp; Run Check
              </button>
            </div>
          )}
        </section>
      ) : mappedApiSlug ? (
        <section className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 text-xs">
            <ShieldCheck className="w-5 h-5 text-[#138808] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                Need an Instant Pre-Verification Before Applying?
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                Run an instant live registry lookup ({mappedApiSlug}) to confirm current status and records before submitting your full application.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('verifications', mappedApiSlug)}
            className="bg-[#138808] hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Open Instant Check</span>
          </button>
        </section>
      ) : null}

      {/* Main Grid: Eligibility, Required Docs, Process, Instructions, FAQs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Custom Quote Inquiry Form */}
          {isCustomQuote && (
            <div
              id="custom-quote-form"
              className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-[#FF671F]/40 shadow-xs space-y-4"
            >
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF671F]">
                  Direct Project &amp; Retainer Desk
                </span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Request Custom Proposal for {service.name}
                </h2>
              </div>

              {quoteSuccessId ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 space-y-1">
                  <div className="font-bold">Quote Request Received ({quoteSuccessId})</div>
                  <p>
                    Our Silvassa advisory team has logged your requirements. Track updates anytime in your Dashboard or await confirmation within 1 business day.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleCustomQuoteSubmit} className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Full Name *"
                      value={quoteName}
                      onChange={(e) => setQuoteName(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#FF671F]"
                    />
                    <input
                      type="email"
                      required
                      placeholder="Email Address *"
                      value={quoteEmail}
                      onChange={(e) => setQuoteEmail(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#FF671F]"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="Phone / WhatsApp *"
                      value={quotePhone}
                      onChange={(e) => setQuotePhone(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#FF671F]"
                    />
                    <input
                      type="text"
                      placeholder="Company / Organization Name"
                      value={quoteCompany}
                      onChange={(e) => setQuoteCompany(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#FF671F]"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Expected Budget Range (optional)"
                    value={quoteBudget}
                    onChange={(e) => setQuoteBudget(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#FF671F]"
                  />
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe your volume, scope, city/state, or integrations needed *"
                    value={quoteDetails}
                    onChange={(e) => setQuoteDetails(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#FF671F]"
                  />
                  {quoteError && <p className="text-red-600 font-semibold">{quoteError}</p>}
                  <button
                    type="submit"
                    disabled={quoteSubmitting}
                    className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-5 py-2.5 rounded-xl inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{quoteSubmitting ? 'Submitting...' : 'Submit Quote Inquiry'}</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Eligibility Requirements */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#138808]" />
              <span>Eligibility Requirements</span>
            </h2>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              {service.eligibility.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF671F] mt-1.5 shrink-0"></span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Required Documents Checklist */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#FF671F]" />
                <span>Required Documents Checklist</span>
              </h2>
              <span className="text-[11px] text-slate-400">PDF, JPG, PNG accepted</span>
            </div>

            {service.requiredDocs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No physical document uploads required for this digital item.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {service.requiredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                      <span>{doc.name}</span>
                      {doc.mandatory ? (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-1.5 py-0.5 rounded">
                          Mandatory
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                          Optional
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{doc.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Application Process Steps */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#2563EB]" />
              <span>Step-by-Step Delivery Workflow</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {service.processSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5 text-xs"
                >
                  <div className="font-mono text-[10px] font-bold text-[#FF671F] uppercase">
                    Stage 0{idx + 1}
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white text-xs">{step.title}</div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Important Instructions */}
          <div className="p-5 bg-[#FFFDF8] dark:bg-slate-900 border border-[#F1E8D9] dark:border-slate-800 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-[#FF671F] font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Important Instructions</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              Ensure your mobile number and email are active for verification updates. Uploaded scans must be legible without glare or cropping. Timelines displayed are estimated facilitation windows and exclude external government portal verification delays.
            </p>
          </div>

          {/* FAQs (Interactive Accordion — synced 1:1 with FAQPage JSON-LD) */}
          {service.faqs && service.faqs.length > 0 && (
            <section
              aria-labelledby="service-faq-heading"
              className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2
                  id="service-faq-heading"
                  className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2"
                >
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>Frequently Asked Questions</span>
                </h2>
                {service.faqs.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenFaqIndices((prev) =>
                        prev.length === service.faqs.length
                          ? [0]
                          : service.faqs.map((_, idx) => idx)
                      )
                    }
                    className="text-[11px] font-semibold text-[#FF671F] hover:underline cursor-pointer"
                  >
                    {openFaqIndices.length === service.faqs.length ? 'Collapse All' : 'Expand All'}
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {service.faqs.map((faq, fIdx) => {
                  const isExpanded = openFaqIndices.includes(fIdx);
                  const panelId = `service-faq-panel-${fIdx}`;
                  return (
                    <div
                      key={fIdx}
                      className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs"
                    >
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        onClick={() =>
                          setOpenFaqIndices((prev) =>
                            prev.includes(fIdx)
                              ? prev.filter((idx) => idx !== fIdx)
                              : [...prev, fIdx]
                          )
                        }
                        className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 font-bold text-slate-900 dark:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        <span>{faq.question}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180 text-[#FF671F]' : ''
                          }`}
                        />
                      </button>
                      <div
                        id={panelId}
                        className={isExpanded ? 'px-4 pb-3.5 pt-0.5 text-slate-600 dark:text-slate-300 leading-relaxed' : 'hidden'}
                      >
                        <p>{faq.answer}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar: Related Services & Help Desk */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Related in {service.category.replace(/-/g, ' ')}
            </h3>

            <div className="space-y-3">
              {relatedServices.map((rel) => (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => onNavigate('service-detail', rel.slug)}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] hover:bg-slate-50 dark:hover:bg-slate-800 transition block space-y-1 cursor-pointer"
                >
                  <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center justify-between gap-2">
                    <span className="truncate">{rel.name}</span>
                    <span className="text-[#FF671F] font-mono shrink-0">
                      {formatServicePriceLabel(rel)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    {rel.shortDesc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#202124] text-white p-6 rounded-2xl space-y-3">
            <span className="text-[10px] font-bold text-[#FFC928] uppercase tracking-wider">
              Need Help With This Service?
            </span>
            <h4 className="text-sm font-bold">Have Questions on Eligibility, Proofs or Pricing?</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Our Silvassa operations desk can confirm exact document requirements and statutory fees prior to filing.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="w-full bg-[#138808] hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-lg transition cursor-pointer"
            >
              Speak with Help Desk
            </button>
          </div>
        </div>
      </div>

      {isDigitalProduct && productCheckoutOpen && (
        <CashfreeModal
          isOpen
          onClose={() => setProductCheckoutOpen(false)}
          serviceId={service.id}
          serviceSlug={service.slug}
          serviceName={service.name}
          serviceCharge={fromPaise(totals.serviceFeePaise)}
          govtFees={fromPaise(totals.govtFeePaise)}
          thirdPartyFees={fromPaise(totals.thirdPartyFeePaise)}
          urgentFee={fromPaise(totals.urgentFeePaise)}
          urgentProcessing={urgentProcessing}
          couponCode={appliedCouponCode || undefined}
          discountAmount={fromPaise(totals.discountPaise)}
          taxAmount={fromPaise(totals.taxPaise)}
          taxRateBps={service.taxRateBps ?? 1800}
          applicantId={user?.id || 'guest_product_buyer'}
          applicantName={user?.name || 'Digital India Customer'}
          applicantEmail={user?.email || 'citizen@digitalindiaproject.com'}
          applicantMobile={user?.mobile || '9876543210'}
          onPaymentSuccess={(details) => {
            purchaseDigitalProduct({
              service,
              orderId: details.orderId,
              amountPaid: details.amount,
              discountAmount: fromPaise(totals.discountPaise),
              couponCode: appliedCouponCode || undefined,
            });
            setProductCheckoutOpen(false);
            setProductStatusMsg(
              `Payment verified (${details.orderId}). Digital asset unlocked — click Download Digital Asset above.`
            );
          }}
        />
      )}
      {apiSathiRetailService && verificationCheckoutOpen && (
        <CashfreeModal
          isOpen
          onClose={() => setVerificationCheckoutOpen(false)}
          serviceId={service.id}
          serviceSlug={service.slug}
          serviceName={service.name}
          serviceCharge={fromPaise(totals.serviceFeePaise)}
          govtFees={fromPaise(totals.govtFeePaise)}
          thirdPartyFees={fromPaise(totals.thirdPartyFeePaise)}
          urgentFee={fromPaise(totals.urgentFeePaise)}
          urgentProcessing={urgentProcessing}
          couponCode={appliedCouponCode || undefined}
          discountAmount={fromPaise(totals.discountPaise)}
          taxAmount={fromPaise(totals.taxPaise)}
          taxRateBps={service.taxRateBps ?? 1800}
          applicantId={user?.id || 'guest_verification_buyer'}
          applicantName={user?.name || 'Digital India Customer'}
          applicantEmail={user?.email || 'citizen@digitalindiaproject.com'}
          applicantMobile={user?.mobile || '9876543210'}
          onPaymentSuccess={(details) => {
            setPaidVerificationOrderId(details.orderId);
            setVerificationCheckoutOpen(false);
          }}
        />
      )}
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  CreditCard,
  Building,
  CheckCircle2,
  Lock,
  ArrowRight,
  X,
  Smartphone,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { load as loadCashfreeSdk } from '@cashfreepayments/cashfree-js';
import {
  checkCashfreePaymentStatus,
  createCashfreePaymentOrder,
} from '../../services/backendApi';
import { VerificationSkeleton } from '../common/SkeletonLoaders';

interface CashfreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId?: string;
  serviceSlug?: string;
  serviceName: string;
  serviceCharge: number;
  govtFees: number;
  thirdPartyFees?: number;
  urgentFee?: number;
  urgentProcessing?: boolean;
  couponCode?: string;
  discountAmount?: number;
  additionalCharge?: number;
  taxAmount?: number;
  taxRateBps?: number;
  applicantId?: string;
  applicantName: string;
  applicantEmail: string;
  applicantMobile: string;
  applicationId?: string;
  retryOfOrderId?: string;
  preferredMode?: 'sandbox' | 'production';
  onPaymentSuccess: (paymentDetails: {
    orderId: string;
    cfPaymentId: string;
    amount: number;
    paymentMethod: string;
    paidAt?: string;
    bankReference?: string;
    verifiedByGateway?: boolean;
  }) => void;
}

export const CashfreeModal: React.FC<CashfreeModalProps> = ({
  isOpen,
  onClose,
  serviceId,
  serviceSlug,
  serviceName,
  serviceCharge,
  govtFees,
  thirdPartyFees = 0,
  urgentFee = 0,
  urgentProcessing = false,
  couponCode,
  discountAmount = 0,
  additionalCharge = 0,
  taxAmount = 0,
  taxRateBps = 0,
  applicantId,
  applicantName,
  applicantEmail,
  applicantMobile,
  applicationId,
  retryOfOrderId,
  preferredMode = 'production',
  onPaymentSuccess,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('');
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');

  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<'checkout' | 'verifying' | 'sandbox_confirm' | 'success' | 'error'>('checkout');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [gatewayMode, setGatewayMode] = useState<'sandbox' | 'production'>(preferredMode);
  const [isLiveGateway, setIsLiveGateway] = useState<boolean | null>(null);

  const pollTimerRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    setGatewayMode(preferredMode);
  }, [preferredMode, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      completedRef.current = false;
      setProcessing(false);
      setStep('checkout');
      setErrorMsg(null);
      setStatusMessage('');
      setActiveOrderId(null);
      setIsLiveGateway(null);
    }
    return () => {
      stopPolling();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalAmount = Math.max(
    0,
    serviceCharge +
      govtFees +
      thirdPartyFees +
      urgentFee +
      additionalCharge -
      discountAmount +
      taxAmount
  );

  const finishWithVerifiedPayment = (details: {
    orderId: string;
    cfPaymentId: string;
    paymentMethod: string;
    paidAt?: string;
    bankReference?: string;
    verifiedByGateway: boolean;
  }) => {
    if (completedRef.current) return;
    completedRef.current = true;
    stopPolling();
    setProcessing(false);
    setStep('success');

    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#FF671F', '#138808', '#FFC928'],
      });
    } catch {
      // ignore confetti errors
    }

    window.setTimeout(() => {
      onPaymentSuccess({
        orderId: details.orderId,
        cfPaymentId: details.cfPaymentId,
        amount: totalAmount,
        paymentMethod: details.paymentMethod,
        paidAt: details.paidAt || new Date().toISOString(),
        bankReference: details.bankReference,
        verifiedByGateway: details.verifiedByGateway,
      });
    }, 1200);
  };

  const verifyOrderNow = async (
    orderId: string,
    mode: 'sandbox' | 'production'
  ): Promise<'PAID' | 'FAILED' | 'PENDING'> => {
    const res = await checkCashfreePaymentStatus(orderId, mode);
    if (!res.ok || !res.data) {
      return 'PENDING';
    }
    if (res.data.paid || res.data.orderStatus === 'PAID') {
      finishWithVerifiedPayment({
        orderId: res.data.orderId || orderId,
        cfPaymentId: res.data.cfPaymentId || `CF_PAY_${Date.now()}`,
        paymentMethod: res.data.paymentMethod || 'Cashfree Online Payment',
        paidAt: res.data.paymentTime || new Date().toISOString(),
        bankReference: res.data.bankReference,
        verifiedByGateway: Boolean(res.data.gatewayConfigured),
      });
      return 'PAID';
    }
    if (res.data.orderStatus === 'FAILED' || res.data.orderStatus === 'EXPIRED' || res.data.orderStatus === 'DROPPED') {
      return 'FAILED';
    }
    return 'PENDING';
  };

  const handlePay = async () => {
    completedRef.current = false;
    stopPolling();
    setProcessing(true);
    setErrorMsg(null);
    setStep('verifying');
    setStatusMessage('Creating encrypted Cashfree payment session...');

    const idempotencyKey = retryOfOrderId
      ? `retry_${retryOfOrderId}_${Date.now()}`
      : `idem_${applicantId || 'guest'}_${serviceName.slice(0, 12).replace(/\W/g, '')}_${Math.floor(Date.now() / 15000)}`;
    const orderRes = await createCashfreePaymentOrder({
      applicationId,
      retryOfOrderId,
      serviceId,
      serviceSlug,
      serviceName,
      serviceChargeInr: serviceCharge,
      govtFeesInr: govtFees,
      thirdPartyFeesInr: thirdPartyFees,
      additionalChargeInr: additionalCharge,
      urgentProcessing,
      couponCode,
      taxRateBps,
      totalAmountInr: totalAmount,
      customerId: applicantId,
      customerName: applicantName,
      customerEmail: applicantEmail,
      customerPhone: applicantMobile,
      preferredMode,
      idempotencyKey,
      returnUrl: `${window.location.origin}/?cf_order_id={order_id}`,
    });

    if (!orderRes.ok || !orderRes.data) {
      setProcessing(false);
      setStep('error');
      setErrorMsg(orderRes.message || 'Unable to initialize Cashfree payment order.');
      return;
    }

    const { orderId, paymentSessionId, mode, gatewayConfigured } = orderRes.data;
    setActiveOrderId(orderId);
    setGatewayMode(mode);
    setIsLiveGateway(gatewayConfigured);

    // Live / Sandbox Real-Time Cashfree PG Checkout Flow
    if (gatewayConfigured && paymentSessionId && !paymentSessionId.startsWith('sim_')) {
      setStatusMessage(`Opening Cashfree ${mode === 'production' ? 'Live' : 'Sandbox'} Checkout...`);

      // Start real-time background status polling every 2.5s (webhook + PG API sync)
      pollTimerRef.current = window.setInterval(() => {
        if (!completedRef.current) {
          void verifyOrderNow(orderId, mode);
        }
      }, 2500);

      try {
        const cashfree = await loadCashfreeSdk({ mode });
        if (!cashfree) {
          throw new Error('Cashfree JS SDK failed to load. Check network/CSP settings.');
        }

        const checkoutResult = await cashfree.checkout({
          paymentSessionId,
          redirectTarget: '_modal',
        });

        if (completedRef.current) return;

        setStatusMessage('Confirming real-time payment status with Cashfree...');
        const immediateStatus = await verifyOrderNow(orderId, mode);
        if (immediateStatus === 'PAID') return;

        if (checkoutResult?.error) {
          stopPolling();
          setProcessing(false);
          setStep('error');
          setErrorMsg(
            checkoutResult.error.message ||
              'Payment was cancelled or declined before confirmation.'
          );
          return;
        }

        if (immediateStatus === 'FAILED') {
          stopPolling();
          setProcessing(false);
          setStep('error');
          setErrorMsg('Cashfree reported this payment as failed or expired. Please try again.');
          return;
        }

        // Wait briefly for bank/UPI webhook settlement; keep polling active
        setStatusMessage(
          'Waiting for real-time bank/UPI confirmation. You can click "Verify Status Now" below.'
        );
      } catch (err: any) {
        stopPolling();
        setProcessing(false);
        setStep('error');
        setErrorMsg(err?.message || 'Cashfree checkout window could not be opened.');
      }
      return;
    }

    const isProductionOrigin =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'digitalindiaproject.com' ||
        window.location.hostname === 'www.digitalindiaproject.com');

    if (isProductionOrigin) {
      setProcessing(false);
      setStep('error');
      setErrorMsg(
        'Cashfree payment gateway credentials are not active on the production server. Sandbox simulation is disabled in production.'
      );
      return;
    }

    // In non-production dev/sandbox environments, require explicit operator/tester confirmation instead of silent approval
    setProcessing(false);
    setStep('sandbox_confirm');
    setStatusMessage('Sandbox preview session ready — explicit confirmation required.');
  };

  const handleConfirmSandboxPreview = async () => {
    if (!activeOrderId) return;
    setProcessing(true);
    setStatusMessage('Recording explicit sandbox test payment...');
    const verifyRes = await checkCashfreePaymentStatus(activeOrderId, gatewayMode, true);
    if (!verifyRes.ok || !verifyRes.data?.paid) {
      setProcessing(false);
      setStep('error');
      setErrorMsg(verifyRes.message || 'Sandbox verification rejected by server.');
      return;
    }

    const methodLabel =
      selectedMethod === 'upi'
        ? `UPI (${upiId || 'Instant QR'}) [Sandbox Preview]`
        : selectedMethod === 'card'
        ? 'Card [Hosted Cashfree Sandbox]'
        : `NetBanking (${selectedBank}) [Sandbox Preview]`;

    finishWithVerifiedPayment({
      orderId: activeOrderId,
      cfPaymentId: verifyRes.data.cfPaymentId || `CF_PAY_SIM_${Date.now()}`,
      paymentMethod: verifyRes.data.paymentMethod || methodLabel,
      paidAt: verifyRes.data.paymentTime || new Date().toISOString(),
      verifiedByGateway: false,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="bg-[#202124] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#FF671F] flex items-center justify-center text-white font-black text-xs">
              CF
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold tracking-tight">
                <span>Cashfree Payments</span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                    isLiveGateway === false
                      ? 'bg-amber-500/20 text-amber-200'
                      : gatewayMode === 'production'
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : 'bg-slate-700 text-slate-200'
                  }`}
                >
                  {isLiveGateway === false
                    ? 'Sandbox Preview'
                    : gatewayMode === 'production'
                    ? 'Live Production PG'
                    : 'Cashfree Sandbox'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                {activeOrderId ? `Order #${activeOrderId}` : 'Secure 2023-08-01 Checkout'}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              stopPolling();
              onClose();
            }}
            disabled={processing && step === 'success'}
            className="p-1 rounded-md text-slate-400 hover:text-white transition disabled:opacity-30 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {step === 'checkout' && (
            <div className="space-y-5">
              <div className="bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2 tabular-nums">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{serviceName}</span>
                  <span className="text-slate-500">{applicantName}</span>
                </div>
                <div className="border-t border-slate-200/60 dark:border-slate-700 pt-2 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Facilitation Service Charge:</span>
                    <span className="font-mono">₹{serviceCharge.toLocaleString('en-IN')}</span>
                  </div>
                  {govtFees > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Statutory Government Fees:</span>
                      <span className="font-mono">₹{govtFees.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {thirdPartyFees > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>3rd-Party Portal / Stamp Fees:</span>
                      <span className="font-mono">₹{thirdPartyFees.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {urgentFee > 0 && (
                    <div className="flex justify-between text-[#FF671F]">
                      <span>Priority / Urgent Processing:</span>
                      <span className="font-mono">+₹{urgentFee.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {additionalCharge > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Additional Processing Charge:</span>
                      <span className="font-mono">₹{additionalCharge.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-[#138808]">
                      <span>Promo Discount {couponCode ? `(${couponCode})` : ''}:</span>
                      <span className="font-mono">-₹{discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {taxAmount > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>GST ({(taxRateBps / 100).toFixed(0)}% on Service Charge):</span>
                      <span className="font-mono">₹{taxAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 dark:text-white font-bold text-sm pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span>Total Payable (INR):</span>
                    <span className="text-[#138808] font-mono">₹{totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Preferred Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('upi')}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                      selectedMethod === 'upi'
                        ? 'border-[#FF671F] bg-[#FFF5EE] dark:bg-orange-950/30 text-[#FF671F] font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span className="text-xs">UPI / QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('card')}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                      selectedMethod === 'card'
                        ? 'border-[#FF671F] bg-[#FFF5EE] dark:bg-orange-950/30 text-[#FF671F] font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span className="text-xs">Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod('netbanking')}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1 cursor-pointer ${
                      selectedMethod === 'netbanking'
                        ? 'border-[#FF671F] bg-[#FFF5EE] dark:bg-orange-950/30 text-[#FF671F] font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs'
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    <span className="text-xs">NetBanking</span>
                  </button>
                </div>
              </div>

              {selectedMethod === 'upi' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <span>Pay with any UPI App (GPay, PhonePe, Paytm, BHIM)</span>
                    <span className="text-[11px] text-[#138808]">0% Surcharge</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="mobile@upi or id@okhdfcbank (optional)"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#FF671F]"
                    />
                  </div>
                </div>
              )}

              {selectedMethod === 'card' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <ShieldCheck className="w-4 h-4 text-[#138808] shrink-0" />
                    <span>PCI-DSS Hosted Card Checkout</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Visa, Mastercard, RuPay, and Amex credentials are entered directly inside Cashfree&apos;s encrypted PCI-DSS Level 1 checkout window after clicking Pay below. No card numbers or CVV are ever stored on our servers.
                  </p>
                </div>
              )}

              {selectedMethod === 'netbanking' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">Select Bank</label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs"
                  >
                    <option>HDFC Bank</option>
                    <option>State Bank of India</option>
                    <option>ICICI Bank</option>
                    <option>Axis Bank</option>
                    <option>Kotak Mahindra Bank</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={handlePay}
                disabled={processing}
                className="w-full bg-[#138808] hover:bg-emerald-700 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>Pay ₹{totalAmount.toLocaleString('en-IN')} via Cashfree</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 text-center">
                <ShieldCheck className="w-3.5 h-3.5 text-[#138808]" />
                <span>256-Bit Encrypted · Real-Time Webhook &amp; Order Verification</span>
              </div>
            </div>
          )}

          {step === 'verifying' && (
            <div className="py-4 space-y-4">
              <VerificationSkeleton
                title="Real-Time Cashfree Verification"
                subtitle={statusMessage || 'Syncing live payment status with Cashfree Payment Gateway...'}
              />
              {activeOrderId && isLiveGateway && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => void verifyOrderNow(activeOrderId, gatewayMode)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF671F] border border-orange-200 dark:border-slate-700 px-3.5 py-2 rounded-lg hover:bg-orange-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Verify Status Now</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'sandbox_confirm' && (
            <div className="py-6 space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                <div className="font-bold">Non-Production Sandbox Mode</div>
                <p>
                  Live Cashfree gateway credentials are not bound in this development runtime. Confirming below executes a non-production test payment only.
                </p>
                {activeOrderId && (
                  <div className="font-mono text-[11px] pt-1">Order: {activeOrderId}</div>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleConfirmSandboxPreview()}
                  disabled={processing}
                  className="flex-1 bg-[#138808] hover:bg-emerald-700 text-white font-bold text-xs py-3 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {processing ? 'Processing...' : `Confirm Sandbox Test Payment (₹${totalAmount.toLocaleString('en-IN')})`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('checkout');
                    setErrorMsg(null);
                  }}
                  disabled={processing}
                  className="px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-white">
                  Payment Not Completed
                </h4>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-sm mx-auto">
                  {errorMsg || 'Cashfree checkout could not confirm this transaction.'}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setStep('checkout');
                    setErrorMsg(null);
                  }}
                  className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
                >
                  Retry Payment
                </button>
                {activeOrderId && isLiveGateway && (
                  <button
                    type="button"
                    onClick={() => {
                      setStep('verifying');
                      setProcessing(true);
                      void verifyOrderNow(activeOrderId, gatewayMode);
                    }}
                    className="border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
                  >
                    Re-check Status
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#EAF7EC] text-[#138808] flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-800 dark:text-white">
                  {isLiveGateway ? 'Payment Confirmed by Cashfree!' : 'Sandbox Payment Successful!'}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  ₹{totalAmount.toLocaleString('en-IN')} verified. Generating official Application ID &amp; GST Invoice...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

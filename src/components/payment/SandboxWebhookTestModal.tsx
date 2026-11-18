import React, { useState } from 'react';
import {
  CheckCircle2,
  X,
  FlaskConical,
  CreditCard,
  Smartphone,
  Building,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Webhook,
} from 'lucide-react';
import {
  createSandboxTestOrder,
  verifySandboxWebhookEndToEnd,
  type SandboxTestOrderData,
  type SandboxWebhookVerifyResult,
} from '../../services/backendApi';

interface SandboxWebhookTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: 'operator' | 'partner';
  actorName?: string;
  onVerified?: (result: SandboxWebhookVerifyResult) => void;
}

export const SandboxWebhookTestModal: React.FC<SandboxWebhookTestModalProps> = ({
  isOpen,
  onClose,
  channel,
  actorName = 'Desk Operator',
  onVerified,
}) => {
  const [amountInr, setAmountInr] = useState<number>(199);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [eventType, setEventType] = useState<
    'PAYMENT_SUCCESS_WEBHOOK' | 'PAYMENT_FAILED_WEBHOOK' | 'PAYMENT_USER_DROPPED_WEBHOOK'
  >('PAYMENT_SUCCESS_WEBHOOK');

  const [step, setStep] = useState<'setup' | 'running' | 'complete' | 'error'>('setup');
  const [phaseLabel, setPhaseLabel] = useState('');
  const [orderData, setOrderData] = useState<SandboxTestOrderData | null>(null);
  const [verifyResult, setVerifyResult] = useState<SandboxWebhookVerifyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetModal = () => {
    setStep('setup');
    setPhaseLabel('');
    setOrderData(null);
    setVerifyResult(null);
    setErrorMsg(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleRunEndToEndTest = async () => {
    setErrorMsg(null);
    setVerifyResult(null);
    setOrderData(null);
    setStep('running');

    setPhaseLabel('Step 1/3 — Initializing isolated TEST_CF sandbox order...');
    const orderRes = await createSandboxTestOrder({ amountInr, channel });
    if (!orderRes.ok || !orderRes.data?.orderId) {
      setStep('error');
      setErrorMsg(orderRes.message || 'Could not initialize sandbox test order.');
      return;
    }
    setOrderData(orderRes.data);

    setPhaseLabel('Step 2/3 — Simulating Cashfree checkout & HMAC-SHA256 webhook signature...');
    const webhookRes = await verifySandboxWebhookEndToEnd({
      orderId: orderRes.data.orderId,
      eventType,
      paymentMethod,
      amountInr: orderRes.data.amountInr,
    });

    if (!webhookRes.ok || !webhookRes.data) {
      setStep('error');
      setErrorMsg(webhookRes.message || 'Webhook delivery verification failed.');
      return;
    }

    setVerifyResult(webhookRes.data);
    setStep('complete');
    onVerified?.(webhookRes.data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden text-xs">
        <div className="bg-[#202124] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FF671F] flex items-center justify-center text-white">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>Sandbox Test Payment</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200">
                  SANDBOX ONLY
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                End-to-End Cashfree Webhook Verification ({channel.toUpperCase()} · {actorName})
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close Sandbox Test Modal"
            className="p-1 rounded-md text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'setup' && (
            <>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                Generates an isolated <span className="font-mono font-bold">TEST_CF_*</span> sandbox order,
                signs a Cashfree <span className="font-mono">2023-08-01</span> webhook payload via HMAC-SHA256,
                and verifies <span className="font-mono">/api/v1/payments/webhook</span> plus idempotent replay protection without affecting live revenue or payout ledgers.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sandbox Amount (INR)
                  </label>
                  <select
                    value={amountInr}
                    onChange={(e) => setAmountInr(Number(e.target.value))}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                  >
                    <option value={10}>₹10 (Tool Pass Test)</option>
                    <option value={199}>₹199 (PAN Card Sandbox)</option>
                    <option value={999}>₹999 (GST Filing Sandbox)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Webhook Event Type
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as any)}
                    className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="PAYMENT_SUCCESS_WEBHOOK">PAYMENT_SUCCESS_WEBHOOK</option>
                    <option value="PAYMENT_FAILED_WEBHOOK">PAYMENT_FAILED_WEBHOOK</option>
                    <option value="PAYMENT_USER_DROPPED_WEBHOOK">PAYMENT_USER_DROPPED_WEBHOOK</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Simulated Payment Instrument
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'upi', label: 'Sandbox UPI', icon: Smartphone },
                    { id: 'card', label: 'Test Card', icon: CreditCard },
                    { id: 'netbanking', label: 'NetBanking', icon: Building },
                  ].map((m) => {
                    const Icon = m.icon;
                    const active = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
                        className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                          active
                            ? 'border-[#FF671F] bg-orange-50 dark:bg-orange-950/30 text-[#FF671F]'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRunEndToEndTest}
                  className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Webhook className="w-4 h-4" />
                  <span>Run Sandbox &amp; Webhook Test</span>
                </button>
              </div>
            </>
          )}

          {step === 'running' && (
            <div className="py-8 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#FF671F] animate-spin mx-auto" />
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                Executing End-to-End Sandbox Transaction...
              </div>
              <p className="text-slate-500 dark:text-slate-400">{phaseLabel}</p>
              {orderData && (
                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                  Order: {orderData.orderId}
                </div>
              )}
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-start gap-2.5 text-red-800 dark:text-red-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Webhook Test Did Not Complete</div>
                  <p className="mt-1">{errorMsg}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetModal}
                  className="px-4 py-2 rounded-xl bg-[#FF671F] text-white font-bold cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {step === 'complete' && verifyResult && (
            <div className="space-y-4 tabular-nums">
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-[#138808] shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold text-emerald-900 dark:text-emerald-200 text-sm">
                    Webhook Pipeline Verified End-to-End (HTTP {verifyResult.firstDelivery.httpStatus})
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                    Order <span className="font-mono font-bold">{verifyResult.orderId}</span> resolved to{' '}
                    <strong className="font-mono">{verifyResult.persistedOrderStatus || verifyResult.firstDelivery.resolvedOrderStatus}</strong>{' '}
                    and remained isolated from live settlement ledgers.
                  </p>
                </div>
              </div>

              <div className="space-y-2 bg-[#F7F8FA] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-[11px]">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">1. Sandbox Order</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{verifyResult.orderId}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">2. Payment Ref / Method</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {verifyResult.cfPaymentId} · {verifyResult.paymentMethod}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">3. HMAC-SHA256 Signature</span>
                  <span className="font-mono text-[#138808] font-bold">
                    Verified ({verifyResult.signaturePrefix}…)
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">4. Webhook Delivery</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    POST {verifyResult.webhookEndpoint} → {verifyResult.firstDelivery.httpStatus} OK ({verifyResult.firstDelivery.durationMs}ms)
                  </span>
                </div>
                {verifyResult.idempotencyReplay && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">5. Replay Idempotency Check</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {verifyResult.idempotencyReplay.httpStatus} OK ·{' '}
                      {verifyResult.idempotencyReplay.deduplicated ? 'Deduplicated cleanly' : 'Acknowledged'} (
                      {verifyResult.idempotencyReplay.durationMs}ms)
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#138808]" />
                  <span>
                    Secret Source: {verifyResult.usingConfiguredSecret ? 'Configured Server Secret' : 'Local Dev Sandbox Key'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetModal}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    Run Another
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl bg-[#138808] hover:bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

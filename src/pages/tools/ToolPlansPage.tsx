import React, { useState } from 'react';
import {
  ArrowLeft,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  Ticket,
  Crown,
} from 'lucide-react';
import { ToolPlansSection } from '../../components/tools/ToolPlansSection';
import { TOOLS_REGISTRY } from '../../data/toolsRegistry';
import { useToolTray } from '../../context/ToolTrayContext';
import type { ToolPricingMode } from '../../lib/toolCheckoutSelection';
import type { ToolDefinition } from '../../types/tool';

interface ToolPlansPageProps {
  onNavigate: (route: string, param?: string) => void;
}

export const ToolPlansPage: React.FC<ToolPlansPageProps> = ({ onNavigate }) => {
  const { planDefinition, lastSubscription, activeSingleUsePassList } = useToolTray();
  const [pricingMode, setPricingMode] = useState<ToolPricingMode>('monthly');
  const [recentPassNotice, setRecentPassNotice] = useState<{
    tool: ToolDefinition;
    orderId: string;
  } | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate('tools')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#FF671F] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {TOOLS_REGISTRY.length} Digital Tools</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]">
            <button
              type="button"
              onClick={() => setPricingMode('one_time')}
              className={`px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                pricingMode === 'one_time'
                  ? 'bg-[#FF671F] text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Ticket className="w-3 h-3" />
              <span>One-time Use (10 INR)</span>
            </button>
            <button
              type="button"
              onClick={() => setPricingMode('monthly')}
              className={`px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                pricingMode === 'monthly'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Crown className="w-3 h-3" />
              <span>Monthly Subscription</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('tools')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Open Tools Hub</span>
          </button>
        </div>
      </div>

      {lastSubscription && (
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/75 dark:bg-emerald-950/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-[#138808]" />
            <span>
              Last Plan Activation: <strong>{planDefinition.name}</strong> ({lastSubscription.billingCycle})
              {lastSubscription.orderId ? ` · Order #${lastSubscription.orderId}` : ''}
            </span>
          </div>
          <span className="text-slate-600 dark:text-slate-300 font-mono">
            {new Date(lastSubscription.activatedAt).toLocaleString('en-IN')}
          </span>
        </div>
      )}

      {(recentPassNotice || activeSingleUsePassList.length > 0) && (
        <div className="p-4 rounded-xl border border-orange-200 dark:border-orange-900/60 bg-orange-50/70 dark:bg-orange-950/25 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-orange-950 dark:text-orange-200">
            <Ticket className="w-4 h-4 text-[#FF671F]" />
            <span>
              {recentPassNotice
                ? `1-Time ₹10 Pass Purchased for ${recentPassNotice.tool.name} (Order #${recentPassNotice.orderId})`
                : `Active ₹10 1-Time Use Passes: ${activeSingleUsePassList
                    .map((p) => `${p.toolSlug} (${p.remainingUses} left)`)
                    .join(', ')}`}
            </span>
          </div>
          {recentPassNotice && (
            <button
              type="button"
              onClick={() => onNavigate('tool-detail', recentPassNotice.tool.slug)}
              className="px-3 py-1 rounded-lg bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold cursor-pointer whitespace-nowrap"
            >
              Launch {recentPassNotice.tool.name}
            </button>
          )}
        </div>
      )}

      <ToolPlansSection
        onNavigate={onNavigate}
        pricingMode={pricingMode}
        onPricingModeChange={setPricingMode}
        onPassPurchased={(tool, orderId) => setRecentPassNotice({ tool, orderId })}
      />

      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="space-y-1">
          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#138808]" />
            <span>Browser-First Privacy</span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Core PDF, photo, signature, QR, and calculator tools run locally inside browser memory — sensitive IDs stay on your device.
          </p>
        </div>
        <div className="space-y-1">
          <div className="font-bold text-slate-900 dark:text-white">
            Instant Cashfree Activation
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Both One-time Use (₹10) passes and Monthly/Annual subscriptions unlock immediately after Cashfree UPI, Card, or NetBanking payment.
          </p>
        </div>
        <div className="space-y-1">
          <div className="font-bold text-slate-900 dark:text-white">
            Built for CSC &amp; Citizen Desks
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Includes 4x6 &amp; A4 passport photo sheets, 20–50 KB exam photo presets, GST invoicing, and Hindi/Gujarati OCR.
          </p>
        </div>
      </div>
    </div>
  );
};

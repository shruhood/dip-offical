import React, { useMemo, useState } from 'react';
import {
  Crown,
  Ticket,
  Zap,
  ArrowRight,
  CheckCircle2,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  TOOL_PAY_PER_USE_OPTION,
  TOOL_SINGLE_USE_PRICE_INR,
  TOOL_SUBSCRIPTION_PLANS,
  getToolSingleUsePriceInr,
  type ToolPlanCode,
  type ToolPlanDefinition,
} from '../../data/toolPlans';
import {
  buildToolCheckoutSelection,
  getPaidToolsForSingleUse,
  type ToolCheckoutSelection,
  type ToolPricingMode,
  type ToolSubscriptionCadence,
} from '../../lib/toolCheckoutSelection';
import { useToolTray } from '../../context/ToolTrayContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { CashfreeModal } from '../payment/CashfreeModal';
import { ToolPricingCard, ToolTierBadge } from './ToolPricingCard';
import { LucideIcon } from './LucideIcon';
import type { PricingTier, ToolDefinition } from '../../types/tool';

interface ToolPlansSectionProps {
  onNavigate: (route: string, param?: string) => void;
  compact?: boolean;
  pricingMode?: ToolPricingMode;
  onPricingModeChange?: (mode: ToolPricingMode) => void;
  onPlanActivated?: (planCode: ToolPlanCode) => void;
  onPassPurchased?: (tool: ToolDefinition, orderId: string) => void;
}

export const ToolPlansSection: React.FC<ToolPlansSectionProps> = ({
  onNavigate,
  compact = false,
  pricingMode: controlledMode,
  onPricingModeChange,
  onPlanActivated,
  onPassPurchased,
}) => {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const {
    plan: currentPlan,
    planDefinition,
    billingCycle,
    creditsRemaining,
    dailyJobsUsed,
    activeSingleUsePassList,
    getRemainingSingleUsePasses,
    activatePlan,
    grantSingleUsePass,
  } = useToolTray();

  const paidTools = useMemo(() => getPaidToolsForSingleUse(), []);

  const [internalMode, setInternalMode] = useState<ToolPricingMode>('monthly');
  const pricingMode = controlledMode ?? internalMode;
  const setPricingMode = (next: ToolPricingMode) => {
    setStatusBanner(null);
    if (onPricingModeChange) onPricingModeChange(next);
    else setInternalMode(next);
  };

  const [cadence, setCadence] = useState<ToolSubscriptionCadence>(
    billingCycle === 'annual' ? 'annual' : 'monthly'
  );
  const [selectedPassToolSlug, setSelectedPassToolSlug] = useState<string>(
    paidTools[0]?.slug || 'gst-invoice-generator'
  );
  const [passFilterTier, setPassFilterTier] = useState<'all' | Exclude<PricingTier, 'free'>>('all');
  const [passSearch, setPassSearch] = useState('');
  const [activeCheckout, setActiveCheckout] = useState<ToolCheckoutSelection | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    message: string;
    openToolSlug?: string;
  } | null>(null);

  const selectedPassTool =
    paidTools.find((t) => t.slug === selectedPassToolSlug) || paidTools[0];

  const filteredPaidTools = useMemo(() => {
    const q = passSearch.trim().toLowerCase();
    return paidTools.filter((t) => {
      if (passFilterTier !== 'all' && t.tier !== passFilterTier) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.categoryLabel.toLowerCase().includes(q) ||
        t.shortDescription.toLowerCase().includes(q)
      );
    });
  }, [paidTools, passFilterTier, passSearch]);

  const startOneTimeCheckout = (tool: ToolDefinition) => {
    setStatusBanner(null);
    setSelectedPassToolSlug(tool.slug);
    setActiveCheckout(
      buildToolCheckoutSelection({
        mode: 'one_time',
        toolSlug: tool.slug,
      })
    );
  };

  const handleSelectPlan = (selected: ToolPlanDefinition) => {
    setStatusBanner(null);

    if (selected.code === 'enterprise') {
      onNavigate('contact');
      return;
    }

    if (selected.code === 'free') {
      activatePlan('free', cadence, {
        amountInr: 0,
        paymentMethod: 'Free Plan',
      });
      setStatusBanner({
        message:
          lang === 'hi'
            ? 'फ्री स्टार्टर प्लान सक्रिय हो गया है (25 जॉब/दिन + 10 AI क्रेडिट)।'
            : 'Free Starter plan is active (25 browser jobs/day + 10 monthly AI credits).',
      });
      onPlanActivated?.('free');
      return;
    }

    setActiveCheckout(
      buildToolCheckoutSelection({
        mode: 'monthly',
        cadence,
        planCode: selected.code,
      })
    );
  };

  const capturedSummary = useMemo(() => {
    if (pricingMode === 'one_time') {
      return buildToolCheckoutSelection({
        mode: 'one_time',
        toolSlug: selectedPassTool?.slug,
      });
    }
    const defaultPlan =
      currentPlan !== 'free' && currentPlan !== 'enterprise' ? currentPlan : 'csc';
    return buildToolCheckoutSelection({
      mode: 'monthly',
      cadence,
      planCode: defaultPlan,
    });
  }, [pricingMode, selectedPassTool?.slug, cadence, currentPlan]);

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {/* Active Status + Primary Purchase Mode Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#FF671F]">
            <Crown className="w-3.5 h-3.5 shrink-0" />
            <span>
              {lang === 'hi'
                ? 'डिजिटल टूल्स प्राइसिंग · फ्री, ₹10 1-टाइम व सब्सक्रिप्शन'
                : 'Digital Tools Pricing · Free, ₹10 Pay-Per-Use & Subscriptions'}
            </span>
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {lang === 'hi'
              ? 'अपने उपयोग के अनुसार ₹10 पास या मासिक प्लान चुनें'
              : 'Choose Free Tools, One-time Use (10 INR), or Monthly Subscription'}
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            <span>
              Current Plan: <strong className="text-[#FF671F]">{planDefinition.name}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              AI Credits: <strong>{creditsRemaining}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Jobs Today:{' '}
              <strong>
                {dailyJobsUsed}
                {planDefinition.dailyJobLimit ? ` / ${planDefinition.dailyJobLimit}` : ' (Unlimited)'}
              </strong>
            </span>
            {activeSingleUsePassList.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#138808] dark:text-emerald-400 font-bold">
                  {activeSingleUsePassList.length} ₹10 Pass Active
                </span>
              </>
            )}
          </div>
        </div>

        {/* Mode Toggle: One-time Use (10 INR) vs Monthly Subscription */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <div
            role="tablist"
            aria-label="Purchase Mode Toggle"
            className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <button
              type="button"
              role="tab"
              aria-selected={pricingMode === 'one_time'}
              onClick={() => setPricingMode('one_time')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                pricingMode === 'one_time'
                  ? 'bg-[#FF671F] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <Ticket className="w-3.5 h-3.5 shrink-0" />
              <span>One-time Use (10 INR)</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={pricingMode === 'monthly'}
              onClick={() => setPricingMode('monthly')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 tabular-nums ${
                pricingMode === 'monthly'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <Crown className="w-3.5 h-3.5 shrink-0" />
              <span>Monthly Subscription</span>
            </button>
          </div>

          {pricingMode === 'monthly' && (
            <div className="inline-flex items-center p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setCadence('monthly')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  cadence === 'monthly'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setCadence('annual')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  cadence === 'annual'
                    ? 'bg-[#FF671F] text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Annual · 2 Mo Free
              </button>
            </div>
          )}
        </div>
      </div>

      {/* High-Visibility 3-Tier Contrast Overview Cards (Free vs One-Time ₹10 vs Subscription) */}
      {!compact && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ToolPricingCard
            kind="free"
            badgeText="Free Tier · Always ₹0"
            audience="Citizens & Students"
            title="Free Browser Utilities"
            priceDisplay="₹0"
            cadenceLabel="forever · no card required"
            metrics={[
              { label: 'Included Tools', value: '135 Utilities' },
              { label: 'Daily Limit', value: '25 jobs / day' },
              { label: 'Max File Size', value: '25 MB' },
              { label: 'AI Runs', value: '10 / month' },
            ]}
            features={[
              'Instant PDF merge, split, compress & rotate',
              '20–50 KB exam photo resize & UPI QR maker',
              'GST, EMI & FY 2026-27 Income Tax calculators',
            ]}
            ctaLabel={currentPlan === 'free' ? 'Active Starter Plan' : 'Switch to Free Tier'}
            isActive={currentPlan === 'free'}
            disabled={currentPlan === 'free'}
            onSelect={() => handleSelectPlan(TOOL_SUBSCRIPTION_PLANS[0])}
          />

          <ToolPricingCard
            kind="one_time"
            badgeText="One-Time Payment · ₹10"
            audience="Occasional & Single-Task Users"
            title="One-time Use (10 INR) Pass"
            priceDisplay={`₹${TOOL_SINGLE_USE_PRICE_INR}`}
            cadenceLabel="per 1 complete run"
            isHighlighted={pricingMode === 'one_time'}
            metrics={[
              { label: 'Eligible Tools', value: `${paidTools.length} Paid Pro / CSC / AI` },
              { label: 'Commitment', value: 'Zero recurring fee' },
              { label: 'Max File Size', value: '150 MB' },
              { label: 'Owned Passes', value: `${activeSingleUsePassList.length} active` },
            ]}
            features={[
              'Pay ₹10 once via UPI, Card, or NetBanking',
              'Unlocks PDF OCR, GST Invoice Maker & AI Tools',
              'Ideal when you only need a single export today',
            ]}
            ctaLabel={
              pricingMode === 'one_time'
                ? `Checkout ₹10 · ${selectedPassTool?.name || 'Select Tool'}`
                : 'Select One-time Use (10 INR)'
            }
            onSelect={() => {
              if (pricingMode !== 'one_time') {
                setPricingMode('one_time');
              } else if (selectedPassTool) {
                startOneTimeCheckout(selectedPassTool);
              }
            }}
          />

          <ToolPricingCard
            kind="subscription"
            badgeText="Subscription Plans · Best Value"
            audience="CSC Operators, CAs & Power Users"
            title="Monthly & Annual Subscriptions"
            priceDisplay={cadence === 'annual' ? '₹990' : '₹99'}
            cadenceLabel={cadence === 'annual' ? '/ yr starting' : '/ mo starting'}
            isHighlighted={pricingMode === 'monthly'}
            metrics={[
              { label: 'Personal Pro', value: cadence === 'annual' ? '₹990 / yr' : '₹99 / mo' },
              { label: 'CSC Operator', value: cadence === 'annual' ? '₹2,990 / yr' : '₹299 / mo' },
              { label: 'Professional', value: cadence === 'annual' ? '₹6,990 / yr' : '₹699 / mo' },
              { label: 'AI Credits', value: '100 to 1,200 / mo' },
            ]}
            features={[
              'Unlimited daily runs on CSC & Professional tiers',
              'All 150 tools including batch processing & GST billing',
              'Priority Cashfree instant activation & centre branding',
            ]}
            ctaLabel={
              pricingMode === 'monthly'
                ? 'Choose Subscription Tier Below'
                : 'Switch to Monthly Subscription'
            }
            onSelect={() => {
              if (pricingMode !== 'monthly') {
                setPricingMode('monthly');
              } else {
                const targetCode =
                  currentPlan !== 'free' && currentPlan !== 'enterprise' ? currentPlan : 'csc';
                const targetPlan =
                  TOOL_SUBSCRIPTION_PLANS.find((p) => p.code === targetCode) ||
                  TOOL_SUBSCRIPTION_PLANS[2];
                handleSelectPlan(targetPlan);
              }
            }}
          />
        </div>
      )}

      {statusBanner && (
        <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/40 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 flex flex-wrap items-center justify-between gap-3 font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0" />
            <span>{statusBanner.message}</span>
          </div>
          {statusBanner.openToolSlug && (
            <button
              type="button"
              onClick={() => onNavigate('tool-detail', statusBanner.openToolSlug)}
              className="px-3.5 py-1.5 rounded-lg bg-[#138808] hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <span>Open Unlocked Tool</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* MODE A: One-time Use (10 INR) Selector & Instant Checkout */}
      {pricingMode === 'one_time' && (
        <div className="space-y-4">
          {/* Captured Selection Checkout Bar */}
          <div className="p-4 sm:p-5 rounded-2xl border-2 border-[#FF671F] bg-gradient-to-r from-orange-50/90 via-amber-50/50 to-white dark:from-orange-950/35 dark:via-slate-900 dark:to-slate-950 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950/70 text-[#E55B1B] dark:text-orange-300 text-[10px] font-bold uppercase">
                  <Ticket className="w-3 h-3" />
                  <span>Selected Mode: One-time Use (10 INR)</span>
                </span>
                <span className="text-xs font-mono font-black text-slate-900 dark:text-white tabular-nums">
                  Checkout Total: ₹{capturedSummary.amountInr}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {selectedPassTool ? selectedPassTool.name : 'Select Any Paid Tool'} — Single-Use Unlock
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {TOOL_PAY_PER_USE_OPTION.summary}
              </p>
            </div>

            <button
              type="button"
              onClick={() => selectedPassTool && startOneTimeCheckout(selectedPassTool)}
              disabled={!selectedPassTool}
              className="px-5 py-2.5 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs whitespace-nowrap tabular-nums disabled:opacity-50"
            >
              <Ticket className="w-4 h-4" />
              <span>Unlock {selectedPassTool?.name || 'Tool'} for ₹{TOOL_SINGLE_USE_PRICE_INR}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search & Tier Filter for Paid Tools */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: `All Paid Tools (${paidTools.length})` },
                  { id: 'personal', label: 'Personal Tier' },
                  { id: 'csc', label: 'CSC Tier' },
                  { id: 'professional', label: 'Professional Tier' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPassFilterTier(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    passFilterTier === tab.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#FF671F]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative flex items-center sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={passSearch}
                onChange={(e) => setPassSearch(e.target.value)}
                placeholder="Search ₹10 paid tools..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:border-[#FF671F]"
              />
            </div>
          </div>

          {/* 15 Paid Tools Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPaidTools.map((tool) => {
              const isSelected = selectedPassTool?.slug === tool.slug;
              const remaining = getRemainingSingleUsePasses(tool.slug);
              const priceInr = getToolSingleUsePriceInr(tool) || TOOL_SINGLE_USE_PRICE_INR;

              return (
                <div
                  key={tool.slug}
                  onClick={() => setSelectedPassToolSlug(tool.slug)}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'border-[#FF671F] ring-2 ring-[#FF671F]/25 bg-orange-50/50 dark:bg-orange-950/25 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-orange-300'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 flex items-center justify-center text-[#FF671F] shrink-0">
                        <LucideIcon name={tool.iconName} className="w-4 h-4" />
                      </div>
                      <ToolTierBadge
                        tier={tool.tier}
                        remainingPasses={remaining}
                        singleUsePriceInr={priceInr}
                        compact
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {tool.name}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {tool.shortDescription}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-black text-slate-900 dark:text-white tabular-nums">
                      ₹{priceInr}{' '}
                      <span className="text-[10px] font-sans font-medium text-slate-500">
                        / 1 run
                      </span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      {remaining > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('tool-detail', tool.slug);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#138808] hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Use Pass ({remaining})</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startOneTimeCheckout(tool);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#FF671F] hover:bg-[#E55B1B] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap tabular-nums"
                        >
                          <Ticket className="w-3 h-3" />
                          <span>Buy ₹{priceInr} Pass</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE B: Monthly / Annual Subscription Plans Grid */}
      {pricingMode === 'monthly' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {TOOL_SUBSCRIPTION_PLANS.map((plan) => {
            const price = cadence === 'annual' ? plan.priceAnnualInr : plan.priceMonthlyInr;
            const isCurrent = currentPlan === plan.code;
            const kind = plan.code === 'free' ? 'free' : 'subscription';

            return (
              <ToolPricingCard
                key={plan.code}
                kind={kind}
                badgeText={
                  plan.code === 'csc'
                    ? 'Popular · Subscription'
                    : plan.code === 'free'
                    ? 'Free · ₹0 Forever'
                    : plan.code === 'enterprise'
                    ? 'Enterprise SLA'
                    : `${cadence === 'annual' ? 'Annual' : 'Monthly'} Pro`
                }
                audience={lang === 'hi' ? plan.audienceHi : plan.audience}
                title={lang === 'hi' ? plan.nameHi : plan.name}
                priceDisplay={price === null ? 'Custom' : `₹${price.toLocaleString('en-IN')}`}
                cadenceLabel={
                  price !== null ? (cadence === 'annual' ? ' / yr' : ' / mo') : undefined
                }
                isActive={isCurrent}
                isHighlighted={plan.code === 'csc'}
                disabled={isCurrent}
                metrics={[
                  { label: 'Jobs', value: plan.limits.dailyJobs },
                  { label: 'Max File', value: plan.limits.maxFileSize },
                  { label: 'AI Credits', value: plan.limits.aiCredits },
                  { label: 'CSC Desk', value: plan.limits.cscDashboard },
                ]}
                features={plan.highlights}
                ctaVariant={
                  plan.code === 'free'
                    ? 'free'
                    : plan.code === 'enterprise'
                    ? 'dark'
                    : plan.code === 'csc'
                    ? 'one_time'
                    : 'subscription'
                }
                ctaLabel={
                  isCurrent
                    ? 'Active Plan'
                    : plan.code === 'free'
                    ? 'Use Free Plan'
                    : plan.code === 'enterprise'
                    ? 'Contact Sales'
                    : `Subscribe ₹${price}/${cadence === 'annual' ? 'yr' : 'mo'}`
                }
                onSelect={() => handleSelectPlan(plan)}
              />
            );
          })}
        </div>
      )}

      {/* Plan Comparison Matrix Table */}
      {!compact && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shadow-2xs">
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
                <th className="py-3 px-4 font-bold text-slate-800 dark:text-white">Capability</th>
                <th className="py-3 px-4 font-bold text-[#138808] dark:text-emerald-400">
                  Free (₹0)
                </th>
                <th className="py-3 px-4 font-bold text-[#FF671F]">
                  One-time Use (₹10)
                </th>
                <th className="py-3 px-4 font-bold text-sky-700 dark:text-sky-300">
                  Personal (₹99/mo)
                </th>
                <th className="py-3 px-4 font-bold text-[#FF671F]">
                  CSC Operator (₹299/mo)
                </th>
                <th className="py-3 px-4 font-bold text-[#138808] dark:text-emerald-400">
                  Professional (₹699/mo)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                  Core Browser Tools (135)
                </td>
                <td className="py-2.5 px-4">Included (25/day)</td>
                <td className="py-2.5 px-4">Free always</td>
                <td className="py-2.5 px-4">200/day</td>
                <td className="py-2.5 px-4">Unlimited</td>
                <td className="py-2.5 px-4">Unlimited</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                  Paid Pro / CSC / AI Tools (15)
                </td>
                <td className="py-2.5 px-4">Unlock at ₹10/use</td>
                <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                  1 Complete Run
                </td>
                <td className="py-2.5 px-4">Personal Tier</td>
                <td className="py-2.5 px-4">Personal + CSC</td>
                <td className="py-2.5 px-4 font-bold">All 150 Tools</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                  AI Document &amp; OCR Credits
                </td>
                <td className="py-2.5 px-4">10 / month</td>
                <td className="py-2.5 px-4">Included per pass</td>
                <td className="py-2.5 px-4">100 / month</td>
                <td className="py-2.5 px-4">300 / month</td>
                <td className="py-2.5 px-4">1,200 / month</td>
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                  Max Browser File Ceiling
                </td>
                <td className="py-2.5 px-4">25 MB</td>
                <td className="py-2.5 px-4">150 MB</td>
                <td className="py-2.5 px-4">100 MB</td>
                <td className="py-2.5 px-4">150 MB</td>
                <td className="py-2.5 px-4">250 MB</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Unified Cashfree Checkout Modal reflecting One-time Use (10 INR) OR Subscription Selection */}
      {activeCheckout && (
        <CashfreeModal
          isOpen={Boolean(activeCheckout)}
          onClose={() => setActiveCheckout(null)}
          serviceSlug={activeCheckout.serviceSlug}
          serviceName={activeCheckout.serviceName}
          serviceCharge={activeCheckout.amountInr}
          govtFees={0}
          applicantId={user?.id || 'guest_tools_user'}
          applicantName={user?.name || 'Citizen User'}
          applicantEmail={user?.email || 'citizen@digitalindiaproject.com'}
          applicantMobile={user?.mobile || '9876543210'}
          onPaymentSuccess={(details) => {
            if (activeCheckout.mode === 'one_time' && activeCheckout.toolSlug) {
              grantSingleUsePass(activeCheckout.toolSlug, 1, {
                orderId: details.orderId,
                amountInr: details.amount,
                paymentMethod: details.paymentMethod,
              });
              const unlockedTool = paidTools.find((t) => t.slug === activeCheckout.toolSlug);
              setStatusBanner({
                message: `₹${activeCheckout.amountInr} One-time Use Pass unlocked for ${
                  activeCheckout.toolName || activeCheckout.toolSlug
                }! Receipt #${details.orderId}`,
                openToolSlug: activeCheckout.toolSlug,
              });
              if (unlockedTool) {
                onPassPurchased?.(unlockedTool, details.orderId);
              }
              setActiveCheckout(null);
              return;
            }

            if (activeCheckout.planCode) {
              activatePlan(activeCheckout.planCode, activeCheckout.cadence, {
                orderId: details.orderId,
                amountInr: details.amount,
                paymentMethod: details.paymentMethod,
              });
              const activatedCode = activeCheckout.planCode;
              const planObj = TOOL_SUBSCRIPTION_PLANS.find((p) => p.code === activatedCode);
              setStatusBanner({
                message: `${
                  activeCheckout.planName || activatedCode
                } (${activeCheckout.cadence === 'annual' ? 'Annual' : 'Monthly'}) activated! Receipt #${
                  details.orderId
                } · ${planObj?.monthlyAiCredits || 100} AI credits unlocked.`,
              });
              setActiveCheckout(null);
              onPlanActivated?.(activatedCode);
            }
          }}
        />
      )}
    </div>
  );
};

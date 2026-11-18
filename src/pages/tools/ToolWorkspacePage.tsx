import React, { useCallback, useEffect, useState } from 'react';
import {
  Heart,
  ShieldCheck,
  AlertTriangle,
  Star,
  FileDown,
  Loader2,
  ArrowLeft,
  Lock,
  Crown,
  Ticket,
} from 'lucide-react';
import { getToolBySlug, TOOLS_REGISTRY } from '../../data/toolsRegistry';
import { useToolTray } from '../../context/ToolTrayContext';
import { useAuth } from '../../context/AuthContext';
import { isConverterTool, type ToolExportShortcut } from '../../lib/converterExport';
import { buildUrlForRoute } from '../../lib/siteUrls';
import { getPlanDefinition, getToolSingleUsePriceInr, hasPlanAccessForTier } from '../../data/toolPlans';
import { ToolCard } from '../../components/tools/ToolCard';
import { ToolPricingCard, ToolTierBadge } from '../../components/tools/ToolPricingCard';
import { LucideIcon } from '../../components/tools/LucideIcon';
import type { ToolPricingMode } from '../../lib/toolCheckoutSelection';
import { ToolReviewsSection } from '../../components/tools/ToolReviewsSection';
import { CashfreeModal } from '../../components/payment/CashfreeModal';
import type { ToolDefinition, ToolReviewStats } from '../../types/tool';

const PdfWorkspace = React.lazy(() =>
  import('../../components/tools/workspaces/PdfWorkspace').then((m) => ({ default: m.PdfWorkspace }))
);
const ImageWorkspace = React.lazy(() =>
  import('../../components/tools/workspaces/ImageWorkspace').then((m) => ({
    default: m.ImageWorkspace,
  }))
);
const CalculatorWorkspace = React.lazy(() =>
  import('../../components/tools/workspaces/CalculatorWorkspace').then((m) => ({
    default: m.CalculatorWorkspace,
  }))
);
const QrBarcodeWorkspace = React.lazy(() =>
  import('../../components/tools/workspaces/QrBarcodeWorkspace').then((m) => ({
    default: m.QrBarcodeWorkspace,
  }))
);
const BusinessDocWorkspace = React.lazy(() =>
  import('../../components/tools/workspaces/BusinessDocWorkspace').then((m) => ({
    default: m.BusinessDocWorkspace,
  }))
);
const TextOcrArchiveWorkspace = React.lazy(() =>
  import('../../components/tools/workspaces/TextOcrArchiveWorkspace').then((m) => ({
    default: m.TextOcrArchiveWorkspace,
  }))
);
const AiAssistantWorkspace = React.lazy(() =>
  import('../../components/tools/workspaces/AiAssistantWorkspace').then((m) => ({
    default: m.AiAssistantWorkspace,
  }))
);

function renderWorkspace(
  tool: ToolDefinition,
  registerExportShortcut?: (handler: ToolExportShortcut | null) => void
) {
  switch (tool.engineId) {
    case 'pdf-merge':
    case 'pdf-split':
    case 'pdf-compress':
    case 'pdf-rotate':
    case 'pdf-delete-pages':
    case 'pdf-extract-pages':
    case 'pdf-reorder-pages':
    case 'pdf-page-numbers':
    case 'pdf-watermark':
    case 'pdf-protect':
    case 'pdf-unlock':
    case 'pdf-to-image':
    case 'image-to-pdf':
    case 'pdf-to-word':
    case 'word-to-pdf':
    case 'pdf-to-excel':
    case 'excel-to-pdf':
    case 'pdf-ocr':
      return <PdfWorkspace tool={tool} onRegisterExportShortcut={registerExportShortcut} />;
    case 'image-compress':
    case 'image-kb-compress':
    case 'image-resize':
    case 'image-crop':
    case 'image-convert':
    case 'image-bg-remove':
    case 'image-enhance':
    case 'image-dpi':
    case 'image-strip-exif':
    case 'passport-photo':
    case 'signature-studio':
    case 'document-scanner':
    case 'dimension-checker':
    case 'print-layout':
      return <ImageWorkspace tool={tool} onRegisterExportShortcut={registerExportShortcut} />;
    case 'calculator':
    case 'print-calculator':
      return <CalculatorWorkspace tool={tool} onRegisterExportShortcut={registerExportShortcut} />;
    case 'qr-generator':
    case 'qr-scanner':
    case 'barcode-generator':
      return <QrBarcodeWorkspace tool={tool} onRegisterExportShortcut={registerExportShortcut} />;
    case 'business-doc':
    case 'document-checklist':
    case 'letter-generator':
      return <BusinessDocWorkspace tool={tool} />;
    case 'ocr-text':
    case 'text-utility':
    case 'speech-tool':
    case 'typing-tool':
    case 'zip-creator':
    case 'zip-extractor':
    case 'data-converter':
    case 'html-to-pdf':
    case 'document-renamer':
    case 'media-compressor':
      return <TextOcrArchiveWorkspace tool={tool} onRegisterExportShortcut={registerExportShortcut} />;
    case 'ai-assistant':
    default:
      return <AiAssistantWorkspace tool={tool} onRegisterExportShortcut={registerExportShortcut} />;
  }
}

function renderWorkspaceWithSuspense(
  tool: ToolDefinition,
  registerExportShortcut?: (handler: ToolExportShortcut | null) => void
) {
  return (
    <React.Suspense
      fallback={
        <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-[#FF671F]" />
          <span>Loading browser engine...</span>
        </div>
      }
    >
      {renderWorkspace(tool, registerExportShortcut)}
    </React.Suspense>
  );
}

interface ToolWorkspacePageProps {
  slug: string;
  onNavigate: (route: string, param?: string) => void;
}

export const ToolWorkspacePage: React.FC<ToolWorkspacePageProps> = ({ slug, onNavigate }) => {
  const tool = getToolBySlug(slug);
  const { user } = useAuth();
  const {
    planDefinition,
    isFavourite,
    toggleFavourite,
    trackRecentTool,
    canAccessTool,
    activatePlan,
    grantSingleUsePass,
  } = useToolTray();

  const [reviewStats, setReviewStats] = useState<ToolReviewStats>({
    totalCount: 0,
    averageRating: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });
  const [exportHandler, setExportHandler] = useState<ToolExportShortcut | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [selectedUnlockMode, setSelectedUnlockMode] = useState<ToolPricingMode>('one_time');
  const [checkoutMode, setCheckoutMode] = useState<'single_use' | 'subscription' | null>(null);
  // Keeps output preview/download accessible for the active single-use session even after pass count decrements to 0 on run completion
  const [sessionPassSlug, setSessionPassSlug] = useState<string | null>(null);
  const [passNotice, setPassNotice] = useState<string | null>(null);

  const registerExportShortcut = useCallback(
    (handler: ToolExportShortcut | null) => {
      setExportHandler(() => handler);
    },
    []
  );

  useEffect(() => {
    setExportHandler(null);
    setCheckoutMode(null);
    setSessionPassSlug(null);
    setPassNotice(null);
    if (tool) {
      trackRecentTool(tool.slug);
    }
  }, [tool?.slug, trackRecentTool]);

  const accessCheck = tool ? canAccessTool(tool) : null;

  useEffect(() => {
    if (tool && accessCheck?.allowed && accessCheck.accessMode === 'single_use_pass') {
      setSessionPassSlug(tool.slug);
    }
  }, [tool, accessCheck?.allowed, accessCheck?.accessMode]);

  if (!tool || !accessCheck) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Tool Not Found</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          The requested tool utility could not be located in Digital Tools Tray.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('tools')}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#FF671F] text-white text-xs font-bold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Browse All {TOOLS_REGISTRY.length} Tools</span>
        </button>
      </div>
    );
  }

  const fav = isFavourite(tool.slug);
  const showExportButton = isConverterTool(tool);
  const requiredPlan = accessCheck.requiredPlan || getPlanDefinition('personal');
  const singleUsePrice = getToolSingleUsePriceInr(tool) || accessCheck.singleUsePriceInr || 10;
  const workspaceOpenViaSessionPass =
    !accessCheck.allowed && sessionPassSlug === tool.slug;
  const canRenderWorkspace = accessCheck.allowed || workspaceOpenViaSessionPass;

  const relatedTools = tool.relatedSlugs
    .map((s) => getToolBySlug(s))
    .filter((t): t is ToolDefinition => Boolean(t))
    .slice(0, 4);

  const handleShortcutExport = async () => {
    if (!exportHandler || !exportHandler.ready || exportBusy) return;
    setExportBusy(true);
    try {
      await exportHandler.onExport();
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Breadcrumb & Back */}
      <nav className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <a
            href={buildUrlForRoute('tools')}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('tools');
            }}
            className="hover:text-[#FF671F] font-semibold inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Tools Hub</span>
          </a>
          <span>/</span>
          <a
            href={buildUrlForRoute('tools', tool.category)}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('tools', tool.category);
            }}
            className="hover:text-[#FF671F] font-medium"
          >
            {tool.categoryLabel}
          </a>
          <span>/</span>
          <span className="text-slate-900 dark:text-white font-bold truncate">
            {tool.name}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('tool-plans')}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#FF671F] hover:underline cursor-pointer"
        >
          <Crown className="w-3.5 h-3.5" />
          <span>Plan: {planDefinition.name}</span>
        </button>
      </nav>

      {/* Tool Header Card */}
      <section className="p-4 sm:p-6 rounded-2xl border border-orange-200/80 dark:border-orange-900/45 bg-gradient-to-r from-orange-50/85 via-white to-sky-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800 flex items-center justify-center text-[#FF671F] shrink-0 shadow-2xs">
              <LucideIcon name={tool.iconName} className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {tool.name}
                </h1>
                <ToolTierBadge
                  tier={tool.tier}
                  remainingPasses={accessCheck.remainingPasses}
                  planUnlocked={hasPlanAccessForTier(planDefinition.code, tool.tier)}
                  singleUsePriceInr={singleUsePrice}
                />
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-3xl">
                {tool.longDescription}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {showExportButton && canRenderWorkspace && (
              <button
                type="button"
                onClick={handleShortcutExport}
                disabled={exportBusy || !exportHandler || !exportHandler.ready}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-[#FF671F] dark:hover:bg-[#E55B1B] text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                {exportBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                <span>{exportBusy ? 'Exporting...' : 'Download Export'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => toggleFavourite(tool)}
              aria-pressed={fav}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                fav
                  ? 'border-rose-300 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-rose-300'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${fav ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>{fav ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
          <span>Inputs: {tool.acceptedFormats.join(', ')}</span>
          <span aria-hidden="true">·</span>
          <span>Outputs: {tool.outputFormats.join(', ')}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 text-[#138808] dark:text-emerald-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            {tool.processingType === 'server-ai'
              ? 'Transient Server AI Processing'
              : 'Runs Privately in Browser Memory'}
          </span>
          <span aria-hidden="true">·</span>
          <a
            href="#reviews"
            className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 hover:underline tabular-nums"
          >
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            {reviewStats.totalCount > 0
              ? `${reviewStats.averageRating.toFixed(1)} (${reviewStats.totalCount})`
              : 'Rate Tool'}
          </a>
        </div>
      </section>

      {passNotice && (
        <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/40 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-2 font-semibold">
          <Ticket className="w-4 h-4 text-[#138808] shrink-0" />
          <span>{passNotice}</span>
        </div>
      )}

      {/* Tier / Quota Gate OR Active Workspace */}
      {!canRenderWorkspace ? (
        <section className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6 shadow-xs">
          <div className="text-center space-y-2.5 max-w-2xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-[#FF671F] flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {accessCheck.reason === 'daily_limit'
                ? 'Daily Free Job Limit Reached'
                : accessCheck.reason === 'ai_credits'
                ? 'Monthly AI Credits Exhausted'
                : `Unlock ${tool.name}`}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              {accessCheck.reason === 'daily_limit'
                ? `Your ${planDefinition.name} plan includes ${planDefinition.limits.dailyJobs}. Pay ₹${singleUsePrice} for an instant 1-time run or upgrade to a Monthly Subscription.`
                : accessCheck.reason === 'ai_credits'
                ? `Your monthly AI credits are used up. Pay ₹${singleUsePrice} for an instant 1-time run or switch to a Monthly Subscription.`
                : `Select One-time Use (10 INR) for a single complete export, or Monthly Subscription for unlimited daily access.`}
            </p>

            {/* Primary Mode Toggle: One-time Use (10 INR) vs Monthly Subscription */}
            <div className="pt-2 flex justify-center">
              <div
                role="tablist"
                aria-label="Unlock Mode Toggle"
                className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedUnlockMode === 'one_time'}
                  onClick={() => setSelectedUnlockMode('one_time')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                    selectedUnlockMode === 'one_time'
                      ? 'bg-[#FF671F] text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Ticket className="w-3.5 h-3.5" />
                  <span>One-time Use (10 INR)</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedUnlockMode === 'monthly'}
                  onClick={() => setSelectedUnlockMode('monthly')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                    selectedUnlockMode === 'monthly'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Monthly Subscription</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            <ToolPricingCard
              kind="one_time"
              badgeText="One-Time Payment · ₹10"
              audience="No Recurring Subscription"
              title={`1-Time Use Pass — ${tool.name}`}
              priceDisplay={`₹${singleUsePrice}`}
              cadenceLabel="/ 1 complete run"
              isHighlighted={selectedUnlockMode === 'one_time'}
              metrics={[
                { label: 'Mode', value: 'Pay-Per-Use' },
                { label: 'Access', value: '1 Complete Job + Export' },
                { label: 'Max File Size', value: '150 MB' },
              ]}
              features={[
                'Immediate browser activation after Cashfree payment',
                'Supports UPI, Cards, and NetBanking',
              ]}
              ctaLabel={`Unlock Once for ₹${singleUsePrice}`}
              onSelect={() => {
                setSelectedUnlockMode('one_time');
                setCheckoutMode('single_use');
              }}
            />

            <ToolPricingCard
              kind="subscription"
              badgeText="Monthly Subscription · All Tiers Below"
              audience={requiredPlan.audience}
              title={requiredPlan.name}
              priceDisplay={
                requiredPlan.priceMonthlyInr !== null
                  ? `₹${requiredPlan.priceMonthlyInr.toLocaleString('en-IN')}`
                  : 'Custom'
              }
              cadenceLabel={requiredPlan.priceMonthlyInr !== null ? '/ mo' : undefined}
              isHighlighted={selectedUnlockMode === 'monthly'}
              metrics={[
                { label: 'Jobs', value: requiredPlan.limits.dailyJobs },
                { label: 'Max File', value: requiredPlan.limits.maxFileSize },
                { label: 'AI Credits', value: requiredPlan.limits.aiCredits },
              ]}
              features={requiredPlan.highlights.slice(0, 2)}
              ctaVariant="subscription"
              ctaLabel={
                requiredPlan.priceMonthlyInr !== null && requiredPlan.priceMonthlyInr > 0
                  ? `Subscribe ₹${requiredPlan.priceMonthlyInr}/mo`
                  : 'Compare All Plans'
              }
              onSelect={() => {
                setSelectedUnlockMode('monthly');
                if (requiredPlan.priceMonthlyInr !== null && requiredPlan.priceMonthlyInr > 0) {
                  setCheckoutMode('subscription');
                } else {
                  onNavigate('tool-plans');
                }
              }}
            />
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => onNavigate('tool-plans')}
              className="text-xs font-bold text-[#FF671F] hover:underline cursor-pointer"
            >
              Compare All 150 Tools, ₹10 One-time Use &amp; Monthly/Annual Plans →
            </button>
          </div>
        </section>
      ) : (
        <div className="space-y-3">
          {(accessCheck.accessMode === 'single_use_pass' || workspaceOpenViaSessionPass) && (
            <div className="px-4 py-2.5 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50/90 dark:bg-orange-950/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                <Ticket className="w-4 h-4 text-[#FF671F] shrink-0" />
                {accessCheck.allowed ? (
                  <span>
                    ₹{singleUsePrice} 1-Time Use Pass Active ({accessCheck.remainingPasses} run
                    {accessCheck.remainingPasses > 1 ? 's' : ''} remaining) — runs are deducted when you generate output.
                  </span>
                ) : (
                  <span>
                    1-Time Pass completed for your current result above. Save or download your file before leaving.
                  </span>
                )}
              </div>
              {!accessCheck.allowed && (
                <button
                  type="button"
                  onClick={() => setCheckoutMode('single_use')}
                  className="px-3 py-1 rounded-lg bg-[#FF671F] text-white font-bold cursor-pointer whitespace-nowrap"
                >
                  Unlock Another Run (₹{singleUsePrice})
                </button>
              )}
            </div>
          )}

          <section className="p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900 shadow-xs">
            {renderWorkspaceWithSuspense(tool, registerExportShortcut)}
          </section>
        </div>
      )}

      {/* Reviews */}
      <ToolReviewsSection tool={tool} onStatsChange={setReviewStats} />

      {/* How to Use, Features & Limitations */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 sm:p-5 rounded-xl border border-sky-200/80 dark:border-sky-900/50 bg-gradient-to-br from-sky-50/75 via-white to-white dark:from-sky-950/25 dark:via-slate-900 dark:to-slate-900 space-y-2.5">
          <h2 className="font-bold text-sm text-slate-900 dark:text-white">
            How to Use {tool.name}
          </h2>
          <ol className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 list-decimal list-inside">
            {tool.howToSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="p-4 sm:p-5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-gradient-to-br from-emerald-50/75 via-white to-white dark:from-emerald-950/25 dark:via-slate-900 dark:to-slate-900 space-y-2.5">
          <h2 className="font-bold text-sm text-slate-900 dark:text-white">Key Capabilities</h2>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            {tool.features.map((feat) => (
              <li key={feat}>· {feat}</li>
            ))}
          </ul>
        </div>

        <div className="p-4 sm:p-5 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/75 via-white to-white dark:from-amber-950/25 dark:via-slate-900 dark:to-slate-900 space-y-2.5">
          <h2 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-[#FF671F]" />
            <span>Scope &amp; Limitations</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {tool.limitations}
          </p>
        </div>
      </section>

      {/* FAQs */}
      {tool.faqs.length > 0 && (
        <section className="p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900 space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {tool.faqs.map((f) => (
              <div key={f.q} className="py-3">
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {f.q}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related Tools */}
      {relatedTools.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Related Digital Tools
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {relatedTools.map((rt) => (
              <ToolCard key={rt.slug} tool={rt} onNavigate={onNavigate} compact />
            ))}
          </div>
        </section>
      )}

      {/* Cashfree Checkout Modal (₹10 One-Time Pass OR Monthly Plan Subscription) */}
      {checkoutMode === 'single_use' && (
        <CashfreeModal
          isOpen
          onClose={() => setCheckoutMode(null)}
          serviceSlug={`tool-pass:${tool.slug}`}
          serviceName={`${tool.name} — 1-Time Tool Use Pass`}
          serviceCharge={singleUsePrice}
          govtFees={0}
          applicantId={user?.id || 'guest_tools_user'}
          applicantName={user?.name || 'Citizen User'}
          applicantEmail={user?.email || 'citizen@digitalindiaproject.com'}
          applicantMobile={user?.mobile || '9876543210'}
          onPaymentSuccess={(details) => {
            grantSingleUsePass(tool.slug, 1, {
              orderId: details.orderId,
              amountInr: details.amount,
              paymentMethod: details.paymentMethod,
            });
            setSessionPassSlug(tool.slug);
            setPassNotice(
              `1-Time Use Pass unlocked for ${tool.name} (Receipt #${details.orderId} · ₹${details.amount}). Complete your job below.`
            );
            setCheckoutMode(null);
          }}
        />
      )}

      {checkoutMode === 'subscription' && requiredPlan.priceMonthlyInr !== null && (
        <CashfreeModal
          isOpen
          onClose={() => setCheckoutMode(null)}
          serviceSlug={`tool-plan:${requiredPlan.code}:monthly`}
          serviceName={`Digital Tools Tray — ${requiredPlan.name} (Monthly)`}
          serviceCharge={requiredPlan.priceMonthlyInr}
          govtFees={0}
          applicantId={user?.id || 'guest_tools_user'}
          applicantName={user?.name || 'Citizen User'}
          applicantEmail={user?.email || 'citizen@digitalindiaproject.com'}
          applicantMobile={user?.mobile || '9876543210'}
          onPaymentSuccess={(details) => {
            activatePlan(requiredPlan.code, 'monthly', {
              orderId: details.orderId,
              amountInr: details.amount,
              paymentMethod: details.paymentMethod,
            });
            setPassNotice(
              `${requiredPlan.name} unlocked! Receipt #${details.orderId} · All ${requiredPlan.code} tools active.`
            );
            setCheckoutMode(null);
          }}
        />
      )}
    </div>
  );
};

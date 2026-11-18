import React from 'react';
import {
  Check,
  CheckCircle2,
  Crown,
  Lock,
  ShieldCheck,
  Sparkles,
  Ticket,
  Zap,
} from 'lucide-react';
import type { PricingTier } from '../../types/tool';

export type PricingTierKind = 'free' | 'one_time' | 'subscription' | 'pass_active';

export interface ToolTierBadgeProps {
  tier: PricingTier;
  remainingPasses?: number;
  planUnlocked?: boolean;
  singleUsePriceInr?: number;
  compact?: boolean;
}

const TIER_SHORT_LABELS: Record<PricingTier, string> = {
  free: 'Free',
  personal: 'Personal',
  csc: 'CSC',
  professional: 'Pro',
};

/**
 * High-visibility status badge clearly distinguishing Free, ₹10 One-Time Use,
 * Active Single-Use Pass, and Subscription tiers using icon + label + contrast cues.
 */
export const ToolTierBadge: React.FC<ToolTierBadgeProps> = ({
  tier,
  remainingPasses = 0,
  planUnlocked = false,
  singleUsePriceInr = 10,
  compact = false,
}) => {
  const pad = compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
  const iconCls = compact ? 'w-3 h-3' : 'w-3.5 h-3.5';

  if (tier === 'free') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md font-bold tabular-nums whitespace-nowrap shrink-0 border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/60 text-[#138808] dark:text-emerald-300 ${pad}`}
      >
        <Zap className={iconCls} />
        <span>FREE · ₹0</span>
      </span>
    );
  }

  if (remainingPasses > 0 && !planUnlocked) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md font-bold tabular-nums whitespace-nowrap shrink-0 border border-emerald-300 dark:border-emerald-700 bg-emerald-100/90 dark:bg-emerald-950/70 text-[#138808] dark:text-emerald-300 ${pad}`}
      >
        <Ticket className={iconCls} />
        <span>PASS ACTIVE · {remainingPasses}x</span>
      </span>
    );
  }

  if (planUnlocked) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md font-bold tabular-nums whitespace-nowrap shrink-0 border border-sky-200 dark:border-sky-800/80 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 ${pad}`}
      >
        <Crown className={iconCls} />
        <span>{TIER_SHORT_LABELS[tier]} PLAN</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-bold tabular-nums whitespace-nowrap shrink-0 border border-orange-300 dark:border-orange-800/80 bg-orange-50 dark:bg-orange-950/60 text-[#E55B1B] dark:text-orange-300 ${pad}`}
    >
      <Ticket className={iconCls} />
      <span>₹{singleUsePriceInr} ONE-TIME · {TIER_SHORT_LABELS[tier]}</span>
    </span>
  );
};

export interface ToolPricingMetricRow {
  label: string;
  value: string;
}

export interface ToolPricingCardProps {
  kind: PricingTierKind;
  badgeText: string;
  audience: string;
  title: string;
  priceDisplay: string;
  cadenceLabel?: string;
  description?: string;
  metrics: ToolPricingMetricRow[];
  features: string[];
  ctaLabel: string;
  onSelect: () => void;
  disabled?: boolean;
  isActive?: boolean;
  isHighlighted?: boolean;
  tierLockedNote?: string;
  ctaVariant?: 'free' | 'one_time' | 'subscription' | 'dark';
}

const KIND_STYLES: Record<
  PricingTierKind,
  {
    surface: string;
    badge: string;
    icon: React.ComponentType<{ className?: string }>;
    cta: string;
    priceColor: string;
  }
> = {
  free: {
    surface:
      'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900/60',
    badge:
      'bg-emerald-50 dark:bg-emerald-950/70 text-[#138808] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    icon: Zap,
    cta: 'bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white',
    priceColor: 'text-[#138808] dark:text-emerald-400',
  },
  one_time: {
    surface:
      'bg-gradient-to-b from-orange-50/80 via-white to-white dark:from-orange-950/30 dark:via-slate-900 dark:to-slate-950 border-[#FF671F]',
    badge:
      'bg-orange-100 dark:bg-orange-950/80 text-[#E55B1B] dark:text-orange-300 border border-orange-300 dark:border-orange-800',
    icon: Ticket,
    cta: 'bg-[#FF671F] hover:bg-[#E55B1B] text-white',
    priceColor: 'text-[#FF671F]',
  },
  pass_active: {
    surface:
      'bg-gradient-to-b from-emerald-50/70 via-white to-white dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-950 border-emerald-400 dark:border-emerald-700',
    badge:
      'bg-emerald-100 dark:bg-emerald-950/80 text-[#138808] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800',
    icon: Ticket,
    cta: 'bg-[#138808] hover:bg-emerald-700 text-white',
    priceColor: 'text-[#138808] dark:text-emerald-400',
  },
  subscription: {
    surface:
      'bg-gradient-to-b from-sky-50/70 via-white to-white dark:from-sky-950/25 dark:via-slate-900 dark:to-slate-950 border-sky-200 dark:border-sky-900/60',
    badge:
      'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
    icon: Crown,
    cta: 'bg-sky-600 hover:bg-sky-700 text-white',
    priceColor: 'text-slate-900 dark:text-white',
  },
};

export const ToolPricingCard: React.FC<ToolPricingCardProps> = ({
  kind,
  badgeText,
  audience,
  title,
  priceDisplay,
  cadenceLabel,
  description,
  metrics,
  features,
  ctaLabel,
  onSelect,
  disabled = false,
  isActive = false,
  isHighlighted = false,
  tierLockedNote,
  ctaVariant,
}) => {
  const palette = KIND_STYLES[kind];
  const BadgeIcon = palette.icon;

  const buttonClass =
    ctaVariant === 'one_time'
      ? 'bg-[#FF671F] hover:bg-[#E55B1B] text-white'
      : ctaVariant === 'free'
      ? 'bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white'
      : ctaVariant === 'subscription'
      ? 'bg-[#138808] hover:bg-emerald-700 text-white'
      : ctaVariant === 'dark'
      ? 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white'
      : palette.cta;

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
        palette.surface
      } ${
        isHighlighted
          ? 'ring-2 ring-[#FF671F]/30 shadow-sm'
          : 'shadow-2xs hover:shadow-sm'
      }`}
    >
      <div>
        {/* Tier Visual Indicator Badge & Active Status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0 ${palette.badge}`}
          >
            <BadgeIcon className="w-3 h-3 shrink-0" />
            <span>{badgeText}</span>
          </span>

          {isActive && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#138808] dark:text-emerald-400 whitespace-nowrap shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Active</span>
            </span>
          )}
        </div>

        {/* Audience & Plan Title */}
        <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
          {audience}
        </div>
        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5 leading-snug">
          {title}
        </h3>

        {/* Price Anchor */}
        <div className="mt-3 flex items-baseline gap-1.5 tabular-nums">
          <span className={`text-2xl sm:text-3xl font-black font-mono ${palette.priceColor}`}>
            {priceDisplay}
          </span>
          {cadenceLabel && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {cadenceLabel}
            </span>
          )}
        </div>

        {description && (
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {description}
          </p>
        )}

        {/* Quantitative Metrics Strip */}
        <dl className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/70 text-[11px] tabular-nums">
          {metrics.map((row) => (
            <div key={row.label} className="py-1.5 flex items-center justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">{row.label}</dt>
              <dd className="font-bold text-slate-900 dark:text-slate-100 text-right">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* Highlights */}
        <ul className="mt-3.5 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
          {features.map((feat) => (
            <li key={feat} className="flex items-start gap-1.5">
              <Check className="w-3.5 h-3.5 text-[#138808] shrink-0 mt-0.5" />
              <span>{feat}</span>
            </li>
          ))}
        </ul>

        {tierLockedNote && (
          <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            <Lock className="w-3 h-3 shrink-0" />
            <span>{tierLockedNote}</span>
          </div>
        )}
      </div>

      {/* Primary Action */}
      <div className="mt-5 pt-1">
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled}
          className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60 disabled:cursor-default whitespace-nowrap ${
            isActive ? 'bg-emerald-600 text-white' : buttonClass
          }`}
        >
          {isActive ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Active Plan</span>
            </>
          ) : kind === 'free' ? (
            <>
              <Zap className="w-3.5 h-3.5" />
              <span>{ctaLabel}</span>
            </>
          ) : kind === 'one_time' ? (
            <>
              <Ticket className="w-3.5 h-3.5" />
              <span>{ctaLabel}</span>
            </>
          ) : ctaVariant === 'dark' ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{ctaLabel}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{ctaLabel}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

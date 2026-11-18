import React from 'react';
import {
  BadgePercent,
  Clock,
  Cpu,
  Flame,
  Hourglass,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Service } from '../../types';

export type DynamicBadgeTheme =
  | 'hot'
  | 'new'
  | 'instant'
  | 'bundle'
  | 'fast'
  | 'api'
  | 'verified'
  | 'soon'
  | 'trending';

export interface ResolvedCardBadge {
  label: string;
  labelHi?: string;
  theme: DynamicBadgeTheme;
}

const THEME_CLASSES: Record<
  DynamicBadgeTheme,
  {
    container: string;
    iconColor: string;
  }
> = {
  hot: {
    container:
      'bg-orange-50 dark:bg-orange-950/60 text-[#C2410C] dark:text-orange-300 border-orange-200/80 dark:border-orange-800/60',
    iconColor: 'text-[#FF671F] dark:text-orange-400',
  },
  new: {
    container:
      'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
  instant: {
    container:
      'bg-emerald-50 dark:bg-emerald-950/60 text-[#138808] dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
    iconColor: 'text-[#138808] dark:text-emerald-400',
  },
  bundle: {
    container:
      'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200/80 dark:border-teal-800/60',
    iconColor: 'text-teal-600 dark:text-teal-400',
  },
  fast: {
    container:
      'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  api: {
    container:
      'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60',
    iconColor: 'text-sky-600 dark:text-sky-400',
  },
  trending: {
    container:
      'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
  verified: {
    container:
      'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700',
    iconColor: 'text-[#138808] dark:text-emerald-400',
  },
  soon: {
    container:
      'bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700',
    iconColor: 'text-stone-500 dark:text-stone-400',
  },
};

function renderBadgeIcon(theme: DynamicBadgeTheme, className: string) {
  switch (theme) {
    case 'hot':
      return <Flame className={className} />;
    case 'new':
      return <Sparkles className={className} />;
    case 'instant':
      return <Zap className={className} />;
    case 'bundle':
      return <BadgePercent className={className} />;
    case 'fast':
      return <Clock className={className} />;
    case 'api':
      return <Cpu className={className} />;
    case 'trending':
      return <TrendingUp className={className} />;
    case 'soon':
      return <Hourglass className={className} />;
    case 'verified':
    default:
      return <ShieldCheck className={className} />;
  }
}

/**
 * Derives a contextual status badge from a catalogue Service item.
 * Keeps card metadata restrained (max 1 status badge per card) while adapting
 * label and theme dynamically to service type, demand, speed, and category.
 */
export function resolveServiceCardBadge(service: Service): ResolvedCardBadge {
  if (service.availability === 'Coming Soon') {
    return { label: 'Coming Soon', labelHi: 'जल्द आ रहा है', theme: 'soon' };
  }

  if (service.productType === 'compliance_package' || (service.packageSavingsInr || 0) > 0) {
    return {
      label: service.packageSavingsInr ? `Save ₹${service.packageSavingsInr}` : 'Bundle',
      labelHi: service.packageSavingsInr ? `बचत ₹${service.packageSavingsInr}` : 'बंडल',
      theme: 'bundle',
    };
  }

  if (service.productType === 'digital_product') {
    if (service.featured && service.popular) {
      return { label: 'Hot', labelHi: 'लोकप्रिय', theme: 'hot' };
    }
    if (service.featured) {
      return { label: 'New', labelHi: 'नया', theme: 'new' };
    }
    return { label: 'Instant', labelHi: 'तुरंत डाउनलोड', theme: 'instant' };
  }

  if (service.productType === 'api_product' || service.category === 'b2b-partner') {
    if (service.popular) {
      return { label: 'Hot API', labelHi: 'हॉट API', theme: 'trending' };
    }
    return { label: 'B2B API', labelHi: 'B2B API', theme: 'api' };
  }

  if (service.popular && service.featured) {
    return { label: 'Hot', labelHi: 'लोकप्रिय', theme: 'hot' };
  }

  if (service.featured) {
    return { label: 'New', labelHi: 'नया', theme: 'new' };
  }

  if (service.popular) {
    // Distinguish category context so popular tax/business vs tech items feel natural
    if (service.category === 'digital-tech' || service.category === 'education-career') {
      return { label: 'Trending', labelHi: 'ट्रेंडिंग', theme: 'trending' };
    }
    return { label: 'Hot', labelHi: 'लोकप्रिय', theme: 'hot' };
  }

  if ((service.urgentFee && service.urgentFee > 0) || (service.slaHours && service.slaHours <= 24)) {
    return { label: 'Fast Track', labelHi: 'त्वरित', theme: 'fast' };
  }

  if (service.integrationType === 'api_setu' || service.integrationType === 'digilocker') {
    return { label: 'Live Sync', labelHi: 'लाइव सिंक', theme: 'api' };
  }

  if (service.category === 'digital-tech') {
    return { label: 'New', labelHi: 'नया', theme: 'new' };
  }

  return { label: 'Verified', labelHi: 'सत्यापित', theme: 'verified' };
}

/**
 * Resolves a contextual status badge from a role/module keyword when no Service object is passed.
 */
export function resolveContextBadge(
  contextKey: string,
  fallbackLabel = 'Active'
): ResolvedCardBadge {
  const k = contextKey.toLowerCase();
  if (k.includes('hot') || k.includes('popular') || k.includes('partner')) {
    return { label: 'Hot', labelHi: 'लोकप्रिय', theme: 'hot' };
  }
  if (k.includes('new') || k.includes('kyc') || k.includes('update') || k.includes('operator')) {
    return { label: 'New', labelHi: 'नया', theme: 'new' };
  }
  if (k.includes('instant') || k.includes('vault') || k.includes('download')) {
    return { label: 'Instant', labelHi: 'तुरंत', theme: 'instant' };
  }
  if (k.includes('api') || k.includes('b2b') || k.includes('setu')) {
    return { label: 'API Live', labelHi: 'API लाइव', theme: 'api' };
  }
  if (k.includes('fast') || k.includes('sla') || k.includes('track') || k.includes('urgent')) {
    return { label: 'Fast', labelHi: 'त्वरित', theme: 'fast' };
  }
  if (k.includes('bundle') || k.includes('save') || k.includes('pack')) {
    return { label: 'Bundle', labelHi: 'बंडल', theme: 'bundle' };
  }
  return { label: fallbackLabel, theme: 'verified' };
}

interface AppCardStatusBadgeProps {
  service?: Service;
  label?: string;
  theme?: DynamicBadgeTheme;
  contextKey?: string;
  lang?: 'en' | 'hi' | string;
  size?: 'xs' | 'sm';
  className?: string;
}

export const AppCardStatusBadge: React.FC<AppCardStatusBadgeProps> = ({
  service,
  label,
  theme,
  contextKey,
  lang = 'en',
  size = 'xs',
  className = '',
}) => {
  const resolved: ResolvedCardBadge = service
    ? resolveServiceCardBadge(service)
    : label && theme
    ? { label, theme }
    : contextKey
    ? {
        ...resolveContextBadge(contextKey, label || 'Active'),
        ...(label ? { label } : {}),
        ...(theme ? { theme } : {}),
      }
    : { label: label || 'Active', theme: theme || 'verified' };

  const palette = THEME_CLASSES[resolved.theme];
  const displayLabel = lang === 'hi' && resolved.labelHi ? resolved.labelHi : resolved.label;

  return (
    <span
      className={`inline-flex items-center gap-0.5 sm:gap-1 rounded-md border font-bold tracking-tight whitespace-nowrap shrink-0 transition-colors ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px] sm:text-[11px]' : 'px-1.5 py-0.5 text-[9px] sm:text-[10px]'
      } ${palette.container} ${className}`}
    >
      {renderBadgeIcon(
        resolved.theme,
        `${size === 'sm' ? 'w-3 h-3' : 'w-2.5 h-2.5 sm:w-3 sm:h-3'} shrink-0 ${palette.iconColor}`
      )}
      <span>{displayLabel}</span>
    </span>
  );
};

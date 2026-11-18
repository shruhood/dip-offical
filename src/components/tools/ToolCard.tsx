import React from 'react';
import { Heart, ArrowRight, Sparkles } from 'lucide-react';
import type { ToolDefinition, ToolCategorySlug } from '../../types/tool';
import { LucideIcon } from './LucideIcon';
import { ToolTierBadge } from './ToolPricingCard';
import { useToolTray } from '../../context/ToolTrayContext';
import { buildUrlForRoute } from '../../lib/siteUrls';
import { getToolSingleUsePriceInr, hasPlanAccessForTier } from '../../data/toolPlans';

interface ToolCardTheme {
  card: string;
  iconBox: string;
  divider: string;
  tierBadge: string;
}

export function getToolCategoryTheme(category: ToolCategorySlug): ToolCardTheme {
  switch (category) {
    case 'pdf-tools':
      return {
        card: 'bg-gradient-to-br from-rose-50/85 via-white to-orange-50/45 dark:from-rose-950/30 dark:via-slate-900 dark:to-slate-950 border-rose-200/80 dark:border-rose-900/50 hover:border-rose-400',
        iconBox: 'bg-rose-100/90 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
        divider: 'border-rose-100 dark:border-rose-900/40',
        tierBadge: 'text-rose-700 dark:text-rose-300',
      };
    case 'image-tools':
    case 'compressors':
      return {
        card: 'bg-gradient-to-br from-sky-50/85 via-white to-cyan-50/45 dark:from-sky-950/30 dark:via-slate-900 dark:to-slate-950 border-sky-200/80 dark:border-sky-900/50 hover:border-sky-400',
        iconBox: 'bg-sky-100/90 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
        divider: 'border-sky-100 dark:border-sky-900/40',
        tierBadge: 'text-sky-700 dark:text-sky-300',
      };
    case 'csc-tools':
    case 'printing-tools':
      return {
        card: 'bg-gradient-to-br from-orange-50/90 via-white to-amber-50/50 dark:from-orange-950/30 dark:via-slate-900 dark:to-slate-950 border-orange-200/80 dark:border-orange-900/50 hover:border-[#FF671F]',
        iconBox: 'bg-orange-100/90 text-[#E55B1B] border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
        divider: 'border-orange-100 dark:border-orange-900/40',
        tierBadge: 'text-[#E55B1B] dark:text-orange-300',
      };
    case 'calculators':
    case 'business-tools':
      return {
        card: 'bg-gradient-to-br from-emerald-50/85 via-white to-teal-50/45 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-950 border-emerald-200/80 dark:border-emerald-900/50 hover:border-[#138808]',
        iconBox: 'bg-emerald-100/90 text-[#138808] border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
        divider: 'border-emerald-100 dark:border-emerald-900/40',
        tierBadge: 'text-[#138808] dark:text-emerald-300',
      };
    case 'ai-tools':
      return {
        card: 'bg-gradient-to-br from-violet-50/90 via-white to-indigo-50/50 dark:from-violet-950/30 dark:via-slate-900 dark:to-slate-950 border-violet-200/80 dark:border-violet-900/50 hover:border-violet-400',
        iconBox: 'bg-violet-100/90 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
        divider: 'border-violet-100 dark:border-violet-900/40',
        tierBadge: 'text-violet-700 dark:text-violet-300',
      };
    default:
      return {
        card: 'bg-gradient-to-br from-amber-50/80 via-white to-slate-50/60 dark:from-amber-950/25 dark:via-slate-900 dark:to-slate-950 border-amber-200/80 dark:border-amber-900/50 hover:border-amber-400',
        iconBox: 'bg-amber-100/90 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
        divider: 'border-amber-100 dark:border-amber-900/40',
        tierBadge: 'text-amber-800 dark:text-amber-300',
      };
  }
}

interface ToolCardProps {
  tool: ToolDefinition;
  onNavigate: (route: string, param?: string) => void;
  compact?: boolean;
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool, onNavigate, compact = false }) => {
  const { plan, isFavourite, toggleFavourite, getRemainingSingleUsePasses } = useToolTray();
  const fav = isFavourite(tool.slug);
  const theme = getToolCategoryTheme(tool.category);
  const planUnlocked = hasPlanAccessForTier(plan, tool.tier);
  const remainingPasses = getRemainingSingleUsePasses(tool.slug);
  const unlocked = planUnlocked || remainingPasses > 0;
  const singleUsePrice = getToolSingleUsePriceInr(tool);

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate('tool-detail', tool.slug);
  };

  return (
    <div
      className={`group flex flex-col justify-between border rounded-xl ${
        compact ? 'p-3 sm:p-3.5' : 'p-3.5 sm:p-4'
      } shadow-2xs hover:shadow-md transition-all ${theme.card}`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div
            className={`${
              compact ? 'w-8 h-8' : 'w-9 h-9'
            } rounded-lg border flex items-center justify-center shrink-0 ${theme.iconBox}`}
          >
            <LucideIcon name={tool.iconName} className={compact ? 'w-4 h-4' : 'w-4.5 h-4.5'} />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {tool.isAiPowered && (
              <span
                title="AI Powered"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 text-[10px] font-bold"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>AI</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => toggleFavourite(tool)}
              aria-label={fav ? `Remove ${tool.name} from favorites` : `Save ${tool.name} to favorites`}
              aria-pressed={fav}
              title={fav ? 'Remove from Favorites' : 'Save to Favorites'}
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                fav
                  ? 'text-rose-500 hover:bg-rose-500/10'
                  : 'text-slate-400 hover:text-rose-500 hover:bg-white/70 dark:hover:bg-slate-800'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${fav ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          </div>
        </div>

        <a
          href={buildUrlForRoute('tool-detail', tool.slug)}
          onClick={handleOpen}
          className="block focus:outline-none"
        >
          <h3
            className={`${
              compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-[15px]'
            } font-bold text-slate-900 dark:text-white group-hover:text-[#FF671F] transition-colors line-clamp-1`}
          >
            {tool.name}
          </h3>
        </a>

        <p className="mt-1 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
          {tool.shortDescription}
        </p>
      </div>

      <div
        className={`mt-3 pt-2.5 border-t ${theme.divider} flex items-center justify-between gap-2 text-[11px]`}
      >
        <ToolTierBadge
          tier={tool.tier}
          remainingPasses={remainingPasses}
          planUnlocked={planUnlocked}
          singleUsePriceInr={singleUsePrice}
          compact
        />

        <a
          href={buildUrlForRoute('tool-detail', tool.slug)}
          onClick={handleOpen}
          className="inline-flex items-center gap-1 font-bold text-[#FF671F] hover:text-[#E55B1B] hover:underline whitespace-nowrap shrink-0 tabular-nums"
        >
          <span>{unlocked ? 'Open' : `Unlock ₹${singleUsePrice}`}</span>
          <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

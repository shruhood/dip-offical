import React, { useMemo, useState } from 'react';
import {
  X,
  Search,
  Wrench,
  Crown,
  Heart,
  Clock,
  Sparkles,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { TOOLS_REGISTRY, searchTools } from '../../data/toolsRegistry';
import { SIDEBAR_CATEGORIES } from '../../lib/catalogCategories';
import { useToolTray } from '../../context/ToolTrayContext';
import { useLanguage } from '../../context/LanguageContext';
import { LucideIcon } from './LucideIcon';
import { hasPlanAccessForTier } from '../../data/toolPlans';
import { getToolCategoryTheme } from './ToolCard';
import { ToolTierBadge } from './ToolPricingCard';
import type { ToolDefinition } from '../../types/tool';

interface DigitalToolsTrayProps {
  onNavigate: (route: string, param?: string) => void;
}

type TrayFilterTab = 'popular' | 'free' | 'paid' | 'csc' | 'ai' | 'favorites' | 'recent';

export const DigitalToolsTray: React.FC<DigitalToolsTrayProps> = ({ onNavigate }) => {
  const { lang } = useLanguage();
  const {
    trayOpen,
    setTrayOpen,
    plan,
    planDefinition,
    creditsRemaining,
    dailyJobsUsed,
    favourites,
    recentTools,
    getRemainingSingleUsePasses,
  } = useToolTray();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TrayFilterTab>('popular');

  const filteredTools = useMemo<ToolDefinition[]>(() => {
    const trimmed = query.trim();
    if (trimmed) {
      return searchTools(trimmed).slice(0, 30);
    }
    switch (activeTab) {
      case 'free':
        return TOOLS_REGISTRY.filter((t) => t.tier === 'free').slice(0, 24);
      case 'paid':
        return TOOLS_REGISTRY.filter((t) => t.tier !== 'free').slice(0, 24);
      case 'csc':
        return TOOLS_REGISTRY.filter((t) => t.isCscEssential).slice(0, 24);
      case 'ai':
        return TOOLS_REGISTRY.filter((t) => t.isAiPowered).slice(0, 24);
      case 'favorites':
        return TOOLS_REGISTRY.filter((t) =>
          favourites.some((f) => f.toolSlug === t.slug)
        );
      case 'recent':
        return recentTools;
      case 'popular':
      default:
        return TOOLS_REGISTRY.filter((t) => t.isPopular).slice(0, 24);
    }
  }, [activeTab, favourites, query, recentTools]);

  if (!trayOpen) return null;

  const openTool = (slug: string) => {
    setTrayOpen(false);
    onNavigate('tool-detail', slug);
  };

  const openAllTools = (cat?: string) => {
    setTrayOpen(false);
    onNavigate('tools', cat || '');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Digital Tools Tray"
    >
      <div
        className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs"
        onClick={() => setTrayOpen(false)}
      />

      <aside className="relative z-10 w-full max-w-md h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
        {/* Drawer Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-orange-50/90 via-white to-emerald-50/80 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#FF671F] text-white flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-900 dark:text-white truncate">
                {lang === 'hi' ? 'डिजिटल टूल्स ट्रे (150+)' : 'Digital Tools Tray (150+)'}
              </h2>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                PDF · Photo KB · CSC · QR · GST · AI
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTrayOpen(false)}
            aria-label="Close Digital Tools Tray"
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-[#FF671F] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Plan Bar */}
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0 tabular-nums">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
              <Crown className="w-3.5 h-3.5 text-[#FF671F] shrink-0" />
              <span className="truncate">{planDefinition.name}</span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {creditsRemaining} AI credits · {dailyJobsUsed}
              {planDefinition.dailyJobLimit ? `/${planDefinition.dailyJobLimit}` : ''} jobs today
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setTrayOpen(false);
              onNavigate('tool-plans');
            }}
            className="px-2.5 py-1.5 rounded-lg bg-[#FF671F] hover:bg-[#E55B1B] text-white text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            {plan === 'free' ? 'Upgrade Plan' : 'Manage Plan'}
          </button>
        </div>

        {/* Search & Filter Tabs */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search PDF, 20KB, PAN photo, GST, OCR, QR..."
              className="w-full pl-9 pr-12 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:border-[#FF671F]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 text-[11px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            {(
              [
                { id: 'popular', label: 'Popular' },
                { id: 'free', label: 'Free Tools' },
                { id: 'paid', label: 'Paid Pro' },
                { id: 'csc', label: 'CSC Desk' },
                { id: 'ai', label: 'AI Tools' },
                { id: 'favorites', label: `Saved (${favourites.length})` },
                { id: 'recent', label: `Recent (${recentTools.length})` },
              ] as { id: TrayFilterTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setQuery('');
                  setActiveTab(tab.id);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition ${
                  activeTab === tab.id && !query
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-orange-950/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Quick Tool Grid + Category Pills */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Quick Category Chips */}
          {!query && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-0.5">
                Quick Categories
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {SIDEBAR_CATEGORIES.slice(0, 8).map((cat) => (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => openAllTools(cat.slug)}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 hover:border-[#FF671F] text-left cursor-pointer transition"
                  >
                    <LucideIcon name={cat.iconName} className="w-3.5 h-3.5 text-[#FF671F] shrink-0" />
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filtered Tool Cards */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-0.5">
              <span>
                {query
                  ? `Search Matches (${filteredTools.length})`
                  : `${activeTab.toUpperCase()} TOOLS (${filteredTools.length})`}
              </span>
              {activeTab === 'favorites' && <Heart className="w-3 h-3 text-rose-500" />}
              {activeTab === 'recent' && <Clock className="w-3 h-3 text-sky-500" />}
            </div>

            {filteredTools.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-2">
                <p>No tools matched in this view yet.</p>
                <button
                  type="button"
                  onClick={() => openAllTools()}
                  className="text-[#FF671F] font-bold hover:underline cursor-pointer"
                >
                  Browse All {TOOLS_REGISTRY.length} Tools
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTools.map((tool) => {
                  const theme = getToolCategoryTheme(tool.category);
                  const planUnlocked = hasPlanAccessForTier(plan, tool.tier);
                  const remainingPasses = getRemainingSingleUsePasses(tool.slug);
                  const singleUsePrice = tool.singleUsePriceInr ?? 10;
                  return (
                    <button
                      key={tool.slug}
                      type="button"
                      onClick={() => openTool(tool.slug)}
                      className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between gap-2.5 cursor-pointer transition ${theme.card}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${theme.iconBox}`}
                        >
                          <LucideIcon name={tool.iconName} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {tool.name}
                            </span>
                            {tool.isAiPowered && (
                              <Sparkles className="w-3 h-3 text-violet-600 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {tool.categoryLabel}
                            </span>
                            <ToolTierBadge
                              tier={tool.tier}
                              remainingPasses={remainingPasses}
                              planUnlocked={planUnlocked}
                              singleUsePriceInr={singleUsePrice}
                              compact
                            />
                          </div>
                        </div>
                      </div>

                      <span className="text-xs font-bold text-[#FF671F] shrink-0 flex items-center gap-0.5 tabular-nums">
                        {!planUnlocked && remainingPasses === 0 && (
                          <Lock className="w-3 h-3 text-amber-600" />
                        )}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center gap-2">
          <button
            type="button"
            onClick={() => openAllTools()}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white text-xs font-bold cursor-pointer"
          >
            Full {TOOLS_REGISTRY.length} Tools Hub
          </button>
          <button
            type="button"
            onClick={() => {
              setTrayOpen(false);
              onNavigate('tool-plans');
            }}
            className="py-2 px-3 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            Free &amp; Paid Plans
          </button>
        </div>
      </aside>
    </div>
  );
};

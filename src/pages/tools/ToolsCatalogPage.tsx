import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Search,
  Wrench,
  Crown,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Layers,
  Heart,
  SlidersHorizontal,
  Ticket,
  Clock,
  X,
} from 'lucide-react';
import { TOOLS_REGISTRY } from '../../data/toolsRegistry';
import {
  filterCatalogTools,
  getSidebarCategoryCounts,
  getSidebarCategoryMeta,
  resolveCategorySlugAlias,
  SIDEBAR_CATEGORIES,
  type CatalogFilterTab,
} from '../../lib/catalogCategories';
import { useToolTray } from '../../context/ToolTrayContext';
import { useLanguage } from '../../context/LanguageContext';
import { ToolCard } from '../../components/tools/ToolCard';
import { LucideIcon } from '../../components/tools/LucideIcon';
import { ToolPlansSection } from '../../components/tools/ToolPlansSection';

interface ToolsCatalogPageProps {
  initialCategory?: string;
  onNavigate: (route: string, param?: string) => void;
}

export const ToolsCatalogPage: React.FC<ToolsCatalogPageProps> = ({
  initialCategory = '',
  onNavigate,
}) => {
  const { lang } = useLanguage();
  const {
    plan,
    planDefinition,
    creditsRemaining,
    dailyJobsUsed,
    favourites,
    activeSingleUsePassList,
  } = useToolTray();

  const [selectedCategory, setSelectedCategory] = useState<string>(
    resolveCategorySlugAlias(initialCategory) || ''
  );
  const [filterTab, setFilterTab] = useState<CatalogFilterTab | 'saved'>('all');
  const [query, setQuery] = useState('');
  const [showPlansInline, setShowPlansInline] = useState(false);
  const [mobileCatsOpen, setMobileCatsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedCategory(resolveCategorySlugAlias(initialCategory) || '');
  }, [initialCategory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const isEditable =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable);
        if (!isEditable) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeCategoryMeta = useMemo(
    () => (selectedCategory ? getSidebarCategoryMeta(selectedCategory) : undefined),
    [selectedCategory]
  );

  const visibleTools = useMemo(() => {
    const base = filterCatalogTools({
      categorySlug: selectedCategory || undefined,
      query,
      filterTab: filterTab === 'saved' ? 'all' : filterTab,
    });
    if (filterTab === 'saved') {
      const favSet = new Set(favourites.map((f) => f.toolSlug));
      return base.filter((t) => favSet.has(t.slug));
    }
    return base;
  }, [favourites, filterTab, query, selectedCategory]);

  const sidebarCounts = useMemo(
    () => getSidebarCategoryCounts(query, filterTab === 'saved' ? 'all' : filterTab),
    [query, filterTab]
  );

  const coreCategories = useMemo(
    () => SIDEBAR_CATEGORIES.filter((c) => c.group === 'core'),
    []
  );
  const specializedCategories = useMemo(
    () => SIDEBAR_CATEGORIES.filter((c) => c.group === 'specialized'),
    []
  );

  const freeCount = useMemo(
    () => TOOLS_REGISTRY.filter((t) => t.tier === 'free').length,
    []
  );
  const paidCount = TOOLS_REGISTRY.length - freeCount;

  const renderCategoryButton = (cat: (typeof SIDEBAR_CATEGORIES)[number]) => {
    const count = sidebarCounts.byCategory[cat.slug] ?? 0;
    const isActive = selectedCategory === cat.slug;
    return (
      <button
        key={cat.slug}
        type="button"
        onClick={() => {
          setSelectedCategory(isActive ? '' : cat.slug);
          setMobileCatsOpen(false);
        }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-xs transition cursor-pointer ${
          isActive
            ? 'bg-[#FF671F] text-white font-bold shadow-2xs'
            : 'text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800/80 font-medium'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <LucideIcon
            name={cat.iconName}
            className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-[#FF671F]'}`}
          />
          <span className="truncate">{cat.label}</span>
        </span>
        <span
          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded tabular-nums shrink-0 ${
            isActive
              ? 'bg-white/20 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          {count}
        </span>
      </button>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Hero Banner & Plan Context */}
      <section className="rounded-2xl border border-orange-200/80 dark:border-orange-900/50 bg-gradient-to-br from-orange-50/90 via-white to-sky-50/75 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/30 p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#FF671F]">
              <Wrench className="w-3.5 h-3.5" />
              <span>
                {lang === 'hi'
                  ? 'डिजिटल टूल्स ट्रे · 150 ब्राउज़र व AI उपयोगिताएँ'
                  : 'Digital Tools Tray · 150 Browser, CSC & AI Utilities'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {activeCategoryMeta
                ? activeCategoryMeta.label
                : lang === 'hi'
                ? 'ऑल-इन-वन डिजिटल टूल्स हब'
                : 'All-in-One Digital Productivity & CSC Toolkit'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
              {activeCategoryMeta
                ? activeCategoryMeta.description
                : `${freeCount} Free browser tools + ${paidCount} Pro/CSC/AI tools (unlock any paid tool once for ₹10 or via Monthly Subscription).`}
            </p>
          </div>

          {/* Active Plan Card */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/90 flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-2.5 shrink-0">
            <div className="space-y-0.5 tabular-nums lg:text-right">
              <div className="flex items-center lg:justify-end gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                <Crown className="w-3.5 h-3.5 text-[#FF671F]" />
                <span>Active: {planDefinition.name}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {creditsRemaining} AI credits · {dailyJobsUsed}
                {planDefinition.dailyJobLimit ? `/${planDefinition.dailyJobLimit}` : ''} jobs today
                {activeSingleUsePassList.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[#FF671F] font-bold">
                    · <Ticket className="w-3 h-3 inline" /> {activeSingleUsePassList.length} ₹10 pass
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPlansInline((v) => !v)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-[#FF671F] text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
              >
                {showPlansInline ? 'Hide Plans' : '₹10 / Pro Plans'}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('tool-plans')}
                className="px-3 py-1.5 rounded-lg bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{plan === 'free' ? 'Upgrade' : 'Manage Plan'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Inline Real-Time Search & Quick Navigation */}
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && query) {
                    e.preventDefault();
                    setQuery('');
                  } else if (e.key === 'Enter' && query.trim() && visibleTools.length > 0) {
                    e.preventDefault();
                    onNavigate('tool-detail', visibleTools[0].slug);
                  }
                }}
                aria-label="Search tools by name or description"
                placeholder="Search 150 tools by name or description (e.g., Merge PDF, 20KB Photo, Signature, Passport Sheet, UPI QR, GST, Hindi OCR)..."
                className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm focus:outline-none focus:border-[#FF671F]"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              ) : (
                <span className="hidden sm:inline-flex absolute right-3 text-[10px] font-mono font-semibold text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 pointer-events-none">
                  Press /
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shrink-0 tabular-nums">
              <CheckCircle2 className="w-4 h-4 text-[#138808]" />
              <span>{visibleTools.length} tools shown</span>
            </div>
          </div>

          {query.trim() && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs pt-0.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">
                Quick Jump:
              </span>
              {visibleTools.slice(0, 5).map((match) => (
                <button
                  key={match.slug}
                  type="button"
                  onClick={() => onNavigate('tool-detail', match.slug)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-orange-200/90 dark:border-orange-900/60 hover:border-[#FF671F] text-slate-800 dark:text-slate-100 font-semibold text-[11px] transition cursor-pointer"
                >
                  <span>{match.name}</span>
                  <ArrowRight className="w-3 h-3 text-[#FF671F]" />
                </button>
              ))}
              {selectedCategory && sidebarCounts.total > visibleTools.length && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('')}
                  className="ml-auto text-[11px] font-bold text-[#FF671F] hover:underline cursor-pointer"
                >
                  Show all {sidebarCounts.total} matches across all categories
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {showPlansInline && (
        <section className="animate-fadeIn">
          <ToolPlansSection onNavigate={onNavigate} compact />
        </section>
      )}

      {/* Main Catalog Workspace: Persistent Category Sidebar (Desktop) + Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
        {/* Mobile Category Filter Toggle */}
        <div className="lg:hidden space-y-2">
          <button
            type="button"
            onClick={() => setMobileCatsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#FF671F]" />
              <span>
                Category: {activeCategoryMeta ? activeCategoryMeta.label : `All Categories (${TOOLS_REGISTRY.length})`}
              </span>
            </span>
            <span className="text-[#FF671F]">{mobileCatsOpen ? 'Hide' : 'Change'}</span>
          </button>

          {mobileCatsOpen && (
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-md">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('');
                  setMobileCatsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                  selectedCategory === ''
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>All Categories</span>
                <span className="font-mono">{sidebarCounts.total}</span>
              </button>
              <div className="space-y-1">{SIDEBAR_CATEGORIES.map(renderCategoryButton)}</div>
            </div>
          )}
        </div>

        {/* Desktop Persistent Left Category Sidebar */}
        <aside className="hidden lg:block sticky top-20 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900 p-3.5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#FF671F]" />
              <span>Categories</span>
            </h2>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => setSelectedCategory('')}
                className="text-[11px] font-bold text-[#FF671F] hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSelectedCategory('')}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              selectedCategory === ''
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                : 'bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 hover:border-[#FF671F]'
            }`}
          >
            <span className="flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-[#FF671F]" />
              <span>All Categories</span>
            </span>
            <span className="text-[10px] font-mono tabular-nums opacity-85">
              {sidebarCounts.total}
            </span>
          </button>

          <div className="space-y-1">
            <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Core Toolkits
            </div>
            {coreCategories.map(renderCategoryButton)}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
            <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Specialized Utilities
            </div>
            {specializedCategories.map(renderCategoryButton)}
          </div>
        </aside>

        {/* Right Content Column: Filter Tabs + Tool Cards */}
        <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
              {(
                [
                  { id: 'all', label: 'All Tools' },
                  { id: 'free', label: `Free (${freeCount})` },
                  { id: 'paid', label: `Paid · ₹10/use (${paidCount})` },
                  { id: 'popular', label: 'Popular' },
                  { id: 'recent', label: 'New Releases' },
                  { id: 'csc', label: 'CSC & Cyber Café' },
                  { id: 'ai', label: 'AI Studio' },
                  { id: 'saved', label: `Saved (${favourites.length})` },
                ] as { id: CatalogFilterTab | 'saved'; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1 ${
                    filterTab === tab.id
                      ? 'bg-[#FF671F] text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-[#FF671F]'
                  }`}
                >
                  {tab.id === 'saved' && <Heart className="w-3 h-3" />}
                  {tab.id === 'recent' && <Clock className="w-3 h-3" />}
                  {tab.id === 'paid' && <Ticket className="w-3 h-3" />}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('tool-plans')}
              className="text-xs font-bold text-[#FF671F] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>₹10 Pass &amp; Monthly Plans</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {visibleTools.length === 0 ? (
            <div className="p-10 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No tools matched your search or filter combination.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSelectedCategory('');
                  setFilterTab('all');
                }}
                className="px-4 py-2 rounded-xl bg-[#FF671F] text-white text-xs font-bold cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {visibleTools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full Free, ₹10 Pay-Per-Use & Subscription Plans Section at bottom */}
      <section className="pt-4">
        <ToolPlansSection onNavigate={onNavigate} />
      </section>
    </div>
  );
};

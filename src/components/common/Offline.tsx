import React, { useEffect, useMemo, useState } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Home,
  LayoutGrid,
  BookOpen,
  FileText,
  HelpCircle,
  ChevronRight,
  Clock,
  HardDriveDownload,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';
import { trackInteraction } from '../../lib/perfMonitor';
import { BRAND_LOGO_URL } from './Logo';
import {
  getCachedRoutes,
  isRouteOfflineReady,
  useNetworkStatus,
  type CachedRouteEntry,
} from '../../hooks/useNetworkStatus';

interface OfflineProps {
  currentRoute: string;
  currentParam?: string;
  onNavigate: (route: string, param?: string) => void;
}

interface SuggestedPageItem {
  id: string;
  route: string;
  param: string;
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
}

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const Offline: React.FC<OfflineProps> = ({
  currentRoute,
  currentParam = '',
  onNavigate,
}) => {
  const { user } = useAuth();
  const { services, blogPosts, drafts, applications } = useData();
  const { lang } = useLanguage();
  const {
    isOnline,
    offlineSince,
    justReconnected,
    dismissReconnected,
    checkConnection,
  } = useNetworkStatus();

  const [sheetOpen, setSheetOpen] = useState<boolean>(!isOnline);
  const [retrying, setRetrying] = useState(false);
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);
  const [recentRoutes, setRecentRoutes] = useState<CachedRouteEntry[]>(() => getCachedRoutes());

  // Re-open the friendly offline sheet whenever connectivity drops or user enters a network-only screen
  useEffect(() => {
    if (!isOnline) {
      setRecentRoutes(getCachedRoutes());
      setRetryFeedback(null);
      if (!isRouteOfflineReady(currentRoute)) {
        setSheetOpen(true);
      } else {
        setSheetOpen(true);
      }
      trackInteraction('offline', 'connection_lost', currentRoute, currentRoute);
    } else {
      setSheetOpen(false);
      setRetryFeedback(null);
    }
  }, [isOnline]);

  useEffect(() => {
    if (!isOnline && !isRouteOfflineReady(currentRoute)) {
      setSheetOpen(true);
    }
  }, [currentRoute, isOnline]);

  const userDraftCount = useMemo(
    () => (user ? drafts.filter((d) => d.userId === user.id).length : drafts.length),
    [drafts, user]
  );

  const userAppCount = useMemo(
    () => (user ? applications.filter((a) => a.userId === user.id).length : 0),
    [applications, user]
  );

  const builtInCachedPages = useMemo<SuggestedPageItem[]>(() => {
    const base: SuggestedPageItem[] = [
      {
        id: 'services',
        route: 'services',
        param: 'all',
        title: lang === 'hi' ? 'सेवा कैटलॉग (कैश्ड)' : 'Services Catalog',
        subtitle: `${services.length} assistance plans & checklists stored locally`,
        badge: 'Cached',
        icon: LayoutGrid,
      },
      {
        id: 'blog',
        route: 'blog',
        param: '',
        title: lang === 'hi' ? 'गाइड और लेख' : 'Citizen & Business Guides',
        subtitle: `${blogPosts.length} offline help articles & eligibility guides`,
        badge: 'Cached',
        icon: BookOpen,
      },
      {
        id: 'home',
        route: 'home',
        param: '',
        title: lang === 'hi' ? 'होम स्क्रीन' : 'Home Workspace',
        subtitle: 'Browse categories & popular service shortcuts',
        badge: 'Offline OK',
        icon: Home,
      },
      {
        id: 'faq',
        route: 'faq',
        param: '',
        title: lang === 'hi' ? 'सहायता और FAQ' : 'Help & FAQs',
        subtitle: 'Document checklists, timelines & refund policy',
        badge: 'Offline OK',
        icon: HelpCircle,
      },
    ];

    if (user) {
      base.splice(1, 0, {
        id: 'dashboard-drafts',
        route: 'dashboard',
        param: userDraftCount > 0 ? 'drafts' : 'applications',
        title: userDraftCount > 0 ? 'My Saved Drafts' : 'My Applications',
        subtitle: `${userDraftCount} saved draft${userDraftCount === 1 ? '' : 's'} · ${userAppCount} cached record${userAppCount === 1 ? '' : 's'}`,
        badge: 'Local',
        icon: FileText,
      });
    }

    return base;
  }, [blogPosts.length, lang, services.length, user, userAppCount, userDraftCount]);

  const handleRetry = async () => {
    setRetrying(true);
    setRetryFeedback(null);
    trackInteraction('offline', 'retry_connection', currentRoute, currentRoute);
    const connected = await checkConnection();
    setRetrying(false);

    if (connected) {
      setSheetOpen(false);
    } else {
      setRetryFeedback(
        lang === 'hi'
          ? 'अभी भी ऑफ़लाइन हैं — कृपया Wi-Fi या मोबाइल डेटा जांचें।'
          : 'Still offline — check Wi-Fi or mobile data and try again.'
      );
    }
  };

  const handleOpenCachedPage = (route: string, param = '') => {
    trackInteraction('offline', 'open_cached_page', param ? `${route}/${param}` : route, currentRoute);
    onNavigate(route, param);
    setSheetOpen(false);
  };

  // Reconnection recovery toast
  if (isOnline) {
    if (!justReconnected) return null;
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-[#138808] text-white shadow-xl border border-emerald-400/40 flex items-center gap-2.5 text-xs font-bold animate-fadeIn max-w-[92vw]"
      >
        <Wifi className="w-4 h-4 shrink-0" />
        <span className="truncate">
          {lang === 'hi'
            ? 'इंटरनेट वापस आ गया — लाइव सिंक चालू है'
            : 'Back online — Live status & sync restored'}
        </span>
        <button
          type="button"
          onClick={dismissReconnected}
          aria-label="Dismiss reconnection notice"
          className="p-0.5 rounded-md hover:bg-white/15 cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Persistent Slim Mobile-App Offline Strip */}
      <div
        role="status"
        aria-live="assertive"
        style={{ top: 'var(--dip-header-h, 56px)' }}
        className="fixed left-0 right-0 z-30 bg-amber-500 dark:bg-amber-600 text-slate-950 dark:text-white border-b border-amber-600/30 shadow-xs"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-1.5 flex items-center justify-between gap-2 text-[11px] font-bold">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-slate-950 dark:bg-white animate-pulse shrink-0" />
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {lang === 'hi'
                ? 'आप ऑफ़लाइन हैं — कैश्ड डेटा दिखाया जा रहा है'
                : "You're offline — Browsing locally cached data"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setRecentRoutes(getCachedRoutes());
                setSheetOpen(true);
              }}
              className="px-2 py-0.5 rounded-md bg-slate-950/15 dark:bg-white/20 hover:bg-slate-950/25 dark:hover:bg-white/30 transition cursor-pointer whitespace-nowrap"
            >
              Cached Pages
            </button>
            <button
              type="button"
              onClick={() => void handleRetry()}
              disabled={retrying}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950 hover:opacity-90 transition cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>

      {/* Native Mobile-App Style Offline Sheet / Modal */}
      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="offline-modal-title"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
        >
          <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[88vh] flex flex-col">
            {/* Top Drag Handle (mobile cue) & Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-[#1E293B] to-slate-900 text-white relative shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-4 sm:hidden" />

              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Continue offline"
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3.5 pr-8">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-white p-1 border border-white/20 shadow-md overflow-hidden">
                    <img
                      src={BRAND_LOGO_URL}
                      alt="Digital India Project"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center ring-2 ring-slate-900">
                    <WifiOff className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    <HardDriveDownload className="w-3 h-3" />
                    <span>Offline Mode Active</span>
                    {offlineSince && (
                      <span className="text-slate-400 font-mono">
                        · Since {new Date(offlineSince).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <h2 id="offline-modal-title" className="text-lg sm:text-xl font-black tracking-tight">
                    {lang === 'hi' ? 'इंटरनेट कनेक्शन नहीं है' : 'No Internet Connection'}
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {lang === 'hi'
                      ? 'चिंता न करें — आपकी सहेजी गई सेवाएँ, ड्राफ्ट और मार्गदर्शिकाएँ ऑफ़लाइन उपलब्ध हैं।'
                      : "Don't worry — your services catalog, saved drafts, and help guides stay cached on this device until your connection returns."}
                  </p>
                </div>
              </div>
            </div>

            {/* Body: Suggested Cached Pages */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {!isRouteOfflineReady(currentRoute) && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Live sync needed for "{currentRoute}"</span>
                    <span className="text-[11px] opacity-90">
                      Real-time status tracking, payments, and account sign-in require an active connection. Choose a cached page below in the meantime.
                    </span>
                  </div>
                </div>
              )}

              {retryFeedback && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {retryFeedback}
                </div>
              )}

              {/* Recently Visited Cached Pages */}
              {recentRoutes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#FF671F]" />
                      <span>Recently Cached Pages</span>
                    </span>
                    <span className="text-[10px] font-mono">{recentRoutes.length} ready</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recentRoutes.slice(0, 4).map((item) => {
                      const isCurrent = item.route === currentRoute && item.param === currentParam;
                      return (
                        <button
                          key={`${item.route}:${item.param}`}
                          type="button"
                          onClick={() => handleOpenCachedPage(item.route, item.param)}
                          className={`p-3 rounded-2xl border text-left transition flex items-center justify-between gap-2 cursor-pointer active:scale-[0.98] ${
                            isCurrent
                              ? 'border-[#FF671F] bg-[#FFF5EE] dark:bg-orange-950/25'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {item.label}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <CheckCircle2 className="w-3 h-3 text-[#138808] shrink-0" />
                              <span>Cached · {formatRelativeTime(item.visitedAt)}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Built-in Offline Ready Sections */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Suggested Available Pages Offline
                </div>

                <div className="space-y-2">
                  {builtInCachedPages.map((page) => {
                    const Icon = page.icon;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => handleOpenCachedPage(page.route, page.param)}
                        className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition flex items-center justify-between gap-3 text-left cursor-pointer active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#FF671F] flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {page.title}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-[#138808] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 shrink-0">
                                {page.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {page.subtitle}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Controls */}
            <div className="p-4 sm:px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex flex-col sm:flex-row gap-2.5 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
              <button
                type="button"
                onClick={() => void handleRetry()}
                disabled={retrying}
                className="flex-1 bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                <span>{retrying ? 'Checking Connection...' : 'Retry Connection'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer"
              >
                Continue Browsing Offline
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

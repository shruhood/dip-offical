import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToolTray } from '../context/ToolTrayContext';
import { TrackingWidget } from '../components/tracking/TrackingWidget';
import { RoleAdaptedLanding } from '../components/home/RoleAdaptedLanding';
import { GuestAudienceShowcase } from '../components/home/GuestAudienceShowcase';
import { getLandingProfileForRole } from '../lib/roleLandingConfig';
import { getEffectiveUserRole } from '../lib/rbac';
import { buildUrlForRoute } from '../lib/siteUrls';
import { formatServicePriceLabel } from '../lib/finance';
import { TARGET_LOCATIONS } from '../data/catalogue/locations';
import { trackInteraction } from '../lib/perfMonitor';
import { AppCardStatusBadge } from '../components/common/AppCardStatusBadge';
import { getServiceCardTheme } from '../lib/cardColors';
import { Service } from '../types';
import operatorKendraImg from '../assets/images/operator_kendra_partner_1794560650685.jpg';
import {
  Search,
  ArrowRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  FileText,
  CreditCard,
  Building2,
  Landmark,
  BadgePercent,
  Utensils,
  Globe,
  ScrollText,
  FolderLock,
  FileSpreadsheet,
  Store,
  ReceiptText,
  Layers,
  Headphones,
  Lock,
  ChevronRight,
  Award,
  UserCheck,
  Eye,
  Wrench,
  Crown,
  Sparkles,
  QrCode,
  Calculator,
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (route: string, param?: string) => void;
  onApplyForService: (service: Service) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onApplyForService }) => {
  const { lang, t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const { services, categories, packages } = useData();
  const { setTrayOpen, planDefinition } = useToolTray();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showPublicOverview, setShowPublicOverview] = useState(false);

  const effectiveUserRole = useMemo(() => (user ? getEffectiveUserRole(user) : null), [user]);

  const roleLandingProfile = useMemo(
    () => getLandingProfileForRole(effectiveUserRole, isAuthenticated),
    [effectiveUserRole, isAuthenticated]
  );

  const activeServices = useMemo(
    () => services.filter((s) => s.published !== false),
    [services]
  );

  const filteredServices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const matched = activeServices.filter((s) => {
      const matchCategory = selectedCategory === 'all' || s.category === selectedCategory;
      if (!q) return matchCategory;
      const matchQuery =
        s.name.toLowerCase().includes(q) ||
        s.shortDesc.toLowerCase().includes(q) ||
        (s.nameHi && s.nameHi.includes(q)) ||
        (s.subcategory && s.subcategory.toLowerCase().includes(q)) ||
        s.category.toLowerCase().includes(q);
      return matchCategory && matchQuery;
    });
    const sorted = [...matched].sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
    return sorted.slice(0, q ? 16 : 12);
  }, [activeServices, searchQuery, selectedCategory]);

  const digitalProductsSpotlight = useMemo(
    () =>
      activeServices
        .filter((s) => s.productType === 'digital_product' || s.category === 'digital-products')
        .slice(0, 4),
    [activeServices]
  );

  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return services
      .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 5);
  }, [services, searchQuery]);

  const handleAnchorNav = (e: React.MouseEvent, route: string, param?: string) => {
    e.preventDefault();
    onNavigate(route, param);
  };

  const renderServiceIcon = (name: string, className = 'w-5 h-5 text-[#FF671F]') => {
    switch (name) {
      case 'CreditCard':
      case 'FilePenLine':
        return <CreditCard className={className} />;
      case 'Building2':
      case 'Building':
        return <Building2 className={className} />;
      case 'Landmark':
        return <Landmark className={className} />;
      case 'BadgePercent':
      case 'Award':
        return <BadgePercent className={className} />;
      case 'Utensils':
        return <Utensils className={className} />;
      case 'ShieldCheck':
        return <ShieldCheck className={className} />;
      case 'Globe':
        return <Globe className={className} />;
      case 'ScrollText':
        return <ScrollText className={className} />;
      case 'FolderLock':
        return <FolderLock className={className} />;
      case 'FileSpreadsheet':
        return <FileSpreadsheet className={className} />;
      case 'Store':
        return <Store className={className} />;
      case 'ReceiptText':
      case 'Receipt':
        return <ReceiptText className={className} />;
      default:
        return <FileText className={className} />;
    }
  };

  const isSignedInCustomLanding = Boolean(isAuthenticated && user && roleLandingProfile && !showPublicOverview);

  return (
    <div className="space-y-14 lg:space-y-20 pb-16">
      {/* SIGNED-IN ROLE-SPECIFIC CUSTOM LANDING VIEW */}
      {isSignedInCustomLanding && user && roleLandingProfile ? (
        <>
          <RoleAdaptedLanding
            user={user}
            profile={roleLandingProfile}
            onNavigate={onNavigate}
            onApplyForService={onApplyForService}
          />

          {/* Compact Search + Storefront Toggle Bar for Signed-In Users */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {lang === 'hi' ? 'त्वरित सेवा खोज' : 'Quick Service Lookup'}
                </div>
                <button
                  type="button"
                  onClick={() => setShowPublicOverview(true)}
                  className="text-xs font-bold text-[#FF671F] hover:text-[#E55B1B] inline-flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'hi' ? 'पूर्ण पब्लिक होमपेज देखें' : 'View Full Public Storefront Overview'}
                  </span>
                </button>
              </div>

              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
                <input
                  type="text"
                  placeholder={t('hero.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-16 py-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-[#FF671F] focus:outline-none transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {searchSuggestions.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 text-xs">
                  <span className="text-slate-400 font-semibold px-1 py-1">Quick Match:</span>
                  {searchSuggestions.map((s) => (
                    <a
                      key={s.id}
                      href={buildUrlForRoute('service-detail', s.slug)}
                      onClick={(e) => handleAnchorNav(e, 'service-detail', s.slug)}
                      className="bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-950/70 text-[#FF671F] font-semibold px-3 py-1 rounded-lg transition inline-flex items-center gap-1"
                    >
                      <span>{s.name}</span>
                      <ArrowRight className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Digital Tools Tray Spotlight for Signed-In Users */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-br from-orange-50/90 via-white to-sky-50/80 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/35 border border-orange-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#FF671F] flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>{lang === 'hi' ? 'डिजिटल टूल्स ट्रे (150+ टूल्स)' : 'Digital Tools Tray (150+ Browser & AI Utilities)'}</span>
                  </div>
                  <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                    {lang === 'hi' ? 'दस्तावेज़, CSC फोटो, PDF और टैक्स टूल्स' : 'Instant PDF, CSC Photo Resize, OCR, QR & Tax Calculators'}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setTrayOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>{lang === 'hi' ? 'टूल्स ट्रे खोलें' : 'Open Tools Tray'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('tool-plans')}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] text-slate-800 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>{planDefinition.name}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { slug: 'image-size-kb-compressor', title: 'KB Compressor (20-50KB)', cat: 'CSC & Forms', color: 'border-orange-200/80 dark:border-orange-900/50 bg-orange-50/70 dark:bg-orange-950/25' },
                  { slug: 'passport-photo-print-sheet', title: 'Passport Photo Sheet', cat: 'Photo Studio · ₹10 Pass', color: 'border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/25' },
                  { slug: 'merge-pdf', title: 'Merge & Split PDF', cat: 'PDF Engine · Free', color: 'border-sky-200/80 dark:border-sky-900/50 bg-sky-50/70 dark:bg-sky-950/25' },
                  { slug: 'ai-document-summarizer', title: 'AI Document Assistant', cat: 'Gemini AI · ₹10 Pass', color: 'border-violet-200/80 dark:border-violet-900/50 bg-violet-50/70 dark:bg-violet-950/25' },
                ].map((tool) => (
                  <button
                    key={tool.slug}
                    type="button"
                    onClick={() => onNavigate('tool-detail', tool.slug)}
                    className={`p-3 rounded-xl border text-left hover:shadow-sm transition cursor-pointer ${tool.color}`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {tool.cat}
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 line-clamp-1">
                      {tool.title}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Direct Tracking Widget for quick DIP lookup */}
          <section className="max-w-4xl mx-auto px-4 sm:px-6">
            <TrackingWidget />
          </section>
        </>
      ) : (
        <>
          {/* Optional Return-to-Role Banner when signed-in user toggled Public Storefront view */}
          {isAuthenticated && user && roleLandingProfile && showPublicOverview && (
            <div className="bg-slate-900 text-white border-b border-slate-800">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span>
                  {lang === 'hi'
                    ? 'आप अभी पब्लिक स्टोरफ्रंट प्रीव्यू देख रहे हैं।'
                    : `Previewing Public Storefront · Signed in as ${user.name} (${user.role.replace('_', ' ')})`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPublicOverview(false)}
                  className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-3.5 py-1.5 rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {lang === 'hi' ? 'मेरा भूमिका होमपेज खोलें' : 'Return to My Custom Role Home'}
                </button>
              </div>
            </div>
          )}

          {/* SECTION 1: PUBLIC HERO (Clean Editorial Layout + Real Architectural Photography) */}
          <section className="relative overflow-hidden pt-10 pb-14 lg:pt-16 lg:pb-20 bg-gradient-to-br from-orange-50/80 via-[#FFFDF9] to-sky-50/70 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
                {/* Left Column: Crisp Typography & Focused CTAs */}
                <div className="lg:col-span-7 flex flex-col justify-center space-y-6 text-center lg:text-left">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF671F]">
                    {t('hero.badge')}
                  </div>

                  <div className="space-y-3">
                    <h1 className="text-3xl sm:text-4xl lg:text-[3.1rem] font-black text-[#202124] dark:text-white tracking-tight leading-[1.08] text-balance">
                      {lang === 'hi' ? 'आपकी डिजिटल सेवाएं, ' : 'Your Digital Services, '}
                      <span className="text-[#FF671F] underline decoration-[#FFC928] decoration-4 underline-offset-4">
                        {lang === 'hi' ? 'सरल और पारदर्शी।' : 'Simplified.'}
                      </span>
                    </h1>
                    <p className="text-base sm:text-lg font-medium text-slate-700 dark:text-slate-300 max-w-2xl mx-auto lg:mx-0">
                      {t('hero.subtitle')}
                    </p>
                  </div>

                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                    {t('hero.desc')}
                  </p>

                  {/* Focused Action Row: Compact on phones, full on desktop */}
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 sm:gap-3.5 pt-1">
                    <a
                      href={buildUrlForRoute('services')}
                      onClick={(e) => handleAnchorNav(e, 'services')}
                      className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs sm:text-sm px-4 py-2.5 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl shadow-sm hover:shadow-md transition inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0"
                    >
                      <span>{t('hero.explore')}</span>
                      <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </a>

                    <a
                      href={buildUrlForRoute('track')}
                      onClick={(e) => handleAnchorNav(e, 'track')}
                      className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm px-3.5 py-2.5 sm:px-5 sm:py-3 rounded-lg sm:rounded-xl transition inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0"
                    >
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF671F]" />
                      <span>{t('hero.track')}</span>
                    </a>
                  </div>

                  {/* Clean Metric Strip */}
                  <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800 max-w-lg mx-auto lg:mx-0 text-left tabular-nums">
                    <div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                        {services.length}+
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Core Registrations
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-black text-[#138808] dark:text-emerald-400 font-mono">
                        100%
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Online Assisted
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-black text-[#FF671F] font-mono">₹0</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Hidden Charges
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Clean Editorial Office Visual */}
                <div className="lg:col-span-5 flex flex-col">
                  <div className="relative flex-1 min-h-[300px] lg:min-h-[420px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 shadow-md">
                    <img
                      src="/assets/aistudio/67f60cc6-8da5-4cba-8f4c-f4c92a61a357_002b61a3.png"
                      alt="Digital India Project online registration, document verification, secure payments, and application tracking overview"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                    <span>Silvassa Operations Center · Pan-India Online Desk</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Cashfree Verified</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: QUICK SEARCH */}
          <section className="max-w-5xl mx-auto px-4 sm:px-6 -mt-8 relative z-20">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-3 sm:p-4">
              <div className="relative flex items-center">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
                <input
                  type="text"
                  placeholder={t('hero.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#F7F8FA] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-16 py-3.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-950 focus:border-[#FF671F] focus:outline-none transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {searchSuggestions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 text-xs">
                  <span className="text-slate-400 font-semibold px-2 py-1">Quick Match:</span>
                  {searchSuggestions.map((s) => (
                    <a
                      key={s.id}
                      href={buildUrlForRoute('service-detail', s.slug)}
                      onClick={(e) => handleAnchorNav(e, 'service-detail', s.slug)}
                      className="bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 dark:hover:bg-orange-950 text-[#FF671F] font-semibold px-3 py-1 rounded-lg transition inline-flex items-center gap-1"
                    >
                      <span>{s.name}</span>
                      <ArrowRight className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* SECTION 3: INTERACTIVE CUSTOM ROLE SHOWCASE FOR GUESTS */}
          <GuestAudienceShowcase onNavigate={onNavigate} />

          {/* SECTION 4: QUICK ACCESS CARDS (Figma / Android compact 2x2 colorful blocks) */}
          <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              <a
                href={buildUrlForRoute('services')}
                onClick={(e) => {
                  trackInteraction('home', 'quick_access', 'browse_services', 'home');
                  handleAnchorNav(e, 'services');
                }}
                className="app-block p-2.5 sm:p-4 lg:p-5 bg-gradient-to-br from-orange-50/85 via-white to-amber-50/55 dark:from-orange-950/30 dark:via-slate-900 dark:to-slate-900 border border-orange-200/80 dark:border-orange-900/50 hover:border-[#FF671F] rounded-xl sm:rounded-2xl shadow-xs hover:shadow-md text-left group block"
              >
                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-orange-100 dark:bg-orange-950/70 text-[#E55B1B] dark:text-orange-400 group-hover:bg-[#FF671F] group-hover:text-white flex items-center justify-center group-hover:scale-105 transition mb-1.5 sm:mb-3">
                  <Layers className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
                <div className="text-[11px] sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#FF671F] transition line-clamp-1">
                  {t('quick.browse')}
                </div>
                <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 sm:mt-1 line-clamp-2 leading-tight sm:leading-normal">
                  Explore {services.length}+ digital registrations
                </p>
              </a>

              <a
                href={buildUrlForRoute('services')}
                onClick={(e) => {
                  trackInteraction('home', 'quick_access', 'quick_apply', 'home');
                  handleAnchorNav(e, 'services');
                }}
                className="app-block p-2.5 sm:p-4 lg:p-5 bg-gradient-to-br from-emerald-50/85 via-white to-teal-50/55 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-900/50 hover:border-[#138808] rounded-xl sm:rounded-2xl shadow-xs hover:shadow-md text-left group block"
              >
                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-[#138808] dark:text-emerald-400 group-hover:bg-[#138808] group-hover:text-white flex items-center justify-center group-hover:scale-105 transition mb-1.5 sm:mb-3">
                  <FileText className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
                <div className="text-[11px] sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#138808] dark:group-hover:text-emerald-400 transition line-clamp-1">
                  {t('quick.apply')}
                </div>
                <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 sm:mt-1 line-clamp-2 leading-tight sm:leading-normal">
                  Start hassle-free online form filing
                </p>
              </a>

              <a
                href={buildUrlForRoute('track')}
                onClick={(e) => {
                  trackInteraction('home', 'quick_access', 'track_status', 'home');
                  handleAnchorNav(e, 'track');
                }}
                className="app-block p-2.5 sm:p-4 lg:p-5 bg-gradient-to-br from-sky-50/85 via-white to-blue-50/55 dark:from-sky-950/30 dark:via-slate-900 dark:to-slate-900 border border-sky-200/80 dark:border-sky-900/50 hover:border-blue-500 rounded-xl sm:rounded-2xl shadow-xs hover:shadow-md text-left group block"
              >
                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-sky-100 dark:bg-sky-950/70 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center group-hover:scale-105 transition mb-1.5 sm:mb-3">
                  <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
                <div className="text-[11px] sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition line-clamp-1">
                  {t('quick.track')}
                </div>
                <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 sm:mt-1 line-clamp-2 leading-tight sm:leading-normal">
                  Check live status with Application ID
                </p>
              </a>

              <a
                href={buildUrlForRoute('become-partner')}
                onClick={(e) => {
                  trackInteraction('home', 'quick_access', 'become_partner', 'home');
                  handleAnchorNav(e, 'become-partner');
                }}
                className="app-block p-2.5 sm:p-4 lg:p-5 bg-gradient-to-br from-violet-50/85 via-white to-indigo-50/55 dark:from-violet-950/30 dark:via-slate-900 dark:to-slate-900 border border-violet-200/80 dark:border-violet-900/50 hover:border-violet-500 rounded-xl sm:rounded-2xl shadow-xs hover:shadow-md text-left group block"
              >
                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-violet-100 dark:bg-violet-950/70 text-violet-700 dark:text-violet-400 group-hover:bg-violet-600 group-hover:text-white flex items-center justify-center group-hover:scale-105 transition mb-1.5 sm:mb-3">
                  <UserCheck className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
                <div className="text-[11px] sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-400 transition line-clamp-1">
                  Become Our Partner
                </div>
                <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 sm:mt-1 line-clamp-2 leading-tight sm:leading-normal">
                  Operator, Distributor &amp; B2B program
                </p>
              </a>
            </div>
          </section>

          {/* SECTION 4B: DIGITAL TOOLS TRAY (150+ UTILITIES + FREE & PAID PLANS) */}
          <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-br from-orange-50/85 via-white to-indigo-50/65 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 border border-orange-200/80 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-xs space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#FF671F]">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Integrated Digital Tools Tray · 150+ Browser &amp; AI Utilities</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Prepare Documents, Resize CSC Photos &amp; Calculate Taxes Instantly
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
                    Built-in PDF tools, passport photo sheets, 20KB–50KB signature resizers, QR/Barcode studio, GST/EMI calculators, OCR scanner, and AI document helpers with Free &amp; Paid plans.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      trackInteraction('home', 'open_tools_tray', 'quick_drawer', 'home');
                      setTrayOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Open Quick Tools Tray</span>
                  </button>
                  <a
                    href={buildUrlForRoute('tools')}
                    onClick={(e) => handleAnchorNav(e, 'tools')}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <span>Browse All 150 Tools</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={buildUrlForRoute('tool-plans')}
                    onClick={(e) => handleAnchorNav(e, 'tool-plans')}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-[#FF671F] text-slate-800 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>₹10 Pass &amp; Pro Plans ({planDefinition.name.split(' ')[0]})</span>
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
                {[
                  {
                    slug: 'merge-pdf',
                    title: 'Merge & Split PDF',
                    badge: 'FREE',
                    icon: FileText,
                    card: 'from-rose-50/90 to-white dark:from-rose-950/30 dark:to-slate-900 border-rose-200/80 dark:border-rose-900/50',
                    iconColor: 'text-rose-600 dark:text-rose-400',
                  },
                  {
                    slug: 'image-size-kb-compressor',
                    title: 'KB Image Resizer',
                    badge: 'FREE',
                    icon: FileSpreadsheet,
                    card: 'from-orange-50/90 to-white dark:from-orange-950/30 dark:to-slate-900 border-orange-200/80 dark:border-orange-900/50',
                    iconColor: 'text-[#FF671F]',
                  },
                  {
                    slug: 'passport-photo-print-sheet',
                    title: 'Passport Photo Sheet',
                    badge: '₹10 / CSC',
                    icon: UserCheck,
                    card: 'from-emerald-50/90 to-white dark:from-emerald-950/30 dark:to-slate-900 border-emerald-200/80 dark:border-emerald-900/50',
                    iconColor: 'text-[#138808] dark:text-emerald-400',
                  },
                  {
                    slug: 'upi-qr-generator',
                    title: 'UPI QR & Barcode',
                    badge: 'FREE',
                    icon: QrCode,
                    card: 'from-sky-50/90 to-white dark:from-sky-950/30 dark:to-slate-900 border-sky-200/80 dark:border-sky-900/50',
                    iconColor: 'text-sky-600 dark:text-sky-400',
                  },
                  {
                    slug: 'gst-calculator',
                    title: 'GST & EMI Calculators',
                    badge: 'FREE',
                    icon: Calculator,
                    card: 'from-amber-50/90 to-white dark:from-amber-950/30 dark:to-slate-900 border-amber-200/80 dark:border-amber-900/50',
                    iconColor: 'text-amber-600 dark:text-amber-400',
                  },
                  {
                    slug: 'ai-document-summarizer',
                    title: 'AI Doc Summarizer',
                    badge: '₹10 / PRO',
                    icon: Sparkles,
                    card: 'from-violet-50/90 to-white dark:from-violet-950/30 dark:to-slate-900 border-violet-200/80 dark:border-violet-900/50',
                    iconColor: 'text-violet-600 dark:text-violet-400',
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.slug}
                      href={buildUrlForRoute('tool-detail', item.slug)}
                      onClick={(e) => handleAnchorNav(e, 'tool-detail', item.slug)}
                      className={`p-3 rounded-xl bg-gradient-to-br border hover:border-[#FF671F] hover:shadow-sm transition flex flex-col justify-between gap-2 ${item.card}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <Icon className={`w-4 h-4 ${item.iconColor}`} />
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white/90 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700">
                          {item.badge}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                        {item.title}
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SECTION 5: POPULAR SERVICES */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
              <div>
                <div className="text-xs font-bold text-[#FF671F] uppercase tracking-wider mb-1">
                  Complete Online Facilitation
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {t('sec.popularServices')}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {t('sec.popularSub')}
                </p>
              </div>

              <a
                href={buildUrlForRoute('services')}
                onClick={(e) => handleAnchorNav(e, 'services')}
                className="text-xs font-bold text-[#FF671F] hover:text-[#E55B1B] inline-flex items-center gap-1 self-start md:self-auto whitespace-nowrap shrink-0"
              >
                <span>View Full Services Catalogue</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            {/* Category Filter Strip (compact chips on phone/tablet, wrapped on desktop) */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none pb-2 lg:flex-wrap mb-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  trackInteraction('home', 'category_filter', 'all', 'home');
                }}
                className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#FF671F]'
                }`}
              >
                All Services
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.slug);
                    trackInteraction('home', 'category_filter', cat.slug, 'home');
                  }}
                  className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedCategory === cat.slug
                      ? 'bg-[#FF671F] text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#FF671F]'
                  }`}
                >
                  {lang === 'hi' ? cat.nameHi : cat.name}
                </button>
              ))}
            </div>

            {/* Dynamic Service Cards Grid (2-col compact colorful e-commerce app layout on phone/tablet) */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4 lg:gap-5">
              {filteredServices.map((service) => {
                const theme = getServiceCardTheme(service.category, service.productType);
                return (
                <div
                  key={service.id}
                  className={`app-card rounded-xl sm:rounded-2xl border shadow-2xs hover:shadow-md flex flex-col justify-between overflow-hidden group ${theme.card}`}
                >
                  <div className="p-2.5 sm:p-4 lg:p-5 space-y-1.5 sm:space-y-2.5">
                    <div className="flex items-center justify-between gap-1">
                      <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl border flex items-center justify-center shrink-0 transition ${theme.iconBox}`}>
                        {renderServiceIcon(
                          service.iconName,
                          `w-3.5 h-3.5 sm:w-4 sm:h-4 transition ${theme.iconColor}`
                        )}
                      </div>

                      <AppCardStatusBadge service={service} lang={lang} />
                    </div>

                    <div>
                      <div className={`text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider truncate ${theme.categoryLabel}`}>
                        {service.category.replace(/-/g, ' ')}
                      </div>
                      <h3 className="text-[11px] sm:text-sm lg:text-base font-bold text-slate-900 dark:text-white group-hover:text-[#FF671F] transition line-clamp-1 leading-tight">
                        {service.name}
                      </h3>
                      {service.nameHi && (
                        <div className="text-[9.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium line-clamp-1">
                          {service.nameHi}
                        </div>
                      )}
                    </div>

                    <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-snug sm:leading-relaxed">
                      {lang === 'hi' && service.shortDescHi ? service.shortDescHi : service.shortDesc}
                    </p>

                    <div className={`pt-1.5 sm:pt-2 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 sm:gap-1 text-xs tabular-nums ${theme.divider}`}>
                      <div>
                        <span className="text-[8.5px] sm:text-[10px] text-slate-500 dark:text-slate-400 block">
                          {service.isCustomQuote ? 'Pricing Model' : 'Fee'}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white text-[11px] sm:text-sm font-mono">
                          {formatServicePriceLabel(service)}
                        </span>
                        {service.govtFees > 0 && (
                          <span className="hidden sm:inline text-[10px] text-slate-500 dark:text-slate-400 ml-1">
                            (+₹{service.govtFees})
                          </span>
                        )}
                      </div>

                      <div className="sm:text-right">
                        <span className="hidden sm:block text-[10px] text-slate-500 dark:text-slate-400">Est. Time</span>
                        <span className="text-[9.5px] sm:text-[11px] font-semibold text-[#138808] dark:text-emerald-400 line-clamp-1">
                          {service.estimatedTime}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={`border-t px-2.5 sm:px-4 lg:px-5 py-1.5 sm:py-2.5 flex items-center justify-between gap-1 ${theme.footer}`}>
                    <a
                      href={buildUrlForRoute('service-detail', service.slug)}
                      onClick={(e) => {
                        trackInteraction('service', 'view_details', service.slug, 'home');
                        handleAnchorNav(e, 'service-detail', service.slug);
                      }}
                      className="text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#FF671F] dark:hover:text-orange-400 hover:underline underline-offset-2 transition truncate"
                    >
                      <span className="hidden sm:inline">{t('common.viewDetails')}</span>
                      <span className="sm:hidden">Details</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        trackInteraction('service', 'apply_click', service.slug, 'home');
                        if (service.isCustomQuote) {
                          onNavigate('service-detail', service.slug);
                        } else {
                          onApplyForService(service);
                        }
                      }}
                      className="bg-[#FF671F] hover:bg-[#E55B1B] text-white text-[10px] sm:text-xs font-bold px-2 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg shadow-2xs hover:shadow-xs transition inline-flex items-center gap-0.5 sm:gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>
                        {service.productType === 'digital_product'
                          ? 'Buy'
                          : service.isCustomQuote
                          ? 'Quote'
                          : t('common.applyNow')}
                      </span>
                      <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 6: BROWSE BY CATEGORIES */}
          <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
            <div>
              <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-10 space-y-1">
                <div className="text-xs font-bold text-[#FF671F] uppercase tracking-wider">
                  Organized Portfolios ({activeServices.length} Services &amp; Kits)
                </div>
                <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {t('sec.categories')}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Browse services tailored specifically for individuals, startups, or operating enterprises.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                {categories.map((cat) => {
                  const catCount = activeServices.filter((s) => s.category === cat.slug).length;
                  const catTheme = getServiceCardTheme(cat.slug);
                  return (
                    <a
                      key={cat.id}
                      href={buildUrlForRoute('services', cat.slug)}
                      onClick={(e) => {
                        trackInteraction('home', 'category_card', cat.slug, 'home');
                        handleAnchorNav(e, 'services', cat.slug);
                      }}
                      className={`app-block p-2.5 sm:p-4 lg:p-5 border rounded-xl sm:rounded-2xl shadow-xs hover:shadow-md text-left group block ${catTheme.card}`}
                    >
                      <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                        <div
                          className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition"
                          style={{
                            backgroundColor: `${cat.badgeColor || '#FF671F'}1A`,
                            color: cat.badgeColor || '#FF671F',
                          }}
                        >
                          {renderServiceIcon(cat.iconName, 'w-3.5 h-3.5 sm:w-5 sm:h-5')}
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/70 px-1.5 py-0.5 rounded-md border border-slate-200/70 dark:border-slate-700/70">
                          {catCount}
                        </span>
                      </div>
                      <h3 className="text-[11px] sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#FF671F] transition line-clamp-1">
                        {lang === 'hi' ? cat.nameHi : cat.name}
                      </h3>
                      <p className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 sm:mt-1 line-clamp-2 leading-tight sm:leading-relaxed">
                        {cat.description}
                      </p>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Value Packages & Digital Products Spotlight */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-gradient-to-br from-emerald-50/75 via-white to-teal-50/50 dark:from-emerald-950/25 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#138808] dark:text-emerald-400">
                      Bundled Compliance Value
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Startup &amp; Compliance Packages
                    </h3>
                  </div>
                  <a
                    href="/packages"
                    onClick={(e) => handleAnchorNav(e, 'packages')}
                    className="text-xs font-bold text-[#FF671F] hover:underline flex items-center gap-1"
                  >
                    <span>All Packages</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {packages.slice(0, 4).map((pkg) => (
                    <a
                      key={pkg.id}
                      href={`/packages/${pkg.slug}`}
                      onClick={(e) => handleAnchorNav(e, 'service-detail', pkg.slug)}
                      className="p-4 rounded-xl bg-white/90 dark:bg-slate-800/70 border border-emerald-200/70 dark:border-emerald-900/45 hover:border-[#FF671F] transition flex flex-col justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                            {pkg.name}
                          </span>
                          {(pkg.packageSavingsInr || 0) > 0 && (
                            <span className="text-[10px] font-bold text-[#138808] bg-emerald-100/80 dark:bg-emerald-950/70 px-2 py-0.5 rounded shrink-0">
                              Save ₹{pkg.packageSavingsInr}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                          {pkg.shortDesc}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs font-mono font-bold pt-1">
                        <span className="text-[#FF671F]">₹{pkg.serviceCharge}</span>
                        <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400">
                          {pkg.includedServiceIds?.length || 0} included services
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 bg-gradient-to-br from-sky-50/80 via-white to-indigo-50/50 dark:from-sky-950/25 dark:via-slate-900 dark:to-slate-900 border border-sky-200/80 dark:border-sky-900/50 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                      Instant Download Toolkits
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Digital Products Store
                    </h3>
                  </div>
                  <a
                    href="/products"
                    onClick={(e) => handleAnchorNav(e, 'products')}
                    className="text-xs font-bold text-[#FF671F] hover:underline flex items-center gap-1"
                  >
                    <span>Browse All</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="space-y-2.5">
                  {digitalProductsSpotlight.map((prod) => (
                    <a
                      key={prod.id}
                      href={`/products/${prod.slug}`}
                      onClick={(e) => handleAnchorNav(e, 'service-detail', prod.slug)}
                      className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/70 border border-sky-200/70 dark:border-sky-900/45 hover:border-[#FF671F] transition flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {prod.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {prod.digitalAsset?.fileFormat || 'Bundle Pack'} · {prod.estimatedTime}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-xs text-[#138808] dark:text-emerald-400 shrink-0">
                        {formatServicePriceLabel(prod)}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Regional Presence Strip */}
            <div className="bg-gradient-to-r from-orange-50/75 via-white to-emerald-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/30 border border-orange-200/70 dark:border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#FF671F]">
                  Regional Headquarters &amp; Pan-India Online Desk
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Serving Silvassa, Dadra &amp; Nagar Haveli, Daman, Vapi, Valsad &amp; Umargam
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Dedicated local industrial GIDC &amp; citizen assistance pages with transparent fee schedules.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {TARGET_LOCATIONS.map((loc) => (
                  <a
                    key={loc.slug}
                    href={`/locations/${loc.slug}`}
                    onClick={(e) => handleAnchorNav(e, 'location', loc.slug)}
                    className="px-3 py-1.5 rounded-lg bg-white/95 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#FF671F] transition"
                  >
                    {loc.name}
                  </a>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 7: OPERATOR PARTNER NETWORK & ENTERPRISE B2B SHOWCASE */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs grid grid-cols-1 lg:grid-cols-12 items-stretch">
              <div className="lg:col-span-5 min-h-[280px] bg-slate-100 dark:bg-slate-800">
                <img
                  src={operatorKendraImg}
                  alt="Digital India Project operator desk assisting citizen applicant"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="lg:col-span-7 p-8 sm:p-12 flex flex-col justify-center space-y-5">
                <div className="text-xs font-bold uppercase tracking-wider text-[#138808] dark:text-emerald-400">
                  Partner Facilitation Centers & Enterprise API
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight text-balance">
                  Collect & Verify Applications From Every District Center
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                  Local digital consultancy centers can enroll via structured PAN, masked Aadhaar, and bank KYC to unlock an Operator Desk for walk-in citizen submissions. Registered firms can also access bulk GSTIN, PAN, and Udyam API Setu pipelines via our B2B Enterprise Portal.
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1">
                  <a
                    href={buildUrlForRoute('become-partner')}
                    onClick={(e) => handleAnchorNav(e, 'become-partner')}
                    className="bg-[#138808] hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-3.5 py-2 sm:px-5 sm:py-3 rounded-lg sm:rounded-xl shadow-xs transition inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0"
                  >
                    <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Become Our Partner</span>
                    <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </a>

                  <a
                    href={buildUrlForRoute('become-partner', 'business')}
                    onClick={(e) => handleAnchorNav(e, 'become-partner', 'business')}
                    className="bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm px-3.5 py-2 sm:px-5 sm:py-3 rounded-lg sm:rounded-xl transition inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0"
                  >
                    <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF671F]" />
                    <span>B2B &amp; Distributor Plans</span>
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 8: HOW IT WORKS */}
          <section className="bg-gradient-to-br from-slate-50/90 via-white/95 to-sky-50/75 dark:from-slate-900/95 dark:via-slate-900 dark:to-slate-950 border-y border-slate-200 dark:border-slate-800 py-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-12 space-y-1">
                <div className="text-xs font-bold text-[#138808] dark:text-emerald-400 uppercase tracking-wider">
                  Transparent Workflow
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {t('sec.howItWorks')}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Four straightforward steps from service discovery to completed document issuance.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-6 relative">
                <div className="app-block bg-gradient-to-br from-orange-50/90 via-white to-amber-50/60 dark:from-orange-950/30 dark:via-slate-950 dark:to-slate-950 border border-orange-200/80 dark:border-orange-900/50 rounded-2xl p-4 sm:p-6 space-y-2 sm:space-y-3">
                  <span className="text-xl sm:text-2xl font-black text-[#FF671F] font-mono tabular-nums">01</span>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Choose Your Service</h3>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Select from our active digital services. Read eligibility prerequisites, required documents checklist, and transparent fee breakdown.
                  </p>
                </div>

                <div className="app-block bg-gradient-to-br from-amber-50/90 via-white to-yellow-50/60 dark:from-amber-950/30 dark:via-slate-950 dark:to-slate-950 border border-amber-200/80 dark:border-amber-900/50 rounded-2xl p-4 sm:p-6 space-y-2 sm:space-y-3">
                  <span className="text-xl sm:text-2xl font-black text-[#D97706] font-mono tabular-nums">02</span>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Submit Application &amp; Docs</h3>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Fill the dynamic application form online or at an Operator Desk. Upload scanned identity proofs into encrypted storage.
                  </p>
                </div>

                <div className="app-block bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60 dark:from-emerald-950/30 dark:via-slate-950 dark:to-slate-950 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl p-4 sm:p-6 space-y-2 sm:space-y-3">
                  <span className="text-xl sm:text-2xl font-black text-[#138808] dark:text-emerald-400 font-mono tabular-nums">
                    03
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Complete Payment</h3>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Pay securely via Cashfree Payments using UPI, NetBanking, or Credit/Debit card with instant automated receipt generation.
                  </p>
                </div>

                <div className="app-block bg-gradient-to-br from-sky-50/90 via-white to-blue-50/60 dark:from-sky-950/30 dark:via-slate-950 dark:to-slate-950 border border-sky-200/80 dark:border-sky-900/50 rounded-2xl p-4 sm:p-6 space-y-2 sm:space-y-3">
                  <span className="text-xl sm:text-2xl font-black text-[#2563EB] dark:text-blue-400 font-mono tabular-nums">
                    04
                  </span>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Track &amp; Receive Updates</h3>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Monitor your application ID in real time. Our verification desk files the paperwork and delivers final certificates to your portal.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 9: WHY DIGITAL INDIA PROJECT? */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-4">
                <div className="text-xs font-bold text-[#FF671F] uppercase tracking-wider">
                  Client Trust & Performance
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {t('sec.whyUs')}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Applying for registrations on multiple portals can involve complex documentation rules and rejection risks. Digital India Project bridges this gap through structured review, end-to-end assistance, and dedicated customer support.
                </p>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="app-block p-4 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/45 dark:from-emerald-950/25 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-900/50 rounded-xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <CheckCircle2 className="w-4 h-4 text-[#138808]" />
                    <span>Error-Free Form Filing</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Our verification desk checks names, spellings, and proofs before portal submission to reduce rejection notices.
                  </p>
                </div>

                <div className="app-block p-4 bg-gradient-to-br from-orange-50/80 via-white to-amber-50/45 dark:from-orange-950/25 dark:via-slate-900 dark:to-slate-900 border border-orange-200/80 dark:border-orange-900/50 rounded-xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Lock className="w-4 h-4 text-[#FF671F]" />
                    <span>Encrypted Document Vault</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Private cloud storage with strict access rules ensures your identity credentials remain protected.
                  </p>
                </div>

                <div className="app-block p-4 bg-gradient-to-br from-amber-50/80 via-white to-yellow-50/45 dark:from-amber-950/25 dark:via-slate-900 dark:to-slate-900 border border-amber-200/80 dark:border-amber-900/50 rounded-xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Award className="w-4 h-4 text-[#D97706]" />
                    <span>100% Transparent Fees</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Clear breakdown between our professional facilitation charge and statutory government fees.
                  </p>
                </div>

                <div className="app-block p-4 bg-gradient-to-br from-sky-50/80 via-white to-blue-50/45 dark:from-sky-950/25 dark:via-slate-900 dark:to-slate-900 border border-sky-200/80 dark:border-sky-900/50 rounded-xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Headphones className="w-4 h-4 text-[#2563EB]" />
                    <span>Bilingual Support Desk</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Assistance in English and Hindi backed by real operations officers in Silvassa.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 10: INTERACTIVE APPLICATION TRACKING */}
          <section className="max-w-4xl mx-auto px-4 sm:px-6">
            <TrackingWidget />
          </section>

          {/* SECTION 11: CLIENT EXPERIENCES */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10 space-y-1">
              <div className="text-xs font-bold text-[#FF671F] uppercase tracking-wider">
                Verified Experiences
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {t('sec.testimonials')}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-gradient-to-br from-orange-50/75 via-white to-amber-50/40 dark:from-orange-950/25 dark:via-slate-900 dark:to-slate-900 border border-orange-200/75 dark:border-orange-900/50 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center gap-1 text-[#FFC928]">{'★★★★★'}</div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  "Needed Udyam MSME and GST for my new consulting firm. The Digital India Project team reviewed my electricity bill, caught an address discrepancy, and got my certificate issued within 48 hours without hassle."
                </p>
                <div className="pt-2 border-t border-orange-100 dark:border-orange-900/40 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/60 text-[#FF671F] font-bold text-xs flex items-center justify-center">
                    M
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Manish Verma</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Founder, CloudKraft Technologies, Bengaluru
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gradient-to-br from-emerald-50/75 via-white to-teal-50/40 dark:from-emerald-950/25 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/75 dark:border-emerald-900/50 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center gap-1 text-[#FFC928]">{'★★★★★'}</div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  "I struggled for weeks trying to update my surname in official records after marriage. Their Gazette name change package handled the affidavit drafting and central publication cleanly."
                </p>
                <div className="pt-2 border-t border-emerald-100 dark:border-emerald-900/40 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-emerald-950/60 text-[#138808] dark:text-emerald-400 font-bold text-xs flex items-center justify-center">
                    P
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Pooja Deshmukh</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">Educator, Pune</div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gradient-to-br from-sky-50/75 via-white to-blue-50/40 dark:from-sky-950/25 dark:via-slate-900 dark:to-slate-900 border border-sky-200/75 dark:border-sky-900/50 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center gap-1 text-[#FFC928]">{'★★★★★'}</div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  "Securing corporate compliance verification required matching MCA paperwork. Their operations desk audited our filings and tracked every stage to completion."
                </p>
                <div className="pt-2 border-t border-sky-100 dark:border-sky-900/40 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center">
                    R
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">Rohit Chawla</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Product Lead, Finpulse Mobility, Gurugram
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 12: FAQS */}
          <section className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-8 space-y-1">
              <div className="text-xs font-bold text-[#FF671F] uppercase tracking-wider">
                Clear Answers
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {t('sec.faqs')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Common questions regarding our private assistance services, pricing, and tracking.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Is Digital India Project a government portal or official authority?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  No. Digital India Project is an independent, privately operated digital registration consultancy. We assist individuals and businesses with paperwork, online form filings, and liaison. All official approvals are governed solely by respective statutory departments.
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  How do I track my online or walk-in application?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Every submission across our Web Portal, Operator Centers, or B2B desk generates a unique Application ID (e.g., DIP-2026-XXXXX). Enter that ID along with your registered mobile or email in the tracker above for real-time timeline updates.
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  How do I become a verified Operator Partner?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Visit our Operator Partner Enrollment page, sign up, and upload your PAN, masked Aadhaar, bank proof, and center photograph. Once approved by our compliance admins, your account unlocks the Operator Intake & Verification Desk.
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  What payment methods are supported?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  We support Cashfree Payments across Indian UPI apps (PhonePe, Google Pay, Paytm, BHIM), NetBanking, and major Credit and Debit cards, plus Operator Desk receipts for walk-in applicants.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 13: CTA BANNER */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-r from-[#202124] to-[#111827] rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-xl">
              <div className="max-w-2xl relative z-10 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#FFC928]">
                  Online Application Desk
                </span>
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight">{t('sec.ctaTitle')}</h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{t('sec.ctaDesc')}</p>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2">
                  <a
                    href={buildUrlForRoute('services')}
                    onClick={(e) => handleAnchorNav(e, 'services')}
                    className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs sm:text-sm px-4 py-2 sm:px-6 sm:py-3 rounded-lg sm:rounded-xl shadow-md transition inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0"
                  >
                    <span>{t('hero.explore')}</span>
                    <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </a>

                  <a
                    href={buildUrlForRoute('contact')}
                    onClick={(e) => handleAnchorNav(e, 'contact')}
                    className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm px-3.5 py-2 sm:px-5 sm:py-3 rounded-lg sm:rounded-xl border border-white/20 transition inline-flex items-center whitespace-nowrap shrink-0"
                  >
                    <span>Contact Support</span>
                  </a>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

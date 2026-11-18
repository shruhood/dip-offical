import React, { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  Globe2,
  Search,
  CheckCircle2,
  ArrowRight,
  Building2,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  FileText,
  Sparkles,
  Landmark,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import {
  INDIA_GEOGRAPHY_SEED,
  IndiaLocationRecord,
  IndiaRegionZone,
  getStatesCountSummary,
} from '../data/indiaGeography';
import {
  SUPPORTED_INDIAN_LANGUAGES,
  SupportedLanguageCode,
} from '../data/indianLanguages';
import {
  DirectorySeoPackage,
  DirectoryTranslationRecord,
  buildDirectoryMetaAndJsonLd,
  buildIndiaDirectoryPath,
  parseIndiaDirectoryPath,
  resolveHierarchyChain,
} from '../lib/indiaDirectorySeo';
import { calculateOrderTotalsPaise, fromPaise } from '../lib/finance';
import type { Service } from '../types';

interface IndiaDirectoryPageProps {
  directoryPath: string;
  onNavigate: (route: string, param?: string) => void;
  onApplyForService: (service: Service) => void;
}

interface SsrDirectoryBootstrap {
  canonicalPath: string;
  lang: SupportedLanguageCode;
  location: IndiaLocationRecord;
  hierarchy: {
    state: IndiaLocationRecord | null;
    district: IndiaLocationRecord | null;
    city: IndiaLocationRecord | null;
  };
  childLocations: IndiaLocationRecord[];
  siblingLocations: IndiaLocationRecord[];
  translation: DirectoryTranslationRecord | null;
  seo: Partial<DirectorySeoPackage>;
}

const REGION_ZONES: ('All' | IndiaRegionZone)[] = [
  'All',
  'North India',
  'West India',
  'South India',
  'East India',
  'Central India',
  'Northeast India',
  'Island Territories',
];

function readSsrBootstrap(expectedPath: string): SsrDirectoryBootstrap | null {
  if (typeof document === 'undefined') return null;
  try {
    const el = document.getElementById('__DIP_DIR_SSR_DATA__');
    if (!el?.textContent) return null;
    const parsed = JSON.parse(el.textContent) as SsrDirectoryBootstrap;
    if (
      parsed &&
      parsed.canonicalPath &&
      parsed.canonicalPath.toLowerCase() === expectedPath.toLowerCase()
    ) {
      return parsed;
    }
  } catch {
    // Fallback cleanly to seed + API resolution
  }
  return null;
}

export const IndiaDirectoryPage: React.FC<IndiaDirectoryPageProps> = ({
  directoryPath,
  onNavigate,
  onApplyForService,
}) => {
  const { services } = useData();
  const { lang, setLang } = useLanguage();

  const parsedRoute = useMemo(
    () => parseIndiaDirectoryPath(directoryPath || '/india'),
    [directoryPath]
  );

  const activeLang: SupportedLanguageCode = parsedRoute.langPrefixExplicit
    ? parsedRoute.lang
    : lang;

  useEffect(() => {
    if (parsedRoute.langPrefixExplicit && parsedRoute.lang !== lang) {
      setLang(parsedRoute.lang);
    }
  }, [parsedRoute.langPrefixExplicit, parsedRoute.lang, lang, setLang]);

  const [locations, setLocations] = useState<IndiaLocationRecord[]>(INDIA_GEOGRAPHY_SEED);
  const [translation, setTranslation] = useState<DirectoryTranslationRecord | null>(null);
  const [zoneFilter, setZoneFilter] = useState<'All' | IndiaRegionZone>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [loadingRemote, setLoadingRemote] = useState(false);

  // Hydrate from SSR payload first & fetch any updated D1 records + localized translation
  useEffect(() => {
    let active = true;
    const ssrData = readSsrBootstrap(parsedRoute.canonicalDirectoryPath);
    if (ssrData) {
      if (ssrData.translation) setTranslation(ssrData.translation);
      if (ssrData.location) {
        setLocations((prev) => {
          const map = new Map(prev.map((l) => [l.canonicalPath.toLowerCase(), l]));
          map.set(ssrData.location.canonicalPath.toLowerCase(), ssrData.location);
          (ssrData.childLocations || []).forEach((child) => {
            if (child.canonicalPath) {
              const existing = map.get(child.canonicalPath.toLowerCase());
              map.set(child.canonicalPath.toLowerCase(), {
                ...(existing || {}),
                ...child,
              } as IndiaLocationRecord);
            }
          });
          return Array.from(map.values());
        });
      }
    }

    const loadDirectoryNode = async () => {
      setLoadingRemote(true);
      try {
        const res = await fetch(
          `/api/directory/resolve?path=${encodeURIComponent(
            parsedRoute.canonicalDirectoryPath
          )}&lang=${encodeURIComponent(activeLang)}`
        );
        if (!active || !res.ok) return;
        const json = await res.json();
        const data = json?.data;
        if (!active || !data) return;
        if (data.translation) {
          setTranslation(data.translation);
        } else {
          setTranslation(null);
        }
        if (data.location) {
          setLocations((prev) => {
            const map = new Map(prev.map((l) => [l.canonicalPath.toLowerCase(), l]));
            map.set(data.location.canonicalPath.toLowerCase(), data.location);
            (data.childLocations || []).forEach((c: IndiaLocationRecord) => {
              map.set(c.canonicalPath.toLowerCase(), c);
            });
            return Array.from(map.values());
          });
        }
      } catch {
        // Seed fallback already rendered cleanly
      } finally {
        if (active) setLoadingRemote(false);
      }
    };

    loadDirectoryNode();
    return () => {
      active = false;
    };
  }, [parsedRoute.canonicalDirectoryPath, activeLang]);

  const effectiveParsed = useMemo(
    () => ({ ...parsedRoute, lang: activeLang }),
    [parsedRoute, activeLang]
  );

  const hierarchy = useMemo(
    () => resolveHierarchyChain(effectiveParsed, locations),
    [effectiveParsed, locations]
  );

  const seoPkg = useMemo(
    () =>
      buildDirectoryMetaAndJsonLd({
        parsed: effectiveParsed,
        locations,
        translation,
        services,
      }),
    [effectiveParsed, locations, translation, services]
  );

  const countSummary = useMemo(() => getStatesCountSummary(), []);

  const filteredChildren = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return hierarchy.childLocations.filter((child) => {
      if (zoneFilter !== 'All' && child.regionZone !== zoneFilter) return false;
      if (!q) return true;
      return (
        child.name.toLowerCase().includes(q) ||
        child.lgdCode.toLowerCase().includes(q) ||
        child.pinCodes.toLowerCase().includes(q) ||
        (child.capital || '').toLowerCase().includes(q) ||
        Object.values(child.nativeNames || {}).some((n) => (n || '').toLowerCase().includes(q))
      );
    });
  }, [hierarchy.childLocations, zoneFilter, searchQuery]);

  const directoryServices = useMemo(() => {
    const loc = hierarchy.current;
    const active = services.filter((s) => s.published !== false);
    if (!loc) return active.slice(0, 8);
    const highlighted = active.filter((s) => loc.highlightedServiceSlugs.includes(s.slug));
    const extras = active.filter(
      (s) => !loc.highlightedServiceSlugs.includes(s.slug) && s.popular
    );
    return [...highlighted, ...extras].slice(0, 9);
  }, [services, hierarchy.current]);

  const handleLanguageChange = (nextLang: SupportedLanguageCode) => {
    setLang(nextLang);
    const nextPath = buildIndiaDirectoryPath({
      lang: nextLang,
      stateSlug: hierarchy.state?.slug,
      districtSlug: hierarchy.district?.slug,
      citySlug: hierarchy.city?.slug,
    });
    onNavigate('india-directory', nextPath);
  };

  const navigateDirectory = (path: string) => {
    onNavigate('india-directory', path);
  };

  if (!seoPkg || !hierarchy.current) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 space-y-4">
          <MapPin className="w-10 h-10 text-[#FF671F] mx-auto" />
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Location Not Found in India Digital Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            The requested state, district, or city directory URL could not be resolved. Browse our complete directory of all 28 States and 8 Union Territories.
          </p>
          <button
            type="button"
            onClick={() => navigateDirectory(buildIndiaDirectoryPath({ lang: activeLang }))}
            className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
          >
            Open All-India Directory
          </button>
        </div>
      </div>
    );
  }

  const loc = hierarchy.current;
  const langMeta = seoPkg.langMeta;
  const isCountryView = loc.level === 'country';

  return (
    <div
      dir={langMeta.rtl ? 'rtl' : 'ltr'}
      lang={langMeta.hreflang}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8"
    >
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
      >
        {seoPkg.breadcrumbs.map((crumb, idx) => {
          const isLast = idx === seoPkg.breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.path}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              {isLast ? (
                <span className="font-bold text-slate-900 dark:text-white">{crumb.name}</span>
              ) : (
                <a
                  href={crumb.path}
                  onClick={(e) => {
                    e.preventDefault();
                    if (crumb.path === '/') onNavigate('home');
                    else navigateDirectory(crumb.path);
                  }}
                  className="hover:text-[#FF671F] transition-colors cursor-pointer"
                >
                  {crumb.name}
                </a>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Hero Section with Language Switcher & Verified LGD/Census Metadata */}
      <section className="relative overflow-hidden rounded-3xl bg-[#0F172A] text-white border border-slate-800 p-6 sm:p-8 lg:p-10 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-300">
              <Globe2 className="w-4 h-4 text-[#FF671F] shrink-0" />
              <span>{langMeta.copy.directoryLabel}</span>
              <span className="text-slate-500">·</span>
              <span className="text-emerald-400">
                {countSummary.states} States + {countSummary.uts} Union Territories
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              {seoPkg.headline}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{seoPkg.summary}</p>

            {/* Verified Government Reference Strip (inline metadata with mid-dot, no pill clutter) */}
            <div className="pt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-300 font-mono">
              <span className="inline-flex items-center gap-1 text-emerald-400 font-sans font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                {langMeta.copy.verifiedSourceLabel}
              </span>
              <span className="text-slate-600">·</span>
              <span>LGD: {loc.lgdCode}</span>
              {loc.isoCode && (
                <>
                  <span className="text-slate-600">·</span>
                  <span>ISO: {loc.isoCode}</span>
                </>
              )}
              {loc.censusCode && (
                <>
                  <span className="text-slate-600">·</span>
                  <span>Census: {loc.censusCode}</span>
                </>
              )}
              <span className="text-slate-600">·</span>
              <span>PIN: {loc.pinCodes}</span>
              {loc.capital && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="font-sans">Capital: {loc.capital}</span>
                </>
              )}
            </div>
          </div>

          {/* 23-Language Selector Card */}
          <div className="w-full lg:w-72 bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 space-y-2.5 shrink-0">
            <label
              htmlFor="dir-lang-select"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-300"
            >
              {langMeta.copy.languageLabel} (22 Scheduled + EN)
            </label>
            <select
              id="dir-lang-select"
              value={activeLang}
              onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguageCode)}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-xs font-semibold text-white cursor-pointer focus:border-[#FF671F] focus:outline-none"
            >
              {SUPPORTED_INDIAN_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName} — {l.nameEn} ({l.script})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 leading-snug">
              Active Locale: <span className="font-mono text-white">{langMeta.hreflang}</span>
              {loadingRemote ? ' · Syncing D1 translations...' : ''}
            </p>
          </div>
        </div>
      </section>

      {/* Child Sub-Locations Directory Grid */}
      {hierarchy.childLocations.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Landmark className="w-5 h-5 text-[#FF671F]" />
                <span>
                  {isCountryView
                    ? langMeta.copy.browseStates
                    : loc.level === 'district'
                    ? `${langMeta.copy.citiesHeading} (${hierarchy.childLocations.length})`
                    : `${langMeta.copy.districtsHeading} (${hierarchy.childLocations.length})`}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any verified State, Union Territory, District, or City to access local compliance schedules and fee breakdowns.
              </p>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search state, city, PIN, LGD code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs"
              />
            </div>
          </div>

          {isCountryView && (
            <div className="flex flex-wrap gap-1.5">
              {REGION_ZONES.map((zone) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => setZoneFilter(zone)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    zoneFilter === zone
                      ? 'bg-[#FF671F] text-white border-[#FF671F]'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#FF671F]/50'
                  }`}
                >
                  {zone}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredChildren.map((child) => {
              const childPath = buildIndiaDirectoryPath({
                lang: activeLang,
                stateSlug: child.stateSlug,
                districtSlug: child.districtSlug,
                citySlug: child.citySlug,
              });
              const displayName = child.nativeNames?.[activeLang] || child.name;
              return (
                <a
                  key={child.id}
                  href={childPath}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateDirectory(childPath);
                  }}
                  className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#FF671F] rounded-2xl p-4 transition-all shadow-2xs flex flex-col justify-between gap-2.5 cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider">
                      <span className="text-[#FF671F]">
                        {child.level === 'ut' ? 'Union Territory' : child.level}
                      </span>
                      <span className="font-mono text-slate-400">{child.lgdCode}</span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1 group-hover:text-[#FF671F] transition-colors">
                      {displayName}
                    </h3>
                    {displayName !== child.name && (
                      <div className="text-[11px] text-slate-500">{child.name}</div>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span className="truncate">
                      {child.capital ? `Cap: ${child.capital}` : `PIN: ${child.pinCodes}`}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#FF671F] shrink-0" />
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* Services & Transparent INR Fee Breakdown for This Location */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#138808]" />
              <span>{langMeta.copy.servicesHeading}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Itemized fee schedule for {loc.name} separating Professional Fee, Government Statutory Fee (0% GST), and applicable GST.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('services', 'all')}
            className="text-xs font-bold text-[#FF671F] hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>Explore Full 145+ Catalogue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {directoryServices.map((srv) => {
            const totals = calculateOrderTotalsPaise({
              serviceChargeInr: srv.serviceCharge,
              govtFeesInr: srv.govtFees || 0,
              thirdPartyFeesInr: srv.thirdPartyFees || 0,
              taxRateBps: srv.taxRateBps || 0,
            });
            const gstPct = ((srv.taxRateBps || 0) / 100).toFixed(0);
            const displayTitle = activeLang === 'hi' && srv.nameHi ? srv.nameHi : srv.name;
            return (
              <div
                key={srv.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-2xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span className="text-[#FF671F]">{srv.category.replace(/-/g, ' ')}</span>
                    <span>{srv.estimatedTime}</span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {displayTitle}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {srv.shortDesc}
                  </p>

                  {/* Transparent Statutory Pricing Summary */}
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1 text-[11px] tabular-nums">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>{langMeta.copy.profFeeLabel}</span>
                      <span className="font-mono font-semibold">
                        ₹{fromPaise(totals.serviceFeePaise)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>{langMeta.copy.govtFeeLabel} (0% GST)</span>
                      <span className="font-mono font-semibold">
                        ₹{fromPaise(totals.govtFeePaise + totals.thirdPartyFeePaise)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>
                        {langMeta.copy.gstLabel} ({gstPct}%)
                      </span>
                      <span className="font-mono">₹{fromPaise(totals.taxPaise)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>{langMeta.copy.totalPayableLabel}</span>
                      <span className="font-mono text-[#138808]">
                        {srv.isCustomQuote && srv.serviceCharge === 0
                          ? 'Custom Quote'
                          : `₹${fromPaise(totals.totalPaise)}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onApplyForService(srv)}
                    className="flex-1 bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold text-xs py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    {langMeta.copy.applyOnline}
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('service-detail', srv.slug)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#FF671F] cursor-pointer"
                  >
                    {langMeta.copy.viewDetails}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sibling Nearby Internal Links */}
      {hierarchy.siblingLocations.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#FF671F]" />
            <span>Nearby &amp; Related Directory Hubs</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {hierarchy.siblingLocations.map((sib) => {
              const sibPath = buildIndiaDirectoryPath({
                lang: activeLang,
                stateSlug: sib.stateSlug,
                districtSlug: sib.districtSlug,
                citySlug: sib.citySlug,
              });
              return (
                <a
                  key={sib.id}
                  href={sibPath}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateDirectory(sibPath);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  {sib.nativeNames?.[activeLang] || sib.name}
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick Links across All 23 Languages for Crawlers & Users */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#FF671F]" />
          <span>View {loc.name} Directory in All 22 Scheduled Indian Languages + English</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_INDIAN_LANGUAGES.map((l) => {
            const targetPath = buildIndiaDirectoryPath({
              lang: l.code,
              stateSlug: hierarchy.state?.slug,
              districtSlug: hierarchy.district?.slug,
              citySlug: hierarchy.city?.slug,
            });
            const isActive = l.code === activeLang;
            return (
              <a
                key={l.code}
                href={targetPath}
                hrefLang={l.hreflang}
                onClick={(e) => {
                  e.preventDefault();
                  handleLanguageChange(l.code);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#FF671F]'
                }`}
              >
                {l.nativeName}
              </a>
            );
          })}
        </div>
      </section>

      {/* FAQ Section matching Schema.org FAQPage */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
        <h2 className="text-base font-black text-slate-900 dark:text-white">
          {langMeta.copy.faqHeading}
        </h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {seoPkg.faqs.map((faq, idx) => {
            const isOpen = openFaqIdx === idx;
            return (
              <div key={idx} className="py-3">
                <button
                  type="button"
                  onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-3 text-left text-xs sm:text-sm font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Private Facilitation Disclaimer */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] dark:bg-slate-900 border border-[#F1E8D9] dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-[#FF671F] shrink-0 mt-0.5" />
        <p>{langMeta.copy.disclaimer}</p>
      </div>
    </div>
  );
};

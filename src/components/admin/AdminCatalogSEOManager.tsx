import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileCheck2,
  Globe,
  Monitor,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '../../services/firebase';
import { CANONICAL_ORIGIN } from '../../lib/siteUrls';
import { getServiceSeoMetadata } from '../../lib/seoData';
import { mapCatalogServiceToFirestoreRecord } from '../../lib/catalogueSync';
import {
  buildSitemapXml,
  computeSitemapHealthSummary,
  parseSitemapXmlStats,
  type ParsedSitemapXmlStats,
} from '../../lib/blogSeo';
import { INDIA_GEOGRAPHY_SEED } from '../../data/indiaGeography';
import { evaluateDirectoryPageQuality } from '../../lib/indiaDirectorySeo';
import type { Service } from '../../types';

interface SitemapFetchState {
  loading: boolean;
  error: string | null;
  lastCheckedAt: string | null;
  httpLastModified: string | null;
  httpGeneratedAt: string | null;
  sourceLabel: string;
  stats: ParsedSitemapXmlStats | null;
  rawXml: string;
}

function getTitleStatus(len: number): { label: string; toneClass: string } {
  if (len === 0) {
    return {
      label: 'Missing Title',
      toneClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    };
  }
  if (len < 30) {
    return {
      label: 'Too Short (<30)',
      toneClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    };
  }
  if (len <= 60) {
    return {
      label: 'Optimal SERP Length',
      toneClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    };
  }
  if (len <= 70) {
    return {
      label: 'Near Truncation',
      toneClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    };
  }
  return {
    label: 'Likely Truncated (>70)',
    toneClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  };
}

function getDescStatus(len: number): { label: string; toneClass: string } {
  if (len === 0) {
    return {
      label: 'Missing Description',
      toneClass: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    };
  }
  if (len < 110) {
    return {
      label: 'Brief (<110)',
      toneClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    };
  }
  if (len <= 160) {
    return {
      label: 'Optimal Snippet',
      toneClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    };
  }
  return {
    label: 'Likely Ellipsis (>160)',
    toneClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  };
}

function truncateAtWord(text: string, maxChars: number): string {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  const sliced = clean.slice(0, maxChars - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  const cut = lastSpace > maxChars * 0.6 ? sliced.slice(0, lastSpace) : sliced;
  return `${cut}…`;
}

function formatUrlBreadcrumb(rawUrl: string, fallbackSlug: string): string {
  const cleaned = rawUrl.trim() || `${CANONICAL_ORIGIN}/services/${fallbackSlug}`;
  try {
    const parsed = new URL(cleaned);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return parsed.origin;
    return `${parsed.origin} › ${segments.join(' › ')}`;
  } catch {
    return `${CANONICAL_ORIGIN} › services › ${fallbackSlug}`;
  }
}

export const AdminCatalogSEOManager: React.FC = () => {
  const { user } = useAuth();
  const { services, blogPosts, createOrUpdateService } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'service' | 'digital_product' | 'compliance_package'>('all');
  const [seoFilter, setSeoFilter] = useState<'all' | 'custom_canonical' | 'needs_attention' | 'unpublished'>('all');
  const [page, setPage] = useState(1);

  const [firestoreMap, setFirestoreMap] = useState<Map<string, Service>>(new Map());
  const [loadingFirestore, setLoadingFirestore] = useState(false);

  const [selectedServiceId, setSelectedServiceId] = useState<string>(() => services[0]?.id || '');
  const [draftSeoTitle, setDraftSeoTitle] = useState('');
  const [draftSeoDescription, setDraftSeoDescription] = useState('');
  const [draftCanonicalUrl, setDraftCanonicalUrl] = useState('');
  const [draftFocusKeyword, setDraftFocusKeyword] = useState('');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [sitemapState, setSitemapState] = useState<SitemapFetchState>({
    loading: false,
    error: null,
    lastCheckedAt: null,
    httpLastModified: null,
    httpGeneratedAt: null,
    sourceLabel: '/sitemap.xml',
    stats: null,
    rawXml: '',
  });

  // Merge Firestore live records over local state so manual overrides always reflect DB truth
  const mergedServices = useMemo(() => {
    if (firestoreMap.size === 0) return services;
    return services.map((s) => {
      const remote = firestoreMap.get(s.id);
      return remote ? { ...s, ...remote } : s;
    });
  }, [services, firestoreMap]);

  const selectedService = useMemo(
    () => mergedServices.find((s) => s.id === selectedServiceId) || mergedServices[0] || null,
    [mergedServices, selectedServiceId]
  );

  // Sync editor inputs whenever selected service switches
  useEffect(() => {
    if (!selectedService) return;
    const defaultSeo = getServiceSeoMetadata(selectedService.slug || selectedService.id, selectedService);
    const defaultCanonical =
      defaultSeo?.canonicalUrl || `${CANONICAL_ORIGIN}/services/${encodeURIComponent(selectedService.slug)}`;

    setDraftSeoTitle(selectedService.seoTitle?.trim() || defaultSeo?.seoTitle || `${selectedService.name} | Digital India Project`);
    setDraftSeoDescription(
      selectedService.seoDescription?.trim() ||
        defaultSeo?.seoDescription ||
        selectedService.shortDesc ||
        ''
    );
    setDraftCanonicalUrl(selectedService.canonicalUrl?.trim() || defaultCanonical);
    setDraftFocusKeyword(selectedService.focusKeyword?.trim() || defaultSeo?.focusKeyword || selectedService.name.toLowerCase());
    setSaveError(null);
  }, [selectedService?.id, selectedService?.seoTitle, selectedService?.seoDescription, selectedService?.canonicalUrl, selectedService?.focusKeyword]);

  const loadFirestoreServices = useCallback(async () => {
    setLoadingFirestore(true);
    try {
      const snap = await getDocs(collection(db, 'services'));
      const nextMap = new Map<string, Service>();
      snap.docs.forEach((d) => {
        nextMap.set(d.id, d.data() as Service);
      });
      setFirestoreMap(nextMap);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'services');
    } finally {
      setLoadingFirestore(false);
    }
  }, []);

  const fetchSitemapHealth = useCallback(async () => {
    setSitemapState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(`/sitemap.xml?t=${Date.now()}`, { cache: 'no-store' });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} while fetching /sitemap.xml`);
      }
      const stats = parseSitemapXmlStats(text);
      if (!stats.validXml) {
        throw new Error('Response from /sitemap.xml did not contain a valid XML <urlset>.');
      }
      setSitemapState({
        loading: false,
        error: null,
        lastCheckedAt: new Date().toISOString(),
        httpLastModified: res.headers.get('last-modified'),
        httpGeneratedAt: res.headers.get('x-sitemap-generated-at'),
        sourceLabel: '/sitemap.xml (Live Endpoint)',
        stats,
        rawXml: text,
      });
    } catch (err: any) {
      setSitemapState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'Unable to fetch /sitemap.xml',
      }));
    }
  }, []);

  useEffect(() => {
    void fetchSitemapHealth();
    if (auth.currentUser) {
      void loadFirestoreServices();
    }
  }, [fetchSitemapHealth, loadFirestoreServices]);

  const systemHealth = useMemo(() => {
    const seenHashes = new Set<string>();
    const activeCount = mergedServices.filter((s) => s.published !== false).length;
    const directoryEntries = INDIA_GEOGRAPHY_SEED.map((loc) => ({
      location: loc,
      quality: evaluateDirectoryPageQuality(loc, {
        servicesCount: activeCount || loc.highlightedServiceSlugs.length,
        seenContentHashes: seenHashes,
      }),
    }));
    return computeSitemapHealthSummary({
      services: mergedServices,
      posts: blogPosts,
      directoryEntries,
    });
  }, [mergedServices, blogPosts]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mergedServices.filter((srv) => {
      if (typeFilter !== 'all' && (srv.productType || 'service') !== typeFilter) return false;
      const defaultCanonical = `${CANONICAL_ORIGIN}/services/${encodeURIComponent(srv.slug)}`;
      const hasCustomCanonical =
        Boolean(srv.canonicalUrl?.trim()) && srv.canonicalUrl!.trim() !== defaultCanonical;
      const titleLen = (srv.seoTitle || '').trim().length;
      const descLen = (srv.seoDescription || '').trim().length;
      const needsAttention = titleLen < 30 || titleLen > 70 || descLen < 110 || descLen > 165;

      if (seoFilter === 'custom_canonical' && !hasCustomCanonical) return false;
      if (seoFilter === 'needs_attention' && !needsAttention) return false;
      if (seoFilter === 'unpublished' && srv.published !== false) return false;

      if (!q) return true;
      return (
        srv.name.toLowerCase().includes(q) ||
        srv.slug.toLowerCase().includes(q) ||
        (srv.seoTitle || '').toLowerCase().includes(q) ||
        (srv.focusKeyword || '').toLowerCase().includes(q)
      );
    });
  }, [mergedServices, searchQuery, typeFilter, seoFilter]);

  const PAGE_SIZE = 12;
  const totalPages = Math.max(1, Math.ceil(filteredServices.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedServices = filteredServices.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleResetDefaults = () => {
    if (!selectedService) return;
    const defaultSeo = getServiceSeoMetadata(selectedService.slug || selectedService.id, {
      ...selectedService,
      seoTitle: undefined,
      seoDescription: undefined,
      focusKeyword: undefined,
    });
    setDraftSeoTitle(defaultSeo?.seoTitle || `${selectedService.name} — Apply Online | Digital India Project`);
    setDraftSeoDescription(defaultSeo?.seoDescription || selectedService.shortDesc || '');
    setDraftCanonicalUrl(
      defaultSeo?.canonicalUrl || `${CANONICAL_ORIGIN}/services/${encodeURIComponent(selectedService.slug)}`
    );
    setDraftFocusKeyword(defaultSeo?.focusKeyword || selectedService.name.toLowerCase());
    setSaveError(null);
  };

  const handleSaveServiceSeo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    setSaveError(null);
    setSaveNotice(null);

    const cleanTitle = draftSeoTitle.trim();
    const cleanDesc = draftSeoDescription.trim();
    const cleanCanonical = draftCanonicalUrl.trim();
    const cleanKeyword = draftFocusKeyword.trim();

    if (cleanTitle.length < 5 || cleanTitle.length > 120) {
      setSaveError('SEO Title must be between 5 and 120 characters.');
      return;
    }
    if (cleanDesc.length < 15 || cleanDesc.length > 240) {
      setSaveError('Meta Description must be between 15 and 240 characters.');
      return;
    }
    if (!/^https:\/\/[a-z0-9.-]+/i.test(cleanCanonical) || cleanCanonical.length > 250) {
      setSaveError('Canonical URL must be a valid HTTPS URL (max 250 characters).');
      return;
    }

    setSaving(true);
    try {
      const updatedService: Service = {
        ...selectedService,
        seoTitle: cleanTitle,
        seoDescription: cleanDesc,
        canonicalUrl: cleanCanonical,
        focusKeyword: cleanKeyword || selectedService.focusKeyword,
      };

      const nowIso = new Date().toISOString();
      const record = mapCatalogServiceToFirestoreRecord(updatedService, {
        existing: selectedService,
        nowIso,
        preserveExistingCustomizations: false,
        forceRefreshSeo: false,
      });

      if (auth.currentUser) {
        try {
          await setDoc(doc(db, 'services', record.id), record);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `services/${record.id}`);
        }
      }

      await createOrUpdateService(updatedService);
      setFirestoreMap((prev) => {
        const next = new Map(prev);
        next.set(record.id, { ...updatedService, updatedAt: nowIso });
        return next;
      });
      setSaveNotice(`Saved SEO metadata for "${selectedService.name}" (${user?.email || 'Admin'}).`);
      setTimeout(() => setSaveNotice(null), 4500);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save service SEO metadata to Firestore.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadGeneratedSitemap = () => {
    const seenHashes = new Set<string>();
    const activeCount = mergedServices.filter((s) => s.published !== false).length;
    const directoryEntries = INDIA_GEOGRAPHY_SEED.map((loc) => ({
      location: loc,
      quality: evaluateDirectoryPageQuality(loc, {
        servicesCount: activeCount || loc.highlightedServiceSlugs.length,
        seenContentHashes: seenHashes,
      }),
    }));
    const xml = buildSitemapXml(mergedServices, blogPosts, directoryEntries, {
      generatedAt: new Date().toISOString(),
    });
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sitemap.xml';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const titleStatus = getTitleStatus(draftSeoTitle.trim().length);
  const descStatus = getDescStatus(draftSeoDescription.trim().length);
  const liveSitemapTimestamp =
    sitemapState.stats?.generatedAt ||
    sitemapState.httpGeneratedAt ||
    sitemapState.httpLastModified;

  const indexedUrlCount = sitemapState.stats?.urlCount ?? systemHealth.indexedUrls;
  const totalSystemUrlCount = Math.max(systemHealth.totalSystemUrls, indexedUrlCount);
  const coveragePct =
    totalSystemUrlCount > 0
      ? Math.min(100, Math.round((indexedUrlCount / totalSystemUrlCount) * 1000) / 10)
      : 100;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* SECTION 1: SEO HEALTH DASHBOARD (/sitemap.xml live audit) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF671F]">
              <Activity className="w-4 h-4" />
              <span>SEO Health &amp; Sitemap Indexability</span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-1">
              Live Sitemap &amp; Search Console Readiness
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Fetches <code className="font-mono text-slate-700 dark:text-slate-200">/sitemap.xml</code> directly and audits indexed vs. total system URLs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchSitemapHealth()}
              disabled={sitemapState.loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-[#FF671F] hover:text-[#FF671F] transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sitemapState.loading ? 'animate-spin' : ''}`} />
              <span>Refresh Sitemap</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadGeneratedSitemap}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export sitemap.xml</span>
            </button>
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#FF671F] transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Raw</span>
            </a>
          </div>
        </div>

        {sitemapState.error && (
          <div className="mt-4 p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Could not reach live <code className="font-mono">/sitemap.xml</code> ({sitemapState.error}). Showing local catalog health summary instead.
            </span>
          </div>
        )}

        {/* Primary KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Indexed / Total URLs
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                {indexedUrlCount.toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                / {totalSystemUrlCount.toLocaleString('en-IN')} ({coveragePct}%)
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-[#138808] dark:bg-emerald-500 transition-all"
                style={{ width: `${coveragePct}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Last Sitemap Generated
            </div>
            <div className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {liveSitemapTimestamp
                ? new Date(liveSitemapTimestamp).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Timestamp Not Embedded'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
              {liveSitemapTimestamp || sitemapState.sourceLabel}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Published Services &amp; Products
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                {systemHealth.breakdown.publishedServices +
                  systemHealth.breakdown.publishedDigitalProducts +
                  systemHealth.breakdown.publishedPackages}
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                / {mergedServices.length} items
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {systemHealth.breakdown.publishedServices} services · {systemHealth.breakdown.publishedDigitalProducts} digital · {systemHealth.breakdown.publishedPackages} bundles
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Excluded (Draft / Noindex)
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                {(sitemapState.stats?.declaredExcludedCount ?? systemHealth.excludedUrls).toLocaleString('en-IN')}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                suppressed URLs
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Directory indexed: {systemHealth.breakdown.indexedDirectoryPages}/{systemHealth.breakdown.totalDirectoryPages} · Blogs: {systemHealth.breakdown.publishedPosts}/{systemHealth.breakdown.totalPosts}
            </div>
          </div>
        </div>

        {/* Live parsed URL distribution from /sitemap.xml */}
        {sitemapState.stats && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tabular-nums">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                <FileCheck2 className="w-3.5 h-3.5" />
                Valid XML &lt;urlset&gt;
              </span>
              <span>Services/Products: {sitemapState.stats.serviceAndProductUrls}</span>
              <span>Locations: {sitemapState.stats.locationUrls}</span>
              <span>India Directory: {sitemapState.stats.directoryUrls}</span>
              <span>Blog: {sitemapState.stats.blogUrls}</span>
              <span>Static/Legal: {sitemapState.stats.otherUrls}</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Checked {sitemapState.lastCheckedAt ? new Date(sitemapState.lastCheckedAt).toLocaleTimeString('en-IN') : '—'}
            </span>
          </div>
        )}
      </section>

      {/* SECTION 2: SERVICE CATALOG LIST + MANUAL SEO EDITOR + GOOGLE SERP LIVE PREVIEW */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Catalog Service Selector */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-[#FF671F]" />
                <span>Firestore Services ({mergedServices.length})</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Select any service or digital product to inspect and override its SEO fields.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadFirestoreServices()}
              disabled={loadingFirestore}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-[#FF671F] hover:text-[#FF671F] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loadingFirestore ? 'animate-spin' : ''}`} />
              <span>Sync DB</span>
            </button>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search service name, slug, keyword..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#FF671F]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value as any);
                  setPage(1);
                }}
                aria-label="Filter by product type"
                className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                <option value="all">All Catalog Types</option>
                <option value="service">Services Only</option>
                <option value="digital_product">Digital Products</option>
                <option value="compliance_package">Packages &amp; Bundles</option>
              </select>

              <select
                value={seoFilter}
                onChange={(e) => {
                  setSeoFilter(e.target.value as any);
                  setPage(1);
                }}
                aria-label="Filter by SEO status"
                className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              >
                <option value="all">All SEO States</option>
                <option value="needs_attention">Needs Length Tuning</option>
                <option value="custom_canonical">Custom Canonical Set</option>
                <option value="unpublished">Unpublished (Noindex)</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {pagedServices.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No services match your current SEO filter.
              </div>
            ) : (
              pagedServices.map((srv) => {
                const isSelected = selectedService?.id === srv.id;
                const defaultCanonical = `${CANONICAL_ORIGIN}/services/${encodeURIComponent(srv.slug)}`;
                const hasCustomCanonical =
                  Boolean(srv.canonicalUrl?.trim()) && srv.canonicalUrl!.trim() !== defaultCanonical;
                const titleLen = (srv.seoTitle || '').trim().length;
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => setSelectedServiceId(srv.id)}
                    className={`w-full text-left px-3.5 py-2.5 transition flex items-start justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-orange-50/90 dark:bg-orange-950/25 border-l-2 border-l-[#FF671F]'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {srv.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                        /{srv.slug}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          srv.published === false
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        {srv.published === false ? 'Draft' : 'Indexed'}
                      </span>
                      <span className="text-[10px] font-mono tabular-nums text-slate-400">
                        {hasCustomCanonical ? 'Custom Canonical' : `T:${titleLen}c`}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
            <span className="font-mono tabular-nums">
              Showing {pagedServices.length} of {filteredServices.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
              >
                Prev
              </button>
              <span className="font-mono tabular-nums px-1">
                {safePage}/{totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Right: Manual SEO Editor + Google SERP Live Preview */}
        <div className="xl:col-span-7 space-y-6">
          {selectedService && (
            <>
              {/* LIVE PREVIEW SECTION (Google SERP Snippet) */}
              <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#FF671F]" />
                      <span>Live Preview — Google Search Results Snippet</span>
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                      Real-Time SERP Rendering for {selectedService.name}
                    </h3>
                  </div>

                  <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('desktop')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        previewDevice === 'desktop'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>Desktop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('mobile')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        previewDevice === 'mobile'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Mobile</span>
                    </button>
                  </div>
                </div>

                {/* Realistic Google Search Snippet Card */}
                <div className="mt-4 bg-white dark:bg-[#1f1f1f] border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5">
                  <div className={previewDevice === 'mobile' ? 'max-w-[360px]' : 'max-w-[600px]'}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-orange-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[11px] font-extrabold text-[#FF671F] shrink-0">
                        DI
                      </span>
                      <div className="min-w-0 leading-tight">
                        <div className="text-[12px] font-medium text-[#202124] dark:text-[#dadce0]">
                          Digital India Project
                        </div>
                        <div className="text-[11px] text-[#4d5156] dark:text-[#bdc1c6] truncate font-mono">
                          {formatUrlBreadcrumb(draftCanonicalUrl, selectedService.slug)}
                        </div>
                      </div>
                    </div>

                    <h4 className="mt-2 text-[18px] sm:text-[20px] leading-[1.3] font-normal text-[#1a0dab] dark:text-[#8ab4f8] hover:underline cursor-default break-words">
                      {truncateAtWord(
                        draftSeoTitle || `${selectedService.name} | Digital India Project`,
                        previewDevice === 'mobile' ? 56 : 62
                      )}
                    </h4>

                    <p className="mt-1.5 text-[13px] sm:text-[14px] leading-[1.58] text-[#4d5156] dark:text-[#bdc1c6] break-words">
                      {truncateAtWord(
                        draftSeoDescription || selectedService.shortDesc || 'Official citizen and business digital services.',
                        previewDevice === 'mobile' ? 120 : 158
                      )}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      <span>
                        Schema: {selectedService.productType === 'digital_product' ? 'Product' : 'Service'}
                      </span>
                      <span>·</span>
                      <span>
                        Fee: ₹{Number(selectedService.serviceCharge || 0).toLocaleString('en-IN')}
                      </span>
                      {selectedService.published === false && (
                        <>
                          <span>·</span>
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            Unpublished (Excluded from sitemap.xml)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* MANUAL SEO FORM EDITOR */}
              <form
                onSubmit={handleSaveServiceSeo}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#FF671F]" />
                      <span>Edit Service SEO Metadata</span>
                    </h3>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      Firestore Doc: services/{selectedService.id} · slug: {selectedService.slug}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-[#FF671F] hover:text-[#FF671F] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset to Default</span>
                  </button>
                </div>

                {saveNotice && (
                  <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{saveNotice}</span>
                  </div>
                )}

                {saveError && (
                  <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-xs font-medium text-rose-800 dark:text-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{saveError}</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="seo-title-input" className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      SEO Title (&lt;title&gt;)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${titleStatus.toneClass}`}>
                        {titleStatus.label}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {draftSeoTitle.trim().length}/120
                      </span>
                    </div>
                  </div>
                  <input
                    id="seo-title-input"
                    type="text"
                    maxLength={120}
                    value={draftSeoTitle}
                    onChange={(e) => setDraftSeoTitle(e.target.value)}
                    placeholder="e.g., PAN Card Correction Online — Fees, Docs & Status | Digital India Project"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#FF671F]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label htmlFor="seo-desc-input" className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Meta Description (&lt;meta name="description"&gt;)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${descStatus.toneClass}`}>
                        {descStatus.label}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {draftSeoDescription.trim().length}/240
                      </span>
                    </div>
                  </div>
                  <textarea
                    id="seo-desc-input"
                    rows={3}
                    maxLength={240}
                    value={draftSeoDescription}
                    onChange={(e) => setDraftSeoDescription(e.target.value)}
                    placeholder="Write a clear, factual summary with fees, processing time, and required documents (recommended 110–160 characters)."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#FF671F]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="seo-canonical-input" className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        Canonical URL (&lt;link rel="canonical"&gt;)
                      </label>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400">
                        {draftCanonicalUrl.trim().length}/250
                      </span>
                    </div>
                    <input
                      id="seo-canonical-input"
                      type="url"
                      maxLength={250}
                      value={draftCanonicalUrl}
                      onChange={(e) => setDraftCanonicalUrl(e.target.value)}
                      placeholder={`${CANONICAL_ORIGIN}/services/${selectedService.slug}`}
                      className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#FF671F]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="seo-keyword-input" className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        Focus Keyword
                      </label>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400">
                        {draftFocusKeyword.trim().length}/100
                      </span>
                    </div>
                    <input
                      id="seo-keyword-input"
                      type="text"
                      maxLength={100}
                      value={draftFocusKeyword}
                      onChange={(e) => setDraftFocusKeyword(e.target.value)}
                      placeholder="Primary search keyword"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#FF671F]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Writes directly to Firestore <code className="font-mono">services/{selectedService.id}</code> and updates JSON-LD &amp; sitemap output.
                  </span>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF671F] hover:bg-[#e55a16] text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving to Firestore...' : 'Save SEO Metadata'}</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

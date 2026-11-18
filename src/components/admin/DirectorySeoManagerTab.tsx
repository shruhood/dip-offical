import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe2,
  Languages,
  MapPin,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { auth } from '../../services/firebase';
import {
  INDIA_GEOGRAPHY_SEED,
  IndiaLocationLevel,
  IndiaLocationRecord,
  IndiaRegionZone,
} from '../../data/indiaGeography';
import {
  SUPPORTED_INDIAN_LANGUAGES,
  SupportedLanguageCode,
} from '../../data/indianLanguages';
import type {
  DirectoryQualityEvaluation,
  DirectoryTranslationRecord,
} from '../../lib/indiaDirectorySeo';
import { evaluateDirectoryPageQuality } from '../../lib/indiaDirectorySeo';

interface DirectoryLocationWithQuality extends IndiaLocationRecord {
  quality?: DirectoryQualityEvaluation;
}

interface DirectoryOverviewStats {
  totalLocations: number;
  statesCount: number;
  unionTerritoriesCount: number;
  districtsCount: number;
  citiesCount: number;
  publishedCount: number;
  indexableCount: number;
  noindexedCount: number;
  thinPagesCount: number;
  duplicatePagesCount: number;
  translationsCount: number;
  supportedLanguagesCount: number;
}

interface SeoImportBatchItem {
  id: string;
  sourceName: string;
  format: string;
  importedCount: number;
  skippedDuplicates: number;
  errorsCount: number;
  summary: string;
  createdAt: string;
}

const SAMPLE_LGD_IMPORT_CSV = `name,level,stateSlug,districtSlug,lgdCode,pinCodes,latitude,longitude,regionZone,officialLanguages,summary
Silvassa Industrial Estate,town,dadra-nagar-haveli-daman-diu,dadra-nagar-haveli,LGD-CT-269011,396230,20.2689,73.0124,West India,"en;gu;hi","Verified MSME, FSSAI, GST, and Shop & Establishment facilitation hub serving Silvassa Industrial Estate in Dadra & Nagar Haveli."
Daman Moti Town,town,dadra-nagar-haveli-daman-diu,daman,LGD-CT-269012,396220,20.4143,72.8324,West India,"en;gu;hi","Verified online compliance, PAN, passport, and trade registration facilitation desk serving Moti Daman and Nani Daman."`;

async function callDirectoryAdminApi<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data: T | null; message: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // Allow local fallback
  }

  const res = await fetch(path, { ...options, headers });
  const json = await res.json().catch(() => null);
  return {
    ok: res.ok && (json?.success ?? true),
    data: json?.data ?? null,
    message: json?.message || (res.ok ? 'OK' : `HTTP ${res.status}`),
  };
}

export const DirectorySeoManagerTab: React.FC<{
  onNavigate?: (route: string, param?: string) => void;
}> = ({ onNavigate }) => {
  const [subTab, setSubTab] = useState<'locations' | 'translations' | 'import' | 'sitemaps'>(
    'locations'
  );
  const [locations, setLocations] = useState<DirectoryLocationWithQuality[]>(() =>
    INDIA_GEOGRAPHY_SEED.map((loc) => ({
      ...loc,
      quality: evaluateDirectoryPageQuality(loc),
    }))
  );
  const [translations, setTranslations] = useState<DirectoryTranslationRecord[]>([]);
  const [importBatches, setImportBatches] = useState<SeoImportBatchItem[]>([]);
  const [stats, setStats] = useState<DirectoryOverviewStats | null>(null);

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | IndiaLocationLevel>('all');
  const [indexFilter, setIndexFilter] = useState<'all' | 'index' | 'noindex'>('all');

  // Location Add / Edit Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<Partial<IndiaLocationRecord>>({});

  // Translations editor state
  const [selectedTransLocId, setSelectedTransLocId] = useState<string>(
    INDIA_GEOGRAPHY_SEED[1]?.id || 'loc-in'
  );
  const [selectedLangCode, setSelectedLangCode] = useState<SupportedLanguageCode>('hi');
  const [transName, setTransName] = useState('');
  const [transHeadline, setTransHeadline] = useState('');
  const [transSummary, setTransSummary] = useState('');
  const [transSeoTitle, setTransSeoTitle] = useState('');
  const [transSeoDesc, setTransSeoDesc] = useState('');
  const [transStatus, setTransStatus] = useState<'verified' | 'machine_reviewed' | 'draft'>(
    'verified'
  );

  // Import state
  const [importRawText, setImportRawText] = useState('');
  const [importSourceName, setImportSourceName] = useState('Local Government Directory (LGD)');

  const showNotice = (msg: string) => {
    setNotice(msg);
    setErrorMsg(null);
    setTimeout(() => setNotice(null), 5000);
  };

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callDirectoryAdminApi<{
        stats: DirectoryOverviewStats;
        locations: DirectoryLocationWithQuality[];
        translations: DirectoryTranslationRecord[];
        importBatches: SeoImportBatchItem[];
      }>('/api/admin/directory/overview');
      if (res.ok && res.data) {
        setStats(res.data.stats);
        setLocations(res.data.locations);
        setTranslations(res.data.translations || []);
        setImportBatches(res.data.importBatches || []);
      }
    } catch {
      // Retain seed preview
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const existing = translations.find(
      (t) => t.locationId === selectedTransLocId && t.langCode === selectedLangCode
    );
    const baseLoc = locations.find((l) => l.id === selectedTransLocId);
    setTransName(
      existing?.localizedName || baseLoc?.nativeNames?.[selectedLangCode] || baseLoc?.name || ''
    );
    setTransHeadline(existing?.headline || '');
    setTransSummary(existing?.summary || '');
    setTransSeoTitle(existing?.seoTitle || '');
    setTransSeoDesc(existing?.seoDescription || '');
    setTransStatus(existing?.translationStatus || 'verified');
  }, [selectedTransLocId, selectedLangCode, translations, locations]);

  const filteredLocations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return locations.filter((loc) => {
      if (levelFilter !== 'all' && loc.level !== levelFilter) return false;
      const idxStatus = loc.quality?.indexStatus || 'index';
      if (indexFilter !== 'all' && idxStatus !== indexFilter) return false;
      if (!q) return true;
      return (
        loc.name.toLowerCase().includes(q) ||
        loc.lgdCode.toLowerCase().includes(q) ||
        loc.canonicalPath.toLowerCase().includes(q) ||
        loc.pinCodes.toLowerCase().includes(q)
      );
    });
  }, [locations, search, levelFilter, indexFilter]);

  const computedStats = useMemo(() => {
    if (stats) return stats;
    return {
      totalLocations: locations.length,
      statesCount: locations.filter((l) => l.level === 'state').length,
      unionTerritoriesCount: locations.filter((l) => l.level === 'ut').length,
      districtsCount: locations.filter((l) => l.level === 'district').length,
      citiesCount: locations.filter((l) => l.level === 'city' || l.level === 'town').length,
      publishedCount: locations.filter((l) => l.published).length,
      indexableCount: locations.filter((l) => (l.quality?.indexStatus || 'index') === 'index')
        .length,
      noindexedCount: locations.filter((l) => l.quality?.indexStatus === 'noindex').length,
      thinPagesCount: locations.filter((l) => l.quality?.isThin).length,
      duplicatePagesCount: locations.filter((l) => l.quality?.isDuplicate).length,
      translationsCount: translations.length,
      supportedLanguagesCount: SUPPORTED_INDIAN_LANGUAGES.length,
    };
  }, [stats, locations, translations]);

  const handleSeedSyncD1 = async () => {
    setLoading(true);
    const res = await callDirectoryAdminApi('/api/admin/directory/seed', {
      method: 'POST',
      body: '{}',
    });
    setLoading(false);
    if (res.ok) {
      showNotice(res.message);
      await loadOverview();
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleQuickUpdateLocation = async (
    loc: IndiaLocationRecord,
    patch: Partial<IndiaLocationRecord>
  ) => {
    const next = { ...loc, ...patch };
    const res = await callDirectoryAdminApi('/api/admin/directory/locations', {
      method: 'POST',
      body: JSON.stringify(next),
    });
    if (res.ok) {
      showNotice(`Updated ${next.name} in D1 dip_content.`);
      await loadOverview();
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleSaveLocationModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await callDirectoryAdminApi('/api/admin/directory/locations', {
      method: 'POST',
      body: JSON.stringify(editingLoc),
    });
    if (res.ok) {
      setEditModalOpen(false);
      showNotice(res.message);
      await loadOverview();
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    const res = await callDirectoryAdminApi(`/api/admin/directory/locations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      showNotice(`Removed "${name}" from D1 directory.`);
      await loadOverview();
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleSaveTranslation = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await callDirectoryAdminApi('/api/admin/directory/translations', {
      method: 'PUT',
      body: JSON.stringify({
        locationId: selectedTransLocId,
        langCode: selectedLangCode,
        localizedName: transName,
        headline: transHeadline,
        summary: transSummary,
        seoTitle: transSeoTitle,
        seoDescription: transSeoDesc,
        translationStatus: transStatus,
      }),
    });
    if (res.ok) {
      showNotice(`Saved ${selectedLangCode.toUpperCase()} localization.`);
      await loadOverview();
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleRunImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importRawText.trim()) return;
    setLoading(true);
    const res = await callDirectoryAdminApi('/api/admin/directory/import', {
      method: 'POST',
      body: JSON.stringify({
        rawText: importRawText,
        sourceName: importSourceName,
      }),
    });
    setLoading(false);
    if (res.ok) {
      showNotice(res.message);
      setImportRawText('');
      await loadOverview();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-[#FF671F]" />
            <span>India Digital Directory — Multilingual Programmatic SEO Console</span>
          </h2>
          <p className="text-xs text-slate-500">
            Manage all 28 States, 8 Union Territories, districts, cities, 23 scheduled languages, anti-thin index guardrails, and LGD/Census imports inside Cloudflare D1.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSeedSyncD1}
            disabled={loading}
            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Verified Seed to D1</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingLoc({
                level: 'city',
                regionZone: 'West India',
                verified: true,
                published: true,
                indexPolicy: 'auto',
                officialLanguages: ['en', 'hi'],
              });
              setEditModalOpen(true);
            }}
            className="bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Location Node</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs tabular-nums">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-slate-400">States &amp; UTs</div>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {computedStats.statesCount} + {computedStats.unionTerritoriesCount}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold">36/36 Covered</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-slate-400">Districts &amp; Cities</div>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {computedStats.districtsCount} / {computedStats.citiesCount}
          </div>
          <div className="text-[11px] text-slate-500">Total: {computedStats.totalLocations} nodes</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-slate-400">Scheduled Locales</div>
          <div className="text-lg font-black text-[#FF671F] mt-0.5">
            {computedStats.supportedLanguagesCount}
          </div>
          <div className="text-[11px] text-slate-500">EN + 22 Eighth Schedule</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-slate-400">Indexable Pages</div>
          <div className="text-lg font-black text-[#138808] mt-0.5">
            {computedStats.indexableCount}
          </div>
          <div className="text-[11px] text-slate-500">Published: {computedStats.publishedCount}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-slate-400">Noindex Guardrail</div>
          <div className="text-lg font-black text-amber-600 mt-0.5">
            {computedStats.noindexedCount}
          </div>
          <div className="text-[11px] text-slate-500">
            Thin: {computedStats.thinPagesCount} · Dup: {computedStats.duplicatePagesCount}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-slate-400">Custom Overrides</div>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
            {computedStats.translationsCount}
          </div>
          <div className="text-[11px] text-slate-500">D1 Translated Rows</div>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#138808]" />
          <span>{notice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'locations', label: `Locations & Index Audit (${filteredLocations.length})`, icon: MapPin },
          { id: 'translations', label: '23-Language Translations CMS', icon: Languages },
          { id: 'import', label: 'Official LGD / Census Import', icon: Upload },
          { id: 'sitemaps', label: 'XML Sitemaps & Robots.txt', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                subTab === tab.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUBTAB 1: LOCATIONS & QUALITY AUDIT */}
      {subTab === 'locations' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 text-xs">
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search state, district, city, PIN or LGD code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2"
              />
            </div>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as any)}
              className="sm:col-span-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold"
            >
              <option value="all">All Hierarchy Levels</option>
              <option value="country">Country</option>
              <option value="state">States (28)</option>
              <option value="ut">Union Territories (8)</option>
              <option value="district">Districts</option>
              <option value="city">Cities &amp; Towns</option>
            </select>
            <select
              value={indexFilter}
              onChange={(e) => setIndexFilter(e.target.value as any)}
              className="sm:col-span-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold"
            >
              <option value="all">All Index Statuses</option>
              <option value="index">Indexable Only</option>
              <option value="noindex">Noindex / Guardrailed</option>
            </select>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[780px] text-xs text-left tabular-nums">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500">
                <tr>
                  <th className="p-3.5">Location &amp; Canonical Path</th>
                  <th className="p-3.5">LGD / PIN</th>
                  <th className="p-3.5">Quality</th>
                  <th className="p-3.5">Index Policy</th>
                  <th className="p-3.5">Published</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredLocations.slice(0, 60).map((loc) => {
                  const q = loc.quality || evaluateDirectoryPageQuality(loc);
                  return (
                    <tr key={loc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{loc.name}</span>
                          <span className="text-[10px] uppercase font-semibold text-[#FF671F]">
                            {loc.level}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">{loc.canonicalPath}</div>
                      </td>
                      <td className="p-3.5 font-mono text-[11px]">
                        <div className="text-slate-800 dark:text-slate-200">{loc.lgdCode}</div>
                        <div className="text-slate-400">PIN {loc.pinCodes}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {q.score}/100 ·{' '}
                          <span className={q.indexStatus === 'index' ? 'text-[#138808]' : 'text-amber-600'}>
                            {q.indexStatus}
                          </span>
                        </div>
                        {q.reasons.length > 0 && (
                          <div className="text-[10px] text-amber-600 line-clamp-1">{q.reasons[0]}</div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <select
                          value={loc.indexPolicy}
                          onChange={(e) =>
                            handleQuickUpdateLocation(loc, {
                              indexPolicy: e.target.value as IndiaLocationRecord['indexPolicy'],
                            })
                          }
                          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] font-semibold"
                        >
                          <option value="auto">auto</option>
                          <option value="index">force index</option>
                          <option value="noindex">force noindex</option>
                        </select>
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleQuickUpdateLocation(loc, { published: !loc.published })
                          }
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                            loc.published
                              ? 'bg-emerald-50 text-[#138808] dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {loc.published ? 'Published' : 'Draft'}
                        </button>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigate) onNavigate('india-directory', loc.canonicalPath);
                          }}
                          className="text-xs font-bold text-slate-600 hover:text-[#FF671F] cursor-pointer"
                          title="Preview Public Page"
                        >
                          <ExternalLink className="w-3.5 h-3.5 inline" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLoc(loc);
                            setEditModalOpen(true);
                          }}
                          className="text-xs font-bold text-[#FF671F] hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLocation(loc.id, loc.name)}
                          className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
                          title="Delete Custom Node"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: 23-LANGUAGE TRANSLATIONS CMS */}
      {subTab === 'translations' && (
        <form
          onSubmit={handleSaveTranslation}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 text-xs"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Location Node
              </label>
              <select
                value={selectedTransLocId}
                onChange={(e) => setSelectedTransLocId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold"
              >
                {locations.slice(0, 120).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.level.toUpperCase()} · {loc.canonicalPath})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Target Language (All 22 Scheduled + EN)
              </label>
              <select
                value={selectedLangCode}
                onChange={(e) => setSelectedLangCode(e.target.value as SupportedLanguageCode)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold"
              >
                {SUPPORTED_INDIAN_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeName} — {l.nameEn} ({l.hreflang})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Review Status
              </label>
              <select
                value={transStatus}
                onChange={(e) => setTransStatus(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold"
              >
                <option value="verified">Verified Editorial Translation</option>
                <option value="machine_reviewed">Reviewed</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Localized Place Name
              </label>
              <input
                type="text"
                value={transName}
                onChange={(e) => setTransName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Localized H1 Headline
              </label>
              <input
                type="text"
                value={transHeadline}
                onChange={(e) => setTransHeadline(e.target.value)}
                placeholder="Custom native headline override..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
              Localized Description / Anti-Thin SEO Copy (min 75 chars recommended)
            </label>
            <textarea
              rows={3}
              value={transSummary}
              onChange={(e) => setTransSummary(e.target.value)}
              placeholder="Write unique, helpful regional compliance details for this location..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Custom SEO Meta Title
              </label>
              <input
                type="text"
                value={transSeoTitle}
                onChange={(e) => setTransSeoTitle(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Custom SEO Meta Description
              </label>
              <input
                type="text"
                value={transSeoDesc}
                onChange={(e) => setTransSeoDesc(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer"
            >
              Save Localized Override to D1
            </button>
          </div>
        </form>
      )}

      {/* SUBTAB 3: OFFICIAL LGD / CENSUS BULK IMPORTER */}
      {subTab === 'import' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <form
            onSubmit={handleRunImport}
            className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Import Official LGD / Census Geography Data (CSV or JSON)
              </h3>
              <button
                type="button"
                onClick={() => setImportRawText(SAMPLE_LGD_IMPORT_CSV)}
                className="text-xs font-bold text-[#FF671F] hover:underline cursor-pointer"
              >
                Load Official LGD Sample CSV
              </button>
            </div>
            <input
              type="text"
              value={importSourceName}
              onChange={(e) => setImportSourceName(e.target.value)}
              placeholder="Official Authority Source Label"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-semibold"
            />
            <textarea
              rows={9}
              value={importRawText}
              onChange={(e) => setImportRawText(e.target.value)}
              placeholder="Paste official LGD / Census CSV or JSON array here..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 font-mono text-[11px]"
              required
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                Idempotent deduplication checks both canonical path and official LGD code before writing to D1.
              </span>
              <button
                type="submit"
                disabled={loading}
                className="bg-[#138808] hover:bg-[#0f6e06] text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
              >
                Run Verified LGD Import
              </button>
            </div>
          </form>

          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Recent Official Data Import Batches ({importBatches.length})
            </h3>
            {importBatches.length === 0 ? (
              <p className="text-slate-500">
                No external CSV/JSON batches logged in D1 yet. Built-in seed includes all 36 States/UTs and verified LGD districts &amp; towns.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {importBatches.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1"
                  >
                    <div className="font-bold text-slate-900 dark:text-white flex justify-between">
                      <span>{b.sourceName}</span>
                      <span className="uppercase font-mono text-[10px] text-[#FF671F]">
                        {b.format}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">{b.summary}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{b.createdAt}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 4: SITEMAPS & ROBOTS.TXT */}
      {subTab === 'sitemaps' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Dynamic Edge XML Sitemaps &amp; Anti-Thin Exclusion Architecture
          </h3>
          <p className="text-slate-600 dark:text-slate-300">
            All XML sitemaps dynamically query D1 <code className="font-mono">dip_content</code>, automatically exclude unpublished/thin/duplicate nodes marked <code className="font-mono">noindex</code>, and emit <code className="font-mono">xhtml:link</code> alternate tags for all 23 locales.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Main Unified Sitemap', path: '/sitemap.xml' },
              { label: 'Master Sitemap Index', path: '/sitemaps/index.xml' },
              { label: '28 States + 8 UTs + 23 Languages', path: '/sitemaps/india-states.xml' },
              { label: 'India Districts Sitemap', path: '/sitemaps/india-districts.xml' },
              { label: 'India Cities & Towns Sitemap', path: '/sitemaps/india-cities.xml' },
              { label: 'Robots.txt Policy', path: '/robots.txt' },
            ].map((item) => (
              <a
                key={item.path}
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200"
              >
                <span>
                  {item.label} <span className="font-mono text-slate-500">({item.path})</span>
                </span>
                <Download className="w-4 h-4 text-[#FF671F]" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ADD / EDIT LOCATION MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveLocationModal}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 space-y-4 text-xs shadow-2xl border border-slate-200 dark:border-slate-800"
          >
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {editingLoc.id ? `Edit ${editingLoc.name}` : 'Add Verified India Directory Node'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Display Name *</label>
                <input
                  type="text"
                  value={editingLoc.name || ''}
                  onChange={(e) => setEditingLoc((p) => ({ ...p, name: e.target.value }))}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Level *</label>
                <select
                  value={editingLoc.level || 'city'}
                  onChange={(e) =>
                    setEditingLoc((p) => ({ ...p, level: e.target.value as IndiaLocationLevel }))
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                >
                  <option value="state">State</option>
                  <option value="ut">Union Territory</option>
                  <option value="district">District</option>
                  <option value="city">City</option>
                  <option value="town">Town</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">State / UT Slug *</label>
                <input
                  type="text"
                  placeholder="e.g. maharashtra"
                  value={editingLoc.stateSlug || ''}
                  onChange={(e) => setEditingLoc((p) => ({ ...p, stateSlug: e.target.value }))}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">District Slug</label>
                <input
                  type="text"
                  placeholder="e.g. pune"
                  value={editingLoc.districtSlug || ''}
                  onChange={(e) => setEditingLoc((p) => ({ ...p, districtSlug: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Official LGD Code *</label>
                <input
                  type="text"
                  placeholder="e.g. LGD-CT-270101"
                  value={editingLoc.lgdCode || ''}
                  onChange={(e) => setEditingLoc((p) => ({ ...p, lgdCode: e.target.value }))}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">PIN Codes</label>
                <input
                  type="text"
                  placeholder="e.g. 411001"
                  value={editingLoc.pinCodes || ''}
                  onChange={(e) => setEditingLoc((p) => ({ ...p, pinCodes: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Region Zone</label>
                <select
                  value={editingLoc.regionZone || 'West India'}
                  onChange={(e) =>
                    setEditingLoc((p) => ({ ...p, regionZone: e.target.value as IndiaRegionZone }))
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                >
                  {[
                    'North India',
                    'West India',
                    'South India',
                    'East India',
                    'Central India',
                    'Northeast India',
                    'Island Territories',
                  ].map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Index Policy</label>
                <select
                  value={editingLoc.indexPolicy || 'auto'}
                  onChange={(e) =>
                    setEditingLoc((p) => ({
                      ...p,
                      indexPolicy: e.target.value as IndiaLocationRecord['indexPolicy'],
                    }))
                  }
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                >
                  <option value="auto">Auto Quality Gate</option>
                  <option value="index">Force Index</option>
                  <option value="noindex">Force Noindex</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">
                Location Summary (min 75 chars for indexing) *
              </label>
              <textarea
                rows={3}
                value={editingLoc.customSummary || ''}
                onChange={(e) => setEditingLoc((p) => ({ ...p, customSummary: e.target.value }))}
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold px-5 py-2 rounded-xl cursor-pointer"
              >
                Save to D1 Directory
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

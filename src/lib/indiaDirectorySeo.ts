import {
  INDIA_GEOGRAPHY_SEED,
  IndiaLocationLevel,
  IndiaLocationRecord,
  IndiaRegionZone,
} from '../data/indiaGeography';
import {
  IndianLanguageDefinition,
  SUPPORTED_INDIAN_LANGUAGES,
  SupportedLanguageCode,
  isSupportedLangCode,
  resolveLanguageMeta,
} from '../data/indianLanguages';
import { parseCsvRows } from './blogSeo';
import { CANONICAL_ORIGIN } from './siteUrls';
import type { Service } from '../types';

const DEFAULT_HIGHLIGHTS = [
  'pan-card',
  'gst-registration',
  'udyam-registration',
  'income-tax-return-itr-1',
  'fssai-basic-registration',
  'gazette-name-change',
];

export interface ParsedIndiaDirectoryRoute {
  matched: boolean;
  lang: SupportedLanguageCode;
  langPrefixExplicit: boolean;
  stateSlug?: string;
  districtSlug?: string;
  citySlug?: string;
  canonicalDirectoryPath: string;
}

export interface DirectoryTranslationRecord {
  id: string;
  locationId: string;
  langCode: SupportedLanguageCode;
  localizedName?: string;
  headline?: string;
  summary?: string;
  seoTitle?: string;
  seoDescription?: string;
  faqs?: Array<{ question: string; answer: string }>;
  translationStatus: 'verified' | 'machine_reviewed' | 'draft';
  updatedAt?: string;
}

export interface DirectoryQualityEvaluation {
  score: number;
  indexStatus: 'index' | 'noindex';
  isThin: boolean;
  isDuplicate: boolean;
  isVerified: boolean;
  contentHash: string;
  reasons: string[];
}

export interface DirectoryHreflangLink {
  hreflang: string;
  href: string;
  langCode: SupportedLanguageCode;
}

export interface DirectorySeoPackage {
  canonicalUrl: string;
  robotsContent: 'index, follow' | 'noindex, follow';
  title: string;
  description: string;
  headline: string;
  summary: string;
  breadcrumbs: Array<{ name: string; path: string; url: string }>;
  hreflangs: DirectoryHreflangLink[];
  xDefaultUrl: string;
  langMeta: IndianLanguageDefinition;
  quality: DirectoryQualityEvaluation;
  faqs: Array<{ question: string; answer: string }>;
  jsonLd: Record<string, any>;
}

export function computeStableTextHash(input: string): string {
  const normalized = input.toLowerCase().replace(/\s+/g, ' ').trim();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function slugifyGeoSegment(val: string): string {
  return String(val || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildIndiaDirectoryPath(params: {
  lang?: SupportedLanguageCode | string;
  stateSlug?: string;
  districtSlug?: string;
  citySlug?: string;
}): string {
  const parts: string[] = [];
  if (params.lang && params.lang !== 'en' && isSupportedLangCode(params.lang)) {
    parts.push(params.lang);
  }
  parts.push('india');
  if (params.stateSlug) {
    parts.push(encodeURIComponent(params.stateSlug));
    if (params.districtSlug) {
      parts.push(encodeURIComponent(params.districtSlug));
      if (params.citySlug) {
        parts.push(encodeURIComponent(params.citySlug));
      }
    }
  }
  return `/${parts.join('/')}`;
}

export function parseIndiaDirectoryPath(rawPathname: string): ParsedIndiaDirectoryRoute {
  const pathname = (rawPathname || '/').replace(/\/+$/, '') || '/';
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });

  if (segments.length === 0) {
    return { matched: false, lang: 'en', langPrefixExplicit: false, canonicalDirectoryPath: '/india' };
  }

  let lang: SupportedLanguageCode = 'en';
  let langPrefixExplicit = false;
  let offset = 0;

  if (segments[0] !== 'india' && isSupportedLangCode(segments[0]) && segments[1] === 'india') {
    lang = segments[0].toLowerCase() as SupportedLanguageCode;
    langPrefixExplicit = true;
    offset = 1;
  } else if (segments[0] !== 'india') {
    return { matched: false, lang: 'en', langPrefixExplicit: false, canonicalDirectoryPath: '/india' };
  }

  const stateSlug = segments[offset + 1]?.toLowerCase() || undefined;
  const districtSlug = segments[offset + 2]?.toLowerCase() || undefined;
  const citySlug = segments[offset + 3]?.toLowerCase() || undefined;

  if (segments.length > offset + 4) {
    return { matched: false, lang, langPrefixExplicit, canonicalDirectoryPath: '/india' };
  }

  return {
    matched: true,
    lang,
    langPrefixExplicit,
    stateSlug,
    districtSlug,
    citySlug,
    canonicalDirectoryPath: buildIndiaDirectoryPath({
      lang: langPrefixExplicit ? lang : 'en',
      stateSlug,
      districtSlug,
      citySlug,
    }),
  };
}

export function evaluateDirectoryPageQuality(
  location: IndiaLocationRecord,
  options?: {
    translation?: DirectoryTranslationRecord | null;
    servicesCount?: number;
    childCount?: number;
    seenContentHashes?: Set<string>;
  }
): DirectoryQualityEvaluation {
  const reasons: string[] = [];
  let score = 100;

  const summary = (options?.translation?.summary || location.customSummary || '').trim();
  const isVerified = Boolean(location.verified);
  const servicesCount = options?.servicesCount ?? location.highlightedServiceSlugs.length;
  const childCount = options?.childCount ?? 0;

  if (!location.published) {
    reasons.push('Location is unpublished / draft.');
    score -= 60;
  }
  if (!isVerified) {
    reasons.push('Unverified geographic record (awaiting LGD/Census verification).');
    score -= 40;
  }
  if (!location.lgdCode || !location.lgdCode.trim()) {
    reasons.push('Missing official LGD code identifier.');
    score -= 15;
  }
  if (summary.length < 75) {
    reasons.push(`Summary text too short (${summary.length} chars; minimum 75 chars required).`);
    score -= 35;
  }
  if (servicesCount < 2) {
    reasons.push('Insufficient mapped services for standalone directory landing page.');
    score -= 20;
  }
  if ((location.level === 'state' || location.level === 'ut') && childCount === 0) {
    reasons.push('State/UT node currently has zero child districts seeded.');
    score -= 15;
  }

  const normalizedContentFingerprint = `${location.level}|${summary}|${location.pinCodes}|${location.lgdCode}`;
  const contentHash = computeStableTextHash(normalizedContentFingerprint);
  let isDuplicate = false;

  if (options?.seenContentHashes) {
    if (options.seenContentHashes.has(contentHash)) {
      isDuplicate = true;
      reasons.push('Duplicate summary + metadata fingerprint detected across directory nodes.');
      score -= 45;
    } else {
      options.seenContentHashes.add(contentHash);
    }
  }

  if (location.indexPolicy === 'noindex') {
    reasons.push('Manually configured as noindex by administrator.');
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const isThin = summary.length < 75 || servicesCount < 2;

  const shouldIndex =
    location.indexPolicy === 'index'
      ? location.published && !isDuplicate
      : location.indexPolicy === 'auto'
      ? location.published && isVerified && !isThin && !isDuplicate && finalScore >= 65
      : false;

  return {
    score: finalScore,
    indexStatus: shouldIndex ? 'index' : 'noindex',
    isThin,
    isDuplicate,
    isVerified,
    contentHash,
    reasons,
  };
}

export function resolveHierarchyChain(
  parsed: ParsedIndiaDirectoryRoute,
  locations: IndiaLocationRecord[] = INDIA_GEOGRAPHY_SEED
): {
  country: IndiaLocationRecord;
  state?: IndiaLocationRecord;
  district?: IndiaLocationRecord;
  city?: IndiaLocationRecord;
  current?: IndiaLocationRecord;
  childLocations: IndiaLocationRecord[];
  siblingLocations: IndiaLocationRecord[];
} {
  const country =
    locations.find((l) => l.level === 'country') || INDIA_GEOGRAPHY_SEED[0];

  if (!parsed.stateSlug) {
    return {
      country,
      current: country,
      childLocations: locations
        .filter((l) => (l.level === 'state' || l.level === 'ut') && l.published)
        .sort((a, b) => a.name.localeCompare(b.name)),
      siblingLocations: [],
    };
  }

  const state = locations.find(
    (l) => (l.level === 'state' || l.level === 'ut') && l.slug === parsed.stateSlug
  );
  if (!state) {
    return { country, current: undefined, childLocations: [], siblingLocations: [] };
  }

  if (!parsed.districtSlug) {
    const districts = locations
      .filter((l) => l.level === 'district' && l.stateSlug === state.slug && l.published)
      .sort((a, b) => a.name.localeCompare(b.name));
    const otherStates = locations
      .filter(
        (l) =>
          (l.level === 'state' || l.level === 'ut') &&
          l.slug !== state.slug &&
          l.regionZone === state.regionZone &&
          l.published
      )
      .slice(0, 6);
    return {
      country,
      state,
      current: state,
      childLocations: districts,
      siblingLocations: otherStates,
    };
  }

  const district = locations.find(
    (l) =>
      l.level === 'district' &&
      l.stateSlug === state.slug &&
      l.slug === parsed.districtSlug
  );
  if (!district) {
    return { country, state, current: undefined, childLocations: [], siblingLocations: [] };
  }

  if (!parsed.citySlug) {
    const cities = locations
      .filter(
        (l) =>
          (l.level === 'city' || l.level === 'town') &&
          l.stateSlug === state.slug &&
          l.districtSlug === district.slug &&
          l.published
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    const siblingDistricts = locations
      .filter(
        (l) =>
          l.level === 'district' &&
          l.stateSlug === state.slug &&
          l.slug !== district.slug &&
          l.published
      )
      .slice(0, 8);
    return {
      country,
      state,
      district,
      current: district,
      childLocations: cities,
      siblingLocations: siblingDistricts,
    };
  }

  const city = locations.find(
    (l) =>
      (l.level === 'city' || l.level === 'town') &&
      l.stateSlug === state.slug &&
      l.districtSlug === district.slug &&
      l.slug === parsed.citySlug
  );
  if (!city) {
    return {
      country,
      state,
      district,
      current: undefined,
      childLocations: [],
      siblingLocations: [],
    };
  }

  const siblingCities = locations
    .filter(
      (l) =>
        (l.level === 'city' || l.level === 'town') &&
        l.stateSlug === state.slug &&
        l.slug !== city.slug &&
        l.published
    )
    .slice(0, 8);

  return {
    country,
    state,
    district,
    city,
    current: city,
    childLocations: [],
    siblingLocations: siblingCities,
  };
}

export function buildDirectoryHreflangs(params: {
  stateSlug?: string;
  districtSlug?: string;
  citySlug?: string;
}): { hreflangs: DirectoryHreflangLink[]; xDefaultUrl: string } {
  const defaultPath = buildIndiaDirectoryPath({
    lang: 'en',
    stateSlug: params.stateSlug,
    districtSlug: params.districtSlug,
    citySlug: params.citySlug,
  });
  const xDefaultUrl = `${CANONICAL_ORIGIN}${defaultPath}`;
  const hreflangs: DirectoryHreflangLink[] = SUPPORTED_INDIAN_LANGUAGES.map((l) => {
    const p = buildIndiaDirectoryPath({
      lang: l.code,
      stateSlug: params.stateSlug,
      districtSlug: params.districtSlug,
      citySlug: params.citySlug,
    });
    return {
      hreflang: l.hreflang,
      href: `${CANONICAL_ORIGIN}${p}`,
      langCode: l.code,
    };
  });
  return { hreflangs, xDefaultUrl };
}

export function buildDirectoryMetaAndJsonLd(params: {
  parsed: ParsedIndiaDirectoryRoute;
  locations?: IndiaLocationRecord[];
  translation?: DirectoryTranslationRecord | null;
  services?: Service[];
}): DirectorySeoPackage | null {
  const allLocations = params.locations || INDIA_GEOGRAPHY_SEED;
  const hierarchy = resolveHierarchyChain(params.parsed, allLocations);
  if (!hierarchy.current) return null;

  const loc = hierarchy.current;
  const langMeta = resolveLanguageMeta(params.parsed.lang);
  const localizedLocationName =
    params.translation?.localizedName ||
    loc.nativeNames?.[params.parsed.lang] ||
    loc.name;

  const breadcrumbs: Array<{ name: string; path: string; url: string }> = [
    {
      name: params.parsed.lang === 'en' ? 'Home' : langMeta.copy.brandName,
      path: '/',
      url: CANONICAL_ORIGIN,
    },
    {
      name: langMeta.copy.indiaName,
      path: buildIndiaDirectoryPath({ lang: params.parsed.lang }),
      url: `${CANONICAL_ORIGIN}${buildIndiaDirectoryPath({ lang: params.parsed.lang })}`,
    },
  ];

  if (hierarchy.state) {
    const p = buildIndiaDirectoryPath({
      lang: params.parsed.lang,
      stateSlug: hierarchy.state.slug,
    });
    breadcrumbs.push({
      name: hierarchy.state.nativeNames?.[params.parsed.lang] || hierarchy.state.name,
      path: p,
      url: `${CANONICAL_ORIGIN}${p}`,
    });
  }
  if (hierarchy.district && hierarchy.state) {
    const p = buildIndiaDirectoryPath({
      lang: params.parsed.lang,
      stateSlug: hierarchy.state.slug,
      districtSlug: hierarchy.district.slug,
    });
    breadcrumbs.push({
      name: hierarchy.district.nativeNames?.[params.parsed.lang] || hierarchy.district.name,
      path: p,
      url: `${CANONICAL_ORIGIN}${p}`,
    });
  }
  if (hierarchy.city && hierarchy.district && hierarchy.state) {
    const p = buildIndiaDirectoryPath({
      lang: params.parsed.lang,
      stateSlug: hierarchy.state.slug,
      districtSlug: hierarchy.district.slug,
      citySlug: hierarchy.city.slug,
    });
    breadcrumbs.push({
      name: localizedLocationName,
      path: p,
      url: `${CANONICAL_ORIGIN}${p}`,
    });
  }

  const canonicalPath = buildIndiaDirectoryPath({
    lang: params.parsed.lang,
    stateSlug: hierarchy.state?.slug,
    districtSlug: hierarchy.district?.slug,
    citySlug: hierarchy.city?.slug,
  });
  const canonicalUrl = `${CANONICAL_ORIGIN}${canonicalPath}`;

  const { hreflangs, xDefaultUrl } = buildDirectoryHreflangs({
    stateSlug: hierarchy.state?.slug,
    districtSlug: hierarchy.district?.slug,
    citySlug: hierarchy.city?.slug,
  });

  const quality = evaluateDirectoryPageQuality(loc, {
    translation: params.translation,
    servicesCount: (params.services || []).filter((s) => s.published !== false).length || loc.highlightedServiceSlugs.length,
    childCount: hierarchy.childLocations.length,
  });

  const locationChainLabel =
    loc.level === 'country'
      ? localizedLocationName
      : loc.level === 'state' || loc.level === 'ut'
      ? localizedLocationName
      : loc.level === 'district'
      ? `${localizedLocationName}, ${hierarchy.state?.name || ''}`
      : `${localizedLocationName}, ${hierarchy.district?.name || ''}, ${hierarchy.state?.name || ''}`;

  const headline =
    params.translation?.headline ||
    (loc.level === 'country'
      ? `${langMeta.copy.directoryLabel} — ${langMeta.copy.browseStates}`
      : params.parsed.lang === 'en'
      ? `Online Digital, Business, Tax & Citizen Services in ${locationChainLabel}`
      : `${locationChainLabel} — ${langMeta.copy.directoryLabel}`);

  const summary = params.translation?.summary || loc.customSummary;

  const title =
    params.translation?.seoTitle ||
    loc.seoTitle ||
    (loc.level === 'country'
      ? `${langMeta.copy.directoryLabel} (${langMeta.nativeName}) | ${langMeta.copy.brandName}`
      : `${locationChainLabel} — Online PAN, GST, Udyam MSME & Citizen Services | ${langMeta.copy.brandName}`);

  const description = (
    params.translation?.seoDescription ||
    loc.seoDescription ||
    `${summary} PIN: ${loc.pinCodes} · Official LGD Code: ${loc.lgdCode}.`
  ).slice(0, 165);

  const faqs =
    params.translation?.faqs && params.translation.faqs.length > 0
      ? params.translation.faqs
      : [
          {
            question: `Which online services are available in ${locationChainLabel} on Digital India Project?`,
            answer: `Residents and businesses in ${locationChainLabel} (PIN ${loc.pinCodes}) can apply online for PAN Card, GST Registration, Udyam MSME Registration, ITR Filing, FSSAI Food Licence, Gazette Name Change, and Digital Products with transparent itemized INR pricing.`,
          },
          {
            question: `What is the official LGD verification code and fee structure for ${loc.name}?`,
            answer: `${loc.name} is mapped under Official Local Government Directory code ${loc.lgdCode}. Every service displays Professional Fee, Government Statutory Fee (0% GST), and GST separately before checkout.`,
          },
          {
            question: `Is Digital India Project a government portal for ${loc.name}?`,
            answer: `No. Digital India Project is a private online registration consultancy and facilitation platform, not a government department. Final statutory approvals rest solely with jurisdictional authorities.`,
          },
        ];

  const mappedServices = (params.services || [])
    .filter(
      (s) =>
        s.published !== false &&
        (loc.highlightedServiceSlugs.includes(s.slug) || s.popular)
    )
    .slice(0, 8);

  const areaType =
    loc.level === 'country'
      ? 'Country'
      : loc.level === 'state' || loc.level === 'ut'
      ? 'State'
      : loc.level === 'city' || loc.level === 'town'
      ? 'City'
      : 'AdministrativeArea';

  const graph: Record<string, any>[] = [
    {
      '@type': 'CollectionPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      inLanguage: langMeta.hreflang,
      isPartOf: {
        '@type': 'WebSite',
        name: 'Digital India Project',
        url: CANONICAL_ORIGIN,
      },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonicalUrl}#breadcrumb`,
      itemListElement: breadcrumbs.map((b, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: b.name,
        item: b.url,
      })),
    },
    {
      '@type': areaType,
      '@id': `${canonicalUrl}#place`,
      name: loc.name,
      identifier: loc.lgdCode,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: loc.latitude,
        longitude: loc.longitude,
      },
      ...(hierarchy.state && loc.level !== 'state' && loc.level !== 'ut'
        ? {
            containedInPlace: {
              '@type': 'State',
              name: hierarchy.state.name,
              identifier: hierarchy.state.lgdCode,
            },
          }
        : {}),
    },
    {
      '@type': 'FAQPage',
      '@id': `${canonicalUrl}#faq`,
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
  ];

  if (mappedServices.length > 0) {
    graph.push({
      '@type': 'OfferCatalog',
      '@id': `${canonicalUrl}#catalog`,
      name: `Digital Services in ${loc.name}`,
      itemListElement: mappedServices.map((srv, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        item: {
          '@type': 'Service',
          name: srv.name,
          url: `${CANONICAL_ORIGIN}/services/${encodeURIComponent(srv.slug)}`,
          areaServed: {
            '@type': areaType,
            name: loc.name,
          },
          offers: {
            '@type': 'Offer',
            price: String(srv.serviceCharge),
            priceCurrency: 'INR',
          },
        },
      })),
    });
  }

  return {
    canonicalUrl,
    robotsContent: quality.indexStatus === 'index' ? 'index, follow' : 'noindex, follow',
    title,
    description,
    headline,
    summary,
    breadcrumbs,
    hreflangs,
    xDefaultUrl,
    langMeta,
    quality,
    faqs,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': graph,
    },
  };
}

export interface OfficialGeographyImportResult {
  validRecords: IndiaLocationRecord[];
  skippedDuplicates: number;
  errors: string[];
  warnings: string[];
  detectedFormat: 'json' | 'csv';
}

const VALID_GEO_LEVELS = new Set<IndiaLocationLevel>([
  'state',
  'ut',
  'district',
  'city',
  'town',
]);

export function parseOfficialGeographyImport(
  rawText: string,
  existingLocations: IndiaLocationRecord[] = INDIA_GEOGRAPHY_SEED
): OfficialGeographyImportResult {
  const trimmed = (rawText || '').replace(/^\uFEFF/, '').trim();
  const errors: string[] = [];
  const warnings: string[] = [];
  const validRecords: IndiaLocationRecord[] = [];
  let skippedDuplicates = 0;

  if (!trimmed) {
    return {
      validRecords: [],
      skippedDuplicates: 0,
      errors: ['Import payload is empty. Provide LGD/Census JSON or CSV rows.'],
      warnings: [],
      detectedFormat: 'csv',
    };
  }

  let detectedFormat: 'json' | 'csv' = 'csv';
  let rows: Record<string, any>[] = [];

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    detectedFormat = 'json';
    try {
      const parsed = JSON.parse(trimmed);
      rows = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.locations)
        ? parsed.locations
        : [parsed];
    } catch (err: any) {
      return {
        validRecords: [],
        skippedDuplicates: 0,
        errors: [`Invalid JSON: ${err?.message || 'Unable to parse'}`],
        warnings: [],
        detectedFormat: 'json',
      };
    }
  } else {
    const matrix = parseCsvRows(trimmed);
    if (matrix.length < 2) {
      return {
        validRecords: [],
        skippedDuplicates: 0,
        errors: ['CSV must include a header row and at least one location row.'],
        warnings: [],
        detectedFormat: 'csv',
      };
    }
    const headers = matrix[0].map((h) => h.trim());
    rows = matrix.slice(1).map((cells) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = cells[i] ?? '';
      });
      return obj;
    });
  }

  const seenPaths = new Set(existingLocations.map((l) => l.canonicalPath.toLowerCase()));
  const seenLgd = new Set(existingLocations.map((l) => l.lgdCode.toLowerCase()));

  rows.forEach((row, idx) => {
    const name = String(row.name || row.cityName || row.districtName || '').trim();
    const rawLevel = String(row.level || 'city').toLowerCase().trim() as IndiaLocationLevel;
    const stateSlug = slugifyGeoSegment(String(row.stateSlug || row.state_slug || row.state || ''));
    const districtSlugRaw = String(row.districtSlug || row.district_slug || row.district || '').trim();
    const districtSlug = districtSlugRaw ? slugifyGeoSegment(districtSlugRaw) : undefined;
    const lgdCode = String(row.lgdCode || row.lgd_code || '').trim();

    if (!name || !VALID_GEO_LEVELS.has(rawLevel) || !stateSlug || !lgdCode) {
      errors.push(
        `Row #${idx + 1}: Requires valid name, level (state|ut|district|city|town), stateSlug, and official lgdCode.`
      );
      return;
    }

    const ownSlug = slugifyGeoSegment(String(row.slug || name));
    let canonicalPath = `/india/${stateSlug}`;
    let parentId = 'loc-in';
    let finalDistrictSlug = districtSlug;
    let finalCitySlug: string | undefined;

    if (rawLevel === 'district') {
      finalDistrictSlug = districtSlug || ownSlug;
      canonicalPath = `/india/${stateSlug}/${finalDistrictSlug}`;
      parentId = `loc-${stateSlug}`;
    } else if (rawLevel === 'city' || rawLevel === 'town') {
      if (!finalDistrictSlug) {
        errors.push(`Row #${idx + 1} ("${name}"): Cities/towns require districtSlug.`);
        return;
      }
      finalCitySlug = ownSlug;
      canonicalPath = `/india/${stateSlug}/${finalDistrictSlug}/${finalCitySlug}`;
      parentId = `loc-${stateSlug}-${finalDistrictSlug}`;
    }

    if (seenPaths.has(canonicalPath.toLowerCase()) || seenLgd.has(lgdCode.toLowerCase())) {
      skippedDuplicates += 1;
      warnings.push(`Skipped existing location "${name}" (${canonicalPath} / ${lgdCode}).`);
      return;
    }

    seenPaths.add(canonicalPath.toLowerCase());
    seenLgd.add(lgdCode.toLowerCase());

    const pinCodes = String(row.pinCodes || row.pin_codes || row.pincode || '000000').trim();
    const regionZone = (String(row.regionZone || row.region_zone || 'West India').trim() ||
      'West India') as IndiaRegionZone;
    const customSummary =
      String(row.summary || row.customSummary || row.custom_summary || '').trim() ||
      `Apply online in ${name} (${stateSlug.replace(/-/g, ' ')}, PIN ${pinCodes}) for PAN Card, GST Registration, Udyam MSME, ITR Filing, FSSAI Licence, and citizen documentation.`;

    const verified =
      row.verified === true ||
      String(row.verified).toLowerCase() === 'true' ||
      String(row.verified) === '1' ||
      lgdCode.startsWith('LGD-');

    const record: IndiaLocationRecord = {
      id: `loc-${[stateSlug, finalDistrictSlug, finalCitySlug].filter(Boolean).join('-')}`,
      slug: ownSlug,
      parentId,
      level: rawLevel,
      stateSlug,
      districtSlug: finalDistrictSlug,
      citySlug: finalCitySlug,
      canonicalPath,
      name,
      nativeNames: typeof row.nativeNames === 'object' && row.nativeNames ? row.nativeNames : {},
      lgdCode,
      censusCode: row.censusCode ? String(row.censusCode).trim() : undefined,
      isoCode: row.isoCode ? String(row.isoCode).trim() : undefined,
      pinCodes,
      latitude: Number(row.latitude || row.lat) || 20.5937,
      longitude: Number(row.longitude || row.lng) || 78.9629,
      officialLanguages: Array.isArray(row.officialLanguages)
        ? row.officialLanguages
        : String(row.officialLanguages || 'en;hi')
            .split(/[;,|]/)
            .map((x) => x.trim())
            .filter(Boolean),
      regionZone,
      sourceAuthority:
        String(row.sourceAuthority || 'Local Government Directory (LGD), Govt. of India').trim(),
      sourceUrl: String(row.sourceUrl || 'https://lgdirectory.gov.in/').trim(),
      verified,
      published: row.published !== false && String(row.published).toLowerCase() !== 'false',
      indexPolicy: 'auto',
      highlightedServiceSlugs: DEFAULT_HIGHLIGHTS,
      customSummary,
      updatedAt: new Date().toISOString(),
    };

    validRecords.push(record);
  });

  return {
    validRecords,
    skippedDuplicates,
    errors,
    warnings,
    detectedFormat,
  };
}

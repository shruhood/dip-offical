import type { CatalogueImportReport, Service } from '../types';
import { CATALOGUE_CATEGORIES, resolveCategorySlug } from '../data/catalogue/categories';
import { enrichServiceWithSeoData, getServiceSeoMetadata } from './seoData';

/**
 * Exact key allowlist from `firestore.rules` -> `isValidServiceProduct(data)`.
 * Keeping this allowlist strictly synchronized prevents Firestore permission errors.
 */
export const FIRESTORE_SERVICE_ALLOWED_KEYS = [
  'id',
  'slug',
  'name',
  'nameHi',
  'category',
  'subcategory',
  'productType',
  'shortDesc',
  'shortDescHi',
  'fullDesc',
  'fullDescHi',
  'iconName',
  'coverImageUrl',
  'serviceCharge',
  'govtFees',
  'thirdPartyFees',
  'additionalCharge',
  'urgentFee',
  'discountInr',
  'taxRateBps',
  'taxInclusive',
  'partnerPriceInr',
  'billingUnit',
  'pricingType',
  'govtFeeNote',
  'commissionNote',
  'deliveryType',
  'formVersion',
  'slaHours',
  'published',
  'supportedFilingModes',
  'autoAssignRule',
  'serviceDisclaimer',
  'regulatedNotice',
  'instructions',
  'conditions',
  'estimatedTime',
  'integrationType',
  'availability',
  'apiSetuRef',
  'providerApprovalStatus',
  'customerConsentRequired',
  'b2bSupported',
  'popular',
  'featured',
  'isCustomQuote',
  'includedServiceIds',
  'exclusions',
  'packageSavingsInr',
  'digitalAsset',
  'seoTitle',
  'seoDescription',
  'focusKeyword',
  'canonicalUrl',
  'eligibility',
  'requiredDocs',
  'processSteps',
  'formFields',
  'faqs',
  'createdAt',
  'updatedAt',
] as const;

export type FirestoreServiceRecord = Record<string, any> & {
  id: string;
  slug: string;
  name: string;
  category: string;
  serviceCharge: number;
  govtFees: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export interface D1ServiceRecord {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  name_hi: string | null;
  short_desc: string;
  short_desc_hi: string | null;
  full_desc: string;
  icon_name: string;
  service_charge: number;
  govt_fees: number;
  estimated_time: string;
  is_popular: number;
  is_featured: number;
  is_active: number;
  product_type: string;
  subcategory: string | null;
  billing_unit: string;
  pricing_type: string;
  third_party_fee_paise: number;
  urgent_fee_paise: number;
  discount_paise: number;
  govt_fee_note: string | null;
  commission_note: string | null;
  delivery_type: string;
  included_service_ids_json: string | null;
  exclusions_json: string | null;
  digital_asset_json: string | null;
  seo_title: string;
  seo_description: string;
  focus_keyword: string;
  conditions_json: string | null;
  regulated_notice: string | null;
  is_custom_quote: number;
  updated_at: string;
}

export interface SyncMapOptions {
  existing?: Partial<Service> | null;
  nowIso?: string;
  preserveExistingCustomizations?: boolean;
  forceRefreshSeo?: boolean;
}

const VALID_INTEGRATION_TYPES = new Set([
  'api_setu',
  'digilocker',
  'other_api',
  'manual_assistance',
  'external_portal',
]);

const VALID_AVAILABILITY = new Set(['Live', 'Coming Soon', 'Manual', 'Unavailable']);

function clipStr(value: unknown, maxLen: number): string {
  return String(value ?? '').trim().slice(0, maxLen);
}

function stableJson(val: unknown): string {
  return JSON.stringify(val ?? null);
}

/**
 * Maps a catalog `Service` item into the exact Firestore `/services/{serviceId}`
 * `ServiceProduct` schema defined in `firebase-blueprint.json` and `firestore.rules`.
 *
 * Guarantees:
 * - Strict key allowlist compliance (`FIRESTORE_SERVICE_ALLOWED_KEYS`)
 * - Field string & array length limits compliant with `firestore.rules`
 * - Preserves matched `existing.id`, `existing.createdAt`, and existing form/doc customizations
 * - Injects canonical SEO fields from `src/lib/seoData.ts`
 */
export function mapCatalogServiceToFirestoreRecord(
  service: Service,
  options: SyncMapOptions = {}
): FirestoreServiceRecord {
  const existing = options.existing || null;
  const nowIso = (options.nowIso || new Date().toISOString()).slice(0, 50);
  const preserveCustom = options.preserveExistingCustomizations !== false;
  const preserveCustomSeo = preserveCustom && !options.forceRefreshSeo;

  const enriched = enrichServiceWithSeoData(service, {
    preserveCustomSeo: false,
  });

  const resolvedSeo = getServiceSeoMetadata(service.slug || service.id, enriched);
  const existingHasValidSeoTitle =
    preserveCustomSeo && typeof existing?.seoTitle === 'string' && existing.seoTitle.trim().length > 0;
  const existingHasValidSeoDesc =
    preserveCustomSeo && typeof existing?.seoDescription === 'string' && existing.seoDescription.trim().length > 0;
  const existingHasValidFocusKw =
    preserveCustomSeo && typeof existing?.focusKeyword === 'string' && existing.focusKeyword.trim().length > 0;
  const existingHasValidCanonical =
    preserveCustomSeo && typeof existing?.canonicalUrl === 'string' && existing.canonicalUrl.trim().length > 0;

  const targetId = clipStr(existing?.id || service.id, 80);
  const targetSlug = clipStr(existing?.slug || service.slug, 120).toLowerCase();
  const normalizedCat = resolveCategorySlug(service.category);
  const finalCategory = clipStr(
    normalizedCat === 'all' ? existing?.category || 'personal' : normalizedCat,
    64
  );

  const integrationType = VALID_INTEGRATION_TYPES.has(String(service.integrationType))
    ? service.integrationType
    : 'manual_assistance';
  const availability = VALID_AVAILABILITY.has(String(service.availability))
    ? service.availability
    : 'Live';

  const resolvedFormFields =
    preserveCustom && Array.isArray(existing?.formFields) && existing.formFields.length > 0
      ? existing.formFields
      : service.formFields || [];
  const resolvedDocs =
    preserveCustom && Array.isArray(existing?.requiredDocs) && existing.requiredDocs.length > 0
      ? existing.requiredDocs
      : service.requiredDocs || [];
  const resolvedFaqs =
    preserveCustom && Array.isArray(existing?.faqs) && existing.faqs.length > 0
      ? existing.faqs
      : service.faqs || [];
  const resolvedProcess =
    preserveCustom && Array.isArray(existing?.processSteps) && existing.processSteps.length > 0
      ? existing.processSteps
      : service.processSteps || [];
  const resolvedEligibility =
    preserveCustom && Array.isArray(existing?.eligibility) && existing.eligibility.length > 0
      ? existing.eligibility
      : service.eligibility || [];

  const createdAt = clipStr(
    (existing as Record<string, any> | null)?.createdAt || nowIso,
    50
  );

  const payload: Record<string, any> = {
    id: targetId,
    slug: targetSlug,
    name: clipStr(service.name, 160),
    nameHi: clipStr(service.nameHi || service.name, 180),
    category: finalCategory,
    productType: service.productType || 'service',
    shortDesc: clipStr(service.shortDesc || service.name, 500),
    shortDescHi: clipStr(service.shortDescHi || service.shortDesc || service.name, 500),
    fullDesc: clipStr(service.fullDesc || service.shortDesc || service.name, 4000),
    iconName: clipStr(service.iconName || 'FileText', 60),
    serviceCharge: Math.max(0, Number(service.serviceCharge || 0)),
    govtFees: Math.max(0, Number(service.govtFees || 0)),
    thirdPartyFees: Math.max(0, Number(service.thirdPartyFees || 0)),
    additionalCharge: Math.max(0, Number(service.additionalCharge || 0)),
    urgentFee: Math.max(0, Number(service.urgentFee || 0)),
    discountInr: Math.max(0, Number(service.discountInr || 0)),
    taxRateBps: Math.max(0, Number(service.taxRateBps || 0)),
    taxInclusive: Boolean(service.taxInclusive ?? false),
    billingUnit: service.billingUnit || 'one_time',
    pricingType: service.pricingType || 'fixed',
    deliveryType: service.deliveryType || 'online',
    formVersion: Math.max(1, Number(existing?.formVersion || service.formVersion || 1)),
    slaHours: Math.max(1, Number(service.slaHours || 72)),
    published: existing?.published !== undefined ? Boolean(existing.published) : Boolean(service.published ?? true),
    estimatedTime: clipStr(service.estimatedTime || '3 - 5 Working Days', 100),
    integrationType,
    availability,
    customerConsentRequired: Boolean(service.customerConsentRequired ?? true),
    b2bSupported: Boolean(service.b2bSupported),
    popular: Boolean(service.popular),
    featured: Boolean(service.featured),
    isCustomQuote: Boolean(service.isCustomQuote),
    seoTitle: clipStr(
      existingHasValidSeoTitle ? existing!.seoTitle : resolvedSeo?.seoTitle || enriched.seoTitle,
      120
    ),
    seoDescription: clipStr(
      existingHasValidSeoDesc ? existing!.seoDescription : resolvedSeo?.seoDescription || enriched.seoDescription,
      240
    ),
    focusKeyword: clipStr(
      existingHasValidFocusKw ? existing!.focusKeyword : resolvedSeo?.focusKeyword || enriched.focusKeyword,
      100
    ),
    canonicalUrl: clipStr(
      existingHasValidCanonical
        ? existing!.canonicalUrl
        : service.canonicalUrl?.trim() || resolvedSeo?.canonicalUrl || `https://digitalindiaproject.com/services/${targetSlug}`,
      250
    ),
    eligibility: resolvedEligibility.slice(0, 20),
    requiredDocs: resolvedDocs.slice(0, 20),
    processSteps: resolvedProcess.slice(0, 12),
    formFields: resolvedFormFields.slice(0, 40),
    faqs: resolvedFaqs.slice(0, 20),
    createdAt,
    updatedAt: nowIso,
  };

  if (service.subcategory) payload.subcategory = clipStr(service.subcategory, 100);
  if (service.fullDescHi) payload.fullDescHi = clipStr(service.fullDescHi, 4000);
  if (service.coverImageUrl) payload.coverImageUrl = clipStr(service.coverImageUrl, 500);
  if (service.partnerPriceInr !== undefined) payload.partnerPriceInr = Math.max(0, Number(service.partnerPriceInr));
  if (service.govtFeeNote) payload.govtFeeNote = clipStr(service.govtFeeNote, 500);
  if (service.commissionNote) payload.commissionNote = clipStr(service.commissionNote, 200);
  if (Array.isArray(service.supportedFilingModes) && service.supportedFilingModes.length > 0) {
    payload.supportedFilingModes = service.supportedFilingModes.slice(0, 4);
  }
  if (service.autoAssignRule) payload.autoAssignRule = service.autoAssignRule;
  if (service.serviceDisclaimer) payload.serviceDisclaimer = clipStr(service.serviceDisclaimer, 1000);
  if (service.regulatedNotice) payload.regulatedNotice = clipStr(service.regulatedNotice, 600);
  if (service.instructions) payload.instructions = clipStr(service.instructions, 1000);
  if (Array.isArray(service.conditions) && service.conditions.length > 0) {
    payload.conditions = service.conditions.slice(0, 20);
  }
  if (service.apiSetuRef) payload.apiSetuRef = clipStr(service.apiSetuRef, 120);
  if (service.providerApprovalStatus) payload.providerApprovalStatus = clipStr(service.providerApprovalStatus, 100);
  if (Array.isArray(service.includedServiceIds) && service.includedServiceIds.length > 0) {
    payload.includedServiceIds = service.includedServiceIds.slice(0, 20);
  }
  if (Array.isArray(service.exclusions) && service.exclusions.length > 0) {
    payload.exclusions = service.exclusions.slice(0, 20);
  }
  if (service.packageSavingsInr !== undefined) {
    payload.packageSavingsInr = Math.max(0, Number(service.packageSavingsInr));
  }
  if (service.digitalAsset) payload.digitalAsset = service.digitalAsset;

  // Enforce strict key allowlist from firestore.rules
  const sanitized: Record<string, any> = {};
  for (const key of FIRESTORE_SERVICE_ALLOWED_KEYS) {
    if (payload[key] !== undefined) {
      sanitized[key] = payload[key];
    }
  }

  return sanitized as FirestoreServiceRecord;
}

/**
 * Checks if an existing `services` record semantically differs from the mapped candidate
 * (ignoring `updatedAt` timestamps so repeated runs are strictly idempotent).
 */
export function hasServiceRecordChanged(
  existing: Partial<Service> | Record<string, any> | null | undefined,
  candidate: FirestoreServiceRecord
): boolean {
  if (!existing) return true;

  const comparableKeys: (keyof FirestoreServiceRecord)[] = [
    'id',
    'slug',
    'name',
    'nameHi',
    'category',
    'subcategory',
    'productType',
    'shortDesc',
    'shortDescHi',
    'fullDesc',
    'iconName',
    'serviceCharge',
    'govtFees',
    'thirdPartyFees',
    'additionalCharge',
    'urgentFee',
    'discountInr',
    'taxRateBps',
    'billingUnit',
    'pricingType',
    'govtFeeNote',
    'commissionNote',
    'deliveryType',
    'slaHours',
    'published',
    'estimatedTime',
    'integrationType',
    'availability',
    'b2bSupported',
    'popular',
    'featured',
    'isCustomQuote',
    'seoTitle',
    'seoDescription',
    'focusKeyword',
    'canonicalUrl',
  ];

  for (const k of comparableKeys) {
    const prevVal = (existing as Record<string, any>)[k];
    const nextVal = candidate[k];
    if (stableJson(prevVal ?? null) !== stableJson(nextVal ?? null)) {
      return true;
    }
  }

  // Also detect if array/object metadata (digitalAsset / includedServiceIds / requiredDocs) is missing on existing
  if (
    candidate.digitalAsset &&
    stableJson((existing as Record<string, any>).digitalAsset ?? null) !== stableJson(candidate.digitalAsset)
  ) {
    return true;
  }

  return false;
}

/**
 * Maps a catalog `Service` to the exact Cloudflare D1 `services` table schema
 * (`0001_initial_schema.sql` + `0005_catalogue_packages_products.sql`).
 */
export function mapCatalogServiceToD1Record(
  service: Service,
  nowIso: string = new Date().toISOString()
): D1ServiceRecord {
  const seo = getServiceSeoMetadata(service.slug || service.id, service);
  const catDef = CATALOGUE_CATEGORIES.find(
    (c) => c.slug === service.category || c.id === service.category
  );

  return {
    id: service.id,
    category_id: catDef?.id || `cat-${service.category}`,
    slug: service.slug.toLowerCase(),
    name: service.name,
    name_hi: service.nameHi || null,
    short_desc: service.shortDesc || service.name,
    short_desc_hi: service.shortDescHi || null,
    full_desc: service.fullDesc || service.shortDesc || service.name,
    icon_name: service.iconName || 'FileText',
    service_charge: Math.round(Number(service.serviceCharge || 0)),
    govt_fees: Math.round(Number(service.govtFees || 0)),
    estimated_time: service.estimatedTime || '3 - 5 Working Days',
    is_popular: service.popular ? 1 : 0,
    is_featured: service.featured ? 1 : 0,
    is_active: service.published === false ? 0 : 1,
    product_type: service.productType || 'service',
    subcategory: service.subcategory || null,
    billing_unit: service.billingUnit || 'one_time',
    pricing_type: service.pricingType || 'fixed',
    third_party_fee_paise: Math.round(Number(service.thirdPartyFees || 0) * 100),
    urgent_fee_paise: Math.round(Number(service.urgentFee || 0) * 100),
    discount_paise: Math.round(Number(service.discountInr || 0) * 100),
    govt_fee_note: service.govtFeeNote || null,
    commission_note: service.commissionNote || null,
    delivery_type: service.deliveryType || 'online',
    included_service_ids_json: service.includedServiceIds?.length
      ? JSON.stringify(service.includedServiceIds)
      : null,
    exclusions_json: service.exclusions?.length ? JSON.stringify(service.exclusions) : null,
    digital_asset_json: service.digitalAsset ? JSON.stringify(service.digitalAsset) : null,
    seo_title: clipStr(seo?.seoTitle || service.seoTitle || `${service.name} | Digital India Project`, 120),
    seo_description: clipStr(seo?.seoDescription || service.seoDescription || service.shortDesc, 240),
    focus_keyword: clipStr(seo?.focusKeyword || service.focusKeyword || service.name.toLowerCase(), 100),
    conditions_json: service.conditions?.length ? JSON.stringify(service.conditions) : null,
    regulated_notice: service.regulatedNotice || null,
    is_custom_quote: service.isCustomQuote ? 1 : 0,
    updated_at: nowIso,
  };
}

export interface IdempotentServicesSyncPlan {
  toCreate: FirestoreServiceRecord[];
  toUpdate: FirestoreServiceRecord[];
  unchanged: FirestoreServiceRecord[];
  mappedRecords: FirestoreServiceRecord[];
  duplicatesPrevented: string[];
  report: CatalogueImportReport;
}

/**
 * Builds an idempotent, duplicate-free sync plan mapping the catalog list
 * against existing `Services` records (matching by `id` OR lowercase `slug`).
 */
export function planIdempotentServicesSync(params: {
  catalog: Service[];
  existingRecords: Array<Partial<Service> | Record<string, any>>;
  actorName?: string;
  nowIso?: string;
  preserveExistingCustomizations?: boolean;
  forceRefreshSeo?: boolean;
}): IdempotentServicesSyncPlan {
  const nowIso = params.nowIso || new Date().toISOString();
  const actorName = params.actorName || 'Super Admin';

  const existingById = new Map<string, Record<string, any>>();
  const existingBySlug = new Map<string, Record<string, any>>();
  for (const row of params.existingRecords) {
    if (!row) continue;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const slug = typeof row.slug === 'string' ? row.slug.trim().toLowerCase() : '';
    if (id) existingById.set(id, row);
    if (slug) existingBySlug.set(slug, row);
  }

  const seenInputIds = new Set<string>();
  const seenInputSlugs = new Set<string>();
  const duplicatesPrevented: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const toCreate: FirestoreServiceRecord[] = [];
  const toUpdate: FirestoreServiceRecord[] = [];
  const unchanged: FirestoreServiceRecord[] = [];
  const mappedRecords: FirestoreServiceRecord[] = [];

  for (const item of params.catalog) {
    const cleanId = String(item.id || '').trim();
    const cleanSlug = String(item.slug || '').trim().toLowerCase();

    if (!cleanId || !cleanSlug || !item.name) {
      errors.push(`Invalid catalog item skipped (missing id/slug/name): ${cleanId || cleanSlug || 'unknown'}`);
      continue;
    }

    if (seenInputIds.has(cleanId) || seenInputSlugs.has(cleanSlug)) {
      duplicatesPrevented.push(`${cleanId} (${cleanSlug})`);
      continue;
    }
    seenInputIds.add(cleanId);
    seenInputSlugs.add(cleanSlug);

    const existing = existingById.get(cleanId) || existingBySlug.get(cleanSlug) || null;
    const mapped = mapCatalogServiceToFirestoreRecord(item, {
      existing,
      nowIso,
      preserveExistingCustomizations: params.preserveExistingCustomizations,
      forceRefreshSeo: params.forceRefreshSeo,
    });
    mappedRecords.push(mapped);

    if (!existing) {
      toCreate.push(mapped);
    } else if (hasServiceRecordChanged(existing, mapped)) {
      toUpdate.push(mapped);
    } else {
      unchanged.push(mapped);
    }
  }

  if (duplicatesPrevented.length > 0) {
    warnings.push(`Prevented ${duplicatesPrevented.length} duplicate slug/ID entries.`);
  }
  if (toCreate.length === 0 && toUpdate.length === 0 && unchanged.length === params.catalog.length) {
    warnings.push('All catalog services are already up to date in Services schema (idempotent skip).');
  }

  const report: CatalogueImportReport = {
    id: `sync_${Date.now().toString(36)}`,
    timestamp: nowIso,
    actorName,
    sourceFormat: 'system_sync',
    totalProcessed: params.catalog.length,
    createdCount: toCreate.length,
    updatedCount: toUpdate.length,
    skippedCount: unchanged.length + duplicatesPrevented.length,
    errorsCount: errors.length,
    errors,
    warnings,
  };

  return {
    toCreate,
    toUpdate,
    unchanged,
    mappedRecords,
    duplicatesPrevented,
    report,
  };
}

export interface FirestoreWriteOperation {
  operationType: 'set';
  collectionPath: 'services';
  documentId: string;
  documentPath: string;
  slugKey: string;
  idempotentMatchBy: 'slug';
  merge: true;
  changeStatus: 'create' | 'update' | 'skip';
  payload: FirestoreServiceRecord;
}

/**
 * Generates deterministic, slug-idempotent Firestore write operations (`set` with `merge: true`)
 * targeting the existing `/services/{serviceId}` collection (`ServiceProduct` schema).
 */
export function generateFirestoreWriteOperations(params: {
  catalog: Service[];
  existingRecords?: Array<Partial<Service> | Record<string, any>>;
  nowIso?: string;
  preserveExistingCustomizations?: boolean;
  forceRefreshSeo?: boolean;
}): {
  operations: FirestoreWriteOperation[];
  duplicatesPrevented: string[];
  counts: { create: number; update: number; skip: number; total: number };
} {
  const existing = params.existingRecords || [];
  const plan = planIdempotentServicesSync({
    catalog: params.catalog,
    existingRecords: existing,
    nowIso: params.nowIso,
    preserveExistingCustomizations: params.preserveExistingCustomizations,
    forceRefreshSeo: params.forceRefreshSeo,
  });

  const createIds = new Set(plan.toCreate.map((r) => r.id));
  const updateIds = new Set(plan.toUpdate.map((r) => r.id));

  const counts = { create: 0, update: 0, skip: 0, total: 0 };
  const operations: FirestoreWriteOperation[] = plan.mappedRecords.map((record) => {
    const changeStatus: 'create' | 'update' | 'skip' = createIds.has(record.id)
      ? 'create'
      : updateIds.has(record.id)
      ? 'update'
      : 'skip';
    counts[changeStatus] += 1;
    counts.total += 1;

    return {
      operationType: 'set',
      collectionPath: 'services',
      documentId: record.id,
      documentPath: `services/${record.id}`,
      slugKey: record.slug,
      idempotentMatchBy: 'slug',
      merge: true,
      changeStatus,
      payload: record,
    };
  });

  return {
    operations,
    duplicatesPrevented: plan.duplicatesPrevented,
    counts,
  };
}

function sqlString(val: string | null | undefined): string {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

/**
 * Generates idempotent SQL statements targeting existing D1 `service_categories` and `services` tables
 * (`0001_initial_schema.sql` + `0005_catalogue_packages_products.sql`), deduplicated and keyed by `slug`.
 */
export function formatD1UpsertSqlBatch(
  services: Service[],
  nowIso: string = new Date().toISOString()
): string {
  const lines: string[] = [
    '-- Digital India Project: Idempotent Service Catalog Sync SQL',
    `-- Generated at ${nowIso} | Targets existing service_categories & services tables (ON CONFLICT(slug))`,
    '',
  ];

  for (const cat of CATALOGUE_CATEGORIES) {
    lines.push(
      `INSERT INTO service_categories (id, slug, name, name_hi, description, icon_name, badge_color, display_order, category_code, subcategories_json, is_active) VALUES (${sqlString(cat.id)}, ${sqlString(cat.slug)}, ${sqlString(cat.name)}, ${sqlString(cat.nameHi)}, ${sqlString(cat.description)}, ${sqlString(cat.iconName)}, ${sqlString(cat.badgeColor || '#138808')}, ${Number(cat.displayOrder || 0)}, ${sqlString(cat.categoryCode || null)}, ${sqlString(cat.subcategories?.length ? JSON.stringify(cat.subcategories) : null)}, ${cat.isActive === false ? 0 : 1}) ON CONFLICT(slug) DO UPDATE SET name=excluded.name, name_hi=excluded.name_hi, description=excluded.description, icon_name=excluded.icon_name, badge_color=excluded.badge_color, display_order=excluded.display_order, category_code=excluded.category_code, subcategories_json=excluded.subcategories_json, is_active=excluded.is_active;`
    );
  }

  lines.push('');
  const seenSlugs = new Set<string>();
  const seenIds = new Set<string>();

  for (const srv of services) {
    const cleanId = String(srv.id || '').trim();
    const cleanSlug = String(srv.slug || '').trim().toLowerCase();
    if (!cleanId || !cleanSlug || seenSlugs.has(cleanSlug) || seenIds.has(cleanId)) {
      continue;
    }
    seenSlugs.add(cleanSlug);
    seenIds.add(cleanId);

    const row = mapCatalogServiceToD1Record(srv, nowIso);
    lines.push(
      `INSERT INTO services (id, category_id, slug, name, name_hi, short_desc, short_desc_hi, full_desc, icon_name, service_charge, govt_fees, estimated_time, is_popular, is_featured, is_active, product_type, subcategory, billing_unit, pricing_type, third_party_fee_paise, urgent_fee_paise, discount_paise, govt_fee_note, commission_note, delivery_type, included_service_ids_json, exclusions_json, digital_asset_json, seo_title, seo_description, focus_keyword, conditions_json, regulated_notice, is_custom_quote, updated_at) VALUES (${sqlString(row.id)}, ${sqlString(row.category_id)}, ${sqlString(row.slug)}, ${sqlString(row.name)}, ${sqlString(row.name_hi)}, ${sqlString(row.short_desc)}, ${sqlString(row.short_desc_hi)}, ${sqlString(row.full_desc)}, ${sqlString(row.icon_name)}, ${row.service_charge}, ${row.govt_fees}, ${sqlString(row.estimated_time)}, ${row.is_popular}, ${row.is_featured}, ${row.is_active}, ${sqlString(row.product_type)}, ${sqlString(row.subcategory)}, ${sqlString(row.billing_unit)}, ${sqlString(row.pricing_type)}, ${row.third_party_fee_paise}, ${row.urgent_fee_paise}, ${row.discount_paise}, ${sqlString(row.govt_fee_note)}, ${sqlString(row.commission_note)}, ${sqlString(row.delivery_type)}, ${sqlString(row.included_service_ids_json)}, ${sqlString(row.exclusions_json)}, ${sqlString(row.digital_asset_json)}, ${sqlString(row.seo_title)}, ${sqlString(row.seo_description)}, ${sqlString(row.focus_keyword)}, ${sqlString(row.conditions_json)}, ${sqlString(row.regulated_notice)}, ${row.is_custom_quote}, ${sqlString(row.updated_at)}) ON CONFLICT(slug) DO UPDATE SET category_id=excluded.category_id, name=excluded.name, name_hi=excluded.name_hi, short_desc=excluded.short_desc, short_desc_hi=excluded.short_desc_hi, full_desc=excluded.full_desc, icon_name=excluded.icon_name, service_charge=excluded.service_charge, govt_fees=excluded.govt_fees, estimated_time=excluded.estimated_time, is_popular=excluded.is_popular, is_featured=excluded.is_featured, is_active=excluded.is_active, product_type=excluded.product_type, subcategory=excluded.subcategory, billing_unit=excluded.billing_unit, pricing_type=excluded.pricing_type, third_party_fee_paise=excluded.third_party_fee_paise, urgent_fee_paise=excluded.urgent_fee_paise, discount_paise=excluded.discount_paise, govt_fee_note=excluded.govt_fee_note, commission_note=excluded.commission_note, delivery_type=excluded.delivery_type, included_service_ids_json=excluded.included_service_ids_json, exclusions_json=excluded.exclusions_json, digital_asset_json=excluded.digital_asset_json, seo_title=excluded.seo_title, seo_description=excluded.seo_description, focus_keyword=excluded.focus_keyword, conditions_json=excluded.conditions_json, regulated_notice=excluded.regulated_notice, is_custom_quote=excluded.is_custom_quote, updated_at=excluded.updated_at;`
    );
  }

  return lines.join('\n');
}

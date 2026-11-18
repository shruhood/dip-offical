import type { CatalogueImportReport, Service } from '../types';
import { parseCsvRows, slugifyBlogTitle } from './blogSeo';
import { resolveCategorySlug } from '../data/catalogue/categories';

const CATALOGUE_CSV_COLUMNS = [
  'id',
  'slug',
  'name',
  'nameHi',
  'category',
  'subcategory',
  'productType',
  'serviceCharge',
  'govtFees',
  'thirdPartyFees',
  'urgentFee',
  'billingUnit',
  'pricingType',
  'estimatedTime',
  'deliveryType',
  'published',
  'popular',
  'featured',
  'shortDesc',
  'seoTitle',
  'seoDescription',
] as const;

function escapeCsvCell(value: string): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCatalogueToJson(items: Service[]): string {
  return JSON.stringify(
    {
      platform: 'Digital India Project',
      domain: 'https://digitalindiaproject.com',
      exportedAt: new Date().toISOString(),
      count: items.length,
      items,
    },
    null,
    2
  );
}

export function exportCatalogueToCsv(items: Service[]): string {
  const header = CATALOGUE_CSV_COLUMNS.join(',');
  const rows = items.map((item) => {
    const vals: Record<(typeof CATALOGUE_CSV_COLUMNS)[number], string> = {
      id: item.id,
      slug: item.slug,
      name: item.name,
      nameHi: item.nameHi || '',
      category: item.category,
      subcategory: item.subcategory || '',
      productType: item.productType || 'service',
      serviceCharge: String(item.serviceCharge ?? 0),
      govtFees: String(item.govtFees ?? 0),
      thirdPartyFees: String(item.thirdPartyFees ?? 0),
      urgentFee: String(item.urgentFee ?? 0),
      billingUnit: item.billingUnit || 'one_time',
      pricingType: item.pricingType || 'fixed',
      estimatedTime: item.estimatedTime || '',
      deliveryType: item.deliveryType || 'online',
      published: item.published === false ? 'false' : 'true',
      popular: item.popular ? 'true' : 'false',
      featured: item.featured ? 'true' : 'false',
      shortDesc: item.shortDesc || '',
      seoTitle: item.seoTitle || '',
      seoDescription: item.seoDescription || '',
    };
    return CATALOGUE_CSV_COLUMNS.map((c) => escapeCsvCell(vals[c])).join(',');
  });
  return [header, ...rows].join('\r\n');
}

export interface IdempotentImportResult {
  mergedItems: Service[];
  report: CatalogueImportReport;
}

/**
 * Idempotent Catalogue Importer (JSON or CSV)
 * - Matches incoming records against existing catalogue by `id` OR canonical `slug`.
 * - Updates existing records cleanly in place without creating duplicates.
 * - Preserves existing formFields/requiredDocs/faqs if incoming CSV/partial row omits them.
 */
export function runIdempotentCatalogueImport(params: {
  existingItems: Service[];
  rawInput: string | Service[];
  actorName?: string;
  formatHint?: 'json' | 'csv' | 'system_sync';
}): IdempotentImportResult {
  const actorName = params.actorName || 'Super Admin';
  const errors: string[] = [];
  const warnings: string[] = [];
  let sourceFormat: 'json' | 'csv' | 'system_sync' = params.formatHint || 'json';
  let candidates: Record<string, any>[] = [];

  if (Array.isArray(params.rawInput)) {
    candidates = params.rawInput;
    sourceFormat = params.formatHint || 'system_sync';
  } else {
    const trimmed = String(params.rawInput || '').replace(/^\uFEFF/, '').trim();
    if (!trimmed) {
      return {
        mergedItems: params.existingItems,
        report: {
          id: `imp_${Date.now().toString(36)}`,
          timestamp: new Date().toISOString(),
          actorName,
          sourceFormat: 'json',
          totalProcessed: 0,
          createdCount: 0,
          updatedCount: 0,
          skippedCount: 0,
          errorsCount: 1,
          errors: ['Import input is empty. Provide valid CSV or JSON catalogue payload.'],
          warnings: [],
        },
      };
    }

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      sourceFormat = 'json';
      try {
        const parsed = JSON.parse(trimmed);
        candidates = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.items)
          ? parsed.items
          : Array.isArray(parsed?.services)
          ? parsed.services
          : [parsed];
      } catch (err: any) {
        return {
          mergedItems: params.existingItems,
          report: {
            id: `imp_${Date.now().toString(36)}`,
            timestamp: new Date().toISOString(),
            actorName,
            sourceFormat: 'json',
            totalProcessed: 0,
            createdCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            errorsCount: 1,
            errors: [`Invalid JSON format: ${err?.message || 'Parse failed'}`],
            warnings: [],
          },
        };
      }
    } else {
      sourceFormat = 'csv';
      const matrix = parseCsvRows(trimmed);
      if (matrix.length < 2) {
        return {
          mergedItems: params.existingItems,
          report: {
            id: `imp_${Date.now().toString(36)}`,
            timestamp: new Date().toISOString(),
            actorName,
            sourceFormat: 'csv',
            totalProcessed: 0,
            createdCount: 0,
            updatedCount: 0,
            skippedCount: 0,
            errorsCount: 1,
            errors: ['CSV must include a header row and at least one item row.'],
            warnings: [],
          },
        };
      }
      const headers = matrix[0].map((h) => h.trim());
      candidates = matrix.slice(1).map((row) => {
        const obj: Record<string, any> = {};
        headers.forEach((h, idx) => {
          if (h) obj[h] = row[idx] ?? '';
        });
        return obj;
      });
    }
  }

  const nextList = [...params.existingItems];
  const indexById = new Map<string, number>();
  const indexBySlug = new Map<string, number>();
  nextList.forEach((item, idx) => {
    indexById.set(item.id, idx);
    indexBySlug.set(item.slug.toLowerCase(), idx);
  });

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const nowIso = new Date().toISOString();

  candidates.forEach((raw, idx) => {
    const name = String(raw?.name || '').trim();
    if (!name) {
      errors.push(`Row #${idx + 1}: Missing required "name".`);
      skippedCount += 1;
      return;
    }

    const slug = String(raw?.slug || slugifyBlogTitle(name)).trim().toLowerCase();
    const candidateId = String(raw?.id || '').trim();
    const matchedIdx =
      (candidateId && indexById.has(candidateId) ? indexById.get(candidateId) : undefined) ??
      indexBySlug.get(slug);

    const parsedCharge = Number(raw?.serviceCharge ?? 0);
    const parsedGovt = Number(raw?.govtFees ?? 0);
    if (!Number.isFinite(parsedCharge) || parsedCharge < 0 || !Number.isFinite(parsedGovt) || parsedGovt < 0) {
      errors.push(`Row #${idx + 1} ("${name}"): Fees must be non-negative numbers.`);
      skippedCount += 1;
      return;
    }

    const normalizedCategory = resolveCategorySlug(String(raw?.category || 'personal'));
    if (matchedIdx !== undefined) {
      const existing = nextList[matchedIdx];
      const hasSemanticChange =
        existing.name !== name ||
        existing.serviceCharge !== parsedCharge ||
        existing.govtFees !== parsedGovt ||
        existing.category !== (normalizedCategory === 'all' ? existing.category : normalizedCategory) ||
        (raw?.shortDesc !== undefined && existing.shortDesc !== String(raw.shortDesc)) ||
        (raw?.published !== undefined && existing.published !== (String(raw.published) !== 'false' && raw.published !== false));

      if (!hasSemanticChange && sourceFormat === 'system_sync') {
        skippedCount += 1;
        return;
      }

      const updated: Service = {
        ...existing,
        ...raw,
        id: existing.id, // preserve existing primary ID!
        slug: existing.slug,
        name,
        nameHi: raw?.nameHi ? String(raw.nameHi) : existing.nameHi,
        category: normalizedCategory === 'all' ? existing.category : normalizedCategory,
        subcategory: raw?.subcategory ? String(raw.subcategory) : existing.subcategory,
        serviceCharge: parsedCharge,
        govtFees: parsedGovt,
        thirdPartyFees: raw?.thirdPartyFees !== undefined ? Number(raw.thirdPartyFees || 0) : existing.thirdPartyFees,
        urgentFee: raw?.urgentFee !== undefined ? Number(raw.urgentFee || 0) : existing.urgentFee,
        published:
          raw?.published !== undefined
            ? raw.published !== false && String(raw.published).toLowerCase() !== 'false'
            : existing.published,
        popular:
          raw?.popular !== undefined
            ? raw.popular === true || String(raw.popular).toLowerCase() === 'true'
            : existing.popular,
        featured:
          raw?.featured !== undefined
            ? raw.featured === true || String(raw.featured).toLowerCase() === 'true'
            : existing.featured,
        formFields: Array.isArray(raw?.formFields) && raw.formFields.length > 0 ? raw.formFields : existing.formFields,
        requiredDocs: Array.isArray(raw?.requiredDocs) && raw.requiredDocs.length > 0 ? raw.requiredDocs : existing.requiredDocs,
        faqs: Array.isArray(raw?.faqs) && raw.faqs.length > 0 ? raw.faqs : existing.faqs,
        processSteps: Array.isArray(raw?.processSteps) && raw.processSteps.length > 0 ? raw.processSteps : existing.processSteps,
        eligibility: Array.isArray(raw?.eligibility) && raw.eligibility.length > 0 ? raw.eligibility : existing.eligibility,
        updatedAt: nowIso,
      };
      nextList[matchedIdx] = updated;
      updatedCount += 1;
    } else {
      const newId = candidateId || `srv-imp-${slug.slice(0, 32)}-${Date.now().toString(36)}-${idx}`;
      const newService: Service = {
        id: newId,
        slug,
        name,
        nameHi: String(raw?.nameHi || name),
        category: normalizedCategory === 'all' ? 'personal' : normalizedCategory,
        subcategory: raw?.subcategory ? String(raw.subcategory) : 'General',
        productType: raw?.productType || (normalizedCategory === 'digital-products' ? 'digital_product' : 'service'),
        shortDesc: String(raw?.shortDesc || `${name} online assistance on Digital India Project.`),
        shortDescHi: String(raw?.shortDescHi || name),
        fullDesc: String(raw?.fullDesc || raw?.shortDesc || `${name} full service workflow.`),
        iconName: String(raw?.iconName || 'FileText'),
        serviceCharge: parsedCharge,
        govtFees: parsedGovt,
        thirdPartyFees: Number(raw?.thirdPartyFees || 0),
        urgentFee: Number(raw?.urgentFee || 0),
        billingUnit: raw?.billingUnit || 'one_time',
        pricingType: raw?.pricingType || (parsedCharge === 0 ? 'free' : 'fixed'),
        estimatedTime: String(raw?.estimatedTime || '3 - 5 Working Days'),
        deliveryType: raw?.deliveryType || 'online',
        published: raw?.published === undefined ? true : String(raw.published) !== 'false' && raw.published !== false,
        popular: raw?.popular === true || String(raw?.popular) === 'true',
        featured: raw?.featured === true || String(raw?.featured) === 'true',
        integrationType: raw?.integrationType || 'manual_assistance',
        availability: raw?.availability || 'Live',
        eligibility: Array.isArray(raw?.eligibility) ? raw.eligibility : ['Indian residents and registered entities'],
        requiredDocs: Array.isArray(raw?.requiredDocs) ? raw.requiredDocs : [],
        processSteps: Array.isArray(raw?.processSteps)
          ? raw.processSteps
          : [
              { title: '1. Submit Details', desc: 'Complete online intake and upload required proofs.' },
              { title: '2. Desk Processing', desc: 'Verification & filing assistance with live tracking.' },
            ],
        faqs: Array.isArray(raw?.faqs) ? raw.faqs : [],
        formFields: Array.isArray(raw?.formFields) ? raw.formFields : [],
        seoTitle: raw?.seoTitle ? String(raw.seoTitle) : `${name} | Digital India Project`,
        seoDescription: raw?.seoDescription ? String(raw.seoDescription) : String(raw?.shortDesc || name),
        updatedAt: nowIso,
      };
      nextList.push(newService);
      indexById.set(newId, nextList.length - 1);
      indexBySlug.set(slug, nextList.length - 1);
      createdCount += 1;
    }
  });

  if (createdCount === 0 && updatedCount === 0 && skippedCount === candidates.length && candidates.length > 0) {
    warnings.push('No changes detected — catalogue is already synchronized.');
  }

  return {
    mergedItems: nextList,
    report: {
      id: `imp_${Date.now().toString(36)}`,
      timestamp: nowIso,
      actorName,
      sourceFormat,
      totalProcessed: candidates.length,
      createdCount,
      updatedCount,
      skippedCount,
      errorsCount: errors.length,
      errors,
      warnings,
    },
  };
}

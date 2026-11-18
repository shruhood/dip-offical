import { DatabaseRegistry } from '../config/database';
import type { Env } from '../types';
import {
  INDIA_GEOGRAPHY_SEED,
  IndiaLocationLevel,
  IndiaLocationRecord,
  IndiaRegionZone,
} from '../../src/data/indiaGeography';
import { INITIAL_SERVICES } from '../../src/data/initialData';
import type { Service } from '../../src/types';
import {
  DirectoryQualityEvaluation,
  DirectoryTranslationRecord,
  evaluateDirectoryPageQuality,
} from '../../src/lib/indiaDirectorySeo';
import type { SupportedLanguageCode } from '../../src/data/indianLanguages';

export interface SeoImportBatchRecord {
  id: string;
  sourceName: string;
  format: string;
  importedCount: number;
  skippedDuplicates: number;
  errorsCount: number;
  actorUserId: string;
  summary: string;
  createdAt: string;
}

function safeParseJson<T>(raw: any, fallback: T): T {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function mapD1RowToLocation(row: Record<string, any>): IndiaLocationRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    parentId: row.parent_id ? String(row.parent_id) : null,
    level: (row.level || 'city') as IndiaLocationLevel,
    stateSlug: String(row.state_slug),
    districtSlug: row.district_slug ? String(row.district_slug) : undefined,
    citySlug: row.city_slug ? String(row.city_slug) : undefined,
    canonicalPath: String(row.canonical_path),
    name: String(row.name),
    nativeNames: safeParseJson<Partial<Record<string, string>>>(row.native_names_json, {}),
    lgdCode: String(row.lgd_code || ''),
    censusCode: row.census_code ? String(row.census_code) : undefined,
    isoCode: row.iso_code ? String(row.iso_code) : undefined,
    capital: row.capital ? String(row.capital) : undefined,
    pinCodes: String(row.pin_codes || '000000'),
    latitude: Number(row.latitude) || 20.5937,
    longitude: Number(row.longitude) || 78.9629,
    officialLanguages: safeParseJson<string[]>(row.official_languages_json, ['en', 'hi']),
    regionZone: (row.region_zone || 'West India') as IndiaRegionZone,
    sourceAuthority: String(row.source_authority || 'Local Government Directory (LGD), Govt. of India'),
    sourceUrl: String(row.source_url || 'https://lgdirectory.gov.in/'),
    verified: Boolean(row.verified),
    published: Boolean(row.published),
    indexPolicy: (row.index_policy || 'auto') as 'auto' | 'index' | 'noindex',
    highlightedServiceSlugs: safeParseJson<string[]>(row.highlighted_services_json, [
      'pan-card',
      'gst-registration',
      'udyam-registration',
    ]),
    customSummary: String(row.custom_summary || ''),
    seoTitle: row.seo_title ? String(row.seo_title) : undefined,
    seoDescription: row.seo_description ? String(row.seo_description) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function mapD1RowToTranslation(row: Record<string, any>): DirectoryTranslationRecord {
  return {
    id: String(row.id),
    locationId: String(row.location_id),
    langCode: String(row.lang_code) as SupportedLanguageCode,
    localizedName: row.localized_name ? String(row.localized_name) : undefined,
    headline: row.headline ? String(row.headline) : undefined,
    summary: row.summary ? String(row.summary) : undefined,
    seoTitle: row.seo_title ? String(row.seo_title) : undefined,
    seoDescription: row.seo_description ? String(row.seo_description) : undefined,
    faqs: safeParseJson<Array<{ question: string; answer: string }>>(row.faqs_json, []),
    translationStatus: (row.translation_status || 'machine_reviewed') as DirectoryTranslationRecord['translationStatus'],
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function getDirectoryLocations(env: Env): Promise<{
  locations: IndiaLocationRecord[];
  source: 'd1_merged' | 'seed';
}> {
  const merged = new Map<string, IndiaLocationRecord>();
  for (const seed of INDIA_GEOGRAPHY_SEED) {
    merged.set(seed.canonicalPath.toLowerCase(), seed);
  }

  try {
    const { db } = await new DatabaseRegistry(env).resolveAndEnsure('dip_content');
    if (!db) {
      return { locations: Array.from(merged.values()), source: 'seed' };
    }
    const res = await db
      .prepare(`SELECT * FROM india_locations ORDER BY level ASC, name ASC`)
      .all<Record<string, any>>();
    const d1Rows = res.results || [];
    if (d1Rows.length === 0) {
      return { locations: Array.from(merged.values()), source: 'seed' };
    }
    for (const row of d1Rows) {
      const mapped = mapD1RowToLocation(row);
      merged.set(mapped.canonicalPath.toLowerCase(), mapped);
    }
    return { locations: Array.from(merged.values()), source: 'd1_merged' };
  } catch {
    return { locations: Array.from(merged.values()), source: 'seed' };
  }
}

export async function getDirectoryTranslationsForLocation(
  env: Env,
  locationId: string
): Promise<DirectoryTranslationRecord[]> {
  try {
    const { db } = await new DatabaseRegistry(env).resolveAndEnsure('dip_content');
    if (!db) return [];
    const res = await db
      .prepare(`SELECT * FROM directory_translations WHERE location_id = ?`)
      .bind(locationId)
      .all<Record<string, any>>();
    return (res.results || []).map(mapD1RowToTranslation);
  } catch {
    return [];
  }
}

export async function getAllDirectoryTranslations(
  env: Env,
  limit = 500
): Promise<DirectoryTranslationRecord[]> {
  try {
    const { db } = await new DatabaseRegistry(env).resolveAndEnsure('dip_content');
    if (!db) return [];
    const res = await db
      .prepare(`SELECT * FROM directory_translations ORDER BY updated_at DESC LIMIT ?`)
      .bind(limit)
      .all<Record<string, any>>();
    return (res.results || []).map(mapD1RowToTranslation);
  } catch {
    return [];
  }
}

export async function getPublishedDirectoryServices(env: Env): Promise<Service[]> {
  const fallback = INITIAL_SERVICES.filter((s) => s.published !== false);
  try {
    const { db } = await new DatabaseRegistry(env).resolveAndEnsure('dip_services');
    if (!db) return fallback;
    const res = await db
      .prepare(
        `SELECT id, slug, name, name_hi, short_desc, is_popular, is_active FROM services WHERE is_active = 1 LIMIT 200`
      )
      .all<Record<string, any>>();
    const rows = res.results || [];
    if (rows.length === 0) return fallback;
    const bySlug = new Map<string, Service>();
    for (const srv of fallback) {
      bySlug.set(srv.slug, srv);
    }
    for (const r of rows) {
      const slug = String(r.slug);
      const existing = bySlug.get(slug);
      if (existing) {
        bySlug.set(slug, {
          ...existing,
          name: r.name ? String(r.name) : existing.name,
          nameHi: r.name_hi ? String(r.name_hi) : existing.nameHi,
          shortDesc: r.short_desc ? String(r.short_desc) : existing.shortDesc,
          popular: Boolean(r.is_popular),
        });
      }
    }
    return Array.from(bySlug.values());
  } catch {
    return fallback;
  }
}

export async function upsertDirectoryLocation(
  env: Env,
  loc: IndiaLocationRecord,
  quality?: DirectoryQualityEvaluation
): Promise<{ saved: boolean; error?: string }> {
  const { db } = await new DatabaseRegistry(env).resolveAndEnsure('dip_content');
  if (!db) return { saved: false, error: 'D1 dip_content binding unavailable' };

  const evalRes = quality || evaluateDirectoryPageQuality(loc);
  try {
    await db
      .prepare(
        `INSERT INTO india_locations (
          id, slug, parent_id, level, state_slug, district_slug, city_slug,
          canonical_path, name, native_names_json, lgd_code, census_code, iso_code, capital,
          pin_codes, latitude, longitude, official_languages_json, region_zone,
          source_authority, source_url, verified, published, index_policy,
          highlighted_services_json, custom_summary, seo_title, seo_description,
          quality_score, content_hash, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          slug = excluded.slug,
          parent_id = excluded.parent_id,
          level = excluded.level,
          state_slug = excluded.state_slug,
          district_slug = excluded.district_slug,
          city_slug = excluded.city_slug,
          canonical_path = excluded.canonical_path,
          name = excluded.name,
          native_names_json = excluded.native_names_json,
          lgd_code = excluded.lgd_code,
          census_code = excluded.census_code,
          iso_code = excluded.iso_code,
          capital = excluded.capital,
          pin_codes = excluded.pin_codes,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          official_languages_json = excluded.official_languages_json,
          region_zone = excluded.region_zone,
          source_authority = excluded.source_authority,
          source_url = excluded.source_url,
          verified = excluded.verified,
          published = excluded.published,
          index_policy = excluded.index_policy,
          highlighted_services_json = excluded.highlighted_services_json,
          custom_summary = excluded.custom_summary,
          seo_title = excluded.seo_title,
          seo_description = excluded.seo_description,
          quality_score = excluded.quality_score,
          content_hash = excluded.content_hash,
          updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        loc.id,
        loc.slug,
        loc.parentId,
        loc.level,
        loc.stateSlug,
        loc.districtSlug || null,
        loc.citySlug || null,
        loc.canonicalPath,
        loc.name,
        JSON.stringify(loc.nativeNames || {}),
        loc.lgdCode,
        loc.censusCode || null,
        loc.isoCode || null,
        loc.capital || null,
        loc.pinCodes || '000000',
        loc.latitude,
        loc.longitude,
        JSON.stringify(loc.officialLanguages || ['en', 'hi']),
        loc.regionZone,
        loc.sourceAuthority,
        loc.sourceUrl,
        loc.verified ? 1 : 0,
        loc.published ? 1 : 0,
        loc.indexPolicy,
        JSON.stringify(loc.highlightedServiceSlugs || []),
        loc.customSummary || '',
        loc.seoTitle || null,
        loc.seoDescription || null,
        evalRes.score,
        evalRes.contentHash
      )
      .run();
    return { saved: true };
  } catch (err: any) {
    return { saved: false, error: err?.message || 'Failed to save directory location' };
  }
}

export async function upsertDirectoryTranslation(
  env: Env,
  input: Omit<DirectoryTranslationRecord, 'id' | 'updatedAt'> & { id?: string; updatedBy?: string }
): Promise<{ saved: boolean; id: string; error?: string }> {
  const { db } = await new DatabaseRegistry(env).resolveAndEnsure('dip_content');
  const id = input.id || `trans_${input.locationId}_${input.langCode}`;
  if (!db) return { saved: false, id, error: 'D1 dip_content binding unavailable' };

  try {
    await db
      .prepare(
        `INSERT INTO directory_translations (
          id, location_id, lang_code, localized_name, headline, summary,
          seo_title, seo_description, faqs_json, translation_status, updated_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(location_id, lang_code) DO UPDATE SET
          localized_name = excluded.localized_name,
          headline = excluded.headline,
          summary = excluded.summary,
          seo_title = excluded.seo_title,
          seo_description = excluded.seo_description,
          faqs_json = excluded.faqs_json,
          translation_status = excluded.translation_status,
          updated_by = excluded.updated_by,
          updated_at = CURRENT_TIMESTAMP`
      )
      .bind(
        id,
        input.locationId,
        input.langCode,
        input.localizedName || null,
        input.headline || null,
        input.summary || null,
        input.seoTitle || null,
        input.seoDescription || null,
        JSON.stringify(input.faqs || []),
        input.translationStatus || 'machine_reviewed',
        input.updatedBy || 'admin'
      )
      .run();
    return { saved: true, id };
  } catch (err: any) {
    return { saved: false, id, error: err?.message || 'Failed to persist translation' };
  }
}

export async function recordSeoImportBatch(
  env: Env,
  batch: Omit<SeoImportBatchRecord, 'id' | 'createdAt'>
): Promise<void> {
  try {
    const { db } = await new DatabaseRegistry(env).resolveAndEnsure('dip_content');
    if (!db) return;
    await db
      .prepare(
        `INSERT INTO seo_import_batches (id, source_name, format, imported_count, skipped_duplicates, errors_count, actor_user_id, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        `imp_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
        batch.sourceName,
        batch.format,
        batch.importedCount,
        batch.skippedDuplicates,
        batch.errorsCount,
        batch.actorUserId,
        batch.summary
      )
      .run();
  } catch {
    // Non-blocking audit log
  }
}

export async function listSeoImportBatches(env: Env): Promise<SeoImportBatchRecord[]> {
  try {
    const { db } = await new DatabaseRegistry(env).resolveAndEnsure('dip_content');
    if (!db) return [];
    const res = await db
      .prepare(`SELECT * FROM seo_import_batches ORDER BY created_at DESC LIMIT 25`)
      .all<Record<string, any>>();
    return (res.results || []).map((r) => ({
      id: String(r.id),
      sourceName: String(r.source_name),
      format: String(r.format),
      importedCount: Number(r.imported_count || 0),
      skippedDuplicates: Number(r.skipped_duplicates || 0),
      errorsCount: Number(r.errors_count || 0),
      actorUserId: String(r.actor_user_id),
      summary: String(r.summary || ''),
      createdAt: String(r.created_at || ''),
    }));
  } catch {
    return [];
  }
}

export function evaluateAllDirectoryIndexableEntries(
  locations: IndiaLocationRecord[],
  services: Service[]
): Array<{
  location: IndiaLocationRecord;
  quality: DirectoryQualityEvaluation;
}> {
  const seenContentHashes = new Set<string>();
  const childCountByParent = new Map<string, number>();
  for (const loc of locations) {
    if (loc.parentId && loc.published) {
      childCountByParent.set(loc.parentId, (childCountByParent.get(loc.parentId) || 0) + 1);
    }
  }
  const activeServicesCount = services.filter((s) => s.published !== false).length;

  return locations.map((loc) => ({
    location: loc,
    quality: evaluateDirectoryPageQuality(loc, {
      servicesCount: activeServicesCount || loc.highlightedServiceSlugs.length,
      childCount: childCountByParent.get(loc.id) || 0,
      seenContentHashes,
    }),
  }));
}

import { Hono } from 'hono';
import type { AppVariables, Env } from '../types';
import { buildApiResponse } from '../middleware/security';
import { requireAuth, requirePermission } from '../middleware/auth';
import { recordAuditEvent } from '../services/auditService';
import { DatabaseRegistry } from '../config/database';
import {
  INDIA_GEOGRAPHY_SEED,
  IndiaLocationRecord,
  getStatesCountSummary,
} from '../../src/data/indiaGeography';
import { SUPPORTED_INDIAN_LANGUAGES, isSupportedLangCode } from '../../src/data/indianLanguages';
import {
  buildDirectoryMetaAndJsonLd,
  evaluateDirectoryPageQuality,
  parseIndiaDirectoryPath,
  parseOfficialGeographyImport,
  resolveHierarchyChain,
} from '../../src/lib/indiaDirectorySeo';
import {
  evaluateAllDirectoryIndexableEntries,
  getAllDirectoryTranslations,
  getDirectoryLocations,
  getDirectoryTranslationsForLocation,
  getPublishedDirectoryServices,
  listSeoImportBatches,
  recordSeoImportBatch,
  upsertDirectoryLocation,
  upsertDirectoryTranslation,
} from '../lib/directoryStore';

export const publicDirectoryRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();
export const adminDirectoryRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

adminDirectoryRouter.use('*', requireAuth);

// Public directory API endpoints
publicDirectoryRouter.get('/languages', (c) => {
  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Supported Eighth Schedule Indian languages retrieved',
      requestId: c.get('requestId'),
      data: SUPPORTED_INDIAN_LANGUAGES,
    })
  );
});

publicDirectoryRouter.get('/locations', async (c) => {
  const level = (c.req.query('level') || '').trim().toLowerCase();
  const stateSlug = (c.req.query('stateSlug') || '').trim().toLowerCase();
  const districtSlug = (c.req.query('districtSlug') || '').trim().toLowerCase();
  const q = (c.req.query('q') || '').trim().toLowerCase();

  const { locations, source } = await getDirectoryLocations(c.env);
  const filtered = locations.filter((loc) => {
    if (!loc.published) return false;
    if (level && loc.level !== level) return false;
    if (stateSlug && loc.stateSlug !== stateSlug) return false;
    if (districtSlug && loc.districtSlug !== districtSlug) return false;
    if (q) {
      const hay = `${loc.name} ${loc.lgdCode} ${loc.pinCodes} ${loc.stateSlug}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Loaded ${filtered.length} India Digital Directory locations`,
      requestId: c.get('requestId'),
      data: {
        source,
        summary: getStatesCountSummary(),
        total: filtered.length,
        items: filtered,
      },
    })
  );
});

publicDirectoryRouter.get('/resolve', async (c) => {
  const rawPath = (c.req.query('path') || '/india').trim();
  const langQuery = (c.req.query('lang') || '').trim().toLowerCase();

  const parsed = parseIndiaDirectoryPath(rawPath);
  if (langQuery && isSupportedLangCode(langQuery)) {
    parsed.lang = langQuery;
  }

  const [{ locations, source }, services] = await Promise.all([
    getDirectoryLocations(c.env),
    getPublishedDirectoryServices(c.env),
  ]);

  const hierarchy = resolveHierarchyChain(parsed, locations);
  if (!hierarchy.current) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Directory location not found for requested path',
        requestId: c.get('requestId'),
        data: null,
        errorCode: 'DIRECTORY_LOCATION_NOT_FOUND',
      }),
      404
    );
  }

  const translations = await getDirectoryTranslationsForLocation(c.env, hierarchy.current.id);
  const translation = translations.find((t) => t.langCode === parsed.lang) || null;

  const seoPkg = buildDirectoryMetaAndJsonLd({
    parsed,
    locations,
    translation,
    services,
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'India directory node resolved',
      requestId: c.get('requestId'),
      data: {
        source,
        parsed,
        location: hierarchy.current,
        hierarchy: {
          state: hierarchy.state || null,
          district: hierarchy.district || null,
          city: hierarchy.city || null,
        },
        childLocations: hierarchy.childLocations,
        siblingLocations: hierarchy.siblingLocations,
        translation,
        seo: seoPkg,
      },
    })
  );
});

// Admin programmatic SEO console endpoints
adminDirectoryRouter.get('/overview', requirePermission('services.edit'), async (c) => {
  const [{ locations, source }, services, translations, importBatches] = await Promise.all([
    getDirectoryLocations(c.env),
    getPublishedDirectoryServices(c.env),
    getAllDirectoryTranslations(c.env, 500),
    listSeoImportBatches(c.env),
  ]);

  const audited = evaluateAllDirectoryIndexableEntries(locations, services);
  const stats = {
    totalLocations: audited.length,
    statesCount: audited.filter((a) => a.location.level === 'state').length,
    unionTerritoriesCount: audited.filter((a) => a.location.level === 'ut').length,
    districtsCount: audited.filter((a) => a.location.level === 'district').length,
    citiesCount: audited.filter((a) => a.location.level === 'city' || a.location.level === 'town').length,
    publishedCount: audited.filter((a) => a.location.published).length,
    indexableCount: audited.filter((a) => a.quality.indexStatus === 'index').length,
    noindexedCount: audited.filter((a) => a.quality.indexStatus === 'noindex').length,
    thinPagesCount: audited.filter((a) => a.quality.isThin).length,
    duplicatePagesCount: audited.filter((a) => a.quality.isDuplicate).length,
    translationsCount: translations.length,
    supportedLanguagesCount: SUPPORTED_INDIAN_LANGUAGES.length,
  };

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Admin directory SEO overview loaded',
      requestId: c.get('requestId'),
      data: {
        source,
        stats,
        locations: audited.map((a) => ({
          ...a.location,
          quality: a.quality,
        })),
        translations,
        importBatches,
      },
    })
  );
});

adminDirectoryRouter.post('/seed', requirePermission('services.edit'), async (c) => {
  const user = c.get('user')!;
  const services = await getPublishedDirectoryServices(c.env);
  const evaluated = evaluateAllDirectoryIndexableEntries(INDIA_GEOGRAPHY_SEED, services);

  let savedCount = 0;
  for (const item of evaluated) {
    const res = await upsertDirectoryLocation(c.env, item.location, item.quality);
    if (res.saved) savedCount += 1;
  }

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'DIRECTORY_SEED_SYNCED',
    resourceType: 'india_directory',
    resourceId: 'seed_sync',
    summary: `Synced ${savedCount}/${INDIA_GEOGRAPHY_SEED.length} verified Indian States, UTs, Districts & Cities into D1 dip_content`,
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Synchronized ${savedCount} verified India locations into D1`,
      requestId: c.get('requestId'),
      data: { totalSeedCount: INDIA_GEOGRAPHY_SEED.length, savedCount },
    })
  );
});

adminDirectoryRouter.post('/locations', requirePermission('services.edit'), async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => ({}))) as Partial<IndiaLocationRecord>;

  if (!body.name?.trim() || !body.stateSlug?.trim() || !body.lgdCode?.trim()) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'name, stateSlug, and lgdCode are required',
        requestId: c.get('requestId'),
        data: null,
        errorCode: 'VALIDATION_ERROR',
      }),
      400
    );
  }

  const level = body.level || 'city';
  const stateSlug = body.stateSlug.toLowerCase().trim();
  const districtSlug = body.districtSlug ? body.districtSlug.toLowerCase().trim() : undefined;
  const citySlug = body.citySlug ? body.citySlug.toLowerCase().trim() : undefined;
  const slug = (body.slug || citySlug || districtSlug || stateSlug).toLowerCase().trim();

  const canonicalPath =
    body.canonicalPath ||
    (level === 'country'
      ? '/india'
      : level === 'state' || level === 'ut'
      ? `/india/${stateSlug}`
      : level === 'district'
      ? `/india/${stateSlug}/${districtSlug || slug}`
      : `/india/${stateSlug}/${districtSlug || 'central'}/${citySlug || slug}`);

  const record: IndiaLocationRecord = {
    id:
      body.id ||
      `loc-${[stateSlug, districtSlug, citySlug].filter(Boolean).join('-') || 'custom'}`,
    slug,
    parentId:
      body.parentId ??
      (level === 'country'
        ? null
        : level === 'state' || level === 'ut'
        ? 'loc-in'
        : level === 'district'
        ? `loc-${stateSlug}`
        : `loc-${stateSlug}-${districtSlug || 'central'}`),
    level,
    stateSlug,
    districtSlug,
    citySlug,
    canonicalPath,
    name: body.name.trim(),
    nativeNames: body.nativeNames || {},
    lgdCode: body.lgdCode.trim(),
    censusCode: body.censusCode,
    isoCode: body.isoCode,
    capital: body.capital,
    pinCodes: String(body.pinCodes || '000000').trim(),
    latitude: Number(body.latitude) || 20.5937,
    longitude: Number(body.longitude) || 78.9629,
    officialLanguages: Array.isArray(body.officialLanguages) ? body.officialLanguages : ['en', 'hi'],
    regionZone: body.regionZone || 'West India',
    sourceAuthority:
      body.sourceAuthority || 'Local Government Directory (LGD), Govt. of India',
    sourceUrl: body.sourceUrl || 'https://lgdirectory.gov.in/',
    verified: body.verified !== false,
    published: body.published !== false,
    indexPolicy: body.indexPolicy || 'auto',
    highlightedServiceSlugs:
      Array.isArray(body.highlightedServiceSlugs) && body.highlightedServiceSlugs.length > 0
        ? body.highlightedServiceSlugs
        : ['pan-card', 'gst-registration', 'udyam-registration'],
    customSummary: String(body.customSummary || '').trim(),
    seoTitle: body.seoTitle,
    seoDescription: body.seoDescription,
    updatedAt: new Date().toISOString(),
  };

  const quality = evaluateDirectoryPageQuality(record);
  const saved = await upsertDirectoryLocation(c.env, record, quality);
  if (!saved.saved) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: saved.error || 'Failed to save directory location',
        requestId: c.get('requestId'),
        data: null,
        errorCode: 'D1_WRITE_FAILED',
      }),
      500
    );
  }

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'DIRECTORY_LOCATION_UPSERTED',
    resourceType: 'india_location',
    resourceId: record.id,
    summary: `Saved directory location ${record.name} (${record.canonicalPath}) [indexStatus=${quality.indexStatus}]`,
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Saved ${record.name}`,
      requestId: c.get('requestId'),
      data: { ...record, quality },
    })
  );
});

adminDirectoryRouter.delete('/locations/:id', requirePermission('services.edit'), async (c) => {
  const user = c.get('user')!;
  const id = String(c.req.param('id') || '').trim();
  const { db } = await new DatabaseRegistry(c.env).resolveAndEnsure('dip_content');
  if (!db) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'D1 unavailable',
        requestId: c.get('requestId'),
        data: null,
      }),
      503
    );
  }

  await db.prepare(`DELETE FROM india_locations WHERE id = ?`).bind(id).run();
  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'DIRECTORY_LOCATION_DELETED',
    resourceType: 'india_location',
    resourceId: id,
    summary: `Removed custom directory node ${id}`,
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: 'Directory location deleted',
      requestId: c.get('requestId'),
      data: { id },
    })
  );
});

adminDirectoryRouter.put('/translations', requirePermission('services.edit'), async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, any>;
  const locationId = String(body.locationId || '').trim();
  const langCode = String(body.langCode || '').trim().toLowerCase();

  if (!locationId || !isSupportedLangCode(langCode)) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: 'Valid locationId and supported Indian language code are required',
        requestId: c.get('requestId'),
        data: null,
        errorCode: 'VALIDATION_ERROR',
      }),
      400
    );
  }

  const res = await upsertDirectoryTranslation(c.env, {
    locationId,
    langCode,
    localizedName: body.localizedName ? String(body.localizedName).trim() : undefined,
    headline: body.headline ? String(body.headline).trim() : undefined,
    summary: body.summary ? String(body.summary).trim() : undefined,
    seoTitle: body.seoTitle ? String(body.seoTitle).trim() : undefined,
    seoDescription: body.seoDescription ? String(body.seoDescription).trim() : undefined,
    faqs: Array.isArray(body.faqs) ? body.faqs : undefined,
    translationStatus: body.translationStatus || 'verified',
    updatedBy: user.id,
  });

  if (!res.saved) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: res.error || 'Failed to save translation',
        requestId: c.get('requestId'),
        data: null,
      }),
      500
    );
  }

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'DIRECTORY_TRANSLATION_SAVED',
    resourceType: 'directory_translation',
    resourceId: res.id,
    summary: `Saved ${langCode} translation for ${locationId}`,
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Saved ${langCode.toUpperCase()} translation`,
      requestId: c.get('requestId'),
      data: { id: res.id },
    })
  );
});

adminDirectoryRouter.post('/import', requirePermission('services.edit'), async (c) => {
  const user = c.get('user')!;
  const body = (await c.req.json().catch(() => ({}))) as {
    rawText?: string;
    sourceName?: string;
  };
  const rawText = String(body.rawText || '').trim();
  const sourceName = String(body.sourceName || 'Official LGD / Census Upload').trim();

  const { locations: existing } = await getDirectoryLocations(c.env);
  const parsedImport = parseOfficialGeographyImport(rawText, existing);

  if (parsedImport.errors.length > 0 && parsedImport.validRecords.length === 0) {
    return c.json(
      buildApiResponse({
        success: false,
        status: 'FAILED',
        message: parsedImport.errors[0],
        requestId: c.get('requestId'),
        data: parsedImport,
        errorCode: 'IMPORT_VALIDATION_FAILED',
      }),
      400
    );
  }

  let savedCount = 0;
  for (const loc of parsedImport.validRecords) {
    const quality = evaluateDirectoryPageQuality(loc);
    const res = await upsertDirectoryLocation(c.env, loc, quality);
    if (res.saved) savedCount += 1;
  }

  await recordSeoImportBatch(c.env, {
    sourceName,
    format: parsedImport.detectedFormat,
    importedCount: savedCount,
    skippedDuplicates: parsedImport.skippedDuplicates,
    errorsCount: parsedImport.errors.length,
    actorUserId: user.id,
    summary: `Imported ${savedCount} nodes (${parsedImport.skippedDuplicates} duplicates skipped) from ${sourceName}`,
  });

  await recordAuditEvent(c.env, {
    actorId: user.id,
    actorRole: user.role,
    action: 'DIRECTORY_LGD_IMPORTED',
    resourceType: 'seo_import_batch',
    resourceId: sourceName,
    summary: `Imported ${savedCount} LGD/Census records (${parsedImport.skippedDuplicates} duplicates skipped)`,
  });

  return c.json(
    buildApiResponse({
      success: true,
      status: 'SUCCESS',
      message: `Imported ${savedCount} verified geography nodes (${parsedImport.skippedDuplicates} duplicates skipped)`,
      requestId: c.get('requestId'),
      data: {
        savedCount,
        skippedDuplicates: parsedImport.skippedDuplicates,
        errors: parsedImport.errors,
        warnings: parsedImport.warnings,
        detectedFormat: parsedImport.detectedFormat,
      },
    })
  );
});

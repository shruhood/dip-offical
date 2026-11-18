/**
 * Service-Side 145-Service Catalog Idempotent Sync, SQL & Firestore Write Generator
 *
 * Usage:
 *   npx tsx scripts/syncCatalogueServices.ts
 *   npx tsx scripts/syncCatalogueServices.ts --dry-run
 *   npx tsx scripts/syncCatalogueServices.ts --format=sql
 *   npx tsx scripts/syncCatalogueServices.ts --format=firestore
 *   npx tsx scripts/syncCatalogueServices.ts --format=json
 *   npx tsx scripts/syncCatalogueServices.ts --format=sql --out=/tmp/sync_services.sql
 *   npx tsx scripts/syncCatalogueServices.ts --format=firestore --out=/tmp/firestore_writes.json
 *   npx tsx scripts/syncCatalogueServices.ts --include-packages
 *   ADMIN_BEARER_TOKEN=... DIP_WORKER_URL=https://digitalindiaproject.com npx tsx scripts/syncCatalogueServices.ts --apply-worker
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CATALOGUE_CATEGORIES, CORE_CATALOGUE_ITEMS, COMPLETE_CATALOGUE_ITEMS } from '../src/data/catalogue/index';
import {
  ALL_CATALOG_SEO_RECORDS,
  CORE_SEO_SERVICES_COUNT,
  SERVICE_SEO_DATA,
  getServiceSeoMetadata,
} from '../src/lib/seoData';
import {
  FIRESTORE_SERVICE_ALLOWED_KEYS,
  formatD1UpsertSqlBatch,
  generateFirestoreWriteOperations,
  mapCatalogServiceToD1Record,
  planIdempotentServicesSync,
} from '../src/lib/catalogueSync';

type OutputFormat = 'summary' | 'json' | 'sql' | 'firestore';

function parseCliFlags(argv: string[]) {
  const args = new Set(argv);
  const formatArg = argv.find((a) => a.startsWith('--format='));
  const rawFormat = (formatArg ? formatArg.split('=')[1] : 'summary') as OutputFormat;
  const outArg = argv.find((a) => a.startsWith('--out='));
  const outPath = outArg ? outArg.slice('--out='.length).trim() : '';

  return {
    includePackages: args.has('--include-packages'),
    dryRun: args.has('--dry-run') || !args.has('--apply-worker'),
    applyWorker: args.has('--apply-worker'),
    forceRefreshSeo: !args.has('--keep-existing-seo'),
    format: (['summary', 'json', 'sql', 'firestore'].includes(rawFormat) ? rawFormat : 'summary') as OutputFormat,
    outPath,
  };
}

function emitOutput(content: string, outPath?: string) {
  if (outPath) {
    const resolved = resolve(process.cwd(), outPath);
    mkdirSync(dirname(resolved), { recursive: true });
    writeFileSync(resolved, `${content}\n`, 'utf8');
    console.log(`Wrote output (${content.length} bytes) to ${resolved}`);
    return;
  }
  console.log(content);
}

async function main() {
  const opts = parseCliFlags(process.argv.slice(2));
  const targetCatalog = opts.includePackages ? COMPLETE_CATALOGUE_ITEMS : CORE_CATALOGUE_ITEMS;
  const nowIso = new Date().toISOString();

  // 1. Validate canonical SEO coverage for all 145 core services
  const missingSeo = CORE_CATALOGUE_ITEMS.filter(
    (item) => !SERVICE_SEO_DATA[item.slug.toLowerCase()] || !getServiceSeoMetadata(item.slug, item)
  );
  if (missingSeo.length > 0 || ALL_CATALOG_SEO_RECORDS.length !== CORE_SEO_SERVICES_COUNT) {
    console.error(
      `SEO coverage mismatch: expected ${CORE_SEO_SERVICES_COUNT} records, found ${ALL_CATALOG_SEO_RECORDS.length}. Missing: ${missingSeo.map((s) => s.id).join(', ')}`
    );
    process.exit(1);
  }

  // 2. Pass 1: Plan initial idempotent mapping into existing `Services` schema
  const pass1 = planIdempotentServicesSync({
    catalog: targetCatalog,
    existingRecords: [],
    actorName: 'service-sync-cli',
    nowIso,
    forceRefreshSeo: opts.forceRefreshSeo,
  });

  // 3. Validate Firestore ServiceProduct key allowlist & D1 record conversion on every mapped entry
  const allowedKeySet = new Set<string>(FIRESTORE_SERVICE_ALLOWED_KEYS);
  for (const record of pass1.mappedRecords) {
    const keys = Object.keys(record);
    const invalidKey = keys.find((k) => !allowedKeySet.has(k));
    if (invalidKey) {
      console.error(`Schema violation on ${record.id}: disallowed key "${invalidKey}"`);
      process.exit(1);
    }
    if (!record.id || !record.slug || !record.name || !record.category) {
      console.error(`Schema violation on ${record.id}: missing required field.`);
      process.exit(1);
    }
  }
  const d1Rows = targetCatalog.map((item) => mapCatalogServiceToD1Record(item, nowIso));

  // 4. Pass 2: Simulate immediate re-run against Pass 1 output to verify strict idempotency
  const pass2 = planIdempotentServicesSync({
    catalog: targetCatalog,
    existingRecords: pass1.mappedRecords,
    actorName: 'service-sync-cli',
    nowIso,
    forceRefreshSeo: opts.forceRefreshSeo,
  });

  if (pass2.toCreate.length !== 0 || pass2.toUpdate.length !== 0 || pass2.unchanged.length !== targetCatalog.length) {
    console.error(
      `Idempotency check failed on re-run: created=${pass2.toCreate.length}, updated=${pass2.toUpdate.length}, skipped=${pass2.unchanged.length}`
    );
    process.exit(1);
  }

  // 5. Optional Worker Admin API execution (POST /api/admin/catalogue/sync)
  if (opts.applyWorker) {
    const baseUrl = (process.env.DIP_WORKER_URL || 'https://digitalindiaproject.com').replace(/\/+$/, '');
    const token = process.env.ADMIN_BEARER_TOKEN;
    if (!token) {
      console.error('ADMIN_BEARER_TOKEN env var is required with --apply-worker.');
      process.exit(1);
    }

    const res = await fetch(`${baseUrl}/api/admin/catalogue/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        includePackages: opts.includePackages,
        dryRun: false,
        forceRefreshSeo: opts.forceRefreshSeo,
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(`Worker admin sync failed (${res.status}):`, JSON.stringify(json));
      process.exit(1);
    }
    emitOutput(JSON.stringify(json, null, 2), opts.outPath);
    return;
  }

  if (opts.format === 'sql') {
    emitOutput(formatD1UpsertSqlBatch(targetCatalog, nowIso), opts.outPath);
    return;
  }

  if (opts.format === 'firestore') {
    const firestoreBatch = generateFirestoreWriteOperations({
      catalog: targetCatalog,
      existingRecords: [],
      nowIso,
      forceRefreshSeo: opts.forceRefreshSeo,
    });
    emitOutput(
      JSON.stringify(
        {
          mode: opts.dryRun ? 'dry_run' : 'sync',
          collectionPath: 'services',
          idempotentKey: 'slug',
          mergeStrategy: 'set({ ...payload }, { merge: true })',
          totalOperations: firestoreBatch.counts.total,
          counts: firestoreBatch.counts,
          duplicatesPrevented: firestoreBatch.duplicatesPrevented,
          operations: firestoreBatch.operations,
        },
        null,
        2
      ),
      opts.outPath
    );
    return;
  }

  if (opts.format === 'json') {
    emitOutput(
      JSON.stringify(
        {
          mode: opts.dryRun ? 'dry_run' : 'sync',
          categoriesCount: CATALOGUE_CATEGORIES.length,
          catalogCount: targetCatalog.length,
          seoRecordsCount: ALL_CATALOG_SEO_RECORDS.length,
          idempotencyVerified: true,
          pass1Summary: pass1.report,
          pass2IdempotencySummary: pass2.report,
          firestoreRecords: pass1.mappedRecords,
          d1Records: d1Rows,
        },
        null,
        2
      ),
      opts.outPath
    );
    return;
  }

  console.log('=== Digital India Project — Service Catalogue & SEO Sync Utility ===');
  console.log(`Catalog items processed : ${targetCatalog.length} (${CATALOGUE_CATEGORIES.length} categories)`);
  console.log(`SEO metadata records    : ${Object.keys(SERVICE_SEO_DATA).length} slug mappings (${ALL_CATALOG_SEO_RECORDS.length} core)`);
  console.log(`Pass 1 (fresh target)   : +${pass1.toCreate.length} creates, ~${pass1.toUpdate.length} updates`);
  console.log(`Pass 2 (re-run check)   : +${pass2.toCreate.length} creates, ~${pass2.toUpdate.length} updates, ${pass2.unchanged.length} skipped`);
  console.log(`Duplicates prevented    : ${pass1.duplicatesPrevented.length}`);
  console.log('Schema & idempotency verification passed cleanly.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

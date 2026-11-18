/**
 * Dynamic Sitemap.xml Generator Script
 *
 * Iterates over all published services, published digital products, compliance packages,
 * location-based pages (TARGET_LOCATIONS + quality-verified INDIA_GEOGRAPHY_SEED),
 * and published blog posts while strictly excluding unpublished or noindex pages.
 *
 * Usage:
 *   npm run sitemap:generate
 *   npx tsx scripts/generateSitemap.ts
 *   npx tsx scripts/generateSitemap.ts --dry-run
 *   npx tsx scripts/generateSitemap.ts --stdout
 *   npx tsx scripts/generateSitemap.ts --format=json
 *   npx tsx scripts/generateSitemap.ts --out=public/sitemap.xml
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { COMPLETE_CATALOGUE_ITEMS } from '../src/data/catalogue/index';
import { INITIAL_BLOG_POSTS } from '../src/data/initialBlogPosts';
import { INDIA_GEOGRAPHY_SEED } from '../src/data/indiaGeography';
import { evaluateDirectoryPageQuality } from '../src/lib/indiaDirectorySeo';
import {
  buildSitemapXml,
  computeSitemapHealthSummary,
  parseSitemapXmlStats,
  type DirectorySitemapEntry,
} from '../src/lib/blogSeo';
import type { BlogPost, Service } from '../src/types';

const MAX_SITEMAP_URLS = 50_000;
const MAX_SITEMAP_BYTES = 50 * 1024 * 1024;

export interface SitemapGenerationResult {
  generatedAt: string;
  outputPath: string;
  xml: string;
  bytes: number;
  urlCount: number;
  excludedCount: number;
  summary: ReturnType<typeof computeSitemapHealthSummary>;
  validationErrors: string[];
}

function parseCliFlags(argv: string[]) {
  const args = new Set(argv);
  const outArg = argv.find((a) => a.startsWith('--out='));
  const formatArg = argv.find((a) => a.startsWith('--format='));
  const format = formatArg ? formatArg.split('=')[1] : 'summary';

  return {
    dryRun: args.has('--dry-run'),
    stdout: args.has('--stdout'),
    format: format === 'json' ? 'json' : 'summary',
    outPath: outArg ? outArg.slice('--out='.length).trim() : 'public/sitemap.xml',
  };
}

export function generateDynamicSitemapArtifact(params?: {
  services?: Service[];
  posts?: BlogPost[];
  generatedAt?: string;
  outPath?: string;
}): SitemapGenerationResult {
  const generatedAt = params?.generatedAt || new Date().toISOString();
  const services = params?.services || COMPLETE_CATALOGUE_ITEMS;
  const posts = params?.posts || INITIAL_BLOG_POSTS;
  const outputPath = params?.outPath || 'public/sitemap.xml';

  const seenHashes = new Set<string>();
  const childCountByParent = new Map<string, number>();
  for (const loc of INDIA_GEOGRAPHY_SEED) {
    if (loc.parentId && loc.published) {
      childCountByParent.set(loc.parentId, (childCountByParent.get(loc.parentId) || 0) + 1);
    }
  }
  const activeServicesCount = services.filter((s) => s.published !== false).length;

  const directoryEntries: DirectorySitemapEntry[] = INDIA_GEOGRAPHY_SEED.map((loc) => ({
    location: loc,
    quality: evaluateDirectoryPageQuality(loc, {
      servicesCount: activeServicesCount || loc.highlightedServiceSlugs.length,
      childCount: childCountByParent.get(loc.id) || 0,
      seenContentHashes: seenHashes,
    }),
  }));

  const xml = buildSitemapXml(services, posts, directoryEntries, { generatedAt });
  const parsed = parseSitemapXmlStats(xml);
  const summary = computeSitemapHealthSummary({
    services,
    posts,
    directoryEntries,
  });

  const bytes = Buffer.byteLength(xml, 'utf8');
  const validationErrors: string[] = [];

  if (!parsed.validXml) {
    validationErrors.push('Generated output is missing valid <urlset> root tags.');
  }
  if (parsed.urlCount === 0) {
    validationErrors.push('Generated sitemap contains 0 <url> entries.');
  }
  if (parsed.urlCount > MAX_SITEMAP_URLS) {
    validationErrors.push(`URL count (${parsed.urlCount}) exceeds Sitemaps.org 50,000 URL limit.`);
  }
  if (bytes > MAX_SITEMAP_BYTES) {
    validationErrors.push(`XML size (${bytes} bytes) exceeds Sitemaps.org 50MB limit.`);
  }

  const invalidSchemeLoc = parsed.locs.find((loc) => !/^https:\/\/[a-z0-9.-]+/i.test(loc));
  if (invalidSchemeLoc) {
    validationErrors.push(`Non-HTTPS or invalid canonical <loc> found: ${invalidSchemeLoc}`);
  }

  return {
    generatedAt,
    outputPath,
    xml,
    bytes,
    urlCount: parsed.urlCount,
    excludedCount: parsed.declaredExcludedCount ?? summary.excludedUrls,
    summary,
    validationErrors,
  };
}

function main() {
  const opts = parseCliFlags(process.argv.slice(2));
  const result = generateDynamicSitemapArtifact({ outPath: opts.outPath });

  if (result.validationErrors.length > 0) {
    console.error('Sitemap validation failed:');
    for (const err of result.validationErrors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  if (opts.stdout) {
    process.stdout.write(`${result.xml}\n`);
    return;
  }

  if (!opts.dryRun) {
    const resolved = resolve(process.cwd(), result.outputPath);
    mkdirSync(dirname(resolved), { recursive: true });
    writeFileSync(resolved, `${result.xml}\n`, 'utf8');
  }

  if (opts.format === 'json') {
    console.log(
      JSON.stringify(
        {
          generatedAt: result.generatedAt,
          dryRun: opts.dryRun,
          outputPath: resolve(process.cwd(), result.outputPath),
          bytes: result.bytes,
          urlCount: result.urlCount,
          excludedCount: result.excludedCount,
          summary: result.summary,
        },
        null,
        2
      )
    );
    return;
  }

  const { breakdown } = result.summary;
  console.log('=== Digital India Project — Dynamic Sitemap Generator ===');
  console.log(`Generated At            : ${result.generatedAt}`);
  console.log(
    `Target File             : ${resolve(process.cwd(), result.outputPath)}${opts.dryRun ? ' (dry-run)' : ''}`
  );
  console.log(`Indexed URLs Emitted    : ${result.urlCount} / ${result.summary.totalSystemUrls} total (${result.summary.indexCoveragePct}%)`);
  console.log(`Excluded (Draft/Noindex): ${result.excludedCount}`);
  console.log(`Core Services Published : ${breakdown.publishedServices} / ${breakdown.totalServices}`);
  console.log(`Digital Products        : ${breakdown.publishedDigitalProducts} / ${breakdown.totalDigitalProducts}`);
  console.log(`Compliance Packages     : ${breakdown.publishedPackages} / ${breakdown.totalPackages}`);
  console.log(`Location & India Dir    : ${breakdown.indexedDirectoryPages} / ${breakdown.totalDirectoryPages}`);
  console.log(`Blog Posts Published    : ${breakdown.publishedPosts} / ${breakdown.totalPosts}`);
  console.log(`XML Size                : ${(result.bytes / 1024).toFixed(1)} KB`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

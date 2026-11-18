import { BlogFaqItem, BlogPost, BlogPostStatus, Service } from '../types';
import { CANONICAL_ORIGIN, buildUrlForRoute } from './siteUrls';
import { CATALOGUE_CATEGORIES, TARGET_LOCATIONS } from '../data/catalogue';

export const DEFAULT_BLOG_PUBLISHER = 'Suraj Singh';

export function slugifyBlogTitle(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return cleaned || `guide-${Date.now()}`;
}

export function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export interface SeoCheckItem {
  id: string;
  label: string;
  passed: boolean;
  hint: string;
}

export interface BlogSeoAudit {
  score: number;
  grade: 'Optimal' | 'Good' | 'Needs Work';
  checks: SeoCheckItem[];
  resolvedTitle: string;
  resolvedDescription: string;
  resolvedCanonicalUrl: string;
}

export function evaluateBlogSeo(post: Partial<BlogPost>): BlogSeoAudit {
  const title = (post.title || '').trim();
  const seoTitle = (post.seoTitle || title).trim();
  const seoDesc = (post.seoDescription || post.excerpt || '').trim();
  const slug = (post.slug || slugifyBlogTitle(title)).trim();
  const content = (post.content || '').trim();
  const keyword = (post.focusKeyword || '').trim().toLowerCase();
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const hasHeadings = /^##\s+/m.test(content);
  const tagsCount = Array.isArray(post.tags) ? post.tags.filter(Boolean).length : 0;
  const faqCount = Array.isArray(post.faqItems) ? post.faqItems.filter((f) => f.question && f.answer).length : 0;

  const checks: SeoCheckItem[] = [
    {
      id: 'title_length',
      label: 'SEO Title Length (30–65 chars)',
      passed: seoTitle.length >= 30 && seoTitle.length <= 65,
      hint: `Current: ${seoTitle.length} chars (ideal 30–65 for Google SERP).`,
    },
    {
      id: 'meta_description',
      label: 'Meta Description Length (110–160 chars)',
      passed: seoDesc.length >= 110 && seoDesc.length <= 160,
      hint: `Current: ${seoDesc.length} chars (ideal 110–160 without snippet truncation).`,
    },
    {
      id: 'focus_keyword',
      label: 'Focus Keyword Set & Present in Title/Body',
      passed:
        keyword.length >= 3 &&
        (seoTitle.toLowerCase().includes(keyword) || content.toLowerCase().includes(keyword)),
      hint: keyword
        ? `Keyword "${keyword}" checked in title and body copy.`
        : 'Add a primary search phrase such as "PAN card correction online".',
    },
    {
      id: 'clean_slug',
      label: 'Clean Lowercase Hyphenated URL Slug',
      passed: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 6,
      hint: `URL: ${CANONICAL_ORIGIN}/blog/${slug}`,
    },
    {
      id: 'content_depth',
      label: 'Article Depth (>= 120 words) & Section Headings',
      passed: wordCount >= 120 && hasHeadings,
      hint: `Word count: ${wordCount} words · Section headings (##): ${hasHeadings ? 'Yes' : 'Missing'}.`,
    },
    {
      id: 'structured_faq_cta',
      label: 'Structured Tags (>=2), Related Service, or FAQ Schema',
      passed: tagsCount >= 2 && (Boolean(post.relatedServiceSlug) || faqCount > 0),
      hint: `Tags: ${tagsCount} · FAQ Schema items: ${faqCount} · Service link: ${post.relatedServiceSlug || 'None'}.`,
    },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const grade: BlogSeoAudit['grade'] =
    score >= 83 ? 'Optimal' : score >= 50 ? 'Good' : 'Needs Work';

  return {
    score,
    grade,
    checks,
    resolvedTitle: seoTitle || 'Digital India Project Knowledge Base',
    resolvedDescription:
      seoDesc ||
      'Step-by-step registration guides, compliance checklists, and official citizen documentation resources.',
    resolvedCanonicalUrl: post.canonicalUrl?.trim() || `${CANONICAL_ORIGIN}/blog/${slug}`,
  };
}

export function buildBlogPostJsonLd(post: BlogPost, organizationName = 'Digital India Project') {
  const url = post.canonicalUrl?.trim() || `${CANONICAL_ORIGIN}/blog/${encodeURIComponent(post.slug)}`;
  const headline = (post.seoTitle || post.title).slice(0, 110);
  const description = (post.seoDescription || post.excerpt).slice(0, 200);

  const graph: Record<string, any>[] = [
    {
      '@type': 'BlogPosting',
      '@id': `${url}#article`,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': url,
      },
      headline,
      description,
      articleSection: post.category,
      keywords: [...(post.tags || []), ...(post.focusKeyword ? [post.focusKeyword] : [])].join(', '),
      datePublished: post.publishedAt,
      dateModified: post.updatedAt || post.publishedAt,
      author: {
        '@type': 'Person',
        name: post.authorName || DEFAULT_BLOG_PUBLISHER,
      },
      publisher: {
        '@type': 'Organization',
        name: organizationName,
        url: CANONICAL_ORIGIN,
      },
      inLanguage: post.contentHi ? ['en-IN', 'hi-IN'] : 'en-IN',
      url,
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: CANONICAL_ORIGIN,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Blog & Guides',
          item: `${CANONICAL_ORIGIN}/blog`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: post.title,
          item: url,
        },
      ],
    },
  ];

  const validFaqs = (post.faqItems || []).filter((f) => f.question.trim() && f.answer.trim());
  if (validFaqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: validFaqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question.trim(),
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer.trim(),
        },
      })),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export function buildBlogIndexJsonLd(posts: BlogPost[], organizationName = 'Digital India Project') {
  const published = posts.filter((p) => p.status === 'published');
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${organizationName} — Guides, Compliance Updates & Citizen Resources`,
    description:
      'Step-by-step documentation guides, GST, Udyam MSME, PAN, Gazette, and DigiLocker compliance insights for India.',
    url: `${CANONICAL_ORIGIN}/blog`,
    publisher: {
      '@type': 'Organization',
      name: organizationName,
      url: CANONICAL_ORIGIN,
    },
    blogPost: published.slice(0, 20).map((post) => ({
      '@type': 'BlogPosting',
      headline: post.seoTitle || post.title,
      url: `${CANONICAL_ORIGIN}/blog/${encodeURIComponent(post.slug)}`,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt || post.publishedAt,
      author: {
        '@type': 'Person',
        name: post.authorName,
      },
      description: post.seoDescription || post.excerpt,
    })),
  };
}

import type { IndiaLocationRecord } from '../data/indiaGeography';
import { SUPPORTED_INDIAN_LANGUAGES } from '../data/indianLanguages';
import {
  buildDirectoryHreflangs,
  buildIndiaDirectoryPath,
  DirectoryQualityEvaluation,
  evaluateDirectoryPageQuality,
} from './indiaDirectorySeo';

function escapeXml(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface DirectorySitemapEntry {
  location: IndiaLocationRecord;
  quality?: DirectoryQualityEvaluation;
}

function buildDirectoryUrlBlock(
  loc: IndiaLocationRecord,
  changefreq: string,
  priority: string
): string {
  const path = buildIndiaDirectoryPath({
    lang: 'en',
    stateSlug: loc.level === 'country' ? undefined : loc.stateSlug,
    districtSlug: loc.districtSlug,
    citySlug: loc.citySlug,
  });
  const canonical = `${CANONICAL_ORIGIN}${path}`;
  const { hreflangs, xDefaultUrl } = buildDirectoryHreflangs({
    stateSlug: loc.level === 'country' ? undefined : loc.stateSlug,
    districtSlug: loc.districtSlug,
    citySlug: loc.citySlug,
  });
  const lastmod = (loc.updatedAt || '').slice(0, 10);
  const alternatesXml = [
    ...hreflangs.map(
      (h) =>
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(h.hreflang)}" href="${escapeXml(h.href)}" />`
    ),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(xDefaultUrl)}" />`,
  ].join('\n');

  return `  <url>\n    <loc>${escapeXml(canonical)}</loc>${
    lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''
  }\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n${alternatesXml}\n  </url>`;
}

export interface SitemapHealthBreakdown {
  publishedServices: number;
  totalServices: number;
  publishedDigitalProducts: number;
  totalDigitalProducts: number;
  publishedPackages: number;
  totalPackages: number;
  publishedPosts: number;
  totalPosts: number;
  indexedDirectoryPages: number;
  totalDirectoryPages: number;
  staticAndHubUrls: number;
}

export interface SitemapHealthSummary {
  totalSystemUrls: number;
  indexedUrls: number;
  excludedUrls: number;
  indexCoveragePct: number;
  breakdown: SitemapHealthBreakdown;
}

export interface ParsedSitemapXmlStats {
  urlCount: number;
  locs: string[];
  generatedAt: string | null;
  declaredIndexedUrls: number | null;
  declaredExcludedCount: number | null;
  serviceAndProductUrls: number;
  blogUrls: number;
  locationUrls: number;
  directoryUrls: number;
  otherUrls: number;
  validXml: boolean;
}

function resolveServiceSitemapLoc(srv: Service): string {
  const custom = srv.canonicalUrl?.trim();
  if (custom && /^https:\/\/[a-z0-9.-]+/i.test(custom)) {
    return custom;
  }
  return `${CANONICAL_ORIGIN}${buildUrlForRoute('service-detail', srv.slug)}`;
}

export function computeSitemapHealthSummary(params: {
  services: Service[];
  posts: BlogPost[];
  directoryEntries?: DirectorySitemapEntry[];
}): SitemapHealthSummary {
  const { services, posts, directoryEntries = [] } = params;

  const coreServices = services.filter(
    (s) => s.productType !== 'digital_product' && s.productType !== 'compliance_package'
  );
  const digitalProducts = services.filter((s) => s.productType === 'digital_product');
  const packages = services.filter((s) => s.productType === 'compliance_package');

  const publishedCoreServices = coreServices.filter((s) => s.published !== false).length;
  const publishedDigitalProducts = digitalProducts.filter((s) => s.published !== false).length;
  const publishedPackages = packages.filter((s) => s.published !== false).length;
  const publishedPosts = posts.filter((p) => p.status === 'published').length;

  const seenHashes = new Set<string>();
  let indexedDir = 0;
  for (const entry of directoryEntries) {
    const loc = entry.location;
    const quality =
      entry.quality ||
      evaluateDirectoryPageQuality(loc, {
        servicesCount: loc.highlightedServiceSlugs.length,
        seenContentHashes: seenHashes,
      });
    if (loc.published && quality.indexStatus === 'index') {
      indexedDir += 1;
    }
  }

  // 14 static routes + 7 legal policies + category hubs + TARGET_LOCATIONS
  const staticAndHubUrls = 14 + 7 + CATALOGUE_CATEGORIES.length + TARGET_LOCATIONS.length;

  const totalSystemUrls =
    staticAndHubUrls +
    coreServices.length +
    digitalProducts.length +
    packages.length +
    posts.length +
    directoryEntries.length;

  const indexedUrls =
    staticAndHubUrls +
    publishedCoreServices +
    publishedDigitalProducts +
    publishedPackages +
    publishedPosts +
    indexedDir;

  const excludedUrls = Math.max(0, totalSystemUrls - indexedUrls);
  const indexCoveragePct =
    totalSystemUrls > 0 ? Math.round((indexedUrls / totalSystemUrls) * 1000) / 10 : 100;

  return {
    totalSystemUrls,
    indexedUrls,
    excludedUrls,
    indexCoveragePct,
    breakdown: {
      publishedServices: publishedCoreServices,
      totalServices: coreServices.length,
      publishedDigitalProducts,
      totalDigitalProducts: digitalProducts.length,
      publishedPackages,
      totalPackages: packages.length,
      publishedPosts,
      totalPosts: posts.length,
      indexedDirectoryPages: indexedDir,
      totalDirectoryPages: directoryEntries.length,
      staticAndHubUrls,
    },
  };
}

export function parseSitemapXmlStats(xml: string): ParsedSitemapXmlStats {
  const validXml = /<urlset\b/i.test(xml) && /<\/urlset>/i.test(xml);
  const generatedMatch = xml.match(/<!--\s*generated-at="([^"]+)"(?:\s+indexed-urls="(\d+)")?(?:\s+excluded-count="(\d+)")?/i);
  const locMatches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());

  let serviceAndProductUrls = 0;
  let blogUrls = 0;
  let locationUrls = 0;
  let directoryUrls = 0;
  let otherUrls = 0;

  for (const loc of locMatches) {
    if (loc.includes('/services/') || loc.includes('/products')) serviceAndProductUrls += 1;
    else if (loc.includes('/blog/')) blogUrls += 1;
    else if (loc.includes('/locations/')) locationUrls += 1;
    else if (/\/india(?:\/|$)/i.test(loc)) directoryUrls += 1;
    else otherUrls += 1;
  }

  return {
    urlCount: locMatches.length,
    locs: locMatches,
    generatedAt: generatedMatch?.[1] || null,
    declaredIndexedUrls: generatedMatch?.[2] ? Number(generatedMatch[2]) : null,
    declaredExcludedCount: generatedMatch?.[3] ? Number(generatedMatch[3]) : null,
    serviceAndProductUrls,
    blogUrls,
    locationUrls,
    directoryUrls,
    otherUrls,
    validXml,
  };
}

export function buildSitemapXml(
  services: Service[],
  posts: BlogPost[],
  directoryEntries?: DirectorySitemapEntry[],
  options?: { generatedAt?: string }
): string {
  const staticRoutes = [
    { route: 'home', priority: '1.0', changefreq: 'daily' },
    { route: 'services', priority: '0.9', changefreq: 'weekly' },
    { route: 'products', priority: '0.9', changefreq: 'weekly' },
    { route: 'packages', priority: '0.85', changefreq: 'weekly' },
    { route: 'blog', priority: '0.9', changefreq: 'daily' },
    { route: 'india-directory', priority: '0.9', changefreq: 'daily' },
    { route: 'how-it-works', priority: '0.7', changefreq: 'monthly' },
    { route: 'pricing', priority: '0.8', changefreq: 'weekly' },
    { route: 'track', priority: '0.8', changefreq: 'daily' },
    { route: 'partner', priority: '0.8', changefreq: 'weekly' },
    { route: 'operator-enroll', priority: '0.7', changefreq: 'weekly' },
    { route: 'about', priority: '0.6', changefreq: 'monthly' },
    { route: 'contact', priority: '0.6', changefreq: 'monthly' },
    { route: 'faq', priority: '0.7', changefreq: 'weekly' },
  ];

  const legalPolicies = [
    'disclaimer',
    'terms',
    'privacy',
    'refund',
    'grievance',
    'data-protection',
    'digital-product-policy',
  ];

  const generatedAt = options?.generatedAt || new Date().toISOString();
  const seenLocs = new Set<string>();
  const urls: string[] = [];
  let excludedCount = 0;

  const pushUrl = (loc: string, changefreq: string, priority: string, lastmod?: string) => {
    if (seenLocs.has(loc)) return;
    seenLocs.add(loc);
    urls.push(
      `  <url>\n    <loc>${escapeXml(loc)}</loc>${
        lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''
      }\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
    );
  };

  staticRoutes.forEach((item) => {
    const loc =
      item.route === 'india-directory'
        ? `${CANONICAL_ORIGIN}/india`
        : `${CANONICAL_ORIGIN}${buildUrlForRoute(item.route)}`;
    pushUrl(loc, item.changefreq, item.priority);
  });

  CATALOGUE_CATEGORIES.forEach((cat) => {
    pushUrl(`${CANONICAL_ORIGIN}/services/${encodeURIComponent(cat.slug)}`, 'weekly', '0.85');
  });

  TARGET_LOCATIONS.forEach((locCity) => {
    pushUrl(`${CANONICAL_ORIGIN}/locations/${encodeURIComponent(locCity.slug)}`, 'weekly', '0.8');
  });

  legalPolicies.forEach((policy) => {
    pushUrl(`${CANONICAL_ORIGIN}/legal/${encodeURIComponent(policy)}`, 'monthly', '0.5');
  });

  services.forEach((srv) => {
    if (srv.published === false) {
      excludedCount += 1;
      return;
    }
    const loc = resolveServiceSitemapLoc(srv);
    const lastmod = srv.updatedAt ? srv.updatedAt.slice(0, 10) : undefined;
    const priority = srv.productType === 'digital_product' ? '0.8' : srv.featured ? '0.85' : '0.8';
    pushUrl(loc, 'weekly', priority, lastmod || undefined);
  });

  posts.forEach((post) => {
    if (post.status !== 'published') {
      excludedCount += 1;
      return;
    }
    const loc = post.canonicalUrl?.trim() || `${CANONICAL_ORIGIN}${buildUrlForRoute('blog-detail', post.slug)}`;
    const lastmod = (post.updatedAt || post.publishedAt || '').slice(0, 10);
    pushUrl(loc, 'weekly', '0.85', lastmod || undefined);
  });

  if (directoryEntries && directoryEntries.length > 0) {
    const seenHashes = new Set<string>();
    directoryEntries.forEach((entry) => {
      const loc = entry.location;
      const quality =
        entry.quality ||
        evaluateDirectoryPageQuality(loc, {
          servicesCount: loc.highlightedServiceSlugs.length,
          seenContentHashes: seenHashes,
        });
      if (!loc.published || quality.indexStatus !== 'index') {
        excludedCount += 1;
        return;
      }
      const canonical = `${CANONICAL_ORIGIN}${buildIndiaDirectoryPath({
        lang: 'en',
        stateSlug: loc.level === 'country' ? undefined : loc.stateSlug,
        districtSlug: loc.districtSlug,
        citySlug: loc.citySlug,
      })}`;
      if (seenLocs.has(canonical)) return;
      seenLocs.add(canonical);
      const priority =
        loc.level === 'country'
          ? '0.95'
          : loc.level === 'state' || loc.level === 'ut'
          ? '0.85'
          : loc.level === 'district'
          ? '0.75'
          : '0.7';
      urls.push(buildDirectoryUrlBlock(loc, 'weekly', priority));
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- generated-at="${escapeXml(
    generatedAt
  )}" indexed-urls="${urls.length}" excluded-count="${excludedCount}" -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join(
    '\n'
  )}\n</urlset>`;
}

export function buildDirectorySubSitemapXml(
  entries: DirectorySitemapEntry[],
  options?: { includeLocalizedUrls?: boolean }
): string {
  const seen = new Set<string>();
  const urlBlocks: string[] = [];

  for (const entry of entries) {
    const loc = entry.location;
    const quality = entry.quality || evaluateDirectoryPageQuality(loc);
    if (!loc.published || quality.indexStatus !== 'index') continue;

    const priority =
      loc.level === 'country'
        ? '0.95'
        : loc.level === 'state' || loc.level === 'ut'
        ? '0.85'
        : loc.level === 'district'
        ? '0.75'
        : '0.7';

    const baseCanonical = `${CANONICAL_ORIGIN}${buildIndiaDirectoryPath({
      lang: 'en',
      stateSlug: loc.level === 'country' ? undefined : loc.stateSlug,
      districtSlug: loc.districtSlug,
      citySlug: loc.citySlug,
    })}`;
    if (!seen.has(baseCanonical)) {
      seen.add(baseCanonical);
      urlBlocks.push(buildDirectoryUrlBlock(loc, 'weekly', priority));
    }

    if (options?.includeLocalizedUrls) {
      for (const langMeta of SUPPORTED_INDIAN_LANGUAGES) {
        if (langMeta.code === 'en') continue;
        const langCanonical = `${CANONICAL_ORIGIN}${buildIndiaDirectoryPath({
          lang: langMeta.code,
          stateSlug: loc.level === 'country' ? undefined : loc.stateSlug,
          districtSlug: loc.districtSlug,
          citySlug: loc.citySlug,
        })}`;
        if (seen.has(langCanonical)) continue;
        seen.add(langCanonical);
        const { hreflangs, xDefaultUrl } = buildDirectoryHreflangs({
          stateSlug: loc.level === 'country' ? undefined : loc.stateSlug,
          districtSlug: loc.districtSlug,
          citySlug: loc.citySlug,
        });
        const altXml = [
          ...hreflangs.map(
            (h) =>
              `    <xhtml:link rel="alternate" hreflang="${escapeXml(h.hreflang)}" href="${escapeXml(h.href)}" />`
          ),
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(xDefaultUrl)}" />`,
        ].join('\n');
        urlBlocks.push(
          `  <url>\n    <loc>${escapeXml(langCanonical)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n${altXml}\n  </url>`
        );
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urlBlocks.join(
    '\n'
  )}\n</urlset>`;
}

export function buildSitemapIndexXml(sitemapPaths: string[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const blocks = sitemapPaths.map((p) => {
    const loc = p.startsWith('http') ? p : `${CANONICAL_ORIGIN}${p}`;
    return `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${blocks.join(
    '\n'
  )}\n</sitemapindex>`;
}

// ==========================================
// BULK IMPORT & EXPORT (CSV + JSON + BATCH)
// ==========================================

const CSV_COLUMNS = [
  'title',
  'slug',
  'category',
  'status',
  'excerpt',
  'content',
  'tags',
  'focusKeyword',
  'seoTitle',
  'seoDescription',
  'relatedServiceSlug',
  'authorName',
  'featured',
  'publishedAt',
  'titleHi',
  'excerptHi',
  'faqs',
] as const;

function escapeCsvCell(value: string): string {
  const str = String(value ?? '');
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportBlogPostsToJson(posts: BlogPost[]): string {
  return JSON.stringify(
    {
      platform: 'Digital India Project',
      domain: CANONICAL_ORIGIN,
      exportedAt: new Date().toISOString(),
      count: posts.length,
      posts,
    },
    null,
    2
  );
}

export function exportBlogPostsToCsv(posts: BlogPost[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = posts.map((post) => {
    const faqsSerialized = (post.faqItems || [])
      .map((f) => `${f.question}::${f.answer}`)
      .join('||');
    const values: Record<(typeof CSV_COLUMNS)[number], string> = {
      title: post.title || '',
      slug: post.slug || '',
      category: post.category || 'General Guides',
      status: post.status || 'draft',
      excerpt: post.excerpt || '',
      content: post.content || '',
      tags: (post.tags || []).join(';'),
      focusKeyword: post.focusKeyword || '',
      seoTitle: post.seoTitle || '',
      seoDescription: post.seoDescription || '',
      relatedServiceSlug: post.relatedServiceSlug || '',
      authorName: post.authorName || DEFAULT_BLOG_PUBLISHER,
      featured: post.featured ? 'true' : 'false',
      publishedAt: post.publishedAt || '',
      titleHi: post.titleHi || '',
      excerptHi: post.excerptHi || '',
      faqs: faqsSerialized,
    };
    return CSV_COLUMNS.map((col) => escapeCsvCell(values[col])).join(',');
  });

  return [header, ...rows].join('\r\n');
}

export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const cleanText = csvText.replace(/^\uFEFF/, '');

  for (let i = 0; i < cleanText.length; i += 1) {
    const ch = cleanText[i];
    const next = cleanText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function normalizePostCandidate(
  raw: Record<string, any>,
  index: number,
  existingSlugs: Set<string>,
  defaultAuthor: string
): { post?: BlogPost; error?: string; warning?: string } {
  const title = String(raw.title || '').trim();
  const content = String(raw.content || raw.body || '').trim();
  const excerpt = String(raw.excerpt || raw.summary || '').trim();

  if (!title || title.length < 5) {
    return { error: `Item #${index + 1}: Missing valid "title" (min 5 chars).` };
  }
  if (!content && !excerpt) {
    return { error: `Item #${index + 1} ("${title}"): Must provide "content" or "excerpt".` };
  }

  const finalContent =
    content ||
    `## Overview\n\n${excerpt}\n\n## Key Requirements\n\n- Keep Aadhaar/PAN and address proofs ready before applying online on Digital India Project.`;
  const finalExcerpt =
    excerpt ||
    finalContent
      .replace(/^#+\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);

  let baseSlug = slugifyBlogTitle(String(raw.slug || title));
  let warning: string | undefined;
  if (existingSlugs.has(baseSlug)) {
    baseSlug = `${baseSlug}-${index + 1}`;
    warning = `Duplicate slug resolved to "${baseSlug}" for "${title}".`;
  }
  existingSlugs.add(baseSlug);

  const rawStatus = String(raw.status || 'published').toLowerCase().trim();
  const status: BlogPostStatus =
    rawStatus === 'draft' || rawStatus === 'archived' || rawStatus === 'published'
      ? rawStatus
      : 'published';

  const tags: string[] = Array.isArray(raw.tags)
    ? raw.tags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 10)
    : String(raw.tags || '')
        .split(/[;|,]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10);

  let faqItems: BlogFaqItem[] | undefined;
  if (Array.isArray(raw.faqItems)) {
    faqItems = raw.faqItems
      .filter((f: any) => f && f.question && f.answer)
      .map((f: any) => ({ question: String(f.question).trim(), answer: String(f.answer).trim() }))
      .slice(0, 8);
  } else if (typeof raw.faqs === 'string' && raw.faqs.trim()) {
    faqItems = raw.faqs
      .split('||')
      .map((pair: string) => {
        const [q, ...aParts] = pair.split('::');
        return { question: (q || '').trim(), answer: aParts.join('::').trim() };
      })
      .filter((f) => f.question && f.answer)
      .slice(0, 8);
  }

  const nowIso = new Date().toISOString();
  const publishedAt =
    raw.publishedAt && !Number.isNaN(Date.parse(String(raw.publishedAt)))
      ? new Date(String(raw.publishedAt)).toISOString()
      : nowIso;

  const postId =
    typeof raw.id === 'string' && /^[a-zA-Z0-9_-]{3,64}$/.test(raw.id.trim())
      ? raw.id.trim()
      : `post-${baseSlug.slice(0, 40)}-${Date.now().toString(36)}-${index}`;

  return {
    warning,
    post: {
      id: postId,
      slug: baseSlug,
      title: title.slice(0, 160),
      titleHi: raw.titleHi ? String(raw.titleHi).trim().slice(0, 180) : undefined,
      excerpt: finalExcerpt.slice(0, 360),
      excerptHi: raw.excerptHi ? String(raw.excerptHi).trim().slice(0, 400) : undefined,
      content: finalContent.slice(0, 18000),
      contentHi: raw.contentHi ? String(raw.contentHi).trim().slice(0, 18000) : undefined,
      category: String(raw.category || 'Citizen Guides').trim().slice(0, 64),
      tags: tags.length > 0 ? tags : ['Digital India', 'Compliance'],
      status,
      featured: raw.featured === true || String(raw.featured).toLowerCase() === 'true',
      authorName: String(raw.authorName || defaultAuthor).trim().slice(0, 80),
      authorRole: raw.authorRole ? String(raw.authorRole).trim().slice(0, 80) : 'Editorial & Compliance Team',
      publishedAt,
      updatedAt: nowIso,
      readingTimeMinutes: estimateReadingTime(finalContent),
      relatedServiceSlug: raw.relatedServiceSlug
        ? String(raw.relatedServiceSlug).trim().slice(0, 100)
        : undefined,
      seoTitle: raw.seoTitle ? String(raw.seoTitle).trim().slice(0, 90) : title.slice(0, 65),
      seoDescription: raw.seoDescription
        ? String(raw.seoDescription).trim().slice(0, 180)
        : finalExcerpt.slice(0, 158),
      focusKeyword: raw.focusKeyword ? String(raw.focusKeyword).trim().slice(0, 80) : undefined,
      canonicalUrl: raw.canonicalUrl ? String(raw.canonicalUrl).trim().slice(0, 240) : undefined,
      faqItems: faqItems && faqItems.length > 0 ? faqItems : undefined,
    },
  };
}

export interface ParsedBlogImportResult {
  validPosts: BlogPost[];
  errors: string[];
  warnings: string[];
  detectedFormat: 'json' | 'csv' | 'batch';
}

export function parseImportedBlogPosts(
  rawText: string,
  options?: {
    formatHint?: 'json' | 'csv' | 'batch';
    existingSlugs?: string[];
    defaultAuthor?: string;
  }
): ParsedBlogImportResult {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  const existingSlugs = new Set((options?.existingSlugs || []).map((s) => s.toLowerCase()));
  const defaultAuthor = options?.defaultAuthor || DEFAULT_BLOG_PUBLISHER;
  const errors: string[] = [];
  const warnings: string[] = [];
  const validPosts: BlogPost[] = [];

  if (!trimmed) {
    return {
      validPosts: [],
      errors: ['Input content is empty. Paste JSON, CSV, or batch blocks first.'],
      warnings: [],
      detectedFormat: options?.formatHint || 'json',
    };
  }

  let format: 'json' | 'csv' | 'batch' = options?.formatHint || 'csv';
  if (!options?.formatHint) {
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      format = 'json';
    } else if (/^TITLE:/im.test(trimmed) || trimmed.includes('\n---\n')) {
      format = 'batch';
    } else {
      format = 'csv';
    }
  }

  let rawItems: Record<string, any>[] = [];

  if (format === 'json') {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        rawItems = parsed;
      } else if (parsed && Array.isArray(parsed.posts)) {
        rawItems = parsed.posts;
      } else if (parsed && typeof parsed === 'object') {
        rawItems = [parsed];
      } else {
        return {
          validPosts: [],
          errors: ['JSON must be an object, an array of posts, or { "posts": [...] }.'],
          warnings: [],
          detectedFormat: 'json',
        };
      }
    } catch (err: any) {
      return {
        validPosts: [],
        errors: [`Invalid JSON syntax: ${err?.message || 'Unable to parse JSON'}`],
        warnings: [],
        detectedFormat: 'json',
      };
    }
  } else if (format === 'batch') {
    const blocks = trimmed
      .split(/\n-{3,}\n/)
      .map((b) => b.trim())
      .filter(Boolean);

    rawItems = blocks.map((block) => {
      const lines = block.split(/\r?\n/);
      const item: Record<string, any> = {};
      const bodyLines: string[] = [];
      let inBody = false;

      for (const line of lines) {
        if (!inBody) {
          const match = line.match(
            /^(title|slug|category|status|excerpt|tags|focusKeyword|seoTitle|seoDescription|relatedServiceSlug|featured):\s*(.*)$/i
          );
          if (match) {
            const key = match[1];
            const canonicalKey =
              key.toLowerCase() === 'focuskeyword'
                ? 'focusKeyword'
                : key.toLowerCase() === 'seotitle'
                ? 'seoTitle'
                : key.toLowerCase() === 'seodescription'
                ? 'seoDescription'
                : key.toLowerCase() === 'relatedserviceslug'
                ? 'relatedServiceSlug'
                : key.toLowerCase();
            item[canonicalKey] = match[2].trim();
            continue;
          }
          if (/^content:\s*(.*)$/i.test(line)) {
            inBody = true;
            const firstLine = line.replace(/^content:\s*/i, '').trim();
            if (firstLine) bodyLines.push(firstLine);
            continue;
          }
        }
        bodyLines.push(line);
      }

      if (bodyLines.length > 0) {
        item.content = bodyLines.join('\n').trim();
      }
      return item;
    });
  } else {
    const matrix = parseCsvRows(trimmed);
    if (matrix.length < 2) {
      return {
        validPosts: [],
        errors: ['CSV must contain a header row and at least one post row.'],
        warnings: [],
        detectedFormat: 'csv',
      };
    }
    const headers = matrix[0].map((h) => h.trim());
    rawItems = matrix.slice(1).map((cells) => {
      const obj: Record<string, any> = {};
      headers.forEach((header, idx) => {
        if (header) obj[header] = cells[idx] ?? '';
      });
      return obj;
    });
  }

  rawItems.forEach((raw, idx) => {
    const result = normalizePostCandidate(raw, idx, existingSlugs, defaultAuthor);
    if (result.error) errors.push(result.error);
    if (result.warning) warnings.push(result.warning);
    if (result.post) validPosts.push(result.post);
  });

  return {
    validPosts,
    errors,
    warnings,
    detectedFormat: format,
  };
}

export const SAMPLE_BULK_BATCH_TEMPLATE = `title: How to Apply for Instant PAN Card Correction Online in 2026
category: PAN & Identity
status: published
focusKeyword: PAN card correction online
seoTitle: PAN Card Correction Online 2026 — Documents & Steps
seoDescription: Step-by-step guide to update name, DOB, or father name on your PAN card online via Digital India Project with Aadhaar e-KYC.
relatedServiceSlug: pan-card
tags: PAN Card; Correction; Aadhaar e-KYC
excerpt: Complete checklist for updating name, date of birth, photo, or signature on your PAN card without offline visits.
content: ## When Do You Need PAN Correction?
If there is a spelling mismatch between Aadhaar and your Income Tax PAN record, bank KYC and GST filings can fail.

## Mandatory Documents Checklist
- Aadhaar Card with active mobile number
- Existing PAN Card copy or allotment letter
- Gazette or matriculation proof (for major name/DOB edits)

---

title: Udyam MSME Registration Benefits for Indian Startups & Traders
category: MSME & Udyam
status: published
focusKeyword: Udyam MSME registration
seoTitle: Udyam MSME Registration Benefits & Checklist (2026)
seoDescription: Learn how Udyam MSME registration unlocks collateral-free loans, tender preferences, and government subsidies across India.
relatedServiceSlug: udyam-registration
tags: Udyam; MSME; Small Business
excerpt: Discover key subsidies, priority bank lending, and GeM portal advantages unlocked by an official Udyam certificate.
content: ## Why MSME Businesses Register on Udyam
Registered micro and small enterprises qualify for collateral-free CGTMSE credit, delayed-payment protection, and ISO fee reimbursement.

## Step-by-Step Filing Flow
1. Verify Aadhaar and business PAN details
2. Enter NIC activity code and plant investment figures
3. Download your permanent QR-verified Udyam certificate`;

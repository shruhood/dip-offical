import type { Context } from 'hono';
import type { Fetcher } from '@cloudflare/workers-types';
import type { AppVariables, Env } from '../types';
import {
  buildDirectoryMetaAndJsonLd,
  parseIndiaDirectoryPath,
  resolveHierarchyChain,
} from '../../src/lib/indiaDirectorySeo';
import { SUPPORTED_INDIAN_LANGUAGES } from '../../src/data/indianLanguages';
import {
  getDirectoryLocations,
  getDirectoryTranslationsForLocation,
  getPublishedDirectoryServices,
} from './directoryStore';

function escapeHtml(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonForHtmlScript(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function buildFallbackShellHtml(): string {
  return `<!doctype html>
<html lang="en-IN" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Digital India Project</title>
    <meta name="description" content="India Digital Services Directory" />
    <link rel="canonical" href="https://digitalindiaproject.com/india" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}

export async function renderIndiaDirectorySsrResponse(
  c: Context<{ Bindings: Env; Variables: AppVariables }>
): Promise<Response> {
  const url = new URL(c.req.url);
  const parsed = parseIndiaDirectoryPath(url.pathname);

  const [{ locations }, services] = await Promise.all([
    getDirectoryLocations(c.env),
    getPublishedDirectoryServices(c.env),
  ]);

  const hierarchy = resolveHierarchyChain(parsed, locations);
  let matchingTranslation = null;
  if (hierarchy.current) {
    const translations = await getDirectoryTranslationsForLocation(c.env, hierarchy.current.id);
    matchingTranslation = translations.find((t) => t.langCode === parsed.lang) || null;
  }

  const seoPkg = buildDirectoryMetaAndJsonLd({
    parsed,
    locations,
    translation: matchingTranslation,
    services,
  });

  // Fetch compiled SPA index.html asset when bound (runtime production) or fallback cleanly in unit tests
  let htmlTemplate = '';
  if (c.env.ASSETS && typeof c.env.ASSETS.fetch === 'function') {
    try {
      const assetReq = new Request(new URL('/index.html', url.origin).toString(), {
        method: 'GET',
        headers: { accept: 'text/html' },
      });
      const assetRes = (await c.env.ASSETS.fetch(
        assetReq as unknown as Parameters<Fetcher['fetch']>[0]
      )) as unknown as Response;
      if (assetRes.ok) {
        htmlTemplate = await assetRes.text();
      }
    } catch {
      htmlTemplate = '';
    }
  }
  if (!htmlTemplate || !htmlTemplate.includes('</head>')) {
    htmlTemplate = buildFallbackShellHtml();
  }

  if (!seoPkg || !hierarchy.current) {
    const notFoundTitle = 'Location Not Found in India Digital Directory | Digital India Project';
    const notFoundHtml = htmlTemplate
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(notFoundTitle)}</title>`)
      .replace(
        /<\/head>/i,
        `  <meta name="robots" content="noindex, follow" />\n</head>`
      )
      .replace(
        /<div id="root"><\/div>/i,
        `<div id="root"><main style="max-width:760px;margin:48px auto;padding:24px;font-family:system-ui,sans-serif"><h1>Location Not Found</h1><p>This state, district, or town slug is not currently published in the Digital India Project directory.</p><p><a href="/india">Browse All 28 States &amp; 8 Union Territories</a></p></main></div>`
      );
    return new Response(notFoundHtml, {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        'X-Robots-Tag': 'noindex, follow',
        'Cache-Control': 'no-store',
      },
    });
  }

  const loc = hierarchy.current;
  const langMeta = seoPkg.langMeta;

  const headInjections = [
    `<meta name="robots" content="${escapeHtml(seoPkg.robotsContent)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(seoPkg.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(seoPkg.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(seoPkg.canonicalUrl)}" />`,
    `<meta property="og:locale" content="${escapeHtml(langMeta.hreflang.replace('-', '_'))}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(seoPkg.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(seoPkg.description)}" />`,
    ...seoPkg.hreflangs.map(
      (h) => `<link rel="alternate" hreflang="${escapeHtml(h.hreflang)}" href="${escapeHtml(h.href)}" />`
    ),
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(seoPkg.xDefaultUrl)}" />`,
    `<script id="dip-dynamic-jsonld" type="application/ld+json">${safeJsonForHtmlScript(seoPkg.jsonLd)}</script>`,
  ].join('\n    ');

  const ssrPayload = {
    canonicalPath: parsed.canonicalDirectoryPath,
    lang: parsed.lang,
    location: loc,
    hierarchy: {
      state: hierarchy.state || null,
      district: hierarchy.district || null,
      city: hierarchy.city || null,
    },
    childLocations: hierarchy.childLocations.map((cLoc) => ({
      id: cLoc.id,
      name: cLoc.name,
      slug: cLoc.slug,
      level: cLoc.level,
      canonicalPath: cLoc.canonicalPath,
      lgdCode: cLoc.lgdCode,
      pinCodes: cLoc.pinCodes,
      nativeNames: cLoc.nativeNames,
      regionZone: cLoc.regionZone,
      capital: cLoc.capital,
      verified: cLoc.verified,
    })),
    siblingLocations: hierarchy.siblingLocations.map((sLoc) => ({
      id: sLoc.id,
      name: sLoc.name,
      slug: sLoc.slug,
      level: sLoc.level,
      canonicalPath: sLoc.canonicalPath,
      lgdCode: sLoc.lgdCode,
    })),
    translation: matchingTranslation,
    seo: {
      title: seoPkg.title,
      description: seoPkg.description,
      canonicalUrl: seoPkg.canonicalUrl,
      robotsContent: seoPkg.robotsContent,
      headline: seoPkg.headline,
      summary: seoPkg.summary,
      breadcrumbs: seoPkg.breadcrumbs,
      quality: seoPkg.quality,
      faqs: seoPkg.faqs,
    },
  };

  const featuredServices = services
    .filter((s) => s.published !== false && (loc.highlightedServiceSlugs.includes(s.slug) || s.popular))
    .slice(0, 8);

  const semanticBodyHtml = `<div id="root"><article data-ssr-directory="true" lang="${escapeHtml(
    langMeta.hreflang
  )}" dir="${langMeta.rtl ? 'rtl' : 'ltr'}" style="max-width:1120px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif">
    <nav aria-label="Breadcrumb">${seoPkg.breadcrumbs
      .map(
        (b, i) =>
          `${i > 0 ? ' / ' : ''}<a href="${escapeHtml(b.path)}">${escapeHtml(b.name)}</a>`
      )
      .join('')}</nav>
    <header>
      <h1>${escapeHtml(seoPkg.headline)}</h1>
      <p>${escapeHtml(seoPkg.summary)}</p>
      <p><small>${escapeHtml(langMeta.copy.verifiedSourceLabel)} · LGD: ${escapeHtml(
    loc.lgdCode
  )} · PIN: ${escapeHtml(loc.pinCodes)}</small></p>
    </header>
    ${
      hierarchy.childLocations.length > 0
        ? `<section aria-label="Sub-locations"><h2>${escapeHtml(
            loc.level === 'country'
              ? langMeta.copy.browseStates
              : loc.level === 'district'
              ? langMeta.copy.citiesHeading
              : langMeta.copy.districtsHeading
          )}</h2><ul>${hierarchy.childLocations
            .map(
              (child) =>
                `<li><a href="${escapeHtml(
                  parsed.lang === 'en' ? child.canonicalPath : `/${parsed.lang}${child.canonicalPath}`
                )}">${escapeHtml(child.nativeNames?.[parsed.lang] || child.name)}</a> (${escapeHtml(
                  child.lgdCode
                )})</li>`
            )
            .join('')}</ul></section>`
        : ''
    }
    <section aria-label="Services"><h2>${escapeHtml(langMeta.copy.servicesHeading)}</h2><ul>${featuredServices
    .map(
      (srv) =>
        `<li><a href="/services/${escapeHtml(srv.slug)}">${escapeHtml(
          srv.name
        )}</a> — Prof. Fee ₹${Number(srv.serviceCharge || 0)} + Govt Fee ₹${Number(
          srv.govtFees || 0
        )}</li>`
    )
    .join('')}</ul></section>
    <section aria-label="Languages"><h2>22 Scheduled Indian Languages + English</h2><ul>${SUPPORTED_INDIAN_LANGUAGES.map(
      (l) => {
        const href = seoPkg.hreflangs.find((h) => h.langCode === l.code)?.href || seoPkg.canonicalUrl;
        return `<li><a href="${escapeHtml(new URL(href).pathname)}">${escapeHtml(
          l.nativeName
        )} (${escapeHtml(l.nameEn)})</a></li>`;
      }
    ).join('')}</ul></section>
    <section aria-label="FAQ"><h2>${escapeHtml(langMeta.copy.faqHeading)}</h2>${seoPkg.faqs
    .map(
      (f) => `<details><summary>${escapeHtml(f.question)}</summary><p>${escapeHtml(f.answer)}</p></details>`
    )
    .join('')}</section>
    <footer><p><small>${escapeHtml(langMeta.copy.disclaimer)}</small></p></footer>
  </article></div>
  <script id="__DIP_DIR_SSR_DATA__" type="application/json">${safeJsonForHtmlScript(ssrPayload)}</script>`;

  let renderedHtml = htmlTemplate
    .replace(
      /<html[^>]*>/i,
      `<html lang="${escapeHtml(langMeta.hreflang)}" dir="${langMeta.rtl ? 'rtl' : 'ltr'}">`
    )
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seoPkg.title)}</title>`);

  if (/<meta\s+name=["']description["'][^>]*>/i.test(renderedHtml)) {
    renderedHtml = renderedHtml.replace(
      /<meta\s+name=["']description["'][^>]*>/i,
      `<meta name="description" content="${escapeHtml(seoPkg.description)}" />`
    );
  } else {
    renderedHtml = renderedHtml.replace(
      /<\/head>/i,
      `  <meta name="description" content="${escapeHtml(seoPkg.description)}" />\n</head>`
    );
  }

  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(renderedHtml)) {
    renderedHtml = renderedHtml.replace(
      /<link\s+rel=["']canonical["'][^>]*>/i,
      `<link rel="canonical" href="${escapeHtml(seoPkg.canonicalUrl)}" />`
    );
  } else {
    renderedHtml = renderedHtml.replace(
      /<\/head>/i,
      `  <link rel="canonical" href="${escapeHtml(seoPkg.canonicalUrl)}" />\n</head>`
    );
  }

  renderedHtml = renderedHtml
    .replace(/<\/head>/i, `    ${headInjections}\n  </head>`)
    .replace(/<div id="root"><\/div>/i, semanticBodyHtml);

  return new Response(renderedHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
      'X-Robots-Tag': seoPkg.robotsContent,
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      Vary: 'Accept-Encoding',
    },
  });
}

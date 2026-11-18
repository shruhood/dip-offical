import { BlogPost, Service } from '../types';
import {
  buildBlogIndexJsonLd,
  buildBlogPostJsonLd,
} from './blogSeo';
import {
  CANONICAL_ORIGIN,
  buildCanonicalSiteUrl,
} from './siteUrls';
import { getServiceSeoMetadata } from './seoData';
import { INDIA_GEOGRAPHY_SEED } from '../data/indiaGeography';
import {
  buildDirectoryMetaAndJsonLd,
  parseIndiaDirectoryPath,
} from './indiaDirectorySeo';
import { findApiSathiServiceBySlugOrId } from '../data/apiSathiServices';

function syncHreflangTags(
  alternates: Array<{ hreflang: string; href: string }>,
  xDefaultUrl?: string
) {
  document.querySelectorAll('link[data-dip-dir-hreflang="true"]').forEach((el) => el.remove());
  if (!alternates.length) return;
  for (const alt of alternates) {
    const link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('hreflang', alt.hreflang);
    link.setAttribute('href', alt.href);
    link.setAttribute('data-dip-dir-hreflang', 'true');
    document.head.appendChild(link);
  }
  if (xDefaultUrl) {
    const xdef = document.createElement('link');
    xdef.setAttribute('rel', 'alternate');
    xdef.setAttribute('hreflang', 'x-default');
    xdef.setAttribute('href', xDefaultUrl);
    xdef.setAttribute('data-dip-dir-hreflang', 'true');
    document.head.appendChild(xdef);
  }
}

function upsertMeta(attrName: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attrName}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertJsonLd(data: Record<string, any>) {
  const id = 'dip-dynamic-jsonld';
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export function buildServiceDetailJsonLd(
  srv: Service,
  organizationName = 'Digital India Project'
): Record<string, any> {
  const canonicalSeo = getServiceSeoMetadata(srv.slug || srv.id, srv);
  const url =
    srv.canonicalUrl?.trim() ||
    canonicalSeo?.canonicalUrl ||
    `${CANONICAL_ORIGIN}/services/${encodeURIComponent(srv.slug)}`;
  const description = (
    srv.seoDescription?.trim() ||
    canonicalSeo?.seoDescription ||
    srv.shortDesc ||
    srv.fullDesc ||
    ''
  ).slice(0, 300);
  const isProduct = srv.productType === 'digital_product' || canonicalSeo?.schemaType === 'Product';
  const isCustomQuoteZero = Boolean(srv.isCustomQuote && Number(srv.serviceCharge || 0) <= 0);
  const totalOfferPrice =
    Number(srv.serviceCharge || 0) +
    Number(srv.govtFees || 0) +
    Number(srv.thirdPartyFees || 0);
  const availability =
    srv.published === false
      ? 'https://schema.org/OutOfStock'
      : 'https://schema.org/InStock';

  const primaryNode: Record<string, any> = isProduct
    ? {
        '@type': 'Product',
        '@id': `${url}#product`,
        name: srv.name,
        description,
        url,
        category: srv.subcategory || srv.category,
        brand: {
          '@type': 'Brand',
          name: organizationName,
        },
        offers: {
          '@type': 'Offer',
          url,
          price: String(totalOfferPrice),
          priceCurrency: 'INR',
          availability,
        },
      }
    : {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: srv.name,
        description,
        url,
        serviceType: srv.subcategory || srv.category,
        provider: {
          '@type': 'Organization',
          name: organizationName,
          url: CANONICAL_ORIGIN,
        },
        areaServed: {
          '@type': 'Country',
          name: 'India',
        },
        offers: isCustomQuoteZero
          ? {
              '@type': 'Offer',
              url,
              priceCurrency: 'INR',
              availability,
              description: 'Custom scope quotation upon inquiry',
            }
          : {
              '@type': 'Offer',
              url,
              price: String(totalOfferPrice),
              priceCurrency: 'INR',
              availability,
            },
      };

  const categoryLabel = srv.category
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const graph: Record<string, any>[] = [
    primaryNode,
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
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
          name: isProduct ? 'Digital Products' : categoryLabel,
          item: isProduct
            ? `${CANONICAL_ORIGIN}/products`
            : `${CANONICAL_ORIGIN}/services/${encodeURIComponent(srv.category)}`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: srv.name,
          item: url,
        },
      ],
    },
  ];

  const validFaqs = (Array.isArray(srv.faqs) ? srv.faqs : []).filter(
    (f) =>
      f &&
      typeof f.question === 'string' &&
      typeof f.answer === 'string' &&
      f.question.trim().length > 0 &&
      f.answer.trim().length > 0
  );

  if (validFaqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      url,
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

export function applyRouteSeoMetadata(params: {
  route: string;
  param: string;
  services: Service[];
  blogPosts: BlogPost[];
}) {
  const { route, param, services, blogPosts } = params;
  const canonicalHref = buildCanonicalSiteUrl(route, param);

  const canonicalEl = document.querySelector('link[rel="canonical"]');
  if (canonicalEl) canonicalEl.setAttribute('href', canonicalHref);
  if (route !== 'india-directory') {
    syncHreflangTags([]);
    upsertMeta('name', 'robots', 'index, follow');
  }

  let title = 'Digital India Project — Online Digital Services & Registration Assistance';
  let description =
    'Online digital services, GST, PAN, Udyam MSME, FSSAI, Gazette, and DigiLocker registration assistance platform for citizens and businesses in India.';
  let keywords =
    'Digital India Project, PAN Card Online, GST Registration, Udyam MSME, FSSAI License, Gazette Name Change, India Digital Services';
  let ogType = 'website';
  let jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Digital India Project',
    url: CANONICAL_ORIGIN,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${CANONICAL_ORIGIN}/services`,
      'query-input': 'required name=search_term_string',
    },
  };

  if (route === 'blog') {
    const categoryNote = param && param !== 'all' ? `${param} — ` : '';
    title = `${categoryNote}Blog, Compliance Guides & Citizen Resources | Digital India Project`;
    description =
      'Read step-by-step Indian registration guides for PAN card, GSTIN, Udyam MSME, FSSAI, Gazette name change, and Class 3 DSC with document checklists.';
    keywords =
      'Digital India Blog, GST Registration Guide, PAN Card Correction Checklist, Udyam MSME Benefits, Gazette Name Change India';
    jsonLd = buildBlogIndexJsonLd(blogPosts);
  } else if (route === 'blog-detail') {
    const post = blogPosts.find((p) => p.slug === param || p.id === param);
    if (post) {
      title = post.seoTitle?.trim() || `${post.title} | Digital India Project`;
      description = post.seoDescription?.trim() || post.excerpt;
      keywords = [
        ...(post.tags || []),
        ...(post.focusKeyword ? [post.focusKeyword] : []),
        post.category,
      ]
        .filter(Boolean)
        .join(', ');
      ogType = 'article';
      jsonLd = buildBlogPostJsonLd(post);
    } else {
      title = 'Article Not Found | Digital India Project Blog';
    }
  } else if (route === 'verifications') {
    title = 'Instant Online Verification Services (PAN, GSTIN, RC, DL, IFSC, DigiLocker) | Digital India Project';
    description =
      'Run instant real-time PAN, PAN-Aadhaar Link, GSTIN, Vehicle RC (Vahan), Driving Licence (Sarathi), MCA CIN, Voter ID, Bank IFSC, and DigiLocker Aadhaar e-KYC checks.';
    keywords =
      'Instant PAN Verification, GSTIN Check India, Vehicle RC Check, Driving Licence Verification, IFSC Lookup, DigiLocker Aadhaar eKYC';
  } else if (route === 'service-detail') {
    const srv =
      services.find((s) => s.slug === param || s.id === param) ||
      findApiSathiServiceBySlugOrId(param);
    const canonicalSeo = getServiceSeoMetadata(srv?.slug || param, srv);
    if (srv) {
      title =
        srv.seoTitle?.trim() ||
        canonicalSeo?.seoTitle ||
        `${srv.name} — Apply Online, Fees & Documents | Digital India Project`;
      description = srv.seoDescription?.trim() || canonicalSeo?.seoDescription || srv.shortDesc;
      keywords = Array.from(
        new Set([
          ...(canonicalSeo?.focusKeyword ? [canonicalSeo.focusKeyword] : []),
          ...(canonicalSeo?.secondaryKeywords || []),
          srv.name,
          srv.category,
          srv.subcategory || '',
          'Digital India Project',
        ].filter(Boolean))
      ).join(', ');
      ogType = canonicalSeo?.ogType || (srv.productType === 'digital_product' ? 'product' : 'website');
      const resolvedCanonical = srv.canonicalUrl?.trim() || canonicalSeo?.canonicalUrl;
      if (canonicalEl && resolvedCanonical) {
        canonicalEl.setAttribute('href', resolvedCanonical);
      }
      jsonLd = buildServiceDetailJsonLd(srv);
    } else if (canonicalSeo) {
      title = canonicalSeo.seoTitle;
      description = canonicalSeo.seoDescription;
      keywords = [canonicalSeo.focusKeyword, ...canonicalSeo.secondaryKeywords].join(', ');
      ogType = canonicalSeo.ogType;
      if (canonicalEl) canonicalEl.setAttribute('href', canonicalSeo.canonicalUrl);
    }
  } else if (route === 'services') {
    title =
      param && param !== 'all'
        ? `${param.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Services | Digital India Project`
        : 'All Digital Services, Templates & Bundles (145+ Catalogue) | Digital India Project';
    description =
      'Browse PAN, GST, Udyam MSME, FSSAI, Class 3 DSC, ITR, Legal Drafting, Digital Templates & B2B APIs with transparent fees and clear exclusions.';
  } else if (route === 'products') {
    title = 'Downloadable Business Templates, GST Spreadsheets & Startup Kits | Digital India Project';
    description =
      'Instant-download GST Excel calculators, invoice packs, salary calculators, compliance calendars, and startup workbooks in INR.';
  } else if (route === 'packages') {
    title = 'Value Compliance Packages & Business Starter Bundles | Digital India Project';
    description =
      'Save on bundled startup launch, monthly business tax retainers, citizen documentation, and creator kits.';
  } else if (route === 'india-directory') {
    const parsedDir = parseIndiaDirectoryPath(param || '/india');
    const dirSeo = buildDirectoryMetaAndJsonLd({
      parsed: parsedDir,
      locations: INDIA_GEOGRAPHY_SEED,
      services,
    });
    if (dirSeo) {
      title = dirSeo.title;
      description = dirSeo.description;
      keywords = `${dirSeo.breadcrumbs.map((b) => b.name).join(', ')}, India Digital Directory, PAN, GST, Udyam MSME`;
      if (canonicalEl) canonicalEl.setAttribute('href', dirSeo.canonicalUrl);
      upsertMeta('name', 'robots', dirSeo.robotsContent);
      syncHreflangTags(dirSeo.hreflangs, dirSeo.xDefaultUrl);
      jsonLd = dirSeo.jsonLd;
    } else {
      title = 'Location Not Found | India Digital Directory';
      upsertMeta('name', 'robots', 'noindex, follow');
      syncHreflangTags([]);
    }
  } else if (route === 'location') {
    const cityLabel = param
      ? param.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Silvassa';
    title = `Online Digital, Business, Tax & Citizen Services in ${cityLabel} | Digital India Project`;
    description = `PAN Card, GST Registration, Udyam MSME, ITR Filing, FSSAI, Gazette & Website Solutions for ${cityLabel}, DNH, Daman, Vapi, Valsad & Umargam.`;
  } else if (route === 'pricing') {
    title = 'Transparent Service & Digital Product Pricing Schedule (INR) | Digital India Project';
    description =
      'Compare professional service fees alongside separate government statutory and third-party charges across 145+ offerings.';
  } else if (route === 'track') {
    title = 'Track Application Status Online | Digital India Project';
    description =
      'Check real-time verification milestones, document remarks, and certificate download availability using your Application ID.';
  } else if (route === 'become-partner') {
    title = 'Become Our Partner — Operator, Distributor & B2B API Program | Digital India Project';
    description =
      'Explore benefits, monthly earning potential, and transparent onboarding charges for Digital India Project Center Operators, Territory Distributors, and B2B API Partners.';
  } else if (route === 'partner') {
    title = 'Partner Program & CSC Assisted Filing Network | Digital India Project';
    description =
      'Join Digital India Project as an authorized partner or citizen facilitation center with transparent commissions and referral tracking.';
  } else if (route === 'tools') {
    title = param
      ? `${param.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Digital Tools Tray | Digital India Project`
      : 'Digital Tools Tray (150+ Browser PDF, CSC Photo, GST, OCR & AI Tools) | Digital India Project';
    description =
      'Run 150+ free and pro browser-based PDF, CSC passport photo, KB compressor, QR/barcode, GST/EMI calculator, OCR, and AI document tools.';
    keywords =
      'Digital Tools Tray, PDF Merge India, Passport Photo Resize, KB Compressor, GST Calculator, OCR Scanner, CSC Operator Tools';
  } else if (route === 'tool-detail') {
    const toolLabel = param ? param.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Digital Utility';
    title = `${toolLabel} — Digital Tools Tray | Digital India Project`;
    description = `Use ${toolLabel} online inside Digital India Project's Digital Tools Tray with instant browser processing and Free/Pro plans.`;
  } else if (route === 'tool-plans') {
    title = 'Digital Tools Tray Plans (Free Starter, Pro, CSC Operator & Enterprise) | Digital India Project';
    description =
      'Compare Free Starter, Personal Pro, CSC Operator, Professional, and Enterprise plans for 150+ browser & AI document tools.';
  }

  document.title = title;
  upsertMeta('name', 'description', description);
  upsertMeta('name', 'keywords', keywords);
  upsertMeta('property', 'og:type', ogType);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:url', canonicalHref);
  upsertMeta('property', 'og:site_name', 'Digital India Project');
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
  upsertJsonLd(jsonLd);
}

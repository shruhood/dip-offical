import { CATALOGUE_CATEGORIES, CATEGORY_SLUG_ALIASES, resolveCategorySlug } from '../data/catalogue/categories';
import { parseIndiaDirectoryPath } from './indiaDirectorySeo';

export const CANONICAL_DOMAIN = 'digitalindiaproject.com';
export const CANONICAL_ORIGIN = 'https://digitalindiaproject.com';

export const ALLOWED_SITE_HOSTS = new Set([
  'digitalindiaproject.com',
  'www.digitalindiaproject.com',
  'auth.digitalindiaproject.com',
]);

const CANONICAL_CATEGORY_SLUGS = new Set(CATALOGUE_CATEGORIES.map((c) => c.slug));

export function parseLocationPath(
  rawPathname: string,
  rawSearch: string = ''
): { route: string; param: string } {
  const pathname = rawPathname.replace(/\/+$/, '') || '/';
  const searchParams = new URLSearchParams(rawSearch);

  if (pathname === '/' || pathname === '') return { route: 'home', param: '' };
  const indiaDir = parseIndiaDirectoryPath(pathname);
  if (indiaDir.matched) {
    return { route: 'india-directory', param: indiaDir.canonicalDirectoryPath };
  }
  if (pathname === '/services') {
    return { route: 'services', param: resolveCategorySlug(searchParams.get('category') || 'all') };
  }
  if (pathname.startsWith('/services/')) {
    const slug = decodeURIComponent(pathname.replace('/services/', ''));
    const lowerSlug = slug.toLowerCase();
    if (
      CANONICAL_CATEGORY_SLUGS.has(lowerSlug) ||
      Boolean(CATEGORY_SLUG_ALIASES[lowerSlug]) ||
      lowerSlug === 'packages' ||
      lowerSlug === 'service-packages'
    ) {
      return { route: 'services', param: resolveCategorySlug(lowerSlug) };
    }
    return { route: 'service-detail', param: slug };
  }
  if (pathname.startsWith('/service/')) {
    return { route: 'service-detail', param: decodeURIComponent(pathname.replace('/service/', '')) };
  }
  if (pathname === '/products' || pathname === '/digital-products') {
    return { route: 'products', param: 'digital-products' };
  }
  if (pathname.startsWith('/products/')) {
    return { route: 'service-detail', param: decodeURIComponent(pathname.replace('/products/', '')) };
  }
  if (pathname === '/packages' || pathname === '/bundles') {
    return { route: 'packages', param: 'packages' };
  }
  if (pathname.startsWith('/packages/')) {
    return { route: 'service-detail', param: decodeURIComponent(pathname.replace('/packages/', '')) };
  }
  if (pathname.startsWith('/locations/')) {
    return { route: 'location', param: decodeURIComponent(pathname.replace('/locations/', '')) };
  }
  if (pathname === '/verifications' || pathname === '/instant-verify') {
    return { route: 'verifications', param: searchParams.get('product') || '' };
  }
  if (pathname.startsWith('/verifications/')) {
    return { route: 'verifications', param: decodeURIComponent(pathname.replace('/verifications/', '')) };
  }
  if (pathname === '/how-it-works') return { route: 'how-it-works', param: '' };
  if (pathname === '/pricing') return { route: 'pricing', param: '' };
  if (pathname === '/track') return { route: 'track', param: '' };
  if (pathname === '/about') return { route: 'about', param: '' };
  if (pathname === '/contact') return { route: 'contact', param: '' };
  if (pathname === '/faq' || pathname === '/help') return { route: 'faq', param: '' };
  if (pathname === '/legal') return { route: 'legal', param: 'disclaimer' };
  if (pathname.startsWith('/legal/')) {
    return { route: 'legal', param: decodeURIComponent(pathname.replace('/legal/', '')) };
  }
  if (pathname === '/blog') {
    return { route: 'blog', param: searchParams.get('category') || '' };
  }
  if (pathname.startsWith('/blog/')) {
    return { route: 'blog-detail', param: decodeURIComponent(pathname.replace('/blog/', '')) };
  }
  if (pathname === '/login') return { route: 'login', param: '' };
  if (pathname === '/signup' || pathname === '/register') {
    return { route: 'register', param: searchParams.get('type') || '' };
  }
  if (pathname === '/forgot-password') return { route: 'forgot-password', param: '' };
  if (pathname === '/auth/action' || pathname === '/__/auth/action') {
    return { route: 'auth-action', param: '' };
  }
  if (pathname === '/dashboard') return { route: 'dashboard', param: 'overview' };
  if (pathname.startsWith('/dashboard/')) {
    return { route: 'dashboard', param: decodeURIComponent(pathname.replace('/dashboard/', '')) };
  }
  if (pathname === '/b2b') return { route: 'b2b', param: 'overview' };
  if (pathname.startsWith('/b2b/')) {
    return { route: 'b2b', param: decodeURIComponent(pathname.replace('/b2b/', '')) };
  }
  if (pathname === '/workspace') return { route: 'workspace', param: '' };
  if (pathname === '/operator-enroll') return { route: 'operator-enroll', param: '' };
  if (pathname === '/operator') return { route: 'operator', param: 'queue' };
  if (pathname.startsWith('/operator/')) {
    return { route: 'operator', param: decodeURIComponent(pathname.replace('/operator/', '')) };
  }
  if (pathname === '/manager') return { route: 'manager', param: 'sla' };
  if (pathname.startsWith('/manager/')) {
    return { route: 'manager', param: decodeURIComponent(pathname.replace('/manager/', '')) };
  }
  if (pathname === '/become-partner' || pathname === '/become-our-partner' || pathname === '/partner-program') {
    return { route: 'become-partner', param: searchParams.get('track') || '' };
  }
  if (pathname === '/partner' || pathname === '/partner-enroll') {
    return { route: 'partner', param: 'overview' };
  }
  if (pathname.startsWith('/partner/')) {
    return { route: 'partner', param: decodeURIComponent(pathname.replace('/partner/', '')) };
  }
  if (pathname === '/tools') {
    return { route: 'tools', param: searchParams.get('category') || '' };
  }
  if (pathname.startsWith('/tools/')) {
    return { route: 'tool-detail', param: decodeURIComponent(pathname.replace('/tools/', '')) };
  }
  if (pathname === '/tool-plans' || pathname === '/plans') {
    return { route: 'tool-plans', param: '' };
  }
  if (pathname === '/admin') return { route: 'admin', param: 'overview' };
  if (pathname.startsWith('/admin/')) {
    return { route: 'admin', param: decodeURIComponent(pathname.replace('/admin/', '')) };
  }

  return { route: 'home', param: '' };
}

export function buildUrlForRoute(route: string, param: string = ''): string {
  switch (route) {
    case 'home':
      return '/';
    case 'services':
      return param && param !== 'all' ? `/services?category=${encodeURIComponent(param)}` : '/services';
    case 'service-detail':
      return `/services/${encodeURIComponent(param)}`;
    case 'products':
      return param && param !== 'digital-products' && param !== 'all'
        ? `/products/${encodeURIComponent(param)}`
        : '/products';
    case 'packages':
      return param && param !== 'packages' && param !== 'all'
        ? `/packages/${encodeURIComponent(param)}`
        : '/packages';
    case 'tools':
      return param && param !== 'all' ? `/tools?category=${encodeURIComponent(param)}` : '/tools';
    case 'tool-detail':
      return `/tools/${encodeURIComponent(param)}`;
    case 'tool-plans':
      return '/tool-plans';
    case 'location':
      return param ? `/locations/${encodeURIComponent(param)}` : '/locations/silvassa';
    case 'india-directory':
      return param && param.startsWith('/') ? param : '/india';
    case 'verifications':
      return param ? `/verifications?product=${encodeURIComponent(param)}` : '/verifications';
    case 'how-it-works':
      return '/how-it-works';
    case 'pricing':
      return '/pricing';
    case 'track':
      return '/track';
    case 'about':
      return '/about';
    case 'contact':
      return '/contact';
    case 'faq':
    case 'help':
      return '/help';
    case 'legal':
      return param ? `/legal/${encodeURIComponent(param)}` : '/legal/disclaimer';
    case 'blog':
      return param && param !== 'all' ? `/blog?category=${encodeURIComponent(param)}` : '/blog';
    case 'blog-detail':
      return `/blog/${encodeURIComponent(param)}`;
    case 'login':
      return '/login';
    case 'register':
    case 'signup':
      return param ? `/signup?type=${encodeURIComponent(param)}` : '/signup';
    case 'forgot-password':
      return '/forgot-password';
    case 'auth-action':
      return '/auth/action';
    case 'dashboard':
      return param && param !== 'overview' ? `/dashboard/${encodeURIComponent(param)}` : '/dashboard';
    case 'b2b':
      return param && param !== 'overview' ? `/b2b/${encodeURIComponent(param)}` : '/b2b';
    case 'workspace':
      return '/workspace';
    case 'operator-enroll':
      return '/operator-enroll';
    case 'operator':
      return param && param !== 'queue' ? `/operator/${encodeURIComponent(param)}` : '/operator';
    case 'manager':
      return param && param !== 'sla' ? `/manager/${encodeURIComponent(param)}` : '/manager';
    case 'become-partner':
      return param ? `/become-partner?track=${encodeURIComponent(param)}` : '/become-partner';
    case 'partner':
    case 'partner-enroll':
      return param && param !== 'overview' ? `/partner/${encodeURIComponent(param)}` : '/partner';
    case 'admin':
      return param && param !== 'overview' ? `/admin/${encodeURIComponent(param)}` : '/admin';
    default:
      return '/';
  }
}

export function buildCanonicalSiteUrl(route: string, param: string = ''): string {
  return `${CANONICAL_ORIGIN}${buildUrlForRoute(route, param)}`;
}

/**
 * Ensures post-auth redirects and email action continue URLs strictly stay on
 * digitalindiaproject.com internal routes and reject external/untrusted hosts.
 */
export function sanitizeInternalRedirect(
  rawUrl?: string | null,
  fallbackPath: string = '/login'
): { path: string; fullUrl: string; route: string; param: string } {
  const safeFallback = fallbackPath.startsWith('/') ? fallbackPath : '/login';

  if (!rawUrl || typeof rawUrl !== 'string') {
    const parsed = parseLocationPath(safeFallback);
    return {
      path: safeFallback,
      fullUrl: `${CANONICAL_ORIGIN}${safeFallback}`,
      route: parsed.route,
      param: parsed.param,
    };
  }

  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    const qIdx = trimmed.indexOf('?');
    const pathname = qIdx >= 0 ? trimmed.slice(0, qIdx) : trimmed;
    const search = qIdx >= 0 ? trimmed.slice(qIdx) : '';
    const parsed = parseLocationPath(pathname, search);
    const normalizedPath = `${pathname}${search}`;
    return {
      path: normalizedPath,
      fullUrl: `${CANONICAL_ORIGIN}${normalizedPath}`,
      route: parsed.route,
      param: parsed.param,
    };
  }

  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    const isAllowed =
      u.protocol === 'https:' && ALLOWED_SITE_HOSTS.has(host);
    if (isAllowed) {
      const normalizedPath = `${u.pathname || '/'}${u.search || ''}`;
      const parsed = parseLocationPath(u.pathname || '/', u.search || '');
      return {
        path: normalizedPath,
        fullUrl: `${CANONICAL_ORIGIN}${normalizedPath}`,
        route: parsed.route,
        param: parsed.param,
      };
    }
  } catch {
    // Fall through to safe fallback
  }

  const parsedFallback = parseLocationPath(safeFallback);
  return {
    path: safeFallback,
    fullUrl: `${CANONICAL_ORIGIN}${safeFallback}`,
    route: parsedFallback.route,
    param: parsedFallback.param,
  };
}

export function buildAuthActionContinueUrl(nextRoute: string = 'login', param: string = ''): string {
  const nextPath = buildUrlForRoute(nextRoute, param);
  return `${CANONICAL_ORIGIN}/auth/action?continueUrl=${encodeURIComponent(`${CANONICAL_ORIGIN}${nextPath}`)}`;
}

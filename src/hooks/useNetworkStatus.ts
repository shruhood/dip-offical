import { useCallback, useEffect, useState } from 'react';

export interface CachedRouteEntry {
  route: string;
  param: string;
  label: string;
  visitedAt: string;
}

const CACHED_ROUTES_KEY = 'dip_cached_routes_v1';
const MAX_CACHED_ROUTES = 8;

const OFFLINE_CAPABLE_ROUTES = new Set([
  'home',
  'services',
  'products',
  'packages',
  'service-detail',
  'blog',
  'blog-detail',
  'faq',
  'about',
  'contact',
  'how-it-works',
  'pricing',
  'legal',
  'location',
  'dashboard',
]);

export function isRouteOfflineReady(route: string): boolean {
  return OFFLINE_CAPABLE_ROUTES.has(route || 'home');
}

function formatReadableSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getRouteDisplayLabel(route: string, param = ''): string {
  switch (route) {
    case 'home':
      return 'Home Workspace';
    case 'services':
      return param && param !== 'all' ? `${formatReadableSlug(param)} Services` : 'All Services Catalog';
    case 'products':
      return 'Digital Kits & Downloads';
    case 'packages':
      return 'Compliance Bundles';
    case 'service-detail':
      return param ? formatReadableSlug(param) : 'Service Details';
    case 'blog':
      return 'Citizen & Business Guides';
    case 'blog-detail':
      return param ? formatReadableSlug(param) : 'Guide Article';
    case 'faq':
      return 'Help & FAQs';
    case 'about':
      return 'About Digital India Project';
    case 'how-it-works':
      return 'How Assistance Works';
    case 'pricing':
      return 'Transparent Fee Schedule';
    case 'legal':
      return param ? `${formatReadableSlug(param)} Policy` : 'Legal & Policies';
    case 'location':
      return param ? `${formatReadableSlug(param)} Desk` : 'Regional Service Desk';
    case 'dashboard':
      return param === 'drafts' ? 'My Saved Drafts' : 'My Applications Dashboard';
    default:
      return formatReadableSlug(route || 'home');
  }
}

export function getCachedRoutes(): CachedRouteEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CACHED_ROUTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordVisitedRoute(route: string, param = '') {
  if (typeof window === 'undefined') return;
  if (!isRouteOfflineReady(route)) return;

  const normalizedRoute = route || 'home';
  const normalizedParam = param || '';
  const entry: CachedRouteEntry = {
    route: normalizedRoute,
    param: normalizedParam,
    label: getRouteDisplayLabel(normalizedRoute, normalizedParam),
    visitedAt: new Date().toISOString(),
  };

  try {
    const existing = getCachedRoutes().filter(
      (item) => !(item.route === normalizedRoute && item.param === normalizedParam)
    );
    const next = [entry, ...existing].slice(0, MAX_CACHED_ROUTES);
    window.localStorage.setItem(CACHED_ROUTES_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineSince, setOfflineSince] = useState<string | null>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? new Date().toISOString() : null
  );
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    let reconnectTimer: number | undefined;

    const handleOnline = () => {
      setIsOnline(true);
      setOfflineSince(null);
      setJustReconnected(true);
      window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(() => setJustReconnected(false), 4500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
      setOfflineSince((prev) => prev || new Date().toISOString());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.clearTimeout(reconnectTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return false;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(`/manifest.json?ping=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (response.ok) {
        setIsOnline(true);
        setOfflineSince(null);
        return true;
      }
    } catch {
      // Request failed; treat as offline
    } finally {
      window.clearTimeout(timeout);
    }

    const fallbackOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
    setIsOnline(fallbackOnline);
    return fallbackOnline;
  }, []);

  return {
    isOnline,
    offlineSince,
    justReconnected,
    dismissReconnected: () => setJustReconnected(false),
    checkConnection,
  };
}

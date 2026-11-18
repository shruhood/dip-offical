export type DeviceViewportClass = 'mobile' | 'tablet' | 'desktop';

export interface PageLoadMetric {
  id: string;
  route: string;
  param?: string;
  loadTimeMs: number;
  ttfbMs?: number;
  fcpMs?: number;
  domReadyMs?: number;
  viewport: DeviceViewportClass;
  timestamp: string;
  kind: 'initial' | 'route';
}

export interface InteractionMetric {
  id: string;
  category: string;
  action: string;
  label?: string;
  route: string;
  viewport: DeviceViewportClass;
  timestamp: string;
}

export interface RoutePerfStat {
  route: string;
  views: number;
  avgLoadMs: number;
  minLoadMs: number;
  maxLoadMs: number;
  lastLoadMs: number;
}

export interface InteractionSummaryItem {
  key: string;
  category: string;
  action: string;
  count: number;
  lastTimestamp: string;
}

export interface PerfSummary {
  avgPageLoadMs: number;
  fastestRouteMs: number;
  slowestRouteMs: number;
  initialLoadMs: number | null;
  fcpMs: number | null;
  ttfbMs: number | null;
  totalPageViews: number;
  totalInteractions: number;
  routeStats: RoutePerfStat[];
  topInteractions: InteractionSummaryItem[];
  recentPageLoads: PageLoadMetric[];
  recentInteractions: InteractionMetric[];
  viewportBreakdown: Record<DeviceViewportClass, number>;
}

interface StoredPerfState {
  pageLoads: PageLoadMetric[];
  interactions: InteractionMetric[];
}

const STORAGE_KEY = 'dip_perf_analytics_v1';
const MAX_PAGE_LOADS = 120;
const MAX_INTERACTIONS = 240;

type Listener = () => void;
const listeners = new Set<Listener>();

let memoryState: StoredPerfState | null = null;
let initialCaptured = false;

export function detectViewportClass(): DeviceViewportClass {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function loadState(): StoredPerfState {
  if (memoryState) return memoryState;
  if (typeof window === 'undefined') {
    memoryState = { pageLoads: [], interactions: [] };
    return memoryState;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryState = {
        pageLoads: Array.isArray(parsed?.pageLoads) ? parsed.pageLoads.slice(0, MAX_PAGE_LOADS) : [],
        interactions: Array.isArray(parsed?.interactions) ? parsed.interactions.slice(0, MAX_INTERACTIONS) : [],
      };
      return memoryState;
    }
  } catch {
    // ignore storage errors
  }
  memoryState = { pageLoads: [], interactions: [] };
  return memoryState;
}

function saveState(next: StoredPerfState) {
  memoryState = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  }
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribePerfMetrics(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function captureInitialNavigationTiming(route: string, param?: string) {
  if (typeof window === 'undefined' || initialCaptured) return;
  initialCaptured = true;

  const recordFromPerf = () => {
    try {
      const navEntries = window.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const nav = navEntries?.[0];
      const paintEntries = window.performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint');

      const ttfbMs = nav && nav.responseStart > 0 ? Math.round(nav.responseStart) : undefined;
      const domReadyMs =
        nav && nav.domContentLoadedEventEnd > 0
          ? Math.round(nav.domContentLoadedEventEnd)
          : undefined;
      const rawLoad =
        nav && nav.loadEventEnd > 0
          ? nav.loadEventEnd
          : nav && nav.domInteractive > 0
          ? nav.domInteractive
          : window.performance.now();
      const loadTimeMs = Math.max(1, Math.round(rawLoad));
      const fcpMs = fcpEntry ? Math.round(fcpEntry.startTime) : undefined;

      const state = loadState();
      const entry: PageLoadMetric = {
        id: `pl_init_${Date.now()}`,
        route: route || 'home',
        param: param || undefined,
        loadTimeMs,
        ttfbMs,
        fcpMs,
        domReadyMs,
        viewport: detectViewportClass(),
        timestamp: new Date().toISOString(),
        kind: 'initial',
      };

      saveState({
        ...state,
        pageLoads: [entry, ...state.pageLoads].slice(0, MAX_PAGE_LOADS),
      });
    } catch {
      // ignore unsupported browser performance APIs
    }
  };

  if (document.readyState === 'complete') {
    window.setTimeout(recordFromPerf, 60);
  } else {
    window.addEventListener('load', () => window.setTimeout(recordFromPerf, 60), { once: true });
  }
}

export function recordRouteLoad(route: string, param: string | undefined, startPerfNow: number) {
  if (typeof window === 'undefined') return;
  const elapsed = Math.max(1, Math.round(window.performance.now() - startPerfNow));
  const state = loadState();
  const entry: PageLoadMetric = {
    id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    route: route || 'home',
    param: param || undefined,
    loadTimeMs: elapsed,
    viewport: detectViewportClass(),
    timestamp: new Date().toISOString(),
    kind: 'route',
  };
  saveState({
    ...state,
    pageLoads: [entry, ...state.pageLoads].slice(0, MAX_PAGE_LOADS),
  });
}

export function trackInteraction(
  category: string,
  action: string,
  label?: string,
  route?: string
) {
  if (typeof window === 'undefined') return;
  const state = loadState();
  const currentPath =
    route || window.location.pathname.replace(/^\//, '').split('/')[0] || 'home';
  const entry: InteractionMetric = {
    id: `ix_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    category,
    action,
    label: label ? label.slice(0, 80) : undefined,
    route: currentPath,
    viewport: detectViewportClass(),
    timestamp: new Date().toISOString(),
  };
  saveState({
    ...state,
    interactions: [entry, ...state.interactions].slice(0, MAX_INTERACTIONS),
  });
}

export function clearPerfMetrics() {
  saveState({ pageLoads: [], interactions: [] });
}

export function getPerfSummary(): PerfSummary {
  const state = loadState();
  const loads = state.pageLoads;
  const interactions = state.interactions;

  const routeMap = new Map<
    string,
    { views: number; totalMs: number; minMs: number; maxMs: number; lastMs: number }
  >();

  let sumMs = 0;
  let fastest = Number.POSITIVE_INFINITY;
  let slowest = 0;

  for (const item of loads) {
    sumMs += item.loadTimeMs;
    if (item.loadTimeMs < fastest) fastest = item.loadTimeMs;
    if (item.loadTimeMs > slowest) slowest = item.loadTimeMs;

    const existing = routeMap.get(item.route);
    if (!existing) {
      routeMap.set(item.route, {
        views: 1,
        totalMs: item.loadTimeMs,
        minMs: item.loadTimeMs,
        maxMs: item.loadTimeMs,
        lastMs: item.loadTimeMs,
      });
    } else {
      existing.views += 1;
      existing.totalMs += item.loadTimeMs;
      if (item.loadTimeMs < existing.minMs) existing.minMs = item.loadTimeMs;
      if (item.loadTimeMs > existing.maxMs) existing.maxMs = item.loadTimeMs;
    }
  }

  const routeStats: RoutePerfStat[] = Array.from(routeMap.entries())
    .map(([route, s]) => ({
      route,
      views: s.views,
      avgLoadMs: Math.round(s.totalMs / s.views),
      minLoadMs: s.minMs,
      maxLoadMs: s.maxMs,
      lastLoadMs: s.lastMs,
    }))
    .sort((a, b) => b.views - a.views);

  const interactionMap = new Map<string, InteractionSummaryItem>();
  for (const ix of interactions) {
    const key = `${ix.category}:${ix.action}`;
    const existing = interactionMap.get(key);
    if (!existing) {
      interactionMap.set(key, {
        key,
        category: ix.category,
        action: ix.action,
        count: 1,
        lastTimestamp: ix.timestamp,
      });
    } else {
      existing.count += 1;
    }
  }

  const topInteractions = Array.from(interactionMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const initialEntry = loads.find((l) => l.kind === 'initial');
  const fcpEntry = loads.find((l) => typeof l.fcpMs === 'number');
  const ttfbEntry = loads.find((l) => typeof l.ttfbMs === 'number');

  const viewportBreakdown: Record<DeviceViewportClass, number> = {
    mobile: 0,
    tablet: 0,
    desktop: 0,
  };
  for (const item of loads) {
    viewportBreakdown[item.viewport] = (viewportBreakdown[item.viewport] || 0) + 1;
  }

  return {
    avgPageLoadMs: loads.length > 0 ? Math.round(sumMs / loads.length) : 0,
    fastestRouteMs: Number.isFinite(fastest) ? fastest : 0,
    slowestRouteMs: slowest,
    initialLoadMs: initialEntry?.loadTimeMs ?? null,
    fcpMs: fcpEntry?.fcpMs ?? null,
    ttfbMs: ttfbEntry?.ttfbMs ?? null,
    totalPageViews: loads.length,
    totalInteractions: interactions.length,
    routeStats,
    topInteractions,
    recentPageLoads: loads.slice(0, 20),
    recentInteractions: interactions.slice(0, 20),
    viewportBreakdown,
  };
}

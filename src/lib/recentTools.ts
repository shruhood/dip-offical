export const RECENT_TOOLS_STORAGE_KEY = 'dst_recent_tools';
export const MAX_RECENT_TOOLS = 5;

export function pushRecentToolSlug(
  existing: string[],
  slug: string,
  max: number = MAX_RECENT_TOOLS
): string[] {
  const cleanSlug = slug.trim();
  if (!cleanSlug) return existing.slice(0, max);
  const next = [cleanSlug, ...existing.filter((s) => s !== cleanSlug)];
  return next.slice(0, max);
}

export function mergeRecentSlugs(
  localSlugs: string[],
  historySlugs: string[],
  max: number = MAX_RECENT_TOOLS
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const s of [...localSlugs, ...historySlugs]) {
    const clean = s.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    merged.push(clean);
    if (merged.length >= max) break;
  }
  return merged;
}

export function readStoredRecentSlugs(): string[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(RECENT_TOOLS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .slice(0, MAX_RECENT_TOOLS);
  } catch {
    return [];
  }
}

export function writeStoredRecentSlugs(slugs: string[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(
      RECENT_TOOLS_STORAGE_KEY,
      JSON.stringify(slugs.slice(0, MAX_RECENT_TOOLS))
    );
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function clearStoredRecentSlugs(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(RECENT_TOOLS_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

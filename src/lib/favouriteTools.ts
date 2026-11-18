import type { ToolDefinition, ToolFavouriteDoc } from '../types/tool';

export const FAVOURITES_STORAGE_KEY = 'dst_favourite_tools';

export function buildFavouriteDoc(
  tool: ToolDefinition,
  ownerUid = 'local'
): ToolFavouriteDoc {
  return {
    ownerUid: ownerUid.slice(0, 128),
    toolSlug: tool.slug.slice(0, 128),
    toolName: tool.name.slice(0, 160),
    category: tool.categoryLabel.slice(0, 64),
    createdAt: new Date().toISOString(),
  };
}

export function toggleFavouriteList(
  list: ToolFavouriteDoc[],
  tool: ToolDefinition,
  ownerUid = 'local'
): { nextList: ToolFavouriteDoc[]; added: boolean; item?: ToolFavouriteDoc } {
  const exists = list.some((f) => f.toolSlug === tool.slug);
  if (exists) {
    return {
      nextList: list.filter((f) => f.toolSlug !== tool.slug),
      added: false,
    };
  }
  const item = buildFavouriteDoc(tool, ownerUid);
  return {
    nextList: [item, ...list],
    added: true,
    item,
  };
}

export function mergeFavouriteDocs(
  remote: ToolFavouriteDoc[],
  local: ToolFavouriteDoc[],
  ownerUid: string
): { merged: ToolFavouriteDoc[]; toUpload: ToolFavouriteDoc[] } {
  const remoteSlugs = new Set(remote.map((f) => f.toolSlug));
  const toUpload: ToolFavouriteDoc[] = [];

  for (const item of local) {
    if (!item.toolSlug || remoteSlugs.has(item.toolSlug)) continue;
    remoteSlugs.add(item.toolSlug);
    toUpload.push({
      ownerUid: ownerUid.slice(0, 128),
      toolSlug: item.toolSlug.slice(0, 128),
      toolName: item.toolName.slice(0, 160),
      category: item.category.slice(0, 64),
      createdAt: item.createdAt || new Date().toISOString(),
    });
  }

  return {
    merged: [...toUpload, ...remote],
    toUpload,
  };
}

export function readStoredFavourites(): ToolFavouriteDoc[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(FAVOURITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ToolFavouriteDoc =>
        Boolean(item) &&
        typeof item.toolSlug === 'string' &&
        item.toolSlug.length > 0 &&
        typeof item.toolName === 'string' &&
        typeof item.category === 'string'
    );
  } catch {
    return [];
  }
}

export function writeStoredFavourites(items: ToolFavouriteDoc[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
}

import { CATEGORIES, CATEGORY_LABELS, getToolsByCategory, searchTools, TOOLS_REGISTRY } from '../data/toolsRegistry';
import type { ToolCategorySlug, ToolDefinition } from '../types/tool';

export type CatalogFilterTab = 'all' | 'popular' | 'recent' | 'free' | 'premium' | 'paid' | 'csc' | 'ai';

const CATEGORY_SLUG_ALIASES: Record<string, string> = {
  'csc-citizen': 'csc-tools',
  'ai-assist': 'ai-tools',
};

export function resolveCategorySlugAlias(slug?: string): string | undefined {
  if (!slug) return undefined;
  return CATEGORY_SLUG_ALIASES[slug] || slug;
}

export interface SidebarCategoryItem {
  slug: ToolCategorySlug;
  label: string;
  description: string;
  iconName: string;
  group: 'core' | 'specialized';
}

const CORE_LABEL_OVERRIDES: Partial<Record<ToolCategorySlug, string>> = {
  'pdf-tools': 'PDF Utilities',
  'image-tools': 'Image Processing',
  'csc-tools': 'CSC & Govt Portals',
  compressors: 'File Compressors',
  converters: 'Document Converters',
  calculators: 'Financial Calculators',
  'qr-barcode': 'QR & Barcodes',
  'business-tools': 'Business & Billing',
  'text-ocr': 'OCR & Language',
  'printing-tools': 'Printing & Cyber Café',
  'ai-tools': 'AI Assistants',
};

const SPECIALIZED_CATEGORIES: SidebarCategoryItem[] = [
  {
    slug: 'audio-tools',
    label: 'Audio & Speech',
    description: 'Compress audio recordings and convert text to speech or voice dictation.',
    iconName: 'Volume2',
    group: 'specialized',
  },
  {
    slug: 'video-tools',
    label: 'Video Processing',
    description: 'Reduce MP4 and WebM video file sizes directly in your browser.',
    iconName: 'Video',
    group: 'specialized',
  },
  {
    slug: 'developer-tools',
    label: 'Data & Developer',
    description: 'Transform JSON, CSV, and Excel datasets cleanly without external uploads.',
    iconName: 'Braces',
    group: 'specialized',
  },
  {
    slug: 'seo-tools',
    label: 'Text & SEO Limits',
    description: 'Verify exact character counts, lengths, and formatting for portals and SEO.',
    iconName: 'TextCursorInput',
    group: 'specialized',
  },
];

export const SIDEBAR_CATEGORIES: SidebarCategoryItem[] = [
  ...CATEGORIES.map((c) => ({
    slug: c.slug,
    label: CORE_LABEL_OVERRIDES[c.slug] || c.title,
    description: c.description,
    iconName: c.iconName,
    group: 'core' as const,
  })),
  ...SPECIALIZED_CATEGORIES,
];

export function getSidebarCategoryMeta(slug?: string): SidebarCategoryItem | undefined {
  const resolved = resolveCategorySlugAlias(slug);
  if (!resolved) return undefined;
  return SIDEBAR_CATEGORIES.find((item) => item.slug === resolved);
}

export function getCatalogCategoryTitle(slug?: string): string | undefined {
  const resolved = resolveCategorySlugAlias(slug);
  if (!resolved) return undefined;
  const sidebarMatch = getSidebarCategoryMeta(resolved);
  if (sidebarMatch) return sidebarMatch.label;
  return CATEGORY_LABELS[resolved as ToolCategorySlug];
}

export function applyCatalogFilterTab(
  tools: ToolDefinition[],
  filterTab: CatalogFilterTab
): ToolDefinition[] {
  switch (filterTab) {
    case 'popular':
      return tools.filter((t) => t.isPopular);
    case 'recent':
      return tools.filter((t) => t.isRecent);
    case 'free':
      return tools.filter((t) => t.tier === 'free');
    case 'premium':
    case 'paid':
      return tools.filter((t) => t.tier !== 'free');
    case 'csc':
      return tools.filter((t) => t.isCscEssential);
    case 'ai':
      return tools.filter((t) => t.isAiPowered);
    case 'all':
    default:
      return tools;
  }
}

export function filterCatalogTools(options: {
  categorySlug?: string;
  query?: string;
  filterTab?: CatalogFilterTab;
}): ToolDefinition[] {
  const { categorySlug, query = '', filterTab = 'all' } = options;
  const resolvedCategory = resolveCategorySlugAlias(categorySlug);
  let base = resolvedCategory ? getToolsByCategory(resolvedCategory) : TOOLS_REGISTRY;

  const trimmed = query.trim();
  if (trimmed) {
    const allowedIds = new Set(base.map((t) => t.id));
    base = searchTools(trimmed).filter((t) => allowedIds.has(t.id));
  }

  return applyCatalogFilterTab(base, filterTab);
}

export function getSidebarCategoryCounts(
  query = '',
  filterTab: CatalogFilterTab = 'all'
): { total: number; byCategory: Record<string, number> } {
  const globalMatches = filterCatalogTools({ query, filterTab });
  const matchingIds = new Set(globalMatches.map((t) => t.id));

  const byCategory: Record<string, number> = {};
  for (const cat of SIDEBAR_CATEGORIES) {
    byCategory[cat.slug] = getToolsByCategory(cat.slug).filter((t) =>
      matchingIds.has(t.id)
    ).length;
  }

  return {
    total: globalMatches.length,
    byCategory,
  };
}

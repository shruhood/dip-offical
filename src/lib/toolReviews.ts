import type { ToolReviewDoc, ToolReviewStats } from '../types/tool';

export const RATING_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

export function clampStarRating(value: number): 1 | 2 | 3 | 4 | 5 {
  const rounded = Math.round(Number.isFinite(value) ? value : 5);
  if (rounded <= 1) return 1;
  if (rounded >= 5) return 5;
  return rounded as 1 | 2 | 3 | 4 | 5;
}

export function buildToolReviewId(toolSlug: string, authorUid: string): string {
  const safeSlug = toolSlug
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, '-')
    .slice(0, 90);
  const safeUid = authorUid.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 36);
  return `${safeSlug}__${safeUid}`.slice(0, 128);
}

export function sanitizeToolReviewInput(input: {
  toolSlug: string;
  authorUid: string;
  authorName?: string | null;
  authorPhotoUrl?: string | null;
  rating: number;
  title?: string;
  comment?: string;
  existingCreatedAt?: string;
}): ToolReviewDoc {
  const now = new Date().toISOString().slice(0, 64);
  const safeSlug = input.toolSlug
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, '-')
    .slice(0, 90);
  const safeUid = input.authorUid.trim().slice(0, 128);
  const id = `${safeSlug}__${safeUid}`;

  const cleanName = (input.authorName || 'Digital Tools User').trim().slice(0, 80) || 'Digital Tools User';
  const cleanComment = (input.comment || '').trim().slice(0, 800);
  const cleanTitle = (input.title || '').trim().slice(0, 120);
  const cleanPhoto = (input.authorPhotoUrl || '').trim().slice(0, 512);
  const createdAt = (input.existingCreatedAt || now).slice(0, 64);

  const doc: ToolReviewDoc = {
    id,
    toolSlug: safeSlug,
    authorUid: safeUid,
    authorName: cleanName,
    rating: clampStarRating(input.rating),
    comment: cleanComment,
    createdAt,
    updatedAt: now,
  };

  if (cleanTitle) {
    doc.title = cleanTitle;
  }
  if (cleanPhoto) {
    doc.authorPhotoUrl = cleanPhoto;
  }

  return doc;
}

export function computeReviewStats(reviews: ToolReviewDoc[]): ToolReviewStats {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  };

  if (reviews.length === 0) {
    return { totalCount: 0, averageRating: 0, distribution };
  }

  let sum = 0;
  for (const r of reviews) {
    const star = clampStarRating(r.rating);
    distribution[star] += 1;
    sum += star;
  }

  return {
    totalCount: reviews.length,
    averageRating: Math.round((sum / reviews.length) * 10) / 10,
    distribution,
  };
}

export function filterAndSortReviews(
  reviews: ToolReviewDoc[],
  options: {
    starFilter?: number | 'all';
    sortBy?: 'newest' | 'highest' | 'lowest';
  } = {}
): ToolReviewDoc[] {
  const { starFilter = 'all', sortBy = 'newest' } = options;

  const filtered =
    starFilter === 'all'
      ? [...reviews]
      : reviews.filter((r) => clampStarRating(r.rating) === starFilter);

  filtered.sort((a, b) => {
    if (sortBy === 'highest') {
      if (b.rating !== a.rating) return b.rating - a.rating;
    } else if (sortBy === 'lowest') {
      if (a.rating !== b.rating) return a.rating - b.rating;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return filtered;
}

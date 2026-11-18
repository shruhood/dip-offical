import React, { useEffect, useState } from 'react';
import { Star, MessageSquare, Trash2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { ToolDefinition, ToolReviewDoc, ToolReviewStats } from '../../types/tool';
import {
  computeReviewStats,
  filterAndSortReviews,
  RATING_LABELS,
  sanitizeToolReviewInput,
} from '../../lib/toolReviews';

const REVIEWS_KEY_PREFIX = 'dip_tool_reviews_v1_';

function readReviewsForTool(slug: string): ToolReviewDoc[] {
  try {
    const raw = window.localStorage.getItem(`${REVIEWS_KEY_PREFIX}${slug}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReviewsForTool(slug: string, list: ToolReviewDoc[]): void {
  try {
    window.localStorage.setItem(`${REVIEWS_KEY_PREFIX}${slug}`, JSON.stringify(list));
  } catch {
    // ignore
  }
}

interface ToolReviewsSectionProps {
  tool: ToolDefinition;
  onStatsChange?: (stats: ToolReviewStats) => void;
}

export const ToolReviewsSection: React.FC<ToolReviewsSectionProps> = ({
  tool,
  onStatsChange,
}) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ToolReviewDoc[]>(() => readReviewsForTool(tool.slug));
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'highest' | 'lowest'>('newest');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    const loaded = readReviewsForTool(tool.slug);
    setReviews(loaded);
    onStatsChange?.(computeReviewStats(loaded));
  }, [tool.slug]);

  const stats = computeReviewStats(reviews);
  const sortedReviews = filterAndSortReviews(reviews, { sortBy });
  const authorUid = user?.id || 'guest_reviewer';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    const entry = sanitizeToolReviewInput({
      toolSlug: tool.slug,
      authorUid,
      authorName: user?.name || 'Citizen User',
      authorPhotoUrl: user?.avatarUrl,
      rating,
      title,
      comment,
    });
    const next = [entry, ...reviews.filter((r) => r.id !== entry.id)];
    setReviews(next);
    writeReviewsForTool(tool.slug, next);
    onStatsChange?.(computeReviewStats(next));
    setTitle('');
    setComment('');
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleDeleteOwn = (id: string) => {
    const next = reviews.filter((r) => r.id !== id);
    setReviews(next);
    writeReviewsForTool(tool.slug, next);
    onStatsChange?.(computeReviewStats(next));
  };

  return (
    <section
      id="reviews"
      className="p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#FF671F]" />
            <span>Ratings &amp; Citizen Feedback</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {stats.totalCount > 0
              ? `${stats.averageRating.toFixed(1)} average rating across ${stats.totalCount} review(s)`
              : 'Be the first user to share practical feedback on this tool.'}
          </p>
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'newest' | 'highest' | 'lowest')}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
        >
          <option value="newest">Newest First</option>
          <option value="highest">Highest Rated</option>
          <option value="lowest">Lowest Rated</option>
        </select>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Rate {tool.name}:
          </span>
          <div className="flex items-center gap-1">
            {([1, 2, 3, 4, 5] as const).map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1 cursor-pointer transition-transform hover:scale-110"
                title={RATING_LABELS[star]}
              >
                <Star
                  className={`w-4 h-4 ${
                    star <= rating
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                />
              </button>
            ))}
            <span className="ml-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {RATING_LABELS[rating]}
            </span>
          </div>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short headline (optional)"
          maxLength={100}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:border-[#FF671F]"
        />
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share how well this tool worked for your PDF, photo, or portal submission..."
          rows={2}
          maxLength={600}
          required
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:border-[#FF671F]"
        />

        <div className="flex items-center justify-between gap-2">
          {savedNotice ? (
            <span className="text-xs text-[#138808] font-semibold inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Review saved
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">
              Posting as {user?.name || 'Citizen Guest'}
            </span>
          )}
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold cursor-pointer"
          >
            Submit Review
          </button>
        </div>
      </form>

      {sortedReviews.length > 0 && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {sortedReviews.map((rev) => (
            <div key={rev.id} className="py-3 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {rev.authorName}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-amber-500 font-bold tabular-nums">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {rev.rating}.0
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(rev.updatedAt).toLocaleDateString('en-IN')}
                  </span>
                </div>
                {rev.title && (
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {rev.title}
                  </div>
                )}
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {rev.comment}
                </p>
              </div>

              {rev.authorUid === authorUid && (
                <button
                  type="button"
                  onClick={() => handleDeleteOwn(rev.id)}
                  title="Delete your review"
                  className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

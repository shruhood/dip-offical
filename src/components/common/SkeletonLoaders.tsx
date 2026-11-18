import React from 'react';

interface SkeletonBlockProps {
  className?: string;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ className = '' }) => (
  <div
    aria-hidden="true"
    className={`skeleton-shimmer rounded-lg bg-slate-200/80 dark:bg-slate-800/80 ${className}`}
  />
);

export const ServiceCardSkeleton: React.FC = () => (
  <div
    aria-hidden="true"
    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 flex flex-col justify-between gap-3"
  >
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <SkeletonBlock className="w-9 h-9 rounded-xl shrink-0" />
        <SkeletonBlock className="h-3 w-20" />
      </div>
      <div className="space-y-1.5">
        <SkeletonBlock className="h-4 w-4/5" />
        <SkeletonBlock className="h-3 w-3/5" />
      </div>
      <div className="space-y-1 pt-1">
        <SkeletonBlock className="h-2.5 w-full" />
        <SkeletonBlock className="h-2.5 w-4/5" />
      </div>
    </div>
    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
      <SkeletonBlock className="h-4 w-16" />
      <SkeletonBlock className="h-7 w-20 rounded-lg" />
    </div>
  </div>
);

export const ServiceGridSkeleton: React.FC<{ count?: number; columnsClassName?: string }> = ({
  count = 6,
  columnsClassName = 'grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4',
}) => (
  <div role="status" aria-busy="true" aria-label="Loading services" className={`grid ${columnsClassName}`}>
    {Array.from({ length: count }).map((_, idx) => (
      <ServiceCardSkeleton key={idx} />
    ))}
  </div>
);

export const ListRowsSkeleton: React.FC<{ rows?: number; compact?: boolean }> = ({
  rows = 4,
  compact = false,
}) => (
  <div role="status" aria-busy="true" aria-label="Loading records" className="divide-y divide-slate-100 dark:divide-slate-800">
    {Array.from({ length: rows }).map((_, idx) => (
      <div
        key={idx}
        className={`${compact ? 'py-2.5' : 'py-3.5'} flex items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <SkeletonBlock className="w-8 h-8 rounded-xl shrink-0" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <SkeletonBlock className="h-3.5 w-3/5" />
            <SkeletonBlock className="h-2.5 w-2/5" />
          </div>
        </div>
        <SkeletonBlock className="h-6 w-16 rounded-lg shrink-0" />
      </div>
    ))}
  </div>
);

export const TableRowsSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => (
  <div
    role="status"
    aria-busy="true"
    aria-label="Loading table data"
    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
  >
    <div className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 px-4 py-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: cols }).map((_, idx) => (
        <SkeletonBlock key={idx} className="h-3 w-3/4" />
      ))}
    </div>
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div
          key={rIdx}
          className="px-4 py-3.5 grid gap-3 items-center"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, cIdx) => (
            <SkeletonBlock
              key={cIdx}
              className={`h-3.5 ${cIdx === 0 ? 'w-4/5' : cIdx === cols - 1 ? 'w-1/2 ml-auto' : 'w-2/3'}`}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div
    role="status"
    aria-busy="true"
    aria-label="Loading cards"
    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
  >
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-4 w-4 rounded" />
        </div>
        <SkeletonBlock className="h-4 w-3/4" />
        <SkeletonBlock className="h-3 w-1/2" />
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-3 w-14" />
        </div>
      </div>
    ))}
  </div>
);

export const TrackingResultSkeleton: React.FC = () => (
  <div
    role="status"
    aria-busy="true"
    aria-label="Verifying application status"
    className="mt-6 border-t border-[#E5E7EB] dark:border-slate-800 pt-6 space-y-4"
  >
    <div className="p-4 bg-[#F7F8FA] dark:bg-slate-800/60 rounded-xl border border-[#E5E7EB] dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="space-y-2 flex-1">
        <SkeletonBlock className="h-4 w-44" />
        <SkeletonBlock className="h-3 w-64 max-w-full" />
      </div>
      <SkeletonBlock className="h-7 w-28 rounded-lg shrink-0" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <SkeletonBlock className="h-16 w-full rounded-xl" />
      <SkeletonBlock className="h-16 w-full rounded-xl" />
      <SkeletonBlock className="h-16 w-full rounded-xl" />
    </div>
    <ListRowsSkeleton rows={3} compact />
  </div>
);

export const VerificationSkeleton: React.FC<{ title?: string; subtitle?: string }> = ({
  title = 'Syncing verification status...',
  subtitle,
}) => (
  <div role="status" aria-busy="true" className="py-5 space-y-4">
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1.5 flex-1">
          <div className="text-sm font-bold text-slate-800 dark:text-white">{title}</div>
          {subtitle && (
            <div className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
          )}
        </div>
        <SkeletonBlock className="w-10 h-10 rounded-xl shrink-0" />
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className="h-full w-2/3 bg-[#FF671F] rounded-full skeleton-shimmer" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <SkeletonBlock className="h-10 w-full rounded-lg" />
        <SkeletonBlock className="h-10 w-full rounded-lg" />
      </div>
    </div>
  </div>
);

export const InlineSkeletonPulse: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    aria-hidden="true"
    className={`inline-flex items-center gap-1 ${className}`}
  >
    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-pulse" />
    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-pulse [animation-delay:150ms]" />
    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
  </span>
);

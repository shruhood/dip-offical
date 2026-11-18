import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, RotateCw } from 'lucide-react';
import { trackInteraction } from '../../lib/perfMonitor';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}

const PULL_THRESHOLD = 68;
const MAX_PULL = 108;

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 240);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const triggerReloadFromTop = async () => {
    if (refreshing) return;
    setRefreshing(true);
    trackInteraction('refresh', 'reload_from_top');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      await onRefresh();
    } finally {
      window.setTimeout(() => {
        setRefreshing(false);
        setPullDistance(0);
      }, 360);
    }
  };

  const handleGoToTop = () => {
    trackInteraction('navigation', 'go_to_top');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (refreshing || window.scrollY > 2) {
      startYRef.current = null;
      return;
    }
    startYRef.current = e.touches[0]?.clientY ?? null;
    pullingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startYRef.current === null || refreshing) return;
    if (window.scrollY > 2) {
      startYRef.current = null;
      setPullDistance(0);
      return;
    }
    const currentY = e.touches[0]?.clientY ?? startYRef.current;
    const delta = currentY - startYRef.current;
    if (delta > 6) {
      pullingRef.current = true;
      const damped = Math.min(MAX_PULL, Math.round(delta * 0.52));
      setPullDistance(damped);
    } else if (pullingRef.current) {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (startYRef.current === null) return;
    startYRef.current = null;
    if (pullingRef.current && pullDistance >= PULL_THRESHOLD) {
      setPullDistance(52);
      void triggerReloadFromTop();
    } else {
      setPullDistance(0);
    }
    pullingRef.current = false;
  };

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);
  const isVisible = pullDistance > 6 || refreshing;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative flex-1 flex flex-col"
    >
      {/* Top Linear Shimmer Bar when refreshing */}
      {refreshing && (
        <div
          aria-live="polite"
          aria-label="Reloading view"
          className="fixed top-0 left-0 right-0 z-50 h-1 bg-orange-100 dark:bg-slate-800 overflow-hidden"
        >
          <div className="h-full w-1/2 bg-[#FF671F] skeleton-shimmer" />
        </div>
      )}

      {/* Pull-to-Refresh Indicator Drawer */}
      <div
        aria-hidden={!isVisible}
        className="overflow-hidden transition-[height,opacity] duration-200 ease-out flex items-center justify-center bg-[#FFFDF8] dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800/70"
        style={{
          height: refreshing ? 46 : pullDistance > 6 ? pullDistance : 0,
          opacity: isVisible ? 1 : 0,
        }}
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <span
            className="w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center text-[#FF671F] transition-transform"
            style={{
              transform: `rotate(${Math.round(progress * 270)}deg)`,
            }}
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-pulse' : ''}`} />
          </span>
          <span>
            {refreshing
              ? 'Refreshing view...'
              : pullDistance >= PULL_THRESHOLD
              ? 'Release to reload from top'
              : 'Pull down to reload'}
          </span>
        </div>
      </div>

      {children}

      {/* Circular Go to Top Button with Upside Arrow */}
      {showScrollTop && (
        <button
          type="button"
          onClick={handleGoToTop}
          title="Go to top"
          aria-label="Go to top"
          className="fixed bottom-[7.5rem] right-3.5 lg:bottom-[4.25rem] lg:right-6 z-30 w-10 h-10 p-0 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-lg hover:border-[#FF671F] text-[#FF671F] hover:bg-[#FFF5EE] dark:hover:bg-slate-800 flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
        >
          <ArrowUp className="w-4 h-4 stroke-[2.5]" />
        </button>
      )}
    </div>
  );
};

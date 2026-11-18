import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Heart, Sparkles, X, ArrowRight } from 'lucide-react';
import { useToolTray } from '../../context/ToolTrayContext';
import { filterNotificationsByKind } from '../../lib/notifications';

interface ToolNotificationBellProps {
  onNavigate: (route: string, param?: string) => void;
}

export const ToolNotificationBell: React.FC<ToolNotificationBellProps> = ({ onNavigate }) => {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotification,
  } = useToolTray();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'favorite_update' | 'new_tool'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const visibleItems = filterNotificationsByKind(notifications, activeTab);
  const favCount = notifications.filter((n) => n.kind === 'favorite_update').length;
  const newCount = notifications.filter((n) => n.kind === 'new_tool').length;

  const handleOpenItem = (id: string, toolSlug?: string) => {
    markNotificationRead(id);
    setOpen(false);
    if (toolSlug) {
      onNavigate('tool-detail', toolSlug);
    } else {
      onNavigate('tools');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={
          unreadNotificationCount > 0
            ? `Tool notifications (${unreadNotificationCount} unread)`
            : 'Tool notifications'
        }
        aria-expanded={open}
        title="Tool Updates & New Releases"
        className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-[#FF671F] hover:text-[#FF671F] transition-colors cursor-pointer"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {unreadNotificationCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#FF671F] text-white text-[10px] font-bold tabular-nums flex items-center justify-center leading-none border-2 border-white dark:border-slate-950"
          >
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Digital Tools notifications"
          className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-[68px] sm:top-auto sm:mt-2 sm:w-[380px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl z-50 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Tool Updates &amp; Releases
              </h3>
              {unreadNotificationCount > 0 && (
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  · {unreadNotificationCount} unread
                </span>
              )}
            </div>
            {unreadNotificationCount > 0 && (
              <button
                type="button"
                onClick={() => markAllNotificationsRead()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF671F] hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
            <div role="group" aria-label="Filter tool notifications" className="flex items-center gap-1">
              {(
                [
                  { id: 'all', label: `All (${notifications.length})` },
                  { id: 'favorite_update', label: `Saved (${favCount})` },
                  { id: 'new_tool', label: `New Tools (${newCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tabular-nums whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {visibleItems.length === 0 ? (
              <div className="px-4 py-8 text-center space-y-1.5">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {activeTab === 'favorite_update'
                    ? 'No updates for your saved tools yet'
                    : 'All caught up on tool releases'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Bookmark any tool with the heart icon to track updates here.
                </p>
              </div>
            ) : (
              visibleItems.map((item) => (
                <div
                  key={item.id}
                  className={`px-4 py-3 flex items-start justify-between gap-2.5 transition-colors ${
                    item.read
                      ? 'bg-white dark:bg-slate-900'
                      : 'bg-orange-50/70 dark:bg-orange-950/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleOpenItem(item.id, item.toolSlug)}
                    className="flex items-start gap-2.5 text-left min-w-0 flex-1 cursor-pointer group"
                  >
                    <div
                      className={`mt-0.5 w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                        item.kind === 'favorite_update'
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-500'
                          : 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800 text-[#FF671F]'
                      }`}
                    >
                      {item.kind === 'favorite_update' ? (
                        <Heart className="w-3.5 h-3.5 fill-rose-500" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                        <span>
                          {item.kind === 'favorite_update' ? 'Saved Tool Update' : 'New Release'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {new Date(item.createdAt).toLocaleDateString('en-IN')}
                        </span>
                        {!item.read && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-bold text-[#FF671F]">New</span>
                          </>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#FF671F] line-clamp-1">
                        {item.title}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissNotification(item.id)}
                    aria-label={`Dismiss ${item.title}`}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNavigate('tools');
              }}
              className="inline-flex items-center gap-1 font-bold text-[#FF671F] hover:underline cursor-pointer"
            >
              <span>Explore All 150 Tools</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNavigate('tool-plans');
              }}
              className="text-slate-600 dark:text-slate-300 font-semibold hover:underline cursor-pointer"
            >
              ₹10 / Pro Plans
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

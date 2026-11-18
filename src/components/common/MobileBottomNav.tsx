import React from 'react';
import { Home, LayoutGrid, SearchCheck, Package, UserCheck, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { DynamicNavigationState, resolveDynamicNavigation } from '../../lib/navigationController';
import { trackInteraction } from '../../lib/perfMonitor';

interface MobileBottomNavProps {
  currentRoute: string;
  navState?: DynamicNavigationState;
  onNavigate: (route: string, param?: string) => void;
  onScrollTopAndRefresh: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentRoute,
  navState: controlledNavState,
  onNavigate,
  onScrollTopAndRefresh,
}) => {
  const { user, role, permissions, isAuthenticated } = useAuth();
  const { lang } = useLanguage();

  const navState =
    controlledNavState ||
    resolveDynamicNavigation({
      user,
      role,
      permissions,
      isAuthenticated,
      currentRoute,
      lang,
    });

  const ICON_FOR_ROUTE: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
    home: Home,
    services: LayoutGrid,
    products: Package,
    track: SearchCheck,
    login: LogIn,
  };

  const items = navState.mobileBottomItems.map((item) => {
    const icon = ICON_FOR_ROUTE[item.route] || UserCheck;
    const isActive =
      item.route === 'home'
        ? currentRoute === 'home'
        : item.route === 'services'
        ? currentRoute === 'services' || currentRoute === 'service-detail' || currentRoute === 'packages'
        : item.route === 'products'
        ? currentRoute === 'products'
        : item.route === 'track'
        ? currentRoute === 'track'
        : [
            'dashboard',
            'admin',
            'operator',
            'operator-enroll',
            'manager',
            'partner',
            'b2b',
            'workspace',
            'login',
            'register',
          ].includes(currentRoute);

    return {
      ...item,
      icon,
      isActive,
    };
  });

  const handleTap = (item: (typeof items)[number]) => {
    trackInteraction('navigation', 'bottom_nav_tap', item.id, currentRoute);
    if (item.isActive) {
      onScrollTopAndRefresh();
    } else {
      onNavigate(item.route, item.param);
    }
  };

  return (
    <nav
      aria-label="Mobile and Tablet App Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-slate-800/90 shadow-[0_-4px_20px_rgba(15,23,42,0.06)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-2xl mx-auto grid grid-cols-5 items-center h-16 px-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTap(item)}
              aria-current={item.isActive ? 'page' : undefined}
              className="min-h-[46px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-transform duration-150 active:scale-95 cursor-pointer select-none group"
            >
              <span
                className={`px-3.5 py-1 rounded-full transition-all duration-200 flex items-center justify-center ${
                  item.isActive
                    ? 'bg-[#FF671F]/15 text-[#FF671F] scale-105'
                    : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white group-hover:bg-slate-100 dark:group-hover:bg-slate-800/70'
                }`}
              >
                <Icon className="w-[19px] h-[19px]" strokeWidth={item.isActive ? 2.4 : 1.9} />
              </span>
              <span
                className={`text-[10px] leading-none tracking-tight whitespace-nowrap ${
                  item.isActive
                    ? 'font-bold text-[#FF671F]'
                    : 'font-medium text-slate-600 dark:text-slate-400'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Logo } from './Logo';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToolTray } from '../../context/ToolTrayContext';
import { buildUrlForRoute } from '../../lib/siteUrls';
import { SUPPORTED_INDIAN_LANGUAGES, type SupportedLanguageCode } from '../../data/indianLanguages';
import {
  ControlledNavItem,
  DynamicNavigationState,
  resolveDynamicNavigation,
} from '../../lib/navigationController';
import {
  Menu,
  X,
  ChevronDown,
  ArrowRight,
  Shield,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  FolderOpen,
  Building2,
  Database,
  UserPlus,
  UserCheck,
  Handshake,
  Briefcase,
  Sun,
  Moon,
  BookOpen,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
  Crown,
  FlaskConical,
  CreditCard,
  History,
  Bell,
  Headphones,
  Save,
  Activity,
} from 'lucide-react';
import { trackInteraction } from '../../lib/perfMonitor';
import { ToolNotificationBell } from '../tools/ToolNotificationBell';

interface HeaderProps {
  onNavigate: (route: string, param?: string) => void;
  currentRoute: string;
  currentParam?: string;
  navState?: DynamicNavigationState;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  mobileSidebarOpen?: boolean;
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  currentRoute,
  currentParam = '',
  navState: controlledNavState,
  sidebarCollapsed = false,
  onToggleSidebar,
  mobileSidebarOpen = false,
  onToggleMobileSidebar,
}) => {
  const { lang, setLang, t } = useLanguage();
  const { user, role, permissions, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { setTrayOpen, plan } = useToolTray();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const userDropdownRef = useRef<HTMLDivElement>(null);
  const moreDropdownRef = useRef<HTMLDivElement>(null);
  const navContainerRef = useRef<HTMLElement>(null);
  const measureNavRef = useRef<HTMLDivElement>(null);

  const navState =
    controlledNavState ||
    resolveDynamicNavigation({
      user,
      role,
      permissions,
      isAuthenticated,
      currentRoute,
      currentParam,
      lang,
      plan,
    });
  const normalizedRole = navState.effectiveRole;
  const navLinks = navState.headerPrimaryLinks;
  const [visibleNavCount, setVisibleNavCount] = useState<number>(navLinks.length);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserDropdownOpen(false);
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const recomputeNavFit = useCallback(() => {
    const container = navContainerRef.current;
    const measureEl = measureNavRef.current;
    if (!container || !measureEl) return;

    const availableWidth = container.clientWidth;
    if (availableWidth <= 0) return;

    const childNodes = Array.from(measureEl.children) as HTMLElement[];
    if (childNodes.length === 0) return;

    const gapPx = window.innerWidth >= 1280 ? 20 : 14;
    const itemWidths = childNodes.map((el) => Math.ceil(el.getBoundingClientRect().width));
    const totalAllWidth =
      itemWidths.reduce((acc, w) => acc + w, 0) + Math.max(0, itemWidths.length - 1) * gapPx;

    if (totalAllWidth <= availableWidth - 16) {
      setVisibleNavCount(navLinks.length);
      setMoreMenuOpen(false);
      return;
    }

    const moreReservePx = 96;
    let usedWidth = 0;
    let fitCount = 0;
    for (let i = 0; i < itemWidths.length; i += 1) {
      const nextWidth = usedWidth + (fitCount > 0 ? gapPx : 0) + itemWidths[i];
      if (nextWidth + gapPx + moreReservePx <= availableWidth) {
        usedWidth = nextWidth;
        fitCount += 1;
      } else {
        break;
      }
    }
    setVisibleNavCount(fitCount);
  }, [navLinks.length]);

  useLayoutEffect(() => {
    recomputeNavFit();
  }, [recomputeNavFit, navLinks, lang, sidebarCollapsed]);

  useEffect(() => {
    const container = navContainerRef.current;
    if (!container) return;

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        recomputeNavFit();
      });
      observer.observe(container);
    }
    window.addEventListener('resize', recomputeNavFit);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', recomputeNavFit);
    };
  }, [recomputeNavFit]);

  const DROPDOWN_ICON_MAP: Record<
    ControlledNavItem['iconKey'],
    React.ComponentType<{ className?: string }>
  > = {
    home: LayoutDashboard,
    services: Shield,
    products: FileCheck2,
    packages: FileCheck2,
    track: Activity,
    blog: BookOpen,
    login: UserCheck,
    register: UserPlus,
    become_partner: Handshake,
    kyc: UserCheck,
    b2b: Building2,
    partners: Handshake,
    payments: CreditCard,
    shield: Shield,
    sliders: Briefcase,
    server: Database,
    layers: Briefcase,
    gauge: Activity,
    cloud: Database,
    activity: Activity,
    workspace: Database,
    headphones: Headphones,
    sandbox_test: FlaskConical,
    camera: FileCheck2,
    file_check: FileCheck2,
    file_text: BookOpen,
    receipt: CreditCard,
    folder: FolderOpen,
    bell: Bell,
    award: Crown,
    calculator: Briefcase,
    save: Save,
    download: Download,
    history: History,
    briefcase: Briefcase,
    tools: Wrench,
    sparkles: Crown,
    crown: Crown,
    compass: LayoutDashboard,
    help: Headphones,
    info: BookOpen,
    phone: Headphones,
  };

  const roleMenuItems = navState.headerDropdownItems;
  const headerCtaTarget = navState.headerCta;

  const isNavItemActive = (item: { route: string; param?: string }) => {
    if (item.param) {
      return (
        currentRoute === item.route &&
        (currentParam === item.param || (!currentParam && (item.param === 'overview' || item.param === 'queue' || item.param === 'sla')))
      );
    }
    return (
      currentRoute === item.route ||
      (item.route === 'services' &&
        (currentRoute === 'service-detail' ||
          currentRoute === 'products' ||
          currentRoute === 'packages')) ||
      (item.route === 'blog' && currentRoute === 'blog-detail') ||
      (item.route === 'become-partner' && !user && currentRoute === 'operator-enroll')
    );
  };

  const handleNav = (route: string, param?: string) => {
    trackInteraction('navigation', 'header_nav', param ? `${route}/${param}` : route, currentRoute);
    onNavigate(route, param);
    setUserDropdownOpen(false);
    setMoreMenuOpen(false);
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, route: string, param?: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    handleNav(route, param);
  };

  return (
    <header className="w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-2xs">
      {/* Compact Top Facilitation Bar (Desktop only to honor 15% mobile/tablet sticky cap) */}
      <div className="hidden lg:block bg-[#FFFDF8] dark:bg-slate-900 border-b border-[#F1E8D9] dark:border-slate-800 px-3 sm:px-6 lg:px-8 py-1 text-[11px] text-slate-600 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <p className="truncate">
            <strong className="font-semibold text-slate-800 dark:text-slate-200">Private Facilitation Notice:</strong>{' '}
            <span>Digital India Project is an independent private digital services firm, not a government entity.</span>
          </p>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle Light/Dark Theme"
              className="p-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#FF671F] transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  lang === 'en' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('hi')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  lang === 'hi' ? 'bg-[#FF671F] text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                हिंदी
              </button>
              <select
                aria-label="Select Indian Language"
                value={lang}
                onChange={(e) => setLang(e.target.value as SupportedLanguageCode)}
                className="bg-transparent text-[11px] text-slate-700 dark:text-slate-200 px-1.5 py-0.5 border-l border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer max-w-[110px]"
              >
                {SUPPORTED_INDIAN_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-white dark:bg-slate-900">
                    {l.nativeName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Single-Row Persistent Navigation Bar */}
      <div className="relative max-w-[1440px] mx-auto px-2.5 sm:px-5 lg:px-6 h-12 sm:h-14 lg:h-16 flex items-center justify-between gap-2 lg:gap-4">
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Mobile & Tablet Drawer Toggle */}
          {onToggleMobileSidebar && (
            <button
              type="button"
              onClick={() => {
                onToggleMobileSidebar();
                trackInteraction('ui', 'sidebar_drawer_toggle', mobileSidebarOpen ? 'close' : 'open', currentRoute);
              }}
              aria-label="Toggle sidebar menu"
              className="lg:hidden w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 hover:border-[#FF671F] active:scale-95 transition cursor-pointer shrink-0"
            >
              {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          )}

          {/* Desktop Sidebar Collapse Toggle */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={() => {
                onToggleSidebar();
                trackInteraction('ui', 'sidebar_rail_toggle', sidebarCollapsed ? 'expand' : 'collapse', currentRoute);
              }}
              aria-label={sidebarCollapsed ? 'Expand sidebar menu' : 'Collapse sidebar menu'}
              title={sidebarCollapsed ? 'Expand Sidebar Menu' : 'Collapse Sidebar Menu'}
              className="hidden lg:flex w-8 h-8 items-center justify-center text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 hover:border-[#FF671F] hover:text-[#FF671F] transition cursor-pointer shrink-0"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          )}

          <a
            href={buildUrlForRoute('home')}
            onClick={(e) => handleLinkClick(e, 'home')}
            className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF671F] rounded-lg transition-opacity hover:opacity-90 cursor-pointer shrink-0"
          >
            <Logo size="md" showSubtitle={false} />
          </a>
        </div>

        {/* Zoom-Safe Role-Specific Single-Line Top Bar Navigation (overflows gracefully into More menu) */}
        <nav
          ref={navContainerRef}
          aria-label="Primary Navigation"
          className="hidden lg:flex flex-1 min-w-0 relative items-center justify-center"
        >
          {/* Off-flow width measurement clone to keep link widths accurate at any zoom/language */}
          <div
            ref={measureNavRef}
            aria-hidden="true"
            className="flex items-center gap-3.5 xl:gap-5 invisible absolute top-0 left-0 pointer-events-none whitespace-nowrap"
          >
            {navLinks.map((item) => (
              <span
                key={`measure-${item.route}-${item.param || 'base'}`}
                className="py-2 text-[12.5px] xl:text-[13px] font-semibold whitespace-nowrap shrink-0"
              >
                {lang === 'hi' ? item.labelHi : item.label}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3.5 xl:gap-5 min-w-0 max-w-full">
            {navLinks.slice(0, visibleNavCount).map((item) => {
              const isActive = isNavItemActive(item);
              return (
                <a
                  key={`${item.route}-${item.param || 'base'}`}
                  href={buildUrlForRoute(item.route, item.param)}
                  onClick={(e) => handleLinkClick(e, item.route, item.param)}
                  className={`relative py-2 text-[12.5px] xl:text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:text-[#FF671F] ${
                    isActive
                      ? 'text-[#FF671F] font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  <span>{lang === 'hi' ? item.labelHi : item.label}</span>
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#FF671F] rounded-full" />
                  )}
                </a>
              );
            })}

            {visibleNavCount < navLinks.length && (() => {
              const overflowLinks = navLinks.slice(visibleNavCount);
              const hasActiveOverflow = overflowLinks.some((item) => isNavItemActive(item));
              return (
                <div className="relative shrink-0" ref={moreDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setMoreMenuOpen((prev) => !prev)}
                    aria-expanded={moreMenuOpen}
                    aria-haspopup="menu"
                    className={`flex items-center gap-1 py-2 px-1.5 text-[12.5px] xl:text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer rounded-md ${
                      hasActiveOverflow
                        ? 'text-[#FF671F] font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <span>{lang === 'hi' ? 'और' : 'More'}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {moreMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-10 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5 z-50"
                    >
                      {overflowLinks.map((item) => {
                        const isActive = isNavItemActive(item);
                        return (
                          <a
                            key={`more-${item.route}-${item.param || 'base'}`}
                            role="menuitem"
                            href={buildUrlForRoute(item.route, item.param)}
                            onClick={(e) => handleLinkClick(e, item.route, item.param)}
                            className={`block px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                              isActive
                                ? 'bg-orange-50 dark:bg-orange-950/30 text-[#FF671F] font-semibold'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            {lang === 'hi' ? item.labelHi : item.label}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </nav>

        {/* Right-Aligned Action Controls (Desktop, Tablet & Mobile) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto lg:ml-0">
          <div className="hidden md:flex items-center gap-1.5 xl:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                trackInteraction('ui', 'tools_tray_open', 'header', currentRoute);
                setTrayOpen(true);
              }}
              title="Open Digital Tools Tray (150+ PDF, CSC, QR, Tax & AI Utilities)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-orange-200 dark:border-orange-900/60 bg-orange-50/80 dark:bg-orange-950/40 hover:border-[#FF671F] text-xs font-bold text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5 text-[#FF671F] shrink-0" />
              <span className="hidden lg:inline">{lang === 'hi' ? 'टूल्स ट्रे' : 'Tools Tray'}</span>
            </button>

            <ToolNotificationBell onNavigate={onNavigate} />

            {user ? (
              <div className="relative" ref={userDropdownRef}>
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[#FF671F] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-semibold text-slate-900 dark:text-white max-w-[110px] truncate hidden 2xl:inline">
                    {user.name}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-[#FF671F] hidden sm:inline">
                    {normalizedRole.replace('_', ' ')}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 top-11 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-2 z-50 text-xs">
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{user.name}</div>
                      <div className="text-slate-500 truncate text-[11px]">{user.email}</div>
                      <div className="text-[10px] font-semibold text-[#FF671F] mt-0.5 capitalize">
                        {normalizedRole.replace('_', ' ')} Account
                      </div>
                    </div>

                    <div className="py-1">
                      {roleMenuItems.map((item) => {
                        const Icon = DROPDOWN_ICON_MAP[item.iconKey] || FileCheck2;
                        return (
                          <button
                            key={`${item.route}-${item.param || 'main'}`}
                            type="button"
                            onClick={() => handleNav(item.route, item.param)}
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <Icon className={`w-4 h-4 shrink-0 ${item.color || 'text-slate-500'}`} />
                              <span className="truncate">{item.label}</span>
                            </span>
                            {item.badge && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={async () => {
                          await logout();
                          handleNav('home');
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 flex items-center gap-2.5 font-medium cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 shrink-0" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <a
                href={buildUrlForRoute('register')}
                onClick={(e) => handleLinkClick(e, 'register')}
                className={`hidden lg:flex px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer items-center gap-1 ${
                  currentRoute === 'register'
                    ? 'border-[#FF671F] text-[#FF671F] bg-orange-50 dark:bg-orange-950/20'
                    : 'border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" />
                <span>{t('nav.register')}</span>
              </a>
            )}

            <a
              href={buildUrlForRoute(headerCtaTarget.route, headerCtaTarget.param)}
              onClick={(e) => handleLinkClick(e, headerCtaTarget.route, headerCtaTarget.param)}
              className="flex items-center gap-1 bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{headerCtaTarget.label}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </a>
          </div>

          {/* Compact Mobile & Small-Tablet Theme Control */}
          <button
            type="button"
            onClick={() => {
              toggleTheme();
              trackInteraction('ui', 'theme_toggle', theme === 'dark' ? 'light' : 'dark', currentRoute);
            }}
            className="lg:hidden w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 hover:border-[#FF671F] active:scale-95 transition cursor-pointer shrink-0"
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};

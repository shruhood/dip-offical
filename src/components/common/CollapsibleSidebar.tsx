import React, { useState, useEffect } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Calculator,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Compass,
  CreditCard,
  Database,
  DollarSign,
  Download,
  FileCheck2,
  FlaskConical,
  FolderOpen,
  Gauge,
  Handshake,
  Headphones,
  HelpCircle,
  History,
  Home,
  Info,
  Layers,
  LayoutGrid,
  LogIn,
  LogOut,
  Moon,
  Package,
  PackageCheck,
  PlusCircle,
  Phone,
  Save,
  SearchCheck,
  Server,
  Shield,
  Sliders,
  Sparkles,
  Sun,
  UserCheck,
  UserPlus,
  Wrench,
  Crown,
  X,
  FileText,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useToolTray } from '../../context/ToolTrayContext';
import {
  ControlledNavItem,
  DynamicNavigationState,
  resolveDynamicNavigation,
} from '../../lib/navigationController';
import { buildUrlForRoute } from '../../lib/siteUrls';
import { trackInteraction } from '../../lib/perfMonitor';
import { Logo } from './Logo';

const SIDEBAR_ICON_MAP: Record<
  ControlledNavItem['iconKey'],
  React.ComponentType<{ className?: string }>
> = {
  home: Home,
  services: LayoutGrid,
  products: Package,
  packages: PackageCheck,
  track: SearchCheck,
  blog: BookOpen,
  login: LogIn,
  register: UserPlus,
  become_partner: Handshake,
  kyc: UserCheck,
  b2b: Building2,
  partners: Handshake,
  payments: DollarSign,
  shield: Shield,
  sliders: Sliders,
  server: Server,
  layers: Layers,
  gauge: Gauge,
  cloud: Cloud,
  activity: Activity,
  workspace: Database,
  headphones: Headphones,
  sandbox_test: FlaskConical,
  camera: Camera,
  file_check: FileCheck2,
  file_text: FileText,
  receipt: Receipt,
  folder: FolderOpen,
  bell: Bell,
  award: Award,
  calculator: Calculator,
  save: Save,
  download: Download,
  history: History,
  briefcase: Briefcase,
  tools: Wrench,
  sparkles: Sparkles,
  crown: Crown,
  compass: Compass,
  help: HelpCircle,
  info: Info,
  phone: Phone,
};

interface CollapsibleSidebarProps {
  currentRoute: string;
  currentParam?: string;
  navState?: DynamicNavigationState;
  mobileNavState?: DynamicNavigationState;
  onNavigate: (route: string, param?: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  currentRoute,
  currentParam = '',
  navState: controlledNavState,
  mobileNavState: controlledMobileNavState,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user, role, permissions, isAuthenticated, logout } = useAuth();
  const { lang, setLang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { plan } = useToolTray();

  const desktopNav =
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
      isMobileDrawer: false,
    });
  const normalizedRole = desktopNav.effectiveRole;
  const isStaffRole = desktopNav.isStaffRole;

  const [portalGroupOpen, setPortalGroupOpen] = useState(true);
  const [oversightGroupOpen, setOversightGroupOpen] = useState(false);
  const [toolsGroupOpen, setToolsGroupOpen] = useState(!isStaffRole || normalizedRole === 'operator');
  const [exploreGroupOpen, setExploreGroupOpen] = useState(!isStaffRole);
  const [supportGroupOpen, setSupportGroupOpen] = useState(false);

  // Keep consumer storefront collapsed by default whenever signing into a staff portal
  useEffect(() => {
    setExploreGroupOpen(!isStaffRole);
    setToolsGroupOpen(!isStaffRole || normalizedRole === 'operator');
  }, [isStaffRole, normalizedRole]);

  const primaryPortalRoute = desktopNav.primaryPortalRoute;

  const isItemActive = (item: ControlledNavItem) => {
    if (item.param) {
      return (
        currentRoute === item.route &&
        (currentParam === item.param ||
          (!currentParam &&
            (item.param === 'overview' || item.param === 'queue' || item.param === 'sla')))
      );
    }
    if (item.route === 'services') {
      return currentRoute === 'services' || currentRoute === 'service-detail';
    }
    if (item.route === 'tools') {
      return (currentRoute === 'tools' && !currentParam) || currentRoute === 'tool-detail';
    }
    if (item.route === 'blog') {
      return currentRoute === 'blog' || currentRoute === 'blog-detail';
    }
    return currentRoute === item.route;
  };

  const handleItemClick = (e: React.MouseEvent, item: ControlledNavItem) => {
    e.preventDefault();
    trackInteraction('sidebar', 'nav_click', item.param ? `${item.route}/${item.param}` : item.route, currentRoute);
    onNavigate(item.route, item.param || '');
    onCloseMobile();
  };

  const renderNavRow = (item: ControlledNavItem, isCompactRail: boolean) => {
    const Icon = SIDEBAR_ICON_MAP[item.iconKey] || Compass;
    const active = isItemActive(item);
    const label = lang === 'hi' && item.labelHi ? item.labelHi : item.label;

    return (
      <a
        key={item.id}
        href={buildUrlForRoute(item.route, item.param)}
        onClick={(e) => handleItemClick(e, item)}
        title={isCompactRail ? label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`group flex items-center ${
          isCompactRail ? 'justify-center px-2 py-2' : 'justify-between gap-2 px-2.5 py-1.5'
        } rounded-lg text-xs font-medium transition-colors cursor-pointer ${
          active
            ? 'bg-[#FFF5EE] dark:bg-orange-950/40 text-[#FF671F] font-bold border border-[#FF671F]/25'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-950 dark:hover:text-white border border-transparent'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon
            className={`w-4 h-4 shrink-0 transition-colors ${
              active
                ? 'text-[#FF671F]'
                : 'text-slate-500 dark:text-slate-400 group-hover:text-[#FF671F]'
            }`}
          />
          {!isCompactRail && <span className="truncate">{label}</span>}
        </div>
        {!isCompactRail && item.badge && (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
            {item.badge}
          </span>
        )}
      </a>
    );
  };

  const renderSidebarBody = (isMobileDrawer: boolean) => {
    const isRail = !isMobileDrawer && collapsed;
    const controlled = isMobileDrawer
      ? controlledMobileNavState ||
        resolveDynamicNavigation({
          user,
          role,
          permissions,
          isAuthenticated,
          currentRoute,
          currentParam,
          lang,
          plan,
          isMobileDrawer: true,
        })
      : desktopNav;

    const mobilePrimaryItems = controlled.sidebar.mobilePrimaryItems;
    const roleWorkspaceItems = controlled.sidebar.roleWorkspaceItems;
    const oversightItems = controlled.sidebar.oversightItems;
    const toolTrayItems = controlled.sidebar.toolItems;
    const exploreItems = controlled.sidebar.exploreItems;
    const supportItems = controlled.sidebar.supportItems;
    const roleGroupHeading =
      lang === 'hi' ? controlled.sidebar.roleGroupTitleHi : controlled.sidebar.roleGroupTitle;

    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-950 select-none">
        {/* Sidebar Top Strip */}
        <div
          className={`flex items-center ${
            isRail ? 'justify-center px-2' : 'justify-between px-3'
          } py-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0`}
        >
          {isMobileDrawer ? (
            <a
              href={buildUrlForRoute('home')}
              onClick={(e) => {
                e.preventDefault();
                onNavigate('home');
                onCloseMobile();
              }}
              className="min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF671F] rounded-lg"
            >
              <Logo size="sm" showSubtitle={false} />
            </a>
          ) : (
            !isRail && (
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#FF671F]">
                  {user
                    ? `${normalizedRole.replace('_', ' ')} Workspace`
                    : lang === 'hi'
                    ? 'मेनू नेविगेशन'
                    : 'Platform Menu'}
                </div>
                {user && (
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {user.name}
                  </div>
                )}
              </div>
            )
          )}

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close sidebar menu"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar menu' : 'Collapse sidebar menu'}
              title={collapsed ? 'Expand Menu' : 'Collapse Menu'}
              className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-[#FF671F] text-slate-600 dark:text-slate-300 flex items-center justify-center transition cursor-pointer shrink-0"
            >
              {collapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {isMobileDrawer && user && (
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#FF671F]">
              {normalizedRole.replace('_', ' ')} Workspace
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {user.name}
            </div>
          </div>
        )}

        {/* Scrollable Role-Standardized Menu Groups */}
        <div className="flex-1 overflow-y-auto scrollbar-none px-2 py-2.5 space-y-3">
          {/* Mobile Only: Top Bar Primary Views (since Header nav is hidden on mobile) */}
          {isMobileDrawer && mobilePrimaryItems.length > 0 && (
            <>
              <div className="space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FF671F]">
                  {lang === 'hi' ? 'मुख्य दृश्य' : 'Primary Navigation'}
                </div>
                <div className="space-y-0.5">
                  {mobilePrimaryItems.map((item) => renderNavRow(item, false))}
                </div>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800/80" />
            </>
          )}

          {/* Group 1: Role-First Operations & Account Modules */}
          {roleWorkspaceItems.length > 0 && (
            <div className="space-y-1">
              {!isRail && (
                <button
                  type="button"
                  onClick={() => setPortalGroupOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  <span>{roleGroupHeading}</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${portalGroupOpen ? '' : '-rotate-90'}`}
                  />
                </button>
              )}
              {(isRail || portalGroupOpen) && (
                <div className="space-y-0.5">
                  {roleWorkspaceItems.map((item) => renderNavRow(item, isRail))}
                </div>
              )}
            </div>
          )}

          {/* Admin Only: Cross-Portal Oversight */}
          {oversightItems.length > 0 && (
            <>
              <div className="border-t border-slate-100 dark:border-slate-800/80" />
              <div className="space-y-1">
                {!isRail && (
                  <button
                    type="button"
                    onClick={() => setOversightGroupOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>{lang === 'hi' ? 'पोर्टल निगरानी' : 'Cross-Portal Desks'}</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${oversightGroupOpen ? '' : '-rotate-90'}`}
                    />
                  </button>
                )}
                {(isRail || oversightGroupOpen) && (
                  <div className="space-y-0.5">
                    {oversightItems.map((item) => renderNavRow(item, isRail))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Digital Tools & Plans (only distinct links, no duplicate Quick Tray CTA) */}
          {toolTrayItems.length > 0 && (
            <>
              <div className="border-t border-slate-100 dark:border-slate-800/80" />
              <div className="space-y-1">
                {!isRail && (
                  <button
                    type="button"
                    onClick={() => setToolsGroupOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FF671F] hover:text-[#E55B1B] cursor-pointer"
                  >
                    <span>{lang === 'hi' ? 'डिजिटल टूल्स' : 'Digital Tools & Plans'}</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${toolsGroupOpen ? '' : '-rotate-90'}`}
                    />
                  </button>
                )}
                {(isRail || toolsGroupOpen) && (
                  <div className="space-y-0.5">
                    {toolTrayItems.map((item) => renderNavRow(item, isRail))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Public Storefront Links (deduplicated against header & role menu; collapsed by default for staff) */}
          {exploreItems.length > 0 && (
            <>
              <div className="border-t border-slate-100 dark:border-slate-800/80" />
              <div className="space-y-1">
                {!isRail && (
                  <button
                    type="button"
                    onClick={() => setExploreGroupOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>{lang === 'hi' ? 'कैटलॉग और स्टोर' : 'Catalogue & Storefront'}</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${exploreGroupOpen ? '' : '-rotate-90'}`}
                    />
                  </button>
                )}
                {(isRail || exploreGroupOpen) && (
                  <div className="space-y-0.5">
                    {exploreItems.map((item) => renderNavRow(item, isRail))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Info & Support */}
          {supportItems.length > 0 && (
            <>
              <div className="border-t border-slate-100 dark:border-slate-800/80" />
              <div className="space-y-1">
                {!isRail ? (
                  <button
                    type="button"
                    onClick={() => setSupportGroupOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>{lang === 'hi' ? 'सहायता व जानकारी' : 'Support & Info'}</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${supportGroupOpen ? '' : '-rotate-90'}`}
                    />
                  </button>
                ) : null}
                {(isRail || supportGroupOpen) && (
                  <div className="space-y-0.5">
                    {supportItems.map((item) => renderNavRow(item, isRail))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sidebar Footer: Compact Controls */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-2 space-y-1.5 shrink-0 bg-slate-50/70 dark:bg-slate-900/50">
          {isRail ? (
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={toggleTheme}
                title="Toggle theme"
                className="w-9 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-[#FF671F] cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
              {user ? (
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    onNavigate('home');
                  }}
                  title="Sign Out"
                  className="w-9 h-8 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center justify-center hover:bg-red-100 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate(primaryPortalRoute)}
                  title="Sign In"
                  className="w-9 h-8 rounded-lg bg-[#FF671F] text-white flex items-center justify-center cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 hover:border-[#FF671F] cursor-pointer"
                >
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-[#FF671F] cursor-pointer"
                >
                  {lang === 'en' ? 'हिंदी' : 'EN'}
                </button>
              </div>

              {user ? (
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    onCloseMobile();
                    onNavigate('home');
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-600 dark:text-red-400 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{lang === 'hi' ? 'साइन आउट' : 'Sign Out'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile();
                    onNavigate('services');
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#FF671F] hover:bg-[#E55B1B] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{lang === 'hi' ? 'आवेदन शुरू करें' : 'Start Application'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop / Large-Tablet Collapsible Sticky Sidebar Rail */}
      <aside
        aria-label="Collapsible Navigation Sidebar"
        style={{
          top: 'var(--dip-header-h, 93px)',
          height: 'calc(100vh - var(--dip-header-h, 93px))',
        }}
        className={`hidden lg:block shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 transition-[width] duration-200 ease-out sticky z-30 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile & Tablet Slide-Over Collapsible Drawer */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Sidebar Drawer"
        >
          <div
            className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-68 max-w-[82vw] h-full border-r border-slate-200 dark:border-slate-800 shadow-2xl">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};

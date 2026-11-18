import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { DataProvider, useData, ApplicationDraft } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToolTrayProvider, useToolTray } from './context/ToolTrayContext';
import { Header } from './components/common/Header';
import { CollapsibleSidebar } from './components/common/CollapsibleSidebar';
import { Footer } from './components/common/Footer';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { PullToRefresh } from './components/common/PullToRefresh';
import { Offline } from './components/common/Offline';
import { recordVisitedRoute } from './hooks/useNetworkStatus';
import {
  captureInitialNavigationTiming,
  recordRouteLoad,
  trackInteraction,
} from './lib/perfMonitor';
import { HomePage } from './pages/HomePage';
import { Service, Application } from './types';

const AssistantModal = React.lazy(() =>
  import('./components/ai/AssistantModal').then((m) => ({ default: m.AssistantModal }))
);
const DigitalToolsTray = React.lazy(() =>
  import('./components/tools/DigitalToolsTray').then((m) => ({ default: m.DigitalToolsTray }))
);
const ApplicationWizard = React.lazy(() =>
  import('./components/application/ApplicationWizard').then((m) => ({
    default: m.ApplicationWizard,
  }))
);
const ServicesPage = React.lazy(() =>
  import('./pages/ServicesPage').then((m) => ({ default: m.ServicesPage }))
);
const ServiceDetailPage = React.lazy(() =>
  import('./pages/ServiceDetailPage').then((m) => ({ default: m.ServiceDetailPage }))
);
const InstantVerificationPage = React.lazy(() =>
  import('./pages/InstantVerificationPage').then((m) => ({ default: m.InstantVerificationPage }))
);
const TrackPage = React.lazy(() =>
  import('./pages/TrackPage').then((m) => ({ default: m.TrackPage }))
);
const AboutPage = React.lazy(() =>
  import('./pages/AboutPage').then((m) => ({ default: m.AboutPage }))
);
const ContactPage = React.lazy(() =>
  import('./pages/ContactPage').then((m) => ({ default: m.ContactPage }))
);
const HelpFaqPage = React.lazy(() =>
  import('./pages/HelpFaqPage').then((m) => ({ default: m.HelpFaqPage }))
);
const LegalPage = React.lazy(() =>
  import('./pages/LegalPage').then((m) => ({ default: m.LegalPage }))
);
const LocationPage = React.lazy(() =>
  import('./pages/LocationPage').then((m) => ({ default: m.LocationPage }))
);
const IndiaDirectoryPage = React.lazy(() =>
  import('./pages/IndiaDirectoryPage').then((m) => ({ default: m.IndiaDirectoryPage }))
);
const PublicInfoPage = React.lazy(() =>
  import('./pages/PublicInfoPages').then((m) => ({ default: m.PublicInfoPage }))
);
const BlogPage = React.lazy(() =>
  import('./pages/BlogPage').then((m) => ({ default: m.BlogPage }))
);
const LoginPage = React.lazy(() =>
  import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const SignupPage = React.lazy(() =>
  import('./pages/auth/SignupPage').then((m) => ({ default: m.SignupPage }))
);
const ForgotPasswordPage = React.lazy(() =>
  import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const AuthActionPage = React.lazy(() =>
  import('./pages/auth/AuthActionPage').then((m) => ({ default: m.AuthActionPage }))
);
const CustomerDashboard = React.lazy(() =>
  import('./pages/dashboard/CustomerDashboard').then((m) => ({ default: m.CustomerDashboard }))
);
const OperatorDashboard = React.lazy(() =>
  import('./pages/operator/OperatorDashboard').then((m) => ({ default: m.OperatorDashboard }))
);
const OperatorEnrollmentPage = React.lazy(() =>
  import('./pages/operator/OperatorEnrollmentPage').then((m) => ({
    default: m.OperatorEnrollmentPage,
  }))
);
const ManagerDashboard = React.lazy(() =>
  import('./pages/manager/ManagerDashboard').then((m) => ({ default: m.ManagerDashboard }))
);
const PartnerDashboard = React.lazy(() =>
  import('./pages/partner/PartnerDashboard').then((m) => ({ default: m.PartnerDashboard }))
);
const BecomePartnerPage = React.lazy(() =>
  import('./pages/partner/BecomePartnerPage').then((m) => ({ default: m.BecomePartnerPage }))
);
const AdminDashboard = React.lazy(() =>
  import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const B2BPortal = React.lazy(() =>
  import('./pages/b2b/B2BPortal').then((m) => ({ default: m.B2BPortal }))
);
const WorkspaceHub = React.lazy(() =>
  import('./pages/workspace/WorkspaceHub').then((m) => ({ default: m.WorkspaceHub }))
);
const ToolsCatalogPage = React.lazy(() =>
  import('./pages/tools/ToolsCatalogPage').then((m) => ({ default: m.ToolsCatalogPage }))
);
const ToolWorkspacePage = React.lazy(() =>
  import('./pages/tools/ToolWorkspacePage').then((m) => ({ default: m.ToolWorkspacePage }))
);
const ToolPlansPage = React.lazy(() =>
  import('./pages/tools/ToolPlansPage').then((m) => ({ default: m.ToolPlansPage }))
);
import { getHomeRouteForRole } from './lib/rbac';
import {
  isRouteAccessible,
  resolveDynamicNavigation,
} from './lib/navigationController';
import {
  buildUrlForRoute,
  parseLocationPath,
} from './lib/siteUrls';
import { applyRouteSeoMetadata } from './lib/seoHead';
import {
  checkCashfreePaymentStatus,
  verifyCashfreePaymentOrder,
  type CashfreeOrderStatusResponse,
} from './services/backendApi';
import { CheckCircle2, Clock, XCircle, RefreshCw, X } from 'lucide-react';

function parseLocation(): { route: string; param: string } {
  return parseLocationPath(window.location.pathname, window.location.search);
}

function MainApp() {
  const { user, role, permissions, isAuthenticated } = useAuth();
  const { lang } = useLanguage();
  const { plan } = useToolTray();
  const { services, blogPosts, syncApplicationPaymentStatus } = useData();

  const initial = parseLocation();
  const [currentRoute, setCurrentRoute] = useState<string>(initial.route);
  const [routeParam, setRouteParam] = useState<string>(initial.param);
  const [applyingService, setApplyingService] = useState<Service | null>(null);
  const [resumingDraft, setResumingDraft] = useState<ApplicationDraft | null>(null);
  const [assistedMeta, setAssistedMeta] = useState<{ partnerId?: string; applicantName?: string } | null>(null);
  const [viewRefreshKey, setViewRefreshKey] = useState<number>(0);
  const [redirectVerifyState, setRedirectVerifyState] = useState<{
    orderId: string;
    loading: boolean;
    result: CashfreeOrderStatusResponse | null;
    error: string | null;
  } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('dip_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const topHeaderRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(56);

  const runRedirectOrderVerify = useCallback(
    async (orderId: string) => {
      setRedirectVerifyState({ orderId, loading: true, result: null, error: null });
      const verifyRes = await verifyCashfreePaymentOrder(orderId);
      const statusRes =
        verifyRes.ok && verifyRes.data ? null : await checkCashfreePaymentStatus(orderId);
      const effectiveData = verifyRes.ok && verifyRes.data ? verifyRes.data : statusRes?.data || null;
      const effectiveOk = Boolean((verifyRes.ok && verifyRes.data) || (statusRes?.ok && statusRes.data));
      const effectiveMessage =
        statusRes?.message || verifyRes.message || 'Unable to verify payment status automatically.';

      if (!effectiveOk || !effectiveData) {
        setRedirectVerifyState({
          orderId,
          loading: false,
          result: null,
          error: effectiveMessage,
        });
        return;
      }
      setRedirectVerifyState({
        orderId,
        loading: false,
        result: effectiveData,
        error: null,
      });
      if (effectiveData.applicationId) {
        const uiStatus = effectiveData.paid
          ? 'Paid'
          : ['FAILED', 'EXPIRED', 'DROPPED'].includes(effectiveData.orderStatus)
          ? 'Failed'
          : 'Pending';
        void syncApplicationPaymentStatus(effectiveData.applicationId, {
          uiStatus,
          orderId: effectiveData.orderId,
          cfPaymentId: effectiveData.cfPaymentId,
          paymentMethod: effectiveData.paymentMethod,
          paidAt: effectiveData.paymentTime,
        });
      }
    },
    [syncApplicationPaymentStatus]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cfOrderId = (params.get('cf_order_id') || params.get('order_id') || '').trim();
    if (!cfOrderId || cfOrderId === '{order_id}') return;
    params.delete('cf_order_id');
    params.delete('order_id');
    const nextSearch = params.toString();
    const cleanedUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', cleanedUrl);
    void runRedirectOrderVerify(cfOrderId);
  }, [runRedirectOrderVerify]);

  useLayoutEffect(() => {
    const el = topHeaderRef.current;
    if (!el) return;
    const updateHeight = () => {
      const next = Math.round(el.getBoundingClientRect().height);
      if (next > 0) {
        setHeaderHeight(next);
        document.documentElement.style.setProperty('--dip-header-h', `${next}px`);
      }
    };
    updateHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateHeight);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('dip_sidebar_collapsed', String(next));
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  }, []);

  useEffect(() => {
    captureInitialNavigationTiming(initial.route, initial.param);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const start = window.performance.now();
      const next = parseLocation();
      setCurrentRoute(next.route);
      setRouteParam(next.param);
      window.requestAnimationFrame(() => recordRouteLoad(next.route, next.param, start));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentRoute, routeParam]);

  useEffect(() => {
    applyRouteSeoMetadata({
      route: currentRoute,
      param: routeParam,
      services,
      blogPosts,
    });
    recordVisitedRoute(currentRoute, routeParam);
  }, [currentRoute, routeParam, services, blogPosts]);

  const handleNavigate = useCallback((route: string, param: string = '') => {
    const start = window.performance.now();
    const normalizedRoute = route === 'signup' ? 'register' : route === 'help' ? 'faq' : route;
    setCurrentRoute(normalizedRoute);
    setRouteParam(param);
    trackInteraction('navigation', 'route_change', param ? `${normalizedRoute}/${param}` : normalizedRoute, normalizedRoute);

    const targetUrl = buildUrlForRoute(normalizedRoute, param);
    if (window.location.pathname + window.location.search !== targetUrl) {
      window.history.pushState({ route: normalizedRoute, param }, '', targetUrl);
    }
    window.requestAnimationFrame(() => recordRouteLoad(normalizedRoute, param, start));
  }, []);

  const handleReloadFromTop = useCallback(async () => {
    const start = window.performance.now();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setViewRefreshKey((k) => k + 1);
    window.requestAnimationFrame(() => recordRouteLoad(currentRoute, routeParam, start));
  }, [currentRoute, routeParam]);

  const handleStartApply = (
    service?: Service,
    draft?: ApplicationDraft,
    meta?: { partnerId?: string; applicantName?: string }
  ) => {
    setResumingDraft(draft || null);
    setAssistedMeta(meta || null);
    setApplyingService(service || services[0]);
  };

  const handleWizardSuccess = (_app: Application) => {
    setApplyingService(null);
    setResumingDraft(null);
    setAssistedMeta(null);
    if (user?.role === 'partner') {
      handleNavigate('partner');
    } else if (user) {
      handleNavigate(getHomeRouteForRole(user.role, user.accountType, user.kycStatus), 'applications');
    } else {
      handleNavigate('track');
    }
  };

  // Centralized Dynamic Navigation Controller filtered strictly by user.role and user.kycStatus
  const dynamicNavState = useMemo(
    () =>
      resolveDynamicNavigation({
        user,
        role,
        permissions,
        isAuthenticated,
        currentRoute,
        currentParam: routeParam,
        lang,
        plan,
        isMobileDrawer: false,
      }),
    [user, role, permissions, isAuthenticated, currentRoute, routeParam, lang, plan]
  );

  const mobileNavState = useMemo(
    () =>
      resolveDynamicNavigation({
        user,
        role,
        permissions,
        isAuthenticated,
        currentRoute,
        currentParam: routeParam,
        lang,
        plan,
        isMobileDrawer: true,
      }),
    [user, role, permissions, isAuthenticated, currentRoute, routeParam, lang, plan]
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-orange-50/40 via-sky-50/35 to-emerald-50/40 dark:from-[#0B1120] dark:via-[#0E172A] dark:to-[#091521] text-[#202124] dark:text-slate-100">
      {/* Always-visible Fixed Top Header */}
      <div ref={topHeaderRef} className="fixed top-0 left-0 right-0 z-40">
        <Header
          navState={dynamicNavState}
          onNavigate={handleNavigate}
          currentRoute={currentRoute}
          currentParam={routeParam}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          mobileSidebarOpen={mobileSidebarOpen}
          onToggleMobileSidebar={() => setMobileSidebarOpen((v) => !v)}
        />
      </div>

      {/* Exact height spacer so scrollable views start cleanly below fixed header */}
      <div style={{ height: headerHeight }} aria-hidden="true" className="shrink-0" />

      <Offline
        currentRoute={currentRoute}
        currentParam={routeParam}
        onNavigate={handleNavigate}
      />

      <div className="flex flex-1 min-w-0">
        <CollapsibleSidebar
          navState={dynamicNavState}
          mobileNavState={mobileNavState}
          currentRoute={currentRoute}
          currentParam={routeParam}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <div className="flex-1 min-w-0 flex flex-col pb-16 lg:pb-0">
          <PullToRefresh onRefresh={handleReloadFromTop}>
            <main key={viewRefreshKey} className="flex-1 animate-fadeIn">
              <React.Suspense
                fallback={
                  <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center gap-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#FF671F]" />
                    <span>Loading page...</span>
                  </div>
                }
              >
        {currentRoute === 'home' && (
          <HomePage
            onNavigate={handleNavigate}
            onApplyForService={(s) => handleStartApply(s)}
          />
        )}

        {currentRoute === 'services' && (
          <ServicesPage
            initialCategory={routeParam || 'all'}
            onNavigate={handleNavigate}
            onApplyForService={(s) => handleStartApply(s)}
          />
        )}

        {currentRoute === 'products' && (
          <ServicesPage
            initialCategory="digital-products"
            onNavigate={handleNavigate}
            onApplyForService={(s) => handleStartApply(s)}
          />
        )}

        {currentRoute === 'packages' && (
          <ServicesPage
            initialCategory="packages"
            onNavigate={handleNavigate}
            onApplyForService={(s) => handleStartApply(s)}
          />
        )}

        {currentRoute === 'tools' && (
          <ToolsCatalogPage
            initialCategory={routeParam}
            onNavigate={handleNavigate}
          />
        )}

        {currentRoute === 'tool-detail' && (
          <ToolWorkspacePage
            slug={routeParam}
            onNavigate={handleNavigate}
          />
        )}

        {currentRoute === 'tool-plans' && (
          <ToolPlansPage onNavigate={handleNavigate} />
        )}

        {currentRoute === 'service-detail' && (
          <ServiceDetailPage
            slug={routeParam}
            onNavigate={handleNavigate}
            onApplyForService={(s) => handleStartApply(s)}
          />
        )}

        {currentRoute === 'verifications' && (
          <InstantVerificationPage
            initialSlug={routeParam}
            onNavigate={handleNavigate}
          />
        )}

        {currentRoute === 'location' && (
          <LocationPage
            citySlug={routeParam || 'silvassa'}
            onNavigate={handleNavigate}
            onApplyForService={(s) => handleStartApply(s)}
          />
        )}

        {currentRoute === 'india-directory' && (
          <IndiaDirectoryPage
            directoryPath={routeParam || '/india'}
            onNavigate={handleNavigate}
            onApplyForService={(s) => handleStartApply(s)}
          />
        )}

        {currentRoute === 'how-it-works' && (
          <PublicInfoPage
            mode="how-it-works"
            onNavigate={handleNavigate}
            onApplyForService={(s) => handleStartApply(s)}
          />
        )}

        {currentRoute === 'pricing' && (
          <PublicInfoPage
            mode="pricing"
            onNavigate={handleNavigate}
            onApplyForService={(s) => handleStartApply(s)}
          />
        )}

        {currentRoute === 'blog' && (
          <BlogPage
            mode="index"
            slugOrCategory={routeParam}
            onNavigate={handleNavigate}
            onApplyForService={(s) => handleStartApply(s)}
          />
        )}

        {currentRoute === 'blog-detail' && (
          <BlogPage
            mode="detail"
            slugOrCategory={routeParam}
            onNavigate={handleNavigate}
            onApplyForService={(s) => handleStartApply(s)}
          />
        )}

        {currentRoute === 'track' && <TrackPage onNavigate={handleNavigate} />}

        {currentRoute === 'about' && <AboutPage onNavigate={handleNavigate} />}

        {currentRoute === 'contact' && <ContactPage />}

        {currentRoute === 'faq' && <HelpFaqPage onNavigate={handleNavigate} />}

        {currentRoute === 'legal' && (
          <LegalPage initialSection={routeParam || 'disclaimer'} onNavigate={handleNavigate} />
        )}

        {currentRoute === 'login' && <LoginPage onNavigate={handleNavigate} />}

        {currentRoute === 'register' && (
          <SignupPage onNavigate={handleNavigate} initialType={routeParam} />
        )}

        {currentRoute === 'forgot-password' && <ForgotPasswordPage onNavigate={handleNavigate} />}

        {currentRoute === 'auth-action' && <AuthActionPage onNavigate={handleNavigate} />}

        {currentRoute === 'dashboard' &&
          (user ? (
            <CustomerDashboard
              initialTab={routeParam || 'overview'}
              onNavigate={handleNavigate}
              onStartNewApplication={() => handleStartApply()}
              onResumeDraft={(draft) => {
                const srv = services.find((s) => s.slug === draft.serviceSlug) || services[0];
                handleStartApply(srv, draft);
              }}
            />
          ) : (
            <LoginPage onNavigate={handleNavigate} />
          ))}

        {currentRoute === 'operator-enroll' &&
          (user && dynamicNavState.canSeePartnerKyc ? (
            <OperatorEnrollmentPage onNavigate={handleNavigate} />
          ) : (
            <BecomePartnerPage initialTrack="operator" onNavigate={handleNavigate} />
          ))}

        {currentRoute === 'operator' &&
          (user ? (
            isRouteAccessible('operator', dynamicNavState, Boolean(user)) ? (
              <OperatorDashboard initialTab={routeParam || 'queue'} onNavigate={handleNavigate} />
            ) : dynamicNavState.canSeePartnerKyc ? (
              <OperatorEnrollmentPage onNavigate={handleNavigate} />
            ) : (
              <BecomePartnerPage initialTrack="operator" onNavigate={handleNavigate} />
            )
          ) : (
            <LoginPage onNavigate={handleNavigate} />
          ))}

        {currentRoute === 'manager' &&
          (user ? (
            isRouteAccessible('manager', dynamicNavState, Boolean(user)) ? (
              <ManagerDashboard initialTab={routeParam || 'sla'} onNavigate={handleNavigate} />
            ) : (
              <CustomerDashboard
                initialTab="overview"
                onNavigate={handleNavigate}
                onStartNewApplication={() => handleStartApply()}
                onResumeDraft={(draft) => {
                  const srv = services.find((s) => s.slug === draft.serviceSlug) || services[0];
                  handleStartApply(srv, draft);
                }}
              />
            )
          ) : (
            <LoginPage onNavigate={handleNavigate} />
          ))}

        {currentRoute === 'partner' &&
          (user && isRouteAccessible('partner', dynamicNavState, Boolean(user)) ? (
            <PartnerDashboard
              initialTab={routeParam || 'overview'}
              onNavigate={handleNavigate}
              onStartAssistedApplication={(srv, meta) => handleStartApply(srv, undefined, meta)}
            />
          ) : (
            <BecomePartnerPage initialTrack="distributor" onNavigate={handleNavigate} />
          ))}

        {currentRoute === 'become-partner' && (
          <BecomePartnerPage
            initialTrack={routeParam}
            onNavigate={handleNavigate}
          />
        )}

        {currentRoute === 'admin' &&
          (user ? (
            isRouteAccessible('admin', dynamicNavState, Boolean(user)) ? (
              <AdminDashboard initialTab={routeParam || 'overview'} onNavigate={handleNavigate} />
            ) : (
              <CustomerDashboard
                initialTab="overview"
                onNavigate={handleNavigate}
                onStartNewApplication={() => handleStartApply()}
                onResumeDraft={(draft) => {
                  const srv = services.find((s) => s.slug === draft.serviceSlug) || services[0];
                  handleStartApply(srv, draft);
                }}
              />
            )
          ) : (
            <LoginPage onNavigate={handleNavigate} />
          ))}

        {currentRoute === 'b2b' &&
          (user ? (
            isRouteAccessible('b2b', dynamicNavState, Boolean(user)) ? (
              <B2BPortal initialTab={routeParam || 'overview'} onNavigate={handleNavigate} />
            ) : (
              <BecomePartnerPage initialTrack="b2b" onNavigate={handleNavigate} />
            )
          ) : (
            <LoginPage onNavigate={handleNavigate} />
          ))}

        {currentRoute === 'workspace' &&
          (user ? (
            <WorkspaceHub onNavigate={handleNavigate} />
          ) : (
            <LoginPage onNavigate={handleNavigate} />
          ))}
              </React.Suspense>
        </main>
          </PullToRefresh>

          <Footer onNavigate={handleNavigate} />
        </div>
      </div>

      <MobileBottomNav
        navState={dynamicNavState}
        currentRoute={currentRoute}
        onNavigate={handleNavigate}
        onScrollTopAndRefresh={handleReloadFromTop}
      />

      <React.Suspense fallback={null}>
        <AssistantModal onNavigateToService={(slug) => handleNavigate('service-detail', slug)} />
        <DigitalToolsTray onNavigate={handleNavigate} />
      </React.Suspense>

      {applyingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
          <div className="max-w-xl w-full my-auto">
            <React.Suspense
              fallback={
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center text-xs text-slate-500">
                  Loading application wizard...
                </div>
              }
            >
              <ApplicationWizard
                initialService={applyingService}
                initialDraft={resumingDraft || undefined}
                assistedPartnerId={assistedMeta?.partnerId}
                assistedApplicantName={assistedMeta?.applicantName}
                onSuccess={handleWizardSuccess}
                onCancel={() => {
                  setApplyingService(null);
                  setResumingDraft(null);
                  setAssistedMeta(null);
                }}
              />
            </React.Suspense>
          </div>
        </div>
      )}

      {redirectVerifyState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Cashfree Return Verification
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                  Order #{redirectVerifyState.orderId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRedirectVerifyState(null)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {redirectVerifyState.loading ? (
              <div className="py-6 flex flex-col items-center justify-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                <RefreshCw className="w-7 h-7 animate-spin text-[#FF671F]" />
                <span>Verifying final payment status with Cashfree gateway...</span>
              </div>
            ) : redirectVerifyState.result?.paid ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2.5 text-[#138808] dark:text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>Payment Confirmed &amp; Reconciled</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-1 font-mono text-[11px]">
                  {redirectVerifyState.result.amountInr && (
                    <div>Amount Paid: ₹{redirectVerifyState.result.amountInr.toLocaleString('en-IN')}</div>
                  )}
                  {redirectVerifyState.result.cfPaymentId && (
                    <div>Cashfree Payment ID: {redirectVerifyState.result.cfPaymentId}</div>
                  )}
                  {redirectVerifyState.result.bankReference && (
                    <div>Bank Ref / UTR: {redirectVerifyState.result.bankReference}</div>
                  )}
                  {redirectVerifyState.result.invoiceNumber && (
                    <div>Invoice: {redirectVerifyState.result.invoiceNumber}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRedirectVerifyState(null);
                      handleNavigate(
                        user ? getHomeRouteForRole(user.role, user.accountType, user.kycStatus) : 'track',
                        user ? 'payments' : ''
                      );
                    }}
                    className="flex-1 bg-[#138808] hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl cursor-pointer"
                  >
                    View Receipt &amp; Application
                  </button>
                </div>
              </div>
            ) : redirectVerifyState.error ||
              ['FAILED', 'EXPIRED', 'DROPPED'].includes(redirectVerifyState.result?.orderStatus || '') ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2.5 text-red-600 dark:text-rose-400 font-bold text-sm">
                  <XCircle className="w-5 h-5 shrink-0" />
                  <span>Payment Not Completed ({redirectVerifyState.result?.orderStatus || 'ERROR'})</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  {redirectVerifyState.error ||
                    redirectVerifyState.result?.paymentMessage ||
                    'Your payment attempt was cancelled, expired, or declined. No duplicate fee was captured.'}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setRedirectVerifyState(null);
                      handleNavigate(
                        user ? getHomeRouteForRole(user.role, user.accountType, user.kycStatus) : 'services',
                        user ? 'payments' : ''
                      );
                    }}
                    className="flex-1 bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold py-2.5 rounded-xl cursor-pointer"
                  >
                    Open Payments &amp; Retry
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 font-bold text-sm">
                  <Clock className="w-5 h-5 shrink-0" />
                  <span>Payment Awaiting Bank Confirmation</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  Cashfree status is currently {redirectVerifyState.result?.orderStatus || 'PENDING'}. Click re-check in a few seconds once your bank or UPI app confirms.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void runRedirectOrderVerify(redirectVerifyState.orderId)}
                    className="flex-1 bg-[#FF671F] hover:bg-[#E55B1B] text-white font-bold py-2.5 rounded-xl cursor-pointer"
                  >
                    Re-check Status Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ToolTrayProvider>
            <DataProvider>
              <MainApp />
            </DataProvider>
          </ToolTrayProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

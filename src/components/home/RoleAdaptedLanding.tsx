import React, { useMemo, useState } from 'react';
import { User, Service } from '../../types';
import { useData, ApplicationDraft } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToolTray } from '../../context/ToolTrayContext';
import {
  RoleLandingProfile,
  RoleToolkitAction,
} from '../../lib/roleLandingConfig';
import { canAccessApplication, getEffectiveUserRole } from '../../lib/rbac';
import { computeSlaHoursRemaining } from '../../lib/workflow';
import { formatINRFromPaise, toPaise } from '../../lib/finance';
import { buildUrlForRoute } from '../../lib/siteUrls';
import { AppCardStatusBadge } from '../common/AppCardStatusBadge';
import { ROLE_TOOL_COLOR_BLOCKS, getServiceCardTheme } from '../../lib/cardColors';
import {
  LayoutDashboard,
  FileText,
  FolderLock,
  ReceiptText,
  Clock,
  UserCheck,
  PlusCircle,
  Briefcase,
  Users,
  AlertTriangle,
  BarChart3,
  Handshake,
  Wallet,
  Building2,
  Key,
  FileSpreadsheet,
  Play,
  Settings,
  ShieldAlert,
  Layers,
  ArrowRight,
  CheckCircle2,
  Copy,
  Check,
  ChevronRight,
  Wrench,
  Crown,
  Sparkles,
} from 'lucide-react';

interface RoleAdaptedLandingProps {
  user: User;
  profile: RoleLandingProfile;
  onNavigate: (route: string, param?: string) => void;
  onApplyForService: (service: Service) => void;
}

function renderToolkitIcon(iconName: RoleToolkitAction['iconName'], className = 'w-5 h-5') {
  switch (iconName) {
    case 'LayoutDashboard':
      return <LayoutDashboard className={className} />;
    case 'FileText':
      return <FileText className={className} />;
    case 'FolderLock':
      return <FolderLock className={className} />;
    case 'ReceiptText':
      return <ReceiptText className={className} />;
    case 'Clock':
      return <Clock className={className} />;
    case 'UserCheck':
      return <UserCheck className={className} />;
    case 'PlusCircle':
      return <PlusCircle className={className} />;
    case 'Briefcase':
      return <Briefcase className={className} />;
    case 'Users':
      return <Users className={className} />;
    case 'AlertTriangle':
      return <AlertTriangle className={className} />;
    case 'BarChart3':
      return <BarChart3 className={className} />;
    case 'Handshake':
      return <Handshake className={className} />;
    case 'Wallet':
      return <Wallet className={className} />;
    case 'Building2':
      return <Building2 className={className} />;
    case 'Key':
      return <Key className={className} />;
    case 'FileSpreadsheet':
      return <FileSpreadsheet className={className} />;
    case 'Play':
      return <Play className={className} />;
    case 'Settings':
      return <Settings className={className} />;
    case 'ShieldAlert':
      return <ShieldAlert className={className} />;
    case 'Layers':
    default:
      return <Layers className={className} />;
  }
}

export const RoleAdaptedLanding: React.FC<RoleAdaptedLandingProps> = ({
  user,
  profile,
  onNavigate,
  onApplyForService,
}) => {
  const { lang } = useLanguage();
  const { setTrayOpen, planDefinition } = useToolTray();
  const {
    services,
    applications,
    drafts,
    tickets,
    operatorEnrollments,
    partners,
    partnerCustomers,
    commissionRules,
    commissionLedger,
    settlementRequests,
    refunds,
    notifications,
    businessSettings,
  } = useData();

  const [copiedCode, setCopiedCode] = useState(false);

  const normalizedRole = getEffectiveUserRole(user);

  const visibleApps = useMemo(
    () => applications.filter((a) => canAccessApplication(user, a)),
    [applications, user]
  );

  const userDrafts = useMemo(
    () => drafts.filter((d) => d.userId === user.id),
    [drafts, user.id]
  );

  const unreadAlerts = useMemo(
    () => notifications.filter((n) => !n.isRead && (n.userId === user.id || !n.userId)).length,
    [notifications, user.id]
  );

  const myPartnerRecord = useMemo(
    () => partners.find((p) => p.userId === user.id || p.id === user.partnerId) || null,
    [partners, user.id, user.partnerId]
  );

  const myEnrollment = useMemo(
    () => operatorEnrollments.find((e) => e.userId === user.id || e.id === user.operatorEnrollmentId) || null,
    [operatorEnrollments, user.id, user.operatorEnrollmentId]
  );

  // Role-specific KPI strip (strictly real data — zero fabricated stats)
  const kpiCards = useMemo(() => {
    const activeStatuses = new Set([
      'Submitted',
      'Payment Pending',
      'Payment Confirmed',
      'Under Review',
      'Documents Required',
      'Correction Required',
      'Resubmitted',
      'Assigned',
      'Processing',
      'Awaiting External Authority',
    ]);

    if (profile.roleKey === 'customer') {
      const actionNeeded = visibleApps.filter(
        (a) => a.status === 'Documents Required' || a.status === 'Correction Required'
      ).length;
      const completed = visibleApps.filter((a) => a.status === 'Completed').length;
      return [
        { label: lang === 'hi' ? 'मेरे आवेदन' : 'My Applications', value: String(visibleApps.length), tone: 'default' },
        { label: lang === 'hi' ? 'सेव ड्राफ्ट' : 'Saved Drafts', value: String(userDrafts.length), tone: 'accent' },
        { label: lang === 'hi' ? 'दस्तावेज़ लंबित' : 'Docs Action Needed', value: String(actionNeeded), tone: actionNeeded > 0 ? 'warn' : 'default' },
        { label: lang === 'hi' ? 'पूर्ण आवेदन' : 'Completed Certificates', value: String(completed), tone: 'ok' },
      ];
    }

    if (profile.roleKey === 'operator') {
      const unassigned = applications.filter((a) => !a.assignedOperatorId && activeStatuses.has(a.status)).length;
      const myAssigned = applications.filter((a) => a.assignedOperatorId === user.id && activeStatuses.has(a.status)).length;
      const kycState = myEnrollment?.kycStatus || user.kycStatus || 'Not Submitted';
      const completedToday = applications.filter((a) => a.assignedOperatorId === user.id && a.status === 'Completed').length;
      return [
        { label: lang === 'hi' ? 'अनअसाइन कतार' : 'Unassigned Queue', value: String(unassigned), tone: 'accent' },
        { label: lang === 'hi' ? 'मेरे सक्रिय केस' : 'My Assigned Cases', value: String(myAssigned), tone: 'default' },
        { label: lang === 'hi' ? 'पूर्ण किए गए' : 'Completed Filings', value: String(completedToday), tone: 'ok' },
        { label: lang === 'hi' ? 'ऑपरेटर KYC' : 'Operator KYC', value: kycState, tone: kycState === 'Approved' ? 'ok' : 'warn' },
      ];
    }

    if (profile.roleKey === 'manager') {
      const activeApps = applications.filter((a) => activeStatuses.has(a.status));
      const overdue = activeApps.filter((a) => computeSlaHoursRemaining(a.slaTargetAt || a.submissionDate).isOverdue).length;
      const unassigned = activeApps.filter((a) => !a.assignedOperatorId).length;
      const openTickets = tickets.filter((t) => t.status !== 'Closed' && t.status !== 'Resolved').length;
      return [
        { label: lang === 'hi' ? 'सक्रिय पाइपलाइन' : 'Active Pipeline', value: String(activeApps.length), tone: 'default' },
        { label: lang === 'hi' ? 'SLA समय पार' : 'Overdue SLA', value: String(overdue), tone: overdue > 0 ? 'warn' : 'ok' },
        { label: lang === 'hi' ? 'अनअसाइन आवेदन' : 'Unassigned Queue', value: String(unassigned), tone: 'accent' },
        { label: lang === 'hi' ? 'खुले सहायता टिकट' : 'Open Tickets', value: String(openTickets), tone: 'default' },
      ];
    }

    if (profile.roleKey === 'partner') {
      const myLedger = commissionLedger.filter((l) => l.partnerId === (myPartnerRecord?.id || user.partnerId));
      const availablePaise = myLedger
        .filter((l) => l.status === 'Approved')
        .reduce((acc, l) => acc + l.netPaise, 0);
      const myCustCount = partnerCustomers.filter((c) => c.partnerId === (myPartnerRecord?.id || user.partnerId)).length;
      const approval = myPartnerRecord?.approvalStatus || user.kycStatus || 'Pending Approval';
      return [
        { label: lang === 'hi' ? 'सहायक आवेदन' : 'Assisted Filings', value: String(visibleApps.length), tone: 'default' },
        { label: lang === 'hi' ? 'मेरे ग्राहक' : 'Client Book', value: String(myCustCount), tone: 'accent' },
        { label: lang === 'hi' ? 'उपलब्ध कमीशन' : 'Approved Earnings', value: formatINRFromPaise(availablePaise), tone: 'ok' },
        { label: lang === 'hi' ? 'पार्टनर स्थिति' : 'Partner Status', value: approval, tone: approval === 'Approved' ? 'ok' : 'warn' },
      ];
    }

    if (profile.roleKey === 'business') {
      const b2bServicesCount = services.filter((s) => s.b2bSupported).length;
      const activeOrders = visibleApps.filter((a) => activeStatuses.has(a.status)).length;
      const completedOrders = visibleApps.filter((a) => a.status === 'Completed').length;
      return [
        { label: lang === 'hi' ? 'सक्रिय B2B ऑर्डर' : 'Active B2B Orders', value: String(activeOrders), tone: 'accent' },
        { label: lang === 'hi' ? 'पूर्ण कॉर्पोरेट आवेदन' : 'Completed Orders', value: String(completedOrders), tone: 'ok' },
        { label: lang === 'hi' ? 'B2B सेवाएं उपलब्ध' : 'B2B Services Ready', value: String(b2bServicesCount), tone: 'default' },
        { label: lang === 'hi' ? 'KYB स्थिति' : 'Enterprise KYB', value: user.businessId ? 'Verified' : 'Standard', tone: 'default' },
      ];
    }

    // admin / super_admin
    const pendingKyc =
      operatorEnrollments.filter((e) => e.kycStatus === 'KYC Submitted' || e.kycStatus === 'Under Verification').length +
      partners.filter((p) => p.approvalStatus === 'Pending Approval').length;
    const pendingPayouts =
      settlementRequests.filter((s) => s.status === 'Requested' || s.status === 'Under Review' || s.status === 'Approved').length +
      refunds.filter((r) => r.status === 'Pending').length;
    const totalRevenuePaise = applications
      .filter((a) => a.payment?.status === 'Success')
      .reduce((sum, a) => sum + toPaise(a.payment?.totalAmount || 0), 0);

    return [
      { label: lang === 'hi' ? 'कुल आवेदन' : 'Total Applications', value: String(applications.length), tone: 'default' },
      { label: lang === 'hi' ? 'कुल संग्रह' : 'Paid Volume', value: formatINRFromPaise(totalRevenuePaise), tone: 'ok' },
      { label: lang === 'hi' ? 'KYC अनुमोदन लंबित' : 'KYC Pending Review', value: String(pendingKyc), tone: pendingKyc > 0 ? 'warn' : 'ok' },
      { label: lang === 'hi' ? 'पेआउट / रिफंड कतार' : 'Payout & Refund Queue', value: String(pendingPayouts), tone: pendingPayouts > 0 ? 'accent' : 'default' },
    ];
  }, [
    applications,
    commissionLedger,
    lang,
    myEnrollment?.kycStatus,
    myPartnerRecord,
    operatorEnrollments,
    partnerCustomers,
    partners,
    profile.roleKey,
    refunds,
    services,
    settlementRequests,
    tickets,
    user.businessId,
    user.id,
    user.kycStatus,
    user.partnerId,
    userDrafts.length,
    visibleApps,
  ]);

  const featuredTool = profile.toolkit.find((t) => t.featured) || profile.toolkit[0];
  const secondaryTools = profile.toolkit.filter((t) => t.id !== featuredTool?.id);

  const handleLinkClick = (e: React.MouseEvent, route: string, param?: string) => {
    e.preventDefault();
    onNavigate(route, param);
  };

  const referralCode = myPartnerRecord?.referralCode || user.referralCode || '';

  const copyReferral = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const overdueManagerApps = useMemo(() => {
    if (profile.roleKey !== 'manager') return [];
    return applications
      .filter((a) => a.status !== 'Completed' && a.status !== 'Cancelled' && a.status !== 'Rejected')
      .slice(0, 4);
  }, [applications, profile.roleKey]);

  const b2bQuickServices = useMemo(() => {
    if (profile.roleKey !== 'business') return [];
    return services.filter((s) => s.b2bSupported).slice(0, 4);
  }, [services, profile.roleKey]);

  const quickLaunchServices = useMemo(() => services.slice(0, 4), [services]);

  return (
    <div className="space-y-10 lg:space-y-14">
      {/* SECTION 1: CENTRALIZED ROLE-TAILORED COMMAND HERO */}
      <section className="relative overflow-hidden pt-7 pb-10 sm:pt-10 sm:pb-12 lg:pt-12 lg:pb-14 bg-gradient-to-b from-[#FFF9F2] via-[#FFFDF9] to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/95 border-b border-slate-200 dark:border-slate-800">
        {/* Subtle Ambient Tricolor Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[36rem] h-48 rounded-full bg-gradient-to-r from-[#FF671F]/12 via-amber-400/10 to-[#138808]/12 blur-3xl"
        />

        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 relative z-10 space-y-6 sm:space-y-8">
          {/* Centered Hero Header + Parallel Action Buttons */}
          <div className="max-w-3xl mx-auto text-center space-y-3.5 sm:space-y-4">
            <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-3 py-1 rounded-xl bg-orange-50/90 dark:bg-orange-950/50 border border-orange-200/80 dark:border-orange-900/60 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF671F]">
              <span>{lang === 'hi' ? profile.eyebrowHi : profile.eyebrow}</span>
            </div>

            <div className="space-y-2">
              <div className="inline-flex flex-wrap items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                <span>
                  {lang === 'hi' ? `नमस्ते, ${user.name}` : `Welcome back, ${user.name}`}
                </span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  {normalizedRole.replace('_', ' ')}
                </span>
                {unreadAlerts > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950/70 text-[#FF671F]">
                    {unreadAlerts} {lang === 'hi' ? 'नई सूचनाएं' : 'unread'}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-4xl lg:text-[2.65rem] font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] text-balance">
                {lang === 'hi' ? profile.headlineHi : profile.headline}
              </h1>
            </div>

            <p className="text-xs sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
              {lang === 'hi' ? profile.subheadlineHi : profile.subheadline}
            </p>

            {/* Centered Parallel Action Buttons */}
            <div className="max-w-lg sm:max-w-xl mx-auto grid grid-cols-2 gap-2 sm:gap-3.5 pt-1.5">
              <a
                href={buildUrlForRoute(profile.primaryCta.route, profile.primaryCta.param)}
                onClick={(e) => handleLinkClick(e, profile.primaryCta.route, profile.primaryCta.param)}
                className="bg-gradient-to-r from-[#FF671F] to-orange-600 hover:from-[#E55B1B] hover:to-orange-700 text-white font-bold text-[11px] sm:text-sm px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl shadow-sm shadow-orange-500/20 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-1.5 sm:gap-2 min-w-0"
              >
                <span className="truncate">
                  {lang === 'hi' ? profile.primaryCta.labelHi : profile.primaryCta.label}
                </span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              </a>

              <a
                href={buildUrlForRoute(profile.secondaryCta.route, profile.secondaryCta.param)}
                onClick={(e) => handleLinkClick(e, profile.secondaryCta.route, profile.secondaryCta.param)}
                className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-[#FF671F]/70 text-slate-800 dark:text-slate-100 font-bold text-[11px] sm:text-sm px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl shadow-2xs hover:-translate-y-0.5 transition-all flex items-center justify-center gap-1.5 sm:gap-2 min-w-0"
              >
                <span className="truncate">
                  {lang === 'hi' ? profile.secondaryCta.labelHi : profile.secondaryCta.label}
                </span>
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF671F] shrink-0" />
              </a>
            </div>
          </div>

          {/* Centered Live Role KPI Strip */}
          <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5 tabular-nums">
            {kpiCards.map((card, idx) => {
              const toneStyles =
                card.tone === 'ok'
                  ? 'border-emerald-200/90 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/25'
                  : card.tone === 'warn'
                  ? 'border-amber-200/90 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/25'
                  : card.tone === 'accent'
                  ? 'border-orange-200/90 dark:border-orange-900/60 bg-orange-50/50 dark:bg-orange-950/25'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900';

              const valueColor =
                card.tone === 'ok'
                  ? 'text-[#138808] dark:text-emerald-400'
                  : card.tone === 'warn'
                  ? 'text-amber-600 dark:text-amber-400'
                  : card.tone === 'accent'
                  ? 'text-[#FF671F]'
                  : 'text-slate-900 dark:text-white';

              return (
                <div
                  key={idx}
                  className={`app-block rounded-xl sm:rounded-2xl border p-3 sm:p-4 text-center shadow-2xs ${toneStyles}`}
                >
                  <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                    {card.label}
                  </div>
                  <div className={`text-lg sm:text-2xl font-black font-mono mt-0.5 truncate ${valueColor}`}>
                    {card.value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Centered Active Account Context & Role Checklist Card */}
          <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5 text-center sm:text-left">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {lang === 'hi' ? 'सक्रिय खाता प्रोफ़ाइल' : 'Active Account Context'}
                </div>
                <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate mt-0.5">
                  {user.companyName || user.name}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user.email} · {normalizedRole.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
                {profile.roleKey === 'partner' && referralCode && (
                  <div className="inline-flex items-center gap-2 bg-[#F7F8FA] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {lang === 'hi' ? 'रेफरल कोड:' : 'Code:'}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                      {referralCode}
                    </span>
                    <button
                      type="button"
                      onClick={copyReferral}
                      className="text-xs font-bold text-[#FF671F] hover:text-[#E55B1B] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}

                {profile.roleKey === 'admin' && (
                  <div className="bg-[#F7F8FA] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-[10px] sm:text-[11px] font-mono text-slate-700 dark:text-slate-300">
                    GSTIN: {businessSettings.gstin} · UDYAM: {businessSettings.udyamNumber}
                  </div>
                )}

                {profile.roleKey === 'operator' && (
                  <a
                    href={buildUrlForRoute('operator-enroll')}
                    onClick={(e) => handleLinkClick(e, 'operator-enroll')}
                    className="inline-flex items-center gap-1.5 bg-[#F7F8FA] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-[#FF671F] hover:border-[#FF671F] transition whitespace-nowrap shrink-0"
                  >
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">
                      {lang === 'hi' ? 'KYC:' : 'KYC:'}
                    </span>
                    <span>{myEnrollment?.kycStatus || user.kycStatus || 'Complete KYC'} →</span>
                  </a>
                )}

                <a
                  href={buildUrlForRoute('contact')}
                  onClick={(e) => handleLinkClick(e, 'contact')}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-[#FF671F] transition whitespace-nowrap shrink-0"
                >
                  {lang === 'hi' ? 'सहायता डेस्क' : 'Operations Support'}
                </a>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-900 dark:text-white text-center sm:text-left">
                {lang === 'hi' ? profile.checklistTitleHi : profile.checklistTitle}
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
                {profile.essentialsChecklist.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 p-2.5 sm:p-3 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#138808] shrink-0 mt-0.5" />
                    <span>{lang === 'hi' ? item.hi : item.en}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: ROLE TOOLKIT BENTO GRID ("ALL THEY NEED") */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#FF671F]">
              {lang === 'hi' ? 'भूमिका के अनुसार त्वरित उपकरण' : 'Tailored Role Workspace'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
              {lang === 'hi' ? 'आपके खाते के लिए आवश्यक सभी मॉड्यूल' : 'Everything Included for Your Account'}
            </h2>
          </div>
          <a
            href={buildUrlForRoute(profile.primaryCta.route, profile.primaryCta.param)}
            onClick={(e) => handleLinkClick(e, profile.primaryCta.route, profile.primaryCta.param)}
            className="text-xs font-bold text-[#FF671F] hover:text-[#E55B1B] inline-flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <span>{lang === 'hi' ? 'पूर्ण कंसोल खोलें' : 'Open Full Console'}</span>
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Featured Primary Role Card */}
          {featuredTool && (
            <a
              href={buildUrlForRoute(featuredTool.route, featuredTool.param)}
              onClick={(e) => handleLinkClick(e, featuredTool.route, featuredTool.param)}
              className="lg:col-span-5 bg-slate-900 dark:bg-slate-900 border border-slate-800 hover:border-[#FF671F] rounded-2xl p-6 sm:p-8 text-white flex flex-col justify-between transition group"
            >
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-xl bg-[#FF671F] text-white flex items-center justify-center">
                  {renderToolkitIcon(featuredTool.iconName, 'w-5 h-5')}
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#FFC928]">
                    {lang === 'hi' ? 'प्राथमिक कार्यस्थान' : 'Primary Workspace'}
                  </div>
                  <h3 className="text-xl font-black tracking-tight group-hover:text-[#FFC928] transition">
                    {lang === 'hi' ? featuredTool.titleHi : featuredTool.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {lang === 'hi' ? featuredTool.descriptionHi : featuredTool.description}
                  </p>
                </div>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-[#FFC928]">
                <span>{lang === 'hi' ? 'अभी खोलें' : 'Launch Module'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </div>
            </a>
          )}

          {/* Secondary Direct Module Grid */}
          <div className="lg:col-span-7 grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
            {secondaryTools.map((tool, idx) => {
              const colorBlock = ROLE_TOOL_COLOR_BLOCKS[idx % ROLE_TOOL_COLOR_BLOCKS.length];
              return (
              <a
                key={tool.id}
                href={buildUrlForRoute(tool.route, tool.param)}
                onClick={(e) => handleLinkClick(e, tool.route, tool.param)}
                className={`app-card border rounded-xl sm:rounded-2xl p-2.5 sm:p-4 lg:p-5 flex flex-col justify-between group ${colorBlock.card}`}
              >
                <div className="space-y-1.5 sm:space-y-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center transition shrink-0 ${colorBlock.iconBox}`}>
                      {renderToolkitIcon(tool.iconName, 'w-3.5 h-3.5 sm:w-4 sm:h-4')}
                    </div>
                    <AppCardStatusBadge
                      contextKey={`${tool.id} ${tool.title}`}
                      lang={lang}
                    />
                  </div>
                  <div>
                    <h3 className="text-[11px] sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#FF671F] transition line-clamp-1 leading-tight">
                      {lang === 'hi' ? tool.titleHi : tool.title}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 mt-0.5 sm:mt-1 leading-snug sm:leading-relaxed line-clamp-2">
                      {lang === 'hi' ? tool.descriptionHi : tool.description}
                    </p>
                  </div>
                </div>
                <div className={`pt-2 sm:pt-3 mt-2 sm:mt-3 border-t flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-200 group-hover:text-[#FF671F] ${colorBlock.divider}`}>
                  <span>{lang === 'hi' ? 'खोलें' : 'Open'}</span>
                  <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </div>
              </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 3: LIVE ROLE ACTIVITY & QUICK LAUNCH (REAL DATA ONLY) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 cols: Live Role Feed (Drafts / Queue / SLA / Partner Tiers / B2B Endpoints / Admin Reviews) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {lang === 'hi' ? 'लाइव खाता स्थिति' : 'Live Workspace State'}
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {profile.roleKey === 'customer'
                    ? lang === 'hi'
                      ? 'मेरे हाल के आवेदन व सेव ड्राफ्ट'
                      : 'Recent Applications & Saved Drafts'
                    : profile.roleKey === 'operator'
                    ? lang === 'hi'
                      ? 'सक्रिय ऑपरेटर कतार'
                      : 'Active Operator Intake Queue'
                    : profile.roleKey === 'manager'
                    ? lang === 'hi'
                      ? 'SLA प्राथमिकता कतार'
                      : 'Active SLA Pipeline Monitor'
                    : profile.roleKey === 'partner'
                    ? lang === 'hi'
                      ? 'कमीशन नियम व सहायक आवेदन'
                      : 'Active Commission Rules & Recent Filings'
                    : profile.roleKey === 'business'
                    ? lang === 'hi'
                      ? 'एंटरप्राइज API सेतु व ऑर्डर'
                      : 'Enterprise API Setu & B2B Filings'
                    : lang === 'hi'
                    ? 'एडमिन अनुमोदन सारांश'
                    : 'Pending Approvals & Governance Queue'}
                </h3>
              </div>
              <a
                href={buildUrlForRoute(profile.primaryCta.route, profile.primaryCta.param)}
                onClick={(e) => handleLinkClick(e, profile.primaryCta.route, profile.primaryCta.param)}
                className="text-xs font-bold text-[#FF671F] hover:underline whitespace-nowrap shrink-0"
              >
                {lang === 'hi' ? 'सभी देखें →' : 'View All →'}
              </a>
            </div>

            {profile.roleKey === 'customer' && (
              <div className="space-y-3">
                {userDrafts.length > 0 && (
                  <div className="space-y-2">
                    {userDrafts.slice(0, 2).map((d: ApplicationDraft) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            Draft: {d.serviceName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Saved {new Date(d.savedAt).toLocaleDateString('en-IN')}
                          </div>
                        </div>
                        <a
                          href={buildUrlForRoute('dashboard', 'overview')}
                          onClick={(e) => handleLinkClick(e, 'dashboard', 'overview')}
                          className="text-xs font-bold text-[#FF671F] hover:underline whitespace-nowrap shrink-0"
                        >
                          Resume Draft →
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {visibleApps.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl">
                    {visibleApps.slice(0, 4).map((app) => (
                      <div key={app.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">{app.serviceName}</div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {app.id} · {app.status}
                          </div>
                        </div>
                        <a
                          href={buildUrlForRoute('dashboard', 'applications')}
                          onClick={(e) => handleLinkClick(e, 'dashboard', 'applications')}
                          className="font-semibold text-[#FF671F] hover:underline whitespace-nowrap shrink-0"
                        >
                          Inspect
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {lang === 'hi'
                        ? 'अभी कोई सक्रिय आवेदन नहीं है। नीचे किसी भी सेवा से शुरुआत करें।'
                        : 'No applications submitted under this account yet. Start your first filing directly on the right.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {profile.roleKey === 'operator' && (
              <div className="space-y-3">
                {visibleApps.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl">
                    {visibleApps.slice(0, 4).map((app) => (
                      <div key={app.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {app.userName} · {app.serviceName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {app.id} · {app.status}
                          </div>
                        </div>
                        <a
                          href={buildUrlForRoute('operator', 'queue')}
                          onClick={(e) => handleLinkClick(e, 'operator', 'queue')}
                          className="font-bold text-[#FF671F] hover:underline whitespace-nowrap shrink-0"
                        >
                          Process →
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {lang === 'hi'
                        ? 'फिलहाल कोई लंबित आवेदन कतार में नहीं है। वॉक-इन नागरिक पंजीकरण शुरू करें।'
                        : 'Your operator queue is currently clear. Use Walk-In Citizen Intake whenever an applicant arrives.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {profile.roleKey === 'manager' && (
              <div className="space-y-3">
                {overdueManagerApps.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl">
                    {overdueManagerApps.map((app) => {
                      const sla = computeSlaHoursRemaining(app.slaTargetAt || app.submissionDate);
                      return (
                        <div key={app.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">
                              {app.id} · {app.serviceName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {app.assignedOperatorName || 'Unassigned'} · {sla.label}
                            </div>
                          </div>
                          <a
                            href={buildUrlForRoute('manager', app.assignedOperatorId ? 'sla' : 'assign')}
                            onClick={(e) =>
                              handleLinkClick(e, 'manager', app.assignedOperatorId ? 'sla' : 'assign')
                            }
                            className={`font-bold hover:underline whitespace-nowrap shrink-0 ${
                              sla.isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-[#FF671F]'
                            }`}
                          >
                            {app.assignedOperatorId ? 'Review SLA' : 'Assign'} →
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {lang === 'hi'
                        ? 'सभी SLA पाइपलाइन अद्यतन हैं।'
                        : 'Zero active SLA bottlenecks right now. Reports & partner oversight remain one click away.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {profile.roleKey === 'partner' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {commissionRules.filter((r) => r.isActive).slice(0, 2).map((rule) => (
                    <div
                      key={rule.id}
                      className="p-3.5 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1"
                    >
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Active Tier
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{rule.name}</div>
                      <div className="text-xs font-mono font-bold text-[#138808] dark:text-emerald-400">
                        {rule.commissionType === 'percentage'
                          ? `${(rule.percentageBps / 100).toFixed(1)}% per service fee`
                          : `${formatINRFromPaise(rule.fixedAmountPaise)} flat`}
                      </div>
                    </div>
                  ))}
                </div>
                {visibleApps.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl">
                    {visibleApps.slice(0, 3).map((app) => (
                      <div key={app.id} className="p-3 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {app.userName} · {app.serviceName}
                        </span>
                        <span className="font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                          {app.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 text-center">
                    {lang === 'hi'
                      ? 'अभी तक कोई सहायक आवेदन दर्ज नहीं है। ग्राहक जोड़कर नया आवेदन शुरू करें।'
                      : 'No assisted client filings recorded yet. Add your first customer inside Partner Desk.'}
                  </div>
                )}
              </div>
            )}

            {profile.roleKey === 'business' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href={buildUrlForRoute('b2b', 'playground')}
                    onClick={(e) => handleLinkClick(e, 'b2b', 'playground')}
                    className="p-4 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] transition space-y-1"
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      in.gov.gst.verify · PAN · Udyam
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Run single-entity payload tests in API Playground →
                    </p>
                  </a>
                  <a
                    href={buildUrlForRoute('b2b', 'bulk')}
                    onClick={(e) => handleLinkClick(e, 'b2b', 'bulk')}
                    className="p-4 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] transition space-y-1"
                  >
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      CSV Bulk KYB Processor
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Upload vendor sheets and export verification batches →
                    </p>
                  </a>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                  Supported Managed Filings: {b2bQuickServices.map((s) => s.name).join(' · ') || 'GST · Udyam · FSSAI'}
                </div>
              </div>
            )}

            {profile.roleKey === 'admin' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
                <a
                  href={buildUrlForRoute('admin', 'operators')}
                  onClick={(e) => handleLinkClick(e, 'admin', 'operators')}
                  className="p-3.5 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] transition"
                >
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Operator KYC</div>
                  <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                    {operatorEnrollments.filter((e) => e.kycStatus !== 'Approved' && e.kycStatus !== 'Rejected').length}
                  </div>
                </a>
                <a
                  href={buildUrlForRoute('admin', 'partners')}
                  onClick={(e) => handleLinkClick(e, 'admin', 'partners')}
                  className="p-3.5 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] transition"
                >
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Partner Reviews</div>
                  <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                    {partners.filter((p) => p.approvalStatus === 'Pending Approval').length}
                  </div>
                </a>
                <a
                  href={buildUrlForRoute('admin', 'payments')}
                  onClick={(e) => handleLinkClick(e, 'admin', 'payments')}
                  className="p-3.5 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] transition"
                >
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Settlements</div>
                  <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                    {settlementRequests.filter((s) => s.status === 'Requested' || s.status === 'Under Review' || s.status === 'Approved').length}
                  </div>
                </a>
                <a
                  href={buildUrlForRoute('admin', 'services')}
                  onClick={(e) => handleLinkClick(e, 'admin', 'services')}
                  className="p-3.5 rounded-xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-[#FF671F] transition"
                >
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">Live Services</div>
                  <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                    {services.length}
                  </div>
                </a>
              </div>
            )}
          </div>

          {/* Right 5 cols: Fast Service Launch Panel */}
          <div className="lg:col-span-5 bg-gradient-to-br from-emerald-50/70 via-white to-sky-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/25 border border-emerald-200/75 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#138808] dark:text-emerald-400">
                  {lang === 'hi' ? 'त्वरित सेवा प्रारंभ' : 'Fast Service Launcher'}
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {profile.roleKey === 'operator'
                    ? lang === 'hi'
                      ? 'लोकप्रिय वॉक-इन सेवाएं'
                      : 'Popular Walk-In Services'
                    : profile.roleKey === 'business'
                    ? lang === 'hi'
                      ? 'कॉर्पोरेट पंजीकरण शुरू करें'
                      : 'Start Corporate Compliance'
                    : lang === 'hi'
                    ? 'सीधे नया आवेदन शुरू करें'
                    : 'Start a New Application'}
                </h3>
              </div>
              <a
                href={buildUrlForRoute('services')}
                onClick={(e) => handleLinkClick(e, 'services')}
                className="text-xs font-bold text-[#FF671F] hover:underline whitespace-nowrap shrink-0"
              >
                {lang === 'hi' ? 'सभी सेवाएं' : 'Catalog'}
              </a>
            </div>

            <div className="space-y-2.5">
              {(profile.roleKey === 'business' && b2bQuickServices.length > 0
                ? b2bQuickServices
                : quickLaunchServices
              ).map((srv) => {
                const srvTheme = getServiceCardTheme(srv.category, srv.productType);
                return (
                <div
                  key={srv.id}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${srvTheme.card}`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {lang === 'hi' && srv.nameHi ? srv.nameHi : srv.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300">
                      ₹{srv.serviceCharge} · {srv.estimatedTime}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onApplyForService(srv)}
                    className="bg-[#FF671F] hover:bg-[#E55B1B] text-white text-[10px] sm:text-[11px] font-bold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {lang === 'hi' ? 'शुरू करें' : 'Apply'}
                  </button>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: INTEGRATED DIGITAL TOOLS TRAY & PLANS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-orange-50/90 via-white to-sky-50/80 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/30 border border-orange-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#FF671F]">
              <Wrench className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? '150+ डिजिटल टूल्स ट्रे' : 'Digital Tools Tray · Free & Paid Plans'}</span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {lang === 'hi'
                ? 'PDF, पासपोर्ट फोटो, KB रिसाइज़र, QR, GST व AI डॉक्यूमेंट टूल्स'
                : 'Built-In PDF, CSC Photo Resizer, OCR, GST Calculator & AI Utilities'}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Active Plan: <strong className="text-slate-900 dark:text-white">{planDefinition.name}</strong> ({planDefinition.dailyJobLimit ?? 'Unlimited'} daily jobs · {planDefinition.monthlyAiCredits} AI credits/mo)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTrayOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#FF671F] hover:bg-[#E55B1B] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? 'टूल्स ट्रे खोलें' : 'Open Tools Tray'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('tools')}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>{lang === 'hi' ? 'सभी 150+ टूल्स' : 'All 150+ Tools'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('tool-plans')}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-[#FF671F] text-slate-800 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>{lang === 'hi' ? 'प्लान बदलें' : 'Upgrade Plans'}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

import { OperatorKycStatus, User, UserRole } from '../types';
import {
  PermissionCode,
  RoleNavLink,
  dedupeNavItems,
  getEffectiveUserRole,
  getNavItemSignature,
  getPermissionsForRole,
  getUniqueRoleNavLinks,
  hasPermission,
  normalizeRole,
} from './rbac';

export interface ControlledNavItem {
  id: string;
  label: string;
  labelHi?: string;
  route: string;
  param?: string;
  badge?: string;
  color?: string;
  iconKey:
    | 'home'
    | 'services'
    | 'products'
    | 'packages'
    | 'track'
    | 'blog'
    | 'login'
    | 'register'
    | 'become_partner'
    | 'kyc'
    | 'b2b'
    | 'partners'
    | 'payments'
    | 'shield'
    | 'sliders'
    | 'server'
    | 'layers'
    | 'gauge'
    | 'cloud'
    | 'activity'
    | 'workspace'
    | 'headphones'
    | 'sandbox_test'
    | 'camera'
    | 'file_check'
    | 'file_text'
    | 'receipt'
    | 'folder'
    | 'bell'
    | 'award'
    | 'calculator'
    | 'save'
    | 'download'
    | 'history'
    | 'briefcase'
    | 'tools'
    | 'sparkles'
    | 'crown'
    | 'compass'
    | 'help'
    | 'info'
    | 'phone';
  requiredPermissions?: PermissionCode[];
  requiresApprovedKyc?: boolean;
  allowedRoles?: UserRole[];
}

export interface DynamicNavigationInput {
  user:
    | (Pick<
        User,
        | 'id'
        | 'accountType'
        | 'permissions'
        | 'kycStatus'
        | 'partnerId'
        | 'businessId'
        | 'operatorEnrollmentId'
      > & { role: UserRole | 'b2b' | string })
    | null;
  role?: UserRole | 'b2b' | string | null;
  permissions?: PermissionCode[];
  isAuthenticated?: boolean;
  currentRoute?: string;
  currentParam?: string;
  lang?: string;
  plan?: string;
  isMobileDrawer?: boolean;
}

export interface DynamicNavigationState {
  effectiveRole: UserRole;
  accountType: NonNullable<User['accountType']>;
  kycStatus: OperatorKycStatus;
  isKycApproved: boolean;
  isStaffRole: boolean;
  canSeePartnerKyc: boolean;
  primaryPortalRoute: string;
  primaryPortalLabel: string;
  headerPrimaryLinks: RoleNavLink[];
  headerDropdownItems: ControlledNavItem[];
  headerCta: { route: string; param: string; label: string };
  mobileBottomItems: ControlledNavItem[];
  sidebar: {
    mobilePrimaryItems: ControlledNavItem[];
    roleGroupTitle: string;
    roleGroupTitleHi: string;
    roleWorkspaceItems: ControlledNavItem[];
    oversightItems: ControlledNavItem[];
    toolItems: ControlledNavItem[];
    exploreItems: ControlledNavItem[];
    supportItems: ControlledNavItem[];
  };
}

/**
 * Sensitive Partner KYC / Operator KYC / Corporate KYB links are strictly hidden
 * unless the signed-in user holds the 'operator' or 'b2b' ('business') role.
 * Guests, citizen customers, referral partners, managers, and admins do not expose self-service KYC links.
 */
export function isEligibleForPartnerKyc(
  user?: (Pick<User, 'accountType'> & { role?: UserRole | 'b2b' | string }) | null
): boolean {
  if (!user) return false;
  const rawRole = String(user.role || '').toLowerCase().trim();
  const effective = getEffectiveUserRole(user as Pick<User, 'role' | 'accountType'>);
  return (
    rawRole === 'operator' ||
    rawRole === 'b2b' ||
    rawRole === 'business' ||
    effective === 'operator' ||
    effective === 'business' ||
    user.accountType === 'operator' ||
    user.accountType === 'business'
  );
}

function resolveUserKycState(
  user: DynamicNavigationInput['user'],
  effectiveRole: UserRole
): DynamicNavigationState['kycStatus'] {
  if (user?.kycStatus) return user.kycStatus;
  if (
    effectiveRole === 'admin' ||
    effectiveRole === 'super_admin' ||
    effectiveRole === 'manager'
  ) {
    return 'Approved';
  }
  if (effectiveRole === 'operator' && String(user?.role || '').toLowerCase() === 'operator') {
    return 'Approved';
  }
  if (effectiveRole === 'partner' && user?.partnerId) {
    return 'Approved';
  }
  if (effectiveRole === 'business' && user?.businessId) {
    return 'Approved';
  }
  if (
    user?.accountType === 'operator' ||
    user?.accountType === 'partner' ||
    user?.accountType === 'business'
  ) {
    return 'Not Submitted';
  }
  return 'Not Submitted';
}

function itemPermitted(
  item: ControlledNavItem,
  user: DynamicNavigationInput['user'],
  effectiveRole: UserRole,
  effectivePerms: PermissionCode[],
  isKycApproved: boolean
): boolean {
  if (item.allowedRoles && item.allowedRoles.length > 0 && !item.allowedRoles.includes(effectiveRole)) {
    return false;
  }
  if (item.requiresApprovedKyc && !isKycApproved) {
    return false;
  }
  if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
    return true;
  }
  if (!user) return false;
  return item.requiredPermissions.some((perm) =>
    hasPermission({ role: effectiveRole, permissions: effectivePerms }, perm)
  );
}

export function isRouteAccessible(
  route: string,
  navState: Pick<DynamicNavigationState, 'effectiveRole' | 'isKycApproved' | 'canSeePartnerKyc'>,
  isAuthenticated: boolean
): boolean {
  switch (route) {
    case 'admin':
      return isAuthenticated && (navState.effectiveRole === 'admin' || navState.effectiveRole === 'super_admin');
    case 'manager':
      return (
        isAuthenticated &&
        ['manager', 'admin', 'super_admin'].includes(navState.effectiveRole)
      );
    case 'operator-enroll':
      return isAuthenticated && navState.canSeePartnerKyc;
    case 'operator':
      return (
        isAuthenticated &&
        ((navState.effectiveRole === 'operator' && navState.isKycApproved) ||
          ['manager', 'admin', 'super_admin'].includes(navState.effectiveRole))
      );
    case 'partner':
      return (
        isAuthenticated &&
        ['partner', 'manager', 'admin', 'super_admin'].includes(navState.effectiveRole)
      );
    case 'b2b':
      return (
        isAuthenticated &&
        ['business', 'admin', 'super_admin'].includes(navState.effectiveRole)
      );
    case 'dashboard':
    case 'workspace':
      return isAuthenticated;
    default:
      return true;
  }
}

export function resolveDynamicNavigation(
  input: DynamicNavigationInput
): DynamicNavigationState {
  const {
    user,
    role: ctxRole,
    permissions: ctxPerms,
    isAuthenticated = Boolean(user),
    lang = 'en',
    plan = 'free',
    isMobileDrawer = false,
  } = input;

  const authed = Boolean(isAuthenticated && user);
  const effectiveRole: UserRole =
    authed && user
      ? getEffectiveUserRole(user as Pick<User, 'role' | 'accountType'>)
      : normalizeRole(ctxRole);
  const accountType = user?.accountType || 'customer';
  const kycStatus = resolveUserKycState(user, effectiveRole);
  const isKycApproved = kycStatus === 'Approved';
  const isStaffRole =
    authed &&
    ['admin', 'super_admin', 'manager', 'operator', 'partner', 'business'].includes(
      effectiveRole
    );
  const canSeePartnerKyc = authed && isEligibleForPartnerKyc(user);

  const effectivePerms: PermissionCode[] = authed
    ? ctxPerms && ctxPerms.length > 0
      ? ctxPerms
      : getPermissionsForRole(effectiveRole)
    : [];

  const primaryPortalRoute = !authed
    ? 'login'
    : effectiveRole === 'admin' || effectiveRole === 'super_admin'
    ? 'admin'
    : effectiveRole === 'manager'
    ? 'manager'
    : effectiveRole === 'operator'
    ? isKycApproved
      ? 'operator'
      : 'operator-enroll'
    : effectiveRole === 'partner'
    ? 'partner'
    : effectiveRole === 'business'
    ? 'b2b'
    : 'dashboard';

  const primaryPortalLabel = !authed
    ? 'Login'
    : effectiveRole === 'admin' || effectiveRole === 'super_admin'
    ? 'Admin Console'
    : effectiveRole === 'manager'
    ? 'Manager Desk'
    : effectiveRole === 'operator'
    ? isKycApproved
      ? 'Operator Desk'
      : 'Complete Operator KYC'
    : effectiveRole === 'partner'
    ? 'Partner Desk'
    : effectiveRole === 'business'
    ? isKycApproved
      ? 'B2B Portal'
      : 'Complete B2B KYC'
    : 'My Dashboard';

  // 1. Top Header Navigation Links (5 clean role-specific & kycStatus-gated links)
  let rawHeaderLinks: RoleNavLink[] = getUniqueRoleNavLinks(
    authed ? effectiveRole : null,
    authed
  );

  // If operator or b2b KYC is NOT approved yet, replace sensitive operational routes with KYC & safe views
  if (authed && effectiveRole === 'operator' && !isKycApproved) {
    rawHeaderLinks = [
      { label: 'Operator KYC', labelHi: 'ऑपरेटर KYC', route: 'operator-enroll' },
      { label: 'Services', labelHi: 'सेवाएं', route: 'services' },
      { label: 'Track Status', labelHi: 'स्थिति ट्रैक', route: 'track' },
      { label: 'Partner Guide', labelHi: 'पार्टनर गाइड', route: 'become-partner' },
      { label: 'Workspace', labelHi: 'वर्कस्पेस', route: 'workspace' },
    ];
  } else if (authed && effectiveRole === 'business' && !isKycApproved) {
    rawHeaderLinks = [
      { label: 'B2B Console', labelHi: 'B2B कंसोल', route: 'b2b', param: 'overview' },
      { label: 'Partner & B2B KYC', labelHi: 'B2B KYC सत्यापन', route: 'b2b', param: 'kyc' },
      { label: 'API Playground', labelHi: 'API प्लेग्राउंड', route: 'b2b', param: 'playground' },
      { label: 'Services', labelHi: 'सेवाएं', route: 'services' },
      { label: 'Track Status', labelHi: 'स्थिति ट्रैक', route: 'track' },
    ];
  }

  const headerPrimaryLinks = dedupeNavItems(rawHeaderLinks);
  const headerSignatures = new Set(
    headerPrimaryLinks.map((link) => getNavItemSignature(link))
  );

  // 2. Context-Aware Right Header CTA (guaranteed zero overlap with headerPrimaryLinks)
  const candidateCta: { route: string; param: string; label: string } = !authed
    ? { route: 'services', param: 'personal', label: lang === 'hi' ? 'आवेदन करें' : 'Apply Now' }
    : effectiveRole === 'admin' || effectiveRole === 'super_admin'
    ? { route: 'admin', param: 'apilogs', label: 'Audit Logs' }
    : effectiveRole === 'manager'
    ? { route: 'manager', param: 'tickets', label: 'Escalations' }
    : effectiveRole === 'operator'
    ? isKycApproved
      ? { route: 'operator', param: 'test-payment', label: 'Test Payment' }
      : { route: 'faq', param: '', label: lang === 'hi' ? 'KYC सहायता' : 'KYC Help' }
    : effectiveRole === 'partner'
    ? { route: 'packages', param: '', label: 'Partner Bundles' }
    : effectiveRole === 'business'
    ? isKycApproved
      ? { route: 'services', param: 'b2b-partner', label: 'B2B Services' }
      : { route: 'b2b', param: 'team', label: 'Enterprise Team' }
    : { route: 'services', param: 'personal', label: lang === 'hi' ? 'आवेदन करें' : 'New Application' };

  const headerCta = headerSignatures.has(getNavItemSignature(candidateCta))
    ? { route: 'packages', param: '', label: lang === 'hi' ? 'पैकेज देखें' : 'Browse Bundles' }
    : candidateCta;

  const ctaSignature = getNavItemSignature(headerCta);

  // 3. Role & KYC Filtered Header User Account Dropdown
  // Strictly non-overlapping with headerPrimaryLinks, headerCta, and Desktop Sidebar items
  let rawDropdownItems: ControlledNavItem[] = [];
  if (authed) {
    if (effectiveRole === 'admin' || effectiveRole === 'super_admin') {
      rawDropdownItems = [
        { id: 'dd-adm-apps', label: 'Personal Applications', route: 'dashboard', param: 'applications', iconKey: 'file_check', color: 'text-slate-600' },
        { id: 'dd-adm-alerts', label: 'System Alerts', route: 'dashboard', param: 'notifications', iconKey: 'bell', color: 'text-[#FF671F]' },
      ];
    } else if (effectiveRole === 'manager') {
      rawDropdownItems = [
        { id: 'dd-mgr-apps', label: 'Personal Applications', route: 'dashboard', param: 'applications', iconKey: 'file_check', color: 'text-slate-600' },
        { id: 'dd-mgr-alerts', label: 'Notifications', route: 'dashboard', param: 'notifications', iconKey: 'bell', color: 'text-[#FF671F]' },
      ];
    } else if (effectiveRole === 'operator') {
      rawDropdownItems = [
        { id: 'dd-op-pay', label: 'Payments & Receipts', route: 'dashboard', param: 'payments', iconKey: 'payments', color: 'text-[#138808]', requiredPermissions: ['payments.view'] },
        { id: 'dd-op-usage', label: 'Tool Usage History', route: 'dashboard', param: 'usage-history', iconKey: 'history', color: 'text-indigo-600' },
        { id: 'dd-op-support', label: 'Support Tickets', route: 'dashboard', param: 'support', iconKey: 'headphones', color: 'text-slate-600' },
        { id: 'dd-op-alerts', label: 'Notifications', route: 'dashboard', param: 'notifications', iconKey: 'bell', color: 'text-[#FF671F]' },
      ];
    } else if (effectiveRole === 'partner') {
      // Strictly NO Partner KYC & NO Sandbox Test Payment for Distributor/Partner role
      rawDropdownItems = [
        { id: 'dd-prt-alerts', label: 'Partner Alerts', route: 'partner', param: 'notifications', iconKey: 'bell', color: 'text-[#FF671F]' },
        { id: 'dd-prt-apps', label: 'Personal Applications', route: 'dashboard', param: 'applications', iconKey: 'file_check', color: 'text-[#138808]', requiredPermissions: ['applications.view'] },
        { id: 'dd-prt-vault', label: 'Document Vault', route: 'dashboard', param: 'documents', iconKey: 'folder', color: 'text-blue-600' },
      ];
    } else if (effectiveRole === 'business') {
      rawDropdownItems = [
        ...(isKycApproved
          ? [
              { id: 'dd-b2b-team', label: 'Enterprise Team', route: 'b2b', param: 'team', iconKey: 'partners' as const, color: 'text-blue-600' },
            ]
          : []),
        { id: 'dd-b2b-rem', label: 'Tax & Reminders', route: 'dashboard', param: 'reminders', iconKey: 'calculator', color: 'text-purple-600' },
        { id: 'dd-b2b-sup', label: 'Support Tickets', route: 'dashboard', param: 'support', iconKey: 'headphones', color: 'text-slate-600' },
      ];
    } else {
      // Citizen ('customer') — strictly NO Partner KYC / Operator KYC
      rawDropdownItems = [
        { id: 'dd-cus-alerts', label: 'Notifications', route: 'dashboard', param: 'notifications', iconKey: 'bell', color: 'text-[#FF671F]' },
        { id: 'dd-cus-faq', label: 'Help & FAQs', route: 'faq', iconKey: 'help', color: 'text-slate-600' },
      ];
    }
  }

  const headerExcluded = new Set<string>(headerSignatures);
  headerExcluded.add(ctaSignature);

  const headerDropdownItems = dedupeNavItems(
    rawDropdownItems.filter((item) =>
      itemPermitted(item, user, effectiveRole, effectivePerms, isKycApproved)
    ),
    headerExcluded
  );

  // 4. Sidebar Navigation Groups (Role-Scoped, Permission-Checked, KYC-Gated, Zero Redundancy)
  const usedSignatures = new Set<string>(isMobileDrawer ? [] : headerSignatures);
  if (!isMobileDrawer) {
    usedSignatures.add(ctaSignature);
    headerDropdownItems.forEach((item) => usedSignatures.add(getNavItemSignature(item)));
  }

  const mobilePrimaryItems: ControlledNavItem[] = isMobileDrawer
    ? headerPrimaryLinks.map((link, idx) => {
        usedSignatures.add(getNavItemSignature(link));
        return {
          id: `mob-primary-${idx}`,
          label: link.label,
          labelHi: link.labelHi,
          route: link.route,
          param: link.param,
          iconKey: 'compass',
        };
      })
    : [];

  let roleGroupTitle = 'Citizen Account';
  let roleGroupTitleHi = 'नागरिक खाता';
  let rawRoleWorkspaceItems: ControlledNavItem[] = [];

  if (!authed) {
    roleGroupTitle = 'Account & Onboarding';
    roleGroupTitleHi = 'पोर्टल एक्सेस';
    rawRoleWorkspaceItems = [
      { id: 'guest-dash', label: 'Citizen Login', labelHi: 'नागरिक लॉगिन', route: 'login', iconKey: 'login' },
      { id: 'guest-signup', label: 'Create Account', labelHi: 'नया खाता', route: 'register', iconKey: 'register' },
      { id: 'guest-become-partner', label: 'Become Our Partner', labelHi: 'पार्टनर बनें', route: 'become-partner', iconKey: 'become_partner', badge: 'NEW' },
      { id: 'guest-b2b-signup', label: 'B2B Registration', labelHi: 'B2B पंजीकरण', route: 'register', param: 'business', iconKey: 'b2b' },
    ];
  } else if (effectiveRole === 'admin' || effectiveRole === 'super_admin') {
    roleGroupTitle = 'Admin Operations';
    roleGroupTitleHi = 'एडमिन मॉड्यूल';
    rawRoleWorkspaceItems = [
      { id: 'adm-partners', label: 'Partners & Payouts', labelHi: 'पार्टनर पेआउट', route: 'admin', param: 'partners', iconKey: 'partners', requiredPermissions: ['partners.manage', 'commissions.manage'] },
      { id: 'adm-payments', label: 'Payments & Refunds', labelHi: 'भुगतान व रिफंड', route: 'admin', param: 'payments', iconKey: 'payments', requiredPermissions: ['payments.view'] },
      { id: 'adm-gov', label: 'Governance & SLA', labelHi: 'गवर्नेंस व SLA', route: 'admin', param: 'governance', iconKey: 'shield', requiredPermissions: ['rbac.manage'] },
      { id: 'adm-form', label: 'Form Builder', labelHi: 'फॉर्म बिल्डर', route: 'admin', param: 'formbuilder', iconKey: 'sliders', requiredPermissions: ['services.edit'] },
      { id: 'adm-api', label: 'API Setu Gateway', labelHi: 'API सेतु', route: 'admin', param: 'apisetu', iconKey: 'server', requiredPermissions: ['integrations.manage'] },
      { id: 'adm-apicatalog', label: 'API Catalogue', labelHi: 'API कैटलॉग', route: 'admin', param: 'apicatalogue', iconKey: 'layers', requiredPermissions: ['integrations.manage'] },
      { id: 'adm-blog', label: 'Blog & SEO CMS', labelHi: 'ब्लॉग CMS', route: 'admin', param: 'blog', iconKey: 'blog', requiredPermissions: ['services.edit'] },
      { id: 'adm-perf', label: 'Performance & UX', labelHi: 'परफॉर्मेंस UX', route: 'admin', param: 'performance', iconKey: 'gauge', requiredPermissions: ['settings.manage'] },
      { id: 'adm-infra', label: 'Cloud Infra & R2', labelHi: 'इंफ्रास्ट्रक्चर', route: 'admin', param: 'infrastructure', iconKey: 'cloud', requiredPermissions: ['settings.manage'] },
      { id: 'adm-workspace', label: 'Workspace Hub', labelHi: 'वर्कस्पेस हब', route: 'workspace', iconKey: 'workspace' },
    ];
  } else if (effectiveRole === 'manager') {
    roleGroupTitle = 'Manager Operations';
    roleGroupTitleHi = 'मैनेजर डेस्क';
    rawRoleWorkspaceItems = [
      { id: 'mgr-workspace', label: 'Workspace Hub', labelHi: 'वर्कस्पेस हब', route: 'workspace', iconKey: 'workspace' },
      { id: 'mgr-track', label: 'Track Any Filing', labelHi: 'आवेदन ट्रैक करें', route: 'track', iconKey: 'track' },
      { id: 'mgr-services', label: 'Fee Schedule Catalog', labelHi: 'सेवा शुल्क सूची', route: 'services', iconKey: 'services' },
      { id: 'mgr-blog', label: 'Ops SOP & Blog', labelHi: 'ब्लॉग व गाइड', route: 'blog', iconKey: 'blog' },
    ];
  } else if (effectiveRole === 'operator') {
    roleGroupTitle = 'Operator Desk Tools';
    roleGroupTitleHi = 'ऑपरेटर फील्ड डेस्क';
    rawRoleWorkspaceItems = [
      ...(canSeePartnerKyc
        ? [
            {
              id: 'op-kyc',
              label: 'Operator KYC',
              labelHi: 'ऑपरेटर KYC',
              route: 'operator-enroll',
              iconKey: 'kyc' as const,
              badge: kycStatus,
            },
          ]
        : []),
      {
        id: 'op-test-pay',
        label: 'Test Payment (Sandbox)',
        labelHi: 'सैंडबॉक्स टेस्ट भुगतान',
        route: 'operator',
        param: 'test-payment',
        iconKey: 'sandbox_test',
        badge: 'TEST',
        requiredPermissions: ['payments.view'],
        requiresApprovedKyc: true,
      },
      { id: 'op-photo', label: 'Passport Photo Studio', labelHi: 'पासपोर्ट फोटो स्टूडियो', route: 'tool-detail', param: 'csc-passport-photo-studio', iconKey: 'camera', requiresApprovedKyc: true },
      { id: 'op-resize', label: '20–50KB Sign Resize', labelHi: 'फोटो/हस्ताक्षर रिसाइज़', route: 'tool-detail', param: 'photo-signature-size-reducer', iconKey: 'file_check', requiresApprovedKyc: true },
      { id: 'op-pdf', label: 'PDF KYC Pack Maker', labelHi: 'PDF KYC पैक', route: 'tool-detail', param: 'pdf-document-pack-maker', iconKey: 'file_text', requiresApprovedKyc: true },
      { id: 'op-bill', label: 'CSC Receipt Maker', labelHi: 'CSC रसीद मेकर', route: 'tool-detail', param: 'customer-service-bill-generator', iconKey: 'receipt', requiresApprovedKyc: true },
      { id: 'op-track', label: 'Track Citizen Filing', labelHi: 'आवेदन ट्रैक करें', route: 'track', iconKey: 'track' },
      { id: 'op-apps', label: 'My Personal Filings', labelHi: 'मेरे निजी आवेदन', route: 'dashboard', param: 'applications', iconKey: 'folder', requiredPermissions: ['applications.view'] },
    ];
  } else if (effectiveRole === 'partner') {
    roleGroupTitle = 'Partner Channel';
    roleGroupTitleHi = 'पार्टनर चैनल';
    // Strictly NO Partner KYC and NO Sandbox Test Payment for Distributor/Partner role
    rawRoleWorkspaceItems = [
      { id: 'prt-products', label: 'Digital Kits Store', labelHi: 'डिजिटल किट्स', route: 'products', iconKey: 'products' },
      { id: 'prt-track', label: 'Track Customer Filing', labelHi: 'ग्राहक आवेदन ट्रैक', route: 'track', iconKey: 'track' },
      { id: 'prt-pricing', label: 'Fee Schedule & Margins', labelHi: 'शुल्क विवरण', route: 'pricing', iconKey: 'award' },
      { id: 'prt-support', label: 'Partner Support', labelHi: 'सहायता टिकट', route: 'dashboard', param: 'support', iconKey: 'headphones' },
    ];
  } else if (effectiveRole === 'business') {
    roleGroupTitle = 'Enterprise Account';
    roleGroupTitleHi = 'एंटरप्राइज़ खाता';
    rawRoleWorkspaceItems = [
      ...(canSeePartnerKyc
        ? [
            {
              id: 'b2b-kyc',
              label: 'Partner & B2B KYC',
              labelHi: 'B2B KYC सत्यापन',
              route: 'b2b',
              param: 'kyc',
              iconKey: 'kyc' as const,
              badge: kycStatus,
            },
          ]
        : []),
      { id: 'b2b-vault', label: 'Company Doc Vault', labelHi: 'दस्तावेज़ वॉल्ट', route: 'dashboard', param: 'documents', iconKey: 'folder' },
      { id: 'b2b-billing', label: 'Billing & Invoices', labelHi: 'भुगतान व बिल', route: 'dashboard', param: 'payments', iconKey: 'payments', requiredPermissions: ['payments.view'] },
      { id: 'b2b-packages', label: 'Compliance Bundles', labelHi: 'बिज़नेस पैकेज', route: 'packages', iconKey: 'packages' },
    ];
  } else {
    // Citizen ('customer') — strictly NO Partner KYC or Operator KYC
    roleGroupTitle = 'Citizen Account';
    roleGroupTitleHi = 'नागरिक खाता';
    rawRoleWorkspaceItems = [
      { id: 'cus-drafts', label: 'Saved Drafts', labelHi: 'सेव ड्राफ्ट', route: 'dashboard', param: 'drafts', iconKey: 'save', requiredPermissions: ['applications.create'] },
      { id: 'cus-downloads', label: 'Digital Downloads', labelHi: 'डिजिटल डाउनलोड', route: 'dashboard', param: 'downloads', iconKey: 'download', requiredPermissions: ['applications.view'] },
      { id: 'cus-payments', label: 'Payments & Invoices', labelHi: 'भुगतान व बिल', route: 'dashboard', param: 'payments', iconKey: 'payments', requiredPermissions: ['payments.view'] },
      { id: 'cus-usage', label: 'Tool Usage History', labelHi: 'उपयोग इतिहास', route: 'dashboard', param: 'usage-history', iconKey: 'history' },
      { id: 'cus-tax', label: 'Tax & Reminders', labelHi: 'टैक्स व रिमाइंडर', route: 'dashboard', param: 'reminders', iconKey: 'calculator' },
      { id: 'cus-support', label: 'Support Tickets', labelHi: 'सहायता टिकट', route: 'dashboard', param: 'support', iconKey: 'headphones' },
      { id: 'cus-become-partner', label: 'Become Our Partner', labelHi: 'पार्टनर बनें', route: 'become-partner', iconKey: 'become_partner' },
    ];
  }

  const roleWorkspaceItems = dedupeNavItems(
    rawRoleWorkspaceItems.filter((item) =>
      itemPermitted(item, user, effectiveRole, effectivePerms, isKycApproved)
    ),
    usedSignatures
  );
  roleWorkspaceItems.forEach((i) => usedSignatures.add(getNavItemSignature(i)));

  const rawOversightItems: ControlledNavItem[] =
    effectiveRole === 'admin' || effectiveRole === 'super_admin'
      ? [
          { id: 'ovr-mgr', label: 'Manager SLA Desk', labelHi: 'मैनेजर SLA', route: 'manager', param: 'sla', iconKey: 'briefcase', requiredPermissions: ['operators.assign'] },
          { id: 'ovr-op', label: 'Operator Desk', labelHi: 'ऑपरेटर डेस्क', route: 'operator', param: 'queue', iconKey: 'shield', requiredPermissions: ['applications.process'] },
          { id: 'ovr-prt', label: 'Partner Desk', labelHi: 'पार्टनर डेस्क', route: 'partner', param: 'overview', iconKey: 'partners', requiredPermissions: ['partners.manage'] },
          { id: 'ovr-b2b', label: 'B2B API Portal', labelHi: 'B2B पोर्टल', route: 'b2b', param: 'overview', iconKey: 'b2b', requiredPermissions: ['integrations.manage'] },
        ]
      : [];

  const oversightItems = dedupeNavItems(
    rawOversightItems.filter((item) =>
      itemPermitted(item, user, effectiveRole, effectivePerms, isKycApproved)
    ),
    usedSignatures
  );
  oversightItems.forEach((i) => usedSignatures.add(getNavItemSignature(i)));

  const rawToolItems: ControlledNavItem[] = [
    { id: 'tools-hub', label: '150+ Digital Tools Hub', labelHi: '150+ टूल्स हब', route: 'tools', iconKey: 'tools', badge: '150+' },
    { id: 'tools-csc', label: 'CSC Photo & PDF Tools', labelHi: 'CSC फोटो व PDF टूल्स', route: 'tools', param: 'csc-tools', iconKey: 'file_check' },
    { id: 'tools-ai', label: 'AI Document Studio', labelHi: 'AI दस्तावेज़ स्टूडियो', route: 'tools', param: 'ai-tools', iconKey: 'sparkles' },
    {
      id: 'tools-plans',
      label: '₹10 Pass & Tool Plans',
      labelHi: '₹10 पास व प्लान्स',
      route: 'tool-plans',
      iconKey: 'crown',
      badge: plan === 'free' ? '₹10+' : plan.toUpperCase(),
    },
  ];
  const toolItems = dedupeNavItems(rawToolItems, usedSignatures);
  toolItems.forEach((i) => usedSignatures.add(getNavItemSignature(i)));

  const rawExploreItems: ControlledNavItem[] = [
    { id: 'nav-home', label: 'Home Workspace', labelHi: 'होम पेज', route: 'home', iconKey: 'home' },
    { id: 'nav-services', label: 'All 149+ Services', labelHi: 'सभी सेवाएं', route: 'services', iconKey: 'services' },
    { id: 'nav-verifications', label: 'Instant Verifications', labelHi: 'तत्काल सत्यापन सेवाएं', route: 'verifications', iconKey: 'shield', badge: '13' },
    { id: 'nav-products', label: 'Digital Kits Store', labelHi: 'डिजिटल किट्स', route: 'products', iconKey: 'products' },
    { id: 'nav-packages', label: 'Compliance Bundles', labelHi: 'वैल्यू पैकेज', route: 'packages', iconKey: 'packages' },
    { id: 'nav-track', label: 'Track Application', labelHi: 'आवेदन ट्रैक करें', route: 'track', iconKey: 'track' },
    { id: 'nav-blog', label: 'Blog & Guides', labelHi: 'ब्लॉग व गाइड', route: 'blog', iconKey: 'blog' },
    ...(!isStaffRole
      ? [{ id: 'nav-become-partner', label: 'Become Our Partner', labelHi: 'पार्टनर बनें', route: 'become-partner', iconKey: 'become_partner' as const }]
      : []),
  ];
  const exploreItems = dedupeNavItems(rawExploreItems, usedSignatures);
  exploreItems.forEach((i) => usedSignatures.add(getNavItemSignature(i)));

  const rawSupportItems: ControlledNavItem[] = [
    { id: 'sup-how', label: 'How It Works', labelHi: 'कैसे काम करता है', route: 'how-it-works', iconKey: 'compass' },
    { id: 'sup-pricing', label: 'Transparent Fees', labelHi: 'शुल्क विवरण', route: 'pricing', iconKey: 'award' },
    { id: 'sup-faq', label: 'Help & FAQs', labelHi: 'सहायता FAQ', route: 'faq', iconKey: 'help' },
    { id: 'sup-about', label: 'About Platform', labelHi: 'हमारे बारे में', route: 'about', iconKey: 'info' },
    { id: 'sup-contact', label: 'Contact Desk', labelHi: 'संपर्क करें', route: 'contact', iconKey: 'phone' },
  ];
  const supportItems = dedupeNavItems(rawSupportItems, usedSignatures);

  const mobileBottomItems: ControlledNavItem[] = dedupeNavItems([
    { id: 'mb-home', label: lang === 'hi' ? 'होम' : 'Home', route: 'home', iconKey: 'home' },
    { id: 'mb-services', label: lang === 'hi' ? 'सेवाएं' : 'Services', route: 'services', iconKey: 'services' },
    { id: 'mb-products', label: lang === 'hi' ? 'किट्स' : 'Kits', route: 'products', iconKey: 'products' },
    { id: 'mb-track', label: lang === 'hi' ? 'ट्रैक' : 'Track', route: 'track', iconKey: 'track' },
    {
      id: 'mb-portal',
      label: authed
        ? lang === 'hi'
          ? 'पोर्टल'
          : effectiveRole === 'operator' && !isKycApproved
          ? 'KYC'
          : 'Portal'
        : lang === 'hi'
        ? 'लॉगिन'
        : 'Account',
      route: primaryPortalRoute,
      iconKey: authed ? 'kyc' : 'login',
    },
  ]);

  return {
    effectiveRole,
    accountType,
    kycStatus,
    isKycApproved,
    isStaffRole,
    canSeePartnerKyc,
    primaryPortalRoute,
    primaryPortalLabel,
    headerPrimaryLinks,
    headerDropdownItems,
    headerCta,
    mobileBottomItems,
    sidebar: {
      mobilePrimaryItems,
      roleGroupTitle,
      roleGroupTitleHi,
      roleWorkspaceItems,
      oversightItems,
      toolItems,
      exploreItems,
      supportItems,
    },
  };
}

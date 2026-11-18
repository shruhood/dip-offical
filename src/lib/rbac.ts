import { Application, User, UserRole } from '../types';

export type PermissionCode =
  | 'applications.view'
  | 'applications.create'
  | 'applications.assign'
  | 'applications.process'
  | 'applications.verify_documents'
  | 'applications.request_correction'
  | 'applications.complete'
  | 'applications.cancel'
  | 'services.create'
  | 'services.edit'
  | 'services.publish'
  | 'users.manage'
  | 'operators.assign'
  | 'partners.manage'
  | 'payments.view'
  | 'payments.refund'
  | 'commissions.manage'
  | 'reports.view'
  | 'settings.manage'
  | 'audit_logs.view'
  | 'rbac.manage'
  | 'integrations.manage';

export const ALL_PERMISSIONS: { code: PermissionCode; label: string; group: string }[] = [
  { code: 'applications.view', label: 'View Applications', group: 'Applications' },
  { code: 'applications.create', label: 'Create / Assisted File Applications', group: 'Applications' },
  { code: 'applications.assign', label: 'Assign & Reassign Operators', group: 'Applications' },
  { code: 'applications.process', label: 'Process & Advance Workflow Status', group: 'Applications' },
  { code: 'applications.verify_documents', label: 'Verify / Reject Documents', group: 'Applications' },
  { code: 'applications.request_correction', label: 'Request Document Corrections', group: 'Applications' },
  { code: 'applications.complete', label: 'Complete & Upload Deliverables', group: 'Applications' },
  { code: 'applications.cancel', label: 'Cancel Applications', group: 'Applications' },
  { code: 'services.create', label: 'Create Dynamic Services', group: 'Services & Forms' },
  { code: 'services.edit', label: 'Edit Services & Form Versions', group: 'Services & Forms' },
  { code: 'services.publish', label: 'Publish / Unpublish Services', group: 'Services & Forms' },
  { code: 'users.manage', label: 'Manage Users & Profiles', group: 'Governance' },
  { code: 'operators.assign', label: 'Manage Operators & KYC Reviews', group: 'Governance' },
  { code: 'partners.manage', label: 'Approve & Monitor Partners', group: 'Partners' },
  { code: 'commissions.manage', label: 'Manage Commissions & Settlements', group: 'Finance' },
  { code: 'payments.view', label: 'View Payments & Invoices', group: 'Finance' },
  { code: 'payments.refund', label: 'Process Refunds', group: 'Finance' },
  { code: 'reports.view', label: 'View Operational & Revenue Reports', group: 'Analytics' },
  { code: 'settings.manage', label: 'Manage Global Business & GST Settings', group: 'Administration' },
  { code: 'audit_logs.view', label: 'View Security Audit Logs', group: 'Administration' },
  { code: 'rbac.manage', label: 'Configure Role Permissions', group: 'Administration' },
  { code: 'integrations.manage', label: 'Configure Cashfree, DigiLocker & Messaging', group: 'Administration' },
];

export type RolePermissionMap = Record<string, PermissionCode[]>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMap = {
  super_admin: ALL_PERMISSIONS.map((p) => p.code),
  admin: ALL_PERMISSIONS.map((p) => p.code),
  manager: [
    'applications.view',
    'applications.create',
    'applications.assign',
    'applications.process',
    'applications.verify_documents',
    'applications.request_correction',
    'applications.complete',
    'operators.assign',
    'partners.manage',
    'payments.view',
    'reports.view',
  ],
  operator: [
    'applications.view',
    'applications.create',
    'applications.process',
    'applications.verify_documents',
    'applications.request_correction',
    'applications.complete',
    'payments.view',
  ],
  partner: [
    'applications.view',
    'applications.create',
    'applications.request_correction',
    'payments.view',
    'reports.view',
  ],
  customer: ['applications.view', 'applications.create', 'applications.request_correction', 'payments.view'],
  business: ['applications.view', 'applications.create', 'payments.view', 'reports.view'],
};

export function normalizeRole(role?: string | null): UserRole {
  if (!role) return 'customer';
  const r = role.toLowerCase().trim();
  if (r === 'super_admin' || r === 'superadmin') return 'super_admin';
  if (r === 'admin') return 'admin';
  if (r === 'manager') return 'manager';
  if (r === 'operator') return 'operator';
  if (r === 'partner' || r === 'agent') return 'partner';
  if (r === 'business' || r === 'b2b') return 'business';
  return 'customer';
}

export function isSuperAdminRole(role?: string | null): boolean {
  const n = normalizeRole(role);
  return n === 'super_admin' || n === 'admin';
}

export function getPermissionsForRole(
  role: UserRole,
  customMatrix?: RolePermissionMap
): PermissionCode[] {
  const normalized = normalizeRole(role);
  if (isSuperAdminRole(normalized)) {
    return ALL_PERMISSIONS.map((p) => p.code);
  }
  if (customMatrix && customMatrix[normalized]) {
    return customMatrix[normalized];
  }
  return DEFAULT_ROLE_PERMISSIONS[normalized] || DEFAULT_ROLE_PERMISSIONS.customer;
}

export function hasPermission(
  user: Pick<User, 'role' | 'permissions'> | null | undefined,
  permission: PermissionCode,
  customMatrix?: RolePermissionMap
): boolean {
  if (!user) return false;
  if (isSuperAdminRole(user.role)) return true;
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.includes(permission);
  }
  return getPermissionsForRole(user.role, customMatrix).includes(permission);
}

export function getEffectiveUserRole(
  user?: Pick<User, 'role' | 'accountType'> | null
): UserRole {
  if (!user) return 'customer';
  const normalized = normalizeRole(user.role);
  if (normalized !== 'customer') return normalized;
  if (user.accountType === 'partner') return 'partner';
  if (user.accountType === 'operator') return 'operator';
  if (user.accountType === 'business') return 'business';
  return 'customer';
}

export function getHomeRouteForRole(role?: UserRole | null, accountType?: string, kycStatus?: string): string {
  const normalized = normalizeRole(role);
  if (isSuperAdminRole(normalized)) return 'admin';
  if (normalized === 'manager') return 'manager';
  if (normalized === 'operator') return 'operator';
  if (normalized === 'partner') return 'partner';
  if (normalized === 'business') return 'b2b';
  if (accountType === 'operator' && kycStatus !== 'Approved') return 'operator-enroll';
  if (accountType === 'partner') return 'partner';
  if (accountType === 'business') return 'b2b';
  return 'dashboard';
}

export function canAccessApplication(
  user: Pick<User, 'id' | 'email' | 'role' | 'partnerId' | 'businessId'> | null | undefined,
  app: Pick<Application, 'userId' | 'userEmail' | 'assignedOperatorId' | 'collectedByUid' | 'partnerId' | 'businessId'>
): boolean {
  if (!user) return false;
  const normalized = normalizeRole(user.role);
  if (isSuperAdminRole(normalized) || normalized === 'manager') return true;
  if (normalized === 'operator') {
    return (
      app.assignedOperatorId === user.id ||
      app.collectedByUid === user.id ||
      app.userId === user.id
    );
  }
  if (normalized === 'partner') {
    return (
      (!!user.partnerId && app.partnerId === user.partnerId) ||
      app.collectedByUid === user.id ||
      app.userId === user.id
    );
  }
  if (normalized === 'business') {
    return (
      (!!user.businessId && app.businessId === user.businessId) ||
      app.userId === user.id
    );
  }
  return (
    app.userId === user.id ||
    (!!user.email && !!app.userEmail && app.userEmail.toLowerCase() === user.email.toLowerCase())
  );
}

export interface RoleNavLink {
  label: string;
  labelHi: string;
  route: string;
  param?: string;
}

export function getUniqueRoleNavLinks(
  role?: UserRole | null,
  isAuthenticated: boolean = false
): RoleNavLink[] {
  if (!isAuthenticated || !role) {
    return [
      { label: 'Home', labelHi: 'होम', route: 'home' },
      { label: 'Services', labelHi: 'सेवाएं', route: 'services' },
      { label: 'Blog & Guides', labelHi: 'ब्लॉग और गाइड', route: 'blog' },
      { label: 'Track Status', labelHi: 'स्थिति ट्रैक', route: 'track' },
      { label: 'Become Partner', labelHi: 'पार्टनर बनें', route: 'become-partner' },
    ];
  }

  const normalized = normalizeRole(role);

  if (normalized === 'super_admin' || normalized === 'admin') {
    return [
      { label: 'Admin Overview', labelHi: 'एडमिन अवलोकन', route: 'admin', param: 'overview' },
      { label: 'Applications', labelHi: 'आवेदन', route: 'admin', param: 'applications' },
      { label: 'Catalog & Forms', labelHi: 'सेवा और फॉर्म', route: 'admin', param: 'services' },
      { label: 'Operators & KYC', labelHi: 'ऑपरेटर KYC', route: 'admin', param: 'operators' },
      { label: 'Settings & Tax', labelHi: 'सेटिंग्स व टैक्स', route: 'admin', param: 'settings' },
    ];
  }

  if (normalized === 'manager') {
    return [
      { label: 'SLA Queue', labelHi: 'SLA कतार', route: 'manager', param: 'sla' },
      { label: 'Team Allocation', labelHi: 'टीम आवंटन', route: 'manager', param: 'assign' },
      { label: 'Operator Desk', labelHi: 'ऑपरेटर डेस्क', route: 'operator', param: 'queue' },
      { label: 'Partner Oversight', labelHi: 'पार्टनर निगरानी', route: 'manager', param: 'partners' },
      { label: 'Reports', labelHi: 'रिपोर्ट्स', route: 'manager', param: 'reports' },
    ];
  }

  if (normalized === 'operator') {
    return [
      { label: 'Operator Desk', labelHi: 'ऑपरेटर डेस्क', route: 'operator', param: 'queue' },
      { label: 'Walk-In Intake', labelHi: 'वॉक-इन आवेदन', route: 'operator', param: 'intake' },
      { label: 'My KYC', labelHi: 'मेरा KYC', route: 'operator-enroll' },
      { label: 'Services', labelHi: 'सेवाएं', route: 'services' },
      { label: 'Workspace', labelHi: 'वर्कस्पेस', route: 'workspace' },
    ];
  }

  if (normalized === 'partner') {
    return [
      { label: 'Partner Desk', labelHi: 'पार्टनर डेस्क', route: 'partner', param: 'overview' },
      { label: 'My Customers', labelHi: 'मेरे ग्राहक', route: 'partner', param: 'customers' },
      { label: 'Assisted Filings', labelHi: 'सहायक आवेदन', route: 'partner', param: 'applications' },
      { label: 'Payout Wallet', labelHi: 'कमीशन वॉलेट', route: 'partner', param: 'wallet' },
      { label: 'Services', labelHi: 'सेवाएं', route: 'services' },
    ];
  }

  if (normalized === 'business') {
    return [
      { label: 'B2B Console', labelHi: 'B2B कंसोल', route: 'b2b', param: 'overview' },
      { label: 'API Playground', labelHi: 'API प्लेग्राउंड', route: 'b2b', param: 'playground' },
      { label: 'Bulk Verify', labelHi: 'बल्क वेरिफिकेशन', route: 'b2b', param: 'bulk' },
      { label: 'API Keys', labelHi: 'API कुंजी', route: 'b2b', param: 'apikeys' },
      { label: 'Audit Logs', labelHi: 'ऑडिट लॉग', route: 'b2b', param: 'history' },
    ];
  }

  // Default Citizen ('customer')
  return [
    { label: 'My Dashboard', labelHi: 'मेरा डैशबोर्ड', route: 'dashboard', param: 'overview' },
    { label: 'Services', labelHi: 'सेवाएं', route: 'services' },
    { label: 'My Applications', labelHi: 'मेरे आवेदन', route: 'dashboard', param: 'applications' },
    { label: 'Doc Vault', labelHi: 'दस्तावेज़ वॉल्ट', route: 'dashboard', param: 'documents' },
    { label: 'Track & Help', labelHi: 'ट्रैक और मदद', route: 'track' },
  ];
}

const DEFAULT_ROUTE_PARAMS: Record<string, string> = {
  admin: 'overview',
  dashboard: 'overview',
  partner: 'overview',
  b2b: 'overview',
  operator: 'queue',
  manager: 'sla',
};

export function getNavItemSignature(item: { route: string; param?: string }): string {
  const cleanRoute = String(item.route || '').trim();
  const cleanParam = String(item.param || '').trim();
  const defaultParam = DEFAULT_ROUTE_PARAMS[cleanRoute];
  const effectiveParam =
    cleanParam && cleanParam !== 'all'
      ? cleanParam
      : defaultParam || '';
  return `${cleanRoute}:${effectiveParam}`;
}

export function dedupeNavItems<T extends { route: string; param?: string }>(
  items: T[],
  excludedSignatures: Set<string> = new Set()
): T[] {
  const seen = new Set<string>(excludedSignatures);
  const out: T[] = [];
  for (const item of items) {
    const sig = getNavItemSignature(item);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(item);
  }
  return out;
}


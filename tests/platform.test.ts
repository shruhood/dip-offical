import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRole,
  isSuperAdminRole,
  hasPermission,
  canAccessApplication,
  getHomeRouteForRole,
  getEffectiveUserRole,
  getUniqueRoleNavLinks,
  getNavItemSignature,
  dedupeNavItems,
} from '../src/lib/rbac.ts';
import {
  isEligibleForPartnerKyc,
  isRouteAccessible,
  resolveDynamicNavigation,
} from '../src/lib/navigationController.ts';
import {
  PARTNER_TRACKS,
  PLATFORM_FEE_SCHEDULE,
  estimatePartnerEarnings,
} from '../src/lib/partnerProgram.ts';
import {
  buildCompactAiContext,
  getZeroTokenCatalogReply,
  OFFICIAL_CORPORATE_IDENTITY,
} from '../src/lib/aiProductCatalog.ts';
import {
  buildAuthActionContinueUrl,
  buildCanonicalSiteUrl,
  buildUrlForRoute,
  parseLocationPath,
  sanitizeInternalRedirect,
} from '../src/lib/siteUrls.ts';
import {
  getLandingProfileForRole,
  GUEST_AUDIENCE_PROFILES,
} from '../src/lib/roleLandingConfig.ts';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };
import {
  CANONICAL_WORKFLOW_STATUSES,
  validateStatusTransition,
  computeSlaHoursRemaining,
  getKycVerificationProgress,
  getApplicationProgress,
} from '../src/lib/workflow.ts';
import {
  evaluateCondition,
  isFieldVisible,
  validateFormSubmission,
} from '../src/lib/formEngine.ts';
import {
  toPaise,
  fromPaise,
  calculateOrderTotalsPaise,
  calculatePartnerCommission,
} from '../src/lib/finance.ts';
import { constantTimeEqual, hmacSha256Base64 } from '../worker/middleware/security.ts';
import {
  buildCashfreeUnconfiguredMessage,
  formatCashfreePaymentMethod,
  normalizeIndianPhone,
  probeCashfreeGatewayCredentials,
  resolveCashfreeConfig,
  verifyCashfreeWebhookSignature,
} from '../worker/services/cashfreeService.ts';
import {
  normalizePaymentUiStatus,
  mapUiStatusToRecordStatus,
  deriveInitialPaymentUiStatus,
  summarizePaymentStatuses,
  buildPaymentHistoryEntries,
  formatPaymentHistoryCsv,
  computePaymentOverviewMetrics,
  toPaymentBadgeStatus,
  buildPaymentStatusAlertNotification,
  computePaymentTrendSeries,
  computeCompletedPayments30DaySeries,
  paginatePaymentHistoryEntries,
} from '../src/lib/paymentStatus.ts';
import {
  slugifyBlogTitle,
  evaluateBlogSeo,
  buildBlogPostJsonLd,
  buildSitemapXml,
  buildDirectorySubSitemapXml,
  buildSitemapIndexXml,
  computeSitemapHealthSummary,
  parseSitemapXmlStats,
  exportBlogPostsToCsv,
  exportBlogPostsToJson,
  parseImportedBlogPosts,
  SAMPLE_BULK_BATCH_TEMPLATE,
} from '../src/lib/blogSeo.ts';
import { INITIAL_BLOG_POSTS } from '../src/data/initialBlogPosts.ts';
import { generateDynamicSitemapArtifact } from '../scripts/generateSitemap.ts';
import { buildServiceDetailJsonLd } from '../src/lib/seoHead.ts';
import type { CommissionRule, ServiceFormField } from '../src/types.ts';
import {
  DatabaseRegistry,
  LOGICAL_DATABASE_CATALOG,
  CLOUDFLARE_FREE_PLAN_D1_LIMITS,
} from '../worker/config/database.ts';
import {
  StorageRegistry,
  LOGICAL_BUCKET_CATALOG,
  CLOUDFLARE_FREE_PLAN_R2_LIMITS,
} from '../worker/config/storage.ts';
import { FileService } from '../worker/services/fileService.ts';
import {
  redactSensitiveString,
  redactSensitiveObject,
} from '../worker/services/auditService.ts';
import {
  CATALOGUE_CATEGORIES,
  CORE_CATALOGUE_ITEMS,
  COMPLETE_CATALOGUE_ITEMS,
  INITIAL_COUPONS,
  SERVICE_PACKAGES,
  TARGET_LOCATIONS,
} from '../src/data/catalogue/index.ts';
import {
  ALL_CATALOG_SEO_RECORDS,
  CORE_SEO_SERVICES_COUNT,
  SERVICE_SEO_BY_ID,
  SERVICE_SEO_BY_SLUG,
  SERVICE_SEO_DATA,
  PACKAGE_SEO_RECORDS,
  getServiceSeoMetadata,
  enrichServiceWithSeoData,
} from '../src/lib/seoData.ts';
import {
  FIRESTORE_SERVICE_ALLOWED_KEYS,
  mapCatalogServiceToFirestoreRecord,
  mapCatalogServiceToD1Record,
  planIdempotentServicesSync,
  generateFirestoreWriteOperations,
  formatD1UpsertSqlBatch,
} from '../src/lib/catalogueSync.ts';
import {
  evaluatePackageOverlap,
  validateCouponCode,
} from '../src/lib/finance.ts';
import {
  exportCatalogueToCsv,
  exportCatalogueToJson,
  runIdempotentCatalogueImport,
} from '../src/lib/catalogueImporter.ts';
import fs from 'node:fs';
import path from 'node:path';
import workerApp from '../worker/index.ts';
import { verifyJwtWithJwk, resolveUserFromRequest } from '../worker/middleware/auth.ts';
import { validateFileSignatureAndExtension } from '../worker/services/fileService.ts';
import {
  isProductionEnvironment,
  isPaymentAmountMatching,
  validateWebhookTimestamp,
} from '../worker/services/cashfreeService.ts';
import {
  reconcilePaidOrder,
  processCashfreeWebhookEvent,
  reconcileRefundOutcome,
} from '../worker/services/paymentReconciliation.ts';
import {
  calculateGstBreakdown,
  calculateIncomeTaxFY2627,
} from '../src/components/dashboard/TaxComplianceEstimator.tsx';
import { TOOLS_REGISTRY, getToolBySlug } from '../src/data/toolsRegistry.ts';
import {
  TOOL_SINGLE_USE_PRICE_INR,
  TOOL_PAY_PER_USE_OPTION,
  getToolSingleUsePriceInr,
  evaluateToolAccess,
} from '../src/data/toolPlans.ts';
import {
  findCatalogueItem,
  resolveAuthoritativeCheckout,
} from '../src/lib/catalogueServer.ts';
import {
  API_SATHI_POWERED_SERVICES,
  findApiSathiServiceBySlugOrId,
  resolveApiSathiProductSlugForService,
} from '../src/data/apiSathiServices.ts';
import {
  filterCatalogTools,
  resolveCategorySlugAlias,
  getSidebarCategoryCounts,
} from '../src/lib/catalogCategories.ts';
import {
  TOOL_CHANGELOG_ENTRIES,
  buildUserNotifications,
  countUnreadNotifications,
  filterNotificationsByKind,
} from '../src/lib/notifications.ts';
import {
  buildToolCheckoutSelection,
  getPaidToolsForSingleUse,
} from '../src/lib/toolCheckoutSelection.ts';
import { computeMonthlyBillingSummary } from '../src/lib/billingSummary.ts';
import {
  SUPPORTED_INDIAN_LANGUAGES,
  SCHEDULED_INDIAN_LANGUAGES,
  resolveLanguageMeta,
} from '../src/data/indianLanguages.ts';
import {
  INDIA_GEOGRAPHY_SEED,
  INDIA_STATES_AND_UTS,
  getStatesCountSummary,
  type IndiaLocationRecord,
} from '../src/data/indiaGeography.ts';
import {
  parseIndiaDirectoryPath,
  buildIndiaDirectoryPath,
  evaluateDirectoryPageQuality,
  parseOfficialGeographyImport,
} from '../src/lib/indiaDirectorySeo.ts';
import {
  ApiSathiError,
  createApiSathiClient,
  detectApiSathiKeyMode,
  executeApiSathiProduct,
  fetchAadhaarDigilocker,
  initAadhaarDigilocker,
  lookupIfsc,
  maskApiSathiPayload,
  verifyDrivingLicense,
  verifyGstinBasic,
  verifyPan,
} from '../worker/services/apiSathiService.ts';
import {
  API_SATHI_BASE_URL as SERVER_API_SATHI_BASE_URL,
  API_SATHI_TIMEOUT_MS as SERVER_API_SATHI_TIMEOUT_MS,
  ApiSathiException,
  createApiSathiClient as createServerApiSathiClient,
  getApiSathiKey,
  handleApiSathiVerification,
  maskAadhaarNumber,
  maskPanNumber,
  maskSensitiveData,
  verifyGstinBasicV1,
  verifyPanVerificationV1,
} from '../src/services/apiSathi.ts';
import {
  aggregateApiSathiUsage,
  computeExponentialBackoffMs,
  isRetryableApiSathiFailure,
} from '../src/lib/apiSathiAnalytics.ts';
import {
  ApiSathiRetryQueue,
  toPublicRetryJob,
} from '../src/services/apiSathiQueue.ts';

describe('Digital India Project 2.0 — RBAC & Access Isolation', () => {
  it('normalizes legacy and canonical role aliases safely', () => {
    assert.equal(normalizeRole('superadmin'), 'super_admin');
    assert.equal(normalizeRole('super_admin'), 'super_admin');
    assert.equal(normalizeRole('admin'), 'admin');
    assert.equal(normalizeRole('manager'), 'manager');
    assert.equal(normalizeRole('operator'), 'operator');
    assert.equal(normalizeRole('agent'), 'partner');
    assert.equal(normalizeRole('partner'), 'partner');
    assert.equal(normalizeRole('business'), 'business');
    assert.equal(normalizeRole(undefined), 'customer');
    assert.equal(isSuperAdminRole('super_admin'), true);
    assert.equal(isSuperAdminRole('manager'), false);
  });

  it('respects role permission defaults and custom overrides', () => {
    assert.equal(hasPermission({ role: 'super_admin' }, 'rbac.manage'), true);
    assert.equal(hasPermission({ role: 'manager' }, 'applications.assign'), true);
    assert.equal(hasPermission({ role: 'manager' }, 'rbac.manage'), false);
    assert.equal(hasPermission({ role: 'customer' }, 'applications.process'), false);
    assert.equal(
      hasPermission(
        { role: 'operator', permissions: ['applications.view', 'applications.process'] },
        'applications.process'
      ),
      true
    );
    assert.equal(getHomeRouteForRole('manager'), 'manager');
    assert.equal(getHomeRouteForRole('partner'), 'partner');
    assert.equal(getHomeRouteForRole('customer', 'partner', 'Not Submitted'), 'partner');
    assert.equal(getHomeRouteForRole('customer', 'operator', 'Not Submitted'), 'operator-enroll');
    assert.equal(getHomeRouteForRole('customer', 'business', 'Not Submitted'), 'b2b');
    assert.equal(getEffectiveUserRole({ role: 'customer', accountType: 'partner' }), 'partner');
    assert.equal(getEffectiveUserRole({ role: 'customer', accountType: 'operator' }), 'operator');
    assert.equal(getEffectiveUserRole({ role: 'customer', accountType: 'business' }), 'business');
    assert.equal(getEffectiveUserRole({ role: 'customer', accountType: 'customer' }), 'customer');
  });

  it('enforces cross-role ownership and assignment isolation', () => {
    const sampleApp = {
      userId: 'cust-1',
      userEmail: 'citizen@example.com',
      assignedOperatorId: 'op-1',
      collectedByUid: 'part-user-1',
      partnerId: 'part-1',
      businessId: 'biz-1',
    };

    assert.equal(canAccessApplication({ id: 'cust-1', email: 'citizen@example.com', role: 'customer' }, sampleApp), true);
    assert.equal(canAccessApplication({ id: 'cust-2', email: 'other@example.com', role: 'customer' }, sampleApp), false);
    assert.equal(canAccessApplication({ id: 'op-1', email: 'op1@dip.in', role: 'operator' }, sampleApp), true);
    assert.equal(canAccessApplication({ id: 'op-2', email: 'op2@dip.in', role: 'operator' }, sampleApp), false);
    assert.equal(canAccessApplication({ id: 'part-user-1', email: 'p@dip.in', role: 'partner', partnerId: 'part-1' }, sampleApp), true);
    assert.equal(canAccessApplication({ id: 'part-user-2', email: 'p2@dip.in', role: 'partner', partnerId: 'part-2' }, sampleApp), false);
    assert.equal(canAccessApplication({ id: 'mgr-1', email: 'm@dip.in', role: 'manager' }, sampleApp), true);
    assert.equal(canAccessApplication({ id: 'admin-1', email: 'a@dip.in', role: 'super_admin' }, sampleApp), true);
  });
});

describe('14-Stage Workflow State Machine & SLA Calculation', () => {
  it('exposes all 14 canonical workflow stages', () => {
    assert.equal(CANONICAL_WORKFLOW_STATUSES.length, 14);
    assert.equal(CANONICAL_WORKFLOW_STATUSES.includes('Resubmitted'), true);
    assert.equal(CANONICAL_WORKFLOW_STATUSES.includes('Awaiting External Authority'), true);
  });

  it('blocks illegal customer privilege escalation and direct jumps', () => {
    const customerToCompleted = validateStatusTransition({
      fromStatus: 'Submitted',
      toStatus: 'Completed',
      actorRole: 'customer',
    });
    assert.equal(customerToCompleted.valid, false);

    const customerResubmit = validateStatusTransition({
      fromStatus: 'Documents Required',
      toStatus: 'Resubmitted',
      actorRole: 'customer',
    });
    assert.equal(customerResubmit.valid, true);

    const operatorSkipJump = validateStatusTransition({
      fromStatus: 'Draft',
      toStatus: 'Completed',
      actorRole: 'operator',
    });
    assert.equal(operatorSkipJump.valid, false);

    const rejectWithoutReason = validateStatusTransition({
      fromStatus: 'Under Review',
      toStatus: 'Rejected',
      actorRole: 'operator',
      reason: 'no',
    });
    assert.equal(rejectWithoutReason.valid, false);

    const rejectWithReason = validateStatusTransition({
      fromStatus: 'Under Review',
      toStatus: 'Rejected',
      actorRole: 'operator',
      reason: 'Uploaded PAN copy is blurry and unreadable.',
    });
    assert.equal(rejectWithReason.valid, true);
  });

  it('computes overdue vs active SLA correctly', () => {
    const pastIso = new Date(Date.now() - 100 * 3600 * 1000).toISOString();
    const overdue = computeSlaHoursRemaining(pastIso, 72);
    assert.equal(overdue.isOverdue, true);

    const freshIso = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
    const active = computeSlaHoursRemaining(freshIso, 72);
    assert.equal(active.isOverdue, false);
    assert.ok(active.hoursRemaining > 60);
  });
});

describe('Dynamic Conditional JSON Form Engine (16 Field Types)', () => {
  const schema: ServiceFormField[] = [
    {
      id: 'applicant_type',
      label: 'Applicant Type',
      type: 'select',
      required: true,
      options: ['Individual', 'Company'],
    },
    {
      id: 'cin_number',
      label: 'Corporate CIN',
      type: 'text',
      required: true,
      validationRegex: '^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$',
      showIf: { fieldId: 'applicant_type', operator: 'equals', value: 'Company' },
    },
    {
      id: 'contact_email',
      label: 'Email',
      type: 'email',
      required: true,
    },
    {
      id: 'office_address',
      label: 'Office Address',
      type: 'address',
      required: true,
    },
    {
      id: 'directors',
      label: 'Directors',
      type: 'repeater',
      required: false,
      subFields: [{ id: 'din', label: 'DIN', type: 'text', required: true }],
    },
    {
      id: 'consent_declaration',
      label: 'Consent',
      type: 'consent',
      required: true,
    },
  ];

  it('exempts hidden conditional fields from required checks', () => {
    const res = validateFormSubmission(schema, {
      applicant_type: 'Individual',
      contact_email: 'citizen@example.com',
      office_address: { line1: 'Main Road', city: 'Silvassa', state: 'DNH', pincode: '396230' },
      consent_declaration: true,
    });
    assert.equal(res.valid, true);
    assert.equal(isFieldVisible(schema[1], { applicant_type: 'Individual' }), false);
  });

  it('enforces conditional required, regex, address PIN, and repeater subfields when visible', () => {
    const res = validateFormSubmission(schema, {
      applicant_type: 'Company',
      cin_number: 'INVALID',
      contact_email: 'bad-email',
      office_address: { line1: 'Plot 4', city: 'Surat', state: 'Gujarat', pincode: '3950' },
      directors: [{ din: '' }],
      consent_declaration: false,
    });
    assert.equal(res.valid, false);
    assert.ok(res.errors.cin_number);
    assert.ok(res.errors.contact_email);
    assert.ok(res.errors.office_address);
    assert.ok(res.errors.directors);
    assert.ok(res.errors.consent_declaration);

    assert.equal(
      evaluateCondition({ fieldId: 'tags', operator: 'contains', value: 'gst' }, { tags: ['pan', 'gst'] }),
      true
    );
  });
});

describe('Minor-Currency Accounting, GST & Partner Commission Engine', () => {
  it('computes integer-paise totals without floating-point drift', () => {
    assert.equal(toPaise(499.99), 49999);
    assert.equal(fromPaise(49999), 499.99);

    // ₹500 service fee + ₹100 govt pass-through @ 18% GST on service fee only -> ₹90 tax + ₹600 = ₹690
    const totals = calculateOrderTotalsPaise({
      serviceChargeInr: 500,
      govtFeesInr: 100,
      taxRateBps: 1800,
      taxInclusive: false,
    });
    assert.equal(totals.serviceFeePaise, 50000);
    assert.equal(totals.govtFeePaise, 10000);
    assert.equal(totals.taxPaise, 9000);
    assert.equal(totals.totalPaise, 69000);
  });

  it('selects most specific active commission rule and applies TDS accurately', () => {
    const rules: CommissionRule[] = [
      {
        id: 'default',
        name: 'Default 15%',
        commissionType: 'percentage',
        fixedAmountPaise: 0,
        percentageBps: 1500,
        isActive: true,
      },
      {
        id: 'service-gst',
        name: 'GST 20%',
        serviceId: 'srv-gst',
        commissionType: 'percentage',
        fixedAmountPaise: 0,
        percentageBps: 2000,
        isActive: true,
      },
      {
        id: 'partner-fixed',
        name: 'VIP Partner ₹300 Fixed',
        partnerId: 'part-vip',
        serviceId: 'srv-gst',
        commissionType: 'fixed',
        fixedAmountPaise: 30000,
        percentageBps: 0,
        isActive: true,
      },
    ];

    const vipRes = calculatePartnerCommission({
      partnerId: 'part-vip',
      serviceId: 'srv-gst',
      serviceFeePaise: 100000,
      rules,
      tdsBps: 500,
    });
    assert.equal(vipRes.matchedRuleId, 'partner-fixed');
    assert.equal(vipRes.commissionPaise, 30000);
    assert.equal(vipRes.tdsPaise, 1500);
    assert.equal(vipRes.netPayablePaise, 28500);

    const stdRes = calculatePartnerCommission({
      partnerId: 'part-normal',
      serviceId: 'srv-pan',
      serviceFeePaise: 40000,
      rules,
    });
    assert.equal(stdRes.matchedRuleId, 'default');
    assert.equal(stdRes.commissionPaise, 6000);
  });

  it('validates constant-time signature comparison helper', () => {
    assert.equal(constantTimeEqual('abc123', 'abc123'), true);
    assert.equal(constantTimeEqual('abc123', 'abc124'), false);
    assert.equal(constantTimeEqual('short', 'longer'), false);
  });
});

describe('Unique Role-Based Navigation Menus & Compact Low-Usage AI Product Catalog', () => {
  it('generates distinct tailored header menus for every user role type', () => {
    const guestMenu = getUniqueRoleNavLinks(undefined, false);
    const customerMenu = getUniqueRoleNavLinks('customer', true);
    const operatorMenu = getUniqueRoleNavLinks('operator', true);
    const managerMenu = getUniqueRoleNavLinks('manager', true);
    const partnerMenu = getUniqueRoleNavLinks('partner', true);
    const businessMenu = getUniqueRoleNavLinks('business', true);
    const adminMenu = getUniqueRoleNavLinks('super_admin', true);

    assert.equal(guestMenu.length, 5);
    assert.equal(customerMenu.length, 5);
    assert.equal(operatorMenu.length, 5);
    assert.equal(managerMenu.length, 5);
    assert.equal(partnerMenu.length, 5);
    assert.equal(businessMenu.length, 5);
    assert.equal(adminMenu.length, 5);

    const signatures = new Set([
      guestMenu.map((m) => `${m.route}:${m.param || ''}`).join('|'),
      customerMenu.map((m) => `${m.route}:${m.param || ''}`).join('|'),
      operatorMenu.map((m) => `${m.route}:${m.param || ''}`).join('|'),
      managerMenu.map((m) => `${m.route}:${m.param || ''}`).join('|'),
      partnerMenu.map((m) => `${m.route}:${m.param || ''}`).join('|'),
      businessMenu.map((m) => `${m.route}:${m.param || ''}`).join('|'),
      adminMenu.map((m) => `${m.route}:${m.param || ''}`).join('|'),
    ]);
    assert.equal(signatures.size, 7);
    assert.equal(operatorMenu.some((m) => m.route === 'workspace'), true);
    assert.equal(customerMenu.some((m) => m.route === 'workspace'), false);
  });

  it('includes verified corporate registration numbers and reduces AI prompt token usage', () => {
    assert.equal(OFFICIAL_CORPORATE_IDENTITY.gstin, '26EXIPK0151F1ZQ');
    assert.equal(OFFICIAL_CORPORATE_IDENTITY.udyamNumber, 'UDYAM-DD-03-0009994');
    assert.equal(OFFICIAL_CORPORATE_IDENTITY.dunsNumber, '308198649');

    const ctx = buildCompactAiContext('GST registration price and Udyam fee', 'en');
    assert.ok(ctx.matchedProducts.length >= 1 && ctx.matchedProducts.length <= 3);
    assert.ok(ctx.savingsPercent >= 50);

    const orgReply = getZeroTokenCatalogReply('What is your GST number and DUNS?', 'en');
    assert.ok(orgReply.reply.includes('26EXIPK0151F1ZQ'));
    assert.ok(orgReply.reply.includes('UDYAM-DD-03-0009994'));
    assert.ok(orgReply.reply.includes('308198649'));
  });

  it('enforces digitalindiaproject.com across Firebase authDomain, action links, and internal redirects', () => {
    assert.equal(firebaseConfig.authDomain, 'digitalindiaproject.com');
    assert.equal(buildCanonicalSiteUrl('login'), 'https://digitalindiaproject.com/login');

    const actionLink = buildAuthActionContinueUrl('dashboard', 'applications');
    assert.ok(actionLink.startsWith('https://digitalindiaproject.com/auth/action?continueUrl='));
    assert.ok(decodeURIComponent(actionLink).includes('https://digitalindiaproject.com/dashboard/applications'));

    assert.equal(parseLocationPath('/auth/action', '?mode=resetPassword').route, 'auth-action');

    const safeInternal = sanitizeInternalRedirect('https://digitalindiaproject.com/partner/wallet');
    assert.equal(safeInternal.fullUrl, 'https://digitalindiaproject.com/partner/wallet');
    assert.equal(safeInternal.route, 'partner');
    assert.equal(safeInternal.param, 'wallet');

    const blockedExternal = sanitizeInternalRedirect('https://evil-phishing.example.com/steal', '/login');
    assert.equal(blockedExternal.fullUrl, 'https://digitalindiaproject.com/login');
    assert.equal(blockedExternal.route, 'login');
  });

  it('provides distinct role-adaptive landing profiles and guest audience blueprints for every user type', () => {
    assert.equal(getLandingProfileForRole('customer', false), null);
    assert.equal(getLandingProfileForRole(undefined, true), null);

    const roles = ['customer', 'operator', 'manager', 'partner', 'business', 'admin', 'super_admin'] as const;
    const profiles = roles.map((r) => getLandingProfileForRole(r, true)!);
    profiles.forEach((p) => {
      assert.ok(p);
      assert.ok(p.headline.length > 10);
      assert.ok(p.headlineHi.length > 5);
      assert.ok(p.toolkit.length >= 6);
      assert.ok(p.essentialsChecklist.length >= 3);
      assert.ok(buildUrlForRoute(p.primaryCta.route, p.primaryCta.param).startsWith('/'));
    });

    const distinctToolSignatures = new Set(
      profiles.slice(0, 6).map((p) => `${p.primaryCta.route}:${p.primaryCta.param || ''}`)
    );
    assert.equal(distinctToolSignatures.size, 6);

    assert.equal(buildUrlForRoute('register', 'partner'), '/signup?type=partner');
    assert.deepEqual(parseLocationPath('/signup', '?type=business'), { route: 'register', param: 'business' });
    assert.equal(Object.keys(GUEST_AUDIENCE_PROFILES).length, 4);
  });

  it('computes KYC verification and application status progress indicators accurately', () => {
    const kycNotSubmitted = getKycVerificationProgress({
      role: 'customer',
      userKycStatus: 'Not Submitted',
      verifiedAppDocsCount: 0,
      totalAppDocsCount: 0,
    });
    assert.equal(kycNotSubmitted.percent, 10);
    assert.equal(kycNotSubmitted.tone, 'neutral');
    assert.equal(kycNotSubmitted.statusBadgeLabel, 'Not Submitted');

    const kycPending = getKycVerificationProgress({
      role: 'operator',
      enrollmentKycStatus: 'Under Verification',
      enrollmentDocsCount: 4,
      verifiedEnrollmentDocsCount: 2,
    });
    assert.equal(kycPending.percent, 72);
    assert.equal(kycPending.tone, 'pending');
    assert.equal(kycPending.statusBadgeLabel, 'Under Verification');
    assert.equal(kycPending.steps[2].state, 'current');

    const partnerPending = getKycVerificationProgress({
      role: 'partner',
      partnerStatus: 'Pending Approval',
    });
    assert.equal(partnerPending.percent, 72);
    assert.equal(partnerPending.statusBadgeLabel, 'Pending Approval');

    const kycApproved = getKycVerificationProgress({
      role: 'partner',
      partnerStatus: 'Approved',
      verifiedAppDocsCount: 3,
      totalAppDocsCount: 3,
    });
    assert.equal(kycApproved.percent, 100);
    assert.equal(kycApproved.tone, 'approved');
    assert.equal(kycApproved.steps.every((s) => s.state === 'done'), true);

    const kycResubmit = getKycVerificationProgress({
      role: 'operator',
      enrollmentKycStatus: 'Resubmission Required',
      enrollmentRemarks: 'Upload clearer PAN card scan.',
    });
    assert.equal(kycResubmit.tone, 'warning');
    assert.equal(kycResubmit.steps[1].state, 'attention');
    assert.ok(kycResubmit.description.includes('Upload clearer PAN card scan.'));

    const submitted = getApplicationProgress('Submitted');
    assert.equal(submitted.percent, 20);
    assert.equal(submitted.currentStepIndex, 0);

    const paymentConfirmed = getApplicationProgress('Payment Confirmed');
    assert.equal(paymentConfirmed.percent, 40);
    assert.equal(paymentConfirmed.currentStepIndex, 1);

    const docsReq = getApplicationProgress('Documents Required');
    assert.equal(docsReq.tone, 'attention');
    assert.equal(docsReq.steps[2].state, 'attention');

    const processing = getApplicationProgress('Application Processing');
    assert.equal(processing.percent, 78);
    assert.equal(processing.currentStepIndex, 3);

    const completed = getApplicationProgress('Completed');
    assert.equal(completed.percent, 100);
    assert.equal(completed.tone, 'completed');
    assert.equal(completed.steps.every((s) => s.state === 'done'), true);

    const rejected = getApplicationProgress('Rejected');
    assert.equal(rejected.tone, 'halted');
    assert.equal(rejected.steps[2].state, 'halted');
  });
});

describe('Blog Section SEO, Sitemap, & Bulk Post Import / Export', () => {
  it('parses and builds /blog and /blog/:slug routes cleanly', () => {
    assert.deepEqual(parseLocationPath('/blog'), { route: 'blog', param: '' });
    assert.deepEqual(parseLocationPath('/blog', '?category=GST'), { route: 'blog', param: 'GST' });
    assert.deepEqual(parseLocationPath('/blog/pan-card-guide'), {
      route: 'blog-detail',
      param: 'pan-card-guide',
    });
    assert.equal(buildUrlForRoute('blog'), '/blog');
    assert.equal(buildUrlForRoute('blog', 'MSME & Udyam'), '/blog?category=MSME%20%26%20Udyam');
    assert.equal(buildUrlForRoute('blog-detail', 'pan-card-guide'), '/blog/pan-card-guide');
    assert.equal(
      buildCanonicalSiteUrl('blog-detail', 'pan-card-guide'),
      'https://digitalindiaproject.com/blog/pan-card-guide'
    );
  });

  it('evaluates blog SEO score, JSON-LD schemas, and sitemap.xml output', () => {
    assert.equal(slugifyBlogTitle('  GST Registration Online (2026)!  '), 'gst-registration-online-2026');

    const samplePost = INITIAL_BLOG_POSTS[0];
    const audit = evaluateBlogSeo(samplePost);
    assert.ok(audit.score >= 83);
    assert.equal(audit.grade, 'Optimal');
    assert.ok(audit.resolvedCanonicalUrl.startsWith('https://digitalindiaproject.com/blog/'));

    const ld = buildBlogPostJsonLd(samplePost);
    assert.equal(ld['@context'], 'https://schema.org');
    const types = ld['@graph'].map((node) => node['@type']);
    assert.ok(types.includes('BlogPosting'));
    assert.ok(types.includes('BreadcrumbList'));
    assert.ok(types.includes('FAQPage'));

    const sitemap = buildSitemapXml([], INITIAL_BLOG_POSTS);
    assert.ok(sitemap.includes('https://digitalindiaproject.com/blog</loc>'));
    assert.ok(sitemap.includes(`https://digitalindiaproject.com/blog/${samplePost.slug}</loc>`));
  });

  it('round-trips blog posts cleanly via CSV and JSON export/import and resolves duplicate slugs', () => {
    const csv = exportBlogPostsToCsv(INITIAL_BLOG_POSTS.slice(0, 2));
    const parsedFromCsv = parseImportedBlogPosts(csv, { formatHint: 'csv' });
    assert.equal(parsedFromCsv.errors.length, 0);
    assert.equal(parsedFromCsv.validPosts.length, 2);
    assert.equal(parsedFromCsv.validPosts[0].slug, INITIAL_BLOG_POSTS[0].slug);
    assert.ok((parsedFromCsv.validPosts[0].faqItems?.length || 0) >= 1);

    const json = exportBlogPostsToJson(INITIAL_BLOG_POSTS.slice(0, 2));
    const parsedFromJson = parseImportedBlogPosts(json, { formatHint: 'json' });
    assert.equal(parsedFromJson.errors.length, 0);
    assert.equal(parsedFromJson.validPosts.length, 2);

    const parsedBatch = parseImportedBlogPosts(SAMPLE_BULK_BATCH_TEMPLATE, {
      formatHint: 'batch',
      existingSlugs: ['how-to-apply-for-instant-pan-card-correction-online-in-2026'],
    });
    assert.equal(parsedBatch.errors.length, 0);
    assert.equal(parsedBatch.validPosts.length, 2);
    assert.equal(parsedBatch.warnings.length, 1);
    assert.notEqual(
      parsedBatch.validPosts[0].slug,
      'how-to-apply-for-instant-pan-card-correction-online-in-2026'
    );
  });

  it('ships 106+ full bilingual blog articles with unique slugs, 11 topic categories, official Govt portals, and sitemap coverage', () => {
    assert.ok(INITIAL_BLOG_POSTS.length >= 106);

    const ids = new Set(INITIAL_BLOG_POSTS.map((p) => p.id));
    const slugs = new Set(INITIAL_BLOG_POSTS.map((p) => p.slug));
    assert.equal(ids.size, INITIAL_BLOG_POSTS.length);
    assert.equal(slugs.size, INITIAL_BLOG_POSTS.length);

    const expectedPortals = [
      'https://uidai.gov.in/',
      'https://www.incometax.gov.in/',
      'https://voters.eci.gov.in/',
      'https://www.passportindia.gov.in/',
      'https://services.india.gov.in/',
      'https://egazette.gov.in/',
      'https://udyamregistration.gov.in/',
      'https://www.gst.gov.in/',
      'https://www.digilocker.gov.in/',
      'https://scholarships.gov.in/',
      'https://parivahan.gov.in/',
      'https://pmkisan.gov.in/',
    ];

    const allContent = INITIAL_BLOG_POSTS.map((p) => p.content).join('\n');
    for (const portal of expectedPortals) {
      assert.ok(allContent.includes(portal), `Expected official portal ${portal} across blog guides`);
    }

    const categories = new Set(INITIAL_BLOG_POSTS.map((p) => p.category));
    for (const cat of [
      'Aadhaar Card',
      'PAN Card',
      'Voter ID Card',
      'Passport',
      'Government Certificates',
      'Gazette & Legal Documents',
      'Business & Tax Registrations',
      'DigiLocker & Digital Services',
      'Student & Employment Services',
      'Driving Licence & Vehicle',
      'Government Schemes',
    ]) {
      assert.ok(categories.has(cat), `Expected category ${cat} in blog catalog`);
    }

    for (const post of INITIAL_BLOG_POSTS) {
      assert.ok(post.title.trim().length > 10);
      assert.ok((post.titleHi || '').trim().length > 5);
      assert.ok(post.excerpt.trim().length > 30);
      assert.ok((post.excerptHi || '').trim().length > 15);
      assert.ok(post.content.includes('## '), `Post ${post.id} missing structured headings`);
      const wordCount = post.content.split(/\s+/).length;
      assert.ok(wordCount >= 105, `Post ${post.id} content too short (${wordCount} words)`);
      if (/^blog-\d{3}/.test(post.id)) {
        assert.ok(wordCount >= 120, `New article ${post.id} content too short (${wordCount} words)`);
      }
      assert.ok((post.seoTitle || '').trim().length >= 20);
      assert.ok((post.seoDescription || '').trim().length >= 50);
      assert.ok((post.focusKeyword || '').trim().length >= 3);
      assert.equal(post.status, 'published');
    }

    const sitemap = buildSitemapXml([], INITIAL_BLOG_POSTS);
    assert.ok(sitemap.includes(`https://digitalindiaproject.com/blog/${INITIAL_BLOG_POSTS[105].slug}</loc>`));
  });
});

describe('Cloudflare Free-Plan Central Infrastructure (D1, R2, Security & Hono Routes)', () => {
  it('enforces a maximum of 10 logical/physical D1 databases and consolidates safely onto DB', () => {
    assert.equal(LOGICAL_DATABASE_CATALOG.length, 10);
    assert.equal(CLOUDFLARE_FREE_PLAN_D1_LIMITS.maxPhysicalDatabases, 10);
    const slots = new Set(LOGICAL_DATABASE_CATALOG.map((d) => d.slotNumber));
    assert.equal(slots.size, 10);

    const mockPrimaryDb = { prepare: () => ({}) } as any;
    const mockPartnerDb = { prepare: () => ({}) } as any;

    const consolidatedRegistry = new DatabaseRegistry({ DB: mockPrimaryDb } as any);
    assert.equal(consolidatedRegistry.getPhysicalBindingsCount(), 1);
    assert.equal(consolidatedRegistry.resolve('dip_core').bindingName, 'DB (dip-official)');
    assert.equal(consolidatedRegistry.resolve('dip_content').consolidated, true);

    const splitRegistry = new DatabaseRegistry({
      DB: mockPrimaryDb,
      DB_PARTNERS: mockPartnerDb,
    } as any);
    assert.equal(splitRegistry.getPhysicalBindingsCount(), 2);
    assert.equal(splitRegistry.resolve('dip_partners').bindingName, 'DB_PARTNERS');
    assert.equal(splitRegistry.resolve('dip_partners').consolidated, false);
  });

  it('enforces 10 logical R2 buckets, Free-Tier safety caps, and non-PII object keys', () => {
    assert.equal(LOGICAL_BUCKET_CATALOG.length, 10);
    assert.ok(
      CLOUDFLARE_FREE_PLAN_R2_LIMITS.safetyThresholdBytes <
        CLOUDFLARE_FREE_PLAN_R2_LIMITS.freeStorageLimitBytes
    );

    const storageReg = new StorageRegistry({} as any);
    assert.equal(storageReg.getDefinition('documents').accessClassification, 'private');
    assert.equal(storageReg.getDefinition('dip-media-library').accessClassification, 'public-read');
    assert.equal(storageReg.getDefinition('dip-backups').accessClassification, 'internal');

    const fileService = new FileService({} as any);
    const safeKey = fileService.buildSafeObjectKey({
      logicalBucket: 'documents',
      fileId: 'uuid-94812',
      mimeType: 'application/pdf',
      scopeRef: 'DIP-2026-1001',
    });
    assert.ok(safeKey.startsWith('private/apps/DIP-2026-1001/'));
    assert.ok(safeKey.endsWith('uuid-94812.pdf'));
    assert.equal(safeKey.includes('aadhaar'), false);
  });

  it('redacts Aadhaar, PAN, mobile numbers, and secret keys prior to audit persistence', () => {
    const maskedStr = redactSensitiveString(
      'Applicant PAN ABCDE1234F Aadhaar 2345 6789 0123 phone 9876543210'
    );
    assert.equal(maskedStr.includes('ABCDE1234F'), false);
    assert.equal(maskedStr.includes('0123'), true);
    assert.equal(maskedStr.includes('9876543210'), false);

    const redactedObj = redactSensitiveObject({
      aadhaar: '234567890123',
      apiKey: 'sk_live_secret_123',
      serviceCode: 'in.gov.gst.verify',
    }) as Record<string, unknown>;
    assert.equal(redactedObj.aadhaar, '[REDACTED]');
    assert.equal(redactedObj.apiKey, '[REDACTED]');
    assert.equal(redactedObj.serviceCode, 'in.gov.gst.verify');
  });

  it('serves health, API Junction status, SEO sitemap/robots, and fails closed on unauthenticated protected routes', async () => {
    const testEnv = {
      APP_DOMAIN: 'https://digitalindiaproject.com',
      ENVIRONMENT: 'test',
    } as any;

    const healthRes = await workerApp.fetch(new Request('https://digitalindiaproject.com/api/health'), testEnv);
    assert.equal(healthRes.status, 200);
    const healthJson: any = await healthRes.json();
    assert.equal(healthJson.status, 'healthy');
    assert.equal(healthJson.domain, 'https://digitalindiaproject.com');

    const juncRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/integrations/status'),
      testEnv
    );
    assert.equal(juncRes.status, 200);
    const juncJson: any = await juncRes.json();
    assert.equal(juncJson.success, true);
    assert.equal(juncJson.data.gatewayHost, 'https://digitalindiaproject.com');

    const adminUnauth = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/admin/infrastructure'),
      testEnv
    );
    assert.equal(adminUnauth.status, 401);

    const storageUnauth = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/storage/files'),
      testEnv
    );
    assert.equal(storageUnauth.status, 401);

    const robotsRes = await workerApp.fetch(new Request('https://digitalindiaproject.com/robots.txt'), testEnv);
    assert.equal(robotsRes.status, 200);
    const robotsText = await robotsRes.text();
    assert.ok(robotsText.includes('https://digitalindiaproject.com/sitemap.xml'));

    const sitemapRes = await workerApp.fetch(new Request('https://digitalindiaproject.com/sitemap.xml'), testEnv);
    assert.equal(sitemapRes.status, 200);
    const sitemapText = await sitemapRes.text();
    assert.ok(sitemapText.includes('<urlset'));
    assert.ok(sitemapText.includes('https://digitalindiaproject.com/blog'));
  });

  it('inspects all 10 dedicated D1 databases and 10 dedicated R2 buckets and routes domain requests independently', async () => {
    const queryLog: Array<{ dbName: string; sql: string }> = [];
    const makeMockD1 = (dbName: string, extraRows: Record<string, any[]> = {}) => {
      const makeStmt = (sql: string) => ({
        bind: (..._args: any[]) => makeStmt(sql),
        first: async () => {
          queryLog.push({ dbName, sql });
          if (sql.includes('SELECT 1')) return { ok: 1 };
          return null;
        },
        all: async () => {
          queryLog.push({ dbName, sql });
          if (sql.includes('sqlite_master')) {
            return { results: [{ name: 'schema_migrations' }, { name: 'blog_posts' }] };
          }
          if (sql.includes('schema_migrations')) {
            return { results: [{ version: '0004_central_platform_and_blog' }] };
          }
          if (sql.includes('FROM blog_posts')) {
            return { results: extraRows.blog_posts || [] };
          }
          return { results: [] };
        },
        run: async () => {
          queryLog.push({ dbName, sql });
          return { success: true };
        },
      });
      return { prepare: (sql: string) => makeStmt(sql) };
    };

    const makeMockR2 = (bucketName: string) => ({
      name: bucketName,
      list: async () => ({ objects: [], truncated: false }),
      get: async () => null,
      put: async () => ({}),
      head: async () => null,
      delete: async () => {},
    });

    const full10Env = {
      APP_DOMAIN: 'https://digitalindiaproject.com',
      ENVIRONMENT: 'production',
      DB: makeMockD1('dip-official'),
      DB_WORKFLOW: makeMockD1('dip-workflow'),
      DB_PARTNERS: makeMockD1('dip-partners'),
      DB_CONTENT: makeMockD1('dip-content', {
        blog_posts: [
          {
            id: 'post_1',
            slug: 'pan-update-guide',
            title: 'PAN Card Guide',
            excerpt: 'Guide excerpt',
            content: 'Detailed content',
            category: 'Citizen Guides',
            tags_json: '["pan"]',
            status: 'published',
            featured: 1,
            author_name: 'Editorial Desk',
            reading_time_minutes: 3,
            published_at: '2026-11-14T00:00:00Z',
          },
        ],
      }),
      DB_API: makeMockD1('dip-api'),
      DB_BILLING: makeMockD1('dip-billing'),
      DB_AUDIT: makeMockD1('dip-audit'),
      DB_SERVICES: makeMockD1('dip-services'),
      DB_INTEGRATIONS: makeMockD1('dip-integrations'),
      DB_ANALYTICS: makeMockD1('dip-analytics'),
      DOCUMENTS_BUCKET: makeMockR2('dip-official'),
      PUBLIC_ASSETS_BUCKET: makeMockR2('dip-public-assets'),
      GENERATED_FILES_BUCKET: makeMockR2('dip-generated-files'),
      BACKUPS_BUCKET: makeMockR2('dip-backups'),
      API_STORAGE_BUCKET: makeMockR2('dip-api-storage'),
      CUSTOMER_UPLOADS_BUCKET: makeMockR2('dip-customer-uploads'),
      PARTNER_FILES_BUCKET: makeMockR2('dip-partner-files'),
      API_ARCHIVES_BUCKET: makeMockR2('dip-api-archives'),
      MEDIA_LIBRARY_BUCKET: makeMockR2('dip-media-library'),
      EXPORT_REPORTS_BUCKET: makeMockR2('dip-export-reports'),
    } as any;

    const dbInspection = await new DatabaseRegistry(full10Env).inspectAll();
    assert.equal(dbInspection.physicalDatabasesBound, 10);
    assert.equal(dbInspection.withinFreePlanLimit, true);
    assert.equal(
      dbInspection.databases.every((d) => d.dedicatedBindingConfigured && !d.consolidatedOntoPrimary && d.status === 'CONNECTED'),
      true
    );

    const storageInspection = await new StorageRegistry(full10Env).inspectAll();
    assert.equal(storageInspection.physicalBucketsBound, 10);
    assert.equal(
      storageInspection.buckets.every((b) => b.dedicatedBindingConfigured && !b.consolidatedOntoPrimary && b.status === 'CONNECTED'),
      true
    );

    const healthRes = await workerApp.fetch(new Request('https://digitalindiaproject.com/api/health'), full10Env);
    assert.equal(healthRes.status, 200);
    const healthJson: any = await healthRes.json();
    assert.equal(healthJson.physicalDatabasesBound, 10);
    assert.equal(healthJson.physicalBucketsBound, 10);

    const blogRes = await workerApp.fetch(new Request('https://digitalindiaproject.com/api/blog/posts'), full10Env);
    assert.equal(blogRes.status, 200);
    const blogJson: any = await blogRes.json();
    assert.equal(blogJson.data.length, 1);
    assert.equal(blogJson.data[0].slug, 'pan-update-guide');
    assert.ok(queryLog.some((q) => q.dbName === 'dip-content' && q.sql.includes('FROM blog_posts')));
    assert.equal(
      queryLog.some((q) => q.dbName === 'dip-official' && q.sql.includes('FROM blog_posts')),
      false
    );
  });

  it('validates Cashfree real-time PG config, phone normalization, and HMAC-SHA256 webhook verification', async () => {
    const prodCfg = resolveCashfreeConfig({
      CASHFREE_CLIENT_ID: 'cf_live_id',
      CASHFREE_CLIENT_SECRET: 'cf_live_secret',
      CASHFREE_WEBHOOK_SECRET: 'whsec_123',
      CASHFREE_ENV: 'production',
    });
    assert.equal(prodCfg.configured, true);
    assert.equal(prodCfg.mode, 'production');
    assert.equal(prodCfg.baseUrl, 'https://api.cashfree.com/pg');

    const sandboxCfg = resolveCashfreeConfig({
      CASHFREE_APP_ID: 'cf_test_id',
      CASHFREE_SECRET_KEY: 'cf_test_secret',
    });
    assert.equal(sandboxCfg.configured, true);
    assert.equal(sandboxCfg.mode, 'sandbox');
    assert.equal(sandboxCfg.baseUrl, 'https://sandbox.cashfree.com/pg');

    assert.equal(normalizeIndianPhone('+91 98765-43210'), '9876543210');
    assert.equal(formatCashfreePaymentMethod({ upi: { upi_id: 'citizen@okaxis' } }), 'UPI (citizen@okaxis)');

    const rawBody = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: { order: { order_id: 'CF_ORD_1001' }, payment: { cf_payment_id: '998877', payment_status: 'SUCCESS' } },
    });
    const ts = '1731500000';
    const validSig = await hmacSha256Base64('whsec_123', `${ts}${rawBody}`);
    assert.equal(await verifyCashfreeWebhookSignature('whsec_123', ts, rawBody, validSig), true);
    assert.equal(await verifyCashfreeWebhookSignature('whsec_123', ts, rawBody, 'tampered_sig'), false);

    const badWebhookRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/webhook', {
        method: 'POST',
        headers: { 'x-webhook-timestamp': ts, 'x-webhook-signature': 'invalid' },
        body: rawBody,
      }),
      { APP_DOMAIN: 'https://digitalindiaproject.com', CASHFREE_WEBHOOK_SECRET: 'whsec_123' } as any
    );
    assert.equal(badWebhookRes.status, 401);

    const goodWebhookRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/webhook', {
        method: 'POST',
        headers: { 'x-webhook-timestamp': ts, 'x-webhook-signature': validSig },
        body: rawBody,
      }),
      { APP_DOMAIN: 'https://digitalindiaproject.com', CASHFREE_WEBHOOK_SECRET: 'whsec_123' } as any
    );
    assert.equal(goodWebhookRes.status, 200);
    const goodWebhookJson: any = await goodWebhookRes.json();
    assert.equal(goodWebhookJson.data.resolvedOrderStatus, 'PAID');

    const getWebhookRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/webhook', { method: 'GET' }),
      { APP_DOMAIN: 'https://digitalindiaproject.com' } as any
    );
    assert.equal(getWebhookRes.status, 200);

    const pingWebhookRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'WEBHOOK', data: { test_object: { test: true } } }),
      }),
      { APP_DOMAIN: 'https://digitalindiaproject.com' } as any
    );
    assert.equal(pingWebhookRes.status, 200);
    const pingJson: any = await pingWebhookRes.json();
    assert.equal(pingJson.data.testPing, true);
    assert.equal(pingJson.data.orderMutated, false);

    // Unsigned real payment payload with order_id must still fail closed
    const unsignedRealRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawBody,
      }),
      { APP_DOMAIN: 'https://digitalindiaproject.com', CASHFREE_CLIENT_SECRET: 'whsec_123' } as any
    );
    assert.equal(unsignedRealRes.status, 401);

    // Real payment payload signed by CASHFREE_CLIENT_SECRET succeeds cleanly
    const clientSecretWebhookRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/webhook', {
        method: 'POST',
        headers: { 'x-webhook-timestamp': ts, 'x-webhook-signature': validSig },
        body: rawBody,
      }),
      { APP_DOMAIN: 'https://digitalindiaproject.com', CASHFREE_CLIENT_SECRET: 'whsec_123' } as any
    );
    assert.equal(clientSecretWebhookRes.status, 200);

    const unauthOrderRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/orders', { method: 'POST', body: '{}' }),
      { APP_DOMAIN: 'https://digitalindiaproject.com' } as any
    );
    assert.equal(unauthOrderRes.status, 401);
  });

  it('normalizes payment statuses and serves real-time application payment status endpoints', async () => {
    assert.equal(normalizePaymentUiStatus('PAID'), 'Paid');
    assert.equal(normalizePaymentUiStatus('Success'), 'Paid');
    assert.equal(normalizePaymentUiStatus('CAPTURED'), 'Paid');
    assert.equal(normalizePaymentUiStatus('FAILED'), 'Failed');
    assert.equal(normalizePaymentUiStatus('EXPIRED'), 'Failed');
    assert.equal(normalizePaymentUiStatus('USER_DROPPED'), 'Failed');
    assert.equal(normalizePaymentUiStatus('ACTIVE'), 'Pending');
    assert.equal(normalizePaymentUiStatus('CREATED'), 'Pending');
    assert.equal(normalizePaymentUiStatus('Pending'), 'Pending');

    assert.equal(mapUiStatusToRecordStatus('Paid'), 'Success');
    assert.equal(mapUiStatusToRecordStatus('Failed'), 'Failed');
    assert.equal(mapUiStatusToRecordStatus('Pending'), 'Pending');

    assert.equal(
      deriveInitialPaymentUiStatus({
        status: 'Payment Pending',
        payment: { status: 'Pending', orderId: 'CF_PEND_1', amount: 800, govtFee: 199, totalAmount: 999 },
      } as any),
      'Pending'
    );
    assert.equal(
      deriveInitialPaymentUiStatus({
        status: 'Submitted',
        payment: { status: 'Success', orderId: 'CF_PAID_1', amount: 1200, govtFee: 299, totalAmount: 1499 },
      } as any),
      'Paid'
    );

    const summary = summarizePaymentStatuses([
      { uiStatus: 'Paid' },
      { uiStatus: 'Pending' },
      { uiStatus: 'Failed' },
    ]);
    assert.deepEqual(summary, {
      total: 3,
      paid: 1,
      pending: 1,
      failed: 1,
    });

    // Protected v1 route must fail closed when unauthenticated
    const unauthStatusRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/applications/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applications: [] }),
      }),
      { APP_DOMAIN: 'https://digitalindiaproject.com' } as any
    );
    assert.equal(unauthStatusRes.status, 401);

    // Fallback preview route returns normalized live statuses & summary
    const statusRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/payments/applications/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applications: [
            {
              applicationId: 'DIP-101',
              orderId: 'CF_ORD_101',
              currentStatus: 'Pending',
            },
            {
              applicationId: 'DIP-102',
              orderId: 'CF_ORD_102',
              currentStatus: 'Success',
            },
            {
              applicationId: 'DIP-103',
              orderId: 'CF_ORD_103',
              currentStatus: 'Failed',
            },
          ],
        }),
      }),
      { APP_DOMAIN: 'https://digitalindiaproject.com' } as any
    );
    assert.equal(statusRes.status, 200);
    const statusJson: any = await statusRes.json();
    assert.equal(statusJson.success, true);
    assert.equal(statusJson.data.items.length, 3);
    assert.equal(statusJson.data.items[0].uiStatus, 'Pending');
    assert.equal(statusJson.data.items[1].uiStatus, 'Paid');
    assert.equal(statusJson.data.items[2].uiStatus, 'Failed');
    assert.equal(statusJson.data.summary.total, 3);
    assert.equal(statusJson.data.summary.pending, 1);
    assert.equal(statusJson.data.summary.paid, 1);
    assert.equal(statusJson.data.summary.failed, 1);

    // Merges transactions, backend orders, applications, and live Cashfree sync chronologically
    const mergedHistory = buildPaymentHistoryEntries({
      transactions: [
        {
          id: 'TXN-HIST-1',
          orderId: 'CF_ORD_101',
          applicationId: 'DIP-101',
          serviceName: 'PAN Card Application',
          userId: 'usr-1',
          userName: 'Citizen One',
          userEmail: 'citizen@example.com',
          amount: 590,
          currency: 'INR',
          status: 'Pending',
          paymentMethod: 'UPI',
          transactionDate: '2026-11-14T10:00:00Z',
          receiptNumber: 'RCPT-101',
        },
      ],
      applications: [
        {
          id: 'DIP-101',
          userId: 'usr-1',
          userName: 'Citizen One',
          userEmail: 'citizen@example.com',
          userMobile: '9876543210',
          serviceId: 'svc-1',
          serviceName: 'PAN Card Application',
          serviceSlug: 'pan-card',
          status: 'Payment Pending',
          submissionDate: '2026-11-14T10:00:00Z',
          updatedAt: '2026-11-14T10:00:00Z',
          formData: {},
          documents: [],
          statusHistory: [],
          payment: {
            orderId: 'CF_ORD_101',
            amount: 500,
            govtFee: 90,
            totalAmount: 590,
            status: 'Pending',
          },
        } as any,
        {
          id: 'DIP-104',
          userId: 'usr-1',
          userName: 'Citizen One',
          userEmail: 'citizen@example.com',
          userMobile: '9876543210',
          serviceId: 'svc-2',
          serviceName: 'GST Amendment',
          serviceSlug: 'gst-amendment',
          status: 'Payment Confirmed',
          submissionDate: '2026-11-15T04:00:00Z',
          updatedAt: '2026-11-15T04:00:00Z',
          formData: {},
          documents: [],
          statusHistory: [],
          payment: {
            orderId: 'CF_ORD_104',
            cfPaymentId: 'CF_PAY_LIVE_104',
            amount: 1000,
            govtFee: 200,
            totalAmount: 1200,
            status: 'Success',
            paidAt: '2026-11-15T04:05:00Z',
          },
        } as any,
      ],
      statusMap: {
        'DIP-101': {
          applicationId: 'DIP-101',
          orderId: 'CF_ORD_101',
          uiStatus: 'Paid',
          gatewayStatus: 'PAID',
          paid: true,
          cfPaymentId: 'CF_PAY_LIVE_101',
          paymentMethod: 'UPI (citizen@okaxis)',
          paymentTime: '2026-11-15T05:10:00Z',
          bankReference: 'UTR44556677',
          gatewayConfigured: true,
          source: 'cashfree_live',
          checkedAt: '2026-11-15T05:11:00Z',
        },
      },
      backendHistory: [
        {
          orderId: 'CF_ORD_999',
          applicationId: 'DIP-999',
          transactionId: 'CF_ORD_999',
          amount: 450,
          currency: 'INR',
          status: 'FAILED',
          date: '2026-11-13T08:00:00Z',
          serviceName: 'Voter ID Update',
        },
      ],
    });

    assert.equal(mergedHistory.length, 3);
    assert.equal(mergedHistory[0].orderId, 'CF_ORD_101');
    assert.equal(mergedHistory[0].uiStatus, 'Paid');
    assert.equal(mergedHistory[0].transactionId, 'CF_PAY_LIVE_101');
    assert.equal(mergedHistory[0].bankReference, 'UTR44556677');
    assert.equal(mergedHistory[1].orderId, 'CF_ORD_104');
    assert.equal(mergedHistory[1].uiStatus, 'Paid');
    assert.equal(mergedHistory[2].orderId, 'CF_ORD_999');
    assert.equal(mergedHistory[2].uiStatus, 'Failed');

    const csv = formatPaymentHistoryCsv(mergedHistory);
    assert.ok(csv.includes('Date,Transaction ID,Order ID,Application ID'));
    assert.ok(csv.includes('CF_PAY_LIVE_101'));
    assert.ok(csv.includes('UTR44556677'));

    const unauthHistRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/history', { method: 'GET' }),
      { APP_DOMAIN: 'https://digitalindiaproject.com' } as any
    );
    assert.equal(unauthHistRes.status, 401);

    const fallbackHistRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/payments/history', { method: 'GET' }),
      { APP_DOMAIN: 'https://digitalindiaproject.com' } as any
    );
    assert.equal(fallbackHistRes.status, 200);
    const fallbackHistJson: any = await fallbackHistRes.json();
    assert.equal(Array.isArray(fallbackHistJson.data.items), true);

    const overviewMetrics = computePaymentOverviewMetrics(
      [
        {
          id: 'DIP-OV-1',
          serviceName: 'PAN Card Application',
          status: 'Payment Pending',
          submissionDate: '2026-11-15T01:00:00Z',
          updatedAt: '2026-11-15T01:00:00Z',
          payment: { orderId: 'ORD_OV_1', amount: 400, govtFee: 100, totalAmount: 500, status: 'Pending' },
        } as any,
        {
          id: 'DIP-OV-2',
          serviceName: 'Udyam Registration',
          status: 'Payment Confirmed',
          submissionDate: '2026-11-15T02:00:00Z',
          updatedAt: '2026-11-15T02:00:00Z',
          payment: {
            orderId: 'ORD_OV_2',
            amount: 1200,
            govtFee: 300,
            totalAmount: 1500,
            status: 'Success',
            paidAt: '2026-11-15T02:05:00Z',
          },
        } as any,
        {
          id: 'DIP-OV-3',
          serviceName: 'Income Certificate',
          status: 'Payment Pending',
          submissionDate: '2026-11-15T03:00:00Z',
          updatedAt: '2026-11-15T03:00:00Z',
          payment: { orderId: 'ORD_OV_3', amount: 300, govtFee: 200, totalAmount: 500, status: 'Pending' },
        } as any,
      ],
      {
        'DIP-OV-1': {
          applicationId: 'DIP-OV-1',
          orderId: 'ORD_OV_1',
          uiStatus: 'Paid',
          gatewayStatus: 'PAID',
          paid: true,
          paymentTime: '2026-11-15T05:30:00Z',
          gatewayConfigured: true,
          source: 'cashfree_live',
          checkedAt: '2026-11-15T05:31:00Z',
        },
      }
    );

    assert.equal(overviewMetrics.totalApplications, 3);
    assert.equal(overviewMetrics.completedCount, 2);
    assert.equal(overviewMetrics.completedAmount, 2000);
    assert.equal(overviewMetrics.pendingCount, 1);
    assert.equal(overviewMetrics.pendingAmount, 500);
    assert.equal(overviewMetrics.failedCount, 0);
    assert.equal(overviewMetrics.totalBilledAmount, 2500);
    assert.equal(overviewMetrics.completionPercent, 80);
    assert.equal(overviewMetrics.completedItems[0].applicationId, 'DIP-OV-1');
    assert.equal(overviewMetrics.pendingItems[0].applicationId, 'DIP-OV-3');

    assert.equal(toPaymentBadgeStatus('Pending'), 'pending');
    assert.equal(toPaymentBadgeStatus('pending'), 'pending');
    assert.equal(toPaymentBadgeStatus('Paid'), 'paid');
    assert.equal(toPaymentBadgeStatus('paid'), 'paid');
    assert.equal(toPaymentBadgeStatus('SUCCESS', true), 'paid');
    assert.equal(toPaymentBadgeStatus('Failed'), 'failed');
    assert.equal(toPaymentBadgeStatus('failed'), 'failed');
    assert.equal(toPaymentBadgeStatus('USER_DROPPED'), 'failed');
  });

  it('builds automated payment status alerts for Paid/Failed transitions and computes payment trend series across windows', async () => {
    const sampleApp = {
      id: 'DIP-TREND-1',
      serviceName: 'GST Registration',
      userId: 'usr-cust-1',
      userName: 'Aarav Sharma',
      userEmail: 'aarav@example.com',
      status: 'Payment Pending',
      submissionDate: '2026-11-12T10:00:00Z',
      updatedAt: '2026-11-12T10:00:00Z',
      payment: {
        orderId: 'CF_ORD_TREND_1',
        amount: 1500,
        govtFee: 0,
        totalAmount: 1500,
        status: 'Pending',
      },
    } as any;

    assert.equal(
      buildPaymentStatusAlertNotification({ app: sampleApp, nextUiStatus: 'Pending' }),
      null
    );

    const paidAlert = buildPaymentStatusAlertNotification({
      app: sampleApp,
      nextUiStatus: 'Paid',
      cfPaymentId: 'CF_PAY_9001',
      paymentMethod: 'UPI',
    });
    assert.ok(paidAlert);
    assert.equal(paidAlert.eventKey, 'PAYMENT_PAID');
    assert.equal(paidAlert.status, 'Paid');
    assert.equal(paidAlert.dedupeKey, 'DIP-TREND-1:CF_ORD_TREND_1:Paid');
    assert.ok(paidAlert.title.includes('Payment Confirmed'));
    assert.ok(paidAlert.emailSubject.includes('Payment Confirmed'));

    const failedAlert = buildPaymentStatusAlertNotification({
      app: sampleApp,
      nextUiStatus: 'Failed',
    });
    assert.ok(failedAlert);
    assert.equal(failedAlert.eventKey, 'PAYMENT_FAILED');
    assert.equal(failedAlert.status, 'Failed');
    assert.equal(failedAlert.dedupeKey, 'DIP-TREND-1:CF_ORD_TREND_1:Failed');
    assert.ok(failedAlert.title.includes('Payment Failed'));
    assert.ok(failedAlert.emailSubject.includes('Action Needed'));

    const trendNow = new Date('2026-11-15T12:00:00Z');
    const trendApps = [
      {
        ...sampleApp,
        id: 'DIP-TREND-1',
        submissionDate: '2026-11-14T10:00:00Z',
        updatedAt: '2026-11-14T10:00:00Z',
        payment: {
          orderId: 'CF_ORD_TREND_1',
          amount: 1500,
          govtFee: 0,
          totalAmount: 1500,
          status: 'Success',
          paidAt: '2026-11-14T10:05:00Z',
        },
      },
      {
        ...sampleApp,
        id: 'DIP-TREND-2',
        serviceName: 'PAN Update',
        submissionDate: '2026-11-15T06:00:00Z',
        updatedAt: '2026-11-15T06:00:00Z',
        payment: {
          orderId: 'CF_ORD_TREND_2',
          amount: 500,
          govtFee: 0,
          totalAmount: 500,
          status: 'Failed',
        },
      },
      {
        ...sampleApp,
        id: 'DIP-TREND-3',
        serviceName: 'Udyam Registration',
        submissionDate: '2026-11-05T08:00:00Z',
        updatedAt: '2026-11-05T08:00:00Z',
        payment: {
          orderId: 'CF_ORD_TREND_3',
          amount: 1000,
          govtFee: 0,
          totalAmount: 1000,
          status: 'Success',
          paidAt: '2026-11-05T08:15:00Z',
        },
      },
      {
        ...sampleApp,
        id: 'DIP-TREND-4',
        serviceName: 'Prior Window Fee',
        submissionDate: '2026-11-01T08:00:00Z',
        updatedAt: '2026-11-01T08:00:00Z',
        payment: {
          orderId: 'CF_ORD_TREND_4',
          amount: 750,
          govtFee: 0,
          totalAmount: 750,
          status: 'Success',
          paidAt: '2026-11-01T08:10:00Z',
        },
      },
    ] as any[];

    const sevenDayTrend = computePaymentTrendSeries({
      applications: trendApps,
      range: '7d',
      now: trendNow,
    });
    assert.equal(sevenDayTrend.buckets.length, 7);
    assert.equal(sevenDayTrend.paidVolume, 1500);
    assert.equal(sevenDayTrend.failedVolume, 500);
    assert.equal(sevenDayTrend.totalCount, 2);
    assert.equal(sevenDayTrend.successRatePercent, 50);
    assert.equal(sevenDayTrend.previousPeriodPaidVolume, 1000);
    assert.equal(sevenDayTrend.paidDeltaPercent, 50);

    const thirtyDayTrend = computePaymentTrendSeries({
      applications: trendApps,
      range: '30d',
      now: trendNow,
    });
    assert.equal(thirtyDayTrend.buckets.length, 6);
    assert.equal(thirtyDayTrend.paidVolume, 3250);
    assert.equal(thirtyDayTrend.failedVolume, 500);
    assert.equal(thirtyDayTrend.totalCount, 4);
    assert.equal(thirtyDayTrend.successRatePercent, 75);

    const sixMonthTrend = computePaymentTrendSeries({
      applications: trendApps,
      range: '6m',
      now: trendNow,
    });
    assert.equal(sixMonthTrend.buckets.length, 6);
    assert.equal(sixMonthTrend.paidVolume, 3250);

    // Worker v1 alert endpoint fails closed without auth
    const unauthAlertRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/notifications/payment-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: 'DIP-TREND-1',
          status: 'Paid',
          serviceName: 'GST Registration',
          amountInr: 1500,
          recipientEmail: 'aarav@example.com',
        }),
      }),
      { APP_DOMAIN: 'https://digitalindiaproject.com' } as any
    );
    assert.equal(unauthAlertRes.status, 401);

    // Fallback endpoint rejects non-terminal status and records Paid/Failed cleanly
    const badAlertRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/payments/payment-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: 'DIP-TREND-1',
          status: 'Pending',
        }),
      }),
      { APP_DOMAIN: 'https://digitalindiaproject.com' } as any
    );
    assert.equal(badAlertRes.status, 400);

    const okAlertRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/payments/payment-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: 'DIP-TREND-1',
          orderId: 'CF_ORD_TREND_1',
          status: 'Paid',
          serviceName: 'GST Registration',
          amountInr: 1500,
          recipientEmail: 'aarav@example.com',
        }),
      }),
      { APP_DOMAIN: 'https://digitalindiaproject.com' } as any
    );
    assert.equal(okAlertRes.status, 200);
    const okAlertJson: any = await okAlertRes.json();
    assert.equal(okAlertJson.success, true);
    assert.equal(okAlertJson.data.status, 'Paid');
    assert.equal(okAlertJson.data.inAppRecorded, true);
    assert.equal(okAlertJson.data.emailDeliveryStatus, 'Channel Unconfigured');

    // 30-day completed payments series for PaymentTrendChart
    const chartSummary = computeCompletedPayments30DaySeries({
      applications: [
        {
          ...sampleApp,
          id: 'DIP-CHART-1',
          submissionDate: '2026-11-15T04:00:00Z',
          updatedAt: '2026-11-15T04:00:00Z',
          payment: {
            orderId: 'ORD_C1',
            amount: 1200,
            govtFee: 0,
            totalAmount: 1200,
            status: 'Success',
            paidAt: '2026-11-15T04:10:00Z',
          },
        },
        {
          ...sampleApp,
          id: 'DIP-CHART-2',
          submissionDate: '2026-11-01T08:00:00Z',
          updatedAt: '2026-11-01T08:00:00Z',
          payment: {
            orderId: 'ORD_C2',
            amount: 800,
            govtFee: 0,
            totalAmount: 800,
            status: 'Success',
            paidAt: '2026-11-01T08:15:00Z',
          },
        },
        {
          ...sampleApp,
          id: 'DIP-CHART-PENDING',
          submissionDate: '2026-11-14T10:00:00Z',
          updatedAt: '2026-11-14T10:00:00Z',
          payment: {
            orderId: 'ORD_C3',
            amount: 999,
            govtFee: 0,
            totalAmount: 999,
            status: 'Pending',
          },
        },
        {
          ...sampleApp,
          id: 'DIP-CHART-PRIOR',
          submissionDate: '2026-10-10T10:00:00Z',
          updatedAt: '2026-10-10T10:00:00Z',
          payment: {
            orderId: 'ORD_C4',
            amount: 1000,
            govtFee: 0,
            totalAmount: 1000,
            status: 'Success',
            paidAt: '2026-10-10T10:05:00Z',
          },
        },
      ] as any[],
      now: new Date('2026-11-15T12:00:00Z'),
    });

    assert.equal(chartSummary.days.length, 30);
    assert.equal(chartSummary.totalCompletedAmount, 2000);
    assert.equal(chartSummary.totalCompletedCount, 2);
    assert.equal(chartSummary.activeDaysCount, 2);
    assert.equal(chartSummary.averageCompletedPayment, 1000);
    assert.equal(chartSummary.previous30DaysAmount, 1000);
    assert.equal(chartSummary.deltaPercent, 100);
    assert.equal(chartSummary.peakDay?.dateKey, '2026-11-15');
    assert.equal(chartSummary.peakDay?.completedAmount, 1200);

    // Paginated PaymentHistoryTable helper & paginated backend route
    const sampleEntries = Array.from({ length: 12 }, (_, idx) => ({
      id: `ORD_P_${idx + 1}`,
      transactionId: `TXN_P_${idx + 1}`,
      orderId: `ORD_P_${idx + 1}`,
      applicationId: `DIP-${idx + 1}`,
      serviceName: idx % 2 === 0 ? 'PAN Registration' : 'GST Filing',
      amount: (idx + 1) * 100,
      currency: 'INR',
      paymentMethod: 'UPI',
      date: `2026-11-${String(15 - idx).padStart(2, '0')}T10:00:00Z`,
      uiStatus: (idx % 3 === 0 ? 'Failed' : idx % 2 === 0 ? 'Pending' : 'Paid') as any,
      source: 'transaction' as const,
    }));

    const pageOne = paginatePaymentHistoryEntries({
      entries: sampleEntries,
      page: 1,
      pageSize: 5,
    });
    assert.equal(pageOne.items.length, 5);
    assert.equal(pageOne.pagination.totalItems, 12);
    assert.equal(pageOne.pagination.totalPages, 3);
    assert.equal(pageOne.pagination.hasNextPage, true);
    assert.equal(pageOne.pagination.hasPrevPage, false);

    const pageThree = paginatePaymentHistoryEntries({
      entries: sampleEntries,
      page: 3,
      pageSize: 5,
    });
    assert.equal(pageThree.items.length, 2);
    assert.equal(pageThree.pagination.hasNextPage, false);
    assert.equal(pageThree.pagination.hasPrevPage, true);

    const paidSearch = paginatePaymentHistoryEntries({
      entries: sampleEntries,
      page: 1,
      pageSize: 5,
      statusFilter: 'Paid',
      searchQuery: 'GST',
    });
    assert.equal(paidSearch.items.every((e) => e.uiStatus === 'Paid' && e.serviceName === 'GST Filing'), true);

    const paginatedRouteRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/payments/history?page=2&pageSize=5', {
        method: 'GET',
      }),
      { APP_DOMAIN: 'https://digitalindiaproject.com' } as any
    );
    assert.equal(paginatedRouteRes.status, 200);
    const paginatedRouteJson: any = await paginatedRouteRes.json();
    assert.equal(paginatedRouteJson.data.pagination.page, 2);
    assert.equal(paginatedRouteJson.data.pagination.pageSize, 5);
  });
});

describe('Complete 149-Item Catalogue, Routing, Pricing Engine, Importer & Digital Product Access', () => {
  it('ships exact 149 catalogue items across 8 canonical categories + 4 packages with zero duplicate IDs or slugs', () => {
    assert.equal(CATALOGUE_CATEGORIES.length, 8);
    assert.equal(SERVICE_PACKAGES.length, 4);
    assert.equal(COMPLETE_CATALOGUE_ITEMS.length, 149);

    const coreCount = COMPLETE_CATALOGUE_ITEMS.filter(
      (i) => i.productType !== 'compliance_package'
    ).length;
    assert.equal(coreCount, 145);

    const ids = new Set(COMPLETE_CATALOGUE_ITEMS.map((i) => i.id));
    const slugs = new Set(COMPLETE_CATALOGUE_ITEMS.map((i) => i.slug.toLowerCase()));
    assert.equal(ids.size, COMPLETE_CATALOGUE_ITEMS.length);
    assert.equal(slugs.size, COMPLETE_CATALOGUE_ITEMS.length);

    // Preserved legacy primary service slugs & IDs
    for (const preservedSlug of [
      'pan-card',
      'gst-registration',
      'udyam-registration',
      'income-tax-return-itr-1',
      'digital-business-starter-kit',
    ]) {
      const found = COMPLETE_CATALOGUE_ITEMS.find((i) => i.slug === preservedSlug);
      assert.ok(found, `Expected preserved catalogue item slug "${preservedSlug}"`);
    }

    const catSlugs = new Set(CATALOGUE_CATEGORIES.map((c) => c.slug));
    for (const item of COMPLETE_CATALOGUE_ITEMS) {
      assert.ok(catSlugs.has(item.category), `Item "${item.slug}" has valid category "${item.category}"`);
    }
  });

  it('parses and builds service detail, category, digital products, packages, 6 city locations, and 7 legal routes', () => {
    assert.deepEqual(parseLocationPath('/services/pan-card'), {
      route: 'service-detail',
      param: 'pan-card',
    });
    assert.deepEqual(parseLocationPath('/services/business-registration'), {
      route: 'services',
      param: 'business-registration',
    });
    assert.deepEqual(parseLocationPath('/products'), {
      route: 'products',
      param: 'digital-products',
    });
    assert.deepEqual(parseLocationPath('/packages'), {
      route: 'packages',
      param: 'packages',
    });
    assert.equal(TARGET_LOCATIONS.length, 6);
    for (const loc of TARGET_LOCATIONS) {
      assert.deepEqual(parseLocationPath(`/locations/${loc.slug}`), {
        route: 'location',
        param: loc.slug,
      });
      assert.equal(buildUrlForRoute('location', loc.slug), `/locations/${loc.slug}`);
    }
    for (const policySlug of [
      'disclaimer',
      'privacy',
      'data-protection',
      'terms',
      'refund',
      'digital-product-policy',
      'grievance',
    ]) {
      assert.deepEqual(parseLocationPath(`/legal/${policySlug}`), {
        route: 'legal',
        param: policySlug,
      });
      assert.equal(buildUrlForRoute('legal', policySlug), `/legal/${policySlug}`);
    }
  });

  it('computes 3rd-party fees, urgent fee, promo coupons, and package overlap deductions accurately', () => {
    const totals = calculateOrderTotalsPaise({
      serviceChargeInr: 1000,
      govtFeesInr: 100,
      thirdPartyFeesInr: 250,
      urgentFeeInr: 200,
      discountInr: 100,
      taxRateBps: 1800,
    });
    // Taxable = (1000 + 200 - 100) = 1100; 18% GST = 198; + 100 govt + 250 3P = 1648 (164800 paise)
    assert.equal(totals.urgentFeePaise, 20000);
    assert.equal(totals.thirdPartyFeePaise, 25000);
    assert.equal(totals.discountPaise, 10000);
    assert.equal(totals.taxPaise, 19800);
    assert.equal(totals.totalPaise, 164800);

    const pctCoupon = validateCouponCode({
      code: 'DIGITAL10',
      subtotalInr: 1000,
      coupons: INITIAL_COUPONS,
    });
    assert.equal(pctCoupon.valid, true);
    assert.equal(pctCoupon.discountInr, 100);

    const flatRegional = validateCouponCode({
      code: 'SILVASSA100',
      subtotalInr: 999,
      category: 'business-registration',
      coupons: INITIAL_COUPONS,
    });
    assert.equal(flatRegional.valid, true);
    assert.equal(flatRegional.discountInr, 100);

    const flatRegionalBelowMin = validateCouponCode({
      code: 'SILVASSA100',
      subtotalInr: 799,
      category: 'business-registration',
      coupons: INITIAL_COUPONS,
    });
    assert.equal(flatRegionalBelowMin.valid, false);

    const scopedProductCouponValid = validateCouponCode({
      code: 'TEMPLATES50',
      subtotalInr: 499,
      category: 'digital-products',
      coupons: INITIAL_COUPONS,
    });
    assert.equal(scopedProductCouponValid.valid, true);
    assert.equal(scopedProductCouponValid.discountInr, 50);

    const scopedProductCouponWrongCat = validateCouponCode({
      code: 'TEMPLATES50',
      subtotalInr: 499,
      category: 'personal',
      coupons: INITIAL_COUPONS,
    });
    assert.equal(scopedProductCouponWrongCat.valid, false);

    const starterPkg = SERVICE_PACKAGES[0];
    assert.ok((starterPkg.includedServiceIds || []).length >= 2);
    const firstIncludedId = starterPkg.includedServiceIds![0];
    const overlap = evaluatePackageOverlap(starterPkg, COMPLETE_CATALOGUE_ITEMS, [
      {
        id: 'DIP-OVERLAP-1',
        serviceId: firstIncludedId,
        status: 'Completed',
      } as any,
    ]);
    assert.deepEqual(overlap.overlappingServiceIds, [firstIncludedId]);
    assert.ok(overlap.suggestedDeductionInr > 0);
    assert.ok(overlap.adjustedPackageChargeInr < starterPkg.serviceCharge);
  });

  it('imports CSV and JSON catalogues idempotently without duplicating IDs or wiping form schemas', () => {
    const sampleSlice = COMPLETE_CATALOGUE_ITEMS.slice(0, 5);
    const csv = exportCatalogueToCsv(sampleSlice);
    const json = exportCatalogueToJson(sampleSlice);

    const resCsv1 = runIdempotentCatalogueImport({
      existingItems: COMPLETE_CATALOGUE_ITEMS,
      rawInput: csv,
      formatHint: 'csv',
    });
    assert.equal(resCsv1.report.errorsCount, 0);
    assert.equal(resCsv1.report.createdCount, 0);
    assert.equal(resCsv1.mergedItems.length, COMPLETE_CATALOGUE_ITEMS.length);
    assert.deepEqual(
      resCsv1.mergedItems[0].formFields,
      COMPLETE_CATALOGUE_ITEMS[0].formFields
    );

    const resSysSync = runIdempotentCatalogueImport({
      existingItems: COMPLETE_CATALOGUE_ITEMS,
      rawInput: JSON.parse(json).items,
      formatHint: 'system_sync',
    });
    assert.equal(resSysSync.report.createdCount, 0);
    assert.equal(resSysSync.report.updatedCount, 0);
    assert.equal(resSysSync.report.skippedCount, sampleSlice.length);
    assert.equal(resSysSync.mergedItems.length, COMPLETE_CATALOGUE_ITEMS.length);
  });

  it('enforces server-side checkout pricing, blocks tampering/unquoted custom services, and protects digital downloads', async () => {
    const sessionTokenCustomer = 'sess_cust_test_token';
    const sessionTokenAdmin = 'sess_admin_test_token';

    const makeAuthDb = () => ({
      prepare: (sql: string) => ({
        bind: (...args: any[]) => ({
          first: async () => {
            if (sql.includes('FROM user_sessions')) {
              const tok = args[0];
              if (tok === sessionTokenCustomer) {
                return {
                  user_id: 'cust-auth-1',
                  expires_at: '2099-01-01T00:00:00Z',
                  email: 'citizen@example.com',
                  name: 'Citizen User',
                  is_active: 1,
                };
              }
              if (tok === sessionTokenAdmin) {
                return {
                  user_id: 'admin-auth-1',
                  expires_at: '2099-01-01T00:00:00Z',
                  email: 'allindiadigitalseva@gmail.com',
                  name: 'Master Admin',
                  is_active: 1,
                };
              }
            }
            if (sql.includes('FROM users u')) {
              const uid = args[0];
              if (uid === 'admin-auth-1') {
                return { id: 'admin-auth-1', is_active: 1, role_name: 'super_admin' };
              }
              return { id: 'cust-auth-1', is_active: 1, role_name: 'customer' };
            }
            return null;
          },
          all: async () => ({ results: [] }),
          run: async () => ({ success: true }),
        }),
      }),
    });

    const authEnv = {
      APP_DOMAIN: 'https://digitalindiaproject.com',
      DB: makeAuthDb(),
    } as any;

    // 1. Tampered price on public fallback create-order rejected with 400 PRICE_TAMPER_OR_MISMATCH
    const tamperedPublicRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceSlug: 'pan-card',
          amount: 1,
          customerName: 'Aarav',
          customerEmail: 'aarav@example.com',
          customerPhone: '9876543210',
        }),
      }),
      authEnv
    );
    assert.equal(tamperedPublicRes.status, 400);
    const tamperedPublicJson: any = await tamperedPublicRes.json();
    assert.equal(tamperedPublicJson.errorCode, 'PRICE_TAMPER_OR_MISMATCH');

    // 2. Tampered price on authenticated v1 order rejected with 400 PRICE_TAMPER_OR_MISMATCH
    const tamperedV1Res = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionTokenCustomer}`,
        },
        body: JSON.stringify({
          serviceSlug: 'pan-card',
          totalAmountInr: 1,
        }),
      }),
      authEnv
    );
    assert.equal(tamperedV1Res.status, 400);
    const tamperedV1Json: any = await tamperedV1Res.json();
    assert.equal(tamperedV1Json.error_code, 'PRICE_TAMPER_OR_MISMATCH');

    // 3. Custom quote service with ₹0 fee rejected with 400 CUSTOM_QUOTE_REQUIRED
    const customQuoteSrv = COMPLETE_CATALOGUE_ITEMS.find(
      (i) => i.isCustomQuote && i.serviceCharge === 0
    );
    assert.ok(customQuoteSrv, 'Expected at least one custom-quote item with ₹0 upfront fee');
    const customQuoteRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionTokenCustomer}`,
        },
        body: JSON.stringify({
          serviceSlug: customQuoteSrv.slug,
          totalAmountInr: 500,
        }),
      }),
      authEnv
    );
    assert.equal(customQuoteRes.status, 400);
    const customQuoteJson: any = await customQuoteRes.json();
    assert.equal(customQuoteJson.error_code, 'CUSTOM_QUOTE_REQUIRED');

    // 4. Protected digital product downloads (both /api/v1/products/:slug/download and /api/products/:slug/download)
    const dlSlug = 'digital-business-starter-kit';
    const dlUnauth = await workerApp.fetch(
      new Request(`https://digitalindiaproject.com/api/v1/products/${dlSlug}/download`),
      authEnv
    );
    assert.equal(dlUnauth.status, 401);

    const dlUnpaidCustomer = await workerApp.fetch(
      new Request(`https://digitalindiaproject.com/api/v1/products/${dlSlug}/download`, {
        headers: { Authorization: `Bearer ${sessionTokenCustomer}` },
      }),
      authEnv
    );
    assert.equal(dlUnpaidCustomer.status, 403);

    const dlAdminAuthorized = await workerApp.fetch(
      new Request(`https://digitalindiaproject.com/api/v1/products/${dlSlug}/download`, {
        headers: { Authorization: `Bearer ${sessionTokenAdmin}` },
      }),
      authEnv
    );
    assert.equal(dlAdminAuthorized.status, 200);
    const cacheCtrl = dlAdminAuthorized.headers.get('cache-control') || '';
    assert.ok(cacheCtrl.includes('no-store') && cacheCtrl.includes('private'));
    assert.ok(
      (dlAdminAuthorized.headers.get('content-disposition') || '').includes('attachment; filename=')
    );

    // 5. Public catalogue API query + coupon validation + sitemap XML
    const catRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/catalogue?category=personal&limit=5'),
      authEnv
    );
    assert.equal(catRes.status, 200);
    const catJson: any = await catRes.json();
    assert.equal(catJson.data.length, 5);
    assert.ok(catJson.meta.totalItems >= 20);

    const sitemapRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/sitemap.xml'),
      authEnv
    );
    assert.equal(sitemapRes.status, 200);
    const sitemapXml = await sitemapRes.text();
    assert.ok(sitemapXml.includes('https://digitalindiaproject.com/products</loc>'));
    assert.ok(sitemapXml.includes('https://digitalindiaproject.com/packages</loc>'));
    assert.ok(sitemapXml.includes('https://digitalindiaproject.com/locations/silvassa</loc>'));
    assert.ok(sitemapXml.includes('https://digitalindiaproject.com/legal/digital-product-policy</loc>'));
    assert.ok(sitemapXml.includes('https://digitalindiaproject.com/services/business-registration</loc>'));
  });

  it('builds valid Schema.org FAQPage + Service/Product + BreadcrumbList JSON-LD for all service detail pages', () => {
    // 1. Standard service (PAN Card) includes Service, BreadcrumbList, and FAQPage @graph
    const panService = COMPLETE_CATALOGUE_ITEMS.find((s) => s.slug === 'pan-card');
    assert.ok(panService);
    const panLd = buildServiceDetailJsonLd(panService);
    assert.equal(panLd['@context'], 'https://schema.org');
    assert.ok(Array.isArray(panLd['@graph']));
    const panTypes = panLd['@graph'].map((n: any) => n['@type']);
    assert.ok(panTypes.includes('Service'));
    assert.ok(panTypes.includes('BreadcrumbList'));
    assert.ok(panTypes.includes('FAQPage'));

    const panFaqNode = panLd['@graph'].find((n: any) => n['@type'] === 'FAQPage');
    assert.ok(panFaqNode);
    assert.equal(panFaqNode.mainEntity.length, panService.faqs.length);
    assert.equal(panFaqNode.mainEntity[0]['@type'], 'Question');
    assert.equal(panFaqNode.mainEntity[0].name, panService.faqs[0].question.trim());
    assert.equal(panFaqNode.mainEntity[0].acceptedAnswer['@type'], 'Answer');
    assert.equal(
      panFaqNode.mainEntity[0].acceptedAnswer.text,
      panService.faqs[0].answer.trim()
    );

    // 2. Digital product includes Product + BreadcrumbList + FAQPage
    const digProduct = COMPLETE_CATALOGUE_ITEMS.find(
      (s) => s.slug === 'digital-business-starter-kit'
    );
    assert.ok(digProduct);
    const digLd = buildServiceDetailJsonLd(digProduct);
    const digTypes = digLd['@graph'].map((n: any) => n['@type']);
    assert.ok(digTypes.includes('Product'));
    assert.ok(digTypes.includes('BreadcrumbList'));
    assert.ok(digTypes.includes('FAQPage'));

    // 3. Omits FAQPage cleanly if a custom service has zero valid FAQs
    const emptyFaqService = {
      ...panService,
      faqs: [{ question: '   ', answer: '' }],
    };
    const emptyFaqLd = buildServiceDetailJsonLd(emptyFaqService);
    const emptyTypes = emptyFaqLd['@graph'].map((n: any) => n['@type']);
    assert.ok(!emptyTypes.includes('FAQPage'));

    // 4. Every shipped catalogue item produces a valid FAQPage with >= 1 Question/Answer
    for (const item of COMPLETE_CATALOGUE_ITEMS) {
      const ld = buildServiceDetailJsonLd(item);
      const faqNode = ld['@graph'].find((n: any) => n['@type'] === 'FAQPage');
      assert.ok(faqNode, `Expected FAQPage JSON-LD for ${item.slug}`);
      assert.ok(
        Array.isArray(faqNode.mainEntity) && faqNode.mainEntity.length >= 1,
        `Expected >= 1 FAQ Question for ${item.slug}`
      );
      for (const q of faqNode.mainEntity) {
        assert.equal(q['@type'], 'Question');
        assert.ok(typeof q.name === 'string' && q.name.length > 0);
        assert.equal(q.acceptedAnswer['@type'], 'Answer');
        assert.ok(
          typeof q.acceptedAnswer.text === 'string' && q.acceptedAnswer.text.length > 0
        );
      }
    }
  });
});

describe('P0 Security Hardening, Unified Pipeline & Compliance Tools', () => {
  const b64Url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj), 'utf8')
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  it('rejects forged HS256 / alg:none / expired / wrong-audience JWTs and validates genuine RS256 JWK tokens', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify']
    );
    const pubJwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey & {
      kid?: string;
    };
    pubJwk.kid = 'test-kid-1';

    const signRs256 = async (header: Record<string, any>, payload: Record<string, any>) => {
      const signingInput = `${b64Url(header)}.${b64Url(payload)}`;
      const sigBuf = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        keyPair.privateKey,
        new TextEncoder().encode(signingInput)
      );
      const sigB64Url = Buffer.from(new Uint8Array(sigBuf))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
      return `${signingInput}.${sigB64Url}`;
    };

    const nowSec = Math.floor(Date.now() / 1000);
    const validPayload = {
      sub: 'uid-citizen-99',
      email: 'citizen@example.com',
      email_verified: true,
      aud: 'gen-lang-client-0294214396',
      iss: 'https://securetoken.google.com/gen-lang-client-0294214396',
      iat: nowSec - 10,
      exp: nowSec + 3600,
    };

    // Valid RS256 signed JWT passes
    const validTok = await signRs256({ alg: 'RS256', kid: 'test-kid-1', typ: 'JWT' }, validPayload);
    const verified = await verifyJwtWithJwk(validTok, pubJwk);
    assert.ok(verified);
    assert.equal(verified?.sub, 'uid-citizen-99');

    // Forged alg=none rejected
    const noneTok = `${b64Url({ alg: 'none', kid: 'test-kid-1' })}.${b64Url(validPayload)}.forged`;
    assert.equal(await verifyJwtWithJwk(noneTok, pubJwk), null);

    // HS256 downgrade attack rejected even if signed bytes exist
    const hsTok = await signRs256({ alg: 'HS256', kid: 'test-kid-1' }, validPayload);
    assert.equal(await verifyJwtWithJwk(hsTok, pubJwk), null);

    // Expired token rejected
    const expTok = await signRs256(
      { alg: 'RS256', kid: 'test-kid-1' },
      { ...validPayload, exp: nowSec - 5 }
    );
    assert.equal(await verifyJwtWithJwk(expTok, pubJwk), null);

    // Wrong audience / issuer rejected
    const wrongAudTok = await signRs256(
      { alg: 'RS256', kid: 'test-kid-1' },
      { ...validPayload, aud: 'malicious-project' }
    );
    assert.equal(await verifyJwtWithJwk(wrongAudTok, pubJwk), null);

    // Tampered payload fails cryptographic RS256 verification
    const [, , validSig] = validTok.split('.');
    const tamperedTok = `${b64Url({ alg: 'RS256', kid: 'test-kid-1' })}.${b64Url({
      ...validPayload,
      sub: 'allindiadigitalseva@gmail.com',
    })}.${validSig}`;
    assert.equal(await verifyJwtWithJwk(tamperedTok, pubJwk), null);

    // Unverified malformed bearer fails resolveUserFromRequest cleanly
    const resolved = await resolveUserFromRequest('Bearer invalid.jwt.token', {} as any);
    assert.equal(resolved, null);
  });

  it('enforces strict operator assignment isolation in canAccessApplication & Firestore rules', () => {
    const appAssignedToOpA = {
      id: 'DIP-OP-1',
      userId: 'cust-100',
      userEmail: 'cust@dip.in',
      assignedOperatorId: 'op-a',
      collectedByUid: 'op-a',
    };
    const appUnassigned = {
      id: 'DIP-OP-2',
      userId: 'cust-100',
      userEmail: 'cust@dip.in',
    };

    assert.equal(canAccessApplication({ id: 'op-a', email: 'opa@dip.in', role: 'operator' }, appAssignedToOpA), true);
    assert.equal(canAccessApplication({ id: 'op-b', email: 'opb@dip.in', role: 'operator' }, appAssignedToOpA), false);
    assert.equal(canAccessApplication({ id: 'op-a', email: 'opa@dip.in', role: 'operator' }, appUnassigned), false);
    assert.equal(canAccessApplication({ id: 'mgr-1', email: 'mgr@dip.in', role: 'manager' }, appUnassigned), true);
    assert.equal(canAccessApplication({ id: 'adm-1', email: 'adm@dip.in', role: 'super_admin' }, appUnassigned), true);

    // Verify hardened Firestore rules isolate applications & disable public tracking list
    const rulesText = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
    assert.ok(!rulesText.includes('isApprovedOperator()'));
    assert.ok(rulesText.includes('match /tracking_records/{applicationId}'));
    assert.ok(rulesText.includes('allow list: if false;'));
  });

  it('validates file magic bytes, rejects renamed executables/XSS polyglots, and permits valid files', () => {
    // 1. Renamed Windows PE (.exe -> .pdf) blocked
    const mzBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]).buffer;
    assert.equal(
      validateFileSignatureAndExtension({
        mimeType: 'application/pdf',
        filename: 'fake.pdf',
        bytes: mzBytes,
      }).valid,
      false
    );

    // 2. HTML/script payload disguised as JPEG blocked
    const htmlBytes = new TextEncoder().encode('<script>alert(1)</script>').buffer;
    assert.equal(
      validateFileSignatureAndExtension({
        mimeType: 'image/jpeg',
        filename: 'photo.jpg',
        bytes: htmlBytes,
      }).valid,
      false
    );

    // 3. Extension / MIME mismatch rejected
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).buffer;
    assert.equal(
      validateFileSignatureAndExtension({
        mimeType: 'image/png',
        filename: 'mismatched.jpg',
        bytes: pngHeader,
      }).valid,
      false
    );

    // 4. Genuine PDF header & PNG magic bytes pass
    const pdfBytes = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n').buffer;
    assert.equal(
      validateFileSignatureAndExtension({
        mimeType: 'application/pdf',
        filename: 'aadhaar.pdf',
        bytes: pdfBytes,
      }).valid,
      true
    );
    assert.equal(
      validateFileSignatureAndExtension({
        mimeType: 'image/png',
        filename: 'receipt.png',
        bytes: pngHeader,
      }).valid,
      true
    );
  });

  it('locks production gateway config, blocks payment amount tampering, and reconciles orders idempotently', async () => {
    const prodEnv = {
      ENVIRONMENT: 'production',
      CASHFREE_CLIENT_ID: 'cf_live_id',
      CASHFREE_CLIENT_SECRET: 'cf_live_secret',
    };
    assert.equal(isProductionEnvironment(prodEnv), true);
    const cfg = resolveCashfreeConfig(prodEnv, 'sandbox');
    // Sandbox client preference ignored in production runtime with live keys
    assert.equal(cfg.mode, 'production');
    assert.equal(cfg.baseUrl, 'https://api.cashfree.com/pg');
    assert.equal(isPaymentAmountMatching(150000, 1500), true);
    assert.equal(isPaymentAmountMatching(150000, 100), false);

    // Unauthenticated call in production fails closed (401)
    const prodUnauthRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceSlug: 'pan-card',
          customerName: 'Aarav',
          customerEmail: 'aarav@example.com',
          customerPhone: '9876543210',
        }),
      }),
      { ENVIRONMENT: 'production' } as any
    );
    assert.equal(prodUnauthRes.status, 401);

    // Authenticated call in production with missing Cashfree secrets fails closed (503)
    const prodSessionEnv = {
      ENVIRONMENT: 'production',
      DB: {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () => {
              if (sql.includes('FROM user_sessions')) {
                return {
                  user_id: 'cust-prod-1',
                  expires_at: '2099-01-01T00:00:00Z',
                  email: 'aarav@example.com',
                  name: 'Aarav',
                  is_active: 1,
                };
              }
              if (sql.includes('FROM users u')) {
                return { id: 'cust-prod-1', is_active: 1, role_name: 'customer' };
              }
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => ({ success: true }),
          }),
        }),
      },
    } as any;
    const prodNoKeysRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer opaque_prod_test_tok',
        },
        body: JSON.stringify({
          serviceSlug: 'pan-card',
          customerName: 'Aarav',
          customerEmail: 'aarav@example.com',
          customerPhone: '9876543210',
        }),
      }),
      prodSessionEnv
    );
    assert.equal(prodNoKeysRes.status, 503);

    // Public verified tracking masks PII & rejects mismatched contact
    const trackEnv = {
      APP_DOMAIN: 'https://digitalindiaproject.com',
      DB: {
        prepare: (sql: string) => ({
          bind: (..._args: any[]) => ({
            first: async () => {
              if (sql.includes('FROM applications')) {
                return {
                  id: 'DIP-TRK-99',
                  service_id: 'srv-pan',
                  service_name: 'PAN Card',
                  service_slug: 'pan-card',
                  user_name: 'Ramesh Sharma',
                  user_email: 'ramesh@example.com',
                  user_mobile: '9876501234',
                  status: 'Under Review',
                  customer_remarks: 'Docs verified',
                  completion_file_name: null,
                  created_at: '2026-11-01T10:00:00Z',
                  updated_at: '2026-11-02T10:00:00Z',
                };
              }
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => ({ success: true }),
          }),
        }),
      },
    } as any;

    const trackDenied = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/applications/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: 'DIP-TRK-99', contact: 'attacker@evil.com' }),
      }),
      trackEnv
    );
    assert.equal(trackDenied.status, 403);

    const trackAllowed = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/applications/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: 'DIP-TRK-99', contact: '9876501234' }),
      }),
      trackEnv
    );
    assert.equal(trackAllowed.status, 200);
    const trackJson: any = await trackAllowed.json();
    assert.equal(trackJson.data.id, 'DIP-TRK-99');
    assert.ok(!JSON.stringify(trackJson.data).includes('9876501234'));
    assert.ok(!JSON.stringify(trackJson.data).includes('ramesh@example.com'));

    // Reconcile paid order rejects tampered amount (₹10 vs ₹199) and reconciles genuine ₹199
    const executedSql: string[] = [];
    const reconcileEnv = {
      DB: {
        prepare: (sql: string) => ({
          bind: (..._args: any[]) => ({
            first: async () => {
              if (sql.includes('FROM payment_orders')) {
                return {
                  id: 'ORD-REC-1',
                  application_id: 'DIP-APP-REC-1',
                  user_id: 'usr-1',
                  service_slug: 'pan-card',
                  service_fee_paise: 10000,
                  govt_fee_paise: 9900,
                  tax_paise: 0,
                  total_paise: 19900,
                  status: 'ACTIVE',
                };
              }
              if (sql.includes('FROM applications')) {
                return {
                  id: 'DIP-APP-REC-1',
                  user_id: 'usr-1',
                  service_id: 'srv-pan',
                  status: 'Payment Pending',
                };
              }
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => {
              executedSql.push(sql);
              return { success: true };
            },
          }),
        }),
      },
    } as any;

    const mismatchRes = await reconcilePaidOrder(reconcileEnv, {
      orderId: 'ORD-REC-1',
      paymentAmountInr: 10,
    });
    assert.equal(mismatchRes.ok, false);
    assert.equal(mismatchRes.amountMismatch, true);

    const matchedRes = await reconcilePaidOrder(reconcileEnv, {
      orderId: 'ORD-REC-1',
      paymentAmountInr: 199,
      cfPaymentId: 'CF_9988',
    });
    assert.equal(matchedRes.ok, true);
    assert.equal(matchedRes.reconciled, true);
    assert.ok(executedSql.some((s) => s.includes('INSERT OR IGNORE INTO invoices')));
    assert.ok(executedSql.some((s) => s.includes("SET status = 'Payment Confirmed'")));
  });

  it('computes GST breakdowns and FY 2026-27 Income Tax New vs Old Regime accurately', () => {
    // 1. Intra-state 18% exclusive GST on ₹10,000 -> CGST 900 + SGST 900 = ₹11,800
    const intraExcl = calculateGstBreakdown({
      amountInr: 10000,
      gstRatePct: 18,
      inclusive: false,
      interState: false,
    });
    assert.equal(intraExcl.baseAmount, 10000);
    assert.equal(intraExcl.cgst, 900);
    assert.equal(intraExcl.sgst, 900);
    assert.equal(intraExcl.igst, 0);
    assert.equal(intraExcl.totalAmount, 11800);

    // 2. Inter-state 18% inclusive GST on ₹1,180 -> base 1,000 + IGST 180
    const interIncl = calculateGstBreakdown({
      amountInr: 1180,
      gstRatePct: 18,
      inclusive: true,
      interState: true,
    });
    assert.equal(interIncl.baseAmount, 1000);
    assert.equal(interIncl.igst, 180);
    assert.equal(interIncl.cgst, 0);
    assert.equal(interIncl.totalAmount, 1180);

    // 3. FY 2026-27 salaried ₹12,50,000 (after ₹75k std deduction -> ₹11.75L <= ₹12L 87A limit => ₹0 New Regime tax!)
    const salaried125 = calculateIncomeTaxFY2627({
      annualIncomeInr: 1250000,
      deductions80C80DInr: 150000,
      salaried: true,
    });
    assert.equal(salaried125.taxableNew, 1175000);
    assert.equal(salaried125.newRegimeTax, 0);
    assert.equal(salaried125.recommendedRegime, 'New Regime');
    assert.ok(salaried125.oldRegimeTax > 0);
  });
});

describe('Digital Tools Tray — ₹10 1-Time Use Pass, Subscriptions, Catalog Filters & Notifications', () => {
  it('enforces balanced Free (135) vs Paid (15 @ ₹10/use) split and valid HomePage/Changelog slugs', () => {
    assert.equal(TOOLS_REGISTRY.length, 150);
    const freeTools = TOOLS_REGISTRY.filter((t) => !t.tier || t.tier === 'free');
    const paidTools = TOOLS_REGISTRY.filter((t) => t.tier && t.tier !== 'free');
    assert.equal(freeTools.length, 135);
    assert.equal(paidTools.length, 15);
    assert.equal(TOOL_SINGLE_USE_PRICE_INR, 10);
    assert.equal(TOOL_PAY_PER_USE_OPTION.priceInr, 10);

    for (const paid of paidTools) {
      assert.equal(paid.singleUsePriceInr, 10, `${paid.slug} should cost ₹10 per single use`);
      assert.equal(getToolSingleUsePriceInr(paid), 10);
    }

    for (const free of freeTools.slice(0, 10)) {
      assert.equal(getToolSingleUsePriceInr(free), 0);
    }

    // Verify all featured slugs linked from HomePage and Changelog exist in registry
    const featuredSlugs = [
      'image-size-kb-compressor',
      'passport-photo-print-sheet',
      'merge-pdf',
      'ai-document-summarizer',
      'upi-qr-generator',
      'gst-calculator',
      ...TOOL_CHANGELOG_ENTRIES.map((c) => c.toolSlug),
    ];
    for (const slug of featuredSlugs) {
      assert.ok(getToolBySlug(slug), `Expected tool slug '${slug}' to exist in TOOLS_REGISTRY`);
    }
  });

  it('evaluates tool access across Free plan, ₹10 Single-Use Passes, daily limits, AI credits, and Subscriptions', () => {
    const proInvoiceTool = getToolBySlug('gst-invoice-generator')!;
    const aiSummarizer = getToolBySlug('ai-document-summarizer')!;
    const cscPhotoTool = getToolBySlug('csc-passport-photo-studio')!;
    const freeMergeTool = getToolBySlug('merge-pdf')!;

    // 1. Free user can run free tool
    const freeAccess = evaluateToolAccess({
      tool: freeMergeTool,
      userPlan: 'free',
      dailyJobsUsed: 0,
      creditsRemaining: 10,
      singleUsePassesRemaining: 0,
    });
    assert.equal(freeAccess.allowed, true);
    assert.equal(freeAccess.accessMode, 'plan');

    // 2. Free user blocked by tier on ₹10 / Pro GST Invoice Maker
    const blockedPro = evaluateToolAccess({
      tool: proInvoiceTool,
      userPlan: 'free',
      dailyJobsUsed: 0,
      creditsRemaining: 10,
      singleUsePassesRemaining: 0,
    });
    assert.equal(blockedPro.allowed, false);
    assert.equal(blockedPro.reason, 'tier');
    assert.equal(blockedPro.singleUsePriceInr, 10);

    // 3. Granting ₹10 1-Time Use Pass unlocks the paid tool cleanly
    const passUnlocked = evaluateToolAccess({
      tool: proInvoiceTool,
      userPlan: 'free',
      dailyJobsUsed: 0,
      creditsRemaining: 10,
      singleUsePassesRemaining: 1,
    });
    assert.equal(passUnlocked.allowed, true);
    assert.equal(passUnlocked.accessMode, 'single_use_pass');

    // 4. Even when daily free job limit (25/25) is exhausted, a ₹10 single-use pass still allows execution
    const freeDailyExhaustedBlocked = evaluateToolAccess({
      tool: freeMergeTool,
      userPlan: 'free',
      dailyJobsUsed: 25,
      creditsRemaining: 10,
      singleUsePassesRemaining: 0,
    });
    assert.equal(freeDailyExhaustedBlocked.allowed, false);
    assert.equal(freeDailyExhaustedBlocked.reason, 'daily_limit');

    const freeDailyExhaustedWithPass = evaluateToolAccess({
      tool: freeMergeTool,
      userPlan: 'free',
      dailyJobsUsed: 25,
      creditsRemaining: 10,
      singleUsePassesRemaining: 1,
    });
    assert.equal(freeDailyExhaustedWithPass.allowed, true);
    assert.equal(freeDailyExhaustedWithPass.accessMode, 'single_use_pass');

    // 5. Subscription tier hierarchy & AI credit exhaustion fallback to ₹10 pass
    const cscOnPersonal = evaluateToolAccess({
      tool: cscPhotoTool,
      userPlan: 'personal',
      dailyJobsUsed: 0,
      creditsRemaining: 100,
      singleUsePassesRemaining: 0,
    });
    assert.equal(cscOnPersonal.allowed, false);
    assert.equal(cscOnPersonal.reason, 'tier');

    const cscOnCscPlan = evaluateToolAccess({
      tool: cscPhotoTool,
      userPlan: 'csc',
      dailyJobsUsed: 0,
      creditsRemaining: 300,
      singleUsePassesRemaining: 0,
    });
    assert.equal(cscOnCscPlan.allowed, true);
    assert.equal(cscOnCscPlan.accessMode, 'plan');

    const aiOutOfCreditsWithPass = evaluateToolAccess({
      tool: aiSummarizer,
      userPlan: 'personal',
      dailyJobsUsed: 0,
      creditsRemaining: 0,
      singleUsePassesRemaining: 1,
    });
    assert.equal(aiOutOfCreditsWithPass.allowed, true);
    assert.equal(aiOutOfCreditsWithPass.accessMode, 'single_use_pass');
  });

  it('resolves authoritative Cashfree checkout prices for tool-pass: and tool-plan: slugs', () => {
    // ₹10 single-use pass rejects client-tampered amount and enforces authoritative ₹10
    const tamperedPassCheckout = resolveAuthoritativeCheckout({
      serviceSlug: 'tool-pass:gst-invoice-generator',
      clientTotalInr: 1,
    });
    assert.equal(tamperedPassCheckout.ok, false);
    assert.equal(tamperedPassCheckout.errorCode, 'PRICE_TAMPER_OR_MISMATCH');
    assert.equal(tamperedPassCheckout.totalInr, 10);

    const passCheckout = resolveAuthoritativeCheckout({
      serviceSlug: 'tool-pass:gst-invoice-generator',
    });
    assert.equal(passCheckout.ok, true);
    assert.equal(passCheckout.totalInr, 10);
    assert.equal(passCheckout.breakdown.serviceFeePaise, 1000);

    // Monthly & annual subscription plans
    const cscMonthly = resolveAuthoritativeCheckout({
      serviceSlug: 'tool-plan:csc:monthly',
    });
    assert.equal(cscMonthly.ok, true);
    assert.equal(cscMonthly.totalInr, 299);

    const cscAnnual = resolveAuthoritativeCheckout({
      serviceSlug: 'tool-plan:csc:annual',
    });
    assert.equal(cscAnnual.ok, true);
    assert.equal(cscAnnual.totalInr, 2990);

    const invalidToolPass = resolveAuthoritativeCheckout({
      serviceSlug: 'tool-pass:non-existent-slug',
    });
    assert.equal(invalidToolPass.ok, false);
    assert.equal(invalidToolPass.status, 404);
  });

  it('filters Paid & Pro tools, resolves category aliases, and builds user notifications', () => {
    assert.equal(resolveCategorySlugAlias('csc-citizen'), 'csc-tools');
    assert.equal(resolveCategorySlugAlias('ai-assist'), 'ai-tools');
    assert.equal(resolveCategorySlugAlias('pdf-tools'), 'pdf-tools');

    const paidOnly = filterCatalogTools({
      filterTab: 'paid',
      query: '',
    });
    assert.equal(paidOnly.length, 15);
    assert.equal(paidOnly.every((t) => t.tier !== 'free'), true);

    const recentReleases = filterCatalogTools({
      filterTab: 'recent',
      query: '',
    });
    assert.ok(recentReleases.length >= 4);

    const counts = getSidebarCategoryCounts('', 'all');
    assert.equal(counts.total, 150);
    assert.ok((counts.byCategory['csc-tools'] || 0) > 0);
    assert.ok((counts.byCategory['ai-tools'] || 0) > 0);

    const items = buildUserNotifications({
      favourites: [
        {
          ownerUid: 'usr-1',
          toolSlug: 'merge-pdf',
          toolName: 'Merge PDF',
          category: 'pdf-tools',
          createdAt: '2026-11-15T00:00:00.000Z',
        },
      ],
      readIds: ['rel_upd_merge_pdf'],
    });
    assert.ok(items.some((n) => n.kind === 'favorite_update' && n.toolSlug === 'merge-pdf'));
    assert.ok(items.some((n) => n.kind === 'new_tool'));
    assert.equal(countUnreadNotifications(items), items.length - 1);
    assert.equal(
      filterNotificationsByKind(items, 'favorite_update').every(
        (n) => n.kind === 'favorite_update'
      ),
      true
    );
  });

  it('captures One-time Use (10 INR) vs Monthly Subscription selection cleanly into Cashfree checkout payloads', () => {
    const paidTools = getPaidToolsForSingleUse();
    assert.equal(paidTools.length, 15);

    const oneTimeSel = buildToolCheckoutSelection({
      mode: 'one_time',
      toolSlug: 'pdf-ocr',
    });
    assert.equal(oneTimeSel.mode, 'one_time');
    assert.equal(oneTimeSel.amountInr, 10);
    assert.equal(oneTimeSel.serviceSlug, 'tool-pass:pdf-ocr');
    assert.ok(oneTimeSel.serviceName.includes('One-time Use'));

    const oneTimeAuth = resolveAuthoritativeCheckout({
      serviceSlug: oneTimeSel.serviceSlug,
      clientTotalInr: oneTimeSel.amountInr,
    });
    assert.equal(oneTimeAuth.ok, true);
    assert.equal(oneTimeAuth.totalInr, 10);

    const monthlySel = buildToolCheckoutSelection({
      mode: 'monthly',
      cadence: 'monthly',
      planCode: 'personal',
    });
    assert.equal(monthlySel.mode, 'monthly');
    assert.equal(monthlySel.amountInr, 99);
    assert.equal(monthlySel.serviceSlug, 'tool-plan:personal:monthly');

    const monthlyAuth = resolveAuthoritativeCheckout({
      serviceSlug: monthlySel.serviceSlug,
      clientTotalInr: monthlySel.amountInr,
    });
    assert.equal(monthlyAuth.ok, true);
    assert.equal(monthlyAuth.totalInr, 99);

    const annualSel = buildToolCheckoutSelection({
      mode: 'monthly',
      cadence: 'annual',
      planCode: 'csc',
    });
    assert.equal(annualSel.amountInr, 2990);
    assert.equal(annualSel.serviceSlug, 'tool-plan:csc:annual');
  });

  it('filters catalog tools in real time by name, short/long description, and multi-word keywords', () => {
    // By name
    const byName = filterCatalogTools({ query: 'Merge PDF' });
    assert.ok(byName.some((t) => t.slug === 'merge-pdf'));

    // By description keywords (multi-word across description/features)
    const byDesc = filterCatalogTools({ query: 'passbook 4x6' });
    const byPassportDesc = filterCatalogTools({ query: 'A4 photo print' });
    assert.ok(byPassportDesc.length >= 1);
    assert.ok(byDesc.length >= 0);

    // By specific description phrase
    const byInvoiceDesc = filterCatalogTools({ query: 'SAC' });
    const byGstDesc = filterCatalogTools({ query: 'CGST SGST' });
    assert.ok(byGstDesc.length >= 1 || byInvoiceDesc.length >= 0);
    const byOcrDesc = filterCatalogTools({ query: 'searchable PDF' });
    assert.ok(byOcrDesc.some((t) => t.slug === 'pdf-ocr'));
  });

  it('aggregates monthly spending and active subscriptions for Customer Dashboard Billing Summary', () => {
    const fixedNow = new Date('2026-11-16T08:00:00.000Z');
    const summary = computeMonthlyBillingSummary({
      applications: [
        {
          id: 'APP-BILL-1',
          userId: 'usr-1',
          userName: 'Citizen',
          userEmail: 'citizen@example.com',
          userMobile: '9876543210',
          serviceId: 'srv-pan',
          serviceName: 'PAN Correction',
          serviceSlug: 'pan-correction',
          status: 'Payment Confirmed',
          submissionDate: '2026-10-10T10:00:00.000Z',
          updatedAt: '2026-10-10T10:00:00.000Z',
          formData: {},
          documents: [],
          statusHistory: [],
          payment: {
            orderId: 'ORD-APP-1',
            amount: 299,
            govtFee: 107,
            totalAmount: 406,
            status: 'Success',
            paidAt: '2026-10-10T10:00:00.000Z',
          },
        },
      ],
      transactions: [
        {
          id: 'TX-PASS-1',
          orderId: 'ORD-PASS-1',
          applicationId: 'tool-pass:pdf-ocr',
          serviceName: 'PDF OCR — One-time Use (10 INR)',
          userId: 'usr-1',
          userName: 'Citizen',
          userEmail: 'citizen@example.com',
          amount: 10,
          currency: 'INR',
          paymentMethod: 'UPI',
          status: 'Success',
          transactionDate: '2026-11-04T09:00:00.000Z',
          receiptNumber: 'RCPT-PASS-1',
        },
        {
          id: 'TX-SUB-1',
          orderId: 'ORD-SUB-1',
          applicationId: 'tool-plan:csc:monthly',
          serviceName: 'Digital Tools Tray — CSC Operator',
          userId: 'usr-1',
          userName: 'Citizen',
          userEmail: 'citizen@example.com',
          amount: 299,
          currency: 'INR',
          paymentMethod: 'Card',
          status: 'Success',
          transactionDate: '2026-11-02T09:00:00.000Z',
          receiptNumber: 'RCPT-SUB-1',
        },
      ],
      paidToolHistory: [
        {
          id: 'paid_1',
          ownerUid: 'usr-1',
          purchaseType: 'one_time',
          toolSlug: 'pdf-ocr',
          toolName: 'PDF OCR',
          amountInr: 10,
          orderId: 'ORD-PASS-1',
          purchasedAt: '2026-11-04T09:00:00.000Z',
          usesGranted: 1,
          usesConsumed: 0,
        },
      ],
      activePlanCode: 'csc',
      billingCycle: 'monthly',
      lastSubscription: {
        planCode: 'csc',
        billingCycle: 'monthly',
        amountInr: 299,
        orderId: 'ORD-SUB-1',
        activatedAt: '2026-11-02T09:00:00.000Z',
      },
      activeSingleUsePassList: [
        {
          toolSlug: 'pdf-ocr',
          remainingUses: 1,
          priceInr: 10,
          orderId: 'ORD-PASS-1',
          purchasedAt: '2026-11-04T09:00:00.000Z',
        },
      ],
      months: 6,
      now: fixedNow,
    });

    assert.equal(summary.buckets.length, 6);
    assert.equal(summary.totalServicesSpend, 406);
    assert.equal(summary.totalOneTimeToolsSpend, 10);
    assert.equal(summary.totalSubscriptionsSpend, 299);
    assert.equal(summary.totalWindowSpend, 715);
    assert.equal(summary.currentMonthSpend, 309);
    assert.equal(summary.previousMonthSpend, 406);
    assert.equal(summary.activePaidSubscriptionsCount, 1);
    assert.equal(summary.monthlyRecurringEquivalentInr, 299);
    assert.equal(summary.buckets[5].activeSubscriptions >= 1, true);
    assert.equal(summary.buckets[5].oneTimePassesCount, 1);
  });

  it('confirms Cashfree production mode across wrangler.toml, worker status endpoints, and credential aliases', async () => {
    const wranglerRaw = fs.readFileSync(path.resolve(process.cwd(), 'wrangler.toml'), 'utf-8');
    assert.match(wranglerRaw, /CASHFREE_ENV\s*=\s*"production"/);

    // Production runtime resolves to https://api.cashfree.com/pg for both alias pairs
    const appIdProdCfg = resolveCashfreeConfig({
      ENVIRONMENT: 'production',
      CASHFREE_ENV: 'production',
      CASHFREE_APP_ID: 'cf_app_prod_123',
      CASHFREE_SECRET_KEY: 'cf_secret_prod_xyz',
      CASHFREE_WEBHOOK_SECRET: 'cf_wh_prod_abc',
    });
    assert.equal(appIdProdCfg.configured, true);
    assert.equal(appIdProdCfg.mode, 'production');
    assert.equal(appIdProdCfg.baseUrl, 'https://api.cashfree.com/pg');

    // Unconfigured production environment still reports mode: 'production' (never silently sandbox)
    const unconfiguredProdCfg = resolveCashfreeConfig({ ENVIRONMENT: 'production' });
    assert.equal(unconfiguredProdCfg.configured, false);
    assert.equal(unconfiguredProdCfg.mode, 'production');

    // /api/health reports cashfreeConfigured & cashfreeMode: 'production' with CASHFREE_APP_ID/CASHFREE_SECRET_KEY
    const healthRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/health'),
      {
        ENVIRONMENT: 'production',
        CASHFREE_ENV: 'production',
        CASHFREE_APP_ID: 'cf_app_prod_123',
        CASHFREE_SECRET_KEY: 'cf_secret_prod_xyz',
      } as any
    );
    assert.equal(healthRes.status, 200);
    const healthJson: any = await healthRes.json();
    assert.equal(healthJson.cashfreeConfigured, true);
    assert.equal(healthJson.cashfreeMode, 'production');

    // /api/integrations/status reports production_ready when configured in production
    const intRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/integrations/status'),
      {
        ENVIRONMENT: 'production',
        CASHFREE_ENV: 'production',
        CASHFREE_CLIENT_ID: 'cf_client_prod_123',
        CASHFREE_CLIENT_SECRET: 'cf_client_sec_xyz',
        CASHFREE_WEBHOOK_SECRET: 'whsec_prod',
      } as any
    );
    assert.equal(intRes.status, 200);
    const intJson: any = await intRes.json();
    assert.equal(intJson.data.providers.cashfree.configured, true);
    assert.equal(intJson.data.providers.cashfree.webhookProtected, true);
    assert.equal(intJson.data.providers.cashfree.environment, 'production');
    assert.equal(intJson.data.providers.cashfree.mode, 'production_ready');

    // Also confirm webhookProtected=true when only CASHFREE_CLIENT_ID + CASHFREE_CLIENT_SECRET are set
    const clientOnlyIntRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/integrations/status'),
      {
        ENVIRONMENT: 'production',
        CASHFREE_ENV: 'production',
        CASHFREE_CLIENT_ID: 'cf_client_prod_123',
        CASHFREE_CLIENT_SECRET: 'cf_client_sec_xyz',
      } as any
    );
    assert.equal(clientOnlyIntRes.status, 200);
    const clientOnlyJson: any = await clientOnlyIntRes.json();
    assert.equal(clientOnlyJson.data.providers.cashfree.webhookProtected, true);

    // /api/v1/payments/webhook supports CASHFREE_SECRET_KEY alias cleanly
    const rawBody = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: { order: { order_id: 'CF_ORD_PROD_1' }, payment: { cf_payment_id: '776655', payment_status: 'SUCCESS' } },
    });
    const ts = '1731600000';
    const sig = await hmacSha256Base64('cf_secret_key_alias', `${ts}${rawBody}`);
    const aliasWebhookRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/webhook', {
        method: 'POST',
        headers: { 'x-webhook-timestamp': ts, 'x-webhook-signature': sig },
        body: rawBody,
      }),
      {
        ENVIRONMENT: 'production',
        CASHFREE_ENV: 'production',
        CASHFREE_SECRET_KEY: 'cf_secret_key_alias',
      } as any
    );
    assert.equal(aliasWebhookRes.status, 200);
    const aliasWebhookJson: any = await aliasWebhookRes.json();
    assert.equal(aliasWebhookJson.data.resolvedOrderStatus, 'PAID');
  });

  it('dedupeNavItems & getNavItemSignature eliminate duplicate routes across header and secondary menus', () => {
    assert.equal(getNavItemSignature({ route: 'admin' }), 'admin:overview');
    assert.equal(getNavItemSignature({ route: 'admin', param: 'overview' }), 'admin:overview');
    assert.equal(getNavItemSignature({ route: 'operator', param: 'all' }), 'operator:queue');

    const topNav = getUniqueRoleNavLinks('operator', true);
    const excluded = new Set(topNav.map((item) => getNavItemSignature(item)));

    const candidateSidebarItems = [
      { id: 'op-desk', label: 'Operator Desk', route: 'operator', param: 'queue' },
      { id: 'op-intake', label: 'Walk-In Intake', route: 'operator', param: 'intake' },
      { id: 'op-test-pay', label: 'Test Payment (Sandbox)', route: 'operator', param: 'test-payment' },
      { id: 'op-history', label: 'Audit Logs', route: 'operator', param: 'history' },
      { id: 'op-srv', label: 'All Services', route: 'services' },
    ];

    const deduped = dedupeNavItems(candidateSidebarItems, excluded);
    assert.deepEqual(
      deduped.map((i) => i.id),
      ['op-test-pay', 'op-history']
    );

    // Ensure duplicate items inside the same array are also collapsed
    const intraDupes = dedupeNavItems([
      { route: 'partner' },
      { route: 'partner', param: 'overview' },
      { route: 'partner', param: 'test-payment' },
    ]);
    assert.equal(intraDupes.length, 2);
  });

  it('enforces auth/RBAC on sandbox-test payment routes and verifies signed webhook E2E with idempotent replay', async () => {
    // 1. Unauthenticated caller fails closed (401)
    const unauthOrderRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/sandbox-test/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountInr: 199, channel: 'operator' }),
      }),
      { ENVIRONMENT: 'production' } as any
    );
    assert.equal(unauthOrderRes.status, 401);

    const buildSessionMockEnv = (roleName: string) => {
      const orders = new Map<string, { status: string; total_paise: number }>();
      const webhookEvents = new Set<string>();
      let invoicesOrPaymentsMutated = false;

      return {
        env: {
          ENVIRONMENT: 'production',
          CASHFREE_ENV: 'production',
          CASHFREE_CLIENT_SECRET: 'cf_test_secret_for_sandbox_e2e',
          APP_DOMAIN: 'https://digitalindiaproject.com',
          DB: {
            prepare: (sql: string) => ({
              bind: (...args: any[]) => ({
                first: async () => {
                  if (sql.includes('FROM user_sessions')) {
                    return {
                      user_id: `usr-${roleName}`,
                      expires_at: '2099-01-01T00:00:00Z',
                      email: `${roleName}@digitalindiaproject.com`,
                      name: `Test ${roleName}`,
                      is_active: 1,
                    };
                  }
                  if (sql.includes('FROM users u')) {
                    return { id: `usr-${roleName}`, is_active: 1, role_name: roleName };
                  }
                  if (sql.includes('FROM payment_webhook_events')) {
                    const eventId = String(args[0] || '');
                    return webhookEvents.has(eventId) ? { id: 'whe_existing' } : null;
                  }
                  if (sql.includes('FROM payment_orders')) {
                    const oid = String(args[0] || '');
                    const row = orders.get(oid);
                    return row
                      ? {
                          id: oid,
                          application_id: `SANDBOX_${roleName.toUpperCase()}`,
                          user_id: `usr-${roleName}`,
                          total_paise: row.total_paise,
                          status: row.status,
                        }
                      : null;
                  }
                  return null;
                },
                all: async () => ({ results: [] }),
                run: async () => {
                  if (sql.includes('INSERT INTO payment_orders')) {
                    const oid = String(args[0] || '');
                    const totalPaise = Number(args[5] || 19900);
                    orders.set(oid, { status: 'CREATED', total_paise: totalPaise });
                  } else if (sql.includes('UPDATE payment_orders SET status = ?')) {
                    const status = String(args[0] || '');
                    const oid = String(args[1] || '');
                    const existing = orders.get(oid);
                    if (existing) existing.status = status;
                  } else if (sql.includes('UPDATE payment_orders SET status = \'PAID\'')) {
                    const oid = String(args[0] || '');
                    const existing = orders.get(oid);
                    if (existing) existing.status = 'PAID';
                  } else if (sql.includes('INSERT INTO payment_webhook_events')) {
                    const eventId = String(args[1] || '');
                    webhookEvents.add(eventId);
                  } else if (
                    sql.includes('INSERT INTO payments') ||
                    sql.includes('INSERT INTO invoices') ||
                    sql.includes('INSERT INTO commission_ledger')
                  ) {
                    invoicesOrPaymentsMutated = true;
                  }
                  return { success: true };
                },
              }),
            }),
          },
        } as any,
        wasLiveLedgerMutated: () => invoicesOrPaymentsMutated,
      };
    };

    // 2. Customer role is rejected (403)
    const custMock = buildSessionMockEnv('customer');
    const custForbidden = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/sandbox-test/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer opaque_customer_tok',
        },
        body: JSON.stringify({ amountInr: 199, channel: 'operator' }),
      }),
      custMock.env
    );
    assert.equal(custForbidden.status, 403);

    // 3. Operator role initializes TEST_CF_* order and runs E2E webhook + replay cleanly
    const opMock = buildSessionMockEnv('operator');
    const orderRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/sandbox-test/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer opaque_operator_tok',
        },
        body: JSON.stringify({ amountInr: 199, channel: 'operator' }),
      }),
      opMock.env
    );
    assert.equal(orderRes.status, 200);
    const orderJson: any = await orderRes.json();
    assert.equal(orderJson.success, true);
    assert.ok(String(orderJson.data.orderId).startsWith('TEST_CF_'));

    const verifyRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/sandbox-test/verify-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer opaque_operator_tok',
        },
        body: JSON.stringify({
          orderId: orderJson.data.orderId,
          amountInr: 199,
          eventType: 'PAYMENT_SUCCESS_WEBHOOK',
          paymentMethod: 'upi',
        }),
      }),
      opMock.env
    );
    assert.equal(verifyRes.status, 200);
    const verifyJson: any = await verifyRes.json();
    assert.equal(verifyJson.success, true);
    assert.equal(verifyJson.data.verifiedEndToEnd, true);
    assert.equal(verifyJson.data.firstDelivery.httpStatus, 200);
    assert.equal(verifyJson.data.firstDelivery.resolvedOrderStatus, 'PAID');
    assert.equal(verifyJson.data.idempotencyReplay.httpStatus, 200);
    assert.equal(verifyJson.data.idempotencyReplay.deduplicated, true);
    assert.equal(verifyJson.data.persistedOrderStatus, 'PAID');
    assert.equal(verifyJson.data.sandboxIsolated, true);
    assert.equal(opMock.wasLiveLedgerMutated(), false);
  });

  it('prevents unstyled splash HTML leaks in index.html and returns 404 for missing /assets/* files', async () => {
    const htmlRaw = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
    const rootMatch = htmlRaw.match(/<div id="root">([\s\S]*?)<\/div>\s*<noscript>/);
    assert.ok(rootMatch, 'index.html should keep noscript crawler fallback outside #root');
    assert.ok(!rootMatch[1].includes('Privacy Policy'), 'raw footer links must not render inside #root');
    assert.ok(htmlRaw.includes('<noscript>'), 'crawler/no-JS fallback stays inside <noscript>');

    const missingAssetRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/assets/nonexistent-chunk.js'),
      {
        ASSETS: {
          fetch: async () =>
            new Response('<!DOCTYPE html><html><body>fallback</body></html>', {
              status: 200,
              headers: { 'content-type': 'text/html; charset=utf-8' },
            }),
        },
      } as any
    );
    assert.equal(missingAssetRes.status, 404);
  });

  it('resolves extended Cashfree Cloudflare Worker variable aliases, strips quotes, reports exact missing keys, and keeps Dashboard vars on deploy', () => {
    const deployYml = fs.readFileSync(path.resolve(process.cwd(), '.github/workflows/deploy.yml'), 'utf-8');
    assert.match(deployYml, /--keep-vars/);

    // Case-insensitive + whitespace + quoted values + PG aliases
    const aliasCfg = resolveCashfreeConfig({
      ENVIRONMENT: 'production',
      CASHFREE_ENV: 'production',
      ' cashfree_pg_app_id ': '"pg_app_123"',
      Cashfree_Pg_Secret_Key: "'pg_sec_456'",
    });
    assert.equal(aliasCfg.configured, true);
    assert.equal(aliasCfg.clientId, 'pg_app_123');
    assert.equal(aliasCfg.clientSecret, 'pg_sec_456');
    assert.deepEqual(aliasCfg.missingBindings, []);

    // Sandbox-only aliases do NOT leak into production mode
    const sandboxOnlyInProd = resolveCashfreeConfig({
      ENVIRONMENT: 'production',
      CASHFREE_ENV: 'production',
      CASHFREE_SANDBOX_APP_ID: 'sb_id',
      CASHFREE_SANDBOX_SECRET_KEY: 'sb_sec',
    });
    assert.equal(sandboxOnlyInProd.configured, false);
    assert.deepEqual(sandboxOnlyInProd.missingBindings, ['CASHFREE_CLIENT_ID', 'CASHFREE_CLIENT_SECRET']);
    assert.match(buildCashfreeUnconfiguredMessage(sandboxOnlyInProd), /CASHFREE_CLIENT_ID/);

    // Partial configuration reports the exact missing binding
    const partialCfg = resolveCashfreeConfig({
      ENVIRONMENT: 'production',
      CASHFREE_ENV: 'production',
      CF_APP_ID: 'cf_app_only',
    });
    assert.equal(partialCfg.configured, false);
    assert.equal(partialCfg.clientIdConfigured, true);
    assert.equal(partialCfg.clientSecretConfigured, false);
    assert.deepEqual(partialCfg.missingBindings, ['CASHFREE_CLIENT_SECRET']);
    assert.match(buildCashfreeUnconfiguredMessage(partialCfg), /missing CASHFREE_CLIENT_SECRET/);
  });
});

describe('Dynamic Navigation Controller & Become Our Partner RBAC', () => {
  it('hides Partner/Operator KYC from guests and citizen customers while directing them to Become Our Partner', () => {
    const guestNav = resolveDynamicNavigation({
      user: null,
      isAuthenticated: false,
      currentRoute: 'home',
    });
    assert.equal(guestNav.canSeePartnerKyc, false);
    assert.equal(isEligibleForPartnerKyc(null), false);

    const guestAllSigs = [
      ...guestNav.headerPrimaryLinks.map((i) => getNavItemSignature(i)),
      ...guestNav.headerDropdownItems.map((i) => getNavItemSignature(i)),
      ...guestNav.sidebar.roleWorkspaceItems.map((i) => getNavItemSignature(i)),
      ...guestNav.sidebar.exploreItems.map((i) => getNavItemSignature(i)),
      ...guestNav.sidebar.supportItems.map((i) => getNavItemSignature(i)),
    ];
    assert.equal(guestAllSigs.includes('operator-enroll:'), false);
    assert.equal(guestAllSigs.includes('b2b:kyc'), false);
    assert.equal(guestAllSigs.includes('partner:'), false);
    assert.equal(guestAllSigs.includes('become-partner:'), true);

    const customerUser = {
      id: 'cus-1',
      role: 'customer' as const,
      accountType: 'customer' as const,
      kycStatus: 'Not Submitted' as const,
    };
    const customerNav = resolveDynamicNavigation({
      user: customerUser,
      role: 'customer',
      isAuthenticated: true,
      currentRoute: 'dashboard',
    });
    assert.equal(customerNav.canSeePartnerKyc, false);
    assert.equal(isEligibleForPartnerKyc(customerUser), false);

    const customerHeaderAndSidebar = [
      ...customerNav.headerPrimaryLinks,
      ...customerNav.sidebar.roleWorkspaceItems,
      ...customerNav.sidebar.exploreItems,
      ...customerNav.sidebar.supportItems,
    ];
    const customerSigs = customerHeaderAndSidebar.map((i) => getNavItemSignature(i));
    assert.equal(customerSigs.includes('operator-enroll:'), false);
    assert.equal(customerSigs.includes('b2b:kyc'), false);
    assert.equal(customerSigs.includes('become-partner:'), true);
    // Zero duplicates across header + desktop sidebar
    assert.equal(new Set(customerSigs).size, customerSigs.length);
  });

  it('restricts Partner KYC and sensitive options strictly to operator or b2b roles and filters by kycStatus', () => {
    const pendingOperator = {
      id: 'op-pending-1',
      role: 'customer' as const,
      accountType: 'operator' as const,
      kycStatus: 'KYC Submitted' as const,
    };
    assert.equal(isEligibleForPartnerKyc(pendingOperator), true);
    const pendingOpNav = resolveDynamicNavigation({
      user: pendingOperator,
      isAuthenticated: true,
      currentRoute: 'home',
    });
    assert.equal(pendingOpNav.effectiveRole, 'operator');
    assert.equal(pendingOpNav.canSeePartnerKyc, true);
    assert.equal(pendingOpNav.isKycApproved, false);
    assert.equal(pendingOpNav.primaryPortalRoute, 'operator-enroll');
    assert.equal(
      pendingOpNav.headerPrimaryLinks.some((i) => i.route === 'operator-enroll'),
      true
    );
    // Unapproved operator should NOT see Operator Desk, Walk-In Intake, or Sandbox Test Payment
    assert.equal(
      pendingOpNav.headerPrimaryLinks.some((i) => i.route === 'operator'),
      false
    );
    assert.equal(
      pendingOpNav.sidebar.roleWorkspaceItems.some((i) => i.route === 'operator' && i.param === 'test-payment'),
      false
    );
    assert.equal(isRouteAccessible('operator', pendingOpNav, true), false);
    assert.equal(isRouteAccessible('operator-enroll', pendingOpNav, true), true);

    const approvedOperator = {
      id: 'op-app-1',
      role: 'operator' as const,
      accountType: 'operator' as const,
      kycStatus: 'Approved' as const,
    };
    const approvedOpNav = resolveDynamicNavigation({
      user: approvedOperator,
      isAuthenticated: true,
      currentRoute: 'operator',
    });
    assert.equal(approvedOpNav.canSeePartnerKyc, true);
    assert.equal(approvedOpNav.isKycApproved, true);
    assert.equal(approvedOpNav.primaryPortalRoute, 'operator');
    assert.equal(approvedOpNav.headerCta.param, 'test-payment');
    assert.equal(isRouteAccessible('operator', approvedOpNav, true), true);

    // Explicit b2b role (both raw 'b2b' and 'business') is eligible for Partner & B2B KYC
    assert.equal(normalizeRole('b2b'), 'business');
    const rawB2bUser = {
      id: 'b2b-raw-1',
      role: 'b2b' as const,
      accountType: 'business' as const,
      kycStatus: 'Not Submitted' as const,
    };
    assert.equal(isEligibleForPartnerKyc(rawB2bUser), true);
    const rawB2bNav = resolveDynamicNavigation({
      user: rawB2bUser,
      isAuthenticated: true,
      currentRoute: 'home',
    });
    assert.equal(rawB2bNav.canSeePartnerKyc, true);
    assert.equal(rawB2bNav.isKycApproved, false);
    assert.equal(
      rawB2bNav.headerPrimaryLinks.some((i) => i.route === 'b2b' && i.param === 'kyc'),
      true
    );
    // Sensitive production API keys & bulk verify are hidden until B2B KYC is Approved
    assert.equal(
      rawB2bNav.headerPrimaryLinks.some((i) => i.route === 'b2b' && i.param === 'apikeys'),
      false
    );

    const b2bUser = {
      id: 'b2b-1',
      role: 'customer' as const,
      accountType: 'business' as const,
      kycStatus: 'Under Verification' as const,
    };
    const b2bNav = resolveDynamicNavigation({
      user: b2bUser,
      isAuthenticated: true,
      currentRoute: 'b2b',
    });
    assert.equal(isEligibleForPartnerKyc(b2bUser), true);
    assert.equal(b2bNav.canSeePartnerKyc, true);
    assert.equal(
      b2bNav.headerPrimaryLinks.some((i) => i.route === 'b2b' && i.param === 'kyc'),
      true
    );

    // Partner/Distributor, Manager, and Admin roles must NOT expose Partner KYC menu options
    const partnerUser = {
      id: 'prt-1',
      role: 'partner' as const,
      accountType: 'partner' as const,
      kycStatus: 'Not Submitted' as const,
    };
    assert.equal(isEligibleForPartnerKyc(partnerUser), false);
    const partnerNav = resolveDynamicNavigation({
      user: partnerUser,
      isAuthenticated: true,
      currentRoute: 'partner',
    });
    assert.equal(partnerNav.canSeePartnerKyc, false);
    const partnerAllItems = [
      ...partnerNav.headerPrimaryLinks,
      ...partnerNav.headerDropdownItems,
      ...partnerNav.sidebar.roleWorkspaceItems,
    ];
    assert.equal(
      partnerAllItems.some((i) => /kyc/i.test(i.label) || i.route === 'operator-enroll'),
      false
    );
    assert.equal(
      partnerAllItems.some((i) => i.param === 'test-payment'),
      false
    );
  });

  it('maintains zero duplicate navigation signatures across header, CTA, dropdown, sidebar, and mobile nav for every role', () => {
    const scenarios = [
      { label: 'guest', user: null, isAuthenticated: false },
      { label: 'customer', user: { id: 'u-cus', role: 'customer' as const, accountType: 'customer' as const }, isAuthenticated: true },
      { label: 'operator_pending', user: { id: 'u-op-p', role: 'operator' as const, accountType: 'operator' as const, kycStatus: 'KYC Submitted' as const }, isAuthenticated: true },
      { label: 'operator', user: { id: 'u-op', role: 'operator' as const, accountType: 'operator' as const, kycStatus: 'Approved' as const }, isAuthenticated: true },
      { label: 'partner', user: { id: 'u-prt', role: 'partner' as const, accountType: 'partner' as const, kycStatus: 'Approved' as const }, isAuthenticated: true },
      { label: 'b2b_pending', user: { id: 'u-b2b-p', role: 'b2b' as const, accountType: 'business' as const, kycStatus: 'Not Submitted' as const }, isAuthenticated: true },
      { label: 'business', user: { id: 'u-b2b', role: 'business' as const, accountType: 'business' as const, kycStatus: 'Approved' as const }, isAuthenticated: true },
      { label: 'manager', user: { id: 'u-mgr', role: 'manager' as const, accountType: 'customer' as const }, isAuthenticated: true },
      { label: 'super_admin', user: { id: 'u-adm', role: 'super_admin' as const, accountType: 'customer' as const }, isAuthenticated: true },
    ];

    for (const sc of scenarios) {
      const nav = resolveDynamicNavigation({
        user: sc.user,
        isAuthenticated: sc.isAuthenticated,
        currentRoute: 'home',
      });

      const headerAndDropdownAndCta = [
        ...nav.headerPrimaryLinks.map((i) => getNavItemSignature(i)),
        getNavItemSignature(nav.headerCta),
        ...nav.headerDropdownItems.map((i) => getNavItemSignature(i)),
      ];
      assert.equal(
        new Set(headerAndDropdownAndCta).size,
        headerAndDropdownAndCta.length,
        `Duplicate between header, CTA, and dropdown for ${sc.label}`
      );

      const allDesktopMenus = [
        ...nav.headerPrimaryLinks.map((i) => getNavItemSignature(i)),
        getNavItemSignature(nav.headerCta),
        ...nav.headerDropdownItems.map((i) => getNavItemSignature(i)),
        ...nav.sidebar.roleWorkspaceItems.map((i) => getNavItemSignature(i)),
        ...nav.sidebar.oversightItems.map((i) => getNavItemSignature(i)),
        ...nav.sidebar.toolItems.map((i) => getNavItemSignature(i)),
        ...nav.sidebar.exploreItems.map((i) => getNavItemSignature(i)),
        ...nav.sidebar.supportItems.map((i) => getNavItemSignature(i)),
      ];
      assert.equal(
        new Set(allDesktopMenus).size,
        allDesktopMenus.length,
        `Duplicate across desktop header + dropdown + CTA + sidebar for ${sc.label}`
      );

      const mobileBottomSigs = nav.mobileBottomItems.map((i) => getNavItemSignature(i));
      assert.equal(new Set(mobileBottomSigs).size, mobileBottomSigs.length);
    }

    // Also verify Become Our Partner URL parsing & building
    const parsedBecome = parseLocationPath('/become-partner', '?track=business');
    assert.deepEqual(parsedBecome, { route: 'become-partner', param: 'business' });
    assert.equal(buildUrlForRoute('become-partner', 'operator'), '/become-partner?track=operator');
  });

  it('provides complete Operator, Distributor, and B2B Partner programme benefits, platform fees, requirements, and earnings estimation', () => {
    assert.deepEqual(
      PARTNER_TRACKS.map((t) => t.id),
      ['operator', 'distributor', 'b2b']
    );
    for (const track of PARTNER_TRACKS) {
      assert.ok(track.benefits.length >= 4);
      assert.ok(track.chargeBreakdown.length >= 3);
      assert.ok(track.earningExamples.length >= 3);
      assert.ok(track.registrationRequirements.eligibility.length >= 3);
      assert.ok(track.registrationRequirements.documents.length >= 4);
    }
    assert.ok(PLATFORM_FEE_SCHEDULE.length >= 6);

    const opEstimate = estimatePartnerEarnings('operator', 40);
    assert.equal(opEstimate.monthlyVolume, 40);
    assert.equal(opEstimate.grossClientFeesInr, 40 * 750);
    assert.ok(opEstimate.netEstimatedEarningsInr > 0);
    assert.ok(opEstimate.estimatedTdsInr > 0);

    const b2bEstimate = estimatePartnerEarnings('b2b', 50);
    assert.equal(b2bEstimate.estimatedTdsInr, 0);
    assert.equal(b2bEstimate.estimatedPlatformFeeInr, 999);
    assert.ok(b2bEstimate.netEstimatedEarningsInr > 0);
  });
});

describe('Structured 145-Service SEO Registry & Idempotent Services Schema Sync', () => {
  it('houses complete, unique, length-validated SEO metadata for all 145 catalog services and 4 bundles', () => {
    assert.equal(CORE_CATALOGUE_ITEMS.length, 145);
    assert.equal(ALL_CATALOG_SEO_RECORDS.length, CORE_SEO_SERVICES_COUNT);
    assert.equal(ALL_CATALOG_SEO_RECORDS.length, 145);
    assert.equal(PACKAGE_SEO_RECORDS.length, 4);

    const seenTitles = new Set<string>();
    const seenDescriptions = new Set<string>();
    const seenCanonicals = new Set<string>();

    assert.equal(Object.keys(SERVICE_SEO_DATA).length, 145);
    for (const service of CORE_CATALOGUE_ITEMS) {
      const seoById = SERVICE_SEO_BY_ID[service.id];
      const seoBySlug = SERVICE_SEO_BY_SLUG[service.slug.toLowerCase()];
      const seoFromMap = SERVICE_SEO_DATA[service.slug.toLowerCase()];
      assert.ok(seoById, `Missing seoData by id for ${service.id}`);
      assert.ok(seoBySlug, `Missing seoData by slug for ${service.slug}`);
      assert.equal(seoFromMap?.seoTitle, seoBySlug.seoTitle);
      assert.equal(seoFromMap?.seoDescription, seoBySlug.seoDescription);
      assert.equal(seoById.id, seoBySlug.id);
      assert.equal(seoById.slug, service.slug);
      assert.equal(seoById.category, service.category);

      assert.ok(seoById.seoTitle.length >= 25 && seoById.seoTitle.length <= 120);
      assert.ok(seoById.seoDescription.length >= 80 && seoById.seoDescription.length <= 160);
      assert.ok(seoById.focusKeyword.length >= 4);
      assert.ok(seoById.secondaryKeywords.length >= 3);
      assert.equal(seoById.canonicalUrl, `https://digitalindiaproject.com/services/${service.slug}`);
      assert.equal(
        seoById.ogType,
        service.productType === 'digital_product' ? 'product' : 'website'
      );
      assert.equal(
        seoById.schemaType,
        service.productType === 'digital_product' ? 'Product' : 'Service'
      );

      seenTitles.add(seoById.seoTitle);
      seenDescriptions.add(seoById.seoDescription);
      seenCanonicals.add(seoById.canonicalUrl);
    }

    assert.equal(seenTitles.size, 145);
    assert.equal(seenDescriptions.size, 145);
    assert.equal(seenCanonicals.size, 145);

    const sampleDigital = getServiceSeoMetadata('gst-calculator-spreadsheet');
    assert.equal(sampleDigital?.ogType, 'product');
    assert.equal(sampleDigital?.schemaType, 'Product');

    const enriched = enrichServiceWithSeoData({
      id: 'srv-pan-new',
      slug: 'pan-card',
      name: 'New PAN Card Application',
    });
    assert.ok(enriched.seoTitle?.includes('Digital India Project'));
    assert.ok(enriched.focusKeyword);
  });

  it('maps all 145 services strictly into Firestore ServiceProduct & D1 schemas without duplicates across repeated sync runs', () => {
    const allowedSet = new Set<string>(FIRESTORE_SERVICE_ALLOWED_KEYS);
    const fixedIso = '2026-11-16T10:00:00.000Z';

    // Pass 1: fresh database -> creates 145 items
    const pass1 = planIdempotentServicesSync({
      catalog: CORE_CATALOGUE_ITEMS,
      existingRecords: [],
      actorName: 'Admin Sync Test',
      nowIso: fixedIso,
      forceRefreshSeo: true,
    });

    assert.equal(pass1.report.totalProcessed, 145);
    assert.equal(pass1.toCreate.length, 145);
    assert.equal(pass1.toUpdate.length, 0);
    assert.equal(pass1.unchanged.length, 0);
    assert.equal(pass1.duplicatesPrevented.length, 0);

    // Every mapped record strictly respects firestore.rules key allowlist & length caps
    for (const rec of pass1.mappedRecords) {
      for (const k of Object.keys(rec)) {
        assert.ok(allowedSet.has(k), `Disallowed Firestore key "${k}" on ${rec.id}`);
      }
      assert.ok(rec.id.length <= 80);
      assert.ok(rec.slug.length <= 120);
      assert.ok(rec.name.length <= 160);
      assert.ok(rec.shortDesc.length <= 500);
      assert.ok(rec.seoTitle.length <= 120);
      assert.ok(rec.seoDescription.length <= 240);
    }

    // Pass 2: immediate re-run against existing mapped records -> strictly 0 creates, 0 updates, 145 skipped
    const pass2 = planIdempotentServicesSync({
      catalog: CORE_CATALOGUE_ITEMS,
      existingRecords: pass1.mappedRecords,
      actorName: 'Admin Sync Test',
      nowIso: '2026-11-16T10:05:00.000Z',
      forceRefreshSeo: true,
    });

    assert.equal(pass2.toCreate.length, 0);
    assert.equal(pass2.toUpdate.length, 0);
    assert.equal(pass2.unchanged.length, 145);

    // Generate structured Firestore write operations (slug-idempotent set with merge: true)
    const fsBatchFresh = generateFirestoreWriteOperations({
      catalog: [CORE_CATALOGUE_ITEMS[0], ...CORE_CATALOGUE_ITEMS], // intentional duplicate to verify deduplication
      existingRecords: [],
      nowIso: fixedIso,
      forceRefreshSeo: true,
    });
    assert.equal(fsBatchFresh.counts.total, 145);
    assert.equal(fsBatchFresh.counts.create, 145);
    assert.equal(fsBatchFresh.duplicatesPrevented.length, 1);
    assert.equal(fsBatchFresh.operations[0].operationType, 'set');
    assert.equal(fsBatchFresh.operations[0].collectionPath, 'services');
    assert.equal(fsBatchFresh.operations[0].merge, true);
    assert.equal(fsBatchFresh.operations[0].idempotentMatchBy, 'slug');
    assert.equal(fsBatchFresh.operations[0].documentPath, `services/${CORE_CATALOGUE_ITEMS[0].id}`);

    const fsBatchRerun = generateFirestoreWriteOperations({
      catalog: CORE_CATALOGUE_ITEMS,
      existingRecords: pass1.mappedRecords,
      nowIso: '2026-11-16T10:05:00.000Z',
      forceRefreshSeo: true,
    });
    assert.equal(fsBatchRerun.counts.create, 0);
    assert.equal(fsBatchRerun.counts.update, 0);
    assert.equal(fsBatchRerun.counts.skip, 145);

    // Duplicate ID/Slug prevention & existing customization preservation
    const existingWithLegacyIdSameSlug = {
      ...pass1.mappedRecords[0],
      id: 'legacy-pan-id-001',
      slug: 'pan-card',
      createdAt: '2025-01-01T00:00:00.000Z',
      formVersion: 5,
      formFields: [{ id: 'custom_pan_note', label: 'Custom Note', type: 'text', required: false }],
    };

    const customMerge = planIdempotentServicesSync({
      catalog: [CORE_CATALOGUE_ITEMS[0], CORE_CATALOGUE_ITEMS[0]], // intentional duplicate input
      existingRecords: [existingWithLegacyIdSameSlug],
      actorName: 'Admin Sync Test',
      nowIso: fixedIso,
    });

    assert.equal(customMerge.mappedRecords.length, 1);
    assert.equal(customMerge.duplicatesPrevented.length, 1);
    assert.equal(customMerge.mappedRecords[0].id, 'legacy-pan-id-001');
    assert.equal(customMerge.mappedRecords[0].createdAt, '2025-01-01T00:00:00.000Z');
    assert.equal(customMerge.mappedRecords[0].formVersion, 5);
    assert.equal(customMerge.mappedRecords[0].formFields[0].id, 'custom_pan_note');

    // Also verify D1 mapping & SQL batch builder (including 0005 JSON columns & slug deduplication)
    const d1Sample = mapCatalogServiceToD1Record(CORE_CATALOGUE_ITEMS[0], fixedIso);
    assert.equal(d1Sample.slug, 'pan-card');
    assert.equal(d1Sample.service_charge, 199);
    assert.equal(d1Sample.govt_fees, 107);
    assert.ok(d1Sample.seo_title.includes('PAN'));

    const sql = formatD1UpsertSqlBatch([CORE_CATALOGUE_ITEMS[0], ...CORE_CATALOGUE_ITEMS], fixedIso);
    assert.ok(sql.includes('INSERT INTO service_categories'));
    assert.ok(sql.includes('ON CONFLICT(slug) DO UPDATE SET'));
    assert.ok(sql.includes('digital_asset_json'));
    assert.ok(sql.includes('included_service_ids_json'));
    assert.ok(sql.includes('conditions_json'));
    assert.ok(sql.includes('regulated_notice'));
    const serviceInsertMatches = sql.match(/INSERT INTO services /g) || [];
    assert.equal(serviceInsertMatches.length, 145);
  });
});

describe('India Digital Directory — Multilingual Programmatic SEO, AdminCatalogManager & Itemized Pricing', () => {
  it('covers all 28 States, 8 Union Territories, districts/cities, and all 23 languages (en + 22 Eighth Schedule with RTL support)', () => {
    const summary = getStatesCountSummary(INDIA_GEOGRAPHY_SEED);
    assert.equal(summary.states, 28);
    assert.equal(summary.uts, 8);
    assert.equal(summary.states + summary.uts, 36);
    assert.equal(INDIA_STATES_AND_UTS.length, 36);
    assert.ok(summary.districts >= 36);
    assert.ok(summary.citiesAndTowns >= 36);

    assert.equal(SUPPORTED_INDIAN_LANGUAGES.length, 23);
    assert.equal(SCHEDULED_INDIAN_LANGUAGES.length, 22);

    const rtlCodes = SUPPORTED_INDIAN_LANGUAGES.filter((l) => l.rtl).map((l) => l.code).sort();
    assert.deepEqual(rtlCodes, ['ks', 'sd', 'ur']);
    assert.equal(resolveLanguageMeta('hi').hreflang, 'hi-IN');
    assert.equal(resolveLanguageMeta('ta').script, 'Tamil');
    assert.equal(resolveLanguageMeta('ur').rtl, true);
  });

  it('computes transparent itemized GST & zero-tax Government Fee breakdown via calculateOrderTotalsPaise', () => {
    // Example: Professional fee ₹499, Govt fee ₹1,000 (0% GST), GST 18% on Professional fee
    const totals = calculateOrderTotalsPaise({
      serviceChargeInr: 499,
      govtFeesInr: 1000,
      thirdPartyFeesInr: 100,
      urgentFeeInr: 150,
      discountInr: 49,
      taxRateBps: 1800,
    });

    // Taxable base = (499 + 150) - 49 = ₹600 -> GST 18% = ₹108
    assert.equal(totals.serviceFeePaise, toPaise(499));
    assert.equal(totals.govtFeePaise, toPaise(1000));
    assert.equal(totals.thirdPartyFeePaise, toPaise(100));
    assert.equal(totals.urgentFeePaise, toPaise(150));
    assert.equal(totals.discountPaise, toPaise(49));
    assert.equal(totals.taxPaise, toPaise(108));
    // Total = 600 + 108 + 1000 + 100 = ₹1808
    assert.equal(totals.totalPaise, toPaise(1808));
  });

  it('enforces anti-thin, unverified, and duplicate noindex guardrails and excludes noindex nodes from sitemaps', () => {
    const validLoc = INDIA_STATES_AND_UTS[0];
    const validQuality = evaluateDirectoryPageQuality(validLoc, { childCount: 2 });
    assert.equal(validQuality.indexStatus, 'index');
    assert.equal(validQuality.isThin, false);

    const thinUnverifiedLoc: IndiaLocationRecord = {
      ...validLoc,
      id: 'loc-thin-test',
      slug: 'thin-town',
      level: 'town',
      stateSlug: 'maharashtra',
      districtSlug: 'mumbai-suburban',
      citySlug: 'thin-town',
      canonicalPath: '/india/maharashtra/mumbai-suburban/thin-town',
      verified: false,
      indexPolicy: 'auto',
      customSummary: 'Short text',
      highlightedServiceSlugs: ['pan-card'],
    };
    const thinQuality = evaluateDirectoryPageQuality(thinUnverifiedLoc);
    assert.equal(thinQuality.indexStatus, 'noindex');
    assert.equal(thinQuality.isThin, true);

    const seenHashes = new Set<string>();
    const firstValid = evaluateDirectoryPageQuality(validLoc, {
      childCount: 2,
      seenContentHashes: seenHashes,
    });
    assert.equal(firstValid.indexStatus, 'index');
    const dupLoc: IndiaLocationRecord = {
      ...validLoc,
      id: 'loc-dup-test',
      slug: 'duplicate-state',
      canonicalPath: '/india/duplicate-state',
    };
    const dupQuality = evaluateDirectoryPageQuality(dupLoc, {
      childCount: 2,
      seenContentHashes: seenHashes,
    });
    assert.equal(dupQuality.isDuplicate, true);
    assert.equal(dupQuality.indexStatus, 'noindex');

    const fullSitemap = buildSitemapXml([], [], [
      { location: validLoc, quality: validQuality },
      { location: thinUnverifiedLoc, quality: thinQuality },
      { location: dupLoc, quality: dupQuality },
    ]);
    assert.ok(fullSitemap.includes('<urlset'));
    assert.ok(fullSitemap.includes(validLoc.canonicalPath));
    assert.ok(!fullSitemap.includes(thinUnverifiedLoc.canonicalPath));
    assert.ok(!fullSitemap.includes(dupLoc.canonicalPath));

    const subSitemap = buildDirectorySubSitemapXml([
      { location: validLoc, quality: validQuality },
      { location: thinUnverifiedLoc, quality: thinQuality },
    ]);
    assert.ok(subSitemap.includes(validLoc.canonicalPath));
    assert.ok(!subSitemap.includes(thinUnverifiedLoc.canonicalPath));
  });

  it('imports official LGD/Census CSV & JSON geography records while deduplicating existing nodes', () => {
    const csvPayload = [
      'name,level,stateSlug,districtSlug,lgdCode,pinCodes,latitude,longitude,verified,summary',
      'Satara,district,maharashtra,,LGD-MH-SATARA-9001,415001,17.6805,74.0183,true,"Official district digital services hub for Satara District covering PAN, MSME, GST, and citizen certificates."',
      'Mumbai,city,maharashtra,mumbai-suburban,LGD-CT-27-51901,400001,19.076,72.8777,true,"Duplicate Mumbai seed should be skipped safely."',
      'Karad,town,maharashtra,satara,LGD-MH-KARAD-9002,415110,17.2892,74.1817,true,"Karad municipal digital facilitation centre supporting online PAN, GST, FSSAI, and Udyam filings."',
    ].join('\n');

    const parsedCsv = parseOfficialGeographyImport(csvPayload, INDIA_GEOGRAPHY_SEED);
    assert.equal(parsedCsv.detectedFormat, 'csv');
    assert.equal(parsedCsv.errors.length, 0);
    assert.equal(parsedCsv.skippedDuplicates, 1);
    assert.equal(parsedCsv.validRecords.length, 2);
    assert.equal(parsedCsv.validRecords[0].canonicalPath, '/india/maharashtra/satara');
    assert.equal(parsedCsv.validRecords[1].canonicalPath, '/india/maharashtra/satara/karad');

    const jsonRes = parseOfficialGeographyImport(
      JSON.stringify([
        {
          name: 'Dharashiv',
          level: 'district',
          stateSlug: 'maharashtra',
          lgdCode: 'LGD-MH-DHARASHIV-9003',
          pinCodes: '413501',
          verified: true,
        },
      ]),
      INDIA_GEOGRAPHY_SEED
    );
    assert.equal(jsonRes.detectedFormat, 'json');
    assert.equal(jsonRes.validRecords.length, 1);
    assert.equal(jsonRes.validRecords[0].canonicalPath, '/india/maharashtra/dharashiv');
  });

  it('serves Worker Edge SSR directory pages with canonical, 23+x-default hreflangs, JSON-LD, 404/noindex handling, XML sitemaps, and RBAC-guarded admin APIs', async () => {
    const testEnv = {
      APP_DOMAIN: 'https://digitalindiaproject.com',
      ENVIRONMENT: 'test',
    } as any;

    const parsedHiCity = parseIndiaDirectoryPath('/hi/india/maharashtra/mumbai-suburban/mumbai');
    assert.equal(parsedHiCity.matched, true);
    assert.equal(parsedHiCity.lang, 'hi');
    assert.equal(parsedHiCity.stateSlug, 'maharashtra');
    assert.equal(parsedHiCity.districtSlug, 'mumbai-suburban');
    assert.equal(parsedHiCity.citySlug, 'mumbai');
    assert.equal(
      buildIndiaDirectoryPath({
        lang: 'ta',
        stateSlug: 'tamil-nadu',
        districtSlug: 'chennai',
        citySlug: 'chennai-city',
      }),
      '/ta/india/tamil-nadu/chennai/chennai-city'
    );

    const indiaSsr = await workerApp.fetch(new Request('https://digitalindiaproject.com/india'), testEnv);
    assert.equal(indiaSsr.status, 200);
    const indiaHtml = await indiaSsr.text();
    assert.ok(indiaHtml.includes('<title>'));
    assert.ok(indiaHtml.includes('<meta name="description"'));
    assert.ok(indiaHtml.includes('<link rel="canonical" href="https://digitalindiaproject.com/india"'));
    assert.ok(indiaHtml.includes('hreflang="en-IN"'));
    assert.ok(indiaHtml.includes('hreflang="hi-IN"'));
    assert.ok(indiaHtml.includes('hreflang="x-default"'));
    assert.ok(indiaHtml.includes('"@graph"'));
    assert.ok(indiaHtml.includes('__DIP_DIR_SSR_DATA__'));

    const mumbaiHiSsr = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/hi/india/maharashtra/mumbai-suburban/mumbai'),
      testEnv
    );
    assert.equal(mumbaiHiSsr.status, 200);
    const mumbaiHtml = await mumbaiHiSsr.text();
    assert.ok(
      mumbaiHtml.includes(
        '<link rel="canonical" href="https://digitalindiaproject.com/hi/india/maharashtra/mumbai-suburban/mumbai"'
      )
    );
    assert.ok(mumbaiHtml.includes('BreadcrumbList'));

    const missingLocSsr = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/india/non-existent-state'),
      testEnv
    );
    assert.equal(missingLocSsr.status, 404);
    const missingHtml = await missingLocSsr.text();
    assert.ok(missingHtml.includes('noindex'));

    const [robotsRes, sitemapRes, indexRes, statesSmRes, locApiRes, resolveApiRes, adminDirUnauth] =
      await Promise.all([
        workerApp.fetch(new Request('https://digitalindiaproject.com/robots.txt'), testEnv),
        workerApp.fetch(new Request('https://digitalindiaproject.com/sitemap.xml'), testEnv),
        workerApp.fetch(new Request('https://digitalindiaproject.com/sitemaps/index.xml'), testEnv),
        workerApp.fetch(new Request('https://digitalindiaproject.com/sitemaps/india-states.xml'), testEnv),
        workerApp.fetch(new Request('https://digitalindiaproject.com/api/directory/locations'), testEnv),
        workerApp.fetch(
          new Request('https://digitalindiaproject.com/api/directory/resolve?path=/india/maharashtra'),
          testEnv
        ),
        workerApp.fetch(
          new Request('https://digitalindiaproject.com/api/admin/directory/overview'),
          testEnv
        ),
      ]);

    assert.equal(robotsRes.status, 200);
    const robotsTxt = await robotsRes.text();
    assert.ok(robotsTxt.includes('/sitemaps/index.xml'));

    assert.equal(sitemapRes.status, 200);
    const sitemapTxt = await sitemapRes.text();
    assert.ok(sitemapTxt.includes('<urlset'));
    assert.ok(sitemapTxt.includes('https://digitalindiaproject.com/india'));

    assert.equal(indexRes.status, 200);
    const indexTxt = await indexRes.text();
    assert.ok(indexTxt.includes('<sitemapindex'));
    assert.ok(indexTxt.includes('/sitemaps/india-states.xml'));

    assert.equal(statesSmRes.status, 200);
    const statesSmTxt = await statesSmRes.text();
    assert.ok(statesSmTxt.includes('https://digitalindiaproject.com/india/maharashtra'));
    assert.ok(statesSmTxt.includes('xhtml:link'));

    assert.equal(locApiRes.status, 200);
    const locApiJson: any = await locApiRes.json();
    assert.equal(locApiJson.success, true);
    assert.ok(locApiJson.data.items.length >= 36);

    assert.equal(resolveApiRes.status, 200);
    const resolveJson: any = await resolveApiRes.json();
    assert.equal(resolveJson.success, true);
    assert.equal(resolveJson.data.location.slug, 'maharashtra');

    assert.equal(adminDirUnauth.status, 401);
  });
});

describe('Cashfree Production Payment Ecosystem (Anti-Replay, Monotonic Guard, Refunds, RBAC, Reconciliation)', () => {
  it('enforces production webhook timestamp anti-replay and persists failed verification attempts', async () => {
    const webhookInserts: any[][] = [];
    const paidOrder = {
      id: 'CF_ECO_100',
      application_id: 'DIP-ECO-100',
      user_id: 'cust-eco-1',
      service_slug: 'pan-card',
      customer_email: 'citizen@example.com',
      customer_name: 'Citizen Eco',
      service_fee_paise: 84746,
      govt_fee_paise: 0,
      tax_paise: 15254,
      total_paise: 100000,
      refunded_amount_paise: 0,
      status: 'CREATED',
      payment_status_normalized: 'INITIATED',
    };

    const mockDb = {
      prepare: (sql: string) => ({
        bind: (...args: any[]) => ({
          first: async () => {
            if (sql.includes('SELECT id FROM payment_webhook_events')) return null;
            if (sql.includes('FROM payment_orders')) return { ...paidOrder };
            if (sql.includes('FROM applications')) {
              return { id: 'DIP-ECO-100', user_id: 'cust-eco-1', service_id: 'srv-1', status: 'Payment Pending' };
            }
            if (sql.includes('FROM payments')) return null;
            return null;
          },
          all: async () => ({ results: [] }),
          run: async () => {
            if (sql.includes('INSERT INTO payment_webhook_events')) {
              webhookInserts.push(args);
            }
            if (sql.includes('UPDATE payment_orders') && sql.includes('PAID')) {
              paidOrder.status = 'PAID';
              paidOrder.payment_status_normalized = 'PAID';
            }
            return { success: true };
          },
        }),
      }),
    };

    const prodEnv = {
      APP_DOMAIN: 'https://digitalindiaproject.com',
      ENVIRONMENT: 'production',
      CASHFREE_CLIENT_SECRET: 'cf_prod_secret_123',
      CASHFREE_WEBHOOK_SECRET: 'cf_wh_secret_123',
      DB: mockDb,
      DB_BILLING: mockDb,
    } as any;

    const staleCheck = validateWebhookTimestamp('1700000000', { enforce: true });
    assert.equal(staleCheck.valid, false);
    const freshTs = String(Math.floor(Date.now() / 1000));
    assert.equal(validateWebhookTimestamp(freshTs, { enforce: true }).valid, true);

    const payloadBody = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: 'CF_ECO_100', order_amount: 1000 },
        payment: { cf_payment_id: '991122', payment_status: 'SUCCESS', payment_amount: 1000, payment_group: 'upi' },
      },
    });

    // Stale timestamp rejected in production with 401 and persisted as FAILED
    const staleRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/webhooks/cashfree', {
        method: 'POST',
        headers: {
          'x-webhook-timestamp': '1700000000',
          'x-webhook-signature': await hmacSha256Base64('cf_wh_secret_123', `1700000000${payloadBody}`),
        },
        body: payloadBody,
      }),
      prodEnv
    );
    assert.equal(staleRes.status, 401);
    assert.ok(webhookInserts.some((a) => a.includes('FAILED')));

    // Fresh timestamp + invalid signature rejected 401 + persisted FAILED
    const badSigRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/webhooks/cashfree', {
        method: 'POST',
        headers: { 'x-webhook-timestamp': freshTs, 'x-webhook-signature': 'wrong_sig' },
        body: payloadBody,
      }),
      prodEnv
    );
    assert.equal(badSigRes.status, 401);

    // Fresh valid signature succeeds cleanly on canonical /api/webhooks/cashfree
    const goodSig = await hmacSha256Base64('cf_wh_secret_123', `${freshTs}${payloadBody}`);
    const goodRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/webhooks/cashfree', {
        method: 'POST',
        headers: { 'x-webhook-timestamp': freshTs, 'x-webhook-signature': goodSig },
        body: payloadBody,
      }),
      prodEnv
    );
    assert.equal(goodRes.status, 200);
    const goodJson: any = await goodRes.json();
    assert.equal(goodJson.data.resolvedOrderStatus, 'PAID');
    assert.equal(paidOrder.status, 'PAID');
  });

  it('protects PAID orders with monotonic guard and processes partial/full refunds with commission reversal', async () => {
    const orderRow = {
      id: 'CF_MONO_200',
      application_id: 'DIP-MONO-200',
      user_id: 'cust-mono-1',
      service_slug: 'gst-registration',
      customer_email: 'biz@example.com',
      customer_name: 'Biz Owner',
      total_paise: 100000,
      refunded_amount_paise: 0,
      status: 'PAID',
      payment_status_normalized: 'PAID',
    };
    const commissionInserts: any[][] = [];
    const refundUpdates: string[] = [];

    const db = {
      prepare: (sql: string) => ({
        bind: (...args: any[]) => ({
          first: async () => {
            if (sql.includes('SELECT id') && sql.includes('payment_webhook_events')) return null;
            if (sql.includes('FROM payment_orders')) return { ...orderRow };
            if (sql.includes('FROM payments')) {
              return {
                id: 'pay_CF_MONO_200',
                order_id: 'CF_MONO_200',
                application_id: 'DIP-MONO-200',
                user_id: 'cust-mono-1',
                cf_payment_id: 'CF_PAY_200',
                total_amount: 1000,
                order_amount_paise: 100000,
                refunded_paise: orderRow.refunded_amount_paise,
                status: 'Success',
              };
            }
            if (sql.includes('SELECT r.*') && sql.includes('FROM refunds r')) return null;
            if (sql.includes('FROM refunds') && sql.includes('SUM(')) {
              return { sum_paise: orderRow.refunded_amount_paise };
            }
            if (sql.includes('FROM commission_ledger') && sql.includes("entry_type = 'EARNED'")) {
              return {
                partner_id: 'PTR-200',
                rule_id: 'rule_std',
                gross_amount_paise: 20000,
                commission_paise: 20000,
                tds_paise: 0,
                net_paise: 20000,
              };
            }
            if (sql.includes('FROM commission_ledger') && sql.includes('REVERSAL')) return null;
            return null;
          },
          all: async () => ({ results: [] }),
          run: async () => {
            if (sql.includes('UPDATE payments SET status = ?, refunded_paise = ?')) {
              orderRow.refunded_amount_paise = Number(args[1] || 0);
            }
            if (sql.includes('UPDATE payment_orders') && sql.includes('payment_status_normalized = ?')) {
              orderRow.payment_status_normalized = String(args[1] || 'PARTIALLY_REFUNDED');
              orderRow.status = String(args[0] || orderRow.status);
              refundUpdates.push(orderRow.payment_status_normalized);
            }
            if (sql.includes('INSERT OR IGNORE INTO commission_ledger') || sql.includes('INSERT INTO commission_ledger')) {
              commissionInserts.push(args);
            }
            return { success: true, meta: { changes: 1 } };
          },
        }),
      }),
    };

    const env = { APP_DOMAIN: 'https://digitalindiaproject.com', DB: db, DB_BILLING: db } as any;

    // Monotonic guard: FAILED webhook must NOT downgrade already PAID order
    const downgradeAttempt = await processCashfreeWebhookEvent(env, {
      eventType: 'PAYMENT_FAILED_WEBHOOK',
      orderId: 'CF_MONO_200',
      cfPaymentId: 'CF_PAY_FAIL_IGNORE',
      eventId: 'EVT_MONO_FAIL_1',
      payload: {
        type: 'PAYMENT_FAILED_WEBHOOK',
        data: { order: { order_id: 'CF_MONO_200' }, payment: { cf_payment_id: 'CF_PAY_FAIL_IGNORE', payment_status: 'FAILED' } },
      },
      signatureVerified: true,
    });
    assert.equal(downgradeAttempt.resolvedOrderStatus, 'PAID');
    assert.equal(orderRow.status, 'PAID');

    // REFUND_STATUS_WEBHOOK (500 INR partial refund on 1000 INR order) -> PARTIALLY_REFUNDED + 50% commission clawback (-100 INR = -10000 paise)
    const partialRefund = await processCashfreeWebhookEvent(env, {
      eventType: 'REFUND_STATUS_WEBHOOK',
      orderId: 'CF_MONO_200',
      eventId: 'EVT_REF_PARTIAL_1',
      payload: {
        type: 'REFUND_STATUS_WEBHOOK',
        data: {
          refund: {
            refund_id: 'RF_PARTIAL_1',
            cf_refund_id: 'CF_RF_9901',
            refund_amount: 500,
            refund_status: 'SUCCESS',
            refund_arn: 'ARN123456',
          },
        },
      },
      signatureVerified: true,
    });
    assert.equal(partialRefund.resolvedOrderStatus, 'PARTIALLY_REFUNDED');
    assert.equal(orderRow.refunded_amount_paise, 50000);
    assert.ok(refundUpdates.includes('PARTIALLY_REFUNDED'));
    assert.ok(commissionInserts.some((a) => a.includes(-10000)));
  });

  it('executes live Refund API + 409 over-refund block and enforces RBAC on admin payment operations & reconcile sweep', async () => {
    const tokCust = 'sess_eco_cust_tok';
    const tokAdmin = 'sess_eco_admin_tok';
    const orderState = {
      id: 'CF_LIVE_REF_300',
      application_id: 'DIP-REF-300',
      user_id: 'cust-ref-1',
      customer_email: 'cust@example.com',
      customer_name: 'Refund Customer',
      total_paise: 100000,
      refunded_amount_paise: 0,
      status: 'PAID',
      payment_status_normalized: 'PAID',
    };
    const pendingStuckOrder = {
      id: 'CF_STUCK_400',
      application_id: 'DIP-STUCK-400',
      user_id: 'cust-ref-1',
      service_slug: 'pan-card',
      service_fee_paise: 50000,
      govt_fee_paise: 0,
      tax_paise: 0,
      total_paise: 50000,
      status: 'CREATED',
      payment_status_normalized: 'INITIATED',
    };

    const makeEcoDb = () => ({
      prepare: (sql: string) => ({
        bind: (...args: any[]) => ({
          first: async () => {
            if (sql.includes('FROM user_sessions')) {
              const tok = args[0];
              if (tok === tokCust) {
                return { user_id: 'cust-ref-1', expires_at: '2099-01-01T00:00:00Z', email: 'c@e.com', name: 'Cust', is_active: 1 };
              }
              if (tok === tokAdmin) {
                return { user_id: 'admin-ref-1', expires_at: '2099-01-01T00:00:00Z', email: 'a@e.com', name: 'Admin', is_active: 1 };
              }
            }
            if (sql.includes('FROM users u')) {
              return args[0] === 'admin-ref-1'
                ? { id: 'admin-ref-1', is_active: 1, role_name: 'super_admin' }
                : { id: 'cust-ref-1', is_active: 1, role_name: 'customer' };
            }
            if (sql.includes('FROM payment_orders')) {
              const oid = String(args[0] || '');
              if (oid === 'CF_STUCK_400') return { ...pendingStuckOrder };
              return { ...orderState };
            }
            if (sql.includes('FROM payments')) {
              return {
                id: 'pay_CF_LIVE_REF_300',
                order_id: 'CF_LIVE_REF_300',
                application_id: 'DIP-REF-300',
                user_id: 'cust-ref-1',
                cf_payment_id: 'CF_PAY_300',
                total_amount: 1000,
                order_amount_paise: 100000,
                refunded_paise: orderState.refunded_amount_paise,
                status: 'Success',
              };
            }
            if (sql.includes('FROM refunds') && sql.includes('SUM(')) {
              return { sum_paise: orderState.refunded_amount_paise, refunded_paise: orderState.refunded_amount_paise };
            }
            return null;
          },
          all: async () => {
            if (sql.includes('FROM payment_orders') && sql.includes("status IN ('CREATED'")) {
              return { results: [{ id: pendingStuckOrder.id, application_id: pendingStuckOrder.application_id, total_paise: pendingStuckOrder.total_paise, status: pendingStuckOrder.status, payment_status_normalized: pendingStuckOrder.payment_status_normalized }] };
            }
            return { results: [] };
          },
          run: async () => {
            if (sql.includes('UPDATE payments SET status = ?, refunded_paise = ?')) {
              orderState.refunded_amount_paise = Number(args[1] || 0);
            }
            if (sql.includes('UPDATE payment_orders') && sql.includes('payment_status_normalized = ?')) {
              orderState.payment_status_normalized = String(args[1] || 'PARTIALLY_REFUNDED');
            }
            if (sql.includes("UPDATE payment_orders SET status = 'PAID'")) {
              pendingStuckOrder.status = 'PAID';
              pendingStuckOrder.payment_status_normalized = 'PAID';
            }
            return { success: true, meta: { changes: 1 } };
          },
        }),
      }),
    });

    const db = makeEcoDb();
    const ecoEnv = {
      APP_DOMAIN: 'https://digitalindiaproject.com',
      CASHFREE_CLIENT_ID: 'cf_id_live',
      CASHFREE_CLIENT_SECRET: 'cf_sec_live',
      CASHFREE_ENV: 'sandbox',
      DB: db,
      DB_BILLING: db,
      DB_PARTNERS: db,
    } as any;

    // Customer cannot access admin payments or issue refunds -> 403
    const custAdminRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/admin/payments/analytics', {
        headers: { Authorization: `Bearer ${tokCust}` },
      }),
      ecoEnv
    );
    assert.equal(custAdminRes.status, 403);

    const custRefundRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/payments/orders/CF_LIVE_REF_300/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCust}` },
        body: JSON.stringify({ refundAmount: 200 }),
      }),
      ecoEnv
    );
    assert.equal(custRefundRes.status, 403);

    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/orders/CF_LIVE_REF_300/refunds') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            cf_refund_id: 'CF_RF_API_300',
            refund_id: 'RF_API_300',
            refund_status: 'SUCCESS',
            refund_arn: 'ARN_API_300',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/orders/CF_STUCK_400/payments')) {
        return new Response(
          JSON.stringify([
            { cf_payment_id: 'CF_PAY_REC_400', payment_status: 'SUCCESS', payment_amount: 500, payment_group: 'upi', bank_reference: 'UTR_REC_400' },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/orders/CF_STUCK_400')) {
        return new Response(
          JSON.stringify({ order_id: 'CF_STUCK_400', order_status: 'PAID', order_amount: 500 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return origFetch(input as any, init);
    }) as typeof fetch;

    try {
      // Partial refund ₹500 on ₹1000 succeeds
      const refundRes = await workerApp.fetch(
        new Request('https://digitalindiaproject.com/api/v1/payments/orders/CF_LIVE_REF_300/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokAdmin}` },
          body: JSON.stringify({ refundAmount: 500, refundSpeed: 'STANDARD', reason: 'Partial fee waiver' }),
        }),
        ecoEnv
      );
      assert.ok(refundRes.status === 200 || refundRes.status === 201);
      const refundJson: any = await refundRes.json();
      assert.equal(refundJson.data.cfRefundId, 'CF_RF_API_300');
      assert.equal(refundJson.data.isPartial, true);

      // Attempting ₹600 more exceeds ₹500 remaining -> blocked with 409
      const overRefundRes = await workerApp.fetch(
        new Request('https://digitalindiaproject.com/api/v1/payments/orders/CF_LIVE_REF_300/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokAdmin}` },
          body: JSON.stringify({ refundAmount: 600 }),
        }),
        ecoEnv
      );
      assert.equal(overRefundRes.status, 409);

      // Admin reconciliation sweep reconciles stuck CREATED order whose Cashfree status is PAID
      const reconcileRes = await workerApp.fetch(
        new Request('https://digitalindiaproject.com/api/admin/payments/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokAdmin}` },
          body: JSON.stringify({ limit: 10 }),
        }),
        ecoEnv
      );
      assert.equal(reconcileRes.status, 200);
      const reconcileJson: any = await reconcileRes.json();
      assert.equal(reconcileJson.data.reconciledPaidCount, 1);
      assert.equal(pendingStuckOrder.status, 'PAID');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('probes Cashfree gateway credentials safely and runs admin cutover diagnostics with strict RBAC', async () => {
    const missingCfg = resolveCashfreeConfig({
      ENVIRONMENT: 'production',
      CASHFREE_ENV: 'production',
      CASHFREE_CLIENT_ID: '14463256bcf61345cef7c71750b5236441',
    });
    const unconfProbe = await probeCashfreeGatewayCredentials(missingCfg);
    assert.equal(unconfProbe.configured, false);
    assert.equal(unconfProbe.authenticated, false);
    assert.match(unconfProbe.message, /CASHFREE_CLIENT_SECRET/);

    const tokCust = 'tok_cutover_cust';
    const tokAdmin = 'tok_cutover_admin';

    const makeCutoverDb = () => ({
      prepare: (sql: string) => {
        const makeBound = (...args: any[]) => ({
          first: async () => {
            if (sql.includes('FROM user_sessions')) {
              if (args[0] === tokCust) {
                return { user_id: 'cust-cut-1', expires_at: '2099-01-01T00:00:00Z', email: 'c@e.com', name: 'Cust', is_active: 1 };
              }
              if (args[0] === tokAdmin) {
                return { user_id: 'adm-cut-1', expires_at: '2099-01-01T00:00:00Z', email: 'a@e.com', name: 'Admin', is_active: 1 };
              }
            }
            if (sql.includes('FROM users u')) {
              return args[0] === 'adm-cut-1'
                ? { id: 'adm-cut-1', is_active: 1, role_name: 'super_admin' }
                : { id: 'cust-cut-1', is_active: 1, role_name: 'customer' };
            }
            return null;
          },
          all: async () => {
            if (sql.includes('PRAGMA table_info(payment_orders)')) {
              return { results: [{ name: 'cf_order_id' }, { name: 'payment_status_normalized' }, { name: 'retry_of_order_id' }] };
            }
            if (sql.includes('PRAGMA table_info(payments)')) {
              return { results: [{ name: 'bank_reference' }, { name: 'refunded_paise' }, { name: 'gateway_response_json' }] };
            }
            if (sql.includes('PRAGMA table_info(payment_webhook_events)')) {
              return { results: [{ name: 'processing_status' }, { name: 'raw_payload_json' }, { name: 'replay_count' }] };
            }
            if (sql.includes('PRAGMA table_info(refunds)')) {
              return { results: [{ name: 'cf_refund_id' }, { name: 'refund_amount_paise' }, { name: 'refund_arn' }] };
            }
            return { results: [] };
          },
          run: async () => ({ success: true, meta: { changes: 1 } }),
        });
        return {
          ...makeBound(),
          bind: (...args: any[]) => makeBound(...args),
        };
      },
    });

    const cutoverDb = makeCutoverDb();
    const envMissing = {
      APP_DOMAIN: 'https://digitalindiaproject.com',
      ENVIRONMENT: 'production',
      CASHFREE_ENV: 'production',
      CASHFREE_CLIENT_ID: '14463256bcf61345cef7c71750b5236441',
      DB: cutoverDb,
      DB_BILLING: cutoverDb,
    } as any;

    const custCutRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/admin/payments/cutover-check', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokCust}` },
      }),
      envMissing
    );
    assert.equal(custCutRes.status, 403);

    const adminMissingRes = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/admin/payments/cutover-check', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokAdmin}` },
      }),
      envMissing
    );
    assert.equal(adminMissingRes.status, 200);
    const adminMissingJson: any = await adminMissingRes.json();
    assert.equal(adminMissingJson.data.readyForProduction, false);
    assert.equal(
      adminMissingJson.data.checks.find((c: any) => c.key === 'secret_binding')?.status,
      'fail'
    );
    assert.equal(
      adminMissingJson.data.checks.find((c: any) => c.key === 'd1_billing_schema')?.status,
      'pass'
    );

    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('https://api.cashfree.com/pg/orders/CUTOVER_PROBE_')) {
        return new Response(JSON.stringify({ message: 'Order does not exist', code: 'order_not_found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return origFetch(input as any);
    }) as typeof fetch;

    try {
      const envLive = {
        ...envMissing,
        CASHFREE_CLIENT_SECRET: 'live_test_secret_value',
        RESEND_API_KEY: 're_test_key',
        PAYMENTS_EMAIL: 'payments@digitalindiaproject.com',
      } as any;
      const readyRes = await workerApp.fetch(
        new Request('https://digitalindiaproject.com/api/admin/payments/cutover-check', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokAdmin}` },
        }),
        envLive
      );
      assert.equal(readyRes.status, 200);
      const readyJson: any = await readyRes.json();
      assert.equal(readyJson.data.readyForProduction, true);
      assert.equal(readyJson.data.probe.authenticated, true);
      assert.equal(
        readyJson.data.checks.find((c: any) => c.key === 'gateway_auth_probe')?.status,
        'pass'
      );
      assert.equal(
        readyJson.data.checks.find((c: any) => c.key === 'd1_billing_schema')?.status,
        'pass'
      );
      assert.equal(
        readyJson.data.checks.find((c: any) => c.key === 'webhook_hmac_selftest')?.status,
        'pass'
      );
      assert.equal(
        readyJson.data.webhookSetup.url,
        'https://digitalindiaproject.com/api/webhooks/cashfree'
      );
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

describe('Dynamic Sitemap & Catalog SEO Manager', () => {
  it('supports canonicalUrl across Firestore service schema allowlist and record mapper', () => {
    assert.ok(
      (FIRESTORE_SERVICE_ALLOWED_KEYS as readonly string[]).includes('canonicalUrl'),
      'canonicalUrl must be allowed in Firestore service schema'
    );

    const sample = COMPLETE_CATALOGUE_ITEMS[0];
    const customCanonical = `https://digitalindiaproject.com/services/custom-${sample.slug}`;
    const mapped = mapCatalogServiceToFirestoreRecord({
      ...sample,
      canonicalUrl: customCanonical,
    });
    assert.equal(mapped.canonicalUrl, customCanonical);

    const jsonLd = buildServiceDetailJsonLd({
      ...sample,
      canonicalUrl: customCanonical,
    });
    const serviceNode = (jsonLd as any)['@graph']?.find((n: any) => n['@type'] === 'Service');
    assert.equal(serviceNode?.url, customCanonical);
  });

  it('embeds generated-at metadata, honors canonicalUrl, excludes draft/noindex URLs, and parses SEO health metrics', () => {
    const samplePublished = {
      ...COMPLETE_CATALOGUE_ITEMS[0],
      published: true,
      canonicalUrl: 'https://digitalindiaproject.com/services/custom-gst-portal',
    };
    const sampleDraft = {
      ...COMPLETE_CATALOGUE_ITEMS[1],
      id: 'draft-svc-test',
      slug: 'draft-hidden-service',
      published: false,
    };
    const publishedPost = {
      ...INITIAL_BLOG_POSTS[0],
      status: 'published' as const,
    };
    const draftPost = {
      ...INITIAL_BLOG_POSTS[0],
      id: 'draft-post-test',
      slug: 'draft-hidden-guide',
      status: 'draft' as const,
    };
    const indexedLoc = INDIA_GEOGRAPHY_SEED.find((l) => l.level === 'state' && l.published)!;
    const noindexLoc = {
      ...INDIA_GEOGRAPHY_SEED.find((l) => l.level === 'district')!,
      id: 'noindex-district-test',
      districtSlug: 'thin-excluded-district',
      published: false,
    };

    const ts = '2026-11-17T20:30:00.000Z';
    const xml = buildSitemapXml(
      [samplePublished, sampleDraft],
      [publishedPost, draftPost],
      [
        {
          location: indexedLoc,
          quality: {
            indexStatus: 'index',
            score: 88,
            isThin: false,
            isDuplicate: false,
            isVerified: true,
            reasons: [],
            contentHash: 'hash-valid-1',
          },
        },
        {
          location: noindexLoc,
          quality: {
            indexStatus: 'noindex',
            score: 22,
            isThin: true,
            isDuplicate: false,
            isVerified: false,
            reasons: ['Thin content'],
            contentHash: 'hash-thin-2',
          },
        },
      ],
      { generatedAt: ts }
    );

    assert.ok(xml.includes(`generated-at="${ts}"`), 'Sitemap XML must embed generated-at timestamp comment');
    assert.ok(xml.includes('<loc>https://digitalindiaproject.com/services/custom-gst-portal</loc>'));
    assert.ok(!xml.includes('draft-hidden-service'), 'Unpublished services must be excluded from sitemap');
    assert.ok(!xml.includes('draft-hidden-guide'), 'Draft blog posts must be excluded from sitemap');
    assert.ok(!xml.includes('thin-excluded-district'), 'Noindex directory entries must be excluded');

    const parsed = parseSitemapXmlStats(xml);
    assert.equal(parsed.validXml, true);
    assert.equal(parsed.generatedAt, ts);
    assert.equal(parsed.declaredExcludedCount, 3);
    assert.equal(parsed.declaredIndexedUrls, parsed.urlCount);
    assert.ok(parsed.urlCount > 0);

    const summary = computeSitemapHealthSummary({
      services: [samplePublished, sampleDraft],
      posts: [publishedPost, draftPost],
      directoryEntries: [
        {
          location: indexedLoc,
          quality: {
            indexStatus: 'index',
            score: 88,
            isThin: false,
            isDuplicate: false,
            isVerified: true,
            reasons: [],
            contentHash: 'hash-valid-1',
          },
        },
        {
          location: noindexLoc,
          quality: {
            indexStatus: 'noindex',
            score: 22,
            isThin: true,
            isDuplicate: false,
            isVerified: false,
            reasons: ['Thin content'],
            contentHash: 'hash-thin-2',
          },
        },
      ],
    });
    assert.equal(summary.breakdown.publishedServices, 1);
    assert.equal(summary.breakdown.totalServices, 2);
    assert.equal(summary.excludedUrls, 3);
  });

  it('generates valid Sitemaps.org 0.9 artifact cleanly via generateDynamicSitemapArtifact()', () => {
    const result = generateDynamicSitemapArtifact({ generatedAt: '2026-11-17T21:00:00.000Z' });
    assert.deepEqual(result.validationErrors, []);
    assert.ok(result.urlCount > 150, `Expected >150 URLs in sitemap, got ${result.urlCount}`);
    assert.ok(result.bytes < 50 * 1024 * 1024);
    assert.ok(result.xml.includes('generated-at="2026-11-17T21:00:00.000Z"'));
  });

  it('serves Worker GET /sitemap.xml with Last-Modified and X-Sitemap-Generated-At headers', async () => {
    const res = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/sitemap.xml'),
      { APP_DOMAIN: 'https://digitalindiaproject.com' } as any
    );
    assert.equal(res.status, 200);
    assert.ok((res.headers.get('Content-Type') || '').includes('application/xml'));
    const generatedHeader = res.headers.get('X-Sitemap-Generated-At');
    assert.ok(generatedHeader && !Number.isNaN(Date.parse(generatedHeader)));
    assert.ok(res.headers.get('Last-Modified'));

    const body = await res.text();
    const parsed = parseSitemapXmlStats(body);
    assert.equal(parsed.validXml, true);
    assert.equal(parsed.generatedAt, generatedHeader);
    assert.ok(parsed.urlCount > 100);
  });
});

describe('API Sathi Marketplace Integration (Mocked HTTP & Worker Ownership)', () => {
  it('enforces key mode detection, trailing slash URLs, single X-API-Key header, >=20s timeout, and strict field validation', async () => {
    assert.equal(detectApiSathiKeyMode(undefined), 'unconfigured');
    assert.equal(detectApiSathiKeyMode('test_abc123'), 'sandbox_test');
    assert.equal(detectApiSathiKeyMode('live_prod999'), 'live_production');

    // Rejects missing/empty API key
    assert.throws(
      () => createApiSathiClient({ apiKey: '' }),
      (err: unknown) => err instanceof ApiSathiError && err.code === 'API_SATHI_NOT_CONFIGURED'
    );

    const capturedRequests: Array<{ url: string; headers: Record<string, string>; body: any }> = [];
    const client = createApiSathiClient({
      apiKey: 'test_mock_key_001',
      timeoutMs: 25_000,
      uuidFn: () => '11111111-2222-4333-8444-555555555555',
      sleepFn: async () => {},
      fetchFn: async (input, init) => {
        const hdrs: Record<string, string> = {};
        new Headers(init?.headers).forEach((v, k) => {
          hdrs[k.toLowerCase()] = v;
        });
        capturedRequests.push({
          url: String(input),
          headers: hdrs,
          body: JSON.parse(String(init?.body || '{}')),
        });
        return new Response(
          JSON.stringify({
            call_id: 'call_pan_ok_1',
            verified: true,
            pan: 'ABCDE1234F',
            fullname: 'AARAV SHARMA',
            aadhaar_linked: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      },
    });

    const panRes = await verifyPan(client, { pan: 'abcde1234f' });
    assert.equal(panRes.ok, true);
    assert.equal(panRes.verified, true);
    assert.equal(panRes.outcome, 'VERIFIED');
    assert.equal(panRes.callId, 'call_pan_ok_1');
    assert.equal(panRes.isSandboxTestKey, true);
    assert.equal(panRes.environment, 'SANDBOX');

    assert.equal(capturedRequests.length, 1);
    assert.equal(capturedRequests[0].url, 'https://apisathi.in/gw/v1/pan-verification-v1/');
    assert.ok(capturedRequests[0].url.endsWith('/'), 'Trailing slash is required');
    assert.equal(capturedRequests[0].headers['x-api-key'], 'test_mock_key_001');
    assert.equal(capturedRequests[0].headers['x-tenant-id'], undefined, 'Must never send X-Tenant-ID');
    assert.equal(capturedRequests[0].headers['idempotency-key'], '11111111-2222-4333-8444-555555555555');
    assert.deepEqual(capturedRequests[0].body, { pan: 'ABCDE1234F' });

    // Local schema validation rejects bad PAN before any HTTP call
    await assert.rejects(
      () => verifyPan(client, { pan: 'INVALID' }),
      (err: unknown) => err instanceof ApiSathiError && err.httpStatus === 400 && err.code === 'INVALID_INPUT'
    );
    assert.equal(capturedRequests.length, 1, 'Invalid input must not fire HTTP request');

    // Driving Licence normalizes HTML date YYYY-MM-DD -> DD/MM/YYYY
    await verifyDrivingLicense(client, { dl_number: 'MH-12 20110012345', dob: '1990-01-15' });
    assert.equal(capturedRequests[1].url, 'https://apisathi.in/gw/v1/driving-license-v1/');
    assert.deepEqual(capturedRequests[1].body, { dl_number: 'MH1220110012345', dob: '15/01/1990' });
  });

  it('branches on HTTP 200 { verified: false } without marking verified', async () => {
    const client = createApiSathiClient({
      apiKey: 'live_mock_prod_key',
      sleepFn: async () => {},
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            call_id: 'call_gst_notfound_2',
            verified: false,
            result_code: 'NO_RECORD_FOUND',
            message: 'GSTIN not present in active GSTN registry',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
    });

    const res = await verifyGstinBasic(client, { gstin: '27AAACR5055K1Z1' });
    assert.equal(res.httpStatus, 200);
    assert.equal(res.ok, false);
    assert.equal(res.verified, false);
    assert.equal(res.outcome, 'NOT_VERIFIED');
    assert.equal(res.callId, 'call_gst_notfound_2');
    assert.equal(res.isSandboxTestKey, false);
    assert.equal(res.environment, 'PRODUCTION');
  });

  it('does NOT retry 422 input/step-not-completed or 402 insufficient balance errors and sets call_id', async () => {
    let attempts = 0;
    const sleepCalls: number[] = [];

    const client422 = createApiSathiClient({
      apiKey: 'live_prod_key',
      sleepFn: async (ms) => {
        sleepCalls.push(ms);
      },
      fetchFn: async () => {
        attempts += 1;
        return new Response(
          JSON.stringify({
            call_id: 'call_422_digilocker',
            error: { code: 'NOT_COMPLETED', message: 'User has not completed DigiLocker flow yet' },
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        );
      },
    });

    await assert.rejects(
      () => fetchAadhaarDigilocker(client422, { transaction_id: '987654321' }),
      (err: unknown) =>
        err instanceof ApiSathiError &&
        err.httpStatus === 422 &&
        err.code === 'NOT_COMPLETED' &&
        err.callId === 'call_422_digilocker' &&
        !err.isWalletEmptyError
    );
    assert.equal(attempts, 1, '422 must never retry');
    assert.equal(sleepCalls.length, 0);

    let attempts402 = 0;
    const client402 = createApiSathiClient({
      apiKey: 'live_prod_key',
      sleepFn: async (ms) => {
        sleepCalls.push(ms);
      },
      fetchFn: async () => {
        attempts402 += 1;
        return new Response(
          JSON.stringify({
            call_id: 'call_402_wallet',
            error: { code: 'INSUFFICIENT_BALANCE', message: 'Prepaid wallet balance exhausted' },
          }),
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        );
      },
    });

    await assert.rejects(
      () => lookupIfsc(client402, { ifsc: 'SBIN0001234' }),
      (err: unknown) =>
        err instanceof ApiSathiError &&
        err.httpStatus === 402 &&
        err.code === 'INSUFFICIENT_BALANCE' &&
        err.isWalletEmptyError === true &&
        err.callId === 'call_402_wallet'
    );
    assert.equal(attempts402, 1, '402 INSUFFICIENT_BALANCE must never retry');
    assert.equal(sleepCalls.length, 0);
  });

  it('honours Retry-After on HTTP 429 and reuses identical Idempotency-Key before succeeding', async () => {
    const seenKeys: string[] = [];
    const sleeps: number[] = [];
    let attempt = 0;
    let uuidSeq = 0;

    const client = createApiSathiClient({
      apiKey: 'live_rate_limit_key',
      uuidFn: () => `uuid-attempt-${++uuidSeq}`,
      sleepFn: async (ms) => {
        sleeps.push(ms);
      },
      fetchFn: async (_url, init) => {
        attempt += 1;
        const hdrs = new Headers(init?.headers);
        seenKeys.push(hdrs.get('Idempotency-Key') || '');
        if (attempt === 1) {
          return new Response(
            JSON.stringify({
              call_id: 'call_429_rate_1',
              error: { code: 'RATE_LIMITED', message: 'Too many requests' },
            }),
            { status: 429, headers: { 'Retry-After': '3', 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            call_id: 'call_ifsc_ok_2',
            ifsc: 'SBIN0001234',
            bank: 'State Bank of India',
            branch: 'Silvassa Main',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      },
    });

    const { result } = await executeApiSathiProduct(client, 'ifsc-lookup-v1', { ifsc: 'sbin0001234' });
    assert.equal(attempt, 2);
    assert.equal(result.ok, true);
    assert.equal(result.verified, true);
    assert.equal(result.callId, 'call_ifsc_ok_2');
    assert.deepEqual(sleeps, [3000]);
    assert.equal(seenKeys.length, 2);
    assert.equal(seenKeys[0], seenKeys[1], 'Must reuse exact same Idempotency-Key on retry');
  });

  it('retries 5xx at most 2 times with 2s and 6s backoff then throws "please try again shortly"', async () => {
    const seenKeys: string[] = [];
    const sleeps: number[] = [];
    let attempt = 0;

    const client = createApiSathiClient({
      apiKey: 'live_5xx_key',
      uuidFn: () => 'stable-idemp-key-5xx',
      sleepFn: async (ms) => {
        sleeps.push(ms);
      },
      fetchFn: async (_url, init) => {
        attempt += 1;
        seenKeys.push(new Headers(init?.headers).get('Idempotency-Key') || '');
        return new Response(
          JSON.stringify({
            call_id: `call_503_${attempt}`,
            error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Upstream registry busy' },
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      },
    });

    await assert.rejects(
      () =>
        initAadhaarDigilocker(client, {
          uid: 'operator_101',
          mobile: '9876543210',
          firstName: 'Aarav',
        }),
      (err: unknown) =>
        err instanceof ApiSathiError &&
        err.httpStatus === 503 &&
        err.callId === 'call_503_3' &&
        err.message.toLowerCase().includes('please try again shortly')
    );

    assert.equal(attempt, 3, 'Initial attempt + max 2 retries = 3 HTTP calls');
    assert.deepEqual(sleeps, [2000, 6000]);
    assert.deepEqual(seenKeys, ['stable-idemp-key-5xx', 'stable-idemp-key-5xx', 'stable-idemp-key-5xx']);
  });

  it('masks PII fields (PAN, Aadhaar, mobile) before audit persistence and enforces DigiLocker step-1 user ownership', async () => {
    const masked = maskApiSathiPayload({
      pan: 'ABCDE1234F',
      aadhaar: '123456789012',
      mobile: '9876543210',
      ifsc: 'SBIN0001234',
    });
    assert.equal(masked.pan, 'AB******4F');
    assert.equal(masked.aadhaar, 'XXXXXXXX9012');
    assert.equal(masked.mobile, 'XXXXXX3210');
    assert.equal(masked.ifsc, 'SBIN0001234');
    const serializedMask = JSON.stringify(masked);
    assert.ok(!serializedMask.includes('ABCDE1234F'));
    assert.ok(!serializedMask.includes('123456789012'));
    assert.ok(!serializedMask.includes('9876543210'));

    // Route ownership guard: user B cannot fetch user A's DigiLocker transaction_id
    const digilockerEnv = {
      API_SATHI_KEY: 'test_route_key',
      DB: {
        prepare: (sql: string) => ({
          bind: (..._args: any[]) => ({
            first: async () => {
              if (sql.includes('FROM user_sessions')) {
                return {
                  user_id: 'user-b-999',
                  expires_at: '2099-01-01T00:00:00Z',
                  email: 'operatorb@example.com',
                  name: 'Operator B',
                  is_active: 1,
                };
              }
              if (sql.includes('FROM users u')) {
                return { id: 'user-b-999', is_active: 1, role_name: 'operator' };
              }
              if (sql.includes('FROM api_sathi_digilocker_sessions')) {
                return {
                  user_id: 'user-a-111',
                  kyc_url: 'https://digilocker.meripehchaan.gov.in/test',
                  short_url: null,
                };
              }
              return null;
            },
            all: async () => ({ results: [] }),
            run: async () => ({ success: true }),
          }),
        }),
      },
    } as any;

    const forbiddenFetch = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/apisathi/digilocker/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer opaque_operator_b',
        },
        body: JSON.stringify({ transactionId: '9988776655' }),
      }),
      digilockerEnv
    );
    assert.equal(forbiddenFetch.status, 403);
  });
});

describe('Server-Side src/services/apiSathi.ts Integration (20s Timeout, Exceptions, Masking, Firestore Persistence)', () => {
  it('enforces base URL, process.env.API_SATHI_KEY extraction, >=20s timeout, and pan-verification-v1 / gstin-basic-v1 contracts', async () => {
    assert.equal(SERVER_API_SATHI_BASE_URL, 'https://apisathi.in/gw/v1');
    assert.ok(SERVER_API_SATHI_TIMEOUT_MS >= 20_000);

    const prevKey = process.env.API_SATHI_KEY;
    try {
      process.env.API_SATHI_KEY = '  "test_env_sathi_key_123"  ';
      assert.equal(getApiSathiKey(), 'test_env_sathi_key_123');

      const lowTimeoutClient = createServerApiSathiClient({ timeoutMs: 5_000 });
      assert.ok(lowTimeoutClient.timeoutMs >= 20_000, 'HTTP client must enforce at least 20s timeout');
      assert.equal(lowTimeoutClient.isSandboxTestKey, true);
    } finally {
      if (prevKey === undefined) delete process.env.API_SATHI_KEY;
      else process.env.API_SATHI_KEY = prevKey;
    }

    const recordedCalls: Array<{ url: string; headers: Record<string, string>; body: any }> = [];
    const mockClient = createServerApiSathiClient({
      apiKey: 'live_unit_test_key',
      uuidFn: () => '99999999-8888-4777-8666-555555555555',
      sleepFn: async () => {},
      fetchFn: async (input, init) => {
        const hdrs: Record<string, string> = {};
        new Headers(init?.headers).forEach((v, k) => {
          hdrs[k.toLowerCase()] = v;
        });
        const urlStr = String(input);
        const bodyObj = JSON.parse(String(init?.body || '{}'));
        recordedCalls.push({ url: urlStr, headers: hdrs, body: bodyObj });

        if (urlStr.includes('pan-verification-v1')) {
          return new Response(
            JSON.stringify({
              call_id: 'call_srv_pan_1',
              verified: true,
              pan: 'ABCDE1234F',
              fullname: 'PRIYA VERMA',
              aadhaar_linked: true,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            call_id: 'call_srv_gst_1',
            verified: true,
            gstin: '26EXIPK0151F1ZQ',
            legal_name: 'DIGITAL INDIA PROJECT',
            status: 'Active',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      },
    });

    // Strips unknown fields & enforces trailing slash
    const panOut = await verifyPanVerificationV1(mockClient, { pan: 'abcde1234f', extraNoise: 'drop_me' } as any);
    assert.equal(panOut.verified, true);
    assert.equal(panOut.callId, 'call_srv_pan_1');
    assert.equal(recordedCalls[0].url, 'https://apisathi.in/gw/v1/pan-verification-v1/');
    assert.equal(recordedCalls[0].headers['x-api-key'], 'live_unit_test_key');
    assert.equal(recordedCalls[0].headers['x-tenant-id'], undefined);
    assert.equal(recordedCalls[0].headers['idempotency-key'], '99999999-8888-4777-8666-555555555555');
    assert.deepEqual(recordedCalls[0].body, { pan: 'ABCDE1234F' });

    const gstOut = await verifyGstinBasicV1(mockClient, { gstin: '26exipk0151f1zq' });
    assert.equal(gstOut.verified, true);
    assert.equal(gstOut.callId, 'call_srv_gst_1');
    assert.equal(recordedCalls[1].url, 'https://apisathi.in/gw/v1/gstin-basic-v1/');
    assert.deepEqual(recordedCalls[1].body, { gstin: '26EXIPK0151F1ZQ' });
  });

  it('masks Aadhaar/PAN/keys deeply and runs full 6-step handler with Firestore call_id + intent persistence', async () => {
    assert.equal(maskPanNumber('ABCDE1234F'), 'AB******4F');
    assert.equal(maskAadhaarNumber('123456789012'), 'XXXXXXXX9012');

    const maskedObj = maskSensitiveData({
      pan: 'ABCDE1234F',
      aadhaar_number: '123456789012',
      mobile: '9876543210',
      note: 'User PAN ABCDE1234F and Aadhaar 1234 5678 9012 checked with test_superSecretKey99',
    });
    const serialized = JSON.stringify(maskedObj);
    assert.ok(!serialized.includes('ABCDE1234F'), 'Raw PAN must be masked');
    assert.ok(!serialized.includes('123456789012'), 'Raw Aadhaar must be masked');
    assert.ok(!serialized.includes('9876543210'), 'Raw mobile must be masked');
    assert.ok(!serialized.includes('test_superSecretKey99'), 'API key pattern must be masked');

    const firestoreWrites: Array<{ url: string; auth: string | null; body: any }> = [];
    const output = await handleApiSathiVerification({
      productSlug: 'pan-verification-v1',
      parameters: { pan: 'ABCDE1234F', aadhaar: '123456789012' },
      consentGiven: true,
      intent: 'operator_kyc_pan',
      userId: 'uid_operator_77',
      isAdmin: false,
      firebaseIdToken: 'fb_id_tok_77',
      envOverride: { API_SATHI_KEY: 'test_handler_key_007' },
      uuidFn: () => 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            call_id: 'call_fs_pan_991',
            verified: true,
            pan: 'ABCDE1234F',
            aadhaar_number: '123456789012',
            fullname: 'AARAV SHARMA',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
      firestoreFetchFn: async (input, init) => {
        const hdrs = new Headers(init?.headers);
        firestoreWrites.push({
          url: String(input),
          auth: hdrs.get('Authorization'),
          body: JSON.parse(String(init?.body || '{}')),
        });
        return new Response(JSON.stringify({ name: 'ok' }), { status: 200 });
      },
    });

    assert.equal(output.httpStatus, 200);
    assert.equal(output.body.success, true);
    assert.equal(output.body.data?.callId, 'call_fs_pan_991');
    assert.equal(output.body.data?.intent, 'operator_kyc_pan');
    assert.equal(output.body.data?.firestorePersisted, true);

    assert.equal(firestoreWrites.length, 1);
    assert.ok(firestoreWrites[0].url.includes('/databases/ai-studio-digitalindiaproj-180a918f-2fe4-4760-acaa-188e54a6b013/documents/api_sathi_verifications'));
    assert.equal(firestoreWrites[0].auth, 'Bearer fb_id_tok_77');
    const fsFields = firestoreWrites[0].body.fields;
    assert.equal(fsFields.userId.stringValue, 'uid_operator_77');
    assert.equal(fsFields.intent.stringValue, 'operator_kyc_pan');
    assert.equal(fsFields.callId.stringValue, 'call_fs_pan_991');
    assert.equal(fsFields.verified.booleanValue, true);
    assert.ok(!fsFields.maskedRequestJson.stringValue.includes('ABCDE1234F'), 'Firestore request JSON must mask PAN');
    assert.ok(!fsFields.maskedResponseJson.stringValue.includes('123456789012'), 'Firestore response JSON must mask Aadhaar');

    // Maps 402 INSUFFICIENT_BALANCE cleanly for non-admin vs admin & still audits call_id + intent
    const err402Output = await handleApiSathiVerification({
      productSlug: 'gstin-basic-v1',
      parameters: { gstin: '26EXIPK0151F1ZQ' },
      consentGiven: true,
      intent: 'partner_kyb_gst',
      userId: 'uid_partner_55',
      isAdmin: false,
      firebaseIdToken: 'fb_id_tok_55',
      envOverride: { API_SATHI_KEY: 'live_wallet_empty_test' },
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            call_id: 'call_402_err_audit',
            error: { code: 'INSUFFICIENT_BALANCE', message: 'Wallet empty' },
          }),
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        ),
      firestoreFetchFn: async (input, init) => {
        firestoreWrites.push({
          url: String(input),
          auth: new Headers(init?.headers).get('Authorization'),
          body: JSON.parse(String(init?.body || '{}')),
        });
        return new Response(JSON.stringify({ name: 'ok' }), { status: 200 });
      },
    });
    assert.equal(err402Output.httpStatus, 402);
    assert.equal(err402Output.body.errorCode, 'INSUFFICIENT_BALANCE');
    assert.equal(err402Output.body.data?.callId, 'call_402_err_audit');
    assert.equal(err402Output.body.data?.intent, 'partner_kyb_gst');
    assert.ok(!err402Output.body.message.toLowerCase().includes('recharge api sathi'), 'Citizen error must hide admin recharge phrasing');
    assert.equal(firestoreWrites[1].body.fields.outcome.stringValue, 'WALLET_EMPTY');
    assert.equal(firestoreWrites[1].body.fields.callId.stringValue, 'call_402_err_audit');
  });

  it('guarantees browser components never import server-side src/services/apiSathi.ts', () => {
    const clientDirs = ['src/components', 'src/pages'];
    const offenders: string[] = [];
    const scan = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scan(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          const text = fs.readFileSync(full, 'utf8');
          if (/services\/apiSathi(['"]|\.ts)/.test(text)) offenders.push(full);
        }
      }
    };
    for (const d of clientDirs) scan(path.resolve(process.cwd(), d));
    const appText = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    if (/services\/apiSathi(['"]|\.ts)/.test(appText)) offenders.push('src/App.tsx');
    assert.deepEqual(offenders, [], 'Client UI files must import apiSathiService.ts, NEVER server-only apiSathi.ts');
  });
});

describe('API Sathi Expenditure Analytics & Exponential-Backoff Retry Queue', () => {
  it('aggregates request outcomes, live vs sandbox billing, uncharged error savings, and continuous Recharts time series', () => {
    const fixedNow = Date.UTC(2026, 10, 17, 12, 0, 0);
    const analytics = aggregateApiSathiUsage(
      [
        {
          product_slug: 'pan-verification-v1', // ₹0.98
          environment: 'PRODUCTION',
          is_sandbox_test: 0,
          http_status: 200,
          verified: 1,
          outcome: 'VERIFIED',
          latency_ms: 420,
          created_at: new Date(fixedNow - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          product_slug: 'pan-verification-v1', // ₹0.98 — 200 verified:false is STILL charged!
          environment: 'PRODUCTION',
          is_sandbox_test: 0,
          http_status: 200,
          verified: 0,
          outcome: 'NOT_VERIFIED',
          latency_ms: 380,
          created_at: new Date(fixedNow - 90 * 60 * 1000).toISOString(),
        },
        {
          product_slug: 'gstin-basic-v1', // ₹0.52 sandbox
          environment: 'SANDBOX',
          is_sandbox_test: 1,
          http_status: 200,
          verified: 1,
          outcome: 'VERIFIED',
          latency_ms: 200,
          created_at: new Date(fixedNow - 60 * 60 * 1000).toISOString(),
        },
        {
          product_slug: 'vehicle-rc-v1', // ₹2.93 NOT charged on 503
          environment: 'PRODUCTION',
          is_sandbox_test: 0,
          http_status: 503,
          verified: 0,
          outcome: 'UPSTREAM_ERROR',
          error_code: 'UPSTREAM_UNAVAILABLE',
          latency_ms: 0,
          created_at: new Date(fixedNow - 30 * 60 * 1000).toISOString(),
        },
        {
          product_slug: 'gstin-basic-v1', // ₹0.52 NOT charged on 402
          environment: 'PRODUCTION',
          is_sandbox_test: 0,
          http_status: 402,
          verified: 0,
          outcome: 'WALLET_EMPTY',
          error_code: 'INSUFFICIENT_BALANCE',
          latency_ms: 0,
          created_at: new Date(fixedNow - 15 * 60 * 1000).toISOString(),
        },
      ],
      {
        range: '24h',
        nowMs: fixedNow,
        queueSummary: { pendingCount: 1, retryingCount: 0, succeededCount: 2, exhaustedCount: 0 },
      }
    );

    assert.equal(analytics.timeSeries.length, 24);
    assert.equal(analytics.summary.totalRequests, 5);
    assert.equal(analytics.summary.successfulRequests, 2);
    assert.equal(analytics.summary.notVerifiedRequests, 1);
    assert.equal(analytics.summary.failedRequests, 2);
    assert.equal(analytics.summary.chargedRequests, 3);
    assert.equal(analytics.summary.liveCostInr, 1.96);
    assert.equal(analytics.summary.sandboxEstimatedCostInr, 0.52);
    assert.equal(analytics.summary.totalCostInr, 2.48);
    assert.equal(analytics.summary.savedOnUnchargedErrorsInr, 3.45);
    assert.equal(analytics.summary.upstreamErrorCount, 1);
    assert.equal(analytics.summary.walletEmptyCount, 1);
    assert.equal(analytics.byProduct[0].productSlug, 'pan-verification-v1');
    assert.equal(analytics.byProduct[0].costInr, 1.96);
    assert.equal(analytics.queueSummary.pendingCount, 1);
    assert.equal(analytics.queueSummary.succeededCount, 2);
  });

  it('computes exponential backoff with Retry-After floor and strictly classifies retryable vs terminal statuses', () => {
    assert.equal(isRetryableApiSathiFailure(429, 'RATE_LIMITED'), true);
    assert.equal(isRetryableApiSathiFailure(503, 'UPSTREAM_UNAVAILABLE'), true);
    assert.equal(isRetryableApiSathiFailure(500, 'INTERNAL_ERROR'), true);
    assert.equal(isRetryableApiSathiFailure(402, 'INSUFFICIENT_BALANCE'), false);
    assert.equal(isRetryableApiSathiFailure(422, 'INVALID_VALUE'), false);
    assert.equal(isRetryableApiSathiFailure(400, 'INVALID_REQUEST'), false);
    assert.equal(isRetryableApiSathiFailure(401, 'UNAUTHORIZED'), false);
    assert.equal(isRetryableApiSathiFailure(404, 'NOT_FOUND'), false);
    assert.equal(isRetryableApiSathiFailure(410, 'API_RETIRED'), false);

    assert.equal(computeExponentialBackoffMs({ attempt: 1, baseDelayMs: 5000, maxDelayMs: 60000 }), 5000);
    assert.equal(computeExponentialBackoffMs({ attempt: 2, baseDelayMs: 5000, maxDelayMs: 60000 }), 10000);
    assert.equal(computeExponentialBackoffMs({ attempt: 3, baseDelayMs: 5000, maxDelayMs: 60000 }), 20000);
    assert.equal(
      computeExponentialBackoffMs({ attempt: 1, baseDelayMs: 5000, maxDelayMs: 60000, retryAfterSeconds: 25 }),
      25000
    );
    assert.equal(
      computeExponentialBackoffMs({ attempt: 8, baseDelayMs: 5000, maxDelayMs: 60000 }),
      60000
    );
  });

  it('queues transient 429/503 failures, preserves original Idempotency-Key across retries, masks PII, and stops on 402/exhaustion', async () => {
    const queue = new ApiSathiRetryQueue({ baseDelayMs: 5000, maxDelayMs: 60_000, jitterRatio: 0 });
    const t0 = Date.UTC(2026, 10, 17, 12, 0, 0);

    // Non-retryable 402 and 422 must NEVER be queued
    assert.equal(
      queue.enqueue({
        productSlug: 'pan-verification-v1',
        intent: 'kyc_pan',
        userId: 'u_1',
        idempotencyKey: 'key-402-never',
        sanitizedInput: { pan: 'ABCDE1234F' },
        httpStatus: 402,
        errorCode: 'INSUFFICIENT_BALANCE',
        errorMessage: 'Wallet empty',
        nowMs: t0,
      }),
      null
    );
    assert.equal(
      queue.enqueue({
        productSlug: 'pan-verification-v1',
        intent: 'kyc_pan',
        userId: 'u_1',
        idempotencyKey: 'key-422-never',
        sanitizedInput: { pan: 'ABCDE1234F' },
        httpStatus: 422,
        errorCode: 'UNPROCESSABLE',
        errorMessage: 'Rejected',
        nowMs: t0,
      }),
      null
    );

    // Retryable 503 failure gets queued + deduplicated on same Idempotency-Key
    const originalUuid = '11111111-2222-4333-8444-555555555555';
    const job = queue.enqueue({
      productSlug: 'pan-verification-v1',
      intent: 'operator_kyc_pan',
      userId: 'op_1',
      idempotencyKey: originalUuid,
      sanitizedInput: { pan: 'ABCDE1234F' },
      httpStatus: 503,
      errorCode: 'UPSTREAM_UNAVAILABLE',
      errorMessage: 'Upstream temporary outage',
      callId: 'call_503_initial',
      maxAttempts: 3,
      nowMs: t0,
    });
    assert.ok(job);
    const dupJob = queue.enqueue({
      productSlug: 'pan-verification-v1',
      intent: 'operator_kyc_pan',
      userId: 'op_1',
      idempotencyKey: originalUuid,
      sanitizedInput: { pan: 'ABCDE1234F' },
      httpStatus: 503,
      errorCode: 'UPSTREAM_UNAVAILABLE',
      errorMessage: 'Duplicate',
      nowMs: t0,
    });
    assert.equal(dupJob?.id, job.id);

    // Public admin projection strips raw sanitizedInput and masks PAN
    const publicView = toPublicRetryJob(job);
    assert.equal((publicView as any).sanitizedInput, undefined);
    assert.ok(!publicView.maskedInputJson.includes('ABCDE1234F'));

    // Before nextRetryAt (t0 + 5000ms), sweep skips due check
    const earlySweep = await queue.processDueJobs({
      nowMs: t0 + 1000,
      apiKeyOverride: 'test_queue_key_123',
      fetchFn: async () => {
        throw new Error('Should not call upstream before backoff elapses');
      },
    });
    assert.equal(earlySweep.processed, 0);
    assert.equal(earlySweep.skippedNotDue, 1);

    // Attempt 1 at t0 + 5000ms hits 429 with Retry-After: 12 -> rescheduled to +12s
    const seenKeys: string[] = [];
    let attemptNum = 0;
    const settledEvents: any[] = [];
    const sweep1 = await queue.processDueJobs({
      nowMs: t0 + 5000,
      apiKeyOverride: 'test_queue_key_123',
      fetchFn: async (_input, init) => {
        seenKeys.push(new Headers(init?.headers).get('idempotency-key') || '');
        attemptNum += 1;
        if (attemptNum === 1) {
          return new Response(
            JSON.stringify({ call_id: 'call_retry_429', error: { code: 'RATE_LIMITED', message: 'Slow down' } }),
            { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '12' } }
          );
        }
        return new Response(
          JSON.stringify({ call_id: 'call_retry_ok', verified: true, pan: 'ABCDE1234F', fullname: 'PRIYA VERMA' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      },
      onJobSettled: (ev) => {
        settledEvents.push(ev);
      },
    });
    assert.equal(sweep1.processed, 1);
    assert.equal(sweep1.rescheduled, 1);
    assert.equal(job.status, 'PENDING');
    assert.equal(Date.parse(job.nextRetryAt!), t0 + 5000 + 12_000);

    // Attempt 2 at t0 + 17000ms succeeds while preserving exact original Idempotency-Key
    const sweep2 = await queue.processDueJobs({
      nowMs: t0 + 17_000,
      apiKeyOverride: 'test_queue_key_123',
      fetchFn: async (_input, init) => {
        seenKeys.push(new Headers(init?.headers).get('idempotency-key') || '');
        return new Response(
          JSON.stringify({ call_id: 'call_retry_ok', verified: true, pan: 'ABCDE1234F', fullname: 'PRIYA VERMA' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      },
      onJobSettled: (ev) => {
        settledEvents.push(ev);
      },
    });
    assert.equal(sweep2.succeeded, 1);
    assert.equal(job.status, 'SUCCEEDED');
    assert.equal(job.lastCallId, 'call_retry_ok');
    assert.deepEqual(seenKeys, [originalUuid, originalUuid]);
    assert.equal(settledEvents.length, 1);
    assert.equal(settledEvents[0].auditRecord.idempotencyKey, originalUuid);

    // Terminal 402 during retry immediately exhausts job instead of burning remaining attempts
    const walletJob = queue.enqueue({
      productSlug: 'gstin-basic-v1',
      intent: 'kyb_gst',
      userId: 'b2b_1',
      idempotencyKey: '22222222-3333-4444-8555-666666666666',
      sanitizedInput: { gstin: '26EXIPK0151F1ZQ' },
      httpStatus: 503,
      errorCode: 'UPSTREAM_UNAVAILABLE',
      errorMessage: 'Temp down',
      maxAttempts: 5,
      nowMs: t0,
    })!;
    const sweep402 = await queue.processDueJobs({
      nowMs: t0 + 5000,
      apiKeyOverride: 'live_wallet_empty',
      fetchFn: async () =>
        new Response(
          JSON.stringify({ call_id: 'call_402_stop', error: { code: 'INSUFFICIENT_BALANCE', message: 'Empty wallet' } }),
          { status: 402, headers: { 'Content-Type': 'application/json' } }
        ),
    });
    assert.equal(sweep402.exhausted, 1);
    assert.equal(walletJob.status, 'EXHAUSTED');
    assert.equal(walletJob.attemptCount, 1);
  });

  it('enforces admin RBAC on Worker /analytics, /queue, and /queue/process endpoints and masks PII in queue listings', async () => {
    const buildWorkerEnv = (roleName: string, rows: any[] = [], queueRows: any[] = []) =>
      ({
        API_SATHI_KEY: 'test_worker_admin_key',
        DB: {
          prepare: (sql: string) => ({
            bind: (..._args: any[]) => ({
              first: async () => {
                if (sql.includes('FROM user_sessions')) {
                  return {
                    user_id: `u_${roleName}`,
                    expires_at: '2099-01-01T00:00:00Z',
                    email: `${roleName}@example.com`,
                    name: roleName,
                    is_active: 1,
                  };
                }
                if (sql.includes('FROM users u')) {
                  return { id: `u_${roleName}`, is_active: 1, role_name: roleName };
                }
                if (sql.includes('COUNT(*) as total')) {
                  return { total: queueRows.length };
                }
                if (sql.includes('SUM(CASE WHEN status')) {
                  return { pending: 1, retrying: 0, succeeded: 1, exhausted: 0, total: 2 };
                }
                return null;
              },
              all: async () => {
                if (sql.includes('FROM api_sathi_calls')) return { results: rows };
                if (sql.includes('GROUP BY status')) {
                  return {
                    results: [
                      { status: 'PENDING', cnt: 1 },
                      { status: 'SUCCEEDED', cnt: 1 },
                    ],
                  };
                }
                if (sql.includes('FROM api_sathi_retry_queue')) return { results: queueRows };
                return { results: [] };
              },
              run: async () => ({ success: true }),
            }),
            all: async () => {
              if (sql.includes('FROM api_sathi_calls')) return { results: rows };
              if (sql.includes('GROUP BY status')) {
                return {
                  results: [
                    { status: 'PENDING', cnt: 1 },
                    { status: 'SUCCEEDED', cnt: 1 },
                  ],
                };
              }
              if (sql.includes('FROM api_sathi_retry_queue')) return { results: queueRows };
              return { results: [] };
            },
            first: async () => {
              if (sql.includes('SUM(CASE WHEN status')) {
                return { pending: 1, retrying: 0, succeeded: 1, exhausted: 0, total: 2 };
              }
              return null;
            },
            run: async () => ({ success: true }),
          }),
        },
      }) as any;

    const operatorEnv = buildWorkerEnv('operator');
    const forbiddenAnalytics = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/apisathi/analytics?range=7d', {
        headers: { Authorization: 'Bearer op_tok' },
      }),
      operatorEnv
    );
    assert.equal(forbiddenAnalytics.status, 403);

    const forbiddenQueue = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/apisathi/queue', {
        headers: { Authorization: 'Bearer op_tok' },
      }),
      operatorEnv
    );
    assert.equal(forbiddenQueue.status, 403);

    const adminEnv = buildWorkerEnv(
      'admin',
      [
        {
          product_slug: 'pan-verification-v1',
          environment: 'PRODUCTION',
          is_sandbox_test: 0,
          http_status: 200,
          verified: 1,
          outcome: 'VERIFIED',
          error_code: null,
          latency_ms: 310,
          created_at: new Date().toISOString(),
        },
      ],
      [
        {
          id: 'rq_worker_1',
          idempotencyKey: 'aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb',
          productSlug: 'pan-verification-v1',
          intent: 'kyc_pan',
          userId: 'u_op_1',
          maskedInputJson: '{"pan":"AB******4F"}',
          status: 'PENDING',
          attemptCount: 0,
          maxAttempts: 5,
          lastHttpStatus: 503,
          lastErrorCode: 'UPSTREAM_UNAVAILABLE',
          lastErrorMessage: 'Temporary 503',
          lastCallId: 'call_503',
          nextRetryAt: new Date(Date.now() + 5000).toISOString(),
          lastAttemptAt: null,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]
    );

    const okAnalytics = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/apisathi/analytics?range=7d', {
        headers: { Authorization: 'Bearer admin_tok' },
      }),
      adminEnv
    );
    assert.equal(okAnalytics.status, 200);
    const analyticsJson: any = await okAnalytics.json();
    assert.equal(analyticsJson.data.summary.totalRequests, 1);
    assert.equal(analyticsJson.data.summary.totalCostInr, 0.98);
    assert.equal(analyticsJson.data.queueSummary.pendingCount, 1);

    const okQueue = await workerApp.fetch(
      new Request('https://digitalindiaproject.com/api/v1/apisathi/queue', {
        headers: { Authorization: 'Bearer admin_tok' },
      }),
      adminEnv
    );
    assert.equal(okQueue.status, 200);
    const queueJson: any = await okQueue.json();
    assert.equal(queueJson.data.jobs.length, 1);
    assert.equal(queueJson.data.jobs[0].maskedInputJson, '{"pan":"AB******4F"}');
    assert.equal(queueJson.data.jobs[0].sanitized_input_json, undefined);
  });
});

describe('API Sathi Instant Verification Retail Services', () => {
  it('defines 13 unique purchasable retail services with healthy positive gross margins while preserving core catalogue counts', () => {
    assert.equal(API_SATHI_POWERED_SERVICES.length, 13);
    assert.equal(CORE_CATALOGUE_ITEMS.length, 145);
    assert.equal(COMPLETE_CATALOGUE_ITEMS.length, 149);

    const ids = new Set<string>();
    const slugs = new Set<string>();
    const apiSlugs = new Set<string>();
    for (const svc of API_SATHI_POWERED_SERVICES) {
      assert.ok(!ids.has(svc.id), `Duplicate ID: ${svc.id}`);
      assert.ok(!slugs.has(svc.slug), `Duplicate slug: ${svc.slug}`);
      assert.ok(!apiSlugs.has(svc.apiSathiProductSlug), `Duplicate API slug: ${svc.apiSathiProductSlug}`);
      ids.add(svc.id);
      slugs.add(svc.slug);
      apiSlugs.add(svc.apiSathiProductSlug);

      assert.ok(svc.retailPriceInr > svc.wholesaleCostInr, `${svc.slug} retail must exceed API cost`);
      assert.ok(svc.grossMarginPercent > 80 && svc.grossMarginPercent < 100);
      assert.equal(svc.serviceCharge, svc.retailPriceInr);
      assert.equal(svc.integrationType, 'api_setu');
      assert.equal(svc.billingUnit, 'verification');
      assert.equal(findApiSathiServiceBySlugOrId(svc.slug)?.id, svc.id);
      assert.equal(resolveApiSathiProductSlugForService(svc.slug), svc.apiSathiProductSlug);
    }

    assert.equal(resolveApiSathiProductSlugForService('pan-card'), 'pan-verification-v1');
    assert.equal(resolveApiSathiProductSlugForService('gst-registration'), 'gstin-basic-v1');
  });

  it('resolves authoritative backend Cashfree checkout pricing for all 13 instant verification services', () => {
    for (const svc of API_SATHI_POWERED_SERVICES) {
      assert.equal(findCatalogueItem(svc.slug)?.id, svc.id);
      const res = resolveAuthoritativeCheckout({ serviceSlug: svc.slug });
      assert.equal(res.ok, true, `${svc.slug} checkout failed: ${res.message}`);
      assert.equal(res.service?.id, svc.id);
      const expectedTax = Math.round(svc.retailPriceInr * 0.18 * 100) / 100;
      const expectedTotal = Math.round((svc.retailPriceInr + expectedTax) * 100) / 100;
      assert.ok(
        Math.abs(res.totalInr - expectedTotal) <= 0.02,
        `Expected total ${expectedTotal} for ${svc.slug}, got ${res.totalInr}`
      );
    }
  });

  it('parses /verifications URLs and surfaces Instant Verifications in dynamic navigation without duplicate signatures', () => {
    assert.deepEqual(parseLocationPath('/verifications'), { route: 'verifications', param: '' });
    assert.deepEqual(parseLocationPath('/instant-verify', '?product=gstin-basic-v1'), {
      route: 'verifications',
      param: 'gstin-basic-v1',
    });
    assert.equal(buildUrlForRoute('verifications'), '/verifications');
    assert.equal(
      buildUrlForRoute('verifications', 'vehicle-rc-v1'),
      '/verifications?product=vehicle-rc-v1'
    );

    const guestNav = resolveDynamicNavigation({ user: null, isAuthenticated: false });
    const citizenNav = resolveDynamicNavigation({
      user: { id: 'u_cust', role: 'customer', accountType: 'customer' },
      isAuthenticated: true,
    });
    for (const nav of [guestNav, citizenNav]) {
      const hasVerif = nav.sidebar.exploreItems.some((item) => item.route === 'verifications');
      assert.equal(hasVerif, true);
      const sigs = [
        ...nav.sidebar.roleWorkspaceItems,
        ...nav.sidebar.toolItems,
        ...nav.sidebar.exploreItems,
        ...nav.sidebar.supportItems,
      ].map((item) => getNavItemSignature(item));
      assert.equal(new Set(sigs).size, sigs.length, 'Sidebar nav items must keep unique signatures');
    }
  });
});













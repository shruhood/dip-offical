import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Service,
  ServiceCategory,
  Application,
  PaymentTransaction,
  SupportTicket,
  ApplicationDocument,
  StatusHistoryEntry,
  ApplicationStatus,
  ApplicationSourceChannel,
  OperatorEnrollment,
  OperatorKycStatus,
  PartnerProfile,
  PartnerApprovalStatus,
  PartnerCustomer,
  CommissionRule,
  CommissionLedgerEntry,
  SettlementRequest,
  RefundRecord,
  PlatformNotification,
  NotificationTemplate,
  BusinessSettings,
  ApiIntegrationConfig,
  ActivityLog,
  UserRole,
  BlogPost,
  BlogPostStatus,
  CouponRecord,
  DigitalProductOrder,
  CustomQuoteRequest,
  CatalogueImportReport,
} from '../types';
import {
  INITIAL_SERVICES,
  SERVICE_CATEGORIES,
} from '../data/initialData';
import { findApiSathiServiceBySlugOrId } from '../data/apiSathiServices';
import { INITIAL_COUPONS, CORE_CATALOGUE_ITEMS, COMPLETE_CATALOGUE_ITEMS } from '../data/catalogue';
import { runIdempotentCatalogueImport } from '../lib/catalogueImporter';
import { mapCatalogServiceToFirestoreRecord } from '../lib/catalogueSync';
import { syncServicesCatalogueToFirestore } from '../lib/firestoreCatalogueSync';
import { resolveCouponValidation } from '../lib/catalogueServer';
import { INITIAL_BLOG_POSTS } from '../data/initialBlogPosts';
import { slugifyBlogTitle, estimateReadingTime } from '../lib/blogSeo';
import { useAuth } from './AuthContext';
import { auth, db, handleFirestoreError, OperationType } from '../services/firebase';
import {
  addPartnerCustomerBackend,
  assignApplicationBackend,
  bulkAssignApplicationsBackend,
  completeApplicationBackend,
  createSupportTicketBackend,
  createUnifiedApplicationBackend,
  dispatchPaymentStatusAlert,
  enrollPartnerBackend,
  importCatalogueToBackend,
  markAllNotificationsReadBackend,
  processRefundBackend,
  replySupportTicketBackend,
  requestRefundBackend,
  requestSettlementBackend,
  reviewApplicationDocumentBackend,
  submitCustomQuote,
  syncBlogPostToD1,
  syncCatalogueServicesBackend,
  trackApplicationVerified,
} from '../services/backendApi';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { validateStatusTransition } from '../lib/workflow';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PermissionCode,
  RolePermissionMap,
  isSuperAdminRole,
  normalizeRole,
} from '../lib/rbac';
import {
  calculateOrderTotalsPaise,
  calculatePartnerCommission,
  fromPaise,
  toPaise,
} from '../lib/finance';
import {
  buildPaymentStatusAlertNotification,
  deriveInitialPaymentUiStatus,
  mapUiStatusToRecordStatus,
  type PaymentUiStatus,
} from '../lib/paymentStatus';

export interface ApplicationDraft {
  id: string;
  serviceSlug: string;
  serviceName: string;
  userId: string;
  filingMode: 'self' | 'assisted';
  formData: Record<string, any>;
  savedAt: string;
}

export interface CreateApplicationMeta {
  sourceChannel?: ApplicationSourceChannel;
  userId?: string;
  collectedByUid?: string;
  assignedOperatorId?: string;
  assignedOperatorName?: string;
  businessId?: string;
  filingMode?: 'self' | 'assisted';
  partnerId?: string;
  partnerName?: string;
  referralCodeUsed?: string;
  assistedConsentRecorded?: boolean;
  applicantName?: string;
  draftIdToRemove?: string;
  paymentDetails?: {
    orderId: string;
    cfPaymentId?: string;
    amount?: number;
    paymentMethod?: string;
    paidAt?: string;
    bankReference?: string;
    verifiedByGateway?: boolean;
    urgentProcessing?: boolean;
    urgentFee?: number;
    couponCode?: string;
    discountAmount?: number;
  };
}

export interface ManagerAccountSummary {
  id: string;
  name: string;
  email: string;
  mobile: string;
  scope: string;
  isActive: boolean;
  createdAt: string;
}

interface DataContextType {
  services: Service[];
  packages: Service[];
  categories: ServiceCategory[];
  coupons: CouponRecord[];
  digitalOrders: DigitalProductOrder[];
  quoteRequests: CustomQuoteRequest[];
  importReports: CatalogueImportReport[];
  blogPosts: BlogPost[];
  applications: Application[];
  drafts: ApplicationDraft[];
  transactions: PaymentTransaction[];
  tickets: SupportTicket[];
  operatorEnrollments: OperatorEnrollment[];
  partners: PartnerProfile[];
  partnerCustomers: PartnerCustomer[];
  commissionRules: CommissionRule[];
  commissionLedger: CommissionLedgerEntry[];
  settlementRequests: SettlementRequest[];
  refunds: RefundRecord[];
  notifications: PlatformNotification[];
  notificationTemplates: NotificationTemplate[];
  businessSettings: BusinessSettings;
  apiIntegrations: ApiIntegrationConfig[];
  auditLogs: ActivityLog[];
  rolePermissions: RolePermissionMap;
  managers: ManagerAccountSummary[];
  getServiceBySlug: (slug: string) => Service | undefined;
  validateCoupon: (
    code: string,
    serviceChargeInr: number,
    category?: string
  ) => ReturnType<typeof resolveCouponValidation>;
  saveCoupon: (coupon: CouponRecord) => void;
  deleteCoupon: (couponId: string) => void;
  saveCategory: (category: ServiceCategory) => void;
  purchaseDigitalProduct: (params: {
    service: Service;
    orderId: string;
    amountPaid: number;
    discountAmount?: number;
    couponCode?: string;
  }) => DigitalProductOrder;
  recordProductDownload: (orderIdOrSlug: string) => void;
  submitQuoteRequest: (input: {
    serviceId: string;
    serviceSlug: string;
    serviceName: string;
    contactName: string;
    contactEmail: string;
    contactMobile: string;
    companyName?: string;
    requirementsSummary: string;
    budgetRange?: string;
  }) => Promise<CustomQuoteRequest>;
  updateQuoteRequestStatus: (
    quoteId: string,
    status: CustomQuoteRequest['status'],
    quotedAmountInr?: number,
    adminNotes?: string
  ) => void;
  importCatalogue: (
    rawInput: string | Service[],
    formatHint?: 'json' | 'csv' | 'system_sync'
  ) => Promise<CatalogueImportReport>;
  syncCatalogueServicesToDatabase: (options?: {
    includePackages?: boolean;
    dryRun?: boolean;
    forceRefreshSeo?: boolean;
  }) => Promise<CatalogueImportReport>;
  createApplication: (
    serviceSlug: string,
    formData: Record<string, any>,
    documents: any[],
    meta?: CreateApplicationMeta
  ) => Promise<Application>;
  saveDraft: (draft: Omit<ApplicationDraft, 'id' | 'savedAt'> & { id?: string }) => ApplicationDraft;
  deleteDraft: (draftId: string) => void;
  updateApplicationStatus: (
    appId: string,
    newStatus: ApplicationStatus,
    customerMsg: string,
    internalNote?: string,
    updatedBy?: string,
    updatedByRole?: UserRole
  ) => Promise<{ ok: boolean; error?: string }>;
  assignOperator: (appId: string, operatorId: string, operatorName: string) => Promise<void>;
  bulkAssignOperator: (appIds: string[], operatorId: string, operatorName: string) => Promise<void>;
  verifyDocument: (
    appId: string,
    docId: string,
    status: 'Verified' | 'Rejected' | 'Re-upload Requested',
    reason?: string
  ) => Promise<void>;
  uploadCompletionDocument: (appId: string, fileName: string, fileUrl: string) => Promise<void>;
  uploadAdditionalDocument: (
    appId: string,
    doc: Omit<ApplicationDocument, 'id' | 'uploadedAt' | 'verificationStatus'>
  ) => Promise<void>;
  syncApplicationPaymentStatus: (
    appId: string,
    update: {
      uiStatus: PaymentUiStatus;
      orderId?: string;
      cfPaymentId?: string;
      paymentMethod?: string;
      paidAt?: string;
    }
  ) => Promise<void>;
  trackApplication: (
    appId: string,
    phoneOrEmail: string
  ) => Promise<{ success: boolean; data?: Application; error?: string }>;
  createTicket: (
    ticket: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt' | 'messages'>,
    initialMessage: string
  ) => SupportTicket;
  replyTicket: (
    ticketId: string,
    senderId: string,
    senderName: string,
    role: UserRole,
    message: string
  ) => void;
  createOrUpdateService: (service: Service) => Promise<void>;
  toggleServicePublished: (serviceId: string) => Promise<void>;
  deleteService: (serviceId: string) => Promise<void>;
  submitOperatorEnrollment: (
    enrollment: Omit<OperatorEnrollment, 'id' | 'userId' | 'kycStatus' | 'createdAt' | 'updatedAt'>
  ) => Promise<OperatorEnrollment>;
  reviewOperatorEnrollment: (
    enrollmentId: string,
    decision: OperatorKycStatus,
    remarks: string
  ) => Promise<void>;
  registerPartner: (input: {
    partnerType: PartnerProfile['partnerType'];
    fullName: string;
    businessName: string;
    email: string;
    mobile: string;
    state: string;
    district: string;
    pincode: string;
    panMasked: string;
    bankIfsc: string;
    bankAccountMasked: string;
  }) => Promise<PartnerProfile>;
  reviewPartner: (partnerId: string, status: PartnerApprovalStatus) => Promise<void>;
  addPartnerCustomer: (input: {
    partnerId: string;
    name: string;
    email: string;
    mobile: string;
  }) => PartnerCustomer;
  saveCommissionRule: (rule: CommissionRule) => void;
  requestPartnerSettlement: (partnerId: string, requestedInr: number) => { ok: boolean; error?: string; request?: SettlementRequest };
  processPartnerSettlement: (
    settlementId: string,
    decision: 'Approved' | 'Paid' | 'Rejected',
    payoutReference?: string,
    rejectionReason?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  requestRefund: (input: {
    applicationId: string;
    orderId: string;
    amountInr: number;
    reason: string;
  }) => RefundRecord;
  processRefund: (refundId: string, decision: 'Processed' | 'Rejected') => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: (userId?: string) => void;
  saveNotificationTemplate: (tpl: NotificationTemplate) => void;
  updateBusinessSettings: (next: Partial<BusinessSettings>) => Promise<void>;
  updateIntegrationConfig: (
    code: ApiIntegrationConfig['code'],
    patch: Partial<ApiIntegrationConfig>
  ) => void;
  updateRolePermissions: (targetRole: string, perms: PermissionCode[]) => Promise<void>;
  addManagerProfile: (input: { name: string; email: string; mobile: string; scope: string }) => ManagerAccountSummary;
  saveBlogPost: (post: Partial<BlogPost> & { title: string; excerpt: string; content: string }) => Promise<BlogPost>;
  bulkSaveBlogPosts: (posts: BlogPost[]) => Promise<{ count: number }>;
  deleteBlogPost: (postId: string) => Promise<void>;
  toggleBlogPostStatus: (postId: string, nextStatus: BlogPostStatus) => Promise<void>;
  exportBackupJson: () => string;
}

const DataContext = createContext<DataContextType | null>(null);

const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  id: 'default',
  legalName: 'Digital India Project',
  tradeName: 'Digital India Project',
  gstin: '26EXIPK0151F1ZQ',
  pan: '',
  udyamNumber: 'UDYAM-DD-03-0009994',
  dunsNumber: '308198649',
  invoicePrefix: 'DIP/2026-27/',
  registeredAddress:
    'Sunflower Building, Nano City, Samarvani, Silvassa, Dadra and Nagar Haveli and Daman and Diu – 396230',
  supportEmail: 'support@digitalindiaproject.com',
  supportPhone: '+91 77779 41227',
  defaultTaxRateBps: 0,
  blogPublisherName: 'Suraj Singh',
  allowUserBlogPublishing: true,
  userBlogRequiresReview: false,
  updatedAt: '2026-11-01T00:00:00Z',
};

const DEFAULT_COMMISSION_RULES: CommissionRule[] = [
  {
    id: 'rule-default-pct',
    name: 'Standard Authorized Partner Share (15% of Service Fee)',
    commissionType: 'percentage',
    fixedAmountPaise: 0,
    percentageBps: 1500,
    isActive: true,
  },
  {
    id: 'rule-csc-tier',
    name: 'CSC & Kendra Partner Share (20% of Service Fee)',
    partnerType: 'csc_center',
    commissionType: 'percentage',
    fixedAmountPaise: 0,
    percentageBps: 2000,
    isActive: true,
  },
];

const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'tpl-app-submitted',
    eventKey: 'APPLICATION_SUBMITTED',
    channel: 'in_app',
    subjectEn: 'Application {{applicationId}} Received',
    bodyEn:
      'Your application {{applicationId}} for {{serviceName}} has been queued for compliance verification.',
    bodyHi:
      'आपका आवेदन {{applicationId}} ({{serviceName}}) सफलतापूर्वक प्राप्त हो गया है और सत्यापन के लिए कतार में है।',
    isActive: true,
  },
  {
    id: 'tpl-docs-required',
    eventKey: 'DOCUMENTS_REQUIRED',
    channel: 'in_app',
    subjectEn: 'Action Required: Re-upload Requested for {{applicationId}}',
    bodyEn: 'Please upload requested verification files for {{applicationId}} to avoid SLA delay.',
    bodyHi: 'कृपया अपने आवेदन {{applicationId}} के लिए आवश्यक दस्तावेज़ पुनः अपलोड करें।',
    isActive: true,
  },
  {
    id: 'tpl-app-completed',
    eventKey: 'APPLICATION_COMPLETED',
    channel: 'in_app',
    subjectEn: 'Certificate / Deliverable Ready for {{applicationId}}',
    bodyEn: 'Your application {{applicationId}} is completed. You can download your certificate from the portal.',
    bodyHi: 'आपका आवेदन {{applicationId}} पूर्ण हो गया है। कृपया पोर्टल से प्रमाणपत्र डाउनलोड करें।',
    isActive: true,
  },
];

const DEFAULT_INTEGRATIONS: ApiIntegrationConfig[] = [
  {
    id: 'int-cashfree',
    code: 'cashfree',
    displayName: 'Cashfree Payment Gateway & Webhooks',
    environment: 'production',
    isEnabled: true,
    isConfigured: false,
    notes: 'Production Cashfree PG (https://api.cashfree.com/pg). Bind CASHFREE_CLIENT_ID & CASHFREE_CLIENT_SECRET in Cloudflare secrets (webhooks verify directly using Client Secret; CASHFREE_WEBHOOK_SECRET is optional).',
    updatedAt: '2026-11-16T00:00:00Z',
  },
  {
    id: 'int-digilocker',
    code: 'digilocker',
    displayName: 'DigiLocker Document Pull Adapter',
    environment: 'sandbox',
    isEnabled: true,
    isConfigured: false,
    notes: 'Requires approved DIGILOCKER_CLIENT_ID and OAuth redirect registration.',
    updatedAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'int-apisetu',
    code: 'apisetu',
    displayName: 'API Setu Registry Verification',
    environment: 'sandbox',
    isEnabled: true,
    isConfigured: false,
    notes: 'Sandbox adapter ready; bind APISETU_CLIENT_ID & APISETU_API_KEY when approved.',
    updatedAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'int-email',
    code: 'email_tx',
    displayName: 'Transactional Email Provider',
    environment: 'sandbox',
    isEnabled: false,
    isConfigured: false,
    notes: 'Ready for Resend/SES/MailChannels SMTP webhook keys.',
    updatedAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'int-whatsapp',
    code: 'whatsapp',
    displayName: 'WhatsApp Business Notification Adapter',
    environment: 'sandbox',
    isEnabled: false,
    isConfigured: false,
    notes: 'Connect WhatsApp Cloud API token or BSP webhook in environment secrets.',
    updatedAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'int-sms',
    code: 'sms',
    displayName: 'DLT SMS Gateway Adapter',
    environment: 'sandbox',
    isEnabled: false,
    isConfigured: false,
    notes: 'Add DLT Sender ID, Entity ID, and SMS provider API secret to enable SMS delivery.',
    updatedAt: '2026-11-01T00:00:00Z',
  },
];

function sanitizeFirestoreApplication(app: Application, ownerUid: string): Record<string, any> {
  const safeDocs = (app.documents || []).slice(0, 20).map((d) => ({
    id: d.id,
    applicationId: d.applicationId,
    documentType: String(d.documentType || 'Proof').slice(0, 100),
    fileName: String(d.fileName || 'document.pdf').slice(0, 140),
    fileSize: Number(d.fileSize || 0),
    mimeType: String(d.mimeType || 'application/pdf').slice(0, 80),
    fileUrl: d.fileUrl?.startsWith('http') || d.fileUrl?.startsWith('/api/') ? d.fileUrl : '#stored-vault',
    ...(d.r2ObjectKey ? { r2ObjectKey: String(d.r2ObjectKey).slice(0, 240) } : {}),
    uploadedAt: d.uploadedAt,
    verificationStatus: d.verificationStatus,
    ...(d.rejectionReason ? { rejectionReason: String(d.rejectionReason).slice(0, 300) } : {}),
  }));

  const safeHistory = (app.statusHistory || []).slice(0, 50).map((sh) => ({
    id: sh.id,
    previousStatus: sh.previousStatus,
    newStatus: sh.newStatus,
    updatedBy: String(sh.updatedBy || 'System').slice(0, 100),
    updatedByRole: sh.updatedByRole,
    timestamp: sh.timestamp,
    customerMessage: String(sh.customerMessage || '').slice(0, 400),
  }));

  const payload: Record<string, any> = {
    id: app.id.slice(0, 64),
    userId: ownerUid.slice(0, 128),
    sourceChannel: app.sourceChannel || 'web_b2c',
    filingMode: app.filingMode || 'self',
    userName: String(app.userName || 'Applicant').slice(0, 120),
    userEmail: String(app.userEmail || '').slice(0, 150),
    userMobile: String(app.userMobile || '').slice(0, 30),
    serviceId: String(app.serviceId).slice(0, 64),
    serviceName: String(app.serviceName).slice(0, 140),
    serviceSlug: String(app.serviceSlug).slice(0, 100),
    formVersion: Number(app.formVersion || 1),
    status: String(app.status).slice(0, 60),
    totalAmount: Number(app.payment?.totalAmount || 0),
    payment: app.payment,
    formData: app.formData || {},
    documents: safeDocs,
    statusHistory: safeHistory,
    submissionDate: app.submissionDate,
    createdAt: app.submissionDate,
    updatedAt: app.updatedAt,
  };

  if (app.collectedByUid) payload.collectedByUid = app.collectedByUid.slice(0, 128);
  if (app.partnerId) payload.partnerId = app.partnerId.slice(0, 64);
  if (app.partnerName) payload.partnerName = app.partnerName.slice(0, 140);
  if (app.referralCodeUsed) payload.referralCodeUsed = app.referralCodeUsed.slice(0, 40);
  if (typeof app.assistedConsentRecorded === 'boolean') {
    payload.assistedConsentRecorded = app.assistedConsentRecorded;
  }
  if (app.assignedOperatorId) payload.assignedOperatorId = app.assignedOperatorId.slice(0, 128);
  if (app.assignedOperatorName) payload.assignedOperatorName = app.assignedOperatorName.slice(0, 120);
  if (app.businessId) payload.businessId = app.businessId.slice(0, 64);
  if (app.customerRemarks) payload.customerRemarks = app.customerRemarks.slice(0, 1000);
  if (app.internalNotes) payload.internalNotes = app.internalNotes.slice(0, 1000);
  if (app.completionFileName) payload.completionFileName = app.completionFileName.slice(0, 160);
  if (app.completionFileUrl) payload.completionFileUrl = app.completionFileUrl.slice(0, 300);
  if (app.slaTargetAt) payload.slaTargetAt = app.slaTargetAt.slice(0, 50);

  return payload;
}

function buildTrackingProjection(app: Application, ownerUid: string): Record<string, any> {
  const digits = (app.userMobile || '').replace(/\D/g, '').slice(-10);
  const nameParts = (app.userName || 'Applicant').trim().split(/\s+/);
  const maskedName =
    nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`
      : nameParts[0];

  const safeHistory = (app.statusHistory || []).slice(0, 50).map((sh) => ({
    id: sh.id,
    previousStatus: sh.previousStatus,
    newStatus: sh.newStatus,
    updatedBy: String(sh.updatedBy || 'Operations Desk').slice(0, 80),
    updatedByRole: sh.updatedByRole,
    timestamp: sh.timestamp,
    customerMessage: String(sh.customerMessage || '').slice(0, 400),
  }));

  const proj: Record<string, any> = {
    id: app.id.slice(0, 64),
    ownerUid: ownerUid.slice(0, 128),
    serviceName: String(app.serviceName).slice(0, 140),
    applicantMaskedName: maskedName.slice(0, 80),
    contactMobileDigits: digits,
    contactEmailLower: (app.userEmail || '').trim().toLowerCase().slice(0, 150),
    sourceChannel: app.sourceChannel || 'web_b2c',
    status: String(app.status).slice(0, 60),
    totalAmount: Number(app.payment?.totalAmount || 0),
    statusHistory: safeHistory,
    submissionDate: app.submissionDate,
    updatedAt: app.updatedAt,
  };

  if (app.collectedByUid) proj.collectedByUid = app.collectedByUid.slice(0, 128);
  if (app.assignedOperatorId) proj.assignedOperatorId = app.assignedOperatorId.slice(0, 128);
  if (app.customerRemarks) proj.customerRemarks = app.customerRemarks.slice(0, 1000);
  if (app.completionFileName) proj.completionFileName = app.completionFileName.slice(0, 160);

  return proj;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const LEGACY_SEED_AUTHORS = new Set([
  'Aarav Kulkarni',
  'Meera Deshmukh',
  'Rohan Iyer',
  'Adv. Priya Sharma',
  'Digital India Editorial Desk',
]);

function normalizeSeedBlogAuthor(post: BlogPost): BlogPost {
  if (!post.authorName || LEGACY_SEED_AUTHORS.has(post.authorName.trim())) {
    return { ...post, authorName: 'Suraj Singh' };
  }
  return post;
}

function mergeInitialBlogPosts(stored: BlogPost[]): BlogPost[] {
  if (!Array.isArray(stored) || stored.length === 0) {
    return INITIAL_BLOG_POSTS;
  }
  const byId = new Map<string, BlogPost>();
  const seenSlugs = new Set<string>();
  for (const post of stored) {
    if (post && post.id) {
      const normalized = normalizeSeedBlogAuthor(post);
      byId.set(normalized.id, normalized);
      if (normalized.slug) seenSlugs.add(normalized.slug);
    }
  }
  for (const seed of INITIAL_BLOG_POSTS) {
    if (!byId.has(seed.id) && !seenSlugs.has(seed.slug)) {
      byId.set(seed.id, seed);
      seenSlugs.add(seed.slug);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

function mergeInitialCatalogueServices(stored: Service[]): Service[] {
  if (!Array.isArray(stored) || stored.length === 0) {
    return INITIAL_SERVICES;
  }
  const byId = new Map<string, Service>();
  const bySlug = new Map<string, Service>();
  for (const s of stored) {
    if (s && s.id && s.slug) {
      byId.set(s.id, s);
      bySlug.set(s.slug.toLowerCase(), s);
    }
  }
  for (const seed of INITIAL_SERVICES) {
    const existing = byId.get(seed.id) || bySlug.get(seed.slug.toLowerCase());
    if (!existing) {
      byId.set(seed.id, seed);
    } else {
      // Backfill new catalogue schema metadata onto existing stored rows cleanly without clobbering fees
      byId.set(existing.id, {
        ...seed,
        ...existing,
        subcategory: existing.subcategory || seed.subcategory,
        productType: existing.productType || seed.productType,
        deliveryType: existing.deliveryType || seed.deliveryType,
        pricingType: existing.pricingType || seed.pricingType,
        billingUnit: existing.billingUnit || seed.billingUnit,
        digitalAsset: existing.digitalAsset || seed.digitalAsset,
        includedServiceIds: existing.includedServiceIds?.length ? existing.includedServiceIds : seed.includedServiceIds,
        exclusions: existing.exclusions?.length ? existing.exclusions : seed.exclusions,
        packageSavingsInr: existing.packageSavingsInr ?? seed.packageSavingsInr,
        regulatedNotice: existing.regulatedNotice || seed.regulatedNotice,
      });
    }
  }
  return Array.from(byId.values());
}

const SAMPLE_APP_IDS = new Set(['DIP-2026-78412', 'DIP-2026-62194']);
const SAMPLE_TX_IDS = new Set(['tx-1', 'tx-2']);
const SAMPLE_TICKET_IDS = new Set(['tkt-1']);
const SAMPLE_MANAGER_IDS = new Set(['mgr-ops-1']);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, refreshUserProfile } = useAuth();

  const [services, setServices] = useState<Service[]>(() =>
    mergeInitialCatalogueServices(loadJson<Service[]>('dip_services', INITIAL_SERVICES))
  );
  const [categories, setCategories] = useState<ServiceCategory[]>(() =>
    loadJson('dip_categories', SERVICE_CATEGORIES)
  );
  const [coupons, setCoupons] = useState<CouponRecord[]>(() =>
    loadJson('dip_coupons', INITIAL_COUPONS)
  );
  const [digitalOrders, setDigitalOrders] = useState<DigitalProductOrder[]>(() =>
    loadJson('dip_digital_orders', [])
  );
  const [quoteRequests, setQuoteRequests] = useState<CustomQuoteRequest[]>(() =>
    loadJson('dip_quote_requests', [])
  );
  const [importReports, setImportReports] = useState<CatalogueImportReport[]>(() =>
    loadJson('dip_catalogue_import_reports', [])
  );
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(() =>
    mergeInitialBlogPosts(loadJson<BlogPost[]>('dip_blog_posts', INITIAL_BLOG_POSTS))
  );
  const [applications, setApplications] = useState<Application[]>(() =>
    loadJson<Application[]>('dip_applications', []).filter((a) => !SAMPLE_APP_IDS.has(a.id))
  );
  const [drafts, setDrafts] = useState<ApplicationDraft[]>(() => loadJson('dip_app_drafts', []));
  const [transactions, setTransactions] = useState<PaymentTransaction[]>(() =>
    loadJson<PaymentTransaction[]>('dip_transactions', []).filter((t) => !SAMPLE_TX_IDS.has(t.id))
  );
  const [tickets, setTickets] = useState<SupportTicket[]>(() =>
    loadJson<SupportTicket[]>('dip_tickets', []).filter((t) => !SAMPLE_TICKET_IDS.has(t.id))
  );
  const [operatorEnrollments, setOperatorEnrollments] = useState<OperatorEnrollment[]>(() =>
    loadJson('dip_operator_enrollments', [])
  );
  const [partners, setPartners] = useState<PartnerProfile[]>(() => loadJson('dip_partners', []));
  const [partnerCustomers, setPartnerCustomers] = useState<PartnerCustomer[]>(() =>
    loadJson('dip_partner_customers', [])
  );
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>(() =>
    loadJson('dip_commission_rules', DEFAULT_COMMISSION_RULES)
  );
  const [commissionLedger, setCommissionLedger] = useState<CommissionLedgerEntry[]>(() =>
    loadJson('dip_commission_ledger', [])
  );
  const [settlementRequests, setSettlementRequests] = useState<SettlementRequest[]>(() =>
    loadJson('dip_settlement_requests', [])
  );
  const [refunds, setRefunds] = useState<RefundRecord[]>(() => loadJson('dip_refunds', []));
  const [notifications, setNotifications] = useState<PlatformNotification[]>(() =>
    loadJson('dip_notifications', [])
  );
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>(() =>
    loadJson('dip_notification_templates', DEFAULT_NOTIFICATION_TEMPLATES)
  );
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(() => {
    const saved = loadJson<Partial<BusinessSettings>>('dip_business_settings', {});
    return {
      ...DEFAULT_BUSINESS_SETTINGS,
      ...saved,
      gstin: saved.gstin?.trim() || DEFAULT_BUSINESS_SETTINGS.gstin,
      udyamNumber: saved.udyamNumber?.trim() || DEFAULT_BUSINESS_SETTINGS.udyamNumber,
      dunsNumber: saved.dunsNumber?.trim() || DEFAULT_BUSINESS_SETTINGS.dunsNumber,
    };
  });
  const [apiIntegrations, setApiIntegrations] = useState<ApiIntegrationConfig[]>(() => {
    const loaded = loadJson<ApiIntegrationConfig[]>('dip_api_integrations', DEFAULT_INTEGRATIONS);
    const isProdHost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'digitalindiaproject.com' ||
        window.location.hostname === 'www.digitalindiaproject.com');
    return loaded.map((cfg) => {
      if (cfg.code === 'cashfree' && (isProdHost || cfg.updatedAt === '2026-11-01T00:00:00Z')) {
        return {
          ...cfg,
          environment: 'production',
          notes:
            'Production Cashfree PG (https://api.cashfree.com/pg). Bind CASHFREE_CLIENT_ID & CASHFREE_CLIENT_SECRET in Cloudflare secrets (webhooks verify directly using Client Secret; CASHFREE_WEBHOOK_SECRET is optional).',
          updatedAt: '2026-11-16T00:00:00Z',
        };
      }
      return cfg;
    });
  });
  const [auditLogs, setAuditLogs] = useState<ActivityLog[]>(() => loadJson('dip_audit_logs', []));
  const [rolePermissions, setRolePermissions] = useState<RolePermissionMap>(() =>
    loadJson('dip_role_permissions', DEFAULT_ROLE_PERMISSIONS)
  );
  const [managers, setManagers] = useState<ManagerAccountSummary[]>(() =>
    loadJson<ManagerAccountSummary[]>('dip_managers', []).filter((m) => !SAMPLE_MANAGER_IDS.has(m.id))
  );

  // Sync to localStorage
  useEffect(() => { localStorage.setItem('dip_services', JSON.stringify(services)); }, [services]);
  useEffect(() => { localStorage.setItem('dip_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('dip_coupons', JSON.stringify(coupons)); }, [coupons]);
  useEffect(() => { localStorage.setItem('dip_digital_orders', JSON.stringify(digitalOrders)); }, [digitalOrders]);
  useEffect(() => { localStorage.setItem('dip_quote_requests', JSON.stringify(quoteRequests)); }, [quoteRequests]);
  useEffect(() => { localStorage.setItem('dip_catalogue_import_reports', JSON.stringify(importReports)); }, [importReports]);
  useEffect(() => { localStorage.setItem('dip_blog_posts', JSON.stringify(blogPosts)); }, [blogPosts]);
  useEffect(() => { localStorage.setItem('dip_applications', JSON.stringify(applications)); }, [applications]);
  useEffect(() => { localStorage.setItem('dip_app_drafts', JSON.stringify(drafts)); }, [drafts]);
  useEffect(() => { localStorage.setItem('dip_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('dip_tickets', JSON.stringify(tickets)); }, [tickets]);
  useEffect(() => { localStorage.setItem('dip_operator_enrollments', JSON.stringify(operatorEnrollments)); }, [operatorEnrollments]);
  useEffect(() => { localStorage.setItem('dip_partners', JSON.stringify(partners)); }, [partners]);
  useEffect(() => { localStorage.setItem('dip_partner_customers', JSON.stringify(partnerCustomers)); }, [partnerCustomers]);
  useEffect(() => { localStorage.setItem('dip_commission_rules', JSON.stringify(commissionRules)); }, [commissionRules]);
  useEffect(() => { localStorage.setItem('dip_commission_ledger', JSON.stringify(commissionLedger)); }, [commissionLedger]);
  useEffect(() => { localStorage.setItem('dip_settlement_requests', JSON.stringify(settlementRequests)); }, [settlementRequests]);
  useEffect(() => { localStorage.setItem('dip_refunds', JSON.stringify(refunds)); }, [refunds]);
  useEffect(() => { localStorage.setItem('dip_notifications', JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => { localStorage.setItem('dip_notification_templates', JSON.stringify(notificationTemplates)); }, [notificationTemplates]);
  useEffect(() => { localStorage.setItem('dip_business_settings', JSON.stringify(businessSettings)); }, [businessSettings]);
  useEffect(() => { localStorage.setItem('dip_api_integrations', JSON.stringify(apiIntegrations)); }, [apiIntegrations]);
  useEffect(() => {
    let active = true;
    void fetch('/api/integrations/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((json: any) => {
        if (!active || !json?.data?.providers) return;
        const providers = json.data.providers;
        setApiIntegrations((prev) =>
          prev.map((cfg) => {
            if (cfg.code === 'cashfree' && providers.cashfree) {
              const serverEnv = providers.cashfree.environment === 'production' ? 'production' : cfg.environment;
              return {
                ...cfg,
                environment: serverEnv,
                isConfigured: Boolean(providers.cashfree.configured),
              };
            }
            if (cfg.code === 'digilocker' && providers.digilocker) {
              return { ...cfg, isConfigured: Boolean(providers.digilocker.configured) };
            }
            if (cfg.code === 'apisetu' && providers.apiSetu) {
              return { ...cfg, isConfigured: Boolean(providers.apiSetu.configured) };
            }
            return cfg;
          })
        );
      })
      .catch(() => {
        // Ignore offline/bootstrap fetch errors
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => { localStorage.setItem('dip_audit_logs', JSON.stringify(auditLogs)); }, [auditLogs]);
  useEffect(() => { localStorage.setItem('dip_role_permissions', JSON.stringify(rolePermissions)); }, [rolePermissions]);
  useEffect(() => { localStorage.setItem('dip_managers', JSON.stringify(managers)); }, [managers]);

  const appendAudit = (
    action: string,
    entityType: ActivityLog['entityType'],
    entityId: string,
    details: string
  ) => {
    const entry: ActivityLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      actorId: user?.id || 'system',
      actorName: user?.name || 'System',
      actorRole: normalizeRole(user?.role),
      action,
      entityType,
      entityId,
      details,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [entry, ...prev].slice(0, 300));
  };

  const pushNotification = (
    userId: string,
    title: string,
    message: string,
    eventKey: string,
    titleHi?: string,
    messageHi?: string
  ) => {
    const item: PlatformNotification = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      title,
      titleHi,
      message,
      messageHi,
      channel: 'in_app',
      eventKey,
      deliveryStatus: 'Sent',
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [item, ...prev].slice(0, 200));
  };

  const alertedPaymentKeysRef = useRef<Set<string>>(
    new Set(loadJson<string[]>('dip_payment_alerted_keys', []))
  );

  const persistAlertedKey = (key: string) => {
    alertedPaymentKeysRef.current.add(key);
    try {
      const compact = Array.from(alertedPaymentKeysRef.current).slice(-250);
      alertedPaymentKeysRef.current = new Set(compact);
      localStorage.setItem('dip_payment_alerted_keys', JSON.stringify(compact));
    } catch {
      // Ignore storage quota issues
    }
  };

  const triggerPaymentStatusAlert = (
    app: Application,
    nextUiStatus: PaymentUiStatus,
    meta?: {
      orderId?: string;
      cfPaymentId?: string;
      paymentMethod?: string;
      eventTime?: string;
    }
  ) => {
    const alertPayload = buildPaymentStatusAlertNotification({
      app,
      nextUiStatus,
      orderId: meta?.orderId,
      cfPaymentId: meta?.cfPaymentId,
      paymentMethod: meta?.paymentMethod,
      eventTime: meta?.eventTime,
    });
    if (!alertPayload) return;
    if (alertedPaymentKeysRef.current.has(alertPayload.dedupeKey)) return;

    persistAlertedKey(alertPayload.dedupeKey);

    const notifId = `notif-pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const dashboardAlert: PlatformNotification = {
      id: notifId,
      userId: alertPayload.userId,
      title: alertPayload.title,
      titleHi: alertPayload.titleHi,
      message: alertPayload.message,
      messageHi: alertPayload.messageHi,
      channel: 'in_app',
      eventKey: alertPayload.eventKey,
      deliveryStatus: 'Sent',
      emailStatus: 'Queued',
      applicationId: alertPayload.applicationId,
      orderId: alertPayload.orderId,
      amountInr: alertPayload.amountInr,
      isRead: false,
      createdAt: alertPayload.eventTime,
    };

    setNotifications((prev) => [dashboardAlert, ...prev].slice(0, 200));
    appendAudit(
      'payment.status_alerted',
      'payment',
      alertPayload.orderId || alertPayload.applicationId,
      `${alertPayload.status} alert issued for ${alertPayload.applicationId}`
    );

    void dispatchPaymentStatusAlert({
      applicationId: alertPayload.applicationId,
      orderId: alertPayload.orderId,
      transactionId: alertPayload.transactionId,
      status: alertPayload.status,
      serviceName: alertPayload.serviceName,
      amountInr: alertPayload.amountInr,
      recipientEmail: alertPayload.recipientEmail,
      recipientName: alertPayload.recipientName,
      userId: alertPayload.userId,
      paymentMethod: alertPayload.paymentMethod,
    })
      .then((res) => {
        const nextEmailStatus = res.data?.emailDeliveryStatus || 'Failed';
        setNotifications((prev) =>
          prev.map((n) => (n.id === notifId ? { ...n, emailStatus: nextEmailStatus } : n))
        );
      })
      .catch(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notifId ? { ...n, emailStatus: 'Failed' } : n))
        );
      });
  };

  const prevAppPaymentUiStatusRef = useRef<Map<string, PaymentUiStatus> | null>(null);

  useEffect(() => {
    if (prevAppPaymentUiStatusRef.current === null) {
      const seedMap = new Map<string, PaymentUiStatus>();
      for (const app of applications) {
        seedMap.set(app.id, deriveInitialPaymentUiStatus(app));
      }
      prevAppPaymentUiStatusRef.current = seedMap;
      return;
    }

    const prevMap = prevAppPaymentUiStatusRef.current;
    const nextMap = new Map<string, PaymentUiStatus>();
    for (const app of applications) {
      const prevUi = prevMap.get(app.id);
      const nextUi = deriveInitialPaymentUiStatus(app);
      nextMap.set(app.id, nextUi);

      if (
        prevUi !== undefined &&
        prevUi !== nextUi &&
        (nextUi === 'Paid' || nextUi === 'Failed')
      ) {
        triggerPaymentStatusAlert(app, nextUi, {
          orderId: app.payment?.orderId,
          cfPaymentId: app.payment?.cfPaymentId,
          paymentMethod: app.payment?.paymentMethod,
          eventTime: app.payment?.paidAt || app.updatedAt,
        });
      }
    }
    prevAppPaymentUiStatusRef.current = nextMap;
  }, [applications]);

  // 1. Live Public Services Catalog Subscription (/services)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'services'),
      (snap) => {
        if (snap.empty) return;
        const remoteMap = new Map<string, Service>();
        snap.docs.forEach((d) => {
          remoteMap.set(d.id, d.data() as Service);
        });
        setServices((prev) => {
          const base = INITIAL_SERVICES.map((s) => {
            const remote = remoteMap.get(s.id);
            return remote ? { ...s, ...remote } : s;
          });
          const extra: Service[] = [];
          remoteMap.forEach((srv, id) => {
            if (!INITIAL_SERVICES.some((i) => i.id === id)) {
              extra.push(srv);
            }
          });
          const combinedIds = new Set([...extra, ...base].map((s) => s.id));
          const localOnly = prev.filter((p) => !combinedIds.has(p.id));
          return [...extra, ...localOnly, ...base];
        });
      },
      (err) => {
        console.warn('Services catalog listener note:', err.message);
      }
    );
    return () => unsub();
  }, []);

  // 1b. Live Public Published Blog Subscription (/blog_posts)
  useEffect(() => {
    const isVerifiedAdmin =
      auth.currentUser?.email?.toLowerCase() === 'allindiadigitalseva@gmail.com' ||
      user?.email?.toLowerCase() === 'allindiadigitalseva@gmail.com';
    const blogQuery = isVerifiedAdmin
      ? collection(db, 'blog_posts')
      : query(collection(db, 'blog_posts'), where('status', '==', 'published'));

    const unsub = onSnapshot(
      blogQuery,
      (snap) => {
        if (snap.empty) return;
        const remoteMap = new Map<string, BlogPost>();
        snap.docs.forEach((d) => {
          remoteMap.set(d.id, d.data() as BlogPost);
        });
        setBlogPosts((prev) => {
          const merged = new Map<string, BlogPost>();
          prev.forEach((p) => merged.set(p.id, p));
          remoteMap.forEach((p, id) => merged.set(id, p));
          return Array.from(merged.values()).sort(
            (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
          );
        });
      },
      (err) => {
        console.warn('Blog posts listener note:', err.message);
      }
    );
    return () => unsub();
  }, [user?.id, user?.role]);

  // 2. Scoped Live Firestore Subscriptions for Authenticated Users
  useEffect(() => {
    const fbUid = auth.currentUser?.uid;
    if (!user || !fbUid) return;

    const isAdminOrMgr = isSuperAdminRole(user.role) || normalizeRole(user.role) === 'manager';
    const isOp = normalizeRole(user.role) === 'operator';
    const isPartner = normalizeRole(user.role) === 'partner';

    const unsubs: (() => void)[] = [];

    const appQueries = isSuperAdminRole(user.role)
      ? [collection(db, 'applications')]
      : isOp || isPartner || isAdminOrMgr
      ? [
          query(collection(db, 'applications'), where('assignedOperatorId', '==', fbUid)),
          query(collection(db, 'applications'), where('collectedByUid', '==', fbUid)),
          query(collection(db, 'applications'), where('userId', '==', fbUid)),
        ]
      : [query(collection(db, 'applications'), where('userId', '==', fbUid))];

    appQueries.forEach((qRef) => {
      const unsub = onSnapshot(
        qRef,
        (snap) => {
          const fetched: Application[] = snap.docs.map((d) => d.data() as Application);
          if (fetched.length === 0) return;
          setApplications((prev) => {
            const merged = new Map<string, Application>();
            prev.forEach((a) => merged.set(a.id, a));
            fetched.forEach((a) => merged.set(a.id, a));
            return Array.from(merged.values()).sort(
              (a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
            );
          });
        },
        (err) => {
          console.warn('Applications sync skipped/restricted:', err.message);
        }
      );
      unsubs.push(unsub);
    });

    // Operator Enrollments
    const enrollQuery = isSuperAdminRole(user.role)
      ? collection(db, 'operator_enrollments')
      : query(collection(db, 'operator_enrollments'), where('userId', '==', fbUid));

    unsubs.push(
      onSnapshot(
        enrollQuery,
        (snap) => {
          const list = snap.docs.map((d) => d.data() as OperatorEnrollment);
          setOperatorEnrollments((prev) => {
            const map = new Map<string, OperatorEnrollment>();
            prev.forEach((e) => map.set(e.id, e));
            list.forEach((e) => map.set(e.id, e));
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        },
        (err) => console.warn('Enrollments listener note:', err.message)
      )
    );

    // Partners
    const partnerQuery = isSuperAdminRole(user.role)
      ? collection(db, 'partners')
      : query(collection(db, 'partners'), where('userId', '==', fbUid));

    unsubs.push(
      onSnapshot(
        partnerQuery,
        (snap) => {
          const list = snap.docs.map((d) => d.data() as PartnerProfile);
          if (list.length === 0) return;
          setPartners((prev) => {
            const map = new Map<string, PartnerProfile>();
            prev.forEach((p) => map.set(p.id, p));
            list.forEach((p) => map.set(p.id, p));
            return Array.from(map.values());
          });
        },
        (err) => console.warn('Partners listener note:', err.message)
      )
    );

    // Business Settings & Role Permissions
    unsubs.push(
      onSnapshot(
        doc(db, 'business_settings', 'default'),
        (snap) => {
          if (snap.exists()) {
            const remote = snap.data() as Partial<BusinessSettings>;
            setBusinessSettings((prev) => ({
              ...prev,
              ...remote,
              gstin: remote.gstin?.trim() || prev.gstin || DEFAULT_BUSINESS_SETTINGS.gstin,
              udyamNumber: remote.udyamNumber?.trim() || prev.udyamNumber || DEFAULT_BUSINESS_SETTINGS.udyamNumber,
              dunsNumber: remote.dunsNumber?.trim() || prev.dunsNumber || DEFAULT_BUSINESS_SETTINGS.dunsNumber,
            }));
          }
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'business_settings', 'rbac_matrix'),
        (snap) => {
          if (snap.exists() && snap.data().matrix) {
            setRolePermissions(snap.data().matrix as RolePermissionMap);
          }
        },
        () => {}
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [user?.id, user?.role]);

  const getServiceBySlug = (slug: string) =>
    services.find((s) => s.slug === slug) || findApiSathiServiceBySlugOrId(slug);

  const syncApplicationToFirestore = async (app: Application) => {
    const fbUid = auth.currentUser?.uid;
    if (!fbUid) return;
    const ownerUid = app.userId && app.userId !== 'guest' ? app.userId : fbUid;

    try {
      await setDoc(doc(db, 'applications', app.id), sanitizeFirestoreApplication(app, ownerUid));
      await setDoc(doc(db, 'tracking_records', app.id), buildTrackingProjection(app, ownerUid));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `applications/${app.id}`);
    }
  };

  const saveDraft = (
    draftInput: Omit<ApplicationDraft, 'id' | 'savedAt'> & { id?: string }
  ): ApplicationDraft => {
    const nowIso = new Date().toISOString();
    const draftId = draftInput.id || `draft-${draftInput.serviceSlug}-${user?.id || 'guest'}`;
    const record: ApplicationDraft = {
      ...draftInput,
      id: draftId,
      savedAt: nowIso,
    };
    setDrafts((prev) => {
      const exists = prev.some((d) => d.id === draftId);
      if (exists) return prev.map((d) => (d.id === draftId ? record : d));
      return [record, ...prev];
    });
    return record;
  };

  const deleteDraft = (draftId: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
  };

  const createApplication = async (
    serviceSlug: string,
    formData: Record<string, any>,
    rawDocuments: any[],
    meta?: CreateApplicationMeta
  ): Promise<Application> => {
    const service = getServiceBySlug(serviceSlug) || services[0];
    const newId = `DIP-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const nowIso = new Date().toISOString();
    const slaHours = service.slaHours || 72;
    const slaTargetAt = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();

    const formattedDocs: ApplicationDocument[] = rawDocuments.map((d, index) => ({
      id: `doc-${Date.now()}-${index}`,
      applicationId: newId,
      documentType: d.documentType || 'Uploaded Proof',
      fileName: d.fileName || `document_${index + 1}.pdf`,
      fileSize: d.fileSize || 1024 * 500,
      mimeType: d.mimeType || 'application/pdf',
      fileUrl: d.fileUrl || '#stored-vault',
      fileId: d.fileId,
      logicalBucket: d.logicalBucket,
      r2ObjectKey: d.r2ObjectKey,
      version: 1,
      uploadedAt: nowIso,
      verificationStatus: 'Pending',
    }));

    const fbUid = auth.currentUser?.uid;
    const resolvedUserId = meta?.userId || formData.userId || fbUid || user?.id || 'usr-customer-1';
    const filingMode =
      meta?.filingMode ||
      (meta?.sourceChannel === 'operator_assisted' || meta?.sourceChannel === 'partner_assisted'
        ? 'assisted'
        : 'self');

    const sourceChannel: ApplicationSourceChannel =
      meta?.sourceChannel || (meta?.partnerId ? 'partner_assisted' : 'web_b2c');

    // Match partner if referralCodeUsed or partnerId supplied
    const matchedPartner = meta?.partnerId
      ? partners.find((p) => p.id === meta.partnerId || p.userId === meta.partnerId)
      : meta?.referralCodeUsed
      ? partners.find(
          (p) =>
            p.referralCode.toUpperCase() === meta.referralCodeUsed!.trim().toUpperCase() &&
            p.approvalStatus === 'Approved'
        )
      : undefined;

    const urgentFeeInr =
      meta?.paymentDetails?.urgentProcessing && service.urgentFee ? Number(service.urgentFee) : 0;
    const discountInr = Number(meta?.paymentDetails?.discountAmount || service.discountInr || 0);

    const feeBreakdown = calculateOrderTotalsPaise({
      serviceChargeInr: service.serviceCharge,
      govtFeesInr: service.govtFees,
      thirdPartyFeesInr: service.thirdPartyFees || 0,
      additionalChargeInr: service.additionalCharge || 0,
      urgentFeeInr,
      discountInr,
      taxRateBps: service.taxRateBps ?? businessSettings.defaultTaxRateBps ?? 0,
      taxInclusive: service.taxInclusive,
    });

    const totalInr = fromPaise(feeBreakdown.totalPaise);
    const taxInr = fromPaise(feeBreakdown.taxPaise);
    const invoiceNumber = `${businessSettings.invoicePrefix}${Math.floor(10000 + Math.random() * 90000)}`;

    const channelLabel =
      sourceChannel === 'operator_assisted'
        ? 'Operator Assisted Intake Desk'
        : sourceChannel === 'partner_assisted'
        ? 'Authorized Partner Assisted Desk'
        : sourceChannel === 'b2b_portal'
        ? 'B2B Enterprise Portal'
        : sourceChannel === 'google_forms'
        ? 'Google Forms Intake'
        : 'Online Self-Service Portal';

    const actorRole = normalizeRole(user?.role);

    const newApp: Application = {
      id: newId,
      userId: resolvedUserId,
      collectedByUid:
        meta?.collectedByUid || (filingMode === 'assisted' ? fbUid || user?.id : undefined),
      filingMode,
      partnerId: matchedPartner?.id || meta?.partnerId,
      partnerName: matchedPartner?.businessName || meta?.partnerName,
      referralCodeUsed: meta?.referralCodeUsed || matchedPartner?.referralCode,
      assistedConsentRecorded: filingMode === 'assisted' ? Boolean(meta?.assistedConsentRecorded ?? true) : undefined,
      sourceChannel,
      businessId: meta?.businessId || user?.businessId,
      assignedOperatorId: meta?.assignedOperatorId,
      assignedOperatorName: meta?.assignedOperatorName,
      userName:
        meta?.applicantName ||
        formData.full_name ||
        formData.applicant_full_name ||
        user?.name ||
        'Valued Applicant',
      userEmail: formData.userEmail || user?.email || 'applicant@example.com',
      userMobile: formData.userMobile || formData.contact_mobile || user?.mobile || '+91 98765 43210',
      serviceId: service.id,
      serviceName: service.name,
      serviceSlug: service.slug,
      serviceVersion: service.formVersion || 1,
      formVersion: service.formVersion || 1,
      status: 'Payment Confirmed',
      submissionDate: nowIso,
      updatedAt: nowIso,
      slaTargetAt,
      formData,
      documents: formattedDocs,
      statusHistory: [
        {
          id: `sh-${Date.now()}-1`,
          previousStatus: 'Draft',
          newStatus: 'Submitted',
          updatedBy: user?.name || formData.full_name || 'Applicant',
          updatedByRole: filingMode === 'assisted' ? actorRole : 'customer',
          timestamp: nowIso,
          customerMessage: `Application collected via ${channelLabel} and queued for verification.`,
        },
        {
          id: `sh-${Date.now()}-2`,
          previousStatus: 'Submitted',
          newStatus: 'Payment Confirmed',
          updatedBy: filingMode === 'assisted' ? 'Desk Payment Verification' : 'System (Cashfree)',
          updatedByRole: 'admin',
          timestamp: nowIso,
          customerMessage: `Payment of ₹${totalInr.toLocaleString('en-IN')} confirmed. Invoice #${invoiceNumber} issued.`,
        },
      ],
      customerRemarks: 'Application received. Queued for compliance verification desk review.',
      urgentProcessing: Boolean(meta?.paymentDetails?.urgentProcessing),
      includedServiceIds: service.includedServiceIds,
      payment: {
        orderId: meta?.paymentDetails?.orderId || `CF_ORD_${Math.floor(10000 + Math.random() * 90000)}`,
        cfPaymentId: meta?.paymentDetails?.cfPaymentId || `CF_PAY_${Math.floor(100000 + Math.random() * 900000)}`,
        amount: service.serviceCharge,
        govtFee: service.govtFees,
        thirdPartyFee: service.thirdPartyFees || 0,
        additionalCharge: service.additionalCharge || 0,
        urgentFee: urgentFeeInr,
        discountAmount: fromPaise(feeBreakdown.discountPaise),
        couponCode: meta?.paymentDetails?.couponCode,
        taxAmount: taxInr,
        totalAmount: totalInr,
        status: 'Success',
        paymentMethod:
          meta?.paymentDetails?.paymentMethod ||
          (filingMode === 'assisted' ? 'Assisted UPI / Desk Cashfree' : 'UPI / Card / NetBanking'),
        paidAt: meta?.paymentDetails?.paidAt || nowIso,
        invoiceNumber,
      },
    };

    setApplications((prev) => [newApp, ...prev]);

    if (service.productType === 'digital_product' || service.category === 'digital-products') {
      const digOrder: DigitalProductOrder = {
        id: `dpo-${Date.now()}`,
        orderId: newApp.payment.orderId,
        userId: resolvedUserId,
        userName: newApp.userName,
        userEmail: newApp.userEmail,
        serviceId: service.id,
        productSlug: service.slug,
        productName: service.name,
        fileFormat: service.digitalAsset?.fileFormat || 'HTML / CSV',
        version: service.digitalAsset?.version || 'v1.0',
        amountPaid: totalInr,
        discountAmount: fromPaise(feeBreakdown.discountPaise),
        couponCode: meta?.paymentDetails?.couponCode,
        paymentStatus: 'Paid',
        downloadCount: 0,
        createdAt: nowIso,
      };
      setDigitalOrders((prev) => [digOrder, ...prev]);
    }

    const newTx: PaymentTransaction = {
      id: `tx-${Date.now()}`,
      orderId: newApp.payment.orderId,
      applicationId: newApp.id,
      serviceName: newApp.serviceName,
      userId: newApp.userId,
      userName: newApp.userName,
      userEmail: newApp.userEmail,
      amount: totalInr,
      taxAmount: taxInr,
      govtFee: service.govtFees,
      currency: 'INR',
      status: 'Success',
      paymentMethod: newApp.payment.paymentMethod || 'Cashfree Secured Gateway',
      transactionDate: nowIso,
      receiptNumber: `RCPT-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      invoiceNumber,
    };
    setTransactions((prev) => [newTx, ...prev]);

    // Auto-credit partner commission ledger if referral/partner linked
    const effectivePartnerId = matchedPartner?.id || meta?.partnerId;
    if (effectivePartnerId) {
      const comp = calculatePartnerCommission({
        partnerId: effectivePartnerId,
        partnerType: matchedPartner?.partnerType,
        serviceId: service.id,
        serviceFeePaise: toPaise(service.serviceCharge),
        rules: commissionRules,
      });

      const ledgerEntry: CommissionLedgerEntry = {
        id: `comm-${Date.now()}`,
        partnerId: effectivePartnerId,
        applicationId: newApp.id,
        serviceName: service.name,
        entryType: 'EARNED',
        grossServiceFeePaise: comp.grossServiceFeePaise,
        commissionPaise: comp.commissionPaise,
        tdsPaise: comp.tdsPaise,
        netPaise: comp.netPayablePaise,
        status: 'Approved',
        notes: `Auto-credited on Payment Confirmed for ${newApp.id}`,
        createdAt: nowIso,
      };
      setCommissionLedger((prev) => [ledgerEntry, ...prev]);
    }

    if (meta?.draftIdToRemove) {
      deleteDraft(meta.draftIdToRemove);
    }

    pushNotification(
      resolvedUserId,
      `Application ${newApp.id} Confirmed`,
      `Payment of ₹${totalInr.toLocaleString('en-IN')} received for ${service.name}. Compliance desk review starting soon.`,
      'APPLICATION_SUBMITTED',
      `आवेदन ${newApp.id} सफलतापूर्वक दर्ज`,
      `${service.nameHi || service.name} के लिए आपका आवेदन प्राप्त हो गया है।`
    );

    appendAudit('application.created', 'application', newApp.id, `Created ${service.name} (${sourceChannel})`);

    if (fbUid) {
      void createUnifiedApplicationBackend({
        applicationId: newApp.id,
        serviceSlug: service.slug,
        serviceId: service.id,
        applicantName: newApp.userName,
        applicantEmail: newApp.userEmail,
        applicantMobile: newApp.userMobile,
        customerUserId: resolvedUserId !== fbUid ? resolvedUserId : undefined,
        urgentProcessing: Boolean(meta?.paymentDetails?.urgentProcessing),
        couponCode: meta?.paymentDetails?.couponCode,
        serviceChargeInr: service.serviceCharge,
        govtFeesInr: service.govtFees,
        formData,
      }).catch(() => null);
      await syncApplicationToFirestore(newApp);
    }

    return newApp;
  };

  const updateApplicationStatus = async (
    appId: string,
    newStatus: ApplicationStatus,
    customerMsg: string,
    internalNote?: string,
    updatedBy: string = 'Staff Member',
    updatedByRole: UserRole = 'operator'
  ): Promise<{ ok: boolean; error?: string }> => {
    const existing = applications.find((a) => a.id === appId);
    if (!existing) return { ok: false, error: 'Application not found' };

    const check = validateStatusTransition({
      fromStatus: existing.status,
      toStatus: newStatus,
      actorRole: updatedByRole,
      reason: customerMsg,
    });

    if (!check.valid) {
      return { ok: false, error: check.error };
    }

    const nowIso = new Date().toISOString();
    let updatedApp: Application | null = null;

    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== appId) return app;
        const entry: StatusHistoryEntry = {
          id: `sh-${Date.now()}`,
          previousStatus: app.status,
          newStatus,
          updatedBy,
          updatedByRole,
          timestamp: nowIso,
          customerMessage: customerMsg,
          internalNote,
        };
        updatedApp = {
          ...app,
          status: newStatus,
          updatedAt: nowIso,
          customerRemarks: customerMsg,
          internalNotes: internalNote || app.internalNotes,
          statusHistory: [...app.statusHistory, entry],
        };
        return updatedApp;
      })
    );

    pushNotification(
      existing.userId,
      `Status Updated: ${newStatus} (${appId})`,
      customerMsg,
      'STATUS_TRANSITION'
    );

    appendAudit('application.status_transition', 'application', appId, `${existing.status} -> ${newStatus}`);

    if (updatedApp && auth.currentUser) {
      await syncApplicationToFirestore(updatedApp);
    }

    return { ok: true };
  };

  const assignOperator = async (appId: string, operatorId: string, operatorName: string) => {
    const nowIso = new Date().toISOString();
    let updatedApp: Application | null = null;

    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== appId) return app;
        const nextStatus: ApplicationStatus =
          app.status === 'Payment Confirmed' || app.status === 'Submitted' ? 'Assigned' : app.status;
        const entry: StatusHistoryEntry = {
          id: `sh-${Date.now()}`,
          previousStatus: app.status,
          newStatus: nextStatus,
          updatedBy: user?.name || 'Operations Manager',
          updatedByRole: normalizeRole(user?.role),
          timestamp: nowIso,
          customerMessage: `Assigned to specialist officer ${operatorName} for review.`,
        };
        updatedApp = {
          ...app,
          status: nextStatus,
          assignedOperatorId: operatorId,
          assignedOperatorName: operatorName,
          statusHistory: [...app.statusHistory, entry],
          updatedAt: nowIso,
        };
        return updatedApp;
      })
    );

    appendAudit('application.assigned', 'application', appId, `Assigned to ${operatorName}`);

    if (updatedApp && auth.currentUser) {
      void assignApplicationBackend(appId, operatorId, operatorName).catch(() => null);
      await syncApplicationToFirestore(updatedApp);
    }
  };

  const bulkAssignOperator = async (appIds: string[], operatorId: string, operatorName: string) => {
    if (auth.currentUser && appIds.length > 0) {
      void bulkAssignApplicationsBackend(appIds, operatorId, operatorName).catch(() => null);
    }
    for (const id of appIds) {
      await assignOperator(id, operatorId, operatorName);
    }
  };

  const verifyDocument = async (
    appId: string,
    docId: string,
    status: 'Verified' | 'Rejected' | 'Re-upload Requested',
    reason?: string
  ) => {
    const nowIso = new Date().toISOString();
    let updatedApp: Application | null = null;

    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== appId) return app;
        const docs = app.documents.map((d) =>
          d.id === docId ? { ...d, verificationStatus: status, rejectionReason: reason } : d
        );
        updatedApp = { ...app, documents: docs, updatedAt: nowIso };
        return updatedApp;
      })
    );

    appendAudit('document.reviewed', 'document', docId, `Document ${docId} marked ${status}`);

    if (updatedApp && auth.currentUser) {
      void reviewApplicationDocumentBackend(appId, docId, status, reason).catch(() => null);
      await syncApplicationToFirestore(updatedApp);
    }
  };

  const uploadCompletionDocument = async (appId: string, fileName: string, fileUrl: string) => {
    const nowIso = new Date().toISOString();
    let updatedApp: Application | null = null;

    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== appId) return app;
        const entry: StatusHistoryEntry = {
          id: `sh-${Date.now()}`,
          previousStatus: app.status,
          newStatus: 'Completed',
          updatedBy: user?.name || 'Operations Desk',
          updatedByRole: normalizeRole(user?.role),
          timestamp: nowIso,
          customerMessage: `Final issued certificate (${fileName}) uploaded and ready for download.`,
        };
        updatedApp = {
          ...app,
          completionFileName: fileName,
          completionFileUrl: fileUrl,
          status: 'Completed',
          customerRemarks: `Final issued certificate (${fileName}) is ready for download.`,
          statusHistory: [...app.statusHistory, entry],
          updatedAt: nowIso,
        };
        return updatedApp;
      })
    );

    if (updatedApp) {
      pushNotification(
        (updatedApp as Application).userId,
        `Certificate Ready (${appId})`,
        `Final deliverable ${fileName} has been uploaded and is ready to download.`,
        'APPLICATION_COMPLETED'
      );
      appendAudit('application.completed', 'application', appId, `Uploaded deliverable ${fileName}`);
      if (auth.currentUser) {
        void completeApplicationBackend(appId, fileName, fileUrl).catch(() => null);
        await syncApplicationToFirestore(updatedApp);
      }
    }
  };

  const uploadAdditionalDocument = async (
    appId: string,
    newDocInput: Omit<ApplicationDocument, 'id' | 'uploadedAt' | 'verificationStatus'>
  ) => {
    const nowIso = new Date().toISOString();
    let updatedApp: Application | null = null;

    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== appId) return app;
        const newDoc: ApplicationDocument = {
          ...newDocInput,
          id: `doc-${Date.now()}`,
          version: (app.documents.length || 0) + 1,
          uploadedAt: nowIso,
          verificationStatus: 'Pending',
        };
        const entry: StatusHistoryEntry = {
          id: `sh-${Date.now()}`,
          previousStatus: app.status,
          newStatus: 'Resubmitted',
          updatedBy: user?.name || app.userName,
          updatedByRole: normalizeRole(user?.role),
          timestamp: nowIso,
          customerMessage: `Additional document (${newDoc.fileName}) uploaded. Resubmitted for review.`,
        };
        updatedApp = {
          ...app,
          status: 'Resubmitted',
          customerRemarks: 'Additional requested document uploaded by applicant. Resubmitted to desk.',
          documents: [...app.documents, newDoc],
          statusHistory: [...app.statusHistory, entry],
          updatedAt: nowIso,
        };
        return updatedApp;
      })
    );

    if (updatedApp && auth.currentUser) {
      await syncApplicationToFirestore(updatedApp);
    }
  };

  const syncApplicationPaymentStatus = async (
    appId: string,
    update: {
      uiStatus: PaymentUiStatus;
      orderId?: string;
      cfPaymentId?: string;
      paymentMethod?: string;
      paidAt?: string;
    }
  ) => {
    const target = applications.find((a) => a.id === appId);
    if (!target) return;

    const nextRecordStatus = mapUiStatusToRecordStatus(update.uiStatus);
    const prevRecordStatus = target.payment?.status;
    const nextOrderId = update.orderId || target.payment?.orderId || '';
    const nextCfId = update.cfPaymentId || target.payment?.cfPaymentId;
    const nextMethod = update.paymentMethod || target.payment?.paymentMethod;
    const nextPaidAt =
      update.uiStatus === 'Paid'
        ? update.paidAt || target.payment?.paidAt || new Date().toISOString()
        : target.payment?.paidAt;

    const paymentChanged =
      prevRecordStatus !== nextRecordStatus ||
      (nextCfId && nextCfId !== target.payment?.cfPaymentId) ||
      (nextMethod && nextMethod !== target.payment?.paymentMethod);

    const shouldPromoteAppStatus =
      update.uiStatus === 'Paid' &&
      (target.status === 'Payment Pending' ||
        target.status === 'Awaiting Payment' ||
        target.status === 'Submitted');

    if (!paymentChanged && !shouldPromoteAppStatus) return;

    const nowIso = new Date().toISOString();
    const updatedApp: Application = {
      ...target,
      status: shouldPromoteAppStatus ? 'Payment Confirmed' : target.status,
      updatedAt: nowIso,
      customerRemarks: shouldPromoteAppStatus
        ? 'Payment confirmed via real-time Cashfree gateway verification.'
        : target.customerRemarks,
      statusHistory: shouldPromoteAppStatus
        ? [
            ...target.statusHistory,
            {
              id: `sh-${Date.now()}`,
              previousStatus: target.status,
              newStatus: 'Payment Confirmed',
              updatedBy: 'System (Cashfree Sync)',
              updatedByRole: 'admin',
              timestamp: nowIso,
              customerMessage: `Payment verified in real time (${nextOrderId || appId}).`,
            },
          ]
        : target.statusHistory,
      payment: {
        ...target.payment,
        orderId: nextOrderId,
        cfPaymentId: nextCfId,
        paymentMethod: nextMethod,
        paidAt: nextPaidAt,
        status: nextRecordStatus,
      },
    };

    setApplications((prev) => prev.map((a) => (a.id === appId ? updatedApp : a)));
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.applicationId === appId || (nextOrderId && tx.orderId === nextOrderId)
          ? {
              ...tx,
              status: nextRecordStatus,
              paymentMethod: nextMethod || tx.paymentMethod,
            }
          : tx
      )
    );

    const prevUiStatus = deriveInitialPaymentUiStatus(target);

    if (
      (update.uiStatus === 'Paid' || update.uiStatus === 'Failed') &&
      prevUiStatus !== update.uiStatus
    ) {
      triggerPaymentStatusAlert(updatedApp, update.uiStatus, {
        orderId: nextOrderId,
        cfPaymentId: nextCfId,
        paymentMethod: nextMethod,
        eventTime: nextPaidAt || nowIso,
      });
    }

    if (auth.currentUser && isSuperAdminRole(user?.role)) {
      await syncApplicationToFirestore(updatedApp);
    }
  };

  const trackApplication = async (
    appId: string,
    phoneOrEmail: string
  ): Promise<{ success: boolean; data?: Application; error?: string }> => {
    const cleanId = appId.trim().toUpperCase();
    const cleanContact = phoneOrEmail.trim().toLowerCase().replace(/[\s-+]/g, '');

    const foundLocal = applications.find((a) => {
      const matchId = a.id.toUpperCase() === cleanId;
      const matchEmail = a.userEmail.toLowerCase() === phoneOrEmail.trim().toLowerCase();
      const cleanAppMobile = a.userMobile.replace(/[\s-+]/g, '');
      const matchMobile =
        cleanContact.length >= 4 &&
        (cleanAppMobile.endsWith(cleanContact) || cleanContact.endsWith(cleanAppMobile.slice(-10)));
      return matchId && (matchEmail || matchMobile);
    });

    // 1. Authoritative Worker tracking verification endpoint (masked projection, exact contact match)
    try {
      const apiRes = await trackApplicationVerified(cleanId, phoneOrEmail.trim());
      if (apiRes.ok && apiRes.data) {
        const rec = apiRes.data;
        const hydrated: Application = foundLocal
          ? {
              ...foundLocal,
              status: (rec.status as ApplicationStatus) || foundLocal.status,
              customerRemarks: rec.customerRemarks || foundLocal.customerRemarks,
              completionFileName: rec.completionFileName || foundLocal.completionFileName,
              updatedAt: rec.updatedAt || foundLocal.updatedAt,
              statusHistory:
                rec.statusHistory && rec.statusHistory.length > 0
                  ? (rec.statusHistory as any)
                  : foundLocal.statusHistory,
            }
          : {
              id: rec.id,
              userId: 'verified-applicant',
              sourceChannel: 'web_b2c',
              userName: rec.applicantMaskedName || 'Verified Applicant',
              userEmail: '',
              userMobile: '',
              serviceId: rec.serviceId || 'srv-tracked',
              serviceName: rec.serviceName,
              serviceSlug: rec.serviceSlug || '',
              status: rec.status as ApplicationStatus,
              submissionDate: rec.submissionDate || rec.updatedAt,
              updatedAt: rec.updatedAt,
              formData: {},
              documents: [],
              statusHistory: (rec.statusHistory || []) as any,
              customerRemarks: rec.customerRemarks,
              completionFileName: rec.completionFileName || undefined,
              payment: {
                orderId: 'VERIFIED',
                amount: 0,
                govtFee: 0,
                totalAmount: 0,
                status: 'Success',
              },
            };
        return { success: true, data: hydrated };
      }
      if (apiRes.status === 403 && !foundLocal) {
        return {
          success: false,
          error:
            apiRes.message ||
            'Contact verification failed. Email or mobile does not match our records for this Application ID.',
        };
      }
    } catch {
      // Fallback safely to local / signed-in Firestore state in offline/preview mode
    }

    if (foundLocal) {
      return { success: true, data: foundLocal };
    }

    if (auth.currentUser) {
      try {
        const snap = await getDoc(doc(db, 'tracking_records', cleanId));
        if (snap.exists()) {
          const rec = snap.data();
          const emailMatch = rec.contactEmailLower && rec.contactEmailLower === phoneOrEmail.trim().toLowerCase();
          const mobileMatch =
            cleanContact.length >= 4 &&
            rec.contactMobileDigits &&
            (rec.contactMobileDigits.endsWith(cleanContact) ||
              cleanContact.endsWith(String(rec.contactMobileDigits).slice(-10)));

          if (emailMatch || mobileMatch) {
            const hydrated: Application = {
              id: rec.id,
              userId: rec.ownerUid,
              sourceChannel: rec.sourceChannel || 'web_b2c',
              userName: rec.applicantMaskedName || 'Verified Applicant',
              userEmail: rec.contactEmailLower || '',
              userMobile: rec.contactMobileDigits ? `+91 ******${String(rec.contactMobileDigits).slice(-4)}` : '',
              serviceId: 'srv-tracked',
              serviceName: rec.serviceName,
              serviceSlug: '',
              status: rec.status as ApplicationStatus,
              submissionDate: rec.submissionDate || rec.updatedAt,
              updatedAt: rec.updatedAt,
              formData: {},
              documents: [],
              statusHistory: rec.statusHistory || [],
              customerRemarks: rec.customerRemarks,
              completionFileName: rec.completionFileName,
              payment: {
                orderId: 'VERIFIED',
                amount: rec.totalAmount || 0,
                govtFee: 0,
                totalAmount: rec.totalAmount || 0,
                status: 'Success',
              },
            };
            return { success: true, data: hydrated };
          }
        }
      } catch (err) {
        console.warn('Firestore tracking lookup note:', err);
      }
    }

    return {
      success: false,
      error: 'No application matching this Application ID and registered mobile/email was found.',
    };
  };

  const createTicket = (
    ticket: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt' | 'messages'>,
    initialMessage: string
  ): SupportTicket => {
    const newTkt: SupportTicket = {
      ...ticket,
      id: `tkt-${Date.now()}`,
      ticketNumber: `TKT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: `msg-${Date.now()}`,
          senderId: ticket.userId,
          senderName: ticket.userName,
          senderRole: normalizeRole(user?.role),
          message: initialMessage,
          timestamp: new Date().toISOString(),
        },
      ],
    };
    setTickets((prev) => [newTkt, ...prev]);
    if (auth.currentUser) {
      void createSupportTicketBackend({
        subject: ticket.subject,
        category: ticket.category,
        message: initialMessage,
        priority: ticket.priority,
        applicationId: (ticket as { applicationId?: string }).applicationId,
      }).catch(() => null);
    }
    return newTkt;
  };

  const replyTicket = (
    ticketId: string,
    senderId: string,
    senderName: string,
    role: UserRole,
    message: string
  ) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t;
        const newMsg = {
          id: `msg-${Date.now()}`,
          senderId,
          senderName,
          senderRole: role,
          message,
          timestamp: new Date().toISOString(),
        };
        return {
          ...t,
          status: role === 'manager' || role === 'admin' || role === 'super_admin' ? 'In Progress' : t.status,
          updatedAt: new Date().toISOString(),
          messages: [...t.messages, newMsg],
        };
      })
    );
    if (auth.currentUser) {
      void replySupportTicketBackend(ticketId, message).catch(() => null);
    }
  };

  const createOrUpdateService = async (service: Service) => {
    const existing = services.find((s) => s.id === service.id || s.slug === service.slug);
    const nowIso = new Date().toISOString();
    const versioned: Service = {
      ...service,
      formVersion: (service.formVersion || existing?.formVersion || 0) + 1,
      published: service.published ?? true,
    };

    setServices((prev) => {
      const exists = prev.some((s) => s.id === versioned.id);
      if (exists) return prev.map((s) => (s.id === versioned.id ? versioned : s));
      return [versioned, ...prev];
    });

    appendAudit('service.saved', 'service', versioned.id, `Saved ${versioned.name} (v${versioned.formVersion})`);

    if (auth.currentUser && (isSuperAdminRole(user?.role) || user?.role === 'admin')) {
      try {
        const cleanPayload = mapCatalogServiceToFirestoreRecord(versioned, {
          existing: existing || null,
          nowIso,
          preserveExistingCustomizations: false,
          forceRefreshSeo: false,
        });
        await setDoc(doc(db, 'services', cleanPayload.id), cleanPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `services/${versioned.id}`);
      }
    }
  };

  const toggleServicePublished = async (serviceId: string) => {
    const target = services.find((s) => s.id === serviceId);
    if (!target) return;
    await createOrUpdateService({
      ...target,
      published: target.published === false ? true : false,
      availability: target.published === false ? 'Live' : 'Unavailable',
    });
  };

  const deleteService = async (serviceId: string) => {
    setServices((prev) => prev.filter((s) => s.id !== serviceId));
    appendAudit('service.deleted', 'service', serviceId, `Deleted service ${serviceId}`);
    if (auth.currentUser && (isSuperAdminRole(user?.role) || user?.role === 'admin')) {
      try {
        await deleteDoc(doc(db, 'services', serviceId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `services/${serviceId}`);
      }
    }
  };

  const submitOperatorEnrollment = async (
    input: Omit<OperatorEnrollment, 'id' | 'userId' | 'kycStatus' | 'createdAt' | 'updatedAt'>
  ): Promise<OperatorEnrollment> => {
    const fbUid = auth.currentUser?.uid || user?.id;
    if (!fbUid) {
      throw new Error('Please sign in to submit Operator Enrollment & KYC.');
    }

    const nowIso = new Date().toISOString();
    const existingForUser = operatorEnrollments.find((e) => e.userId === fbUid);
    const enrollmentId = existingForUser?.id || `op-kyc-${fbUid.slice(0, 12)}`;

    const record: OperatorEnrollment = {
      ...input,
      id: enrollmentId,
      userId: fbUid,
      kycStatus: 'KYC Submitted',
      createdAt: existingForUser?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    try {
      const firestorePayload: Record<string, any> = {
        id: record.id,
        userId: record.userId,
        fullName: record.fullName.slice(0, 120),
        email: record.email.slice(0, 150),
        mobile: record.mobile.slice(0, 25),
        centerName: record.centerName.slice(0, 140),
        operatingState: record.operatingState.slice(0, 80),
        operatingDistrict: record.operatingDistrict.slice(0, 80),
        centerAddress: record.centerAddress.slice(0, 300),
        pincode: record.pincode.slice(0, 12),
        panNumber: record.panNumber.toUpperCase().slice(0, 10),
        maskedAadhaar: record.maskedAadhaar.slice(0, 25),
        bankAccountHolder: record.bankAccountHolder.slice(0, 120),
        bankIfsc: record.bankIfsc.toUpperCase().slice(0, 15),
        maskedBankAccount: record.maskedBankAccount.slice(0, 30),
        experienceYears: (record.experienceYears || '1-3 years').slice(0, 40),
        kycDocuments: record.kycDocuments.slice(0, 8),
        kycStatus: 'KYC Submitted',
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };

      await setDoc(doc(db, 'operator_enrollments', enrollmentId), firestorePayload);

      const userRef = doc(db, 'users', fbUid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const uData = userSnap.data();
        await setDoc(userRef, {
          ...uData,
          kycStatus: 'KYC Submitted',
          operatorEnrollmentId: enrollmentId,
          updatedAt: nowIso,
        });
      }
      await refreshUserProfile();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `operator_enrollments/${enrollmentId}`);
    }

    setOperatorEnrollments((prev) => {
      const exists = prev.some((e) => e.id === enrollmentId);
      if (exists) return prev.map((e) => (e.id === enrollmentId ? record : e));
      return [record, ...prev];
    });

    return record;
  };

  const reviewOperatorEnrollment = async (
    enrollmentId: string,
    decision: OperatorKycStatus,
    remarks: string
  ) => {
    const target = operatorEnrollments.find((e) => e.id === enrollmentId);
    if (!target) return;

    const nowIso = new Date().toISOString();
    const updatedRecord: OperatorEnrollment = {
      ...target,
      kycStatus: decision,
      adminRemarks: remarks,
      reviewedBy: user?.name || 'Admin Compliance',
      reviewedAt: nowIso,
      updatedAt: nowIso,
    };

    try {
      await updateDoc(doc(db, 'operator_enrollments', enrollmentId), {
        kycStatus: decision,
        adminRemarks: remarks.slice(0, 600),
        reviewedBy: (user?.name || 'Admin Compliance').slice(0, 120),
        reviewedAt: nowIso,
        updatedAt: nowIso,
      });

      const targetUserRef = doc(db, 'users', target.userId);
      const userSnap = await getDoc(targetUserRef);
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const nextRole =
          decision === 'Approved' ? 'operator' : uData.role === 'operator' ? 'customer' : uData.role;
        await setDoc(targetUserRef, {
          ...uData,
          role: nextRole,
          kycStatus: decision,
          operatorEnrollmentId: enrollmentId,
          updatedAt: nowIso,
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `operator_enrollments/${enrollmentId}`);
    }

    appendAudit('operator.kyc_reviewed', 'user', target.userId, `KYC ${decision}`);
    setOperatorEnrollments((prev) => prev.map((e) => (e.id === enrollmentId ? updatedRecord : e)));
  };

  const registerPartner = async (input: {
    partnerType: PartnerProfile['partnerType'];
    fullName: string;
    businessName: string;
    email: string;
    mobile: string;
    state: string;
    district: string;
    pincode: string;
    panMasked: string;
    bankIfsc: string;
    bankAccountMasked: string;
  }): Promise<PartnerProfile> => {
    const fbUid = auth.currentUser?.uid || user?.id;
    if (!fbUid) throw new Error('Sign in required to enroll as Partner.');

    const nowIso = new Date().toISOString();
    const partnerId = `part-${fbUid.slice(0, 12)}`;
    const prefix = input.fullName.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 5) || 'DIP';
    const suffix = Math.floor(100 + Math.random() * 900);

    const profile: PartnerProfile = {
      id: partnerId,
      userId: fbUid,
      partnerCode: `PART-DIP-${Math.floor(1000 + Math.random() * 9000)}`,
      referralCode: `REF-${prefix}${suffix}`,
      partnerType: input.partnerType,
      fullName: input.fullName.trim(),
      businessName: input.businessName.trim(),
      email: input.email.trim(),
      mobile: input.mobile.trim(),
      state: input.state.trim(),
      district: input.district.trim(),
      pincode: input.pincode.trim(),
      panMasked: input.panMasked.toUpperCase(),
      bankIfsc: input.bankIfsc.toUpperCase(),
      bankAccountMasked: input.bankAccountMasked,
      approvalStatus: 'Pending Approval',
      minSettlementInr: 500,
      totalReferrals: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (auth.currentUser) {
      void enrollPartnerBackend(input).catch(() => null);
      try {
        await setDoc(doc(db, 'partners', partnerId), profile);
      } catch (err) {
        console.warn('Partner Firestore write warning:', err);
      }
    }

    setPartners((prev) => {
      const exists = prev.some((p) => p.id === partnerId);
      if (exists) return prev.map((p) => (p.id === partnerId ? profile : p));
      return [profile, ...prev];
    });
    appendAudit('partner.enrolled', 'partner', partnerId, `Partner ${profile.businessName} submitted`);
    return profile;
  };

  const reviewPartner = async (partnerId: string, status: PartnerApprovalStatus) => {
    const target = partners.find((p) => p.id === partnerId);
    if (!target) return;
    const nowIso = new Date().toISOString();
    const updated: PartnerProfile = { ...target, approvalStatus: status, updatedAt: nowIso };

    if (auth.currentUser && isSuperAdminRole(user?.role)) {
      try {
        await setDoc(doc(db, 'partners', partnerId), updated);
        const userRef = doc(db, 'users', target.userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const uData = snap.data();
          await setDoc(userRef, {
            ...uData,
            role: status === 'Approved' ? 'partner' : uData.role === 'partner' ? 'customer' : uData.role,
            partnerId,
            referralCode: target.referralCode,
            updatedAt: nowIso,
          });
        }
      } catch (err) {
        console.warn('Partner approval sync warning:', err);
      }
    }

    setPartners((prev) => prev.map((p) => (p.id === partnerId ? updated : p)));
    pushNotification(
      target.userId,
      `Partner Account ${status}`,
      `Your Authorized Partner enrollment (${target.partnerCode}) status is now ${status}.`,
      'PARTNER_REVIEW'
    );
    appendAudit('partner.reviewed', 'partner', partnerId, `Set status ${status}`);
  };

  const addPartnerCustomer = (input: {
    partnerId: string;
    name: string;
    email: string;
    mobile: string;
  }): PartnerCustomer => {
    const nowIso = new Date().toISOString();
    const record: PartnerCustomer = {
      id: `pc-${Date.now()}`,
      partnerId: input.partnerId,
      name: input.name.trim(),
      email: input.email.trim(),
      mobile: input.mobile.trim(),
      consentCaptured: true,
      consentTimestamp: nowIso,
      applicationsCount: 0,
      createdAt: nowIso,
    };
    setPartnerCustomers((prev) => [record, ...prev]);
    if (auth.currentUser) {
      void addPartnerCustomerBackend({
        name: record.name,
        email: record.email,
        mobile: record.mobile,
      }).catch(() => null);
    }
    return record;
  };

  const saveCommissionRule = (rule: CommissionRule) => {
    setCommissionRules((prev) => {
      const exists = prev.some((r) => r.id === rule.id);
      if (exists) return prev.map((r) => (r.id === rule.id ? rule : r));
      return [rule, ...prev];
    });
    appendAudit('commission.rule_saved', 'commission', rule.id, rule.name);
  };

  const requestPartnerSettlement = (partnerId: string, requestedInr: number) => {
    if (!Number.isFinite(requestedInr) || requestedInr < 500) {
      return { ok: false, error: 'Minimum settlement threshold is ₹500.' };
    }
    const partner = partners.find((p) => p.id === partnerId || p.userId === partnerId);
    const availablePaise = commissionLedger
      .filter((c) => c.partnerId === (partner?.id || partnerId) && c.status === 'Approved')
      .reduce((acc, c) => acc + c.netPaise, 0);

    const requestedPaise = toPaise(requestedInr);
    if (requestedPaise > availablePaise) {
      return {
        ok: false,
        error: `Insufficient approved balance. Available: ₹${fromPaise(availablePaise).toLocaleString('en-IN')}.`,
      };
    }

    const req: SettlementRequest = {
      id: `settle-${Date.now()}`,
      partnerId: partner?.id || partnerId,
      partnerName: partner?.businessName || user?.name || 'Authorized Partner',
      requestedPaise,
      status: 'Requested',
      requestedAt: new Date().toISOString(),
    };
    setSettlementRequests((prev) => [req, ...prev]);
    appendAudit('settlement.requested', 'settlement', req.id, `Requested ₹${requestedInr}`);
    if (auth.currentUser) {
      void requestSettlementBackend(requestedInr).catch(() => null);
    }
    return { ok: true, request: req };
  };

  const processPartnerSettlement = async (
    settlementId: string,
    decision: 'Approved' | 'Paid' | 'Rejected',
    payoutReference?: string,
    rejectionReason?: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const target = settlementRequests.find((s) => s.id === settlementId);
    if (!target) return { ok: false, error: 'Settlement request not found.' };

    // Prevent partner self-approval
    if (!isSuperAdminRole(user?.role)) {
      return { ok: false, error: 'Only Super Admin Finance Desk can approve or settle partner payouts.' };
    }

    const partner = partners.find((p) => p.id === target.partnerId);
    if (partner && partner.userId === user?.id && decision !== 'Rejected') {
      return { ok: false, error: 'Dual-control policy prevents approving your own settlement request.' };
    }

    const nowIso = new Date().toISOString();
    const updated: SettlementRequest = {
      ...target,
      status: decision,
      payoutReference,
      payoutMode: decision === 'Paid' ? 'NEFT / IMPS Bank Transfer' : target.payoutMode,
      rejectionReason,
      reviewedBy: user?.name || 'Super Admin',
      reviewedAt: nowIso,
    };

    setSettlementRequests((prev) => prev.map((s) => (s.id === settlementId ? updated : s)));

    if (decision === 'Paid') {
      setCommissionLedger((prev) =>
        prev.map((c) =>
          c.partnerId === target.partnerId && c.status === 'Approved'
            ? { ...c, status: 'Settled', settlementId }
            : c
        )
      );
    }

    appendAudit('settlement.processed', 'settlement', settlementId, `${decision} (${payoutReference || '-'})`);
    return { ok: true };
  };

  const requestRefund = (input: {
    applicationId: string;
    orderId: string;
    amountInr: number;
    reason: string;
  }): RefundRecord => {
    const nowIso = new Date().toISOString();
    const record: RefundRecord = {
      id: `ref-${Date.now()}`,
      paymentId: input.orderId,
      orderId: input.orderId,
      applicationId: input.applicationId,
      amountInr: input.amountInr,
      reason: input.reason.trim(),
      status: 'Pending',
      initiatedBy: user?.name || 'Customer',
      createdAt: nowIso,
    };
    setRefunds((prev) => [record, ...prev]);
    appendAudit('refund.requested', 'payment', record.id, `₹${input.amountInr} for ${input.applicationId}`);
    if (auth.currentUser) {
      void requestRefundBackend({
        applicationId: input.applicationId,
        orderId: input.orderId,
        amount: input.amountInr,
        reason: input.reason,
      }).catch(() => null);
    }
    return record;
  };

  const processRefund = (refundId: string, decision: 'Processed' | 'Rejected') => {
    const nowIso = new Date().toISOString();
    const target = refunds.find((r) => r.id === refundId);
    setRefunds((prev) =>
      prev.map((r) => (r.id === refundId ? { ...r, status: decision, processedAt: nowIso } : r))
    );
    if (decision === 'Processed' && target) {
      setApplications((prev) =>
        prev.map((a) =>
          a.id === target.applicationId
            ? {
                ...a,
                status: 'Refunded',
                payment: { ...a.payment, status: 'Refunded' },
                updatedAt: nowIso,
              }
            : a
        )
      );
    }
    appendAudit('refund.processed', 'payment', refundId, `Refund ${decision}`);
    if (auth.currentUser) {
      void processRefundBackend(refundId, decision).catch(() => null);
    }
  };

  const markNotificationRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
  };

  const markAllNotificationsRead = (targetUserId?: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        !targetUserId || n.userId === targetUserId ? { ...n, isRead: true } : n
      )
    );
    if (auth.currentUser) {
      void markAllNotificationsReadBackend().catch(() => null);
    }
  };

  const saveNotificationTemplate = (tpl: NotificationTemplate) => {
    setNotificationTemplates((prev) => {
      const exists = prev.some((t) => t.id === tpl.id);
      if (exists) return prev.map((t) => (t.id === tpl.id ? tpl : t));
      return [tpl, ...prev];
    });
    appendAudit('notification_template.saved', 'settings', tpl.id, tpl.eventKey);
  };

  const updateBusinessSettings = async (next: Partial<BusinessSettings>) => {
    const updated: BusinessSettings = {
      ...businessSettings,
      ...next,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.name || 'Super Admin',
    };
    setBusinessSettings(updated);
    appendAudit('settings.business_updated', 'settings', 'default', 'Updated Business & GST details');

    if (auth.currentUser && isSuperAdminRole(user?.role)) {
      try {
        await setDoc(doc(db, 'business_settings', 'default'), updated);
      } catch (err) {
        console.warn('Business settings Firestore write note:', err);
      }
    }
  };

  const updateIntegrationConfig = (
    code: ApiIntegrationConfig['code'],
    patch: Partial<ApiIntegrationConfig>
  ) => {
    setApiIntegrations((prev) =>
      prev.map((cfg) =>
        cfg.code === code ? { ...cfg, ...patch, updatedAt: new Date().toISOString() } : cfg
      )
    );
    appendAudit('integration.updated', 'settings', code, `Updated ${code} configuration`);
  };

  const updateRolePermissions = async (targetRole: string, perms: PermissionCode[]) => {
    const next: RolePermissionMap = {
      ...rolePermissions,
      [targetRole]: perms,
    };
    setRolePermissions(next);
    appendAudit('rbac.role_updated', 'rbac', targetRole, `${perms.length} permissions assigned`);

    if (auth.currentUser && isSuperAdminRole(user?.role)) {
      try {
        await setDoc(doc(db, 'business_settings', 'rbac_matrix'), {
          matrix: next,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.email || 'super_admin',
        });
      } catch (err) {
        console.warn('RBAC matrix Firestore write note:', err);
      }
    }
  };

  const addManagerProfile = (input: {
    name: string;
    email: string;
    mobile: string;
    scope: string;
  }): ManagerAccountSummary => {
    const m: ManagerAccountSummary = {
      id: `mgr-${Date.now()}`,
      name: input.name.trim(),
      email: input.email.trim(),
      mobile: input.mobile.trim(),
      scope: input.scope.trim() || 'Regional Operations',
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    setManagers((prev) => [m, ...prev]);
    appendAudit('manager.added', 'user', m.id, `${m.email} (${m.scope})`);
    return m;
  };

  const defaultPublisher = businessSettings.blogPublisherName?.trim() || 'Suraj Singh';

  const sanitizeBlogFirestorePayload = (post: BlogPost): Record<string, any> => {
    const payload: Record<string, any> = {
      id: post.id.slice(0, 64),
      slug: post.slug.slice(0, 110),
      title: post.title.slice(0, 180),
      excerpt: post.excerpt.slice(0, 400),
      content: post.content.slice(0, 20000),
      category: (post.category || 'Citizen Guides').slice(0, 64),
      tags: (post.tags || []).slice(0, 10),
      status: post.status,
      featured: Boolean(post.featured),
      authorName: (post.authorName || defaultPublisher).slice(0, 100),
      publishedAt: post.publishedAt.slice(0, 50),
      updatedAt: post.updatedAt.slice(0, 50),
      readingTimeMinutes: Math.max(1, Math.min(120, Math.round(post.readingTimeMinutes || 1))),
    };
    if (post.titleHi) payload.titleHi = post.titleHi.slice(0, 200);
    if (post.excerptHi) payload.excerptHi = post.excerptHi.slice(0, 420);
    if (post.contentHi) payload.contentHi = post.contentHi.slice(0, 20000);
    if (post.authorRole) payload.authorRole = post.authorRole.slice(0, 100);
    if (post.relatedServiceSlug) payload.relatedServiceSlug = post.relatedServiceSlug.slice(0, 100);
    if (post.seoTitle) payload.seoTitle = post.seoTitle.slice(0, 110);
    if (post.seoDescription) payload.seoDescription = post.seoDescription.slice(0, 200);
    if (post.focusKeyword) payload.focusKeyword = post.focusKeyword.slice(0, 100);
    if (post.canonicalUrl) payload.canonicalUrl = post.canonicalUrl.slice(0, 250);
    if (post.featuredImageUrl) payload.featuredImageUrl = post.featuredImageUrl.slice(0, 500);
    if (post.faqItems && post.faqItems.length > 0) payload.faqItems = post.faqItems.slice(0, 8);
    return payload;
  };

  const saveBlogPost = async (
    input: Partial<BlogPost> & { title: string; excerpt: string; content: string }
  ): Promise<BlogPost> => {
    const nowIso = new Date().toISOString();
    const slug = slugifyBlogTitle(input.slug || input.title);
    const id =
      input.id && /^[a-zA-Z0-9_-]{3,64}$/.test(input.id)
        ? input.id
        : `post-${slug.slice(0, 36)}-${Date.now().toString(36)}`;
    const existing = blogPosts.find((p) => p.id === id);

    const normalized: BlogPost = {
      id,
      slug,
      title: input.title.trim(),
      titleHi: input.titleHi?.trim() || undefined,
      excerpt: input.excerpt.trim(),
      excerptHi: input.excerptHi?.trim() || undefined,
      content: input.content.trim(),
      contentHi: input.contentHi?.trim() || undefined,
      category: (input.category || 'Citizen Guides').trim(),
      tags: Array.isArray(input.tags)
        ? input.tags.map((t) => t.trim()).filter(Boolean).slice(0, 10)
        : ['Digital India'],
      status: input.status || 'published',
      featured: Boolean(input.featured),
      authorName: (input.authorName || defaultPublisher).trim(),
      authorRole: input.authorRole?.trim() || 'Publisher & Editorial Desk',
      authorUserId: input.authorUserId || existing?.authorUserId || user?.id,
      publishedAt: input.publishedAt || existing?.publishedAt || nowIso,
      updatedAt: nowIso,
      readingTimeMinutes: estimateReadingTime(input.content),
      relatedServiceSlug: input.relatedServiceSlug?.trim() || undefined,
      seoTitle: input.seoTitle?.trim() || input.title.trim().slice(0, 65),
      seoDescription: input.seoDescription?.trim() || input.excerpt.trim().slice(0, 158),
      focusKeyword: input.focusKeyword?.trim() || undefined,
      canonicalUrl: input.canonicalUrl?.trim() || undefined,
      featuredImageUrl: input.featuredImageUrl?.trim() || undefined,
      faqItems: input.faqItems?.filter((f) => f.question.trim() && f.answer.trim()).slice(0, 8),
    };

    setBlogPosts((prev) => {
      const idx = prev.findIndex((p) => p.id === normalized.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = normalized;
        return copy;
      }
      return [normalized, ...prev];
    });
    appendAudit('blog.saved', 'blog', normalized.id, `Saved "${normalized.title}" (${normalized.status})`);

    if (auth.currentUser && (isSuperAdminRole(user?.role) || normalizeRole(user?.role) === 'manager')) {
      syncBlogPostToD1(normalized).catch(() => {});
      try {
        await setDoc(doc(db, 'blog_posts', normalized.id), sanitizeBlogFirestorePayload(normalized));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `blog_posts/${normalized.id}`);
      }
    }
    return normalized;
  };

  const bulkSaveBlogPosts = async (postsToSave: BlogPost[]): Promise<{ count: number }> => {
    if (postsToSave.length === 0) return { count: 0 };

    setBlogPosts((prev) => {
      const merged = new Map<string, BlogPost>();
      prev.forEach((p) => merged.set(p.id, p));
      postsToSave.forEach((p) => merged.set(p.id, p));
      return Array.from(merged.values()).sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    });
    appendAudit(
      'blog.bulk_saved',
      'blog',
      `bulk-${postsToSave.length}`,
      `Bulk imported/created ${postsToSave.length} blog post(s)`
    );

    if (auth.currentUser && (isSuperAdminRole(user?.role) || normalizeRole(user?.role) === 'manager')) {
      Promise.allSettled(postsToSave.slice(0, 50).map((p) => syncBlogPostToD1(p))).catch(() => {});
      try {
        for (let i = 0; i < postsToSave.length; i += 400) {
          const chunk = postsToSave.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach((post) => {
            batch.set(doc(db, 'blog_posts', post.id), sanitizeBlogFirestorePayload(post));
          });
          await batch.commit();
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'blog_posts');
      }
    }

    return { count: postsToSave.length };
  };

  const deleteBlogPost = async (postId: string) => {
    setBlogPosts((prev) => prev.filter((p) => p.id !== postId));
    appendAudit('blog.deleted', 'blog', postId, 'Removed blog post');
    if (auth.currentUser && isSuperAdminRole(user?.role)) {
      try {
        await deleteDoc(doc(db, 'blog_posts', postId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `blog_posts/${postId}`);
      }
    }
  };

  const toggleBlogPostStatus = async (postId: string, nextStatus: BlogPostStatus) => {
    const existing = blogPosts.find((p) => p.id === postId);
    if (!existing) return;
    await saveBlogPost({
      ...existing,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });
  };

  const exportBackupJson = () => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      platform: 'Digital India Project 2.0',
      businessSettings,
      rolePermissions,
      services,
      blogPosts,
      applications,
      transactions,
      partners,
      commissionRules,
      commissionLedger,
      settlementRequests,
      operatorEnrollments,
      refunds,
    };
    appendAudit('backup.exported', 'settings', 'json-export', 'Exported full platform backup JSON');
    return JSON.stringify(snapshot, null, 2);
  };

  const validateCoupon = (code: string, serviceChargeInr: number, category?: string) => {
    return resolveCouponValidation({
      code,
      serviceChargeInr,
      category,
      extraCoupons: coupons,
    });
  };

  const saveCoupon = (coupon: CouponRecord) => {
    const cleanCode = coupon.code.trim().toUpperCase();
    const record: CouponRecord = { ...coupon, code: cleanCode };
    setCoupons((prev) => {
      const exists = prev.some((c) => c.id === record.id || c.code.toUpperCase() === cleanCode);
      if (exists) {
        return prev.map((c) => (c.id === record.id || c.code.toUpperCase() === cleanCode ? record : c));
      }
      return [record, ...prev];
    });
    appendAudit('coupon.saved', 'settings', cleanCode, `Saved promo coupon ${cleanCode}`);
  };

  const deleteCoupon = (couponId: string) => {
    setCoupons((prev) => prev.filter((c) => c.id !== couponId));
    appendAudit('coupon.deleted', 'settings', couponId, `Removed promo coupon ${couponId}`);
  };

  const saveCategory = (category: ServiceCategory) => {
    setCategories((prev) => {
      const exists = prev.some((c) => c.id === category.id || c.slug === category.slug);
      if (exists) {
        return prev.map((c) => (c.id === category.id || c.slug === category.slug ? category : c));
      }
      return [...prev, category];
    });
    appendAudit('category.saved', 'service', category.slug, `Saved category ${category.name}`);
  };

  const purchaseDigitalProduct = (params: {
    service: Service;
    orderId: string;
    amountPaid: number;
    discountAmount?: number;
    couponCode?: string;
  }): DigitalProductOrder => {
    const nowIso = new Date().toISOString();
    const order: DigitalProductOrder = {
      id: `dpo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      orderId: params.orderId,
      userId: user?.id || 'guest',
      userName: user?.name || 'Customer',
      userEmail: user?.email || 'customer@digitalindiaproject.com',
      serviceId: params.service.id,
      productSlug: params.service.slug,
      productName: params.service.name,
      fileFormat: params.service.digitalAsset?.fileFormat || 'HTML / CSV',
      version: params.service.digitalAsset?.version || 'v1.0',
      amountPaid: params.amountPaid,
      discountAmount: params.discountAmount || 0,
      couponCode: params.couponCode,
      paymentStatus: 'Paid',
      downloadCount: 0,
      createdAt: nowIso,
    };
    setDigitalOrders((prev) => [order, ...prev]);
    const tx: PaymentTransaction = {
      id: `tx-dig-${Date.now()}`,
      orderId: params.orderId,
      applicationId: order.id,
      serviceName: `Digital Product: ${params.service.name}`,
      userId: order.userId,
      userName: order.userName,
      userEmail: order.userEmail,
      amount: params.amountPaid,
      currency: 'INR',
      status: 'Success',
      paymentMethod: 'Cashfree Digital Checkout',
      transactionDate: nowIso,
      receiptNumber: `DIG-${Math.floor(10000 + Math.random() * 90000)}`,
    };
    setTransactions((prev) => [tx, ...prev]);
    appendAudit('digital_product.purchased', 'payment', order.orderId, params.service.name);
    return order;
  };

  const recordProductDownload = (orderIdOrSlug: string) => {
    const nowIso = new Date().toISOString();
    setDigitalOrders((prev) =>
      prev.map((o) =>
        o.id === orderIdOrSlug || o.orderId === orderIdOrSlug || o.productSlug === orderIdOrSlug
          ? { ...o, downloadCount: o.downloadCount + 1, lastDownloadedAt: nowIso }
          : o
      )
    );
  };

  const submitQuoteRequest = async (input: {
    serviceId: string;
    serviceSlug: string;
    serviceName: string;
    contactName: string;
    contactEmail: string;
    contactMobile: string;
    companyName?: string;
    requirementsSummary: string;
    budgetRange?: string;
  }): Promise<CustomQuoteRequest> => {
    const nowIso = new Date().toISOString();
    let quoteId = `QT-${Date.now().toString(36).toUpperCase()}`;
    const apiRes = await submitCustomQuote({
      ...input,
      userId: user?.id,
    }).catch(() => null);
    if (apiRes?.ok && apiRes.data?.id) {
      quoteId = apiRes.data.id;
    }

    const record: CustomQuoteRequest = {
      id: quoteId,
      serviceId: input.serviceId,
      serviceSlug: input.serviceSlug,
      serviceName: input.serviceName,
      userId: user?.id,
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail.trim(),
      contactMobile: input.contactMobile.trim(),
      companyName: input.companyName?.trim() || undefined,
      requirementsSummary: input.requirementsSummary.trim(),
      budgetRange: input.budgetRange?.trim() || undefined,
      status: 'New',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setQuoteRequests((prev) => [record, ...prev]);
    appendAudit('quote.submitted', 'service', record.id, `${record.serviceName} (${record.contactName})`);
    return record;
  };

  const updateQuoteRequestStatus = (
    quoteId: string,
    status: CustomQuoteRequest['status'],
    quotedAmountInr?: number,
    adminNotes?: string
  ) => {
    const nowIso = new Date().toISOString();
    setQuoteRequests((prev) =>
      prev.map((q) =>
        q.id === quoteId
          ? {
              ...q,
              status,
              quotedAmountInr: quotedAmountInr !== undefined ? quotedAmountInr : q.quotedAmountInr,
              adminNotes: adminNotes !== undefined ? adminNotes : q.adminNotes,
              updatedAt: nowIso,
            }
          : q
      )
    );
    appendAudit('quote.updated', 'service', quoteId, `Status set to ${status}`);
  };

  const importCatalogue = async (
    rawInput: string | Service[],
    formatHint?: 'json' | 'csv' | 'system_sync'
  ): Promise<CatalogueImportReport> => {
    const { mergedItems, report } = runIdempotentCatalogueImport({
      existingItems: services,
      rawInput,
      actorName: user?.name || 'Super Admin',
      formatHint,
    });
    setServices(mergedItems);
    setImportReports((prev) => [report, ...prev].slice(0, 30));
    appendAudit(
      'catalogue.imported',
      'service',
      report.id,
      `Processed ${report.totalProcessed}: ${report.createdCount} created, ${report.updatedCount} updated, ${report.skippedCount} skipped`
    );
    importCatalogueToBackend({
      rawInput,
      formatHint: report.sourceFormat,
      actorName: report.actorName,
    }).catch(() => null);
    return report;
  };

  const syncCatalogueServicesToDatabase = async (options?: {
    includePackages?: boolean;
    dryRun?: boolean;
    forceRefreshSeo?: boolean;
  }): Promise<CatalogueImportReport> => {
    const includePackages = Boolean(options?.includePackages);
    const dryRun = Boolean(options?.dryRun);
    const forceRefreshSeo = options?.forceRefreshSeo !== false;
    const targetCatalog = includePackages ? COMPLETE_CATALOGUE_ITEMS : CORE_CATALOGUE_ITEMS;

    let report: CatalogueImportReport;
    if (auth.currentUser && (isSuperAdminRole(user?.role) || user?.role === 'admin')) {
      const firestoreRes = await syncServicesCatalogueToFirestore({
        userRole: user?.role,
        actorName: user?.name || 'Super Admin',
        includePackages,
        dryRun,
        forceRefreshSeo,
        preserveExistingCustomizations: true,
      });
      report = firestoreRes.report;
    } else {
      const localRes = runIdempotentCatalogueImport({
        existingItems: services,
        rawInput: targetCatalog,
        actorName: user?.name || 'Super Admin',
        formatHint: 'system_sync',
      });
      report = localRes.report;
    }

    if (!dryRun) {
      const mergedLocal = runIdempotentCatalogueImport({
        existingItems: services,
        rawInput: targetCatalog,
        actorName: user?.name || 'Super Admin',
        formatHint: 'system_sync',
      });
      setServices(mergedLocal.mergedItems);
      setImportReports((prev) => [report, ...prev].slice(0, 30));
      appendAudit(
        'catalogue.db_synced',
        'service',
        report.id,
        `Idempotent 145-service DB sync: +${report.createdCount} created, ~${report.updatedCount} updated, ${report.skippedCount} skipped`
      );
    }

    await syncCatalogueServicesBackend({
      includePackages,
      dryRun,
      forceRefreshSeo,
    }).catch(() => null);

    return report;
  };

  const packages = services.filter((s) => s.productType === 'compliance_package');

  return (
    <DataContext.Provider
      value={{
        services,
        packages,
        categories,
        coupons,
        digitalOrders,
        quoteRequests,
        importReports,
        blogPosts,
        applications,
        drafts,
        transactions,
        tickets,
        operatorEnrollments,
        partners,
        partnerCustomers,
        commissionRules,
        commissionLedger,
        settlementRequests,
        refunds,
        notifications,
        notificationTemplates,
        businessSettings,
        apiIntegrations,
        auditLogs,
        rolePermissions,
        managers,
        getServiceBySlug,
        validateCoupon,
        saveCoupon,
        deleteCoupon,
        saveCategory,
        purchaseDigitalProduct,
        recordProductDownload,
        submitQuoteRequest,
        updateQuoteRequestStatus,
        importCatalogue,
        syncCatalogueServicesToDatabase,
        createApplication,
        saveDraft,
        deleteDraft,
        updateApplicationStatus,
        assignOperator,
        bulkAssignOperator,
        verifyDocument,
        uploadCompletionDocument,
        uploadAdditionalDocument,
        syncApplicationPaymentStatus,
        trackApplication,
        createTicket,
        replyTicket,
        createOrUpdateService,
        toggleServicePublished,
        deleteService,
        submitOperatorEnrollment,
        reviewOperatorEnrollment,
        registerPartner,
        reviewPartner,
        addPartnerCustomer,
        saveCommissionRule,
        requestPartnerSettlement,
        processPartnerSettlement,
        requestRefund,
        processRefund,
        markNotificationRead,
        markAllNotificationsRead,
        saveNotificationTemplate,
        updateBusinessSettings,
        updateIntegrationConfig,
        updateRolePermissions,
        addManagerProfile,
        saveBlogPost,
        bulkSaveBlogPosts,
        deleteBlogPost,
        toggleBlogPostStatus,
        exportBackupJson,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};

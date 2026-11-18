import type { PermissionCode } from './lib/rbac';

export type UserRole =
  | 'customer'
  | 'operator'
  | 'manager'
  | 'partner'
  | 'admin'
  | 'super_admin'
  | 'business';

export type OperatorKycStatus =
  | 'Not Submitted'
  | 'KYC Submitted'
  | 'Under Verification'
  | 'Resubmission Required'
  | 'Approved'
  | 'Rejected';

export type PartnerApprovalStatus =
  | 'Not Submitted'
  | 'Pending Approval'
  | 'Approved'
  | 'Suspended'
  | 'Rejected';

export type PartnerType =
  | 'individual_agent'
  | 'csc_center'
  | 'franchise'
  | 'corporate_connector';

export type ApplicationSourceChannel =
  | 'web_b2c'
  | 'b2b_portal'
  | 'operator_assisted'
  | 'partner_assisted'
  | 'google_forms'
  | 'admin_manual';

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: UserRole;
  accountType?: 'customer' | 'business' | 'operator' | 'partner' | 'manager' | 'admin';
  permissions?: PermissionCode[];
  companyName?: string;
  businessId?: string;
  partnerId?: string;
  referralCode?: string;
  referredByCode?: string;
  kycStatus?: OperatorKycStatus;
  operatorEnrollmentId?: string;
  managerScope?: string;
  isActive?: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export type ApplicationStatus =
  | 'Draft'
  | 'Submitted'
  | 'Payment Pending'
  | 'Awaiting Payment'
  | 'Payment Successful'
  | 'Payment Confirmed'
  | 'Under Review'
  | 'Documents Required'
  | 'Correction Required'
  | 'Resubmitted'
  | 'Assigned'
  | 'Document Verification'
  | 'Processing'
  | 'Application Processing'
  | 'Submitted to Provider'
  | 'Submitted to External Authority'
  | 'Awaiting External Authority'
  | 'Verification Pending'
  | 'Awaiting External Approval'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled'
  | 'Refund Initiated'
  | 'Refunded';

export type PaymentStatus =
  | 'Initiated'
  | 'Pending'
  | 'Success'
  | 'Failed'
  | 'Refunded'
  | 'Partially Refunded';

export type IntegrationType =
  | 'api_setu'
  | 'digilocker'
  | 'other_api'
  | 'manual_assistance'
  | 'external_portal';

export type AvailabilityStatus = 'Live' | 'Coming Soon' | 'Manual' | 'Unavailable';

export type ApiStatus = 'Draft' | 'Testing' | 'Approved' | 'Active' | 'Suspended' | 'Retired';

export type CategoryCode =
  | 'CAT_A'
  | 'CAT_B'
  | 'CAT_C'
  | 'CAT_D'
  | 'CAT_E'
  | 'CAT_F'
  | 'CAT_G'
  | 'CAT_H'
  | 'CAT_I';

export interface ServiceCategory {
  id: string;
  name: string;
  nameHi: string;
  slug: string;
  description: string;
  iconName: string;
  badgeColor?: string;
  categoryCode?: CategoryCode;
  displayOrder?: number;
  subcategories?: string[];
  isActive?: boolean;
}

export interface FieldCondition {
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'is_truthy';
  value?: string | string[] | boolean;
}

export type DynamicFieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'tel'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'textarea'
  | 'address'
  | 'file'
  | 'repeater'
  | 'heading'
  | 'info'
  | 'consent';

export interface ServiceFormField {
  id: string;
  label: string;
  labelHi?: string;
  type: DynamicFieldType;
  placeholder?: string;
  required: boolean;
  options?: string[];
  helpText?: string;
  customError?: string;
  validationRegex?: string;
  defaultValue?: any;
  showIf?: FieldCondition;
  subFields?: {
    id: string;
    label: string;
    labelHi?: string;
    type: 'text' | 'number' | 'date' | 'select';
    required: boolean;
    options?: string[];
  }[];
}

export interface RequiredDocument {
  id: string;
  name: string;
  nameHi?: string;
  description: string;
  mandatory: boolean;
  allowedFormats: string[]; // ['pdf', 'jpg', 'png']
  maxSizeMB: number;
  showIf?: FieldCondition;
}

export type BillingUnit =
  | 'one_time'
  | 'month'
  | 'year'
  | 'page'
  | 'application'
  | 'document'
  | 'verification'
  | 'custom';

export type PricingType = 'fixed' | 'starting' | 'custom' | 'free' | 'commission';

export type ServiceDeliveryType =
  | 'online'
  | 'assisted'
  | 'digital_download'
  | 'hybrid'
  | 'api';

export interface DigitalAssetMeta {
  fileFormat: string; // e.g., "XLSX / CSV", "DOCX / HTML", "PDF Checklist", "ZIP Bundle"
  fileSizeLabel: string; // e.g., "420 KB"
  version: string; // e.g., "v2.4"
  previewSummary: string;
  includedFiles?: string[];
  usageInstructions?: string;
  downloadPolicy?: string;
  r2FileId?: string;
  r2ObjectKey?: string;
  generatorKey?: string;
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  nameHi: string;
  category: string;
  subcategory?: string;
  productType?: 'service' | 'digital_product' | 'api_product' | 'compliance_package';
  shortDesc: string;
  shortDescHi: string;
  fullDesc: string;
  fullDescHi?: string;
  iconName: string;
  coverImageUrl?: string;
  serviceCharge: number; // Professional fee in INR
  govtFees: number; // Official govt/statutory fee estimate or 0 if not applicable
  thirdPartyFees?: number; // Pass-through 3rd party fee estimate (DSC token, stamp paper, newspaper ad, domain)
  additionalCharge?: number;
  urgentFee?: number; // Optional priority drafting fee in INR
  discountInr?: number;
  taxRateBps?: number; // e.g., 1800 = 18%, 0 = GST-exempt
  taxInclusive?: boolean;
  partnerPriceInr?: number;
  billingUnit?: BillingUnit;
  pricingType?: PricingType;
  govtFeeNote?: string;
  commissionNote?: string;
  deliveryType?: ServiceDeliveryType;
  estimatedTime: string; // e.g., "3 - 5 Working Days"
  slaHours?: number;
  formVersion?: number;
  published?: boolean;
  supportedFilingModes?: ('self' | 'assisted')[];
  autoAssignRule?: 'round_robin' | 'manual' | 'specialized';
  serviceDisclaimer?: string;
  regulatedNotice?: string;
  instructions?: string;
  conditions?: string[];
  popular?: boolean;
  featured?: boolean;
  isCustomQuote?: boolean;
  includedServiceIds?: string[];
  exclusions?: string[];
  packageSavingsInr?: number;
  digitalAsset?: DigitalAssetMeta;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  integrationType: IntegrationType;
  availability: AvailabilityStatus;
  apiSetuRef?: string;
  providerApprovalStatus?: string;
  customerConsentRequired?: boolean;
  b2bSupported?: boolean;
  eligibility: string[];
  requiredDocs: RequiredDocument[];
  processSteps: { title: string; desc: string }[];
  faqs: { question: string; answer: string }[];
  formFields: ServiceFormField[];
  updatedAt?: string;
}

export interface CouponRecord {
  id: string;
  code: string;
  description: string;
  discountType: 'fixed' | 'percentage';
  discountAmountInr: number;
  discountPercentBps: number; // e.g., 1000 = 10%
  maxDiscountInr?: number;
  minOrderAmountInr: number;
  applicableCategories?: string[]; // empty/undefined = all
  validUntil?: string;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
}

export interface DigitalProductOrder {
  id: string;
  orderId: string;
  userId: string;
  userName: string;
  userEmail: string;
  serviceId: string;
  productSlug: string;
  productName: string;
  fileFormat: string;
  version: string;
  amountPaid: number;
  discountAmount?: number;
  couponCode?: string;
  paymentStatus: 'Paid' | 'Pending' | 'Refunded';
  downloadCount: number;
  lastDownloadedAt?: string;
  createdAt: string;
}

export interface CustomQuoteRequest {
  id: string;
  serviceId: string;
  serviceSlug: string;
  serviceName: string;
  userId?: string;
  contactName: string;
  contactEmail: string;
  contactMobile: string;
  companyName?: string;
  requirementsSummary: string;
  budgetRange?: string;
  status: 'New' | 'In Review' | 'Quoted' | 'Converted' | 'Closed';
  quotedAmountInr?: number;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogueImportReport {
  id: string;
  timestamp: string;
  actorName: string;
  sourceFormat: 'json' | 'csv' | 'system_sync';
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorsCount: number;
  errors: string[];
  warnings: string[];
}

export interface ApplicationDocument {
  id: string;
  applicationId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  fileId?: string;
  logicalBucket?: string;
  r2ObjectKey?: string;
  version?: number;
  uploadedAt: string;
  verificationStatus: 'Pending' | 'Verified' | 'Rejected' | 'Re-upload Requested';
  rejectionReason?: string;
  digilockerUri?: string;
  issuer?: string;
}

export interface StatusHistoryEntry {
  id: string;
  previousStatus: ApplicationStatus;
  newStatus: ApplicationStatus;
  updatedBy: string;
  updatedByRole: UserRole;
  timestamp: string;
  customerMessage: string;
  internalNote?: string;
}

export interface Application {
  id: string; // e.g., "DIP-2026-94812"
  userId: string;
  collectedByUid?: string;
  filingMode?: 'self' | 'assisted';
  partnerId?: string;
  partnerName?: string;
  referralCodeUsed?: string;
  assistedConsentRecorded?: boolean;
  sourceChannel?: ApplicationSourceChannel;
  userName: string;
  userEmail: string;
  userMobile: string;
  businessId?: string;
  serviceId: string;
  serviceName: string;
  serviceSlug: string;
  serviceVersion?: number;
  formVersion?: number;
  status: ApplicationStatus;
  submissionDate: string;
  updatedAt: string;
  slaTargetAt?: string;
  assignedOperatorId?: string;
  assignedOperatorName?: string;
  assignedManagerId?: string;
  formData: Record<string, any>;
  documents: ApplicationDocument[];
  statusHistory: StatusHistoryEntry[];
  customerRemarks?: string;
  internalNotes?: string;
  completionFileUrl?: string;
  completionFileName?: string;
  apiCorrelationId?: string;
  consentId?: string;
  urgentProcessing?: boolean;
  includedServiceIds?: string[];
  payment: {
    orderId: string;
    cfPaymentId?: string;
    amount: number;
    govtFee: number;
    thirdPartyFee?: number;
    additionalCharge?: number;
    urgentFee?: number;
    discountAmount?: number;
    couponCode?: string;
    taxAmount?: number;
    totalAmount: number;
    status: PaymentStatus;
    paymentMethod?: string;
    paidAt?: string;
    invoiceNumber?: string;
  };
}

export interface OperatorKycDocument {
  id: string;
  docType: 'PAN Card' | 'Masked Aadhaar / Address Proof' | 'Center Photograph' | 'Cancelled Cheque / Bank Proof';
  fileName: string;
  fileSize: number;
  status: 'Submitted' | 'Verified' | 'Rejected';
}

export interface OperatorEnrollment {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  mobile: string;
  centerName: string;
  operatingState: string;
  operatingDistrict: string;
  centerAddress: string;
  pincode: string;
  panNumber: string;
  maskedAadhaar: string;
  bankAccountHolder: string;
  bankIfsc: string;
  maskedBankAccount: string;
  experienceYears?: string;
  kycDocuments: OperatorKycDocument[];
  kycStatus: OperatorKycStatus;
  adminRemarks?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerProfile {
  id: string;
  userId: string;
  partnerCode: string; // e.g., PART-DIP-1042
  referralCode: string; // e.g., REF-RAJESH26
  partnerType: PartnerType;
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
  approvalStatus: PartnerApprovalStatus;
  minSettlementInr: number;
  customCommissionBps?: number;
  totalReferrals: number;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerCustomer {
  id: string;
  partnerId: string;
  name: string;
  email: string;
  mobile: string;
  consentCaptured: boolean;
  consentTimestamp: string;
  applicationsCount: number;
  createdAt: string;
}

export interface CommissionRule {
  id: string;
  name: string;
  partnerId?: string;
  partnerType?: PartnerType;
  serviceId?: string;
  commissionType: 'fixed' | 'percentage';
  fixedAmountPaise: number;
  percentageBps: number; // 1500 = 15%
  minOrderPaise?: number;
  effectiveFrom?: string;
  effectiveUntil?: string;
  isActive: boolean;
}

export interface CommissionLedgerEntry {
  id: string;
  partnerId: string;
  applicationId: string;
  serviceName: string;
  entryType: 'EARNED' | 'REVERSAL' | 'ADJUSTMENT' | 'SETTLED';
  grossServiceFeePaise: number;
  commissionPaise: number;
  tdsPaise: number;
  netPaise: number;
  status: 'Pending' | 'Approved' | 'Settled' | 'Reversed';
  settlementId?: string;
  notes?: string;
  createdAt: string;
}

export interface SettlementRequest {
  id: string;
  partnerId: string;
  partnerName: string;
  requestedPaise: number;
  status: 'Requested' | 'Under Review' | 'Approved' | 'Paid' | 'Rejected';
  payoutReference?: string;
  payoutMode?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  requestedAt: string;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  applicationId: string;
  serviceName: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  taxAmount?: number;
  govtFee?: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string;
  transactionDate: string;
  receiptNumber: string;
  invoiceNumber?: string;
}

export interface RefundRecord {
  id: string;
  paymentId: string;
  orderId: string;
  applicationId: string;
  amountInr: number;
  reason: string;
  status: 'Pending' | 'Processed' | 'Rejected';
  initiatedBy: string;
  processedAt?: string;
  createdAt: string;
}

export interface PlatformNotification {
  id: string;
  userId: string;
  title: string;
  titleHi?: string;
  message: string;
  messageHi?: string;
  channel: 'in_app' | 'email' | 'whatsapp' | 'sms';
  eventKey: string;
  deliveryStatus: 'Sent' | 'Queued' | 'Failed' | 'Channel Unconfigured';
  emailStatus?: 'Sent' | 'Queued' | 'Failed' | 'Channel Unconfigured';
  applicationId?: string;
  orderId?: string;
  amountInr?: number;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationTemplate {
  id: string;
  eventKey: string;
  channel: 'in_app' | 'email' | 'whatsapp' | 'sms';
  subjectEn: string;
  bodyEn: string;
  bodyHi: string;
  isActive: boolean;
}

export interface BusinessSettings {
  id: string;
  legalName: string;
  tradeName: string;
  gstin: string;
  pan: string;
  udyamNumber?: string;
  dunsNumber?: string;
  invoicePrefix: string;
  registeredAddress: string;
  supportEmail: string;
  supportPhone: string;
  defaultTaxRateBps: number;
  blogPublisherName?: string;
  allowUserBlogPublishing?: boolean;
  userBlogRequiresReview?: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export interface ApiIntegrationConfig {
  id: string;
  code: 'cashfree' | 'digilocker' | 'apisetu' | 'email_tx' | 'whatsapp' | 'sms';
  displayName: string;
  environment: 'sandbox' | 'production';
  isEnabled: boolean;
  isConfigured: boolean;
  notes: string;
  updatedAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  businessId?: string;
  partnerId?: string;
  subject: string;
  category: string;
  relatedApplicationId?: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Medium' | 'High';
  createdAt: string;
  updatedAt: string;
  messages: {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: UserRole;
    message: string;
    timestamp: string;
  }[];
}

export interface ActivityLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType:
    | 'application'
    | 'service'
    | 'user'
    | 'payment'
    | 'document'
    | 'settings'
    | 'apisetu'
    | 'business'
    | 'partner'
    | 'commission'
    | 'settlement'
    | 'rbac'
    | 'blog';
  entityId: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

// ==========================================
// API SETU & DIGILOCKER CONNECTOR TYPES
// ==========================================

export interface ApiProvider {
  id: string;
  name: string;
  code: string;
  publisher: string;
  baseUrl: string;
  sandboxUrl: string;
  authType: 'oauth2' | 'apikey' | 'token' | 'signed_request';
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  isEnabled: boolean;
  isApproved: boolean;
  environment: 'sandbox' | 'production';
  headers: Record<string, string>;
  createdAt: string;
}

export interface ApiCatalogueItem {
  id: string;
  name: string;
  providerName: string;
  apiSetuRef: string;
  category: string;
  description: string;
  docLink: string;
  authType: string;
  sandboxAvailable: boolean;
  prodApproved: boolean;
  status: ApiStatus;
  pricingPerCall: number;
  consentRequirement: string;
  requiredFields: string[];
  responseFields: string[];
}

export interface StandardApiResponse<T = any> {
  success: boolean;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'REJECTED';
  message: string;
  reference_id: string;
  provider_reference: string;
  data: T;
  error_code?: string;
  timestamp: string;
}

export interface ApiRequestLog {
  id: string;
  correlationId: string;
  apiId: string;
  apiName: string;
  endpoint: string;
  requestMethod: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  status: 'SUCCESS' | 'FAILED';
  statusCode: number;
  latencyMs: number;
  timestamp: string;
  maskedPayload?: string;
}

export interface UserConsent {
  id: string;
  userId: string;
  applicationId?: string;
  businessId?: string;
  purpose: string;
  purposeHi?: string;
  dataFieldsAccessed: string[];
  consentVersion: string;
  grantedAt: string;
  ipAddress: string;
  status: 'Active' | 'Withdrawn';
  withdrawnAt?: string;
}

// ==========================================
// B2B & ENTERPRISE PORTAL TYPES
// ==========================================

export interface Business {
  id: string;
  companyName: string;
  tradeName: string;
  gstin: string;
  pan: string;
  businessType: 'Private Limited' | 'LLP' | 'Proprietorship' | 'Partnership' | 'Public Ltd';
  industry: string;
  contactEmail: string;
  contactPhone: string;
  registeredAddress: string;
  plan: 'Starter' | 'Growth' | 'Enterprise';
  apiCreditsRemaining: number;
  monthlyQuota: number;
  apiKey: string;
  webhookSecret: string;
  webhookUrl?: string;
  isKycVerified: boolean;
  createdAt: string;
}

export interface BusinessMember {
  id: string;
  businessId: string;
  userId: string;
  name: string;
  email: string;
  role: 'Owner' | 'Manager' | 'Verifier' | 'Auditor';
  joinedAt: string;
}

export interface VerificationRequest {
  id: string;
  businessId: string;
  verificationType: 'PAN' | 'GSTIN' | 'Aadhaar_Masked' | 'Driving_Licence' | 'Vehicle_RC' | 'Udyam' | 'FSSAI' | 'Marksheet';
  identifierValue: string;
  status: 'Verified' | 'Failed' | 'Pending';
  providerRef: string;
  verifiedData?: Record<string, any>;
  performedAt: string;
}

export interface BulkJob {
  id: string;
  businessId: string;
  jobName: string;
  verificationType: string;
  totalRecords: number;
  successCount: number;
  failureCount: number;
  status: 'Queued' | 'Processing' | 'Completed' | 'Failed';
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
}

// ==========================================
// BLOG CMS & SEO TYPES
// ==========================================

export type BlogPostStatus = 'published' | 'draft' | 'archived';

export interface BlogFaqItem {
  question: string;
  answer: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  titleHi?: string;
  excerpt: string;
  excerptHi?: string;
  content: string;
  contentHi?: string;
  category: string;
  tags: string[];
  status: BlogPostStatus;
  featured?: boolean;
  authorName: string;
  authorRole?: string;
  authorUserId?: string;
  publishedAt: string;
  updatedAt: string;
  readingTimeMinutes: number;
  relatedServiceSlug?: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  featuredImageUrl?: string;
  faqItems?: BlogFaqItem[];
}


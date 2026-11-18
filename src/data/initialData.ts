import {
  Service,
  ServiceCategory,
  Application,
  PaymentTransaction,
  SupportTicket,
  ApiProvider,
  ApiCatalogueItem,
  ApiRequestLog,
  Business,
  VerificationRequest,
  BulkJob,
  UserConsent,
} from '../types';
import { CATALOGUE_CATEGORIES, COMPLETE_CATALOGUE_ITEMS } from './catalogue';

export const SERVICE_CATEGORIES: ServiceCategory[] = CATALOGUE_CATEGORIES;

export const INITIAL_SERVICES: Service[] = COMPLETE_CATALOGUE_ITEMS;

// Pre-seeded Verification API Providers (API Sathi & API Setu)
export const INITIAL_API_PROVIDERS: ApiProvider[] = [
  {
    id: 'prov-apisathi-main',
    name: 'API Sathi KYC, KYB & Banking Marketplace',
    code: 'APISATHI_MARKETPLACE',
    publisher: 'Pravaha Infinity Private Limited (apisathi.in)',
    baseUrl: 'https://apisathi.in/gw/v1/',
    sandboxUrl: 'https://apisathi.in/gw/v1/',
    authType: 'apikey',
    isEnabled: true,
    isApproved: true,
    environment: 'sandbox',
    headers: { 'Content-Type': 'application/json' },
    createdAt: '2026-11-17T08:00:00.000Z',
  },
  {
    id: 'prov-apisetu-main',
    name: 'National Informatics Centre (NIC) — API Setu',
    code: 'APISETU_PROD',
    publisher: 'Ministry of Electronics and Information Technology (MeitY)',
    baseUrl: 'https://apisetu.gov.in/api/v1',
    sandboxUrl: 'https://sandbox.apisetu.gov.in/api/v1',
    authType: 'oauth2',
    isEnabled: true,
    isApproved: true,
    environment: 'sandbox',
    headers: { 'X-APISETU-CLIENTID': 'DIP-CLIENT-88192', 'Content-Type': 'application/json' },
    createdAt: '2026-01-15T08:00:00.000Z',
  },
  {
    id: 'prov-digilocker-main',
    name: 'DigiLocker Service Provider Gateway',
    code: 'DIGILOCKER_LIVE',
    publisher: 'Digital India Corporation',
    baseUrl: 'https://api.digitallocker.gov.in/public/oauth2/1',
    sandboxUrl: 'https://sandbox.digitallocker.gov.in/public/oauth2/1',
    authType: 'oauth2',
    isEnabled: true,
    isApproved: true,
    environment: 'sandbox',
    headers: { 'X-DIGILOCKER-APPID': 'DIP_APP_77779' },
    createdAt: '2026-02-01T08:00:00.000Z',
  },
  {
    id: 'prov-gstn-main',
    name: 'GSTN Commercial Tax Verification Pipeline',
    code: 'GSTN_VERIFY',
    publisher: 'Goods and Services Tax Network',
    baseUrl: 'https://api.gst.gov.in/taxpayerapi/v1',
    sandboxUrl: 'https://devapi.gst.gov.in/taxpayerapi/v1',
    authType: 'apikey',
    isEnabled: true,
    isApproved: true,
    environment: 'sandbox',
    headers: { 'X-GSTN-KEY': 'DIP_GST_991823' },
    createdAt: '2026-03-10T08:00:00.000Z',
  },
];

// Pre-seeded API Setu Catalogue Items
export const INITIAL_API_CATALOGUE: ApiCatalogueItem[] = [
  {
    id: 'api-morth-dl',
    name: 'Driving Licence Verification API',
    providerName: 'Ministry of Road Transport & Highways (MoRTH)',
    apiSetuRef: 'in.gov.morth.dl',
    category: 'Transport & Identity',
    description: 'Instant query against Sarathi national database to verify license status, endorsements, validity, and holder details.',
    docLink: 'https://apisetu.gov.in/api-details/morth-driving-license',
    authType: 'OAuth 2.0 Bearer Token',
    sandboxAvailable: true,
    prodApproved: true,
    status: 'Active',
    pricingPerCall: 1.5,
    consentRequirement: 'Purpose: Driver KYC & Authentication with candidate express consent',
    requiredFields: ['dl_number', 'dob'],
    responseFields: ['holder_name', 'status', 'issue_date', 'valid_upto', 'cov_classes', 'rto_name'],
  },
  {
    id: 'api-morth-rc',
    name: 'Vehicle Registration Certificate (RC) API',
    providerName: 'Ministry of Road Transport & Highways (MoRTH)',
    apiSetuRef: 'in.gov.morth.rc',
    category: 'Transport & Logistics',
    description: 'Vehicle ownership, fitness, insurance validity, PUCC, chassis number, and financier status check from Vahan registry.',
    docLink: 'https://apisetu.gov.in/api-details/morth-vehicle-rc',
    authType: 'OAuth 2.0 Bearer Token',
    sandboxAvailable: true,
    prodApproved: true,
    status: 'Active',
    pricingPerCall: 1.5,
    consentRequirement: 'Purpose: Vehicle Ownership & Fleet Authentication',
    requiredFields: ['vehicle_reg_no'],
    responseFields: ['owner_name', 'maker_model', 'fuel_type', 'reg_date', 'fitness_upto', 'insurance_upto'],
  },
  {
    id: 'api-itd-pan',
    name: 'Instant PAN Verification & Aadhaar Seeding Status API',
    providerName: 'Income Tax Department / NSDL',
    apiSetuRef: 'in.gov.incometax.pan',
    category: 'Taxation & Identity',
    description: 'Validate 10-digit PAN authenticity, active status, name matching, and PAN-Aadhaar linkage confirmation.',
    docLink: 'https://apisetu.gov.in/api-details/income-tax-pan',
    authType: 'HMAC Signed Request / API Key',
    sandboxAvailable: true,
    prodApproved: true,
    status: 'Active',
    pricingPerCall: 0.8,
    consentRequirement: 'Purpose: Financial KYC verification per RBI / PMLA guidelines',
    requiredFields: ['pan_number', 'full_name_to_match'],
    responseFields: ['pan_status', 'name_match_score', 'aadhaar_seeding_status', 'last_updated'],
  },
  {
    id: 'api-gstn-verify',
    name: 'GSTIN Profile & Return Filing Status API',
    providerName: 'Goods and Services Tax Network (GSTN)',
    apiSetuRef: 'in.gov.gst.verify',
    category: 'Corporate & Compliance',
    description: 'Fetch legal name, trade name, taxpayer type, state jurisdiction, active status, and GSTR-1/3B filing track record.',
    docLink: 'https://apisetu.gov.in/api-details/gstn-taxpayer',
    authType: 'API Key + IP Whitelist',
    sandboxAvailable: true,
    prodApproved: true,
    status: 'Active',
    pricingPerCall: 0.5,
    consentRequirement: 'Purpose: Vendor KYC, invoice matching, and commercial due-diligence',
    requiredFields: ['gstin'],
    responseFields: ['trade_name', 'legal_name', 'status', 'taxpayer_type', 'filing_compliance_rating'],
  },
  {
    id: 'api-msme-udyam',
    name: 'Udyam Registration Certificate Verification API',
    providerName: 'Ministry of MSME',
    apiSetuRef: 'in.gov.msme.udyam',
    category: 'Business & Enterprise',
    description: 'Verify official Udyam MSME certificate authenticity, enterprise classification (Micro, Small, Medium), and major activity.',
    docLink: 'https://apisetu.gov.in/api-details/msme-udyam',
    authType: 'OAuth 2.0',
    sandboxAvailable: true,
    prodApproved: true,
    status: 'Active',
    pricingPerCall: 1.0,
    consentRequirement: 'Purpose: MSME vendor classification and priority lending due-diligence',
    requiredFields: ['udyam_reg_no'],
    responseFields: ['enterprise_name', 'enterprise_type', 'major_activity', 'district', 'state'],
  },
  {
    id: 'api-cbse-marksheet',
    name: 'CBSE Class X / XII Marksheet Retrieval API',
    providerName: 'Central Board of Secondary Education / DigiLocker',
    apiSetuRef: 'in.gov.cbse.marksheet',
    category: 'Education & Employment',
    description: 'Cryptographically signed marksheet retrieval from CBSE National Academic Depository (NAD).',
    docLink: 'https://apisetu.gov.in/api-details/cbse-nad',
    authType: 'OAuth 2.0 DigiLocker Bearer',
    sandboxAvailable: true,
    prodApproved: true,
    status: 'Active',
    pricingPerCall: 2.0,
    consentRequirement: 'Purpose: Candidate education credential verification for employment onboarding',
    requiredFields: ['roll_number', 'year', 'exam_type'],
    responseFields: ['candidate_name', 'result', 'marks_breakdown', 'uri', 'signed_doc_url'],
  },
];

export const INITIAL_BUSINESSES: Business[] = [];

export const INITIAL_VERIFICATIONS: VerificationRequest[] = [];

export const INITIAL_BULK_JOBS: BulkJob[] = [];

export const INITIAL_API_LOGS: ApiRequestLog[] = [];

export const INITIAL_APPLICATIONS: Application[] = [];

export const INITIAL_TRANSACTIONS: PaymentTransaction[] = [];

export const INITIAL_TICKETS: SupportTicket[] = [];

import type {
  AvailabilityStatus,
  BillingUnit,
  DigitalAssetMeta,
  IntegrationType,
  PricingType,
  RequiredDocument,
  Service,
  ServiceDeliveryType,
  ServiceFormField,
} from '../../types';
import { getServiceSeoMetadata } from '../../lib/seoData';

export interface ServiceSeedInput {
  id: string;
  slug: string;
  name: string;
  nameHi: string;
  category: string;
  subcategory: string;
  shortDesc: string;
  shortDescHi: string;
  fullDesc?: string;
  iconName: string;
  serviceCharge: number;
  govtFees?: number;
  thirdPartyFees?: number;
  urgentFee?: number;
  discountInr?: number;
  billingUnit?: BillingUnit;
  pricingType?: PricingType;
  govtFeeNote?: string;
  commissionNote?: string;
  deliveryType?: ServiceDeliveryType;
  estimatedTime: string;
  slaHours?: number;
  popular?: boolean;
  featured?: boolean;
  isCustomQuote?: boolean;
  b2bSupported?: boolean;
  integrationType?: IntegrationType;
  availability?: AvailabilityStatus;
  apiSetuRef?: string;
  providerApprovalStatus?: string;
  regulatedNotice?: string;
  serviceDisclaimer?: string;
  instructions?: string;
  conditions?: string[];
  eligibility?: string[];
  requiredDocs?: RequiredDocument[];
  processSteps?: { title: string; desc: string }[];
  faqs?: { question: string; answer: string }[];
  formFields?: ServiceFormField[];
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  taxRateBps?: number;
}

const DEFAULT_PRIVATE_DISCLAIMER =
  'Digital India Project is an independent private online services & digital solutions firm (not affiliated with any government ministry or department). Government/statutory portal fees, stamp duty, or third-party charges—where applicable—are billed transparently at actuals. Final issuance/approval rests solely with the concerned authority.';

const DEFAULT_PROCESS_STEPS = [
  { title: '1. Submit Details & Order', desc: 'Complete the structured intake form and pay applicable professional fees online.' },
  { title: '2. Document Verification', desc: 'Our desk reviews submitted IDs and supporting files to prevent avoidable clerical rejections.' },
  { title: '3. Assisted Filing / Execution', desc: 'Application drafting and coordination through authorized portal workflows.' },
  { title: '4. Tracking & Delivery', desc: 'Track milestones in real time using your Application ID and download final deliverables.' },
];

export const DOC_AADHAAR: RequiredDocument = {
  id: 'doc-aadhaar',
  name: 'Aadhaar Card / Valid Photo ID',
  description: 'Clear front and back scan (masked if sharing offline)',
  mandatory: true,
  allowedFormats: ['pdf', 'jpg', 'png'],
  maxSizeMB: 5,
};

export const DOC_PAN: RequiredDocument = {
  id: 'doc-pan',
  name: 'PAN Card Copy',
  description: '10-digit PAN card image or PDF',
  mandatory: true,
  allowedFormats: ['pdf', 'jpg', 'png'],
  maxSizeMB: 5,
};

export const DOC_ADDRESS: RequiredDocument = {
  id: 'doc-address',
  name: 'Address / Premises Proof',
  description: 'Latest Electricity Bill, Rent Agreement, Municipal Tax Receipt, or Bank Statement',
  mandatory: true,
  allowedFormats: ['pdf', 'jpg', 'png'],
  maxSizeMB: 5,
};

export const DOC_PHOTO: RequiredDocument = {
  id: 'doc-photo',
  name: 'Passport Size Photograph',
  description: 'Recent front-facing colour photograph',
  mandatory: true,
  allowedFormats: ['jpg', 'png'],
  maxSizeMB: 3,
};

export const DOC_BANK: RequiredDocument = {
  id: 'doc-bank',
  name: 'Cancelled Cheque / Bank Passbook',
  description: 'Showing Account Holder Name, Account No., and IFSC code',
  mandatory: true,
  allowedFormats: ['pdf', 'jpg', 'png'],
  maxSizeMB: 5,
};

export function standardIntakeFields(extraFields: ServiceFormField[] = []): ServiceFormField[] {
  return [
    { id: 'applicant_name', label: 'Applicant / Authorized Signatory Full Name', type: 'text', placeholder: 'Full legal name as per ID', required: true },
    { id: 'contact_mobile', label: 'Mobile Number (WhatsApp/OTP Active)', type: 'tel', placeholder: '10-digit mobile number', required: true, validationRegex: '^[6-9]\\d{9}$' },
    { id: 'contact_email', label: 'Email Address', type: 'email', placeholder: 'name@example.com', required: true },
    { id: 'city_state', label: 'City / District & State', type: 'text', placeholder: 'e.g. Silvassa, Dadra & Nagar Haveli', required: true },
    ...extraFields,
    { id: 'additional_notes', label: 'Special Instructions / Remarks', type: 'textarea', placeholder: 'Mention any urgency, mismatch details, or preferred language', required: false },
  ];
}

export function buildServiceItem(input: ServiceSeedInput): Service {
  const govt = input.govtFees ?? 0;
  const thirdParty = input.thirdPartyFees ?? 0;
  const priceLabel =
    input.pricingType === 'free'
      ? 'Free Registration'
      : input.pricingType === 'custom'
      ? 'Custom Quote'
      : input.pricingType === 'commission'
      ? input.commissionNote || '10% Commission'
      : `₹${input.serviceCharge.toLocaleString('en-IN')}`;

  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    nameHi: input.nameHi,
    category: input.category,
    subcategory: input.subcategory,
    productType: 'service',
    shortDesc: input.shortDesc,
    shortDescHi: input.shortDescHi,
    fullDesc:
      input.fullDesc ||
      `${input.shortDesc} Handled by Digital India Project's Silvassa & pan-India facilitation desk with transparent fee separation, checklist validation, and real-time Application ID tracking.`,
    iconName: input.iconName,
    serviceCharge: input.serviceCharge,
    govtFees: govt,
    thirdPartyFees: thirdParty,
    urgentFee: input.urgentFee ?? (input.serviceCharge >= 199 && !input.isCustomQuote ? 149 : 0),
    discountInr: input.discountInr ?? 0,
    taxRateBps: input.taxRateBps ?? 0,
    billingUnit: input.billingUnit ?? 'one_time',
    pricingType: input.pricingType ?? 'fixed',
    govtFeeNote:
      input.govtFeeNote ||
      (govt > 0
        ? `Estimated statutory/govt portal fee ~₹${govt.toLocaleString('en-IN')} applies at actuals.`
        : 'Govt/statutory or third-party portal charges (if any) apply at actuals as per authority schedule.'),
    commissionNote: input.commissionNote,
    deliveryType: input.deliveryType ?? 'online',
    estimatedTime: input.estimatedTime,
    slaHours: input.slaHours ?? 72,
    formVersion: 2,
    published: true,
    supportedFilingModes: ['self', 'assisted'],
    popular: Boolean(input.popular),
    featured: Boolean(input.featured),
    isCustomQuote: Boolean(input.isCustomQuote),
    b2bSupported: input.b2bSupported ?? (input.category === 'business-registration' || input.category === 'tax-compliance' || input.category === 'b2b-partner'),
    integrationType: input.integrationType ?? 'manual_assistance',
    availability: input.availability ?? 'Live',
    apiSetuRef: input.apiSetuRef,
    providerApprovalStatus: input.providerApprovalStatus,
    customerConsentRequired: true,
    serviceDisclaimer: input.serviceDisclaimer || DEFAULT_PRIVATE_DISCLAIMER,
    regulatedNotice: input.regulatedNotice,
    instructions:
      input.instructions ||
      'Ensure uploaded document scans are crisp, uncropped, and legible. Do not share OTPs in general remarks; use authorized links only.',
    conditions: input.conditions || [
      'Digital India Project is a private facilitation firm and cannot guarantee regulatory approvals.',
      'Government fees, stamp duty, DSC USB token, or third-party charges are billed transparently at actuals.',
      'Processing begins immediately once required documents and payment are confirmed.',
    ],
    eligibility: input.eligibility || [
      'Indian individuals, professionals, proprietors, firms, or companies with valid KYC proofs',
      'Consent authorization for document drafting and portal submission assistance',
    ],
    requiredDocs: input.requiredDocs ?? [DOC_AADHAAR, DOC_PAN],
    processSteps: input.processSteps ?? DEFAULT_PROCESS_STEPS,
    faqs: input.faqs ?? [
      {
        question: `What is included in the ${priceLabel} fee for ${input.name}?`,
        answer:
          'It covers document pre-check, form preparation/drafting, filing guidance, and milestone tracking on Digital India Project. Official government or third-party charges (if applicable) are separate.',
      },
      {
        question: 'Is Digital India Project a government portal?',
        answer:
          'No. Digital India Project is an independent private online services firm based in Silvassa serving Dadra & Nagar Haveli, Daman, Vapi, Valsad, Umargam, and clients across India.',
      },
      {
        question: 'Can I track my application online?',
        answer:
          'Yes. You receive a unique DIP tracking ID immediately upon submission to check live updates on our Track Application page.',
      },
    ],
    formFields: input.formFields ?? standardIntakeFields(),
    ...(() => {
      const seoMeta = getServiceSeoMetadata(input.slug);
      return {
        seoTitle: input.seoTitle || seoMeta?.seoTitle || `${input.name} (${priceLabel}) | Digital India Project`,
        seoDescription:
          input.seoDescription ||
          seoMeta?.seoDescription ||
          `${input.shortDesc} Transparent ${priceLabel} assistance across Silvassa, DNH, Daman, Vapi & India.`,
        focusKeyword: input.focusKeyword || seoMeta?.focusKeyword || input.name.toLowerCase(),
      };
    })(),
  };
}

export interface DigitalProductSeedInput {
  id: string;
  slug: string;
  name: string;
  nameHi: string;
  subcategory: string;
  shortDesc: string;
  shortDescHi: string;
  serviceCharge: number;
  iconName: string;
  popular?: boolean;
  featured?: boolean;
  asset: DigitalAssetMeta;
  seoTitle?: string;
  seoDescription?: string;
}

export function buildDigitalProductItem(input: DigitalProductSeedInput): Service {
  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    nameHi: input.nameHi,
    category: 'digital-products',
    subcategory: input.subcategory,
    productType: 'digital_product',
    shortDesc: input.shortDesc,
    shortDescHi: input.shortDescHi,
    fullDesc: `${input.shortDesc} Delivered via instant authorized download (${input.asset.fileFormat}, ${input.asset.fileSizeLabel}, ${input.asset.version}) directly in your Customer Dashboard Orders & Downloads vault after payment confirmation.`,
    iconName: input.iconName,
    serviceCharge: input.serviceCharge,
    govtFees: 0,
    thirdPartyFees: 0,
    urgentFee: 0,
    discountInr: 0,
    taxRateBps: 0,
    billingUnit: 'one_time',
    pricingType: 'fixed',
    govtFeeNote: '100% digital downloadable template/kit. Zero government fees apply.',
    deliveryType: 'digital_download',
    estimatedTime: 'Instant Digital Download',
    slaHours: 1,
    formVersion: 1,
    published: true,
    supportedFilingModes: ['self'],
    popular: Boolean(input.popular),
    featured: Boolean(input.featured),
    b2bSupported: true,
    integrationType: 'other_api',
    availability: 'Live',
    customerConsentRequired: false,
    digitalAsset: {
      ...input.asset,
      downloadPolicy:
        input.asset.downloadPolicy ||
        'Single-user/single-business commercial licence. Instant re-download access from your Digital India Project Dashboard.',
      usageInstructions:
        input.asset.usageInstructions ||
        'Download the verified template package from your Orders & Downloads panel and customize editable fields in Excel, Google Sheets, Word, or browser.',
    },
    serviceDisclaimer:
      'Digital templates and calculation spreadsheets are productivity aids designed for Indian businesses and jobseekers. For statutory filings or audited financial statements, consult a licensed Chartered Accountant or Advocate.',
    conditions: [
      'Instant digital access unlocked immediately upon verified payment confirmation.',
      'Digital downloads are non-refundable once downloaded, except for verified corrupted/unusable file defects (replaced or refunded within 7 days).',
      'Commercial redistribution or resale of raw templates is prohibited.',
    ],
    eligibility: [
      'Available to Indian individuals, freelancers, startups, MSMEs, students, and partner centers.',
    ],
    requiredDocs: [],
    processSteps: [
      { title: '1. Preview Specifications', desc: 'Inspect format, version, file size, and included sections before purchase.' },
      { title: '2. Complete Secure Checkout', desc: 'Apply any promo coupon and pay securely via Cashfree PG.' },
      { title: '3. Instant Download Access', desc: 'Download directly from order confirmation or Customer Dashboard anytime.' },
    ],
    faqs: [
      {
        question: 'How soon can I download the files?',
        answer: 'Immediately after payment confirmation via your Orders & Downloads dashboard and confirmation screen.',
      },
      {
        question: 'What software do I need to open these templates?',
        answer: `Provided in ${input.asset.fileFormat} compatible with Microsoft Excel/Word, Google Sheets/Docs, LibreOffice, and modern browsers.`,
      },
      {
        question: 'What is the digital product refund policy?',
        answer: 'Due to the instant downloadable nature, orders are final once downloaded. However, if a file fails to open or differs from description, support replaces or refunds within 7 days.',
      },
    ],
    formFields: [],
    ...(() => {
      const seoMeta = getServiceSeoMetadata(input.slug);
      return {
        seoTitle: input.seoTitle || seoMeta?.seoTitle || `${input.name} (₹${input.serviceCharge}) | Instant Download`,
        seoDescription:
          input.seoDescription ||
          seoMeta?.seoDescription ||
          `${input.shortDesc} Instant ${input.asset.fileFormat} download for ₹${input.serviceCharge}.`,
        focusKeyword: seoMeta?.focusKeyword || input.name.toLowerCase(),
      };
    })(),
  };
}

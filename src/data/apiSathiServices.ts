import type { Service } from '../types';
import { buildServiceItem, DOC_AADHAAR, DOC_BANK, DOC_PAN } from './catalogue/helpers';

export type ApiSathiServiceVertical = 'kyc' | 'kyb' | 'vehicle' | 'banking';

export interface ApiSathiRetailService extends Service {
  apiSathiProductSlug: string;
  wholesaleCostInr: number;
  retailPriceInr: number;
  grossMarginPercent: number;
  vertical: ApiSathiServiceVertical;
  requiredInputLabel: string;
  sampleFieldsReturned: string[];
}

interface RetailServiceSeed {
  id: string;
  slug: string;
  name: string;
  nameHi: string;
  apiSathiProductSlug: string;
  vertical: ApiSathiServiceVertical;
  category: string;
  subcategory: string;
  shortDesc: string;
  shortDescHi: string;
  iconName: string;
  retailPriceInr: number;
  wholesaleCostInr: number;
  requiredInputLabel: string;
  sampleFieldsReturned: string[];
  popular?: boolean;
  featured?: boolean;
  b2bSupported?: boolean;
  formFields: Service['formFields'];
  faqs: Service['faqs'];
}

function buildApiSathiRetailService(seed: RetailServiceSeed): ApiSathiRetailService {
  const grossMarginPercent =
    seed.retailPriceInr > 0
      ? Math.round(((seed.retailPriceInr - seed.wholesaleCostInr) / seed.retailPriceInr) * 1000) / 10
      : 0;

  const base = buildServiceItem({
    id: seed.id,
    slug: seed.slug,
    name: seed.name,
    nameHi: seed.nameHi,
    category: seed.category,
    subcategory: seed.subcategory,
    shortDesc: seed.shortDesc,
    shortDescHi: seed.shortDescHi,
    fullDesc: `${seed.shortDesc} Powered by real-time server-side API verification with DPDP consent capture, masked Aadhaar/PAN logging, idempotency protection, and instant structured verification results.`,
    iconName: seed.iconName,
    serviceCharge: seed.retailPriceInr,
    govtFees: 0,
    urgentFee: 0,
    taxRateBps: 1800,
    billingUnit: 'verification',
    pricingType: 'fixed',
    govtFeeNote: '100% digital verification service. Zero government challan or offline portal fee applies.',
    deliveryType: 'online',
    estimatedTime: 'Instant (Sub-second API)',
    slaHours: 1,
    popular: Boolean(seed.popular),
    featured: Boolean(seed.featured),
    b2bSupported: seed.b2bSupported ?? true,
    integrationType: 'api_setu',
    availability: 'Live',
    apiSetuRef: seed.apiSathiProductSlug,
    requiredDocs:
      seed.vertical === 'kyc'
        ? [DOC_PAN]
        : seed.vertical === 'banking'
        ? [DOC_BANK]
        : [DOC_PAN, DOC_AADHAAR],
    processSteps: [
      {
        title: '1. Enter Identifier & Consent',
        desc: `Provide the ${seed.requiredInputLabel} and confirm applicant consent per DPDP Act.`,
      },
      {
        title: '2. Pay Verification Fee Online',
        desc: `Complete transparent ₹${seed.retailPriceInr} checkout (or run directly from an approved Operator/B2B desk).`,
      },
      {
        title: '3. Real-Time Registry Query',
        desc: 'Backend gateway dispatches an encrypted, idempotent request with automatic transient retry safety.',
      },
      {
        title: '4. Instant Verification Output',
        desc: `Receive ${seed.sampleFieldsReturned.join(', ')} immediately with downloadable JSON audit summary.`,
      },
    ],
    formFields: seed.formFields,
    faqs: seed.faqs,
    seoTitle: `${seed.name} (₹${seed.retailPriceInr}) | Instant Online Check`,
    seoDescription: `${seed.shortDesc} Instant verified lookup for ₹${seed.retailPriceInr} at Digital India Project.`,
    focusKeyword: seed.name.toLowerCase(),
  });

  return {
    ...base,
    apiSathiProductSlug: seed.apiSathiProductSlug,
    wholesaleCostInr: seed.wholesaleCostInr,
    retailPriceInr: seed.retailPriceInr,
    grossMarginPercent,
    vertical: seed.vertical,
    requiredInputLabel: seed.requiredInputLabel,
    sampleFieldsReturned: seed.sampleFieldsReturned,
  };
}

export const API_SATHI_POWERED_SERVICES: ApiSathiRetailService[] = [
  buildApiSathiRetailService({
    id: 'srv-as-pan-verify',
    slug: 'instant-pan-verification',
    name: 'Instant PAN Verification & Aadhaar Link Report',
    nameHi: 'तत्काल पैन सत्यापन व आधार लिंकिंग जांच',
    apiSathiProductSlug: 'pan-verification-v1',
    vertical: 'kyc',
    category: 'personal',
    subcategory: 'PAN & Identity',
    shortDesc: 'Verify active 10-digit PAN against Income Tax Department records along with registered holder name and Aadhaar linkage status.',
    shortDescHi: 'इनकम टैक्स रिकॉर्ड से पैन सक्रिय स्थिति, धारक का नाम और आधार लिंकिंग की तुरंत जांच।',
    iconName: 'CreditCard',
    retailPriceInr: 29,
    wholesaleCostInr: 0.98,
    requiredInputLabel: '10-Character PAN',
    sampleFieldsReturned: ['PAN Status', 'Full Holder Name', 'PAN Category', 'Aadhaar Seeded Flag'],
    popular: true,
    featured: true,
    formFields: [
      { id: 'pan', label: '10-Character PAN Number', type: 'text', placeholder: 'ABCDE1234F', required: true, validationRegex: '^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$' },
    ],
    faqs: [
      { question: 'Does Instant PAN Verification show if Aadhaar is linked?', answer: 'Yes. The ITD verification check returns whether the PAN is active and reports its Aadhaar seeding status.' },
      { question: 'Is my PAN number stored in plain logs?', answer: 'No. Sensitive digits of your PAN are automatically masked in server and Firestore audit logs.' },
    ],
  }),
  buildApiSathiRetailService({
    id: 'srv-as-pan-aadhaar-link',
    slug: 'instant-pan-aadhaar-link-check',
    name: 'PAN–Aadhaar Link Pre-Check Service',
    nameHi: 'पैन-आधार लिंक स्थिति तुरंत जांच',
    apiSathiProductSlug: 'pan-aadhaar-link',
    vertical: 'kyc',
    category: 'personal',
    subcategory: 'PAN & Identity',
    shortDesc: 'Confirm whether your 10-character PAN and 12-digit Aadhaar are officially linked before ITR filing, bank KYC, or Mutual Fund onboarding.',
    shortDescHi: 'ITR या बैंक KYC से पहले पैन और आधार नंबर के आधिकारिक लिंक होने की तुरंत पुष्टि करें।',
    iconName: 'ShieldCheck',
    retailPriceInr: 19,
    wholesaleCostInr: 0.39,
    requiredInputLabel: '10-Char PAN & 12-Digit Aadhaar',
    sampleFieldsReturned: ['Linkage Verified Status', 'Result Message', 'Reference Call ID'],
    popular: true,
    formFields: [
      { id: 'pan', label: '10-Character PAN', type: 'text', placeholder: 'ABCDE1234F', required: true, validationRegex: '^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$' },
      { id: 'aadhaar', label: '12-Digit Aadhaar Number', type: 'text', placeholder: '123456789012', required: true, validationRegex: '^\\d{12}$' },
    ],
    faqs: [
      { question: 'Why check PAN-Aadhaar linking before paying ₹1,000 challan?', answer: 'Running an instant ₹19 check prevents paying an unnecessary late penalty if your PAN and Aadhaar are already linked.' },
    ],
  }),
  buildApiSathiRetailService({
    id: 'srv-as-digilocker-kyc',
    slug: 'instant-digilocker-aadhaar-kyc',
    name: 'Instant DigiLocker Aadhaar e-KYC Verification',
    nameHi: 'डिजिलॉकर आधार e-KYC सत्यापन सेवा',
    apiSathiProductSlug: 'aadhaar-digilocker-init-v1',
    vertical: 'kyc',
    category: 'personal',
    subcategory: 'Gazette & Digital Vault',
    shortDesc: 'Consented 2-step UIDAI DigiLocker e-KYC verification returning masked Aadhaar, verified legal name, DOB, gender, and address.',
    shortDescHi: 'आवेदक की सहमति से डिजिलॉकर द्वारा सत्यापित नाम, जन्मतिथि, लिंग और पता जांच (मास्क्ड आधार)।',
    iconName: 'FolderLock',
    retailPriceInr: 49,
    wholesaleCostInr: 1.98,
    requiredInputLabel: '10-Digit Mobile (for consented DigiLocker session)',
    sampleFieldsReturned: ['Masked Aadhaar', 'Verified Name', 'Date of Birth', 'Address'],
    featured: true,
    formFields: [
      { id: 'mobile', label: 'Applicant 10-Digit Mobile', type: 'tel', placeholder: '9876543210', required: true, validationRegex: '^[6-9]\\d{9}$' },
      { id: 'firstName', label: 'First Name (Optional)', type: 'text', placeholder: 'Applicant First Name', required: false },
    ],
    faqs: [
      { question: 'How does the 2-step DigiLocker e-KYC flow work?', answer: 'Step 1 generates an official consented DigiLocker link for the applicant. Once Aadhaar authentication completes, Step 2 retrieves verified masked Aadhaar details.' },
    ],
  }),
  buildApiSathiRetailService({
    id: 'srv-as-gstin-basic',
    slug: 'instant-gstin-verification',
    name: 'GSTIN Authenticity & Legal Name Check',
    nameHi: 'GSTIN नंबर एवं लीगल नाम तुरंत जांच',
    apiSathiProductSlug: 'gstin-basic-v1',
    vertical: 'kyb',
    category: 'business-registration',
    subcategory: 'MSME & GST',
    shortDesc: 'Instantly validate a vendor or buyer 15-character GSTIN to confirm active registration, legal name, trade name, and state jurisdiction.',
    shortDescHi: 'किसी भी विक्रेता या ग्राहक के 15-अंकीय GSTIN की सक्रियता, लीगल व ट्रेड नाम की तुरंत जांच।',
    iconName: 'Landmark',
    retailPriceInr: 29,
    wholesaleCostInr: 0.52,
    requiredInputLabel: '15-Character GSTIN',
    sampleFieldsReturned: ['Active/Cancelled Status', 'Legal Name', 'Trade Name', 'State & Registration Date'],
    popular: true,
    formFields: [
      { id: 'gstin', label: '15-Character GSTIN', type: 'text', placeholder: '26EXIPK0151F1ZQ', required: true, validationRegex: '^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}[1-9A-Za-z]{1}[Zz][0-9A-Za-z]{1}$' },
    ],
    faqs: [
      { question: 'Who uses GSTIN Authenticity Check?', answer: 'B2B buyers, accountants, CA firms, and marketplaces verifying supplier GST bills before releasing payments or claiming ITC.' },
    ],
  }),
  buildApiSathiRetailService({
    id: 'srv-as-gstin-adv',
    slug: 'instant-gstin-compliance-report',
    name: 'Comprehensive GSTIN Compliance & Taxpayer Report',
    nameHi: 'विस्तृत GSTIN करदाता व अनुपालन रिपोर्ट',
    apiSathiProductSlug: 'gstin-verify-v1',
    vertical: 'kyb',
    category: 'business-registration',
    subcategory: 'MSME & GST',
    shortDesc: 'Deep KYB taxpayer lookup returning constitution of business, HSN/SAC nature, principal place of business, and filing profile.',
    shortDescHi: 'व्यवसाय के प्रकार, मुख्य पते और रिटर्न प्रोफाइल सहित विस्तृत GSTIN करदाता सत्यापन।',
    iconName: 'Building2',
    retailPriceInr: 49,
    wholesaleCostInr: 0.85,
    requiredInputLabel: '15-Character GSTIN',
    sampleFieldsReturned: ['Constitution Type', 'Principal Address', 'Taxpayer Status', 'Nature of Business'],
    formFields: [
      { id: 'gstin', label: '15-Character GSTIN', type: 'text', placeholder: '26EXIPK0151F1ZQ', required: true, validationRegex: '^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}[1-9A-Za-z]{1}[Zz][0-9A-Za-z]{1}$' },
    ],
    faqs: [
      { question: 'How is this different from Basic GSTIN Check?', answer: 'The comprehensive report adds detailed business constitution, registered address components, and deeper KYB due-diligence fields.' },
    ],
  }),
  buildApiSathiRetailService({
    id: 'srv-as-gstin-pan',
    slug: 'instant-gstin-by-pan-lookup',
    name: 'Find All GSTINs Registered Under a PAN',
    nameHi: 'PAN से सभी पंजीकृत GSTIN नंबर खोजें',
    apiSathiProductSlug: 'gstin-by-pan-v1',
    vertical: 'kyb',
    category: 'business-registration',
    subcategory: 'MSME & GST',
    shortDesc: 'Discover every active or inactive multi-state GSTIN registration linked to an individual, firm, or company PAN number.',
    shortDescHi: 'किसी व्यक्ति या कंपनी के PAN से जुड़े सभी राज्यों के सक्रिय व निष्क्रिय GSTIN नंबर खोजें।',
    iconName: 'Search',
    retailPriceInr: 39,
    wholesaleCostInr: 0.46,
    requiredInputLabel: '10-Character PAN',
    sampleFieldsReturned: ['Mapped GSTIN List', 'State Codes', 'Registration Status'],
    formFields: [
      { id: 'pan', label: '10-Character Business/Individual PAN', type: 'text', placeholder: 'ABCDE1234F', required: true, validationRegex: '^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$' },
    ],
    faqs: [
      { question: 'When is GSTIN-by-PAN lookup helpful?', answer: 'Useful when a counterparty provides only their PAN and you need to confirm all multi-state GSTINs before vendor onboarding.' },
    ],
  }),
  buildApiSathiRetailService({
    id: 'srv-as-dl',
    slug: 'instant-driving-licence-verification',
    name: 'Driving Licence Authenticity Check (MoRTH Sarathi)',
    nameHi: 'ड्राइविंग लाइसेंस तुरंत सत्यापन (सारथी पोर्टल)',
    apiSathiProductSlug: 'driving-license-v1',
    vertical: 'vehicle',
    category: 'personal',
    subcategory: 'Voter & Transport',
    shortDesc: 'Verify Driving Licence number & date of birth against national Sarathi database for validity, RTO name, and vehicle classes (LMV/MCWG).',
    shortDescHi: 'मोर्थ सारथी डेटाबेस से ड्राइविंग लाइसेंस की वैधता, RTO और वाहन श्रेणी की तुरंत जांच।',
    iconName: 'ShieldCheck',
    retailPriceInr: 49,
    wholesaleCostInr: 1.30,
    requiredInputLabel: 'DL Number & Date of Birth',
    sampleFieldsReturned: ['Holder Name', 'Valid Upto', 'Authorized Vehicle Classes', 'Issuing RTO'],
    popular: true,
    formFields: [
      { id: 'dl_number', label: 'Driving Licence Number', type: 'text', placeholder: 'RJ1420110012345', required: true },
      { id: 'dob', label: 'Date of Birth (DD/MM/YYYY)', type: 'date', required: true },
    ],
    faqs: [
      { question: 'Who requires Driving Licence verification?', answer: 'Logistics operators, cab aggregators, delivery fleets, and employers verifying driver eligibility prior to dispatch.' },
    ],
  }),
  buildApiSathiRetailService({
    id: 'srv-as-rc',
    slug: 'instant-vehicle-rc-verification',
    name: 'Vehicle RC, Fitness, Insurance & Owner Report (Vahan)',
    nameHi: 'वाहन RC, फिटनेस, बीमा और मालिक जांच (वाहन)',
    apiSathiProductSlug: 'vehicle-rc-v1',
    vertical: 'vehicle',
    category: 'personal',
    subcategory: 'Voter & Transport',
    shortDesc: 'Check national Vahan registry for vehicle owner name, maker/model, fuel type, registration age, fitness expiry, and insurance validity.',
    shortDescHi: 'किसी भी कार या कमर्शियल वाहन के मालिक, फिटनेस, बीमा और रजिस्ट्रेशन स्थिति की तुरंत रिपोर्ट।',
    iconName: 'ShieldCheck',
    retailPriceInr: 49,
    wholesaleCostInr: 2.93,
    requiredInputLabel: 'Vehicle Registration Number',
    sampleFieldsReturned: ['Owner Name', 'Maker & Model', 'Fitness Upto', 'Insurance Upto', 'Fuel Type'],
    popular: true,
    featured: true,
    formFields: [
      { id: 'rc_number', label: 'Vehicle Registration No.', type: 'text', placeholder: 'MH12DE1433', required: true, validationRegex: '^[A-Za-z]{2}[0-9]{1,2}[A-Za-z]{0,3}[0-9]{4}$' },
    ],
    faqs: [
      { question: 'Can I check a used vehicle before buying?', answer: 'Yes. Enter the registration number to verify registered owner details, registration date, fuel norm, and insurance/fitness expiry.' },
    ],
  }),
  buildApiSathiRetailService({
    id: 'srv-as-ifsc',
    slug: 'instant-ifsc-branch-verification',
    name: 'Bank IFSC Branch & UPI/NEFT/IMPS Support Check',
    nameHi: 'बैंक IFSC कोड व शाखा तुरंत सत्यापन',
    apiSathiProductSlug: 'ifsc-lookup-v1',
    vertical: 'banking',
    category: 'b2b-partner',
    subcategory: 'Bulk & API Verification',
    shortDesc: 'Validate any 11-character Indian bank IFSC code to retrieve official bank name, branch address, MICR, RTGS, NEFT, IMPS, and UPI capability.',
    shortDescHi: 'किसी भी बैंक IFSC कोड से शाखा का नाम, पता और NEFT/RTGS/IMPS/UPI सुविधा की तुरंत पुष्टि करें।',
    iconName: 'Landmark',
    retailPriceInr: 19,
    wholesaleCostInr: 0.50,
    requiredInputLabel: '11-Character Bank IFSC',
    sampleFieldsReturned: ['Bank & Branch Name', 'Branch Address', 'NEFT / IMPS / RTGS / UPI Flags', 'MICR Code'],
    formFields: [
      { id: 'ifsc', label: '11-Character Bank IFSC', type: 'text', placeholder: 'SBIN0001234', required: true, validationRegex: '^[A-Za-z]{4}0[A-Za-z0-9]{6}$' },
    ],
    faqs: [
      { question: 'Why verify IFSC before vendor or salary payouts?', answer: 'Prevents failed NEFT/RTGS transfers caused by merged bank branches (such as SBI associate or PSU bank mergers).' },
    ],
  }),
  buildApiSathiRetailService({
    id: 'srv-as-cin',
    slug: 'instant-mca-cin-verification',
    name: 'MCA Company CIN & Corporate Status Check',
    nameHi: 'कंपनी CIN एवं MCA कॉर्पोरेट स्थिति जांच',
    apiSathiProductSlug: 'cin-basic-v1',
    vertical: 'kyb',
    category: 'business-registration',
    subcategory: 'Company & Firm Setup',
    shortDesc: 'Verify any 21-character Company Identification Number (CIN) against MCA corporate master records for incorporation status and company class.',
    shortDescHi: 'प्राइवेट लिमिटेड, पब्लिक या OPC कंपनी के 21-अंकीय CIN की MCA रिकॉर्ड से तुरंत जांच।',
    iconName: 'Building2',
    retailPriceInr: 49,
    wholesaleCostInr: 0.65,
    requiredInputLabel: '21-Character Company CIN',
    sampleFieldsReturned: ['Company Name', 'Company Status (Active/Strike-Off)', 'ROC Jurisdiction', 'Incorporation Date'],
    formFields: [
      { id: 'cin', label: '21-Character MCA CIN', type: 'text', placeholder: 'U72900RJ2020PTC012345', required: true, validationRegex: '^[LUu][0-9]{5}[A-Za-z]{2}[0-9]{4}[A-Za-z]{3}[0-9]{6}$' },
    ],
    faqs: [
      { question: 'What does MCA CIN Check help confirm?', answer: 'It helps B2B partners, lenders, and clients verify that a Private Limited / Public Limited / OPC entity is Active and legally incorporated.' },
    ],
  }),
  buildApiSathiRetailService({
    id: 'srv-as-udyam',
    slug: 'instant-udyam-msme-lookup',
    name: 'Mobile to Udyam MSME Registration Lookup',
    nameHi: 'मोबाइल नंबर से उद्यम MSME पंजीकरण खोजें',
    apiSathiProductSlug: 'mobile-to-udyam-v1',
    vertical: 'kyb',
    category: 'business-registration',
    subcategory: 'MSME & GST',
    shortDesc: 'Locate lost Udyam MSME registration numbers and enterprise classifications linked to a proprietor or business mobile number.',
    shortDescHi: 'मोबाइल नंबर के माध्यम से पंजीकृत उद्यम MSME प्रमाणपत्र नंबर और इकाई श्रेणी की तुरंत खोज।',
    iconName: 'Building2',
    retailPriceInr: 79,
    wholesaleCostInr: 6.50,
    requiredInputLabel: '10-Digit Registered Mobile',
    sampleFieldsReturned: ['Udyam Registration Number(s)', 'Enterprise Name', 'Micro/Small/Medium Classification'],
    formFields: [
      { id: 'mobile', label: '10-Digit Registered Mobile Number', type: 'tel', placeholder: '9876543210', required: true, validationRegex: '^[6-9]\\d{9}$' },
    ],
    faqs: [
      { question: 'When should businesses use Mobile to Udyam Lookup?', answer: 'Ideal when a vendor forgot their Udyam Registration Number or when verifying MSME status for 45-day payment compliance.' },
    ],
  }),
  buildApiSathiRetailService({
    id: 'srv-as-voter',
    slug: 'instant-voter-id-verification',
    name: 'Voter ID (EPIC) Electoral Roll Verification',
    nameHi: 'वोटर आईडी (EPIC) मतदाता सूची जांच',
    apiSathiProductSlug: 'voter-id-v1',
    vertical: 'kyc',
    category: 'personal',
    subcategory: 'Voter & Transport',
    shortDesc: 'Confirm 10-character EPIC Voter ID card authenticity, assembly constituency, part name, and holder identity from electoral records.',
    shortDescHi: '10-अंकीय EPIC वोटर कार्ड की वैधता, विधानसभा क्षेत्र और धारक विवरण की तुरंत पुष्टि।',
    iconName: 'ShieldCheck',
    retailPriceInr: 29,
    wholesaleCostInr: 0.65,
    requiredInputLabel: '10-Character EPIC Number',
    sampleFieldsReturned: ['Elector Name', 'Relative Name', 'Assembly Constituency', 'State & Polling Station'],
    formFields: [
      { id: 'epic_number', label: '10-Character EPIC Number', type: 'text', placeholder: 'ABC1234567', required: true, validationRegex: '^[A-Za-z]{3}[0-9]{7}$' },
    ],
    faqs: [
      { question: 'What format should the EPIC number follow?', answer: 'Standard 10-character format with 3 letters followed by 7 digits (for example ABC1234567).' },
    ],
  }),
  buildApiSathiRetailService({
    id: 'srv-as-name-match',
    slug: 'instant-kyc-name-match',
    name: 'KYC Document Name Match Verification',
    nameHi: 'दस्तावेज़ नाम मिलान (Name Match) स्कोर जांच',
    apiSathiProductSlug: 'name-match',
    vertical: 'kyc',
    category: 'personal',
    subcategory: 'PAN & Identity',
    shortDesc: 'Compare two variations of a holder name (for example PAN vs Bank Passbook or Aadhaar vs Passport) using phonetic and fuzzy similarity scoring.',
    shortDescHi: 'पैन, आधार व बैंक पासबुक में लिखे नामों के बीच सटीक मिलान स्कोर और अंतर जांचें।',
    iconName: 'CheckCircle2',
    retailPriceInr: 19,
    wholesaleCostInr: 0.50,
    requiredInputLabel: 'Two Full Names to Compare',
    sampleFieldsReturned: ['Match Status', 'Similarity Score (%)', 'Phonetic Match Decision'],
    formFields: [
      { id: 'name1', label: 'Primary Document Name (e.g. PAN)', type: 'text', placeholder: 'RAJESH KUMAR SHARMA', required: true },
      { id: 'name2', label: 'Secondary Document Name (e.g. Bank)', type: 'text', placeholder: 'RAJESH K SHARMA', required: true },
    ],
    faqs: [
      { question: 'Why run a Name Match check before filing?', answer: 'Helps determine whether initials or middle-name differences between PAN and Bank records are acceptable or need PAN correction first.' },
    ],
  }),
];

const RELATED_CORE_SERVICE_SLUG_TO_API_SATHI: Record<string, string> = {
  'pan-card': 'pan-verification-v1',
  'pan-correction': 'pan-verification-v1',
  'pan-reprint-assistance': 'pan-basic-v1',
  'pan-aadhaar-linking-assistance': 'pan-aadhaar-link',
  'digilocker-assistance': 'aadhaar-digilocker-init-v1',
  'driving-licence-assistance': 'driving-license-v1',
  'vehicle-rc-assistance': 'vehicle-rc-v1',
  'voter-id-registration': 'voter-id-v1',
  'gst-registration': 'gstin-basic-v1',
  'gst-amendment-cancellation': 'gstin-verify-v1',
  'msme-udyam-registration': 'mobile-to-udyam-v1',
  'private-limited-company-registration': 'cin-basic-v1',
  'b2b-bulk-verification': 'pan-verification-v1',
};

export function findApiSathiServiceBySlugOrId(
  slugOrId?: string | null
): ApiSathiRetailService | undefined {
  const clean = String(slugOrId || '').trim().toLowerCase();
  if (!clean) return undefined;
  return API_SATHI_POWERED_SERVICES.find(
    (s) => s.slug.toLowerCase() === clean || s.id.toLowerCase() === clean
  );
}

export function resolveApiSathiProductSlugForService(
  serviceSlug?: string | null
): string | undefined {
  const clean = String(serviceSlug || '').trim().toLowerCase();
  if (!clean) return undefined;
  const direct = findApiSathiServiceBySlugOrId(clean);
  if (direct) return direct.apiSathiProductSlug;
  return RELATED_CORE_SERVICE_SLUG_TO_API_SATHI[clean];
}

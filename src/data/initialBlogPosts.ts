import { BlogPost } from '../types';
import { AADHAAR_AND_PAN_BLOGS } from './blogArticles/aadhaarAndPan';
import { VOTER_AND_PASSPORT_BLOGS } from './blogArticles/voterAndPassport';
import { CERTIFICATES_AND_GAZETTE_BLOGS } from './blogArticles/certificatesAndGazette';
import { BUSINESS_AND_DIGITAL_BLOGS } from './blogArticles/businessAndDigital';
import { STUDENT_VEHICLE_AND_SCHEMES_BLOGS } from './blogArticles/studentVehicleAndSchemes';

const CORE_FEATURED_BLOG_POSTS: BlogPost[] = [
  {
    id: 'blog-pan-correction-guide',
    slug: 'pan-card-application-and-correction-complete-guide-2026',
    title: 'PAN Card Application & Correction Online: Complete 2026 Citizen Guide',
    titleHi: 'पैन कार्ड आवेदन और सुधार ऑनलाइन: संपूर्ण 2026 गाइड',
    excerpt:
      'Step-by-step instructions to apply for a new PAN card or fix spelling, date of birth, and father name mismatches using verified Aadhaar records.',
    excerptHi:
      'नए पैन कार्ड के लिए आवेदन करने या नाम, जन्मतिथि और पिता के नाम में सुधार करने की आसान ऑनलाइन प्रक्रिया और आवश्यक दस्तावेज़।',
    content: `## Why Accurate PAN Details Are Mandatory in 2026
Your Permanent Account Number (PAN) is linked across bank accounts, Demat portfolios, Income Tax Returns, GSTIN filings, and Aadhaar e-KYC. Even a single letter discrepancy between your Aadhaar card and PAN database can stall loan sanctions or tax refunds.

## Required Documents for New PAN & Correction
- Aadhaar Card with active OTP mobile number for demographic validation
- Recent passport-size color photograph and clear black-ink signature scan
- Supporting proof for major name or date-of-birth changes (Passport, Voter ID, Birth Certificate, or Gazette Notification)

## Step-by-Step Assisted Filing Workflow
1. Select New PAN (Form 49A) or Changes/Correction in PAN on Digital India Project
2. Verify Aadhaar spelling and mobile OTP contact fields carefully
3. Upload legible PDF/JPG copies to your encrypted Document Vault
4. Track NSDL/UTIITSL dispatch milestones in real time from your Citizen Dashboard`,
    category: 'PAN & Identity',
    tags: ['PAN Card', 'Aadhaar Linking', 'Form 49A', 'Identity Proof'],
    status: 'published',
    featured: true,
    authorName: 'Suraj Singh',
    authorRole: 'Tax & Identity Compliance Lead',
    publishedAt: '2026-10-18T09:00:00Z',
    updatedAt: '2026-11-10T10:30:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'pan-card',
    seoTitle: 'PAN Card Application & Correction Online — 2026 Document Guide',
    seoDescription:
      'Apply for a new PAN card or correct name, DOB, and photo online. Check Form 49A documents, fees, and real-time tracking steps.',
    focusKeyword: 'PAN card application',
    faqItems: [
      {
        question: 'How long does PAN card correction take?',
        answer:
          'Digital e-PAN updates are typically issued within 3 to 7 working days after document verification, followed by physical card dispatch via India Post.',
      },
      {
        question: 'Can I update my surname after marriage?',
        answer:
          'Yes. Provide a Marriage Certificate or Official Gazette notification alongside your updated Aadhaar card for smooth name change approval.',
      },
    ],
  },
  {
    id: 'blog-gst-registration-checklist',
    slug: 'gst-registration-online-eligibility-documents-threshold-india',
    title: 'GST Registration in India: Turnover Limits, Documents & HSN Compliance',
    titleHi: 'भारत में GST रजिस्ट्रेशन: सीमा, आवश्यक दस्तावेज़ और नियम',
    excerpt:
      'Know when GST registration becomes mandatory for traders, service providers, and e-commerce sellers, plus the exact principal place of business proofs needed.',
    excerptHi:
      'जानें कि व्यापारियों, सेवा प्रदाताओं और ई-कॉमर्स विक्रेताओं के लिए GST पंजीकरण कब अनिवार्य होता है और कौन से दस्तावेज़ लगते हैं।',
    content: `## Who Needs Mandatory GST Registration?
Businesses supplying goods above ₹40 lakh (or ₹20 lakh in special category states) and service providers above ₹20 lakh annual aggregate turnover must register under GST. Inter-state suppliers and e-commerce marketplace sellers require GSTIN regardless of turnover.

## Principal Place of Business Proof Checklist
- Recent Electricity Bill, Municipal Tax Receipt, or Property Index copy (less than 60 days old)
- Registered Rent Agreement or notarized NOC from the property owner
- PAN card, Aadhaar card, photograph, and cancelled bank cheque of the proprietor or authorized signatory

## Avoiding Officer Show-Cause Queries (REG-03)
Most GST delays happen because the electricity bill address does not match the rent agreement or NOC signature. Upload clean, high-contrast scans and verify PIN codes carefully before OTP authentication.`,
    category: 'GST & Business',
    tags: ['GST Registration', 'GSTIN', 'MSME Tax', 'Business Compliance'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Indirect Tax & GST Specialist',
    publishedAt: '2026-10-22T09:00:00Z',
    updatedAt: '2026-11-08T11:00:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'gst-registration',
    seoTitle: 'GST Registration Online India — Eligibility, Fees & Docs',
    seoDescription:
      'Complete GST registration checklist for proprietors, LLPs, and companies. Learn turnover thresholds and avoid REG-03 notice delays.',
    focusKeyword: 'GST registration',
    faqItems: [
      {
        question: 'Can I register GST from a residential or co-working address?',
        answer:
          'Yes, provided you submit the owner Consent Letter (NOC) along with the latest electricity bill or municipal property tax receipt for that premises.',
      },
    ],
  },
  {
    id: 'blog-udyam-msme-benefits',
    slug: 'udyam-msme-registration-benefits-subsidies-gem-portal-guide',
    title: 'Udyam MSME Certificate: Top Loans, Subsidies & GeM Portal Benefits',
    titleHi: 'उद्यम MSME प्रमाणपत्र: लोन सब्सिडी और सरकारी टेंडर लाभ',
    excerpt:
      'Learn how an official Udyam Registration Number unlocks collateral-free bank loans, government tender EMD exemptions, and delayed-payment protection.',
    excerptHi:
      'जानें कि उद्यम पंजीकरण संख्या से बिना गारंटी लोन, टेंडर छूट और भुगतान सुरक्षा जैसे लाभ कैसे मिलते हैं।',
    content: `## What Changed Under the Unified Udyam Framework
Micro, Small, and Medium Enterprises are classified strictly by composite investment in plant/machinery and annual turnover linked with Income Tax and GST databases. Once issued, your lifetime Udyam Certificate carries a verifiable QR code.

## Key Financial & Tender Advantages
- Access collateral-free credit under CGTMSE bank schemes at lower interest spreads
- Claim Earnest Money Deposit (EMD) waivers in central and state public procurement tenders
- Register seamlessly as a verified seller on Government e-Marketplace (GeM)
- Enforce 45-day buyer payment protection under MSMED Act Section 43B(h)

## Documents Needed Before Applying
1. Proprietor or Managing Partner Aadhaar linked to mobile OTP
2. Business PAN card and bank account IFSC details
3. Exact 5-digit NIC activity codes covering manufacturing or service operations`,
    category: 'MSME & Udyam',
    tags: ['Udyam Registration', 'MSME', 'GeM Portal', 'Business Loans'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Enterprise Advisory Desk',
    publishedAt: '2026-10-29T09:00:00Z',
    updatedAt: '2026-11-11T14:15:00Z',
    readingTimeMinutes: 4,
    relatedServiceSlug: 'udyam-registration',
    seoTitle: 'Udyam MSME Registration Benefits, NIC Codes & Certificate',
    seoDescription:
      'Understand Udyam MSME classification, collateral-free CGTMSE loans, GeM onboarding, and required Aadhaar/PAN details in 2026.',
    focusKeyword: 'Udyam MSME',
  },
  {
    id: 'blog-gazette-name-change',
    slug: 'official-gazette-name-change-affidavit-newspaper-process-india',
    title: 'Gazette Name Change Process in India: Affidavit, Newspaper & Filing Steps',
    titleHi: 'भारत में राजपत्र (Gazette) नाम परिवर्तन प्रक्रिया और दस्तावेज़',
    excerpt:
      'Everything citizens need to legally change their name, surname, or spelling error through the Department of Publication Central Gazette.',
    excerptHi:
      'नाम या उपनाम में कानूनी बदलाव के लिए एफिडेविट, अखबार विज्ञापन और सेंट्रल गजट फाइलिंग की पूरी प्रक्रिया समझें।',
    content: `## When Do Citizens Need Central Gazette Notification?
Whether you are adopting a married surname, fixing minor passport spelling discrepancies, or updating school marksheet initials, an Official Gazette Notification serves as conclusive legal proof accepted by Passport Seva, UIDAI, and banks.

## Three-Stage Legal Name Change Sequence
1. Execute a notarized Affidavit stating old name, new name, father/husband name, and current address
2. Publish a public notice advertisement in one English and one regional daily newspaper
3. Submit the signed proforma, two witness declarations, CD soft copy, and govt fee challan to the Controller of Publications

## Common Rejections to Prevent
Ensure the old name and new name printed in the newspaper cutting match the notarized affidavit character-for-character before filing the Gazette dossier.`,
    category: 'Certificates & Gazette',
    tags: ['Gazette Name Change', 'Affidavit', 'Legal Documentation', 'Passport Name'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Legal Documentation Counsel',
    publishedAt: '2026-11-02T09:00:00Z',
    updatedAt: '2026-11-12T08:45:00Z',
    readingTimeMinutes: 5,
    relatedServiceSlug: 'gazette-name-change',
    seoTitle: 'Gazette Name Change India — Affidavit & Newspaper Rules',
    seoDescription:
      'Complete legal guide for Gazette name change in India: notarized affidavit format, newspaper ad rules, and Department of Publication steps.',
    focusKeyword: 'Gazette name change',
    faqItems: [
      {
        question: 'Is newspaper publication mandatory for Gazette name change?',
        answer:
          'Yes. Original full-page newspaper clippings carrying the public name-change notice must accompany your Central Gazette submission.',
      },
    ],
  },
  {
    id: 'blog-fssai-food-license',
    slug: 'fssai-food-license-registration-basic-state-central-eligibility',
    title: 'FSSAI Food License Guide: Basic vs State vs Central Eligibility (FoSCoS)',
    titleHi: 'FSSAI फूड लाइसेंस गाइड: बेसिक, स्टेट और सेंट्रल पात्रता',
    excerpt:
      'Compare FSSAI Basic Registration, State License, and Central License thresholds for cloud kitchens, bakeries, restaurants, and packaged food brands.',
    excerptHi:
      'क्लाउड किचन, रेस्तरां, बेकरी और फूड ब्रांड्स के लिए FSSAI बेसिक, स्टेट और सेंट्रल लाइसेंस की पात्रता व दस्तावेज़ जानें।',
    content: `## Choosing the Right FSSAI License Tier
Food businesses operating anywhere in India must display a valid 14-digit FSSAI registration or license number on invoices, Swiggy/Zomato listings, and product labels.

- **Basic Registration (Form A)**: Annual turnover up to ₹12 lakh (petty food retailers, home bakers, small tea/tiffin units)
- **State License (Form B)**: Turnover between ₹12 lakh and ₹20 crore within one state (restaurants, mid-sized cloud kitchens, distributors)
- **Central License**: Turnover above ₹20 crore, multi-state operations, food importers, or airport/railway caterers

## Essential FoSCoS Compliance Documents
1. Photo ID & address proof of proprietor/partners/directors
2. Kitchen premises utility bill and rent agreement / ownership deed
3. Food safety management plan (FSMS) & product category list`,
    category: 'GST & Business',
    tags: ['FSSAI License', 'FoSCoS', 'Cloud Kitchen', 'Food Compliance'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Licensing & Regulatory Advisor',
    publishedAt: '2026-11-05T09:00:00Z',
    updatedAt: '2026-11-12T15:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'fssai-registration',
    seoTitle: 'FSSAI License Types & FoSCoS Document Checklist 2026',
    seoDescription:
      'Check FSSAI Basic, State, and Central license turnover limits, Swiggy/Zomato requirements, and FoSCoS approval documents.',
    focusKeyword: 'FSSAI food license',
  },
  {
    id: 'blog-class3-dsc-digilocker',
    slug: 'class-3-digital-signature-certificate-dsc-tenders-mca-gst',
    title: 'Class 3 Digital Signature (DSC) Explained: e-Tenders, MCA & Income Tax',
    titleHi: 'क्लास 3 डिजिटल सिग्नेचर (DSC): ई-टेंडर, MCA और GST में उपयोग',
    excerpt:
      'How Class 3 DSC tokens with video e-KYC authenticate MCA ROC filings, GST returns, trademark applications, and government e-procurement bids.',
    excerptHi:
      'जानें कि क्लास 3 DSC टोकन से MCA फाइलिंग, GST रिटर्न, ट्रेडमार्क और सरकारी ई-टेंडर डिजिटल हस्ताक्षर कैसे प्रमाणित होते हैं।',
    content: `## Why Class 3 Replaced Class 2 DSC Across India
Controller of Certifying Authorities (CCA) mandates Class 3 Digital Signature Certificates for all statutory filings, offering high-assurance cryptographic validation via FIPS-certified USB tokens.

## Primary Platforms Accepting Class 3 DSC
- MCA V3 portal for company incorporation, DIR-3 KYC, and annual ROC forms
- GeM & Central Public Procurement (CPPP) e-Tendering portals (with Encryption option)
- GST portal corporate filings and Income Tax audit reports
- IP India Trademark & Patent online registrations

## 10-Minute Paperless Video e-KYC Approval
Applicants verify PAN, Aadhaar offline/OTP, and complete a brief live video confirmation to receive immediate DSC approval for 2-year or 3-year validity.`,
    category: 'Partner Guides',
    tags: ['Digital Signature', 'Class 3 DSC', 'e-Tenders', 'MCA V3'],
    status: 'published',
    featured: false,
    authorName: 'Suraj Singh',
    authorRole: 'Enterprise Advisory Desk',
    publishedAt: '2026-11-09T09:00:00Z',
    updatedAt: '2026-11-13T10:00:00Z',
    readingTimeMinutes: 3,
    relatedServiceSlug: 'digital-signature-certificate',
    seoTitle: 'Class 3 Digital Signature (DSC) for MCA, GST & e-Tenders',
    seoDescription:
      'Learn how Class 3 DSC with Encryption works for GeM tenders, MCA ROC compliance, and GST portal authentication via video e-KYC.',
    focusKeyword: 'Class 3 DSC',
  },
];

export const INITIAL_BLOG_POSTS: BlogPost[] = [
  ...CORE_FEATURED_BLOG_POSTS,
  ...AADHAAR_AND_PAN_BLOGS,
  ...VOTER_AND_PASSPORT_BLOGS,
  ...CERTIFICATES_AND_GAZETTE_BLOGS,
  ...BUSINESS_AND_DIGITAL_BLOGS,
  ...STUDENT_VEHICLE_AND_SCHEMES_BLOGS,
];

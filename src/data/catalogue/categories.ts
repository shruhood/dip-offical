import type { ServiceCategory } from '../../types';

/**
 * 8 Primary Catalogue Categories (Cat A - Cat H) + Subcategories
 */
export const CATALOGUE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'personal',
    slug: 'personal',
    name: 'Personal & Citizen Services',
    nameHi: 'व्यक्तिगत एवं नागरिक सेवाएं',
    categoryCode: 'CAT_A',
    displayOrder: 1,
    description:
      'PAN Card, Passport, Voter ID, Driving Licence, State Certificates, Gazette Name Change, and DigiLocker assistance.',
    iconName: 'CreditCard',
    badgeColor: '#FF671F',
    subcategories: [
      'PAN & Identity',
      'Passport & Travel',
      'Voter & Transport',
      'State Certificates',
      'Gazette & Digital Vault',
    ],
    isActive: true,
  },
  {
    id: 'business-registration',
    slug: 'business-registration',
    name: 'Business Registration & Startup',
    nameHi: 'व्यवसाय पंजीकरण एवं स्टार्टअप सेवाएं',
    categoryCode: 'CAT_B',
    displayOrder: 2,
    description:
      'Udyam MSME, GST Registration, Company/LLP Incorporation, Startup India, DSC, FSSAI, IEC, Trademark & NGO Setup.',
    iconName: 'Building2',
    badgeColor: '#138808',
    subcategories: [
      'MSME & GST',
      'Company & Firm Setup',
      'Startup, DSC & Tax IDs',
      'State & Food Licences',
      'IP, GeM & Non-Profits',
    ],
    isActive: true,
  },
  {
    id: 'tax-compliance',
    slug: 'tax-compliance',
    name: 'Taxation & Compliance',
    nameHi: 'कराधान एवं अनुपालन सेवाएं',
    categoryCode: 'CAT_C',
    displayOrder: 3,
    description:
      'Income Tax Return (ITR), GSTR-1/3B & Annual Returns, TDS Filings, Bookkeeping, Payroll, PF/ESIC, and ROC Compliance.',
    iconName: 'Receipt',
    badgeColor: '#0284C7',
    subcategories: [
      'Income Tax (ITR)',
      'GST Returns & Notices',
      'TDS & Accounting',
      'Payroll & Labour Law',
      'ROC & Corporate Filings',
    ],
    isActive: true,
  },
  {
    id: 'education-career',
    slug: 'education-career',
    name: 'Education & Career Services',
    nameHi: 'शिक्षा एवं करियर सहायता सेवाएं',
    categoryCode: 'CAT_D',
    displayOrder: 4,
    description:
      'Admission forms, Scholarship portals, Exam applications, Degree & Marksheet Verification, Resume Drafting, and Job Portals.',
    iconName: 'Award',
    badgeColor: '#7C3AED',
    subcategories: [
      'Admissions & Scholarships',
      'Exams & Academic Docs',
      'Verification Services',
      'Career & Recruitment',
    ],
    isActive: true,
  },
  {
    id: 'documentation',
    slug: 'documentation',
    name: 'Documentation & Legal Support',
    nameHi: 'दस्तावेज़ीकरण एवं कानूनी सहायता',
    categoryCode: 'CAT_E',
    displayOrder: 5,
    description:
      'Drafting support for Affidavits, Rent & Business Agreements, Partnership Deeds, Translation, Notary & Apostille Coordination.',
    iconName: 'ScrollText',
    badgeColor: '#DC2626',
    subcategories: [
      'Affidavits & Declarations',
      'Agreements & Deeds',
      'Translation & Attestation',
      'Coordination Support',
    ],
    isActive: true,
  },
  {
    id: 'digital-products',
    slug: 'digital-products',
    name: 'Digital Products & Downloads',
    nameHi: 'डिजिटल उत्पाद एवं डाउनलोड टेम्प्लेट्स',
    categoryCode: 'CAT_F',
    displayOrder: 6,
    description:
      'Instant-download Business Invoice templates, GST spreadsheets, Compliance Calendars, Resume packs, and Startup Kits.',
    iconName: 'FileSpreadsheet',
    badgeColor: '#059669',
    subcategories: [
      'Billing & Letterheads',
      'Excel & Tax Spreadsheets',
      'Checklists & Workbooks',
      'Career Templates',
      'Starter Bundles',
    ],
    isActive: true,
  },
  {
    id: 'digital-technology',
    slug: 'digital-technology',
    name: 'Digital & Technology Services',
    nameHi: 'डिजिटल एवं टेक्नोलॉजी सेवाएं',
    categoryCode: 'CAT_G',
    displayOrder: 7,
    description:
      'Business & E-commerce Websites, Domain & Hosting, WhatsApp Automation, AI Chatbots, CRM, SEO, and Custom Software.',
    iconName: 'Globe',
    badgeColor: '#4F46E5',
    subcategories: [
      'Websites & Stores',
      'Domains, Email & Hosting',
      'Automation & Chatbots',
      'Marketing & SEO',
      'Custom Engineering & APIs',
    ],
    isActive: true,
  },
  {
    id: 'b2b-partner',
    slug: 'b2b-partner',
    name: 'B2B, Partner & Reseller Services',
    nameHi: 'बी2बी, पार्टनर एवं रीसेलर सेवाएं',
    categoryCode: 'CAT_H',
    displayOrder: 8,
    description:
      'PAN/DSC/GST Partner Onboarding, Bulk Document Processing, Authorized API Verification, White-Label & Referral Program.',
    iconName: 'ShieldCheck',
    badgeColor: '#334155',
    subcategories: [
      'Partner Onboarding',
      'Bulk & API Verification',
      'White-Label & Tools',
      'Referral & Fulfilment',
    ],
    isActive: true,
  },
];

/**
 * Maps legacy category slugs (from v1) & friendly aliases to canonical 8 categories
 */
export const CATEGORY_SLUG_ALIASES: Record<string, string> = {
  'pan-identity': 'personal',
  'digilocker-docs': 'personal',
  'transport-services': 'personal',
  'govt-schemes': 'personal',
  'business-reg': 'business-registration',
  'business-services': 'business-registration',
  'taxation-compliance': 'tax-compliance',
  'tax-and-compliance': 'tax-compliance',
  'education-employment': 'education-career',
  'documentation-services': 'documentation',
  'b2b-enterprise': 'b2b-partner',
  'b2b-partners': 'b2b-partner',
  'technology-services': 'digital-technology',
};

export function resolveCategorySlug(raw?: string | null): string {
  const clean = String(raw || 'all').trim().toLowerCase();
  if (!clean || clean === 'all') return 'all';
  if (clean === 'packages' || clean === 'service-packages') return 'packages';
  return CATEGORY_SLUG_ALIASES[clean] || clean;
}

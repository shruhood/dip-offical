export interface TargetLocationConfig {
  slug: string;
  name: string;
  regionTitle: string;
  stateOrUt: string;
  headline: string;
  summary: string;
  industrialAndCitizenFocus: string[];
  highlightedServiceSlugs: string[];
  localOfficeNote: string;
  seoTitle: string;
  seoDescription: string;
}

export const TARGET_LOCATIONS: TargetLocationConfig[] = [
  {
    slug: 'silvassa',
    name: 'Silvassa',
    regionTitle: 'Silvassa (Head Office Desk)',
    stateOrUt: 'Dadra and Nagar Haveli and Daman and Diu',
    headline: 'Online Business, Tax & Citizen Documentation Services in Silvassa',
    summary:
      'Headquartered at Sunflower Building, Nano City, Samarvani, Silvassa (396230), Digital India Project provides transparent PAN, GST, Udyam MSME, Factory/Trade compliance, ITR, Gazette, and digital automation services for residents and industrial units in Silvassa.',
    industrialAndCitizenFocus: [
      'Silvassa GIDC / Piparia / Amli industrial unit GST, PF/ESIC & FSSAI compliance',
      'Personal PAN, Passport, Domicile, Income & Gazette name change documentation',
      'Dedicated digital storefronts, WhatsApp automation & downloadable business spreadsheets',
    ],
    highlightedServiceSlugs: ['pan-card', 'gst-registration', 'udyam-registration', 'trade-licence-assistance', 'income-tax-return-itr-1', 'gazette-name-change'],
    localOfficeNote: 'Head Office Desk: Sunflower Building, Nano City, Samarvani, Silvassa – 396230 (Mon–Sat, 9:30 AM – 6:30 PM)',
    seoTitle: 'Online Citizen, Business & Tax Services in Silvassa | Digital India Project',
    seoDescription:
      'Trusted online documentation, GST, Udyam MSME, PAN Card, ITR filing, Gazette name change, and website solutions in Silvassa (396230).',
  },
  {
    slug: 'dadra-nagar-haveli',
    name: 'Dadra & Nagar Haveli',
    regionTitle: 'Dadra & Nagar Haveli District',
    stateOrUt: 'Dadra and Nagar Haveli and Daman and Diu (UT)',
    headline: 'Digital Citizen, MSME & Compliance Support Across Dadra & Nagar Haveli',
    summary:
      'Serving Naroli, Rakholi, Khanvel, Dadra, Masat, and Silvassa with structured online filing, certificate guidance, MSME registration, and B2B verification workflows.',
    industrialAndCitizenFocus: [
      'Rural & urban citizen PAN, Voter ID, Driving Licence & scholarship form assistance',
      'MSME, Partnership, Pvt Ltd & Startup India registration across DNH industrial zones',
      'Verified notary/affidavit drafting coordination and document translation support',
    ],
    highlightedServiceSlugs: ['udyam-registration', 'domicile-certificate-assistance', 'fssai-basic-registration', 'tds-return-filing', 'scholarship-application-assistance'],
    localOfficeNote: 'Serving all DNH patelats & industrial estates from Samarvani, Silvassa HQ & partner kiosks.',
    seoTitle: 'Online Documentation, MSME & Tax Services in Dadra & Nagar Haveli',
    seoDescription:
      'Complete online documentation, Udyam MSME, GST, ITR, Domicile/Income certificate guidance across Dadra and Nagar Haveli.',
  },
  {
    slug: 'daman',
    name: 'Daman',
    regionTitle: 'Nani Daman & Moti Daman',
    stateOrUt: 'Dadra and Nagar Haveli and Daman and Diu (UT)',
    headline: 'GST, Hospitality FSSAI, Passport & Business Compliance Services in Daman',
    summary:
      'Supporting Daman manufacturers, Somnath/Dabhel industrial estates, hotels, and residents with FSSAI food licences, GST filings, Import Export Code (IEC), trademarks, and citizen ID services.',
    industrialAndCitizenFocus: [
      'Hospitality, restaurant & packaged food FSSAI Basic/State/Central licences',
      'Export/import units needing IEC, Trademark registration & monthly GST compliance',
      'Citizen Passport assistance, marriage certificates & Gazette updates',
    ],
    highlightedServiceSlugs: ['fssai-state-licence', 'import-export-code-iec', 'gst-registration', 'passport-application-assistance', 'business-website-design'],
    localOfficeNote: '100% digital intake + Daman industrial belt coordination from nearby Silvassa headquarters.',
    seoTitle: 'Business Registration, FSSAI, GST & Documentation Services in Daman',
    seoDescription:
      'Apply online for FSSAI licence, GST, IEC, ITR, Passport & Gazette services in Daman with transparent professional pricing.',
  },
  {
    slug: 'vapi',
    name: 'Vapi',
    regionTitle: 'Vapi & GIDC Industrial Hub',
    stateOrUt: 'Gujarat (Valsad District)',
    headline: 'Industrial Compliance, GST, ROC & B2B Digital Services in Vapi',
    summary:
      'Tailored compliance, accounting, payroll, trademark, and automation services for Vapi GIDC chemical, packaging, engineering, and trading enterprises alongside citizen ID services.',
    industrialAndCitizenFocus: [
      'Vapi GIDC Pvt Ltd / LLP incorporation, ROC annual compliance & PF/ESIC returns',
      'GST reconciliation, GST notice drafting support, and monthly bookkeeping retainers',
      'Custom workflow automation, lead CRM & WhatsApp customer support bots for factories',
    ],
    highlightedServiceSlugs: ['private-limited-company-registration', 'gst-reconciliation', 'monthly-payroll-processing', 'pf-registration-compliance', 'whatsapp-automation-setup'],
    localOfficeNote: 'Adjacent to Silvassa (20 min corridor) with online filing & B2B enterprise onboarding.',
    seoTitle: 'GST, Company Registration, Payroll & Compliance Services in Vapi',
    seoDescription:
      'Complete GST, ROC, PF/ESIC, trademark, payroll & business website services for Vapi & GIDC industrial enterprises.',
  },
  {
    slug: 'valsad',
    name: 'Valsad',
    regionTitle: 'Valsad & South Gujarat Corridor',
    stateOrUt: 'Gujarat',
    headline: 'Citizen Services, Student Admissions & SME Tax Compliance in Valsad',
    summary:
      'Providing reliable online admission forms, scholarship renewals, ITR filings, Shop Act registrations, and downloadable accounting spreadsheets to families and SMEs in Valsad.',
    industrialAndCitizenFocus: [
      'University & competitive exam form assistance, resume drafting & degree verification',
      'Shop & Establishment, Udyam MSME, ITR-1 & Business ITR assistance',
      'Instant digital Excel calculators, invoice kits, and startup checklists',
    ],
    highlightedServiceSlugs: ['income-tax-return-itr-1', 'shop-and-establishment-registration', 'university-admission-assistance', 'professional-resume-drafting', 'digital-business-starter-kit'],
    localOfficeNote: 'Pan-Valsad online facilitation backed by multilingual English/Hindi support.',
    seoTitle: 'ITR Filing, Shop Act, Education & Citizen Services in Valsad',
    seoDescription:
      'Online ITR filing, Shop & Establishment, PAN Card, University admission & SME compliance assistance in Valsad.',
  },
  {
    slug: 'umargam',
    name: 'Umargam',
    regionTitle: 'Umargam & Sanjan Corridor',
    stateOrUt: 'Gujarat',
    headline: 'MSME Registration, Trade Licences & Online Citizen Support in Umargam',
    summary:
      'Helping Umargam GIDC enterprises, local traders, students, and partners with Udyam MSME, GST filings, GeM seller onboarding, driving licence assistance, and CSC/B2B partner programs.',
    industrialAndCitizenFocus: [
      'Umargam GIDC Udyam, GeM portal registration & supplier onboarding assistance',
      'Driving licence, voter ID, PAN & income/caste certificate form support',
      'Local Cyber Cafe / CSC B2B Partner onboarding with transparent commissions',
    ],
    highlightedServiceSlugs: ['udyam-registration', 'gem-portal-registration', 'driving-licence-verification', 'pan-partner-onboarding', 'gst-nil-gstr-3b'],
    localOfficeNote: 'Dedicated digital desk supporting Umargam industrial & coastal residential belts.',
    seoTitle: 'MSME, GeM, GST, PAN & Partner Services in Umargam | Digital India Project',
    seoDescription:
      'Online Udyam MSME, GeM seller registration, GST filing, PAN & B2B partner onboarding in Umargam.',
  },
];

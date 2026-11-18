export type PartnerTrackId = 'operator' | 'distributor' | 'b2b';

export interface PartnerChargeRow {
  label: string;
  amount: string;
  note: string;
}

export interface PartnerEarningExample {
  service: string;
  clientFee: string;
  partnerShare: string;
}

export interface PartnerTrackSpec {
  id: PartnerTrackId;
  signupAccountType: 'operator' | 'partner' | 'business';
  title: string;
  titleHi: string;
  tagline: string;
  subtitle: string;
  earningRange: string;
  commissionRate: string;
  commissionPercentMid: number;
  avgOrderValueInr: number;
  monthlyPlatformFeeInr: number;
  registrationFee: string;
  activationCharge: string;
  monthlyToolOption: string;
  settlementCycle: string;
  kycGateLabel: string;
  kycNote: string;
  idealFor: string;
  accentHex: string;
  benefits: string[];
  chargeBreakdown: PartnerChargeRow[];
  earningExamples: PartnerEarningExample[];
  registrationRequirements: {
    eligibility: string[];
    documents: string[];
    approvalSla: string;
  };
}

export interface PlatformFeeScheduleRow {
  id: string;
  item: string;
  applicableTrack: 'All Tracks' | 'Operator' | 'Distributor' | 'B2B Partner';
  feeAmount: string;
  billingCycle: string;
  notes: string;
}

export const PARTNER_TRACKS: PartnerTrackSpec[] = [
  {
    id: 'operator',
    signupAccountType: 'operator',
    title: 'Authorized Center Operator',
    titleHi: 'अधिकृत केंद्र ऑपरेटर (CSC / डिजिटल केंद्र)',
    tagline: 'Walk-in Digital Facilitation Desk',
    subtitle:
      'Operate a local citizen digital service desk with walk-in intake mode, built-in photo/PDF tools, instant payment receipts, and unified application tracking.',
    earningRange: '₹22,000 – ₹65,000 / mo',
    commissionRate: '15% – 30% Facilitation Share',
    commissionPercentMid: 24,
    avgOrderValueInr: 750,
    monthlyPlatformFeeInr: 0,
    registrationFee: '₹0 Base Signup',
    activationCharge: '₹999 One-Time KYC & Desk Activation',
    monthlyToolOption: '₹0 Base Portal (Optional Tool Pro ₹299/mo)',
    settlementCycle: 'T+1 / Weekly Wallet Payout',
    kycGateLabel: 'Operator KYC Portal',
    kycNote:
      'PAN Card, Masked Aadhaar / Address Proof, Center Photograph & Cancelled Cheque verification required via Operator KYC after signup.',
    idealFor: 'Cyber cafes, CSC VLEs, Jan Seva Kendras, tax practitioners & local consultancy shops',
    accentHex: '#138808',
    benefits: [
      'Dedicated Operator Field Desk with walk-in intake mode and instant Cashfree or desk receipts',
      'Access to 149+ Citizen, PAN, GST, Udyam MSME, FSSAI & Gazette workflows under one login',
      'Built-in CSC Passport Photo Studio, 20–50KB Signature Resizer & PDF KYC Pack utilities',
      'Automated 14-stage tracking link generated for every walk-in citizen application',
      'Priority operator escalation desk with zero upfront working-capital lock-in',
    ],
    chargeBreakdown: [
      {
        label: 'Account Registration',
        amount: '₹0',
        note: 'Free profile creation with email or Google authentication',
      },
      {
        label: 'Center Verification & KYC Onboarding',
        amount: '₹999',
        note: 'One-time compliance verification & Operator Desk activation',
      },
      {
        label: 'Monthly Desk Maintenance',
        amount: '₹0 Base',
        note: 'Pay per processed filing; optional CSC Tool Pro add-on at ₹299/mo',
      },
    ],
    earningExamples: [
      {
        service: 'PAN Card / Correction Desk Filing',
        clientFee: '₹249 + Govt Fee',
        partnerShare: '₹60 – ₹90 per filing',
      },
      {
        service: 'Udyam MSME & Shop Act Bundle',
        clientFee: '₹999',
        partnerShare: '₹250 – ₹300 per filing',
      },
      {
        service: 'GST Registration & Setup',
        clientFee: '₹1,499',
        partnerShare: '₹350 – ₹450 per filing',
      },
    ],
    registrationRequirements: {
      eligibility: [
        'Indian resident aged 18+ with an active physical service desk, cyber cafe, or facilitation office',
        'Functional computer/smartphone, scanner/printer access, and reliable internet connection',
        'Active Indian savings or current bank account in applicant or firm name for T+1/weekly payouts',
      ],
      documents: [
        'Individual PAN Card (mandatory for commission TDS compliance)',
        'Masked Aadhaar Card (last 4 digits visible) or valid local address proof',
        'Clear photograph of the operating center / facilitation desk',
        'Cancelled Cheque or Bank Passbook front page showing IFSC code',
      ],
      approvalSla: '24 – 48 Working Hours via Admin KYC Desk',
    },
  },
  {
    id: 'distributor',
    signupAccountType: 'partner',
    title: 'Distributor & Referral Partner',
    titleHi: 'डिस्ट्रीब्यूटर और रेफरल पार्टनर',
    tagline: 'Territory Network & Assisted Lead Attribution',
    subtitle:
      'Build a district or state referral and assisted-filing network with automated attribution links, transparent commission ledgers, and multi-tier payouts.',
    earningRange: '₹35,000 – ₹1,25,000+ / mo',
    commissionRate: '18% – 35% Territory & Referral Margin',
    commissionPercentMid: 26,
    avgOrderValueInr: 1800,
    monthlyPlatformFeeInr: 0,
    registrationFee: '₹0 Starter Referral',
    activationCharge: '₹1,999 Authorized Territory Pack (Optional ₹0 Free Starter)',
    monthlyToolOption: '₹0 Recurring Minimum (Optional CRM ₹499/mo)',
    settlementCycle: 'Weekly Direct Bank IMPS/NEFT',
    kycGateLabel: 'Partner Onboarding Profile & Bank Verification',
    kycNote:
      'PAN Card, Territory Details & Bank IFSC verification required inside Partner Portal before bank settlement.',
    idealFor: 'District coordinators, CA/CS firms, business coaches, financial advisors & fintech DSAs',
    accentHex: '#FF671F',
    benefits: [
      'Unique referral tracking code & automated commission attribution across all 149+ services',
      'Assisted Customer CRM tab to submit and monitor filings on behalf of clients nationwide',
      'Real-time Commission Ledger tracking gross fees, 5% TDS deductions, and settled net payouts',
      'Volume slab incentives on startup incorporation bundles, GST retainers, and digital kits',
      'Zero delivery overhead — backend filing SLAs and client documentation checks handled centrally',
    ],
    chargeBreakdown: [
      {
        label: 'Starter Referral Partner Account',
        amount: '₹0',
        note: 'Instant referral code & standard 10% – 18% eligible fee commission',
      },
      {
        label: 'Authorized Territory Distributor Pack',
        amount: '₹1,999',
        note: 'One-time territory kit, higher 18% – 35% slab & priority weekly payouts',
      },
      {
        label: 'Statutory TDS on Commission Payouts',
        amount: '5% u/s 194H',
        note: 'Deducted transparently in Commission Ledger with Form 16A summary',
      },
    ],
    earningExamples: [
      {
        service: 'Private Limited / LLP Startup Launch',
        clientFee: '₹6,999',
        partnerShare: '₹1,400 – ₹2,100 per client',
      },
      {
        service: 'Trademark / FSSAI State Licence',
        clientFee: '₹2,999',
        partnerShare: '₹650 – ₹950 per filing',
      },
      {
        service: 'Annual ITR & GST Retainer Referral',
        clientFee: '₹4,999',
        partnerShare: '₹1,000 – ₹1,500 recurring',
      },
    ],
    registrationRequirements: {
      eligibility: [
        'Individual consultant, CA/CS/tax advisor, DSA, or regional coordinator aged 18+',
        'Consent-first client onboarding commitment prior to submitting assisted citizen applications',
        'Verified active Indian bank account capable of receiving IMPS/NEFT settlements',
      ],
      documents: [
        'PAN Card (Individual or Proprietary/Firm PAN)',
        'Masked Aadhaar / Office Address Proof for state & district mapping',
        'Bank Account Number & IFSC Code for commission ledger settlements',
        'Firm / Practice Name (if registering as a Franchise or Corporate Connector)',
      ],
      approvalSla: 'Same Day Starter Code · 24 – 48 Hours Full Approval',
    },
  },
  {
    id: 'b2b',
    signupAccountType: 'business',
    title: 'B2B Enterprise & API Partner',
    titleHi: 'B2B एंटरप्राइज़ और API पार्टनर',
    tagline: 'Bulk Verification Pipelines & Corporate Compliance',
    subtitle:
      'Embed consent-based GSTIN, PAN, and Udyam verification pipelines alongside wholesale corporate compliance execution directly inside your ERP or SaaS product.',
    earningRange: 'Up to 40% Wholesale Margin',
    commissionRate: 'Volume API & Bulk Wholesale Pricing',
    commissionPercentMid: 35,
    avgOrderValueInr: 2800,
    monthlyPlatformFeeInr: 999,
    registrationFee: '₹0 Sandbox API',
    activationCharge: '₹4,999 Enterprise KYB (Includes ₹2,500 API Credits)',
    monthlyToolOption: 'From ₹2–₹5 / API verification or ₹999/mo Tracking API',
    settlementCycle: 'Prepaid Credit Ledger / Monthly 18% GST Invoice',
    kycGateLabel: 'Partner & B2B Corporate KYB Portal',
    kycNote:
      'Corporate PAN, GSTIN, Registered Address & Authorized Signatory KYB required inside B2B Console before live production API keys unlock.',
    idealFor: 'SaaS platforms, NBFCs, fintech apps, HR/vendor onboarding teams & enterprise accounting desks',
    accentHex: '#2563EB',
    benefits: [
      'REST API Playground & rotated Production/Sandbox API keys for instant registry verifications',
      'CSV Bulk Verification engine for GSTIN, PAN, DL & MSME vendor checks in minutes',
      'Multi-seat Enterprise Team RBAC (Admin, Member, Viewer) with immutable audit logs',
      'Webhook callbacks and downloadable compliance summary reports with 18% GST tax invoices',
      'Wholesale B2B pricing on bulk startup registrations, Class-3 DSCs, and monthly filings',
    ],
    chargeBreakdown: [
      {
        label: 'Sandbox Testing & API Playground',
        amount: '₹0',
        note: 'Inspect schemas and run test requests right after business signup',
      },
      {
        label: 'Enterprise KYB & Production Key Setup',
        amount: '₹4,999',
        note: 'One-time corporate KYB activation; includes ₹2,500 starter API credits',
      },
      {
        label: 'Per-Call / Per-Application Rates',
        amount: '₹5/verify · ₹499/app',
        note: 'Bulk Document Processing at ₹20/doc; volume slabs from ₹2/call at 5,000+ calls',
      },
    ],
    earningExamples: [
      {
        service: 'Bulk Vendor GSTIN + PAN Onboarding',
        clientFee: 'Custom SaaS Plan',
        partnerShare: 'Save ₹15 – ₹40 per vendor check',
      },
      {
        service: 'White-Label Startup Setup Orders (10+/mo)',
        clientFee: 'Wholesale B2B Rate',
        partnerShare: '30% – 40% fulfillment margin',
      },
      {
        service: 'Application Tracking Webhook API',
        clientFee: '₹999 / month',
        partnerShare: 'Embedded status inside your CRM',
      },
    ],
    registrationRequirements: {
      eligibility: [
        'Registered Private Limited, LLP, Partnership, Proprietorship, or Trust/Society in India',
        'Valid Corporate PAN and GSTIN (or Udyam/Certificate of Incorporation for early startups)',
        'Authorized Signatory KYC + Technical Webhook URL (optional for async status callbacks)',
      ],
      documents: [
        'Entity PAN Card & Active 15-Digit GSTIN Certificate',
        'Certificate of Incorporation / Partnership Deed / Udyam Registration Proof',
        'Registered Business Office Address & Official Contact Details',
        'Authorized Signatory PAN & Identity Verification for Production API Key issuance',
      ],
      approvalSla: '24 – 48 Hours Corporate KYB & Production Key Issuance',
    },
  },
];

export const PLATFORM_FEE_SCHEDULE: PlatformFeeScheduleRow[] = [
  {
    id: 'fee-base-reg',
    item: 'Partner Account Registration',
    applicableTrack: 'All Tracks',
    feeAmount: '₹0 (Free)',
    billingCycle: 'One-Time',
    notes: 'Baseline account signup and starter referral attribution without upfront lock-in.',
  },
  {
    id: 'fee-op-kyc',
    item: 'Authorized PAN / DSC / GST Desk Onboarding',
    applicableTrack: 'Operator',
    feeAmount: '₹999',
    billingCycle: 'One-Time Activation',
    notes: 'Includes center KYC verification, operator desk provisioning, and receipt branding.',
  },
  {
    id: 'fee-dist-pack',
    item: 'Territory Distributor Onboarding Pack',
    applicableTrack: 'Distributor',
    feeAmount: '₹1,999',
    billingCycle: 'One-Time Optional',
    notes: 'Unlocks 18% – 35% higher slab commissions and priority weekly bank settlements.',
  },
  {
    id: 'fee-b2b-kyb',
    item: 'Enterprise KYB & Live API Key Setup',
    applicableTrack: 'B2B Partner',
    feeAmount: '₹4,999',
    billingCycle: 'One-Time (incl. ₹2,500 credits)',
    notes: 'Covers corporate KYB verification, production key rotation, and webhook provisioning.',
  },
  {
    id: 'fee-partner-crm',
    item: 'Managed Partner Dashboard Access',
    applicableTrack: 'Distributor',
    feeAmount: '₹499',
    billingCycle: 'Per Month (Optional)',
    notes: 'Multi-client CRM, consent archive, and downloadable TDS ledger statements.',
  },
  {
    id: 'fee-tool-pro',
    item: 'CSC Tool Pro Utility Suite',
    applicableTrack: 'Operator',
    feeAmount: '₹299',
    billingCycle: 'Per Month (Optional)',
    notes: 'Unlimited AI Document Studio, passport photo crops, PDF merging & bill receipts.',
  },
  {
    id: 'fee-b2b-fulfil',
    item: 'Business Registration Fulfilment / White-Label',
    applicableTrack: 'B2B Partner',
    feeAmount: '₹499 / app · ₹2,999 setup',
    billingCycle: 'Per Application / Setup',
    notes: 'Backend SLA execution for MSME, GST, FSSAI, and incorporation cases.',
  },
  {
    id: 'fee-bulk-api',
    item: 'Bulk Document Processing & API Verification',
    applicableTrack: 'B2B Partner',
    feeAmount: '₹20 / doc · ₹5 / verify',
    billingCycle: 'Usage-Based (Volume from ₹2)',
    notes: 'Tracking Webhook API available at ₹999/month; 18% GST tax invoice issued.',
  },
];

export interface EarningsEstimateResult {
  trackId: PartnerTrackId;
  monthlyVolume: number;
  grossClientFeesInr: number;
  commissionRatePercent: number;
  grossPartnerShareInr: number;
  estimatedPlatformFeeInr: number;
  estimatedTdsInr: number;
  netEstimatedEarningsInr: number;
}

export function estimatePartnerEarnings(
  trackId: PartnerTrackId,
  monthlyVolumeInput: number
): EarningsEstimateResult {
  const track = PARTNER_TRACKS.find((t) => t.id === trackId) || PARTNER_TRACKS[0];
  const monthlyVolume = Math.max(1, Math.min(500, Math.round(monthlyVolumeInput || 1)));
  const grossClientFeesInr = monthlyVolume * track.avgOrderValueInr;
  const grossPartnerShareInr = Math.round(
    grossClientFeesInr * (track.commissionPercentMid / 100)
  );
  const estimatedPlatformFeeInr = track.monthlyPlatformFeeInr;
  // Standard 5% TDS applies on commission payouts once monthly share passes starter volume
  const estimatedTdsInr = trackId === 'b2b' ? 0 : Math.round(grossPartnerShareInr * 0.05);
  const netEstimatedEarningsInr = Math.max(
    0,
    grossPartnerShareInr - estimatedPlatformFeeInr - estimatedTdsInr
  );

  return {
    trackId: track.id,
    monthlyVolume,
    grossClientFeesInr,
    commissionRatePercent: track.commissionPercentMid,
    grossPartnerShareInr,
    estimatedPlatformFeeInr,
    estimatedTdsInr,
    netEstimatedEarningsInr,
  };
}

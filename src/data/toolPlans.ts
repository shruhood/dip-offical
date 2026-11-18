import type { PricingTier } from '../types/tool';

export type ToolPlanCode = 'free' | 'personal' | 'csc' | 'professional' | 'enterprise';

export interface ToolPlanDefinition {
  code: ToolPlanCode;
  name: string;
  nameHi: string;
  audience: string;
  audienceHi: string;
  priceMonthlyInr: number | null;
  priceAnnualInr: number | null;
  priceMonthlyUsd: number | null;
  dailyJobLimit: number | null; // null = unlimited
  maxFileSizeMb: number;
  monthlyAiCredits: number;
  highlights: string[];
  limits: {
    dailyJobs: string;
    maxFileSize: string;
    aiCredits: string;
    cscDashboard: string;
  };
  accentBadge: string;
  cardClass: string;
  borderClass: string;
  buttonClass: string;
}

export const TOOL_SINGLE_USE_PRICE_INR = 10;

export const TOOL_PAY_PER_USE_OPTION = {
  code: 'single_use' as const,
  name: '1-Time Use Pass',
  nameHi: '1-बार उपयोग पास',
  priceInr: TOOL_SINGLE_USE_PRICE_INR,
  maxFileSizeMb: 150,
  summary:
    'Unlock any paid Pro, CSC Operator, or AI tool for 1 complete run at ₹10 without committing to a monthly plan.',
  summaryHi:
    'बिना मासिक प्लान लिए किसी भी पेड Pro, CSC या AI टूल को मात्र ₹10 में 1 बार उपयोग करें।',
};

export function getToolSingleUsePriceInr(tool: {
  tier: PricingTier;
  singleUsePriceInr?: number;
}): number {
  if (tool.tier === 'free') return 0;
  return typeof tool.singleUsePriceInr === 'number' && tool.singleUsePriceInr > 0
    ? tool.singleUsePriceInr
    : TOOL_SINGLE_USE_PRICE_INR;
}

export const TOOL_SUBSCRIPTION_PLANS: ToolPlanDefinition[] = [
  {
    code: 'free',
    name: 'Free Starter',
    nameHi: 'फ्री प्लान',
    audience: 'For citizens & students',
    audienceHi: 'नागरिकों व छात्रों के लिए',
    priceMonthlyInr: 0,
    priceAnnualInr: 0,
    priceMonthlyUsd: 0,
    dailyJobLimit: 25,
    maxFileSizeMb: 25,
    monthlyAiCredits: 10,
    highlights: [
      '135+ browser-based PDF, image, QR & calculator tools',
      'Up to 25 MB per file processed locally in browser',
      '10 AI assistant runs per month',
      'Zero login required for standard utilities',
    ],
    limits: {
      dailyJobs: '25 jobs / day',
      maxFileSize: '25 MB',
      aiCredits: '10 / month',
      cscDashboard: 'Not included',
    },
    accentBadge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    cardClass:
      'bg-gradient-to-br from-slate-50/90 via-white to-sky-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950',
    borderClass: 'border-slate-200 dark:border-slate-700',
    buttonClass:
      'bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white',
  },
  {
    code: 'personal',
    name: 'Personal Pro',
    nameHi: 'पर्सनल प्रो',
    audience: 'For frequent job applicants & freelancers',
    audienceHi: 'आवेदकों व फ्रीलांसरों के लिए',
    priceMonthlyInr: 99,
    priceAnnualInr: 990,
    priceMonthlyUsd: 3,
    dailyJobLimit: 200,
    maxFileSizeMb: 100,
    monthlyAiCredits: 100,
    highlights: [
      'Unlocks Personal-tier OCR & searchable PDF engines',
      'Higher 200 jobs/day limit & 100 MB file ceiling',
      'Saved tool favourites & processing history',
      '100 monthly AI & OCR credits',
    ],
    limits: {
      dailyJobs: '200 jobs / day',
      maxFileSize: '100 MB',
      aiCredits: '100 / month',
      cscDashboard: 'Not included',
    },
    accentBadge: 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300',
    cardClass:
      'bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/60 dark:from-sky-950/35 dark:via-slate-900 dark:to-slate-950',
    borderClass: 'border-sky-300 dark:border-sky-800',
    buttonClass: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
  {
    code: 'csc',
    name: 'CSC Operator',
    nameHi: 'CSC ऑपरेटर',
    audience: 'For Digital Seva Kendras & cyber cafés',
    audienceHi: 'जन सेवा केंद्र व साइबर कैफे के लिए',
    priceMonthlyInr: 299,
    priceAnnualInr: 2990,
    priceMonthlyUsd: 7,
    dailyJobLimit: null,
    maxFileSizeMb: 150,
    monthlyAiCredits: 300,
    highlights: [
      'Unlimited browser jobs + 4x6 & A4 passport photo print sheets',
      'Unlocks CSC batch tools, receipts & signature studio',
      'Custom centre branding on invoices & service bills',
      '300 monthly AI & regional OCR credits',
    ],
    limits: {
      dailyJobs: 'Unlimited browser jobs',
      maxFileSize: '150 MB',
      aiCredits: '300 / month',
      cscDashboard: 'Included (1 Centre)',
    },
    accentBadge: 'bg-orange-100 text-[#E55B1B] dark:bg-orange-950/70 dark:text-orange-300',
    cardClass:
      'bg-gradient-to-br from-orange-50/95 via-amber-50/50 to-white dark:from-orange-950/40 dark:via-slate-900 dark:to-slate-950',
    borderClass: 'border-[#FF671F] ring-1 ring-[#FF671F]/25',
    buttonClass: 'bg-[#FF671F] hover:bg-[#E55B1B] text-white',
  },
  {
    code: 'professional',
    name: 'Professional',
    nameHi: 'प्रोफेशनल',
    audience: 'For accountants, print shops & agencies',
    audienceHi: 'चार्टर्ड अकाउंटेंट व एजेंसियों के लिए',
    priceMonthlyInr: 699,
    priceAnnualInr: 6990,
    priceMonthlyUsd: 15,
    dailyJobLimit: null,
    maxFileSizeMb: 250,
    monthlyAiCredits: 1200,
    highlights: [
      '1,200 monthly AI invoice extraction & document credits',
      'Priority batch conversions & multi-format exports',
      'Multi-staff CSC workspace support',
      'Full GST billing & letterhead templates',
    ],
    limits: {
      dailyJobs: 'Unlimited',
      maxFileSize: '250 MB',
      aiCredits: '1,200 / month',
      cscDashboard: 'Included (Up to 5 Staff)',
    },
    accentBadge: 'bg-emerald-100 text-[#138808] dark:bg-emerald-950/70 dark:text-emerald-300',
    cardClass:
      'bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60 dark:from-emerald-950/35 dark:via-slate-900 dark:to-slate-950',
    borderClass: 'border-emerald-300 dark:border-emerald-800',
    buttonClass: 'bg-[#138808] hover:bg-emerald-700 text-white',
  },
  {
    code: 'enterprise',
    name: 'Enterprise SLA',
    nameHi: 'एंटरप्राइज SLA',
    audience: 'For multi-branch networks & institutions',
    audienceHi: 'मल्टी-ब्रांच संस्थानों के लिए',
    priceMonthlyInr: null,
    priceAnnualInr: null,
    priceMonthlyUsd: null,
    dailyJobLimit: null,
    maxFileSizeMb: 500,
    monthlyAiCredits: 9999,
    highlights: [
      'Multi-branch tenant administration & RBAC',
      'Dedicated API keys & webhook integrations',
      'Custom white-label deployment options',
      'Dedicated SLA support from Digital India Project',
    ],
    limits: {
      dailyJobs: 'Custom SLA',
      maxFileSize: '500 MB+',
      aiCredits: 'Custom Pool',
      cscDashboard: 'Multi-Branch',
    },
    accentBadge: 'bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-300',
    cardClass:
      'bg-gradient-to-br from-violet-50/90 via-white to-purple-50/60 dark:from-violet-950/35 dark:via-slate-900 dark:to-slate-950',
    borderClass: 'border-violet-300 dark:border-violet-800',
    buttonClass: 'bg-violet-700 hover:bg-violet-800 text-white',
  },
];

const PLAN_RANK: Record<ToolPlanCode, number> = {
  free: 0,
  personal: 1,
  csc: 2,
  professional: 3,
  enterprise: 4,
};

const TIER_REQUIRED_RANK: Record<PricingTier, number> = {
  free: 0,
  personal: 1,
  csc: 2,
  professional: 3,
};

export function getPlanDefinition(code?: string | null): ToolPlanDefinition {
  return (
    TOOL_SUBSCRIPTION_PLANS.find((p) => p.code === code) || TOOL_SUBSCRIPTION_PLANS[0]
  );
}

export function hasPlanAccessForTier(
  userPlan: ToolPlanCode,
  requiredTier: PricingTier
): boolean {
  if (requiredTier === 'free') return true;
  return (PLAN_RANK[userPlan] ?? 0) >= (TIER_REQUIRED_RANK[requiredTier] ?? 0);
}

export function getRequiredPlanForTier(requiredTier: PricingTier): ToolPlanDefinition {
  return (
    TOOL_SUBSCRIPTION_PLANS.find((p) => p.code === requiredTier) ||
    TOOL_SUBSCRIPTION_PLANS[1]
  );
}

export interface ToolAccessEvaluation {
  allowed: boolean;
  accessMode?: 'plan' | 'single_use_pass';
  reason?: 'tier' | 'daily_limit' | 'ai_credits';
  requiredPlan?: ToolPlanDefinition;
  singleUsePriceInr: number;
  remainingPasses: number;
}

export function evaluateToolAccess(params: {
  tool: {
    tier: PricingTier;
    singleUsePriceInr?: number;
    isAiPowered?: boolean;
  };
  userPlan: ToolPlanCode;
  dailyJobsUsed: number;
  creditsRemaining: number;
  singleUsePassesRemaining?: number;
}): ToolAccessEvaluation {
  const {
    tool,
    userPlan,
    dailyJobsUsed,
    creditsRemaining,
    singleUsePassesRemaining = 0,
  } = params;

  const planDef = getPlanDefinition(userPlan);
  const singleUsePriceInr = getToolSingleUsePriceInr(tool) || TOOL_SINGLE_USE_PRICE_INR;
  const remainingPasses = Math.max(0, Math.floor(singleUsePassesRemaining));

  let blockedReason: 'tier' | 'daily_limit' | 'ai_credits' | undefined;
  let requiredPlan: ToolPlanDefinition | undefined;

  if (!hasPlanAccessForTier(userPlan, tool.tier)) {
    blockedReason = 'tier';
    requiredPlan = getRequiredPlanForTier(tool.tier);
  } else if (planDef.dailyJobLimit !== null && dailyJobsUsed >= planDef.dailyJobLimit) {
    blockedReason = 'daily_limit';
    requiredPlan = getPlanDefinition('personal');
  } else if (tool.isAiPowered && creditsRemaining <= 0) {
    blockedReason = 'ai_credits';
    requiredPlan = getPlanDefinition(userPlan === 'free' ? 'personal' : 'csc');
  }

  if (!blockedReason) {
    return {
      allowed: true,
      accessMode: 'plan',
      singleUsePriceInr,
      remainingPasses,
    };
  }

  if (remainingPasses > 0) {
    return {
      allowed: true,
      accessMode: 'single_use_pass',
      singleUsePriceInr,
      remainingPasses,
    };
  }

  return {
    allowed: false,
    reason: blockedReason,
    requiredPlan,
    singleUsePriceInr,
    remainingPasses: 0,
  };
}

export interface DocumentChecklistTemplate {
  id: string;
  title: string;
  department: string;
  items: { doc: string; notes: string; required: boolean }[];
}

export const DOCUMENT_CHECKLISTS: DocumentChecklistTemplate[] = [
  {
    id: 'new-pan',
    title: 'New PAN Card Application (Form 49A)',
    department: 'Income Tax / NSDL / UTIITSL',
    items: [
      { doc: 'Proof of Identity (Aadhaar / Voter ID / Passport)', notes: 'Self-attested clear copy', required: true },
      { doc: 'Proof of Address (Aadhaar / Utility Bill / Bank Passbook)', notes: 'Recent within 3 months for bills', required: true },
      { doc: 'Proof of Date of Birth (Birth Certificate / 10th Marksheet / Aadhaar)', notes: 'DOB must match application', required: true },
      { doc: '2 Passport Size Color Photographs (35×25 mm / 213×213 px)', notes: 'White background, 300 DPI, < 30 KB', required: true },
      { doc: 'Applicant Signature Scan (Black Ink on White Paper)', notes: '10–20 KB JPEG', required: true },
    ],
  },
  {
    id: 'passport-fresh',
    title: 'Fresh Indian Passport Application',
    department: 'Passport Seva (MEA)',
    items: [
      { doc: 'Address Proof (Aadhaar / Electricity Bill / Registered Rent Agreement)', notes: 'Original + 1 self-attested copy at PSK', required: true },
      { doc: 'Date of Birth Proof (Birth Certificate / Matriculation Certificate)', notes: 'Mandatory for applicants born on/after 26-01-1989', required: true },
      { doc: 'Non-ECR Eligibility Proof (10th / 12th / Degree Certificate)', notes: 'Optional if applying under ECR category', required: false },
      { doc: 'Old Passport (if Re-issue)', notes: 'First two and last two pages photocopy', required: false },
    ],
  },
  {
    id: 'income-certificate',
    title: 'State Income Certificate (आय प्रमाण पत्र)',
    department: 'State e-District / Digital Gujarat / Jan Seva',
    items: [
      { doc: 'Applicant Aadhaar Card & Ration Card Copy', notes: 'Both sides clear scan', required: true },
      { doc: 'Self-Declaration Form (स्व-घोषणा पत्र)', notes: 'Signed by applicant', required: true },
      { doc: 'Salary Slip / Form 16 / Talati or Tehsildar Income Report', notes: 'As per occupation category', required: true },
      { doc: 'Recent Passport Size Photo', notes: '20–50 KB JPG', required: true },
      { doc: 'Electricity Bill or Property Tax Receipt', notes: 'Residence proof', required: false },
    ],
  },
  {
    id: 'caste-certificate',
    title: 'Caste / Community Certificate',
    department: 'State Social Welfare / e-District',
    items: [
      { doc: 'Aadhaar Card & Ration Card', notes: 'Applicant and parent details', required: true },
      { doc: 'School Leaving Certificate (LC) / Bonafide Mentioning Caste', notes: 'Clear readable scan', required: true },
      { doc: 'Father / Paternal Relative Caste Proof or Revenue Record', notes: '7/12, 8A, or old caste certificate', required: true },
      { doc: 'Signed Affidavit & Self-Declaration', notes: 'Witness signatures if required by state', required: true },
    ],
  },
  {
    id: 'driving-licence',
    title: 'Learner / Driving Licence (Parivahan Sarathi)',
    department: 'Ministry of Road Transport (RTO)',
    items: [
      { doc: 'Age & Address Proof (Aadhaar / Passport / Voter ID)', notes: 'PDF under 500 KB', required: true },
      { doc: 'Form 1 (Self-Declaration of Physical Fitness)', notes: 'Form 1A medical certificate if age 40+', required: true },
      { doc: 'Passport Photo & Signature Scan', notes: 'Under 20 KB JPG', required: true },
      { doc: 'Blood Group Details', notes: 'Optional on portal, recommended', required: false },
    ],
  },
];

import {
  ApplicationStatus,
  OperatorKycStatus,
  PartnerApprovalStatus,
  UserRole,
} from '../types';
import { isSuperAdminRole, normalizeRole } from './rbac';

export const CANONICAL_WORKFLOW_STATUSES: ApplicationStatus[] = [
  'Draft',
  'Submitted',
  'Payment Pending',
  'Payment Confirmed',
  'Under Review',
  'Documents Required',
  'Correction Required',
  'Resubmitted',
  'Assigned',
  'Processing',
  'Awaiting External Authority',
  'Completed',
  'Rejected',
  'Cancelled',
];

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  Draft: ['Submitted', 'Payment Pending', 'Cancelled'],
  Submitted: ['Payment Pending', 'Payment Confirmed', 'Under Review', 'Assigned', 'Cancelled'],
  'Payment Pending': ['Payment Confirmed', 'Payment Successful', 'Cancelled'],
  'Payment Confirmed': ['Under Review', 'Assigned', 'Documents Required', 'Correction Required', 'Processing'],
  'Payment Successful': ['Under Review', 'Assigned', 'Documents Required', 'Processing'],
  'Awaiting Payment': ['Payment Confirmed', 'Cancelled'],
  'Under Review': [
    'Assigned',
    'Documents Required',
    'Correction Required',
    'Document Verification',
    'Processing',
    'Application Processing',
    'Rejected',
    'Cancelled',
  ],
  'Document Verification': [
    'Documents Required',
    'Correction Required',
    'Processing',
    'Application Processing',
    'Completed',
    'Rejected',
  ],
  'Documents Required': ['Resubmitted', 'Under Review', 'Cancelled', 'Rejected'],
  'Correction Required': ['Resubmitted', 'Under Review', 'Cancelled', 'Rejected'],
  Resubmitted: ['Under Review', 'Assigned', 'Processing', 'Documents Required', 'Correction Required'],
  Assigned: [
    'Under Review',
    'Documents Required',
    'Correction Required',
    'Processing',
    'Awaiting External Authority',
    'Rejected',
  ],
  Processing: ['Documents Required', 'Correction Required', 'Awaiting External Authority', 'Completed', 'Rejected'],
  'Application Processing': [
    'Documents Required',
    'Correction Required',
    'Awaiting External Authority',
    'Completed',
    'Rejected',
  ],
  'Awaiting External Authority': ['Correction Required', 'Completed', 'Rejected'],
  'Awaiting External Approval': ['Correction Required', 'Completed', 'Rejected'],
  'Submitted to External Authority': ['Awaiting External Authority', 'Completed', 'Rejected'],
  Completed: [],
  Rejected: ['Under Review'],
  Cancelled: [],
};

export interface TransitionValidationResult {
  valid: boolean;
  error?: string;
}

export function validateStatusTransition(params: {
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  actorRole: UserRole;
  reason?: string;
}): TransitionValidationResult {
  const { fromStatus, toStatus, actorRole, reason } = params;
  const role = normalizeRole(actorRole);

  if (fromStatus === toStatus) {
    return { valid: true };
  }

  // Customers & Partners cannot arbitrarily push an application into Processing / Completed / Rejected
  if (role === 'customer' || role === 'business' || role === 'partner') {
    const customerAllowedTargets: Record<string, string[]> = {
      Draft: ['Submitted', 'Payment Pending', 'Cancelled'],
      Submitted: ['Cancelled'],
      'Payment Pending': ['Cancelled'],
      'Documents Required': ['Resubmitted'],
      'Correction Required': ['Resubmitted'],
    };
    const allowedForSelf = customerAllowedTargets[fromStatus] || [];
    if (!allowedForSelf.includes(toStatus)) {
      return {
        valid: false,
        error: `Role "${role}" is not authorized to transition status from "${fromStatus}" to "${toStatus}".`,
      };
    }
    return { valid: true };
  }

  // Staff / Operator / Manager / Super Admin transition check
  if (isSuperAdminRole(role)) {
    // Super Admin can perform any defined transition or recovery transition except bypassing rejection without note
    if ((toStatus === 'Rejected' || toStatus === 'Cancelled') && (!reason || reason.trim().length < 5)) {
      return {
        valid: false,
        error: 'A clear reason (at least 5 characters) is mandatory when rejecting or cancelling an application.',
      };
    }
    return { valid: true };
  }

  const allowedNext = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowedNext.includes(toStatus)) {
    return {
      valid: false,
      error: `Invalid workflow transition: "${fromStatus}" cannot jump directly to "${toStatus}".`,
    };
  }

  if (
    (toStatus === 'Documents Required' ||
      toStatus === 'Correction Required' ||
      toStatus === 'Rejected' ||
      toStatus === 'Cancelled') &&
    (!reason || reason.trim().length < 5)
  ) {
    return {
      valid: false,
      error: `Please provide a customer-facing remark (min 5 chars) explaining why status is set to "${toStatus}".`,
    };
  }

  return { valid: true };
}

export function computeSlaHoursRemaining(submissionOrSlaIso?: string, defaultHours = 72): {
  isOverdue: boolean;
  hoursRemaining: number;
  label: string;
} {
  if (!submissionOrSlaIso) {
    return { isOverdue: false, hoursRemaining: defaultHours, label: `${defaultHours}h target` };
  }
  const targetMs = new Date(submissionOrSlaIso).getTime() + defaultHours * 3600 * 1000;
  const diffHours = Math.round((targetMs - Date.now()) / (3600 * 1000));
  if (diffHours < 0) {
    return { isOverdue: true, hoursRemaining: diffHours, label: `Overdue by ${Math.abs(diffHours)}h` };
  }
  return { isOverdue: false, hoursRemaining: diffHours, label: `${diffHours}h remaining` };
}

export type ProgressStepState = 'done' | 'current' | 'upcoming' | 'attention' | 'halted';

export interface ProgressStepItem {
  key: string;
  label: string;
  state: ProgressStepState;
}

export type KycProgressTone = 'neutral' | 'pending' | 'warning' | 'approved' | 'rejected';

export interface KycProgressInput {
  role?: UserRole;
  accountType?: string;
  userKycStatus?: OperatorKycStatus;
  enrollmentKycStatus?: OperatorKycStatus;
  enrollmentDocsCount?: number;
  verifiedEnrollmentDocsCount?: number;
  enrollmentRemarks?: string;
  partnerStatus?: PartnerApprovalStatus;
  businessId?: string;
  verifiedAppDocsCount?: number;
  totalAppDocsCount?: number;
}

export interface KycProgressResult {
  effectiveStatus: string;
  percent: number;
  stageIndex: number;
  tone: KycProgressTone;
  statusBadgeLabel: string;
  headline: string;
  description: string;
  steps: ProgressStepItem[];
  ctaLabel: string;
  ctaTarget: { type: 'tab'; tab: string } | { type: 'route'; route: string };
}

function buildKycSteps(
  activeIndex: number,
  mode: 'normal' | 'approved' | 'attention' | 'halted'
): ProgressStepItem[] {
  const labels = [
    { key: 'profile', label: 'Profile Ready' },
    { key: 'submitted', label: 'Docs Submitted' },
    { key: 'review', label: 'Pending Review' },
    { key: 'approved', label: 'KYC Approved' },
  ];

  return labels.map((item, idx) => {
    if (mode === 'approved') {
      return { ...item, state: 'done' };
    }
    if (idx < activeIndex) {
      return { ...item, state: 'done' };
    }
    if (idx === activeIndex) {
      if (mode === 'attention') return { ...item, state: 'attention' };
      if (mode === 'halted') return { ...item, state: 'halted' };
      return { ...item, state: 'current' };
    }
    return { ...item, state: 'upcoming' };
  });
}

export function getKycVerificationProgress(input: KycProgressInput): KycProgressResult {
  const accountType = input.accountType || input.role || 'customer';
  const isPartner = input.role === 'partner' || accountType === 'partner';
  const isOperator = input.role === 'operator' || accountType === 'operator';
  const isBusiness = input.role === 'business' || accountType === 'business';
  const isStaffApproved =
    input.role === 'admin' || input.role === 'super_admin' || input.role === 'manager';

  let effectiveStatus: string = 'Not Submitted';

  if (isStaffApproved && !input.enrollmentKycStatus) {
    effectiveStatus = input.userKycStatus && input.userKycStatus !== 'Not Submitted'
      ? input.userKycStatus
      : 'Approved';
  } else if (input.enrollmentKycStatus) {
    effectiveStatus = input.enrollmentKycStatus;
  } else if (input.partnerStatus && input.partnerStatus !== 'Not Submitted') {
    effectiveStatus = input.partnerStatus;
  } else if (input.userKycStatus) {
    effectiveStatus = input.userKycStatus;
  }

  const verifiedDocs = input.verifiedAppDocsCount ?? 0;
  const totalDocs = input.totalAppDocsCount ?? 0;
  const enrollmentDocs = input.enrollmentDocsCount ?? 0;
  const verifiedEnrollmentDocs = input.verifiedEnrollmentDocsCount ?? 0;

  const defaultCta = isPartner
    ? { type: 'route' as const, route: 'partner' }
    : isOperator
    ? { type: 'route' as const, route: 'operator-enroll' }
    : isBusiness
    ? { type: 'route' as const, route: 'b2b' }
    : { type: 'tab' as const, tab: 'documents' };

  if (effectiveStatus === 'Approved') {
    return {
      effectiveStatus: 'Approved',
      percent: 100,
      stageIndex: 3,
      tone: 'approved',
      statusBadgeLabel: 'KYC Approved',
      headline: 'Identity & KYC Verification Approved',
      description:
        totalDocs > 0
          ? `Your account KYC is verified and ${verifiedDocs} of ${totalDocs} submitted application document(s) are marked verified.`
          : 'Your identity credentials have passed verification across Digital India Project services.',
      steps: buildKycSteps(3, 'approved'),
      ctaLabel: isPartner ? 'Open Partner Console' : isOperator ? 'Open Operator Desk' : 'Open Document Vault',
      ctaTarget: defaultCta,
    };
  }

  if (effectiveStatus === 'Under Verification' || effectiveStatus === 'Pending Approval') {
    const docRatioHint =
      enrollmentDocs > 0
        ? ` (${verifiedEnrollmentDocs}/${enrollmentDocs} KYC proofs checked)`
        : '';
    return {
      effectiveStatus,
      percent: 72,
      stageIndex: 2,
      tone: 'pending',
      statusBadgeLabel: effectiveStatus === 'Pending Approval' ? 'Pending Approval' : 'Under Verification',
      headline: 'KYC Verification Pending Compliance Review',
      description: `Your KYC dossier is under active officer verification${docRatioHint}. Approval updates appear here automatically.`,
      steps: buildKycSteps(2, 'normal'),
      ctaLabel: isPartner ? 'View Partner Status' : isOperator ? 'View KYC Dossier' : 'Check Document Vault',
      ctaTarget: defaultCta,
    };
  }

  if (effectiveStatus === 'KYC Submitted') {
    return {
      effectiveStatus: 'KYC Submitted',
      percent: 48,
      stageIndex: 1,
      tone: 'pending',
      statusBadgeLabel: 'Pending Review',
      headline: 'KYC Submitted — Queued for Screening',
      description:
        'Your KYC submission has been logged and is waiting to enter compliance review.',
      steps: buildKycSteps(1, 'normal'),
      ctaLabel: isOperator ? 'Review Submitted KYC' : isPartner ? 'Open Partner Status' : 'Manage Vault Proofs',
      ctaTarget: defaultCta,
    };
  }

  if (effectiveStatus === 'Resubmission Required') {
    return {
      effectiveStatus: 'Resubmission Required',
      percent: 45,
      stageIndex: 1,
      tone: 'warning',
      statusBadgeLabel: 'Resubmission Required',
      headline: 'KYC Action Required — Resubmit Proof',
      description:
        input.enrollmentRemarks ||
        'A reviewer requested an updated or clearer KYC document before approval can be granted.',
      steps: buildKycSteps(1, 'attention'),
      ctaLabel: isOperator ? 'Resubmit KYC Proof' : isPartner ? 'Update Partner KYC' : 'Upload Updated Proof',
      ctaTarget: defaultCta,
    };
  }

  if (effectiveStatus === 'Rejected' || effectiveStatus === 'Suspended') {
    return {
      effectiveStatus,
      percent: 25,
      stageIndex: 1,
      tone: 'rejected',
      statusBadgeLabel: effectiveStatus === 'Suspended' ? 'Suspended' : 'Rejected',
      headline: effectiveStatus === 'Suspended' ? 'Verification Suspended' : 'KYC Verification Rejected',
      description:
        input.enrollmentRemarks ||
        'Verification could not be completed with the submitted records. Review requirements or contact support.',
      steps: buildKycSteps(1, 'halted'),
      ctaLabel: 'Contact Support',
      ctaTarget: { type: 'tab', tab: 'support' },
    };
  }

  // Not Submitted state (shows real citizen document ratio if service docs already exist)
  const docProgressPercent =
    totalDocs > 0
      ? verifiedDocs === totalDocs
        ? 60
        : verifiedDocs > 0
        ? 40
        : 25
      : 10;

  return {
    effectiveStatus: 'Not Submitted',
    percent: docProgressPercent,
    stageIndex: totalDocs > 0 ? 1 : 0,
    tone: totalDocs > 0 ? 'pending' : 'neutral',
    statusBadgeLabel: totalDocs > 0 ? 'KYC Pending' : 'Not Submitted',
    headline: 'Complete Your KYC & Identity Verification',
    description:
      totalDocs > 0
        ? `${verifiedDocs} of ${totalDocs} application document(s) verified. Keep reusable Aadhaar/PAN proofs updated in your vault or complete role KYC.`
        : isPartner
        ? 'Submit your Partner KYC dossier (PAN, Bank/IFSC, and Aadhaar) to activate commission payouts.'
        : isOperator
        ? 'Complete Operator Center KYC verification to unlock assisted service desk access.'
        : isBusiness
        ? 'Verify your organization GSTIN, PAN, and signatory proofs to unlock B2B bulk compliance workflows.'
        : 'Upload your identity and address proofs in the Document Vault to speed up verification across applications.',
    steps: buildKycSteps(totalDocs > 0 ? 1 : 0, 'normal'),
    ctaLabel: isPartner
      ? 'Complete Partner KYC'
      : isOperator
      ? 'Complete Operator KYC'
      : isBusiness
      ? 'Complete Business KYC'
      : 'Upload KYC to Vault',
    ctaTarget: defaultCta,
  };
}

export type ApplicationProgressTone = 'active' | 'pending' | 'attention' | 'completed' | 'halted';

export interface ApplicationProgressResult {
  percent: number;
  currentStepIndex: number;
  tone: ApplicationProgressTone;
  statusBadgeLabel: string;
  summaryLabel: string;
  steps: ProgressStepItem[];
}

function buildAppSteps(
  activeIndex: number,
  mode: 'active' | 'completed' | 'attention' | 'halted'
): ProgressStepItem[] {
  const stages = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'payment', label: 'Payment' },
    { key: 'verification', label: 'Verification' },
    { key: 'processing', label: 'Processing' },
    { key: 'completed', label: 'Completed' },
  ];

  return stages.map((stage, idx) => {
    if (mode === 'completed') {
      return { ...stage, state: 'done' };
    }
    if (idx < activeIndex) {
      return { ...stage, state: 'done' };
    }
    if (idx === activeIndex) {
      if (mode === 'attention') return { ...stage, state: 'attention' };
      if (mode === 'halted') return { ...stage, state: 'halted' };
      return { ...stage, state: 'current' };
    }
    return { ...stage, state: 'upcoming' };
  });
}

export function getApplicationProgress(status: ApplicationStatus): ApplicationProgressResult {
  switch (status) {
    case 'Draft':
      return {
        percent: 10,
        currentStepIndex: 0,
        tone: 'pending',
        statusBadgeLabel: 'Draft',
        summaryLabel: 'Draft saved — complete form & submit payment to begin verification',
        steps: buildAppSteps(0, 'active'),
      };
    case 'Submitted':
      return {
        percent: 20,
        currentStepIndex: 0,
        tone: 'pending',
        statusBadgeLabel: 'Submitted',
        summaryLabel: 'Application submitted — pending initial payment & desk intake',
        steps: buildAppSteps(0, 'active'),
      };
    case 'Payment Pending':
    case 'Awaiting Payment':
      return {
        percent: 28,
        currentStepIndex: 1,
        tone: 'attention',
        statusBadgeLabel: status,
        summaryLabel: 'Awaiting payment confirmation to enter verification queue',
        steps: buildAppSteps(1, 'attention'),
      };
    case 'Payment Confirmed':
    case 'Payment Successful':
      return {
        percent: 40,
        currentStepIndex: 1,
        tone: 'active',
        statusBadgeLabel: status,
        summaryLabel: 'Payment confirmed — pending verification officer assignment',
        steps: buildAppSteps(1, 'active'),
      };
    case 'Under Review':
    case 'Assigned':
      return {
        percent: 55,
        currentStepIndex: 2,
        tone: 'pending',
        statusBadgeLabel: status,
        summaryLabel: 'Assigned to verification desk — initial review pending',
        steps: buildAppSteps(2, 'active'),
      };
    case 'Document Verification':
      return {
        percent: 62,
        currentStepIndex: 2,
        tone: 'pending',
        statusBadgeLabel: 'Document Verification',
        summaryLabel: 'Verifying uploaded identity, eligibility, and supporting records',
        steps: buildAppSteps(2, 'active'),
      };
    case 'Documents Required':
    case 'Correction Required':
      return {
        percent: 52,
        currentStepIndex: 2,
        tone: 'attention',
        statusBadgeLabel: status,
        summaryLabel: 'Customer action required — upload requested document or correction',
        steps: buildAppSteps(2, 'attention'),
      };
    case 'Resubmitted':
      return {
        percent: 65,
        currentStepIndex: 2,
        tone: 'active',
        statusBadgeLabel: 'Resubmitted',
        summaryLabel: 'Corrected document received — pending officer re-verification',
        steps: buildAppSteps(2, 'active'),
      };
    case 'Processing':
    case 'Application Processing':
      return {
        percent: 78,
        currentStepIndex: 3,
        tone: 'active',
        statusBadgeLabel: status,
        summaryLabel: 'Documents verified — application filing and processing in progress',
        steps: buildAppSteps(3, 'active'),
      };
    case 'Submitted to Provider':
    case 'Submitted to External Authority':
    case 'Awaiting External Authority':
    case 'Verification Pending':
    case 'Awaiting External Approval':
      return {
        percent: 88,
        currentStepIndex: 3,
        tone: 'pending',
        statusBadgeLabel: status,
        summaryLabel: 'Submitted to external authority — pending official approval',
        steps: buildAppSteps(3, 'active'),
      };
    case 'Completed':
      return {
        percent: 100,
        currentStepIndex: 4,
        tone: 'completed',
        statusBadgeLabel: 'Approved & Completed',
        summaryLabel: 'Application approved and issued certificate is ready',
        steps: buildAppSteps(4, 'completed'),
      };
    case 'Rejected':
      return {
        percent: 50,
        currentStepIndex: 2,
        tone: 'halted',
        statusBadgeLabel: 'Rejected',
        summaryLabel: 'Application rejected during review — see officer remarks for details',
        steps: buildAppSteps(2, 'halted'),
      };
    case 'Cancelled':
      return {
        percent: 0,
        currentStepIndex: 0,
        tone: 'halted',
        statusBadgeLabel: 'Cancelled',
        summaryLabel: 'Application cancelled before completion',
        steps: buildAppSteps(0, 'halted'),
      };
    case 'Refund Initiated':
      return {
        percent: 70,
        currentStepIndex: 3,
        tone: 'attention',
        statusBadgeLabel: 'Refund Initiated',
        summaryLabel: 'Refund request approved and currently being processed to source',
        steps: buildAppSteps(3, 'attention'),
      };
    case 'Refunded':
      return {
        percent: 100,
        currentStepIndex: 4,
        tone: 'halted',
        statusBadgeLabel: 'Refunded',
        summaryLabel: 'Application closed and fee refunded',
        steps: buildAppSteps(4, 'halted'),
      };
    default:
      return {
        percent: 25,
        currentStepIndex: 1,
        tone: 'pending',
        statusBadgeLabel: status,
        summaryLabel: 'Application active in verification workflow',
        steps: buildAppSteps(1, 'active'),
      };
  }
}

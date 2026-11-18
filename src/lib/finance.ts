import type {
  Application,
  CommissionRule,
  CouponRecord,
  Service,
} from '../types';

export function toPaise(rupees: number): number {
  return Math.round(Number(rupees || 0) * 100);
}

export function fromPaise(paise: number): number {
  return Math.round(Number(paise || 0)) / 100;
}

export function formatINRFromPaise(paise: number): string {
  return `₹${fromPaise(paise).toLocaleString('en-IN', {
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatINR(rupees: number): string {
  return formatINRFromPaise(toPaise(rupees));
}

export interface FeeBreakdownPaise {
  serviceFeePaise: number;
  govtFeePaise: number;
  thirdPartyFeePaise: number;
  additionalChargePaise: number;
  urgentFeePaise: number;
  discountPaise: number;
  taxRateBps: number;
  taxPaise: number;
  totalPaise: number;
}

/**
 * Computes exact minor-currency integer accounting breakdown.
 * Statutory government fees & verified 3rd-party charges pass through with 0 GST;
 * professional fee + additional/urgent fees apply discounts & configurable GST.
 */
export function calculateOrderTotalsPaise(params: {
  serviceChargeInr: number;
  govtFeesInr: number;
  thirdPartyFeesInr?: number;
  additionalChargeInr?: number;
  urgentFeeInr?: number;
  discountInr?: number;
  taxRateBps?: number; // e.g., 1800 = 18% GST, 0 = tax-exempt
  taxInclusive?: boolean;
}): FeeBreakdownPaise {
  const serviceFeePaise = Math.max(0, toPaise(params.serviceChargeInr));
  const govtFeePaise = Math.max(0, toPaise(params.govtFeesInr));
  const thirdPartyFeePaise = Math.max(0, toPaise(params.thirdPartyFeesInr || 0));
  const baseAdditionalPaise = Math.max(0, toPaise(params.additionalChargeInr || 0));
  const urgentFeePaise = Math.max(0, toPaise(params.urgentFeeInr || 0));
  const additionalChargePaise = baseAdditionalPaise + urgentFeePaise;
  const taxRateBps = Math.max(0, Math.round(params.taxRateBps ?? 0));

  const grossTaxableBase = serviceFeePaise + additionalChargePaise;
  const rawDiscountPaise = Math.max(0, toPaise(params.discountInr || 0));
  const discountPaise = Math.min(grossTaxableBase, rawDiscountPaise);
  const taxableBase = Math.max(0, grossTaxableBase - discountPaise);

  let taxPaise = 0;
  if (taxRateBps > 0 && taxableBase > 0) {
    if (params.taxInclusive) {
      taxPaise = Math.round((taxableBase * taxRateBps) / (10000 + taxRateBps));
    } else {
      taxPaise = Math.round((taxableBase * taxRateBps) / 10000);
    }
  }

  const totalPaise = params.taxInclusive
    ? taxableBase + govtFeePaise + thirdPartyFeePaise
    : taxableBase + taxPaise + govtFeePaise + thirdPartyFeePaise;

  return {
    serviceFeePaise,
    govtFeePaise,
    thirdPartyFeePaise,
    additionalChargePaise,
    urgentFeePaise,
    discountPaise,
    taxRateBps,
    taxPaise,
    totalPaise,
  };
}

export interface CouponValidationResult {
  valid: boolean;
  coupon?: CouponRecord;
  discountInr: number;
  message: string;
}

export function validateCouponCode(params: {
  code: string;
  subtotalInr: number;
  category?: string;
  coupons: CouponRecord[];
  now?: Date;
}): CouponValidationResult {
  const cleanCode = String(params.code || '').trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, discountInr: 0, message: 'Enter a promo code.' };
  }

  const coupon = params.coupons.find((c) => c.code.trim().toUpperCase() === cleanCode);
  if (!coupon || !coupon.isActive) {
    return { valid: false, discountInr: 0, message: `Promo code "${cleanCode}" is invalid or inactive.` };
  }

  const nowMs = (params.now || new Date()).getTime();
  if (coupon.validUntil && Date.parse(coupon.validUntil) < nowMs) {
    return { valid: false, discountInr: 0, message: `Promo code "${cleanCode}" has expired.` };
  }

  if (coupon.usageLimit && coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, discountInr: 0, message: `Promo code "${cleanCode}" has reached its usage limit.` };
  }

  if (params.subtotalInr < coupon.minOrderAmountInr) {
    return {
      valid: false,
      discountInr: 0,
      message: `Minimum service fee of ₹${coupon.minOrderAmountInr.toLocaleString('en-IN')} required for ${cleanCode}.`,
    };
  }

  if (
    params.category &&
    Array.isArray(coupon.applicableCategories) &&
    coupon.applicableCategories.length > 0 &&
    !coupon.applicableCategories.includes(params.category)
  ) {
    return {
      valid: false,
      discountInr: 0,
      message: `Promo code "${cleanCode}" does not apply to this service category.`,
    };
  }

  let discountPaise = 0;
  const subtotalPaise = Math.max(0, toPaise(params.subtotalInr));
  if (coupon.discountType === 'percentage') {
    discountPaise = Math.round((subtotalPaise * Math.max(0, coupon.discountPercentBps)) / 10000);
    if (coupon.maxDiscountInr && coupon.maxDiscountInr > 0) {
      discountPaise = Math.min(discountPaise, toPaise(coupon.maxDiscountInr));
    }
  } else {
    discountPaise = toPaise(coupon.discountAmountInr);
  }
  discountPaise = Math.min(subtotalPaise, discountPaise);

  return {
    valid: true,
    coupon,
    discountInr: fromPaise(discountPaise),
    message: `Applied ${coupon.code}: ₹${fromPaise(discountPaise).toLocaleString('en-IN')} off`,
  };
}

export interface PackageOverlapResult {
  overlappingServiceIds: string[];
  overlappingServiceNames: string[];
  suggestedDeductionInr: number;
  adjustedPackageChargeInr: number;
  warningMessage: string | null;
}

/**
 * Checks whether the signed-in applicant already holds active/completed applications
 * for any service bundled inside a package so duplicate billing is prevented.
 */
export function evaluatePackageOverlap(
  pkg: Service,
  allServices: Service[],
  userApplications: Application[]
): PackageOverlapResult {
  const includedIds = pkg.includedServiceIds || [];
  if (includedIds.length === 0 || userApplications.length === 0) {
    return {
      overlappingServiceIds: [],
      overlappingServiceNames: [],
      suggestedDeductionInr: 0,
      adjustedPackageChargeInr: pkg.serviceCharge,
      warningMessage: null,
    };
  }

  const activeStatuses = new Set(
    userApplications
      .filter((a) => a.status !== 'Cancelled' && a.status !== 'Rejected' && a.status !== 'Refunded')
      .map((a) => a.serviceId)
  );

  const overlappingIds = includedIds.filter((sid) => activeStatuses.has(sid));
  if (overlappingIds.length === 0) {
    return {
      overlappingServiceIds: [],
      overlappingServiceNames: [],
      suggestedDeductionInr: 0,
      adjustedPackageChargeInr: pkg.serviceCharge,
      warningMessage: null,
    };
  }

  const overlappingServices = allServices.filter((s) => overlappingIds.includes(s.id));
  const rawStandaloneSum = overlappingServices.reduce((acc, s) => acc + s.serviceCharge, 0);
  // Pro-rate credit safely (max 50% of package charge) so packages stay fair without double-charging
  const creditInr = Math.min(Math.round(rawStandaloneSum * 0.7), Math.round(pkg.serviceCharge * 0.5));
  const adjustedCharge = Math.max(99, pkg.serviceCharge - creditInr);
  const names = overlappingServices.map((s) => s.name);

  return {
    overlappingServiceIds: overlappingIds,
    overlappingServiceNames: names,
    suggestedDeductionInr: pkg.serviceCharge - adjustedCharge,
    adjustedPackageChargeInr: adjustedCharge,
    warningMessage: `Detected existing active/completed application(s) for ${names.join(', ')}. Package fee automatically credited by ₹${pkg.serviceCharge - adjustedCharge}.`,
  };
}

export function formatServicePriceLabel(service: Pick<
  Service,
  'serviceCharge' | 'pricingType' | 'billingUnit' | 'commissionNote'
>): string {
  if (service.pricingType === 'free' || (service.serviceCharge === 0 && service.pricingType !== 'custom' && service.pricingType !== 'commission')) {
    return 'Free';
  }
  if (service.pricingType === 'custom' && service.serviceCharge === 0) {
    return 'Custom Quote';
  }
  if (service.pricingType === 'commission') {
    return service.commissionNote || '10% Commission';
  }

  const formatted = `₹${Number(service.serviceCharge || 0).toLocaleString('en-IN')}`;
  const prefix = service.pricingType === 'starting' ? 'Starting ' : '';

  switch (service.billingUnit) {
    case 'month':
      return `${prefix}${formatted}/mo`;
    case 'year':
      return `${prefix}${formatted}/yr`;
    case 'page':
      return `${prefix}${formatted}/page`;
    case 'application':
      return `${prefix}${formatted}/app`;
    case 'document':
      return `${prefix}${formatted}/doc`;
    case 'verification':
      return `${prefix}${formatted}/verif`;
    default:
      return `${prefix}${formatted}`;
  }
}

export interface CommissionComputationResult {
  matchedRuleId: string | null;
  grossServiceFeePaise: number;
  commissionPaise: number;
  tdsPaise: number;
  netPayablePaise: number;
}

/**
 * Deterministic partner commission calculation prioritizing:
 * 1. Partner-specific + Service-specific rule
 * 2. Partner-specific global rule
 * 3. Service-specific global rule
 * 4. Default active rule
 */
export function calculatePartnerCommission(params: {
  partnerId: string;
  partnerType?: string;
  serviceId: string;
  serviceFeePaise: number;
  rules: CommissionRule[];
  tdsBps?: number; // Default 0 or 500 (5%)
}): CommissionComputationResult {
  const { partnerId, partnerType, serviceId, serviceFeePaise, rules, tdsBps = 0 } = params;
  const now = Date.now();

  const eligible = rules.filter((r) => {
    if (!r.isActive) return false;
    if (r.minOrderPaise && serviceFeePaise < r.minOrderPaise) return false;
    if (r.effectiveFrom && new Date(r.effectiveFrom).getTime() > now) return false;
    if (r.effectiveUntil && new Date(r.effectiveUntil).getTime() < now) return false;
    if (r.partnerId && r.partnerId !== partnerId) return false;
    if (r.partnerType && partnerType && r.partnerType !== partnerType) return false;
    if (r.serviceId && r.serviceId !== serviceId) return false;
    return true;
  });

  // Sort by specificity
  eligible.sort((a, b) => {
    const score = (r: CommissionRule) =>
      (r.partnerId ? 4 : 0) + (r.serviceId ? 2 : 0) + (r.partnerType ? 1 : 0);
    return score(b) - score(a);
  });

  const rule = eligible[0];
  if (!rule) {
    // Fallback conservative 15% of service fee
    const fallbackComm = Math.round((serviceFeePaise * 1500) / 10000);
    const tds = Math.round((fallbackComm * tdsBps) / 10000);
    return {
      matchedRuleId: null,
      grossServiceFeePaise: serviceFeePaise,
      commissionPaise: fallbackComm,
      tdsPaise: tds,
      netPayablePaise: Math.max(0, fallbackComm - tds),
    };
  }

  let commissionPaise = 0;
  if (rule.commissionType === 'fixed') {
    commissionPaise = Math.max(0, Math.round(rule.fixedAmountPaise));
  } else {
    commissionPaise = Math.max(0, Math.round((serviceFeePaise * rule.percentageBps) / 10000));
  }

  const tdsPaise = Math.round((commissionPaise * tdsBps) / 10000);
  const netPayablePaise = Math.max(0, commissionPaise - tdsPaise);

  return {
    matchedRuleId: rule.id,
    grossServiceFeePaise: serviceFeePaise,
    commissionPaise,
    tdsPaise,
    netPayablePaise,
  };
}

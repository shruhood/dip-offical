import type { CouponRecord, Service } from '../types';
import {
  COMPLETE_CATALOGUE_ITEMS,
  INITIAL_COUPONS,
  resolveCategorySlug,
} from '../data/catalogue';
import {
  calculateOrderTotalsPaise,
  fromPaise,
  toPaise,
  validateCouponCode,
  type CouponValidationResult,
  type FeeBreakdownPaise,
} from './finance';
import { findApiSathiServiceBySlugOrId } from '../data/apiSathiServices';
import { getToolBySlug } from '../data/toolsRegistry';
import {
  getPlanDefinition,
  getToolSingleUsePriceInr,
  TOOL_SINGLE_USE_PRICE_INR,
} from '../data/toolPlans';

export function findCatalogueItem(
  slugOrId?: string | null,
  catalog: Service[] = COMPLETE_CATALOGUE_ITEMS
): Service | undefined {
  const clean = String(slugOrId || '').trim();
  if (!clean) return undefined;
  const lower = clean.toLowerCase();
  const found = catalog.find(
    (item) => item.slug.toLowerCase() === lower || item.id === clean
  );
  if (found) return found;
  if (catalog === COMPLETE_CATALOGUE_ITEMS) {
    return findApiSathiServiceBySlugOrId(clean);
  }
  return undefined;
}

export interface CatalogueFilterParams {
  items?: Service[];
  category?: string;
  subcategory?: string;
  productType?: string;
  deliveryType?: string;
  pricingType?: string;
  featuredOnly?: boolean;
  popularOnly?: boolean;
  includeUnpublished?: boolean;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'popular' | 'price_asc' | 'price_desc' | 'name_asc';
  page?: number;
  limit?: number;
}

export interface CatalogueFilterResult {
  items: Service[];
  totalItems: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function filterCatalogueItems(
  params: CatalogueFilterParams
): CatalogueFilterResult {
  const source = params.items || COMPLETE_CATALOGUE_ITEMS;
  const resolvedCat = resolveCategorySlug(params.category);
  const sub = String(params.subcategory || '').trim().toLowerCase();
  const productType = String(params.productType || '').trim().toLowerCase();
  const deliveryType = String(params.deliveryType || '').trim().toLowerCase();
  const pricingType = String(params.pricingType || '').trim().toLowerCase();
  const q = String(params.q || '').trim().toLowerCase();
  const minPrice =
    params.minPrice !== undefined && Number.isFinite(Number(params.minPrice))
      ? Number(params.minPrice)
      : undefined;
  const maxPrice =
    params.maxPrice !== undefined && Number.isFinite(Number(params.maxPrice))
      ? Number(params.maxPrice)
      : undefined;

  const filtered = source.filter((item) => {
    if (!params.includeUnpublished && item.published === false) return false;

    if (resolvedCat === 'packages') {
      if (item.productType !== 'compliance_package') return false;
    } else if (resolvedCat && resolvedCat !== 'all') {
      if (item.category !== resolvedCat) return false;
    }

    if (sub && sub !== 'all') {
      if (String(item.subcategory || '').toLowerCase() !== sub) return false;
    }

    if (productType && productType !== 'all') {
      if (String(item.productType || 'service').toLowerCase() !== productType) {
        return false;
      }
    }

    if (deliveryType && deliveryType !== 'all') {
      if (String(item.deliveryType || 'online').toLowerCase() !== deliveryType) {
        return false;
      }
    }

    if (pricingType && pricingType !== 'all') {
      if (String(item.pricingType || 'fixed').toLowerCase() !== pricingType) {
        return false;
      }
    }

    if (params.featuredOnly && !item.featured) return false;
    if (params.popularOnly && !item.popular) return false;

    if (minPrice !== undefined && item.serviceCharge < minPrice) return false;
    if (maxPrice !== undefined && item.serviceCharge > maxPrice) return false;

    if (q) {
      const hay = [
        item.name,
        item.nameHi,
        item.slug,
        item.shortDesc,
        item.subcategory,
        item.category,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  const sortMode = params.sort || 'popular';
  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === 'price_asc') return a.serviceCharge - b.serviceCharge;
    if (sortMode === 'price_desc') return b.serviceCharge - a.serviceCharge;
    if (sortMode === 'name_asc') return a.name.localeCompare(b.name);
    const scoreA = (a.featured ? 4 : 0) + (a.popular ? 2 : 0);
    const scoreB = (b.featured ? 4 : 0) + (b.popular ? 2 : 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return 0;
  });

  const page = Math.max(1, Math.floor(Number(params.page || 1)));
  const limit = Math.min(200, Math.max(1, Math.floor(Number(params.limit || 24))));
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;

  return {
    items: sorted.slice(start, start + limit),
    totalItems,
    page: safePage,
    limit,
    totalPages,
  };
}

export function resolveCouponValidation(params: {
  code: string;
  serviceChargeInr: number;
  category?: string;
  extraCoupons?: CouponRecord[];
}): CouponValidationResult {
  const mergedMap = new Map<string, CouponRecord>();
  for (const c of INITIAL_COUPONS) {
    mergedMap.set(c.code.trim().toUpperCase(), c);
  }
  for (const c of params.extraCoupons || []) {
    if (c?.code) {
      mergedMap.set(c.code.trim().toUpperCase(), c);
    }
  }
  return validateCouponCode({
    code: params.code,
    subtotalInr: Math.max(0, Number(params.serviceChargeInr || 0)),
    category: params.category,
    coupons: Array.from(mergedMap.values()),
  });
}

export interface AuthoritativeCheckoutInput {
  serviceSlug?: string;
  serviceId?: string;
  urgentProcessing?: boolean;
  couponCode?: string;
  clientTotalInr?: number;
  fallbackServiceChargeInr?: number;
  fallbackGovtFeesInr?: number;
  fallbackThirdPartyFeesInr?: number;
  fallbackAdditionalChargeInr?: number;
  fallbackTaxRateBps?: number;
  fallbackTaxInclusive?: boolean;
  extraCoupons?: CouponRecord[];
  catalog?: Service[];
}

export interface AuthoritativeCheckoutResult {
  ok: boolean;
  status?: number;
  errorCode?: string;
  message?: string;
  service?: Service;
  breakdown: FeeBreakdownPaise;
  totalInr: number;
  appliedCouponCode?: string;
}

export function resolveAuthoritativeCheckout(
  params: AuthoritativeCheckoutInput
): AuthoritativeCheckoutResult {
  const catalog = params.catalog || COMPLETE_CATALOGUE_ITEMS;
  const ref = String(params.serviceSlug || params.serviceId || '').trim();

  if (ref.startsWith('tool-pass:')) {
    const toolSlug = ref.slice('tool-pass:'.length).trim();
    const tool = getToolBySlug(toolSlug);
    if (!tool) {
      return {
        ok: false,
        status: 404,
        errorCode: 'TOOL_NOT_FOUND',
        message: `Digital tool "${toolSlug}" was not found.`,
        breakdown: calculateOrderTotalsPaise({ serviceChargeInr: 0, govtFeesInr: 0 }),
        totalInr: 0,
      };
    }
    const passPriceInr = getToolSingleUsePriceInr(tool) || TOOL_SINGLE_USE_PRICE_INR;
    const breakdown = calculateOrderTotalsPaise({
      serviceChargeInr: passPriceInr,
      govtFeesInr: 0,
    });
    const totalInr = fromPaise(breakdown.totalPaise);
    if (
      params.clientTotalInr !== undefined &&
      Number.isFinite(Number(params.clientTotalInr)) &&
      Number(params.clientTotalInr) > 0
    ) {
      const clientPaise = toPaise(Number(params.clientTotalInr));
      if (Math.abs(clientPaise - breakdown.totalPaise) > 100) {
        return {
          ok: false,
          status: 400,
          errorCode: 'PRICE_TAMPER_OR_MISMATCH',
          message: `Client total ₹${Number(params.clientTotalInr)} does not match authoritative ₹${totalInr} 1-Time Tool Pass fee.`,
          breakdown,
          totalInr,
        };
      }
    }
    return {
      ok: true,
      breakdown,
      totalInr,
    };
  }

  if (ref.startsWith('tool-plan:')) {
    const [, planCodeRaw = '', cycleRaw = 'monthly'] = ref.split(':');
    const planDef = getPlanDefinition(planCodeRaw);
    const cycle = cycleRaw === 'annual' ? 'annual' : 'monthly';
    if (!planDef || planDef.code !== planCodeRaw) {
      return {
        ok: false,
        status: 404,
        errorCode: 'TOOL_PLAN_NOT_FOUND',
        message: `Tool subscription plan "${planCodeRaw}" was not found.`,
        breakdown: calculateOrderTotalsPaise({ serviceChargeInr: 0, govtFeesInr: 0 }),
        totalInr: 0,
      };
    }
    const planPriceInr = cycle === 'annual' ? planDef.priceAnnualInr : planDef.priceMonthlyInr;
    if (planPriceInr === null || planPriceInr <= 0) {
      return {
        ok: false,
        status: 400,
        errorCode: 'CUSTOM_QUOTE_REQUIRED',
        message: `${planDef.name} requires a custom enterprise quote.`,
        breakdown: calculateOrderTotalsPaise({ serviceChargeInr: 0, govtFeesInr: 0 }),
        totalInr: 0,
      };
    }
    const breakdown = calculateOrderTotalsPaise({
      serviceChargeInr: planPriceInr,
      govtFeesInr: 0,
    });
    const totalInr = fromPaise(breakdown.totalPaise);
    if (
      params.clientTotalInr !== undefined &&
      Number.isFinite(Number(params.clientTotalInr)) &&
      Number(params.clientTotalInr) > 0
    ) {
      const clientPaise = toPaise(Number(params.clientTotalInr));
      if (Math.abs(clientPaise - breakdown.totalPaise) > 100) {
        return {
          ok: false,
          status: 400,
          errorCode: 'PRICE_TAMPER_OR_MISMATCH',
          message: `Client total ₹${Number(params.clientTotalInr)} does not match authoritative ${planDef.name} (${cycle}) fee of ₹${totalInr}.`,
          breakdown,
          totalInr,
        };
      }
    }
    return {
      ok: true,
      breakdown,
      totalInr,
    };
  }

  if (ref) {
    const srv = findCatalogueItem(ref, catalog);
    if (!srv) {
      return {
        ok: false,
        status: 404,
        errorCode: 'SERVICE_NOT_FOUND',
        message: `Catalogue item "${ref}" was not found.`,
        breakdown: calculateOrderTotalsPaise({ serviceChargeInr: 0, govtFeesInr: 0 }),
        totalInr: 0,
      };
    }

    if (srv.isCustomQuote && Number(srv.serviceCharge || 0) <= 0) {
      return {
        ok: false,
        status: 400,
        errorCode: 'CUSTOM_QUOTE_REQUIRED',
        message: `"${srv.name}" requires an approved custom quote before online payment checkout.`,
        service: srv,
        breakdown: calculateOrderTotalsPaise({ serviceChargeInr: 0, govtFeesInr: 0 }),
        totalInr: 0,
      };
    }

    const serviceChargeInr = Math.max(0, Number(srv.serviceCharge || 0));
    const govtFeesInr = Math.max(0, Number(srv.govtFees || 0));
    const thirdPartyFeesInr = Math.max(0, Number(srv.thirdPartyFees || 0));
    const additionalChargeInr = Math.max(0, Number(srv.additionalCharge || 0));
    const urgentFeeInr =
      params.urgentProcessing && Number(srv.urgentFee || 0) > 0
        ? Number(srv.urgentFee)
        : 0;
    const taxRateBps = Number(srv.taxRateBps ?? params.fallbackTaxRateBps ?? 0);
    const taxInclusive = Boolean(srv.taxInclusive ?? params.fallbackTaxInclusive ?? false);

    let discountInr = Math.max(0, Number(srv.discountInr || 0));
    let appliedCouponCode: string | undefined;

    const cleanCoupon = String(params.couponCode || '').trim().toUpperCase();
    if (cleanCoupon) {
      const couponResult = resolveCouponValidation({
        code: cleanCoupon,
        serviceChargeInr: serviceChargeInr + additionalChargeInr + urgentFeeInr,
        category: srv.category,
        extraCoupons: params.extraCoupons,
      });
      if (!couponResult.valid) {
        return {
          ok: false,
          status: 400,
          errorCode: 'INVALID_COUPON',
          message: couponResult.message,
          service: srv,
          breakdown: calculateOrderTotalsPaise({
            serviceChargeInr,
            govtFeesInr,
            thirdPartyFeesInr,
            additionalChargeInr,
            urgentFeeInr,
            taxRateBps,
            taxInclusive,
          }),
          totalInr: 0,
        };
      }
      discountInr = couponResult.discountInr;
      appliedCouponCode = couponResult.coupon?.code || cleanCoupon;
    }

    const breakdown = calculateOrderTotalsPaise({
      serviceChargeInr,
      govtFeesInr,
      thirdPartyFeesInr,
      additionalChargeInr,
      urgentFeeInr,
      discountInr,
      taxRateBps,
      taxInclusive,
    });
    const totalInr = fromPaise(breakdown.totalPaise);

    if (
      params.clientTotalInr !== undefined &&
      Number.isFinite(Number(params.clientTotalInr)) &&
      Number(params.clientTotalInr) > 0
    ) {
      const clientPaise = toPaise(Number(params.clientTotalInr));
      if (Math.abs(clientPaise - breakdown.totalPaise) > 100) {
        return {
          ok: false,
          status: 400,
          errorCode: 'PRICE_TAMPER_OR_MISMATCH',
          message: `Client total ₹${Number(params.clientTotalInr).toLocaleString('en-IN')} does not match authoritative catalogue total ₹${totalInr.toLocaleString('en-IN')}.`,
          service: srv,
          breakdown,
          totalInr,
        };
      }
    }

    return {
      ok: true,
      service: srv,
      breakdown,
      totalInr,
      appliedCouponCode,
    };
  }

  // Fallback for legacy orders without a serviceSlug/serviceId reference
  const fallbackServiceChargeInr = Math.max(0, Number(params.fallbackServiceChargeInr || 0));
  const fallbackGovtFeesInr = Math.max(0, Number(params.fallbackGovtFeesInr || 0));
  const fallbackThirdPartyFeesInr = Math.max(0, Number(params.fallbackThirdPartyFeesInr || 0));
  const fallbackAdditionalChargeInr = Math.max(0, Number(params.fallbackAdditionalChargeInr || 0));

  let discountInr = 0;
  let appliedCouponCode: string | undefined;
  const cleanCoupon = String(params.couponCode || '').trim().toUpperCase();
  if (cleanCoupon) {
    const couponResult = resolveCouponValidation({
      code: cleanCoupon,
      serviceChargeInr: fallbackServiceChargeInr + fallbackAdditionalChargeInr,
      extraCoupons: params.extraCoupons,
    });
    if (!couponResult.valid) {
      return {
        ok: false,
        status: 400,
        errorCode: 'INVALID_COUPON',
        message: couponResult.message,
        breakdown: calculateOrderTotalsPaise({
          serviceChargeInr: fallbackServiceChargeInr,
          govtFeesInr: fallbackGovtFeesInr,
          thirdPartyFeesInr: fallbackThirdPartyFeesInr,
          additionalChargeInr: fallbackAdditionalChargeInr,
        }),
        totalInr: 0,
      };
    }
    discountInr = couponResult.discountInr;
    appliedCouponCode = couponResult.coupon?.code || cleanCoupon;
  }

  const breakdown = calculateOrderTotalsPaise({
    serviceChargeInr: fallbackServiceChargeInr,
    govtFeesInr: fallbackGovtFeesInr,
    thirdPartyFeesInr: fallbackThirdPartyFeesInr,
    additionalChargeInr: fallbackAdditionalChargeInr,
    discountInr,
    taxRateBps: Number(params.fallbackTaxRateBps ?? 0),
    taxInclusive: Boolean(params.fallbackTaxInclusive ?? false),
  });

  return {
    ok: true,
    breakdown,
    totalInr: fromPaise(breakdown.totalPaise),
    appliedCouponCode,
  };
}

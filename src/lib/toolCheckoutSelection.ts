import { getToolBySlug, TOOLS_REGISTRY } from '../data/toolsRegistry';
import {
  getPlanDefinition,
  getToolSingleUsePriceInr,
  TOOL_SINGLE_USE_PRICE_INR,
  type ToolPlanCode,
  type ToolPlanDefinition,
} from '../data/toolPlans';
import type { ToolDefinition } from '../types/tool';

export type ToolPricingMode = 'one_time' | 'monthly';
export type ToolSubscriptionCadence = 'monthly' | 'annual';

export interface ToolCheckoutSelection {
  mode: ToolPricingMode;
  cadence: ToolSubscriptionCadence;
  serviceSlug: string;
  serviceName: string;
  amountInr: number;
  toolSlug?: string;
  toolName?: string;
  planCode?: ToolPlanCode;
  planName?: string;
}

export function getPaidToolsForSingleUse(): ToolDefinition[] {
  return TOOLS_REGISTRY.filter((t) => t.tier !== 'free');
}

export function buildToolCheckoutSelection(params: {
  mode: ToolPricingMode;
  cadence?: ToolSubscriptionCadence;
  toolSlug?: string;
  planCode?: ToolPlanCode;
}): ToolCheckoutSelection {
  const cadence: ToolSubscriptionCadence = params.cadence === 'annual' ? 'annual' : 'monthly';

  if (params.mode === 'one_time') {
    const paidTools = getPaidToolsForSingleUse();
    const resolvedTool =
      (params.toolSlug ? getToolBySlug(params.toolSlug) : undefined) ||
      paidTools[0] ||
      TOOLS_REGISTRY[0];
    const singleUsePrice = getToolSingleUsePriceInr(resolvedTool) || TOOL_SINGLE_USE_PRICE_INR;
    return {
      mode: 'one_time',
      cadence: 'monthly',
      serviceSlug: `tool-pass:${resolvedTool.slug}`,
      serviceName: `One-time Use (₹${singleUsePrice}) — ${resolvedTool.name}`,
      amountInr: singleUsePrice,
      toolSlug: resolvedTool.slug,
      toolName: resolvedTool.name,
    };
  }

  const targetPlanCode: ToolPlanCode =
    params.planCode && params.planCode !== 'free' && params.planCode !== 'enterprise'
      ? params.planCode
      : 'csc';
  const planDef: ToolPlanDefinition = getPlanDefinition(targetPlanCode);
  const amountInr =
    (cadence === 'annual' ? planDef.priceAnnualInr : planDef.priceMonthlyInr) ?? 0;

  return {
    mode: 'monthly',
    cadence,
    serviceSlug: `tool-plan:${planDef.code}:${cadence}`,
    serviceName: `Digital Tools Tray — ${planDef.name} (${cadence === 'annual' ? 'Annual' : 'Monthly Subscription'})`,
    amountInr,
    planCode: planDef.code,
    planName: planDef.name,
  };
}

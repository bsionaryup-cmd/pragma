import type { BillingPlanCode } from "@prisma/client";
import type { SalesBillingInterval } from "@prisma/client";
import {
  calculateSubscriptionAmount,
  clampPropertyCountForBillingPlan,
  getPlanDefinition,
} from "@/modules/billing/domain/plan-catalog";

export type QuoteCalculatorInput = {
  plan: BillingPlanCode;
  propertyCount: number;
  billingInterval?: SalesBillingInterval;
  discountPercent?: number | null;
  discountAmountCop?: number | null;
  /** Monto mensual fijo acordado (override controlado). */
  overrideMonthlyCop?: number | null;
};

export type QuoteCalculatorResult = {
  plan: BillingPlanCode;
  propertyCount: number;
  billingInterval: SalesBillingInterval;
  pricePerPropertyCop: number;
  listMonthlyCop: number;
  listDisplayCop: number;
  discountPercent: number;
  discountAmountCop: number;
  savingsCop: number;
  finalMonthlyCop: number;
  finalDisplayCop: number;
  annualListCop: number;
  annualFinalCop: number;
};

const MAX_DISCOUNT_PERCENT = 80;
const ANNUAL_MONTHS = 12;

function roundCop(value: number): number {
  return Math.max(0, Math.round(value));
}

export function clampDiscountPercent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(MAX_DISCOUNT_PERCENT, Math.max(0, value));
}

export function calculateSalesQuote(
  input: QuoteCalculatorInput,
): QuoteCalculatorResult {
  const propertyCount = clampPropertyCountForBillingPlan(
    input.plan,
    input.propertyCount,
  );
  const billingInterval = input.billingInterval ?? "MONTHLY";
  const planDef = getPlanDefinition(input.plan);
  const listMonthlyCop = calculateSubscriptionAmount(input.plan, propertyCount);
  const discountPercent = clampDiscountPercent(input.discountPercent);
  const discountAmountCop = roundCop(input.discountAmountCop ?? 0);

  const savingsFromPercent = roundCop((listMonthlyCop * discountPercent) / 100);
  let savingsCop = Math.min(
    listMonthlyCop,
    savingsFromPercent + discountAmountCop,
  );

  let finalMonthlyCop = roundCop(listMonthlyCop - savingsCop);

  if (
    input.overrideMonthlyCop != null &&
    Number.isFinite(input.overrideMonthlyCop) &&
    input.overrideMonthlyCop >= 0
  ) {
    finalMonthlyCop = roundCop(
      Math.min(input.overrideMonthlyCop, listMonthlyCop),
    );
    savingsCop = listMonthlyCop - finalMonthlyCop;
  }

  const listDisplayCop =
    billingInterval === "ANNUAL" ? listMonthlyCop * ANNUAL_MONTHS : listMonthlyCop;
  const finalDisplayCop =
    billingInterval === "ANNUAL" ? finalMonthlyCop * ANNUAL_MONTHS : finalMonthlyCop;

  return {
    plan: input.plan,
    propertyCount,
    billingInterval,
    pricePerPropertyCop: planDef.pricePerPropertyCop,
    listMonthlyCop,
    listDisplayCop,
    discountPercent,
    discountAmountCop,
    savingsCop,
    finalMonthlyCop,
    finalDisplayCop,
    annualListCop: listMonthlyCop * ANNUAL_MONTHS,
    annualFinalCop: finalMonthlyCop * ANNUAL_MONTHS,
  };
}

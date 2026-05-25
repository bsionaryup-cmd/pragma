import type { BillingPlanCode } from "@prisma/client";

export type SalesBillingMetadata = {
  propertySlots?: number;
  salesQuoteId?: string;
  /** Monto mensual acordado (COP) — prioridad sobre catálogo. */
  quotedMonthlyAmountCop?: number;
  quotedPlan?: BillingPlanCode;
  salesOfferToken?: string;
  discountCodeId?: string;
  billingInterval?: "MONTHLY" | "ANNUAL";
};

export function parseSalesBillingMetadata(metadata: unknown): SalesBillingMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const raw = metadata as Record<string, unknown>;
  const propertySlots =
    typeof raw.propertySlots === "number" && raw.propertySlots >= 1
      ? Math.round(raw.propertySlots)
      : undefined;

  return {
    propertySlots,
    salesQuoteId:
      typeof raw.salesQuoteId === "string" ? raw.salesQuoteId : undefined,
    quotedMonthlyAmountCop:
      typeof raw.quotedMonthlyAmountCop === "number"
        ? raw.quotedMonthlyAmountCop
        : undefined,
    quotedPlan:
      raw.quotedPlan === "STARTER" ||
      raw.quotedPlan === "PRO" ||
      raw.quotedPlan === "SCALE"
        ? raw.quotedPlan
        : undefined,
    salesOfferToken:
      typeof raw.salesOfferToken === "string" ? raw.salesOfferToken : undefined,
    discountCodeId:
      typeof raw.discountCodeId === "string" ? raw.discountCodeId : undefined,
    billingInterval:
      raw.billingInterval === "ANNUAL" ? "ANNUAL" : undefined,
  };
}

export function mergeSalesBillingMetadata(
  existing: unknown,
  patch: SalesBillingMetadata,
): SalesBillingMetadata {
  return {
    ...parseSalesBillingMetadata(existing),
    ...patch,
  };
}

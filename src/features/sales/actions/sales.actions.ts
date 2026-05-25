"use server";

import { revalidatePath } from "next/cache";
import type { BillingPlanCode, SalesBillingInterval, SalesDiscountKind } from "@prisma/client";
import { requirePlatformOwnerUser } from "@/lib/platform/require-platform-owner";
import { calculateSalesQuote } from "@/modules/sales/domain/quote-calculator";
import {
  acceptSalesOfferByToken,
  cancelSalesQuote,
  createSalesQuote,
  getSalesQuoteByOfferToken,
  issueSalesQuoteOffer,
  listSalesQuotes,
} from "@/modules/sales/services/sales-quote.service";
import {
  createSalesDiscountCode,
  listSalesDiscountCodes,
} from "@/modules/sales/services/sales-discount-code.service";
import { applySalesOfferToOrganization } from "@/modules/sales/services/sales-offer-redemption.service";
import { requireDbUser } from "@/lib/auth";

export async function calculateQuotePreviewAction(input: {
  plan: BillingPlanCode;
  propertyCount: number;
  billingInterval?: SalesBillingInterval;
  discountPercent?: number | null;
  discountAmountCop?: number | null;
  overrideMonthlyCop?: number | null;
  discountCode?: string | null;
}) {
  await requirePlatformOwnerUser();

  let discountPercent = input.discountPercent;
  let discountAmountCop = input.discountAmountCop;

  if (input.discountCode?.trim()) {
    const { validateDiscountCodeForQuote } = await import(
      "@/modules/sales/services/sales-discount-code.service"
    );
    const applied = await validateDiscountCodeForQuote({
      code: input.discountCode,
      plan: input.plan,
    });
    if (!applied.ok) {
      return { success: false as const, error: applied.message };
    }
    if (applied.kind === "PERCENT") {
      discountPercent = Number(applied.value);
      discountAmountCop = 0;
    } else {
      discountAmountCop = Number(applied.value);
    }
  }

  const calc = calculateSalesQuote({
    ...input,
    discountPercent,
    discountAmountCop,
  });

  return { success: true as const, calc };
}

export async function createSalesQuoteAction(input: {
  prospectName?: string;
  prospectEmail?: string;
  plan: BillingPlanCode;
  propertyCount: number;
  billingInterval?: SalesBillingInterval;
  discountPercent?: number | null;
  discountAmountCop?: number | null;
  overrideMonthlyCop?: number | null;
  discountCode?: string | null;
  notes?: string;
}) {
  const owner = await requirePlatformOwnerUser();
  try {
    const quote = await createSalesQuote({
      ...input,
      createdById: owner.id,
    });
    revalidatePath("/owner-dashboard/sales");
    return { success: true as const, quote };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error al crear cotización",
    };
  }
}

export async function issueSalesQuoteOfferAction(quoteId: string) {
  const owner = await requirePlatformOwnerUser();
  try {
    const result = await issueSalesQuoteOffer(quoteId, owner.id);
    revalidatePath("/owner-dashboard/sales");
    return { success: true as const, ...result };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error al emitir oferta",
    };
  }
}

export async function cancelSalesQuoteAction(quoteId: string) {
  const owner = await requirePlatformOwnerUser();
  await cancelSalesQuote(quoteId, owner.id);
  revalidatePath("/owner-dashboard/sales");
  return { success: true as const };
}

export async function listSalesQuotesAction() {
  await requirePlatformOwnerUser();
  const quotes = await listSalesQuotes({ limit: 80 });
  return { success: true as const, quotes };
}

export async function createDiscountCodeAction(input: {
  code: string;
  label?: string;
  kind: SalesDiscountKind;
  value: number;
  scope: "GLOBAL" | "PLAN" | "TENANT";
  plan?: BillingPlanCode | null;
  organizationId?: string | null;
  firstMonthOnly?: boolean;
  recurring?: boolean;
  maxRedemptions?: number | null;
}) {
  const owner = await requirePlatformOwnerUser();
  try {
    const row = await createSalesDiscountCode({
      ...input,
      createdById: owner.id,
    });
    revalidatePath("/owner-dashboard/sales");
    return { success: true as const, row };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error al crear código",
    };
  }
}

export async function listDiscountCodesAction() {
  await requirePlatformOwnerUser();
  const codes = await listSalesDiscountCodes();
  return { success: true as const, codes };
}

export async function applySalesOfferForCurrentUserAction(offerToken: string) {
  const user = await requireDbUser();
  if (!user.organizationId) {
    return { success: false as const, error: "Sin organización" };
  }

  const result = await applySalesOfferToOrganization({
    organizationId: user.organizationId,
    offerToken,
    actorUserId: user.id,
    prospectEmail: user.email,
  });

  if (!result.ok) {
    return { success: false as const, error: result.message };
  }

  revalidatePath("/onboarding");
  revalidatePath("/settings/billing");

  const quote = await getSalesQuoteByOfferToken(offerToken);

  return {
    success: true as const,
    message: result.message,
    propertyCount: quote?.propertyCount,
    plan: quote?.plan,
  };
}

export async function acceptPublicOfferAction(token: string, email: string) {
  try {
    await acceptSalesOfferByToken(token, email);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "No se pudo aceptar la oferta",
    };
  }
}

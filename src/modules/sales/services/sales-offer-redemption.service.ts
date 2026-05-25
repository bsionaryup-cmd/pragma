import "server-only";

import { db } from "@/lib/db";
import { mergeSalesBillingMetadata } from "@/modules/sales/domain/sales-billing-metadata";
import { syncOpenInvoiceAmountForAccount } from "@/modules/billing/domain/subscription-property-count";
import {
  getSalesQuoteByOfferToken,
} from "@/modules/sales/services/sales-quote.service";
import { incrementDiscountRedemption } from "@/modules/sales/services/sales-discount-code.service";
import { ensureOrganizationBillingAccount } from "@/services/organizations/organization.service";
import { writePlatformAuditLog } from "@/services/platform/platform-audit.service";
import { writePaymentAuditLog } from "@/modules/billing/repositories/audit-log.repository";

export async function applySalesOfferToOrganization(input: {
  organizationId: string;
  offerToken: string;
  actorUserId?: string;
  prospectEmail?: string;
}): Promise<{ ok: boolean; message: string }> {
  const quote = await getSalesQuoteByOfferToken(input.offerToken);
  if (!quote) {
    return { ok: false, message: "Oferta no encontrada" };
  }

  if (quote.status === "CONVERTED") {
    return { ok: true, message: "Oferta ya aplicada" };
  }

  if (quote.status === "CANCELLED" || quote.status === "EXPIRED") {
    return { ok: false, message: "Oferta no válida" };
  }

  if (quote.status === "DRAFT") {
    return { ok: false, message: "La oferta aún no ha sido emitida" };
  }

  const now = new Date();
  if (quote.expiresAt && quote.expiresAt < now) {
    return { ok: false, message: "Oferta expirada" };
  }

  if (
    quote.prospectEmail &&
    input.prospectEmail &&
    quote.prospectEmail !== input.prospectEmail.trim().toLowerCase()
  ) {
    return {
      ok: false,
      message: "El correo no coincide con la oferta privada",
    };
  }

  const account = await ensureOrganizationBillingAccount(input.organizationId);
  const metadata = mergeSalesBillingMetadata(account.metadata, {
    propertySlots: quote.propertyCount,
    salesQuoteId: quote.id,
    quotedMonthlyAmountCop: Number(quote.finalAmountCop),
    quotedPlan: quote.plan,
    salesOfferToken: input.offerToken,
    discountCodeId: quote.discountCodeId ?? undefined,
    billingInterval: quote.billingInterval,
  });

  await db.billingAccount.update({
    where: { id: account.id },
    data: {
      plan: quote.plan,
      metadata,
    },
  });

  await syncOpenInvoiceAmountForAccount(account.id);

  await db.salesQuote.update({
    where: { id: quote.id },
    data: {
      status: "CONVERTED",
      convertedAt: now,
      organizationId: input.organizationId,
      acceptedAt: quote.acceptedAt ?? now,
    },
  });

  await db.salesQuoteEvent.create({
    data: {
      quoteId: quote.id,
      action: "converted",
      actorId: input.actorUserId ?? null,
      payload: { organizationId: input.organizationId },
    },
  });

  if (quote.discountCodeId) {
    await incrementDiscountRedemption(quote.discountCodeId);
  }

  await writePaymentAuditLog({
    entityType: "billing_account",
    entityId: account.id,
    action: "sales_offer_applied",
    actorId: input.actorUserId,
    after: {
      quoteId: quote.id,
      plan: quote.plan,
      finalAmountCop: Number(quote.finalAmountCop),
      propertyCount: quote.propertyCount,
    },
  });

  if (input.actorUserId) {
    const actor = await db.user.findUnique({
      where: { id: input.actorUserId },
      select: { email: true },
    });
    await writePlatformAuditLog({
      platformUserId: input.actorUserId,
      ownerEmail: actor?.email ?? "platform",
      action: "sales_offer_converted",
      targetTenantId: input.organizationId,
      newState: { quoteId: quote.id, offerToken: input.offerToken },
    });
  }

  return { ok: true, message: "Oferta aplicada a la suscripción" };
}

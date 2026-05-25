import "server-only";

import { createHash, randomBytes } from "crypto";
import type {
  BillingPlanCode,
  Prisma,
  SalesBillingInterval,
  SalesQuoteStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { calculateSalesQuote } from "@/modules/sales/domain/quote-calculator";
import { validateDiscountCodeForQuote } from "@/modules/sales/services/sales-discount-code.service";
import { writePlatformAuditLog } from "@/services/platform/platform-audit.service";

function generateOfferToken(): string {
  return randomBytes(24).toString("base64url");
}

async function appendQuoteEvent(input: {
  quoteId: string;
  action: string;
  actorId?: string | null;
  payload?: Record<string, unknown>;
}) {
  await db.salesQuoteEvent.create({
    data: {
      quoteId: input.quoteId,
      action: input.action,
      actorId: input.actorId ?? null,
      payload: (input.payload ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function listSalesQuotes(options?: {
  status?: SalesQuoteStatus;
  limit?: number;
}) {
  const limit = Math.min(options?.limit ?? 50, 100);
  return db.salesQuote.findMany({
    where: options?.status ? { status: options.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      createdBy: { select: { email: true, firstName: true, lastName: true } },
      discountCode: { select: { code: true, label: true } },
    },
  });
}

export async function getSalesQuoteById(id: string) {
  return db.salesQuote.findUnique({
    where: { id },
    include: {
      events: { orderBy: { createdAt: "asc" }, take: 50 },
      discountCode: true,
      createdBy: { select: { email: true } },
    },
  });
}

export async function getSalesQuoteByOfferToken(token: string) {
  return db.salesQuote.findUnique({
    where: { offerToken: token },
    include: { discountCode: { select: { code: true, label: true } } },
  });
}

export type CreateSalesQuoteInput = {
  createdById: string;
  prospectName?: string | null;
  prospectEmail?: string | null;
  plan: BillingPlanCode;
  propertyCount: number;
  billingInterval?: SalesBillingInterval;
  discountPercent?: number | null;
  discountAmountCop?: number | null;
  overrideMonthlyCop?: number | null;
  discountCode?: string | null;
  notes?: string | null;
  expiresInDays?: number;
};

export async function createSalesQuote(input: CreateSalesQuoteInput) {
  let discountPercent = input.discountPercent;
  let discountAmountCop = input.discountAmountCop;
  let discountCodeId: string | null = null;

  if (input.discountCode?.trim()) {
    const applied = await validateDiscountCodeForQuote({
      code: input.discountCode.trim(),
      plan: input.plan,
      organizationId: null,
    });
    if (!applied.ok) throw new Error(applied.message);
    discountCodeId = applied.discountCodeId;
    if (applied.kind === "PERCENT") {
      discountPercent = Number(applied.value);
      discountAmountCop = 0;
    } else {
      discountAmountCop = Number(applied.value);
    }
  }

  const calc = calculateSalesQuote({
    plan: input.plan,
    propertyCount: input.propertyCount,
    billingInterval: input.billingInterval,
    discountPercent,
    discountAmountCop,
    overrideMonthlyCop: input.overrideMonthlyCop,
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? 14));

  const quote = await db.salesQuote.create({
    data: {
      createdById: input.createdById,
      prospectName: input.prospectName?.trim() || null,
      prospectEmail: input.prospectEmail?.trim().toLowerCase() || null,
      plan: calc.plan,
      propertyCount: calc.propertyCount,
      billingInterval: calc.billingInterval,
      discountPercent: calc.discountPercent,
      discountAmountCop: calc.discountAmountCop,
      discountCodeId,
      listAmountCop: calc.listMonthlyCop,
      savingsAmountCop: calc.savingsCop,
      finalAmountCop: calc.finalMonthlyCop,
      status: "DRAFT",
      expiresAt,
      notes: input.notes?.trim() || null,
    },
  });

  await appendQuoteEvent({
    quoteId: quote.id,
    action: "created",
    actorId: input.createdById,
    payload: { plan: calc.plan, finalMonthlyCop: calc.finalMonthlyCop },
  });

  const creator = await db.user.findUnique({
    where: { id: input.createdById },
    select: { email: true },
  });
  await writePlatformAuditLog({
    platformUserId: input.createdById,
    ownerEmail: creator?.email ?? "platform",
    action: "sales_quote_created",
    newState: { quoteId: quote.id, plan: calc.plan, amount: calc.finalMonthlyCop },
  });

  return quote;
}

export async function issueSalesQuoteOffer(
  quoteId: string,
  actorId: string,
): Promise<{ offerToken: string; offerUrl: string }> {
  const quote = await db.salesQuote.findUnique({ where: { id: quoteId } });
  if (!quote) throw new Error("Cotización no encontrada");
  if (quote.status === "CANCELLED" || quote.status === "CONVERTED") {
    throw new Error("No se puede emitir esta cotización");
  }

  const token = quote.offerToken ?? generateOfferToken();
  const now = new Date();
  if (quote.expiresAt && quote.expiresAt < now) {
    throw new Error("La cotización está vencida");
  }

  await db.salesQuote.update({
    where: { id: quoteId },
    data: {
      offerToken: token,
      status: quote.status === "DRAFT" ? "SENT" : quote.status,
    },
  });

  await appendQuoteEvent({
    quoteId,
    action: "sent",
    actorId,
    payload: { offerToken: token },
  });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "";
  const offerUrl = `${origin.replace(/\/$/, "")}/offer/${token}`;

  return { offerToken: token, offerUrl };
}

export async function markQuoteViewedByToken(token: string) {
  const quote = await db.salesQuote.findUnique({ where: { offerToken: token } });
  if (!quote) return null;
  if (quote.status === "EXPIRED" || quote.status === "CANCELLED") return quote;

  const now = new Date();
  if (quote.expiresAt && quote.expiresAt < now) {
    await db.salesQuote.update({
      where: { id: quote.id },
      data: { status: "EXPIRED" },
    });
    return db.salesQuote.findUnique({ where: { id: quote.id } });
  }

  if (quote.status === "SENT" || quote.status === "DRAFT") {
    await db.salesQuote.update({
      where: { id: quote.id },
      data: { status: "VIEWED" },
    });
    await appendQuoteEvent({
      quoteId: quote.id,
      action: "viewed",
      payload: { tokenHash: createHash("sha256").update(token).digest("hex").slice(0, 12) },
    });
  }

  return db.salesQuote.findUnique({ where: { id: quote.id } });
}

export async function acceptSalesOfferByToken(token: string, email?: string) {
  const quote = await markQuoteViewedByToken(token);
  if (!quote) throw new Error("Oferta no encontrada");
  if (quote.status === "EXPIRED" || quote.status === "CANCELLED") {
    throw new Error("Esta oferta ya no está disponible");
  }
  if (quote.status === "CONVERTED") {
    throw new Error("Esta oferta ya fue utilizada");
  }

  const normalizedEmail = email?.trim().toLowerCase();
  await db.salesQuote.update({
    where: { id: quote.id },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
      prospectEmail: normalizedEmail ?? quote.prospectEmail,
    },
  });

  await appendQuoteEvent({
    quoteId: quote.id,
    action: "accepted",
    payload: { email: normalizedEmail ?? null },
  });

  return quote;
}

export async function cancelSalesQuote(quoteId: string, actorId: string) {
  await db.salesQuote.update({
    where: { id: quoteId },
    data: { status: "CANCELLED" },
  });
  await appendQuoteEvent({ quoteId, action: "cancelled", actorId });
}

export async function expireStaleSalesQuotes(): Promise<number> {
  const now = new Date();
  const result = await db.salesQuote.updateMany({
    where: {
      expiresAt: { lt: now },
      status: { in: ["DRAFT", "SENT", "VIEWED", "ACCEPTED"] },
    },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

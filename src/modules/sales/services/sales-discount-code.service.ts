import "server-only";

import type { BillingPlanCode, SalesDiscountKind } from "@prisma/client";
import { db } from "@/lib/db";
import { clampDiscountPercent } from "@/modules/sales/domain/quote-calculator";

export async function listSalesDiscountCodes() {
  return db.salesDiscountCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      createdBy: { select: { email: true } },
    },
  });
}

export async function createSalesDiscountCode(input: {
  createdById: string;
  code: string;
  label?: string | null;
  kind: SalesDiscountKind;
  value: number;
  scope: "GLOBAL" | "PLAN" | "TENANT";
  plan?: BillingPlanCode | null;
  organizationId?: string | null;
  firstMonthOnly?: boolean;
  recurring?: boolean;
  maxRedemptions?: number | null;
  expiresAt?: Date | null;
}) {
  const code = input.code.trim().toUpperCase();
  if (code.length < 3) throw new Error("Código demasiado corto");

  if (input.kind === "PERCENT") {
    const pct = clampDiscountPercent(input.value);
    if (pct <= 0) throw new Error("El porcentaje debe ser mayor a 0");
  } else if (input.value <= 0) {
    throw new Error("El monto fijo debe ser mayor a 0");
  }

  return db.salesDiscountCode.create({
    data: {
      createdById: input.createdById,
      code,
      label: input.label?.trim() || null,
      kind: input.kind,
      value: input.value,
      scope: input.scope,
      plan: input.scope === "PLAN" ? input.plan ?? null : null,
      organizationId: input.scope === "TENANT" ? input.organizationId ?? null : null,
      firstMonthOnly: input.firstMonthOnly ?? false,
      recurring: input.recurring ?? true,
      maxRedemptions: input.maxRedemptions ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  });
}

export async function validateDiscountCodeForQuote(input: {
  code: string;
  plan: BillingPlanCode;
  organizationId?: string | null;
}): Promise<
  | {
      ok: true;
      discountCodeId: string;
      kind: SalesDiscountKind;
      value: number;
    }
  | { ok: false; message: string }
> {
  const row = await db.salesDiscountCode.findUnique({
    where: { code: input.code.trim().toUpperCase() },
  });

  if (!row || !row.active) {
    return { ok: false, message: "Código de descuento inválido" };
  }

  if (row.expiresAt && row.expiresAt < new Date()) {
    return { ok: false, message: "Código expirado" };
  }

  if (
    row.maxRedemptions != null &&
    row.redemptionCount >= row.maxRedemptions
  ) {
    return { ok: false, message: "Código agotado" };
  }

  if (row.scope === "PLAN" && row.plan && row.plan !== input.plan) {
    return { ok: false, message: "Código no aplica a este plan" };
  }

  if (
    row.scope === "TENANT" &&
    row.organizationId &&
    input.organizationId &&
    row.organizationId !== input.organizationId
  ) {
    return { ok: false, message: "Código no aplica a este tenant" };
  }

  return {
    ok: true,
    discountCodeId: row.id,
    kind: row.kind,
    value: Number(row.value),
  };
}

export async function incrementDiscountRedemption(discountCodeId: string) {
  await db.salesDiscountCode.update({
    where: { id: discountCodeId },
    data: { redemptionCount: { increment: 1 } },
  });
}

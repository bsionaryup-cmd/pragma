import "server-only";

import type { GuestPaymentLink } from "@prisma/client";
import { db } from "@/lib/db";
import { guestPaymentIncomeLabel } from "@/lib/payments/guest-payment-categories";
import {
  assertFinanceDelegates,
  isFinanceSchemaDriftError,
} from "@/services/finance/finance-prisma-guard";

/** Registra ingreso operativo en finanzas (OtherIncome) — idempotente por link. */
export async function ensureFinancialEntryForGuestPayment(
  link: Pick<
    GuestPaymentLink,
    "id" | "organizationId" | "createdById" | "amount" | "currency" | "category" | "description" | "metadata"
  >,
): Promise<string | null> {
  const meta = (link.metadata ?? {}) as Record<string, unknown>;
  if (typeof meta.otherIncomeId === "string") return meta.otherIncomeId;

  try {
    assertFinanceDelegates();
  } catch {
    return null;
  }

  const incomeType = guestPaymentIncomeLabel(link.category);
  const today = new Date();

  try {
    const income = await db.otherIncome.create({
      data: {
        createdById: link.createdById,
        amount: link.amount,
        currency: link.currency,
        incomeType,
        incomeDate: today,
        description: `${link.description} · link:${link.id}`,
      },
    });

    await db.guestPaymentLink.update({
      where: { id: link.id },
      data: {
        metadata: {
          ...meta,
          otherIncomeId: income.id,
          incomeType,
        },
      },
    });

    return income.id;
  } catch (error) {
    if (isFinanceSchemaDriftError(error)) return null;
    throw error;
  }
}

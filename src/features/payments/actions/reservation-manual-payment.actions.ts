"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDbUser, requirePermission } from "@/lib/auth";
import { getServerLocale } from "@/i18n/locale.server";
import {
  createReservationManualPayment,
  listReservationManualPayments,
} from "@/services/payments/reservation-manual-payment.service";
import { getOrganizationPaymentMethods } from "@/services/payments/organization-payment-methods.service";

const manualPaymentMethods = [
  "PAYMENT_LINK",
  "CASH",
  "BANK_TRANSFER",
  "OTHER",
] as const;

const createManualPaymentSchema = z.object({
  reservationId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(manualPaymentMethods),
  paymentReference: z.string().max(120).optional(),
  accountMethodId: z.string().optional(),
  receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
});

export async function listReservationManualPaymentsAction(reservationId: string) {
  await requirePermission("reservations:read");
  const locale = await getServerLocale();
  const payments = await listReservationManualPayments(reservationId, locale);
  return { success: true as const, payments };
}

export async function getOrganizationPaymentMethodsAction() {
  await requirePermission("reservations:read");
  const methods = await getOrganizationPaymentMethods();
  return { success: true as const, methods };
}

export async function createReservationManualPaymentAction(
  raw: z.infer<typeof createManualPaymentSchema>,
) {
  await requirePermission("finance:write");
  const user = await requireDbUser();
  const parsed = createManualPaymentSchema.parse(raw);

  if (parsed.method === "PAYMENT_LINK") {
    return {
      success: false as const,
      error: "Usa enlaces de pago para cobros por link",
    };
  }

  try {
    await createReservationManualPayment({
      ...parsed,
      createdById: user.id,
    });
    revalidatePath("/reservations");
    revalidatePath("/calendar");
    revalidatePath("/finance");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "No se pudo registrar el pago",
    };
  }
}

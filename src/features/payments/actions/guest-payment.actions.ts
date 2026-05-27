"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { GuestPaymentCategory } from "@prisma/client";
import { requireDbUser, requirePermission } from "@/lib/auth";
import {
  cancelGuestPaymentLink,
  createGuestPaymentLinkDraft,
  createReservationPaymentLink,
  duplicateGuestPaymentLink,
  issueGuestPaymentLink,
  listGuestPaymentLinksForReservation,
} from "@/services/payments/guest-payment-link.service";
import { getReservationPaymentBalance } from "@/services/payments/reservation-payment-balance";
import {
  listGuestPaymentHistoryByName,
  listOrganizationPaymentHistory,
  listReservationPaymentHistory,
} from "@/services/payments/payment-history.service";
import { getServerLocale } from "@/i18n/locale.server";
import { serializeGuestPaymentLink } from "@/lib/payments/guest-payment-link-serializer";

const manualLinkSchema = z.object({
  category: z.enum([
    "RESERVATION_FULL",
    "DEPOSIT",
    "REMAINING_BALANCE",
    "DAMAGE_FEE",
    "CLEANING_FEE",
    "LATE_CHECKOUT",
    "EXTRA_SERVICES",
    "MANUAL_OPERATIONAL",
  ]),
  description: z.string().min(3).max(200),
  amount: z.number().positive(),
  currency: z.string().optional(),
  reservationId: z.string().optional(),
  propertyId: z.string().optional(),
  guestName: z.string().optional(),
  notes: z.string().optional(),
  issue: z.boolean().optional(),
});

export async function getReservationPaymentBalanceAction(reservationId: string) {
  await requirePermission("reservations:read");
  const balance = await getReservationPaymentBalance(reservationId);
  return { success: true as const, balance };
}

export async function listReservationPaymentLinksAction(reservationId: string) {
  await requirePermission("reservations:read");
  const links = (await listGuestPaymentLinksForReservation(reservationId)).map(
    serializeGuestPaymentLink,
  );
  return { success: true as const, links };
}

export async function createReservationPaymentLinkAction(input: {
  reservationId: string;
  mode: "full" | "deposit_50" | "remaining" | "custom";
  customAmount?: number;
  category?: GuestPaymentCategory;
  description?: string;
  issue?: boolean;
}) {
  await requirePermission("finance:write");
  const user = await requireDbUser();

  try {
    const link = await createReservationPaymentLink({
      ...input,
      createdById: user.id,
      issue: input.issue ?? true,
    });
    revalidatePath("/reservations");
    revalidatePath("/finance/payment-links");
    revalidatePath("/finance");
    return { success: true as const, link: serializeGuestPaymentLink(link) };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error al crear enlace",
    };
  }
}

export async function createManualPaymentLinkAction(
  raw: z.infer<typeof manualLinkSchema>,
) {
  await requirePermission("finance:write");
  const user = await requireDbUser();
  const parsed = manualLinkSchema.parse(raw);

  try {
    const draft = await createGuestPaymentLinkDraft({
      ...parsed,
      category: parsed.category as GuestPaymentCategory,
      createdById: user.id,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    const link = parsed.issue
      ? await issueGuestPaymentLink(draft.id)
      : draft;

    revalidatePath("/finance/payment-links");
    revalidatePath("/reservations");
    return {
      success: true as const,
      link: serializeGuestPaymentLink(link),
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error al crear enlace",
    };
  }
}

export async function issuePaymentLinkAction(linkId: string) {
  await requirePermission("finance:write");
  try {
    const link = await issueGuestPaymentLink(linkId);
    revalidatePath("/finance/payment-links");
    return { success: true as const, link: serializeGuestPaymentLink(link) };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error al emitir enlace",
    };
  }
}

export async function cancelPaymentLinkAction(linkId: string) {
  await requirePermission("finance:write");
  try {
    await cancelGuestPaymentLink(linkId);
    revalidatePath("/finance/payment-links");
    revalidatePath("/finance/payment-history");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error al cancelar",
    };
  }
}

export async function duplicatePaymentLinkAction(linkId: string) {
  await requirePermission("finance:write");
  const user = await requireDbUser();
  try {
    const link = await duplicateGuestPaymentLink(linkId, user.id);
    revalidatePath("/finance/payment-links");
    revalidatePath("/reservations");
    return { success: true as const, link: serializeGuestPaymentLink(link) };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error al duplicar",
    };
  }
}

export async function getOrganizationPaymentHistoryAction() {
  await requirePermission("finance:read");
  const locale = await getServerLocale();
  const rows = await listOrganizationPaymentHistory(locale);
  return { success: true as const, rows };
}

export async function getReservationPaymentHistoryAction(reservationId: string) {
  await requirePermission("reservations:read");
  const locale = await getServerLocale();
  const rows = await listReservationPaymentHistory(reservationId, locale);
  return { success: true as const, rows };
}

export async function searchGuestPaymentHistoryAction(guestName: string) {
  await requirePermission("finance:read");
  const locale = await getServerLocale();
  const rows = await listGuestPaymentHistoryByName(guestName, locale);
  return { success: true as const, rows };
}

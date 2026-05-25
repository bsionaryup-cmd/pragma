import "server-only";

import type { GuestPaymentLinkStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { guestPaymentIncomeLabel } from "@/lib/payments/guest-payment-categories";
import { guestPaymentLinkStatusLabel } from "@/lib/payments/guest-payment-link-labels";
import { formatMoney } from "@/lib/format-currency";
import type { Locale } from "@/i18n/types";

export type PaymentHistoryRow = {
  id: string;
  description: string;
  amount: number;
  amountFormatted: string;
  currency: string;
  status: GuestPaymentLinkStatus;
  statusLabel: string;
  category: string;
  incomeCategory: string;
  guestName: string | null;
  reservationId: string | null;
  propertyLabel: string | null;
  paidAt: string | null;
  createdAt: string;
};

export async function listOrganizationPaymentHistory(
  locale: Locale = "es",
  limit = 80,
): Promise<PaymentHistoryRow[]> {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) return [];

  const links = await db.guestPaymentLink.findMany({
    where: { organizationId: scope.organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      reservation: {
        select: {
          id: true,
          guestName: true,
          checkIn: true,
          property: { select: { name: true, unitNumber: true } },
        },
      },
      property: { select: { name: true, unitNumber: true } },
    },
  });

  return links.map((link) => {
    const propertyLabel = link.reservation?.property
      ? `${link.reservation.property.name}${link.reservation.property.unitNumber ? ` · ${link.reservation.property.unitNumber}` : ""}`
      : link.property
        ? `${link.property.name}${link.property.unitNumber ? ` · ${link.property.unitNumber}` : ""}`
        : null;

    return {
      id: link.id,
      description: link.description,
      amount: Number(link.amount),
      amountFormatted: formatMoney(Number(link.amount), link.currency, locale),
      currency: link.currency,
      status: link.status,
      statusLabel: guestPaymentLinkStatusLabel(link.status),
      category: link.category,
      incomeCategory: guestPaymentIncomeLabel(link.category),
      guestName: link.guestName ?? link.reservation?.guestName ?? null,
      reservationId: link.reservationId,
      propertyLabel,
      paidAt: link.status === "PAID" ? link.updatedAt.toISOString() : null,
      createdAt: link.createdAt.toISOString(),
    };
  });
}

export async function listReservationPaymentHistory(
  reservationId: string,
  locale: Locale = "es",
): Promise<PaymentHistoryRow[]> {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) return [];

  const links = await db.guestPaymentLink.findMany({
    where: { reservationId, organizationId: scope.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      reservation: {
        select: {
          guestName: true,
          property: { select: { name: true, unitNumber: true } },
        },
      },
    },
  });

  return links.map((link) => ({
    id: link.id,
    description: link.description,
    amount: Number(link.amount),
    amountFormatted: formatMoney(Number(link.amount), link.currency, locale),
    currency: link.currency,
    status: link.status,
    statusLabel: guestPaymentLinkStatusLabel(link.status),
    category: link.category,
    incomeCategory: guestPaymentIncomeLabel(link.category),
    guestName: link.guestName ?? link.reservation?.guestName ?? null,
    reservationId: link.reservationId,
    propertyLabel: link.reservation?.property
      ? link.reservation.property.name
      : null,
    paidAt: link.status === "PAID" ? link.updatedAt.toISOString() : null,
    createdAt: link.createdAt.toISOString(),
  }));
}

export async function listGuestPaymentHistoryByName(
  guestNameQuery: string,
  locale: Locale = "es",
): Promise<PaymentHistoryRow[]> {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId || !guestNameQuery.trim()) return [];

  const links = await db.guestPaymentLink.findMany({
    where: {
      organizationId: scope.organizationId,
      OR: [
        { guestName: { contains: guestNameQuery.trim(), mode: "insensitive" } },
        {
          reservation: {
            guestName: { contains: guestNameQuery.trim(), mode: "insensitive" },
          },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      reservation: { select: { guestName: true } },
    },
  });

  return links.map((link) => ({
    id: link.id,
    description: link.description,
    amount: Number(link.amount),
    amountFormatted: formatMoney(Number(link.amount), link.currency, locale),
    currency: link.currency,
    status: link.status,
    statusLabel: guestPaymentLinkStatusLabel(link.status),
    category: link.category,
    incomeCategory: guestPaymentIncomeLabel(link.category),
    guestName: link.guestName ?? link.reservation?.guestName ?? null,
    reservationId: link.reservationId,
    propertyLabel: null,
    paidAt: link.status === "PAID" ? link.updatedAt.toISOString() : null,
    createdAt: link.createdAt.toISOString(),
  }));
}

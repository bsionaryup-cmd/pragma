import "server-only";

import type { BookingPlatform, GuestPaymentCategory, GuestPaymentLinkStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveFinanceGuestDisplayName } from "@/lib/finance/finance-guest-display";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { guestPaymentIncomeLabel } from "@/lib/payments/guest-payment-categories";
import { guestPaymentLinkStatusLabel } from "@/lib/payments/guest-payment-link-labels";
import { formatPropertyLabel } from "@/lib/property-display";
import { formatMoney } from "@/lib/format-currency";
import type { Locale } from "@/i18n/types";
import { loadReservationRevenueSourcesByReservationId } from "@/services/finance/reservation-revenue-context.service";

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

const reservationGuestSelect = {
  id: true,
  guestName: true,
  platform: true,
  guestRegistrationCompletedAt: true,
  checkIn: true,
  property: { select: { name: true, unitNumber: true } },
} as const;

function resolveLinkGuestName(
  link: { guestName: string | null },
  reservation:
    | {
        id: string;
        guestName: string;
        platform: BookingPlatform;
        guestRegistrationCompletedAt: Date | null;
      }
    | null
    | undefined,
  revenueSourcesByReservationId: Awaited<
    ReturnType<typeof loadReservationRevenueSourcesByReservationId>
  >,
): string | null {
  if (reservation) {
    return resolveFinanceGuestDisplayName(
      {
        platform: reservation.platform,
        guestName: reservation.guestName,
        guestRegistrationCompletedAt: reservation.guestRegistrationCompletedAt,
      },
      revenueSourcesByReservationId.get(reservation.id),
    );
  }
  return link.guestName?.trim() || null;
}

async function loadRevenueSourcesForLinks(
  links: Array<{ reservationId: string | null }>,
) {
  const reservationIds = [
    ...new Set(
      links
        .map((link) => link.reservationId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  return loadReservationRevenueSourcesByReservationId(reservationIds);
}

function mapPaymentHistoryRows(
  links: Array<{
    id: string;
    description: string;
    amount: unknown;
    currency: string;
    status: GuestPaymentLinkStatus;
    category: GuestPaymentCategory;
    guestName: string | null;
    reservationId: string | null;
    updatedAt: Date;
    createdAt: Date;
    reservation?: {
      id: string;
      guestName: string;
      platform: BookingPlatform;
      guestRegistrationCompletedAt: Date | null;
      property?: { name: string; unitNumber: string | null } | null;
    } | null;
    property?: { name: string; unitNumber: string | null } | null;
  }>,
  revenueSourcesByReservationId: Awaited<
    ReturnType<typeof loadReservationRevenueSourcesByReservationId>
  >,
  locale: Locale,
  propertyFromLink = true,
): PaymentHistoryRow[] {
  return links.map((link) => {
    const propertyLabel = link.reservation?.property
      ? formatPropertyLabel(link.reservation.property)
      : propertyFromLink && link.property
        ? formatPropertyLabel(link.property)
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
      guestName: resolveLinkGuestName(
        link,
        link.reservation,
        revenueSourcesByReservationId,
      ),
      reservationId: link.reservationId,
      propertyLabel,
      paidAt: link.status === "PAID" ? link.updatedAt.toISOString() : null,
      createdAt: link.createdAt.toISOString(),
    };
  });
}

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
      reservation: { select: reservationGuestSelect },
      property: { select: { name: true, unitNumber: true } },
    },
  });

  const revenueSourcesByReservationId =
    await loadRevenueSourcesForLinks(links);

  return mapPaymentHistoryRows(
    links,
    revenueSourcesByReservationId,
    locale,
    true,
  );
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
      reservation: { select: reservationGuestSelect },
    },
  });

  const revenueSourcesByReservationId =
    await loadRevenueSourcesForLinks(links);

  return mapPaymentHistoryRows(
    links,
    revenueSourcesByReservationId,
    locale,
    false,
  );
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
      reservation: { select: reservationGuestSelect },
    },
  });

  const revenueSourcesByReservationId =
    await loadRevenueSourcesForLinks(links);

  return mapPaymentHistoryRows(
    links,
    revenueSourcesByReservationId,
    locale,
    false,
  );
}

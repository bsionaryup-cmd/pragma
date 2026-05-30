import "server-only";

import {
  AirbnbEmailEventKind,
  ReservationActivityType,
  ReservationEventType,
  ReservationStatus,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { dateKeyToPrismaDate, todayDateKeyInTimezone } from "@/lib/dates";
import { formatPropertyLabel } from "@/lib/property-display";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import {
  mergeReservationScope,
  propertyWhere,
} from "@/lib/platform/tenant-data-scope";
import {
  buildOperationalCard,
  formatGuestCountLine,
  formatPayoutAmount,
  formatReservationRange,
  quoteSummary,
} from "@/services/novedades/operational-feed.present";
import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";
import { resolveReservationGuestCounts } from "@/lib/reservations/display-guest-count";
import { extractGuestCountsFromReservationEmailEvent } from "@/services/reservations/airbnb-display-guest-count.service";

const reservationSelect = {
  id: true,
  guestName: true,
  checkIn: true,
  checkOut: true,
  totalAmount: true,
  currency: true,
  adults: true,
  children: true,
  infants: true,
  property: {
    select: { id: true, name: true, unitNumber: true, city: true },
  },
} as const;

function auditWhere(scope: TenantDataScope): Prisma.EmailIngestionAuditWhereInput {
  return scope.organizationId != null
    ? { organizationId: scope.organizationId }
    : { property: propertyWhere(scope) };
}

function reservationEventWhere(
  scope: TenantDataScope,
): Prisma.ReservationEventWhereInput {
  return scope.organizationId != null
    ? { organizationId: scope.organizationId }
    : { property: propertyWhere(scope) };
}

function guestMessageActivityWhere(
  scope: TenantDataScope,
): Prisma.ReservationActivityWhereInput {
  const reservationScope: Prisma.ReservationWhereInput = scope.organizationId
    ? { property: { organizationId: scope.organizationId } }
    : { property: propertyWhere(scope) };

  return {
    activityType: ReservationActivityType.AIRBNB_MESSAGE,
    reservation: reservationScope,
  };
}

function guestMessagePendingWhere(
  scope: TenantDataScope,
): Prisma.ReservationActivityPendingWhereInput {
  if (scope.organizationId != null) {
    return {
      organizationId: scope.organizationId,
      activityType: ReservationActivityType.AIRBNB_MESSAGE,
    };
  }

  return {
    activityType: ReservationActivityType.AIRBNB_MESSAGE,
    property: propertyWhere(scope),
  };
}

function readMetadataGuest(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const guestName = (metadata as { guestName?: unknown }).guestName;
  return typeof guestName === "string" && guestName.trim() ? guestName.trim() : null;
}

function readMetadataConfirmationCode(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const code = (metadata as { confirmationCode?: unknown }).confirmationCode;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}

function readMetadataDates(metadata: unknown): {
  original?: string | null;
  requested?: string | null;
} {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const value = metadata as {
    originalDates?: { raw?: unknown };
    requestedDates?: { raw?: unknown };
  };
  const original =
    typeof value.originalDates?.raw === "string" ? value.originalDates.raw : null;
  const requested =
    typeof value.requestedDates?.raw === "string" ? value.requestedDates.raw : null;
  return { original, requested };
}

function readActivityGuestName(input: {
  senderName: string | null | undefined;
  metadata: unknown;
  reservationGuestName: string | null | undefined;
}): string | null {
  const sender = input.senderName?.trim() || null;
  if (sender && !/te envi[oó] un mensaje|message from|mensaje sobre su reserva/i.test(sender)) {
    return sender;
  }
  return readMetadataGuest(input.metadata) ?? input.reservationGuestName?.trim() ?? sender;
}

function propertyLabelFromReservation(
  reservation: {
    property: { id: string; name: string; unitNumber: string | null; city: string } | null;
  } | null,
): string | null {
  return reservation?.property ? formatPropertyLabel(reservation.property) : null;
}

function propertyIdFromReservation(
  reservation: { property: { id: string } | null } | null,
): string | null {
  return reservation?.property?.id ?? null;
}

function mapModificationEvent(
  row: Awaited<
    ReturnType<
      typeof db.reservationEvent.findMany<{
        include: {
          property: { select: { name: true; unitNumber: true; city: true } };
          reservation: { select: typeof reservationSelect };
        };
      }>
    >
  >[number],
): OperationalFeedCard {
  const metadata = row.metadataJson;
  const guestName = readMetadataGuest(metadata) ?? row.reservation?.guestName ?? null;
  const { original, requested } = readMetadataDates(metadata);
  const detailLines: string[] = [];

  if (row.eventType === ReservationEventType.MODIFICATION_REQUEST) {
    if (original) detailLines.push(`Original: ${original}`);
    if (requested) detailLines.push(`Solicitado: ${requested}`);
  }

  const kind =
    row.eventType === ReservationEventType.MODIFICATION_REQUEST
      ? "MODIFICATION_REQUEST"
      : "MODIFICATION_APPROVED";

  const confirmationCode = readMetadataConfirmationCode(metadata);

  return buildOperationalCard({
    id: `event:${row.id}`,
    kind,
    createdAt: row.createdAt,
    guestName,
    summary:
      kind === "MODIFICATION_APPROVED"
        ? "Airbnb confirmó la modificación."
        : detailLines.length > 0
          ? null
          : row.description,
    propertyLabel:
      (row.property ? formatPropertyLabel(row.property) : null) ??
      propertyLabelFromReservation(row.reservation),
    propertyId: row.propertyId ?? propertyIdFromReservation(row.reservation),
    reservationId: row.reservationId,
    confirmationCode,
    dateRangeLabel:
      row.reservation?.checkIn && row.reservation?.checkOut
        ? formatReservationRange(row.reservation.checkIn, row.reservation.checkOut)
        : null,
    detailLines,
  });
}

function mapGuestMessageActivity(
  row: Awaited<
    ReturnType<
      typeof db.reservationActivity.findMany<{
        include: {
          property: { select: { name: true; unitNumber: true; city: true } };
          reservation: { select: typeof reservationSelect };
        };
      }>
    >
  >[number],
): OperationalFeedCard {
  return buildOperationalCard({
    id: `activity:${row.id}`,
    kind: "GUEST_MESSAGE",
    createdAt: row.createdAt,
    guestName: readActivityGuestName({
      senderName: row.senderName,
      metadata: row.metadataJson,
      reservationGuestName: row.reservation.guestName,
    }),
    summary: quoteSummary(row.content),
    propertyLabel:
      (row.property ? formatPropertyLabel(row.property) : null) ??
      propertyLabelFromReservation(row.reservation),
    propertyId: row.propertyId ?? propertyIdFromReservation(row.reservation),
    reservationId: row.reservationId,
    confirmationCode: readMetadataConfirmationCode(row.metadataJson),
    dateRangeLabel: formatReservationRange(row.reservation.checkIn, row.reservation.checkOut),
  });
}

function mapGuestMessagePending(
  row: Awaited<
    ReturnType<
      typeof db.reservationActivityPending.findMany<{
        include: {
          property: { select: { name: true; unitNumber: true; city: true } };
        };
      }>
    >
  >[number],
): OperationalFeedCard {
  return buildOperationalCard({
    id: `pending:${row.id}`,
    kind: "GUEST_MESSAGE",
    createdAt: row.createdAt,
    guestName: readActivityGuestName({
      senderName: row.senderName,
      metadata: row.metadataJson,
      reservationGuestName: null,
    }),
    summary: quoteSummary(row.content),
    propertyLabel: row.property ? formatPropertyLabel(row.property) : null,
    propertyId: row.propertyId,
    reservationId: null,
  });
}

function mapPayout(
  row: Awaited<
    ReturnType<
      typeof db.reservationPayout.findMany<{
        include: {
          reservation: { select: typeof reservationSelect };
          audit: { select: { createdAt: true } };
        };
      }>
    >
  >[number],
): OperationalFeedCard {
  const amount =
    row.netPayout != null
      ? Number(row.netPayout.toString())
      : row.grossAmount != null
        ? Number(row.grossAmount.toString())
        : null;

  const guestName = row.reservation?.guestName ?? null;
  const propertyLabel = propertyLabelFromReservation(row.reservation);
  const detailLines: string[] = [];
  if (guestName) detailLines.push(`Reserva: ${guestName}`);
  if (propertyLabel) detailLines.push(`Propiedad: ${propertyLabel}`);

  return buildOperationalCard({
    id: `payout:${row.id}`,
    kind: "PAYOUT_SENT",
    createdAt: row.createdAt,
    amountLabel: formatPayoutAmount(amount, row.currency),
    summary: "Pago procesado a la cuenta del anfitrión.",
    propertyLabel,
    propertyId: propertyIdFromReservation(row.reservation),
    reservationId: row.reservationId,
    detailLines,
    dateRangeLabel:
      row.reservation?.checkIn && row.reservation?.checkOut
        ? formatReservationRange(row.reservation.checkIn, row.reservation.checkOut)
        : null,
  });
}

function mapEmailEvent(
  row: Awaited<
    ReturnType<
      typeof db.reservationEmailEvent.findMany<{
        include: {
          reservation: { select: typeof reservationSelect };
          audit: { select: { createdAt: true; subject: true } };
        };
      }>
    >
  >[number],
): OperationalFeedCard | null {
  if (row.eventKind === AirbnbEmailEventKind.CONFIRMED) {
    const guestCounts = resolveReservationGuestCounts({
      adults: row.reservation?.adults ?? 1,
      children: row.reservation?.children ?? 0,
      infants: row.reservation?.infants ?? 0,
      enrichment: extractGuestCountsFromReservationEmailEvent({
        enrichedFields: row.enrichedFields,
        payload: row.payload,
      }),
    });
    const guestLine = formatGuestCountLine(guestCounts);
    const amount =
      row.reservation?.totalAmount != null
        ? Number(row.reservation.totalAmount.toString())
        : null;

    return buildOperationalCard({
      id: `email-event:${row.id}`,
      kind: "NEW_RESERVATION",
      createdAt: row.createdAt,
      guestName: row.reservation?.guestName ?? null,
      propertyLabel: propertyLabelFromReservation(row.reservation),
      propertyId: propertyIdFromReservation(row.reservation),
      reservationId: row.reservationId,
      confirmationCode: row.confirmationCode,
      dateRangeLabel:
        row.reservation?.checkIn && row.reservation?.checkOut
          ? formatReservationRange(row.reservation.checkIn, row.reservation.checkOut)
          : null,
      amountLabel:
        amount != null && row.reservation
          ? formatPayoutAmount(amount, row.reservation.currency)
          : null,
      detailLines: [
        ...(guestLine ? [guestLine] : []),
        ...(row.confirmationCode ? [`Código: ${row.confirmationCode}`] : []),
      ],
    });
  }

  if (row.eventKind === AirbnbEmailEventKind.CANCELED) {
    return buildOperationalCard({
      id: `email-event:${row.id}`,
      kind: "RESERVATION_CANCELLED",
      createdAt: row.createdAt,
      guestName: row.reservation?.guestName ?? null,
      summary: "Airbnb confirmó la cancelación de la reserva.",
      propertyLabel: propertyLabelFromReservation(row.reservation),
      propertyId: propertyIdFromReservation(row.reservation),
      reservationId: row.reservationId,
      confirmationCode: row.confirmationCode,
      dateRangeLabel:
        row.reservation?.checkIn && row.reservation?.checkOut
          ? formatReservationRange(row.reservation.checkIn, row.reservation.checkOut)
          : null,
    });
  }

  if (row.eventKind === AirbnbEmailEventKind.CHECKIN_REMINDER) {
    return buildOperationalCard({
      id: `email-event:${row.id}`,
      kind: "UPCOMING_CHECKIN",
      createdAt: row.createdAt,
      guestName: row.reservation?.guestName ?? null,
      propertyLabel: propertyLabelFromReservation(row.reservation),
      propertyId: propertyIdFromReservation(row.reservation),
      reservationId: row.reservationId,
      confirmationCode: row.confirmationCode,
      dateRangeLabel:
        row.reservation?.checkIn && row.reservation?.checkOut
          ? formatReservationRange(row.reservation.checkIn, row.reservation.checkOut)
          : null,
      detailLines: row.reservation?.checkIn
        ? [`Check-in: ${formatReservationRange(row.reservation.checkIn, row.reservation.checkIn)}`]
        : [],
    });
  }

  return null;
}

function mapUpcomingReservation(
  row: Awaited<
    ReturnType<
      typeof db.reservation.findMany<{
        select: typeof reservationSelect;
      }>
    >
  >[number],
  kind: "UPCOMING_CHECKIN" | "UPCOMING_CHECKOUT",
): OperationalFeedCard {
  const todayKey = todayDateKeyInTimezone();
  const today = dateKeyToPrismaDate(todayKey);
  const targetDate = kind === "UPCOMING_CHECKIN" ? row.checkIn : row.checkOut;
  const detailLines =
    kind === "UPCOMING_CHECKIN"
      ? [`Check-in: ${targetDate.getTime() === today.getTime() ? "Hoy" : formatReservationRange(targetDate, targetDate)}`]
      : [`Check-out: ${targetDate.getTime() === today.getTime() ? "Hoy" : formatReservationRange(targetDate, targetDate)}`];

  return buildOperationalCard({
    id: `${kind.toLowerCase()}:${row.id}`,
    kind,
    createdAt: new Date(),
    guestName: row.guestName,
    propertyLabel: propertyLabelFromReservation(row),
    propertyId: propertyIdFromReservation(row),
    reservationId: row.id,
    dateRangeLabel: formatReservationRange(row.checkIn, row.checkOut),
    detailLines,
  });
}

export async function listNovedadesFeedForTenant(
  scope: TenantDataScope,
  limit = 60,
): Promise<OperationalFeedCard[]> {
  const take = Math.min(Math.max(limit, 1), 120);
  const payouts = await db.reservationPayout.findMany({
    where: { audit: auditWhere(scope) },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      reservation: { select: reservationSelect },
      audit: { select: { createdAt: true } },
    },
  });

  return payouts.map(mapPayout);
}

export async function listOperationalFeedForTenant(
  scope: TenantDataScope,
  limit = 60,
): Promise<OperationalFeedCard[]> {
  const take = Math.min(Math.max(limit, 1), 120);
  const todayKey = todayDateKeyInTimezone();
  const today = dateKeyToPrismaDate(todayKey);
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + 2);

  const [
    modificationEvents,
    guestActivities,
    guestPending,
    payouts,
    emailEvents,
    upcomingCheckIns,
    upcomingCheckOuts,
  ] = await Promise.all([
    db.reservationEvent.findMany({
      where: reservationEventWhere(scope),
      orderBy: { createdAt: "desc" },
      take,
      include: {
        property: { select: { name: true, unitNumber: true, city: true } },
        reservation: { select: reservationSelect },
      },
    }),
    db.reservationActivity.findMany({
      where: guestMessageActivityWhere(scope),
      orderBy: { createdAt: "desc" },
      take,
      include: {
        property: { select: { name: true, unitNumber: true, city: true } },
        reservation: { select: reservationSelect },
      },
    }),
    db.reservationActivityPending.findMany({
      where: guestMessagePendingWhere(scope),
      orderBy: { createdAt: "desc" },
      take,
      include: {
        property: { select: { id: true, name: true, unitNumber: true, city: true } },
      },
    }),
    db.reservationPayout.findMany({
      where: { audit: auditWhere(scope) },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        reservation: { select: reservationSelect },
        audit: { select: { createdAt: true } },
      },
    }),
    db.reservationEmailEvent.findMany({
      where: {
        eventKind: {
          in: [
            AirbnbEmailEventKind.CONFIRMED,
            AirbnbEmailEventKind.CHECKIN_REMINDER,
            AirbnbEmailEventKind.CANCELED,
          ],
        },
        audit: auditWhere(scope),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        reservation: { select: reservationSelect },
        audit: { select: { createdAt: true, subject: true } },
      },
    }),
    db.reservation.findMany({
      where: mergeReservationScope(scope, {
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
        checkIn: { gte: today, lte: horizon },
      }),
      select: reservationSelect,
      orderBy: { checkIn: "asc" },
      take: 8,
    }),
    db.reservation.findMany({
      where: mergeReservationScope(scope, {
        status: {
          in: [
            ReservationStatus.CONFIRMED,
            ReservationStatus.CHECKED_IN,
            ReservationStatus.CHECKOUT_TODAY,
          ],
        },
        checkOut: { gte: today, lte: horizon },
      }),
      select: reservationSelect,
      orderBy: { checkOut: "asc" },
      take: 8,
    }),
  ]);

  const reminderReservationIds = new Set(
    emailEvents
      .filter((row) => row.eventKind === AirbnbEmailEventKind.CHECKIN_REMINDER)
      .map((row) => row.reservationId)
      .filter(Boolean) as string[],
  );

  const cards: OperationalFeedCard[] = [
    ...modificationEvents.map(mapModificationEvent),
    ...guestActivities.map(mapGuestMessageActivity),
    ...guestPending.map(mapGuestMessagePending),
    ...payouts.map(mapPayout),
    ...emailEvents.map(mapEmailEvent).filter((row): row is OperationalFeedCard => row != null),
    ...upcomingCheckIns
      .filter((row) => !reminderReservationIds.has(row.id))
      .map((row) => mapUpcomingReservation(row, "UPCOMING_CHECKIN")),
    ...upcomingCheckOuts.map((row) => mapUpcomingReservation(row, "UPCOMING_CHECKOUT")),
  ];

  return cards
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, take);
}

export async function getLatestOperationalFeedTimestamp(
  scope: TenantDataScope,
): Promise<{ latestAt: string | null; latestId: string | null }> {
  const payout = await db.reservationPayout.findFirst({
    where: { audit: auditWhere(scope) },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });

  if (!payout) return { latestAt: null, latestId: null };

  return {
    latestAt: payout.createdAt.toISOString(),
    latestId: `payout:${payout.id}`,
  };
}

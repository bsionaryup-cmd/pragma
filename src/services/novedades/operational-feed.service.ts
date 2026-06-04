import "server-only";

import {
  AirbnbEmailEventKind,
  BookingPlatform,
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
import { buildQuickMessage } from "@/lib/reservations/quick-messages";
import {
  formatPropertyAddressForMessage,
  parsePropertyQuickMessageTemplates,
} from "@/lib/reservations/quick-message-templates";
import { parsePropertyNotificationEmails } from "@/lib/property-notification-emails";
import { buildGuestRegistrationUrl } from "@/services/guests/guest-registration.service";

const reservationSelect = {
  id: true,
  guestName: true,
  checkIn: true,
  checkOut: true,
  status: true,
  totalAmount: true,
  currency: true,
  adults: true,
  children: true,
  infants: true,
  guestRegistrationToken: true,
  guestRegistrationCompletedAt: true,
  createdAt: true,
  property: {
    select: {
      id: true,
      name: true,
      unitNumber: true,
      city: true,
      address: true,
      checkInTime: true,
      checkOutTime: true,
      accessCode: true,
      wifiName: true,
      wifiPassword: true,
      neighborhood: true,
      receptionWhatsapp: true,
      quickMessageTemplates: true,
    },
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
    if (row.reservation?.status !== ReservationStatus.CANCELLED) {
      return null;
    }

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
    const todayKey = todayDateKeyInTimezone();
    const today = dateKeyToPrismaDate(todayKey);
    const checkIn = row.reservation?.checkIn;
    if (!checkIn || checkIn < today) {
      return null;
    }

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

async function listGuestRegistrationAdminNotificationCards(
  scope: TenantDataScope,
): Promise<OperationalFeedCard[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const rows = await db.reservation.findMany({
    where: mergeReservationScope(scope, {
      guestRegistrationCompletedAt: { gte: sevenDaysAgo },
      OR: [
        { guestRegistrationAdminNotifiedAt: { gte: sevenDaysAgo } },
        {
          guestRegistrationAdminNotifiedAt: null,
          guestRegistrationAdminNotificationError: { not: null },
        },
      ],
    }),
    orderBy: { guestRegistrationCompletedAt: "desc" },
    take: 40,
    select: {
      id: true,
      guestName: true,
      reservationCode: true,
      checkIn: true,
      checkOut: true,
      guestRegistrationCompletedAt: true,
      guestRegistrationAdminNotifiedAt: true,
      guestRegistrationAdminNotificationError: true,
      property: {
        select: {
          id: true,
          name: true,
          unitNumber: true,
          notificationEmails: true,
        },
      },
    },
  });

  const cards: OperationalFeedCard[] = [];

  for (const row of rows) {
    if (!row.guestRegistrationCompletedAt) continue;

    const propertyLabel = formatPropertyLabel(row.property);
    const dateRangeLabel = formatReservationRange(row.checkIn, row.checkOut);
    const recipients = parsePropertyNotificationEmails(row.property.notificationEmails);
    const recipientsLine =
      recipients.length > 0 ? `Destinatarios: ${recipients.join(", ")}` : null;

    if (row.guestRegistrationAdminNotifiedAt) {
      cards.push(
        buildOperationalCard({
          id: `guest-reg-admin:sent:${row.id}`,
          kind: "GUEST_REGISTRATION_ADMIN_SENT",
          createdAt: row.guestRegistrationAdminNotifiedAt,
          guestName: row.guestName,
          summary: "Registro completado y enviado a administración.",
          propertyLabel,
          propertyId: row.property.id,
          reservationId: row.id,
          confirmationCode: row.reservationCode,
          dateRangeLabel,
          detailLines: recipientsLine ? [recipientsLine] : [],
        }),
      );
      continue;
    }

    if (row.guestRegistrationAdminNotificationError) {
      cards.push(
        buildOperationalCard({
          id: `guest-reg-admin:failed:${row.id}`,
          kind: "GUEST_REGISTRATION_ADMIN_FAILED",
          createdAt: row.guestRegistrationCompletedAt,
          guestName: row.guestName,
          summary:
            "Registro completado, pero falló el envío a administración.",
          propertyLabel,
          propertyId: row.property.id,
          reservationId: row.id,
          confirmationCode: row.reservationCode,
          dateRangeLabel,
          detailLines: [
            ...(recipientsLine ? [recipientsLine] : []),
            `Error: ${row.guestRegistrationAdminNotificationError}`,
          ],
        }),
      );
    }
  }

  return cards;
}

export async function listNovedadesFeedForTenant(
  scope: TenantDataScope,
  limit = 60,
): Promise<OperationalFeedCard[]> {
  return listOperationalFeedForTenant(scope, limit);
}

export async function listOperationalFeedForTenant(
  scope: TenantDataScope,
  limit = 60,
): Promise<OperationalFeedCard[]> {
  const take = Math.min(Math.max(limit, 1), 120);

  const quickMessageDataFromReservation = (
    reservation: {
      guestName: string;
      property: {
        name: string;
        address: string;
        neighborhood: string | null;
        checkInTime: string | null;
        checkOutTime: string | null;
        accessCode: string | null;
        wifiName: string | null;
        wifiPassword: string | null;
        receptionWhatsapp: string | null;
      };
      guestRegistrationToken: string | null;
    },
  ) => ({
    guestName: reservation.guestName,
    propertyName: reservation.property.name,
    address: formatPropertyAddressForMessage({
      address: reservation.property.address,
      neighborhood: reservation.property.neighborhood,
    }),
    checkInTime: reservation.property.checkInTime,
    checkOutTime: reservation.property.checkOutTime,
    accessCode: reservation.property.accessCode,
    wifiName: reservation.property.wifiName,
    wifiPassword: reservation.property.wifiPassword,
    receptionWhatsapp: reservation.property.receptionWhatsapp,
    registrationLink: reservation.guestRegistrationToken
      ? buildGuestRegistrationUrl(reservation.guestRegistrationToken)
      : null,
  });

  async function listQuickMessageReminders(): Promise<OperationalFeedCard[]> {
    const now = new Date();
    const today = dateKeyToPrismaDate(todayDateKeyInTimezone());
    const in48h = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    const in24h = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const rows = await db.reservation.findMany({
      where: mergeReservationScope(scope, {
        platform: { in: [BookingPlatform.DIRECT, BookingPlatform.AIRBNB] },
        status: { not: ReservationStatus.CANCELLED },
        checkOut: { gte: new Date(today.getTime() - 24 * 60 * 60 * 1000) },
      }),
      orderBy: { createdAt: "desc" },
      take: 150,
      select: reservationSelect,
    });

    const cards: OperationalFeedCard[] = [];
    const dedupe = new Set<string>();

    for (const row of rows) {
      const messageData = quickMessageDataFromReservation(row);
      const propertyTemplates = parsePropertyQuickMessageTemplates(
        row.property.quickMessageTemplates,
      );
      const propertyLabel = formatPropertyLabel(row.property);
      const dateRangeLabel = formatReservationRange(row.checkIn, row.checkOut);

      if (row.createdAt >= twoDaysAgo) {
        const id = `quick:welcome:${row.id}`;
        if (!dedupe.has(id)) {
          dedupe.add(id);
          cards.push(
            buildOperationalCard({
              id,
              kind: "NEW_RESERVATION",
              createdAt: row.createdAt,
              guestName: row.guestName,
              summary: "Enviar mensaje de bienvenida",
              propertyLabel,
              propertyId: row.property.id,
              reservationId: row.id,
              dateRangeLabel,
              quickActionLabel: "Copiar mensaje",
              quickActionMessage: buildQuickMessage(
                "WELCOME",
                messageData,
                propertyTemplates,
              ),
            }),
          );
        }
      }

      if (row.checkIn >= today && row.checkIn <= in48h && !row.guestRegistrationCompletedAt) {
        const id = `quick:registration:${row.id}`;
        if (!dedupe.has(id)) {
          dedupe.add(id);
          cards.push(
            buildOperationalCard({
              id,
              kind: "UPCOMING_CHECKIN",
              createdAt: row.checkIn,
              guestName: row.guestName,
              summary: "Solicitar registro de huéspedes",
              propertyLabel,
              propertyId: row.property.id,
              reservationId: row.id,
              dateRangeLabel,
              quickActionLabel: "Copiar mensaje",
              quickActionMessage: buildQuickMessage(
                "REGISTRATION",
                messageData,
                propertyTemplates,
              ),
            }),
          );
        }
      }

      if (row.guestRegistrationCompletedAt && row.guestRegistrationCompletedAt >= twoDaysAgo) {
        const id = `quick:access:${row.id}`;
        if (!dedupe.has(id)) {
          dedupe.add(id);
          cards.push(
            buildOperationalCard({
              id,
              kind: "UPCOMING_CHECKIN",
              createdAt: row.guestRegistrationCompletedAt,
              guestName: row.guestName,
              summary: "Enviar instrucciones de acceso",
              propertyLabel,
              propertyId: row.property.id,
              reservationId: row.id,
              dateRangeLabel,
              quickActionLabel: "Copiar mensaje",
              quickActionMessage: buildQuickMessage(
                "ACCESS",
                messageData,
                propertyTemplates,
              ),
            }),
          );
        }
      }

      if (
        row.status === ReservationStatus.CHECKED_IN ||
        row.status === ReservationStatus.CHECKOUT_TODAY
      ) {
        const id = `quick:followup:${row.id}`;
        if (!dedupe.has(id)) {
          dedupe.add(id);
          cards.push(
            buildOperationalCard({
              id,
              kind: "GUEST_MESSAGE",
              createdAt: now,
              guestName: row.guestName,
              summary: "Realizar seguimiento de estadía",
              propertyLabel,
              propertyId: row.property.id,
              reservationId: row.id,
              dateRangeLabel,
              quickActionLabel: "Copiar mensaje",
              quickActionMessage: buildQuickMessage(
                "FOLLOW_UP",
                messageData,
                propertyTemplates,
              ),
            }),
          );
        }
      }

      if (row.checkOut >= today && row.checkOut <= in24h) {
        const id = `quick:checkout:${row.id}`;
        if (!dedupe.has(id)) {
          dedupe.add(id);
          cards.push(
            buildOperationalCard({
              id,
              kind: "UPCOMING_CHECKOUT",
              createdAt: row.checkOut,
              guestName: row.guestName,
              summary: "Recordar check-out y solicitar reseña",
              propertyLabel,
              propertyId: row.property.id,
              reservationId: row.id,
              dateRangeLabel,
              quickActionLabel: "Copiar mensaje",
              quickActionMessage: buildQuickMessage(
                "CHECKOUT",
                messageData,
                propertyTemplates,
              ),
            }),
          );
        }
      }
    }

    return cards;
  }

  const [
    modificationEvents,
    guestActivities,
    guestPending,
    payouts,
    emailEvents,
    quickMessageReminders,
    guestRegistrationAdminNotifications,
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
    listQuickMessageReminders(),
    listGuestRegistrationAdminNotificationCards(scope),
  ]);

  const cards: OperationalFeedCard[] = [
    ...modificationEvents.map(mapModificationEvent),
    ...guestActivities.map(mapGuestMessageActivity),
    ...guestPending.map(mapGuestMessagePending),
    ...payouts.map(mapPayout),
    ...emailEvents.map(mapEmailEvent).filter((row): row is OperationalFeedCard => row != null),
    ...quickMessageReminders,
    ...guestRegistrationAdminNotifications,
  ];

  return cards
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, take);
}

export async function getLatestOperationalFeedTimestamp(
  scope: TenantDataScope,
): Promise<{ latestAt: string | null; latestId: string | null }> {
  const emailEventKinds = [
    AirbnbEmailEventKind.CONFIRMED,
    AirbnbEmailEventKind.CHECKIN_REMINDER,
    AirbnbEmailEventKind.CANCELED,
  ] as const;

  const [
    modificationEvent,
    guestActivity,
    guestPending,
    payout,
    emailEvent,
  ] = await Promise.all([
    db.reservationEvent.findFirst({
      where: reservationEventWhere(scope),
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }),
    db.reservationActivity.findFirst({
      where: guestMessageActivityWhere(scope),
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }),
    db.reservationActivityPending.findFirst({
      where: guestMessagePendingWhere(scope),
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }),
    db.reservationPayout.findFirst({
      where: { audit: auditWhere(scope) },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }),
    db.reservationEmailEvent.findFirst({
      where: {
        eventKind: { in: [...emailEventKinds] },
        audit: auditWhere(scope),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }),
  ]);

  type Candidate = { id: string; createdAt: Date };
  const candidates: Candidate[] = [];

  if (modificationEvent) {
    candidates.push({
      id: `event:${modificationEvent.id}`,
      createdAt: modificationEvent.createdAt,
    });
  }
  if (guestActivity) {
    candidates.push({
      id: `activity:${guestActivity.id}`,
      createdAt: guestActivity.createdAt,
    });
  }
  if (guestPending) {
    candidates.push({
      id: `pending:${guestPending.id}`,
      createdAt: guestPending.createdAt,
    });
  }
  if (payout) {
    candidates.push({
      id: `payout:${payout.id}`,
      createdAt: payout.createdAt,
    });
  }
  if (emailEvent) {
    candidates.push({
      id: `email-event:${emailEvent.id}`,
      createdAt: emailEvent.createdAt,
    });
  }

  if (candidates.length === 0) {
    return { latestAt: null, latestId: null };
  }

  const latest = candidates.reduce((best, row) =>
    row.createdAt > best.createdAt ? row : best,
  );

  return {
    latestAt: latest.createdAt.toISOString(),
    latestId: latest.id,
  };
}

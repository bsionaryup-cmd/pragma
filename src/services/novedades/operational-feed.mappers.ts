import {
  AirbnbEmailEventKind,
  ReservationEventType,
  ReservationStatus,
  type Prisma,
} from "@prisma/client";
import { formatPropertyLabel } from "@/lib/property-display";
import { prismaDateToKey } from "@/lib/dates";
import { resolveReservationGuestCounts } from "@/lib/reservations/display-guest-count";
import { extractGuestCountsFromReservationEmailEvent } from "@/services/reservations/airbnb-display-guest-count.service";
import {
  buildOperationalCard,
  formatGuestCountLine,
  formatPayoutAmount,
  formatReservationRange,
} from "@/services/novedades/operational-feed.present";
import { stripMessageHtml } from "@/services/novedades/operational-feed.message";
import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";

export const reservationSelect = {
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
  reservationCode: true,
  createdAt: true,
  property: true,
} as const;

type ReservationRow = {
  id: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  status: ReservationStatus;
  totalAmount: unknown;
  currency: string;
  adults: number;
  children: number;
  infants: number;
  reservationCode: string | null;
  createdAt: Date;
  property: {
    id: string;
    name: string;
    unitNumber: string | null;
    city: string;
  };
};

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
  reservation: { property: ReservationRow["property"] | null } | null,
): string | null {
  return reservation?.property ? formatPropertyLabel(reservation.property) : null;
}

function propertyIdFromReservation(
  reservation: { property: { id: string } | null } | null,
): string | null {
  return reservation?.property?.id ?? null;
}

function readEmailEventSignals(row: {
  payload: unknown;
  enrichedFields: unknown;
}): Record<string, unknown> {
  const payload = row.payload as { signals?: Record<string, unknown> } | null;
  return {
    ...(payload?.signals ?? {}),
    ...((row.enrichedFields ?? {}) as Record<string, unknown>),
  };
}

function readSignalGuestCounts(signals: Record<string, unknown>) {
  return {
    adults: Number(signals.adultCount ?? signals.guestCount ?? 0) || 0,
    children: Number(signals.childCount ?? 0) || 0,
    infants: Number(signals.infantCount ?? 0) || 0,
  };
}

function buildReservationUpdateLines(
  signals: Record<string, unknown>,
  reservation: ReservationRow | null | undefined,
): string[] {
  const lines: string[] = [];
  const checkIn =
    typeof signals.checkIn === "string" ? signals.checkIn.trim() : null;
  const checkOut =
    typeof signals.checkOut === "string" ? signals.checkOut.trim() : null;

  if (checkIn && checkOut) {
    lines.push(`Fechas: ${checkIn} → ${checkOut}`);
  } else if (checkIn && reservation) {
    lines.push(
      `Check-in: ${prismaDateToKey(reservation.checkIn)} → ${checkIn}`,
    );
  } else if (checkOut && reservation) {
    lines.push(
      `Check-out: ${prismaDateToKey(reservation.checkOut)} → ${checkOut}`,
    );
  }

  const guestCounts = readSignalGuestCounts(signals);
  const guestLine = formatGuestCountLine(guestCounts);
  if (guestLine) lines.push(`Huéspedes: ${guestLine}`);

  const payout =
    Number(signals.hostPayoutAmount ?? signals.netPayout ?? 0) || null;
  const currency =
    typeof signals.currency === "string" ? signals.currency : reservation?.currency ?? "COP";
  if (payout != null && payout > 0) {
    const label = formatPayoutAmount(payout, currency);
    if (label) lines.push(`Ingreso anfitrión: ${label}`);
  }

  return lines;
}

function clipMessage(value: string, max = 220): string {
  const cleaned = stripMessageHtml(value);
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
}

function reservationContext(
  reservation: ReservationRow | null | undefined,
  confirmationCode?: string | null,
) {
  return {
    guestName: reservation?.guestName ?? null,
    propertyLabel: propertyLabelFromReservation(reservation ?? null),
    propertyId: propertyIdFromReservation(reservation ?? null),
    reservationId: reservation?.id ?? null,
    reservationStatus: reservation?.status ?? null,
    confirmationCode: confirmationCode ?? reservation?.reservationCode ?? null,
    dateRangeLabel:
      reservation?.checkIn && reservation?.checkOut
        ? formatReservationRange(reservation.checkIn, reservation.checkOut)
        : null,
  };
}

export function mapModificationEvent(row: {
  id: string;
  eventType: ReservationEventType;
  createdAt: Date;
  description: string;
  metadataJson: unknown;
  propertyId: string | null;
  reservationId: string | null;
  property: { name: string; unitNumber: string | null; city: string } | null;
  reservation: ReservationRow | null;
}): OperationalFeedCard {
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

  return buildOperationalCard({
    id: `event:${row.id}`,
    kind,
    createdAt: row.createdAt,
    guestName,
    summary:
      kind === "MODIFICATION_APPROVED"
        ? "Airbnb confirmó el cambio en la reserva."
        : detailLines.length > 0
          ? "El huésped solicitó modificar la reserva."
          : row.description,
    propertyLabel:
      (row.property ? formatPropertyLabel(row.property) : null) ??
      propertyLabelFromReservation(row.reservation),
    propertyId: row.propertyId ?? propertyIdFromReservation(row.reservation),
    reservationId: row.reservationId,
    reservationStatus: row.reservation?.status ?? null,
    confirmationCode: readMetadataConfirmationCode(metadata),
    dateRangeLabel:
      row.reservation?.checkIn && row.reservation?.checkOut
        ? formatReservationRange(row.reservation.checkIn, row.reservation.checkOut)
        : null,
    detailLines,
  });
}

export function mapGuestMessageActivity(row: {
  id: string;
  createdAt: Date;
  content: string;
  senderName: string | null;
  metadataJson: unknown;
  propertyId: string | null;
  reservationId: string;
  property: { name: string; unitNumber: string | null; city: string } | null;
  reservation: ReservationRow;
}): OperationalFeedCard {
  return buildOperationalCard({
    id: `activity:${row.id}`,
    kind: "GUEST_MESSAGE",
    createdAt: row.createdAt,
    guestName: readActivityGuestName({
      senderName: row.senderName,
      metadata: row.metadataJson,
      reservationGuestName: row.reservation.guestName,
    }),
    summary: clipMessage(row.content),
    propertyLabel:
      (row.property ? formatPropertyLabel(row.property) : null) ??
      propertyLabelFromReservation(row.reservation),
    propertyId: row.propertyId ?? propertyIdFromReservation(row.reservation),
    reservationId: row.reservationId,
    reservationStatus: row.reservation?.status ?? null,
    confirmationCode: readMetadataConfirmationCode(row.metadataJson),
    dateRangeLabel: formatReservationRange(
      row.reservation.checkIn,
      row.reservation.checkOut,
    ),
  });
}

export function mapPayout(row: {
  id: string;
  createdAt: Date;
  currency: string;
  netPayout: unknown;
  grossAmount: unknown;
  reservationId: string | null;
  reservation: ReservationRow | null;
}): OperationalFeedCard {
  const amount =
    row.netPayout != null
      ? Number(row.netPayout.toString())
      : row.grossAmount != null
        ? Number(row.grossAmount.toString())
        : null;

  return buildOperationalCard({
    id: `payout:${row.id}`,
    kind: "PAYOUT_SENT",
    createdAt: row.createdAt,
    guestName: row.reservation?.guestName ?? null,
    amountLabel: formatPayoutAmount(amount, row.currency),
    summary: "Airbnb procesó el desembolso a tu cuenta.",
    propertyLabel: propertyLabelFromReservation(row.reservation),
    propertyId: propertyIdFromReservation(row.reservation),
    reservationId: row.reservationId,
    reservationStatus: row.reservation?.status ?? null,
    dateRangeLabel:
      row.reservation?.checkIn && row.reservation?.checkOut
        ? formatReservationRange(row.reservation.checkIn, row.reservation.checkOut)
        : null,
  });
}

export function mapReservationPayment(row: {
  id: string;
  amount: unknown;
  currency: string;
  method: string;
  receivedAt: Date;
  createdAt: Date;
  reservation: ReservationRow;
}): OperationalFeedCard {
  const amount = Number(String(row.amount));
  return buildOperationalCard({
    id: `payment:${row.id}`,
    kind: "PAYMENT_CONFIRMED",
    createdAt: row.createdAt,
    guestName: row.reservation.guestName,
    amountLabel: formatPayoutAmount(amount, row.currency),
    summary: "Se registró un pago en la reserva.",
    propertyLabel: propertyLabelFromReservation(row.reservation),
    propertyId: row.reservation.property.id,
    reservationId: row.reservation.id,
    reservationStatus: row.reservation.status,
    confirmationCode: row.reservation.reservationCode,
    dateRangeLabel: formatReservationRange(
      row.reservation.checkIn,
      row.reservation.checkOut,
    ),
    detailLines: [],
  });
}

export function mapGuestPaymentLink(row: {
  id: string;
  amount: unknown;
  currency: string;
  description: string;
  updatedAt: Date;
  guestName: string | null;
  reservation: ReservationRow | null;
}): OperationalFeedCard | null {
  if (!row.reservation) return null;
  const amount = Number(String(row.amount));
  return buildOperationalCard({
    id: `guest-link:${row.id}`,
    kind: "PAYMENT_CONFIRMED",
    createdAt: row.updatedAt,
    guestName: row.guestName ?? row.reservation.guestName,
    amountLabel: formatPayoutAmount(amount, row.currency),
    summary: "El huésped completó el pago del link.",
    propertyLabel: propertyLabelFromReservation(row.reservation),
    propertyId: row.reservation.property.id,
    reservationId: row.reservation.id,
    reservationStatus: row.reservation.status,
    confirmationCode: row.reservation.reservationCode,
    dateRangeLabel: formatReservationRange(
      row.reservation.checkIn,
      row.reservation.checkOut,
    ),
    detailLines: row.description.trim() ? [row.description.trim()] : [],
  });
}

export function mapEmailEvent(row: {
  id: string;
  eventKind: AirbnbEmailEventKind;
  createdAt: Date;
  confirmationCode: string | null;
  reservationId: string | null;
  payload: unknown;
  enrichedFields: unknown;
  reservation: ReservationRow | null;
}): OperationalFeedCard | null {
  const ctx = reservationContext(row.reservation, row.confirmationCode);

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
      ...ctx,
      amountLabel:
        amount != null && row.reservation
          ? formatPayoutAmount(amount, row.reservation.currency)
          : null,
      detailLines: guestLine ? [guestLine] : [],
    });
  }

  if (row.eventKind === AirbnbEmailEventKind.CANCELED) {
    if (row.reservation?.status !== ReservationStatus.CANCELLED) return null;

    return buildOperationalCard({
      id: `email-event:${row.id}`,
      kind: "RESERVATION_CANCELLED",
      createdAt: row.createdAt,
      ...ctx,
      summary: "Airbnb confirmó la cancelación de la reserva.",
    });
  }

  if (row.eventKind === AirbnbEmailEventKind.UPDATED) {
    const signals = readEmailEventSignals(row);
    const detailLines = buildReservationUpdateLines(signals, row.reservation);

    return buildOperationalCard({
      id: `email-event:${row.id}`,
      kind: "RESERVATION_UPDATED",
      createdAt: row.createdAt,
      ...ctx,
      summary:
        detailLines.length > 0
          ? "Se actualizaron los datos de la reserva."
          : "Airbnb notificó un cambio en la reserva.",
      detailLines,
    });
  }

  if (row.eventKind === AirbnbEmailEventKind.EXTENDED) {
    const signals = readEmailEventSignals(row);
    const detailLines = buildReservationUpdateLines(signals, row.reservation);

    return buildOperationalCard({
      id: `email-event:${row.id}`,
      kind: "STAY_EXTENDED",
      createdAt: row.createdAt,
      ...ctx,
      summary: "La estadía fue extendida.",
      detailLines,
    });
  }

  if (row.eventKind === AirbnbEmailEventKind.EARLY_CHECKIN_REQUEST) {
    return buildOperationalCard({
      id: `email-event:${row.id}`,
      kind: "ALERT",
      createdAt: row.createdAt,
      ...ctx,
      summary: "Solicitud de check-in anticipado.",
    });
  }

  if (row.eventKind === AirbnbEmailEventKind.TRANSPORT_REQUEST) {
    return buildOperationalCard({
      id: `email-event:${row.id}`,
      kind: "ALERT",
      createdAt: row.createdAt,
      ...ctx,
      summary: "Solicitud de transporte o traslado.",
    });
  }

  return null;
}

export function mapGuestRegistrationAlert(row: {
  id: string;
  guestName: string;
  reservationCode: string | null;
  checkIn: Date;
  checkOut: Date;
  guestRegistrationCompletedAt: Date | null;
  guestRegistrationAdminNotificationError: string | null;
  property: { id: string; name: string; unitNumber: string | null; city: string };
}): OperationalFeedCard | null {
  if (!row.guestRegistrationAdminNotificationError || !row.guestRegistrationCompletedAt) {
    return null;
  }

  return buildOperationalCard({
    id: `guest-reg-admin:failed:${row.id}`,
    kind: "ALERT",
    createdAt: row.guestRegistrationCompletedAt,
    guestName: row.guestName,
    summary: "Registro completado, pero falló el aviso a administración.",
    propertyLabel: formatPropertyLabel(row.property),
    propertyId: row.property.id,
    reservationId: row.id,
    reservationStatus: null,
    confirmationCode: row.reservationCode,
    dateRangeLabel: formatReservationRange(row.checkIn, row.checkOut),
    detailLines: [],
  });
}

export function mapReservationCommunication(row: {
  id: string;
  createdAt: Date;
  rawMessage: string;
  requiresAction: boolean;
  parsedIntent: string | null;
  reservation: ReservationRow | null;
}): OperationalFeedCard | null {
  if (!row.reservation) return null;

  if (row.requiresAction) {
    return buildOperationalCard({
      id: `communication:${row.id}`,
      kind: "ALERT",
      createdAt: row.createdAt,
      guestName: row.reservation.guestName,
      summary: clipMessage(row.rawMessage) || "Mensaje que requiere respuesta.",
      propertyLabel: propertyLabelFromReservation(row.reservation),
      propertyId: row.reservation.property.id,
      reservationId: row.reservation.id,
      reservationStatus: row.reservation.status,
      confirmationCode: row.reservation.reservationCode,
      dateRangeLabel: formatReservationRange(
        row.reservation.checkIn,
        row.reservation.checkOut,
      ),
    });
  }

  const intent = row.parsedIntent?.toUpperCase() ?? "";
  if (intent === "EARLY_CHECKIN" || intent === "TRANSPORT") {
    return buildOperationalCard({
      id: `communication:${row.id}`,
      kind: "ALERT",
      createdAt: row.createdAt,
      guestName: row.reservation.guestName,
      summary:
        intent === "EARLY_CHECKIN"
          ? "Consulta sobre check-in anticipado."
          : "Consulta sobre transporte o traslado.",
      propertyLabel: propertyLabelFromReservation(row.reservation),
      propertyId: row.reservation.property.id,
      reservationId: row.reservation.id,
      reservationStatus: row.reservation.status,
      confirmationCode: row.reservation.reservationCode,
      dateRangeLabel: formatReservationRange(
        row.reservation.checkIn,
        row.reservation.checkOut,
      ),
      detailLines: row.rawMessage.trim()
        ? [clipMessage(row.rawMessage, 160)]
        : [],
    });
  }

  return null;
}

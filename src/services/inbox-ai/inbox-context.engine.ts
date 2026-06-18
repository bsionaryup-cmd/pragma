import "server-only";

import { db } from "@/lib/db";
import { prismaDateToKey } from "@/lib/dates";
import { formatPropertyLabel } from "@/lib/property-display";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { mergeReservationScope } from "@/lib/platform/tenant-data-scope";
import {
  buildQuickMessageDataFromReservation,
  formatPropertyAddressForMessage,
  parsePropertyQuickMessageTemplates,
} from "@/lib/reservations/quick-message-templates";
import { formatStayRange } from "@/features/reservations/lib/reservation-dates";
import {
  RESERVATION_STATUS_LABELS,
  resolveNovedadesGuestName,
} from "@/services/novedades/operational-feed.copy";
import { listOperationalFeedCardsForReservation } from "@/services/novedades/operational-feed.service";
import { formatPayoutAmount } from "@/services/novedades/operational-feed.present";
import {
  detectNovedadesStayStage,
  novedadesStayStageLabel,
} from "@/services/novedades/novedades-stay-stage";
import { getAirbnbEnrichedGuestNameByReservationIds } from "@/services/reservations/airbnb-display-guest-name.service";
import { buildGuestRegistrationUrl } from "@/services/guests/guest-registration.service";
import {
  buildKnownFacts,
  detectMissingFacts,
  extractActivityHistoryFromFeedCards,
  extractGuestMessagesFromFeedCards,
  resolveInboxAiTemplates,
} from "@/services/inbox-ai/inbox-context.format";
import type { InboxAiContext } from "@/services/inbox-ai/inbox-context.types";
import { INBOX_AI_CONTEXT_VERSION } from "@/services/inbox-ai/inbox-context.types";
import { buildPropertyKnowledgeFromContext } from "@/services/inbox-ai/inbox-knowledge.types";
import { detectInboxMessageIntent } from "@/services/inbox-ai/inbox-intent.service";

/**
 * Context Engine — reúne datos reales de PRAGMA para respuestas IA futuras.
 * Capa aditiva: no modifica ingestión Resend ni servicios de Novedades existentes.
 */
export async function buildInboxAiContext(
  scope: TenantDataScope,
  reservationId: string,
): Promise<InboxAiContext | null> {
  await assertReservationInScope(scope, reservationId);

  const reservation = await db.reservation.findFirst({
    where: mergeReservationScope(scope, { id: reservationId }),
    select: {
      id: true,
      guestName: true,
      guestEmail: true,
      guestPhone: true,
      checkIn: true,
      checkOut: true,
      status: true,
      platform: true,
      reservationCode: true,
      totalAmount: true,
      currency: true,
      paymentStatus: true,
      adults: true,
      children: true,
      infants: true,
      guestRegistrationToken: true,
      guestRegistrationCompletedAt: true,
      property: {
        select: {
          id: true,
          name: true,
          unitNumber: true,
          address: true,
          neighborhood: true,
          city: true,
          checkInTime: true,
          checkOutTime: true,
          accessCode: true,
          accessInstructions: true,
          houseRules: true,
          wifiName: true,
          wifiPassword: true,
          receptionWhatsapp: true,
          quickMessageTemplates: true,
        },
      },
    },
  });

  if (!reservation) return null;

  const [enrichedNames, feedCards, accessCredentials, tasks] = await Promise.all([
    getAirbnbEnrichedGuestNameByReservationIds([reservationId]),
    listOperationalFeedCardsForReservation(scope, reservationId),
    db.accessCredential.findMany({
      where: { reservationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        deliveryStatus: true,
        validFrom: true,
        validTo: true,
      },
    }),
    db.task.findMany({
      where: { reservationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        status: true,
        type: true,
        dueDate: true,
      },
    }),
  ]);

  const displayGuestName = resolveNovedadesGuestName({
    guestName: reservation.guestName,
    confirmationCode: reservation.reservationCode,
    enrichedGuestName: enrichedNames.get(reservationId),
    platform: reservation.platform,
  });

  const checkInKey = prismaDateToKey(reservation.checkIn);
  const checkOutKey = prismaDateToKey(reservation.checkOut);
  const stayRange = formatStayRange(checkInKey, checkOutKey);
  const registrationLink = reservation.guestRegistrationToken
    ? buildGuestRegistrationUrl(reservation.guestRegistrationToken)
    : null;
  const propertyTemplates = parsePropertyQuickMessageTemplates(
    reservation.property.quickMessageTemplates,
  );
  const manualAccessCode = reservation.property.accessCode?.trim() || null;

  const messageData = buildQuickMessageDataFromReservation({
    guestName: displayGuestName.startsWith("Reserva ")
      ? reservation.guestName
      : displayGuestName,
    checkIn: checkInKey,
    checkOut: checkOutKey,
    property: {
      name: reservation.property.name,
      unitNumber: reservation.property.unitNumber,
      address: formatPropertyAddressForMessage({
        address: reservation.property.address,
        neighborhood: reservation.property.neighborhood,
      }),
      neighborhood: reservation.property.neighborhood,
      checkInTime: reservation.property.checkInTime,
      checkOutTime: reservation.property.checkOutTime,
      accessCode: reservation.property.accessCode,
      accessInstructions: reservation.property.accessInstructions,
      houseRules: reservation.property.houseRules,
      wifiName: reservation.property.wifiName,
      wifiPassword: reservation.property.wifiPassword,
      receptionWhatsapp: reservation.property.receptionWhatsapp,
    },
    registrationLink,
    accessCode: manualAccessCode,
  });

  const reservationContext = {
    id: reservation.id,
    guestName: displayGuestName,
    guestEmail: reservation.guestEmail?.trim() || null,
    guestPhone: reservation.guestPhone?.trim() || null,
    platform: reservation.platform,
    status: reservation.status,
    statusLabel:
      RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status,
    reservationCode: reservation.reservationCode,
    checkIn: checkInKey,
    checkOut: checkOutKey,
    stayRange,
    adults: reservation.adults,
    children: reservation.children,
    infants: reservation.infants,
    totalAmountLabel: formatPayoutAmount(
      Number(reservation.totalAmount),
      reservation.currency,
    ),
    paymentStatus: reservation.paymentStatus,
    guestRegistrationCompleted: Boolean(reservation.guestRegistrationCompletedAt),
    guestRegistrationCompletedAt:
      reservation.guestRegistrationCompletedAt?.toISOString() ?? null,
    registrationLink,
  };

  const propertyContext = {
    id: reservation.property.id,
    label: formatPropertyLabel(reservation.property),
    unitNumber: reservation.property.unitNumber,
    address:
      formatPropertyAddressForMessage({
        address: reservation.property.address,
        neighborhood: reservation.property.neighborhood,
      }) || reservation.property.address.trim(),
    neighborhood: reservation.property.neighborhood,
    city: reservation.property.city,
    checkInTime: reservation.property.checkInTime,
    checkOutTime: reservation.property.checkOutTime,
    wifiName: reservation.property.wifiName?.trim() || null,
    wifiPassword: reservation.property.wifiPassword?.trim() || null,
    houseRules: reservation.property.houseRules?.trim() || null,
    accessCode: manualAccessCode,
    accessInstructions: reservation.property.accessInstructions?.trim() || null,
    receptionWhatsapp: reservation.property.receptionWhatsapp?.trim() || null,
  };

  const accessContext = {
    manualAccessCode,
    credentials: accessCredentials.map((row) => ({
      id: row.id,
      status: row.status,
      deliveryStatus: row.deliveryStatus,
      validFrom: row.validFrom?.toISOString() ?? null,
      validTo: row.validTo?.toISOString() ?? null,
    })),
  };

  const taskSummaries = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    type: task.type,
    status: task.status,
    dueDate: task.dueDate?.toISOString() ?? null,
  }));

  const guestMessages = extractGuestMessagesFromFeedCards(feedCards);
  const activityHistory = extractActivityHistoryFromFeedCards(feedCards);
  const templates = resolveInboxAiTemplates(propertyTemplates);

  const stayStage = novedadesStayStageLabel(
    detectNovedadesStayStage({
      status: reservation.status,
      checkIn: checkInKey,
      checkOut: checkOutKey,
    }),
  );

  const knownFacts = buildKnownFacts({
    reservation: reservationContext,
    property: propertyContext,
    access: accessContext,
    tasks: taskSummaries,
    guestMessages,
  });

  const missingFacts = detectMissingFacts({
    reservation: reservationContext,
    property: propertyContext,
    access: accessContext,
  });

  const lastGuestMessage = guestMessages[guestMessages.length - 1];
  const latestGuestIntent = lastGuestMessage
    ? detectInboxMessageIntent(lastGuestMessage.body).intent
    : null;

  return {
    version: INBOX_AI_CONTEXT_VERSION,
    reservationId,
    builtAt: new Date().toISOString(),
    stayStage,
    reservation: reservationContext,
    property: propertyContext,
    access: accessContext,
    tasks: taskSummaries,
    guestMessages,
    activityHistory,
    messageData,
    templates,
    knownFacts,
    missingFacts,
    knowledge: buildPropertyKnowledgeFromContext(propertyContext),
    latestGuestIntent,
  };
}

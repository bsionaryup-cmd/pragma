import "server-only";

import {
  AccessCredentialStatus,
  ReservationStatus,
  type BookingPlatform,
} from "@prisma/client";
import { db } from "@/lib/db";
import { prismaDateToKey } from "@/lib/dates";
import { formatDateTime, formatDateRange } from "@/lib/helpers/date";
import { formatPropertyLabel } from "@/lib/property-display";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { mergeReservationScope } from "@/lib/platform/tenant-data-scope";
import {
  guestInitialsFromName,
  RESERVATION_STATUS_LABELS,
  resolveNovedadesGuestName,
} from "@/services/novedades/operational-feed.copy";
import { resolveGuestMessageBodiesForDisplay, resolveGuestMessageParseName } from "@/services/novedades/operational-feed.message";
import { listOperationalFeedCardsForReservation } from "@/services/novedades/operational-feed.service";
import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";
import type {
  NovedadesReservationDetail,
  NovedadesSuggestedAction,
  NovedadesTimelineEntry,
  NovedadesTimelineKind,
} from "@/services/novedades/novedades-inbox.types";
import {
  buildAllQuickMessageCopyActions,
  buildGuestMessageReplyActions,
  buildNovedadesSuggestedActions,
} from "@/services/novedades/novedades-suggested-actions.service";
import {
  detectNovedadesStayStage,
  novedadesStayStageLabel,
} from "@/services/novedades/novedades-stay-stage";
import { getAirbnbEnrichedGuestNameByReservationIds } from "@/services/reservations/airbnb-display-guest-name.service";
import {
  loadReservationRevenueSourcesByReservationId,
  resolveReservationFinanceRevenueForDisplay,
} from "@/services/finance/reservation-revenue-context.service";
import { formatPayoutAmount } from "@/services/novedades/operational-feed.present";
import { buildGuestRegistrationUrl } from "@/services/guests/guest-registration.service";
import {
  buildQuickMessageDataFromReservation,
  formatPropertyAddressForMessage,
  parsePropertyQuickMessageTemplates,
} from "@/lib/reservations/quick-message-templates";
import { buildQuickMessage } from "@/lib/reservations/quick-messages";
import type { QuickMessageType } from "@/lib/reservations/quick-messages";
import { quickMessageButtonLabel } from "@/lib/reservations/quick-message-templates";
import {
  buildAbsorbedInquiryTimelineEntry,
} from "@/services/novedades/inbox-history-consolidation";
import {
  buildInboxHistoryConsolidationContext,
} from "@/services/novedades/inbox-history-consolidation.service";
import { listNovedadesUnlinkedInquiryItems } from "@/services/novedades/novedades-unlinked-inquiry.service";

const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: "pendiente",
  IN_PROGRESS: "en curso",
  COMPLETED: "completada",
  CANCELLED: "cancelada",
};

const ACCESS_STATUS_LABELS: Record<string, string> = {
  PENDING: "pendiente",
  GENERATED: "generado",
  SENT: "enviado",
  ACTIVE: "activo",
  SUSPENDED: "suspendido",
  EXPIRED: "expirado",
  REVOKED: "revocado",
};

const ACCESS_EVENT_LABELS: Record<string, string> = {
  CODE_GENERATED: "Código TTLock generado",
  CODE_REVOKED: "Código TTLock revocado",
  LOCK_SYNCED: "Cerradura sincronizada",
  LOCK_SYNC_FAILED: "Error al sincronizar cerradura",
};

function dateAtStartOfDay(date: Date): string {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0),
  ).toISOString();
}

function formatTimeLabel(value: string | Date): string {
  return formatDateTime(value, "—", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function feedKindToTimelineKind(kind: OperationalFeedCard["kind"]): NovedadesTimelineKind {
  return kind;
}

type TimelineBuildContext = {
  messageData: Parameters<typeof buildQuickMessageDataFromReservation>[0];
  templates: ReturnType<typeof parsePropertyQuickMessageTemplates>;
  registrationLink: string | null;
  accessCode: string | null;
};

function cardToTimelineEntries(
  card: OperationalFeedCard,
  ctx: TimelineBuildContext,
): NovedadesTimelineEntry[] {
  if (card.kind !== "GUEST_MESSAGE") {
    const entry = buildNonGuestTimelineEntry(card, ctx);
    return entry ? [entry] : [];
  }

  const guestName = resolveGuestMessageParseName({
    raw: card.summary,
    guestName: card.guestName ?? ctx.messageData.guestName,
  });
  const messageBodies = resolveGuestMessageBodiesForDisplay(card.summary, { guestName });
  if (messageBodies.length === 0) return [];

  return messageBodies.map((messageBody, index) => {
    const isLast = index === messageBodies.length - 1;
    const entry: NovedadesTimelineEntry = {
      id: messageBodies.length > 1 ? `${card.id}:msg:${index}` : card.id,
      kind: feedKindToTimelineKind(card.kind),
      title: card.headline,
      narrative: messageBody,
      priority: card.priority,
      createdAt: card.createdAt,
      timeLabel: formatTimeLabel(card.createdAt),
      messageBody,
      amountLabel: card.amountLabel ?? null,
    };

    if (isLast) {
      entry.suggestedReplies = buildGuestMessageReplyActions({
        messageBody,
        messageData: ctx.messageData,
        templates: ctx.templates,
        registrationLink: ctx.registrationLink,
        accessCode: ctx.accessCode,
      });
    }

    return entry;
  });
}

function buildNonGuestTimelineEntry(
  card: OperationalFeedCard,
  ctx: TimelineBuildContext,
): NovedadesTimelineEntry | null {
  const entry: NovedadesTimelineEntry = {
    id: card.id,
    kind: feedKindToTimelineKind(card.kind),
    title: card.headline,
    narrative: card.narrative,
    priority: card.priority,
    createdAt: card.createdAt,
    timeLabel: formatTimeLabel(card.createdAt),
    messageBody: null,
    amountLabel: card.amountLabel ?? null,
  };

  if (card.kind === "NEW_RESERVATION" && ctx.messageData) {
    const data = buildQuickMessageDataFromReservation({
      ...ctx.messageData,
      registrationLink: ctx.registrationLink,
      accessCode: ctx.accessCode,
    });
    const welcomeText = buildQuickMessage("WELCOME", data, ctx.templates);
    if (welcomeText.trim()) {
      entry.suggestedReplies = [
        {
          id: "quick:WELCOME",
          label: quickMessageButtonLabel("WELCOME"),
          messageText: welcomeText,
          variant: "primary",
          hint: "Copia y pega en el chat de Airbnb",
        },
      ];
    }
  }

  return entry;
}

function buildMilestoneEntries(input: {
  reservationId: string;
  guestName: string;
  platform: BookingPlatform;
  status: ReservationStatus;
  createdAt: Date;
  updatedAt: Date;
  checkIn: Date;
  checkOut: Date;
  guestRegistrationToken: string | null;
  guestRegistrationCompletedAt: Date | null;
  hasFeedNewReservation: boolean;
  hasFeedCancellation: boolean;
  amountLabel: string | null;
}): NovedadesTimelineEntry[] {
  const entries: NovedadesTimelineEntry[] = [];

  if (!input.hasFeedNewReservation) {
    const amountSuffix = input.amountLabel ? ` Ingreso: ${input.amountLabel}.` : "";
    entries.push({
      id: `${input.reservationId}:created`,
      kind: "RESERVATION_CREATED",
      title: "Reserva creada",
      narrative:
        input.platform === "AIRBNB"
          ? `Reserva confirmada desde Airbnb.${amountSuffix}`
          : `Reserva creada para ${input.guestName}.${amountSuffix}`,
      priority: "normal",
      createdAt: input.createdAt.toISOString(),
      timeLabel: formatTimeLabel(input.createdAt),
      amountLabel: input.amountLabel,
    });
  }

  if (input.guestRegistrationToken && !input.guestRegistrationCompletedAt) {
    entries.push({
      id: `${input.reservationId}:registration-link`,
      kind: "GUEST_REGISTRATION",
      title: "Registro de huéspedes",
      narrative: "Enlace de registro disponible para los huéspedes.",
      priority: "normal",
      createdAt: input.createdAt.toISOString(),
      timeLabel: formatTimeLabel(input.createdAt),
    });
  }

  if (input.guestRegistrationCompletedAt) {
    entries.push({
      id: `${input.reservationId}:registration-done`,
      kind: "GUEST_REGISTRATION",
      title: "Registro completado",
      narrative: `${input.guestName} completó el registro de huéspedes.`,
      priority: "normal",
      createdAt: input.guestRegistrationCompletedAt.toISOString(),
      timeLabel: formatTimeLabel(input.guestRegistrationCompletedAt),
    });
  }

  const checkInIso = dateAtStartOfDay(input.checkIn);
  const checkOutIso = dateAtStartOfDay(input.checkOut);
  const showCheckIn =
    input.status === ReservationStatus.CHECKED_IN ||
    input.status === ReservationStatus.CHECKOUT_TODAY ||
    input.status === ReservationStatus.CHECKED_OUT;
  const showCheckOut =
    input.status === ReservationStatus.CHECKOUT_TODAY ||
    input.status === ReservationStatus.CHECKED_OUT;

  if (showCheckIn) {
    entries.push({
      id: `${input.reservationId}:check-in`,
      kind: "CHECK_IN",
      title: "Check-in",
      narrative: `${input.guestName} inició la estadía.`,
      priority: "normal",
      createdAt: checkInIso,
      timeLabel: formatTimeLabel(checkInIso),
    });
  }

  if (showCheckOut) {
    entries.push({
      id: `${input.reservationId}:check-out`,
      kind: "CHECK_OUT",
      title: "Check-out",
      narrative:
        input.status === ReservationStatus.CHECKED_OUT
          ? `${input.guestName} finalizó la estadía.`
          : `Check-out programado para hoy.`,
      priority: "normal",
      createdAt: checkOutIso,
      timeLabel: formatTimeLabel(checkOutIso),
    });
  }

  if (
    input.status === ReservationStatus.CANCELLED &&
    !input.hasFeedCancellation
  ) {
    entries.push({
      id: `${input.reservationId}:cancelled`,
      kind: "RESERVATION_CANCELLED",
      title: "Cancelación",
      narrative:
        input.platform === "AIRBNB"
          ? `${input.guestName} canceló la reserva.`
          : `Reserva cancelada para ${input.guestName}.`,
      priority: "normal",
      createdAt: input.updatedAt.toISOString(),
      timeLabel: formatTimeLabel(input.updatedAt),
    });
  }

  return entries;
}

function compareTimelineEntriesChronological(
  a: NovedadesTimelineEntry,
  b: NovedadesTimelineEntry,
): number {
  const byTime = a.createdAt.localeCompare(b.createdAt);
  if (byTime !== 0) return byTime;
  return a.id.localeCompare(b.id);
}

function dedupeTimelineEntries(entries: NovedadesTimelineEntry[]): NovedadesTimelineEntry[] {
  const seen = new Set<string>();
  const result: NovedadesTimelineEntry[] = [];

  for (const entry of [...entries].sort(compareTimelineEntriesChronological)) {
    const day = entry.createdAt.slice(0, 10);
    const key = `${entry.kind}:${day}:${entry.narrative.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }

  return result;
}

export async function buildNovedadesReservationDetail(
  scope: TenantDataScope,
  reservationId: string,
): Promise<NovedadesReservationDetail | null> {
  await assertReservationInScope(scope, reservationId);

  const reservation = await db.reservation.findFirst({
    where: mergeReservationScope(scope, { id: reservationId }),
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      status: true,
      platform: true,
      reservationCode: true,
      totalAmount: true,
      currency: true,
      icalUid: true,
      createdAt: true,
      updatedAt: true,
      guestRegistrationToken: true,
      guestRegistrationCompletedAt: true,
      property: {
        select: {
          id: true,
          name: true,
          unitNumber: true,
          city: true,
          address: true,
          neighborhood: true,
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

  const enrichedNames = await getAirbnbEnrichedGuestNameByReservationIds([reservationId]);
  const revenueSourcesByReservationId =
    await loadReservationRevenueSourcesByReservationId([reservationId]);
  const displayGuestName = resolveNovedadesGuestName({
    guestName: reservation.guestName,
    confirmationCode: reservation.reservationCode,
    enrichedGuestName: enrichedNames.get(reservationId),
    platform: reservation.platform,
  });

  const checkInKey = prismaDateToKey(reservation.checkIn);
  const checkOutKey = prismaDateToKey(reservation.checkOut);
  const registrationLink = reservation.guestRegistrationToken
    ? buildGuestRegistrationUrl(reservation.guestRegistrationToken)
    : null;
  const templates = parsePropertyQuickMessageTemplates(
    reservation.property.quickMessageTemplates,
  );
  const accessCode =
    reservation.property.accessCode?.trim() ||
    null;

  const totalAmountLabel = formatPayoutAmount(
    resolveReservationFinanceRevenueForDisplay(
      reservation,
      revenueSourcesByReservationId.get(reservation.id),
    ),
    reservation.currency,
  );

  const messageData = {
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
    accessCode,
  };

  const timelineCtx: TimelineBuildContext = {
    messageData,
    templates,
    registrationLink,
    accessCode,
  };

  const [feedCards, accessCredentials, accessEvents, tasks, emailTasks, rawInquiries] = await Promise.all([
    listOperationalFeedCardsForReservation(scope, reservationId),
    db.accessCredential.findMany({
      where: { reservationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        deliveryStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.accessEvent.findMany({
      where: { reservationId },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        eventType: true,
        createdAt: true,
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
        createdAt: true,
        completedAt: true,
      },
    }),
    db.airbnbEmailTask.findMany({
      where: { reservationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        kind: true,
        createdAt: true,
      },
    }),
    listNovedadesUnlinkedInquiryItems(scope, 40),
  ]);

  const consolidation = await buildInboxHistoryConsolidationContext(scope, rawInquiries);
  const absorbedMatches = consolidation.matchesByReservationId.get(reservationId) ?? [];
  const absorbedInquiryEntries: NovedadesTimelineEntry[] = absorbedMatches
    .map((match) => {
      const inquiry = consolidation.inquiryByPendingId.get(match.pendingActivityId);
      if (!inquiry) return null;
      const base = buildAbsorbedInquiryTimelineEntry({
        pendingActivityId: inquiry.pendingActivityId,
        createdAt: inquiry.latestAt,
        narrative: inquiry.latestNarrative,
        guestName: match.resolvedGuestName,
      });
      const entry: NovedadesTimelineEntry = {
        id: base.id,
        kind: base.kind,
        title: base.title,
        narrative: base.narrative,
        priority: "normal",
        createdAt: base.createdAt,
        timeLabel: formatTimeLabel(base.createdAt),
        messageBody: base.messageBody,
      };
      if (entry.messageBody) {
        entry.suggestedReplies = buildGuestMessageReplyActions({
          messageBody: entry.messageBody,
          messageData,
          templates,
          registrationLink,
          accessCode,
        });
      }
      return entry;
    })
    .filter((entry): entry is NovedadesTimelineEntry => Boolean(entry));

  const feedEntries = feedCards
    .flatMap((card) => cardToTimelineEntries(card, timelineCtx));
  const hasFeedNewReservation = feedCards.some((card) => card.kind === "NEW_RESERVATION");
  const hasFeedCancellation = feedCards.some(
    (card) => card.kind === "RESERVATION_CANCELLED",
  );

  const milestoneEntries = buildMilestoneEntries({
    reservationId,
    guestName: displayGuestName,
    platform: reservation.platform,
    status: reservation.status,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    guestRegistrationToken: reservation.guestRegistrationToken,
    guestRegistrationCompletedAt: reservation.guestRegistrationCompletedAt,
    hasFeedNewReservation,
    hasFeedCancellation,
    amountLabel: totalAmountLabel,
  });

  const accessEntries: NovedadesTimelineEntry[] = [];

  for (const credential of accessCredentials) {
    if (credential.status === AccessCredentialStatus.PENDING) continue;
    accessEntries.push({
      id: `access:${credential.id}`,
      kind: "ACCESS_CODE",
      title: "Código TTLock",
      narrative: `Código de acceso ${ACCESS_STATUS_LABELS[credential.status] ?? credential.status.toLowerCase()}.`,
      priority: "normal",
      createdAt: credential.updatedAt.toISOString(),
      timeLabel: formatTimeLabel(credential.updatedAt),
    });
  }

  if (
    reservation.property.accessCode?.trim() &&
    accessCredentials.length === 0
  ) {
    accessEntries.push({
      id: `${reservationId}:manual-access`,
      kind: "ACCESS_CODE",
      title: "Código de acceso",
      narrative: "La propiedad tiene un código de acceso manual configurado.",
      priority: "normal",
      createdAt: reservation.createdAt.toISOString(),
      timeLabel: formatTimeLabel(reservation.createdAt),
    });
  }

  for (const event of accessEvents) {
    accessEntries.push({
      id: `access-event:${event.id}`,
      kind: "ACCESS_CODE",
      title: ACCESS_EVENT_LABELS[event.eventType] ?? "Acceso inteligente",
      narrative:
        ACCESS_EVENT_LABELS[event.eventType] ??
        "Evento registrado en la cerradura.",
      priority: event.eventType === "LOCK_SYNC_FAILED" ? "attention" : "normal",
      createdAt: event.createdAt.toISOString(),
      timeLabel: formatTimeLabel(event.createdAt),
    });
  }

  const taskEntries: NovedadesTimelineEntry[] = [];
  for (const task of tasks) {
    taskEntries.push({
      id: `task:${task.id}`,
      kind: "TASK",
      title: "Tarea",
      narrative: `${task.title} — ${TASK_STATUS_LABELS[task.status] ?? task.status.toLowerCase()}.`,
      priority: task.status === "PENDING" ? "attention" : "normal",
      createdAt: task.createdAt.toISOString(),
      timeLabel: formatTimeLabel(task.createdAt),
    });
    if (task.completedAt) {
      taskEntries.push({
        id: `task-done:${task.id}`,
        kind: "TASK",
        title: "Tarea completada",
        narrative: `Se completó: ${task.title}.`,
        priority: "normal",
        createdAt: task.completedAt.toISOString(),
        timeLabel: formatTimeLabel(task.completedAt),
      });
    }
  }

  for (const emailTask of emailTasks) {
    const narrative = emailTask.description?.trim() || emailTask.title;
    taskEntries.push({
      id: `email-task:${emailTask.id}`,
      kind: "TASK",
      title: "Acción del correo Airbnb",
      narrative: `${emailTask.title} — ${TASK_STATUS_LABELS[emailTask.status] ?? emailTask.status.toLowerCase()}. ${narrative}`,
      priority: emailTask.status === "PENDING" ? "attention" : "normal",
      createdAt: emailTask.createdAt.toISOString(),
      timeLabel: formatTimeLabel(emailTask.createdAt),
    });
  }

  const entries = dedupeTimelineEntries([
    ...absorbedInquiryEntries,
    ...milestoneEntries,
    ...feedEntries,
    ...accessEntries,
    ...taskEntries,
  ]);

  for (const entry of entries) {
    if (
      (entry.kind === "RESERVATION_CREATED" || entry.kind === "NEW_RESERVATION") &&
      !entry.suggestedReplies?.length
    ) {
      const data = buildQuickMessageDataFromReservation({
        ...messageData,
        registrationLink,
        accessCode,
      });
      const welcomeText = buildQuickMessage("WELCOME", data, templates);
      if (welcomeText.trim()) {
        entry.suggestedReplies = [
          {
            id: "quick:WELCOME",
            label: quickMessageButtonLabel("WELCOME"),
            messageText: welcomeText,
            variant: "primary",
            hint: "Copia y pega en el chat de Airbnb",
          },
        ];
      }
    }
  }

  const stayStage = detectNovedadesStayStage({
    status: reservation.status,
    checkIn: checkInKey,
    checkOut: checkOutKey,
  });

  const stageActions = buildNovedadesSuggestedActions({
    stage: stayStage,
    status: reservation.status,
    checkIn: checkInKey,
    checkOut: checkOutKey,
    guestRegistrationCompleted: Boolean(reservation.guestRegistrationCompletedAt),
    hasRegistrationLink: Boolean(registrationLink),
    entries,
    messageData,
    templates,
    accessCode,
    registrationLink,
  });
  const copyMessageActions = buildAllQuickMessageCopyActions({
    messageData,
    templates,
    accessCode,
    registrationLink,
    highlightTypes: stageActions
      .map((action) => action.id.replace(/^quick:/, ""))
      .filter((id): id is QuickMessageType =>
        [
          "WELCOME",
          "REGISTRATION",
          "ACCESS",
          "FOLLOW_UP",
          "HOUSE_RULES",
          "CHECKOUT",
          "REVIEW",
        ].includes(id),
      ),
  });

  const propertyLabel = formatPropertyLabel(reservation.property);

  return {
    reservationId: reservation.id,
    guestName: displayGuestName,
    guestInitials: guestInitialsFromName(displayGuestName),
    propertyLabel,
    propertyId: reservation.property.id,
    dateRangeLabel: formatDateRange(reservation.checkIn, reservation.checkOut),
    confirmationCode: reservation.reservationCode,
    reservationStatus: reservation.status,
    statusLabel: RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status,
    platform: reservation.platform,
    checkIn: checkInKey,
    checkOut: checkOutKey,
    totalAmountLabel,
    entries: [...entries].sort(compareTimelineEntriesChronological),
    stayStage: novedadesStayStageLabel(stayStage),
    copyMessageActions,
  };
}

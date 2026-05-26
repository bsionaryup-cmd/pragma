import {
  AirbnbEmailEventKind,
  AirbnbEmailTaskKind,
} from "@prisma/client";
import { db } from "@/lib/db";
import type { ReservationMatchResult, SafeCommunicationIntent } from "@/modules/airbnb-email/types";

export async function createEmailDerivedTask(input: {
  auditId: string;
  kind: AirbnbEmailTaskKind;
  title: string;
  description?: string | null;
  match: ReservationMatchResult;
}) {
  await db.airbnbEmailTask.create({
    data: {
      auditId: input.auditId,
      kind: input.kind,
      title: input.title,
      description: input.description,
      reservationId: input.match.reservationId,
      propertyId: input.match.propertyId,
      metadata: {
        matchMethod: input.match.method,
        confidence: input.match.confidence,
        tier: input.match.tier,
      },
    },
  });
}

export async function createTasksForEmailEvent(input: {
  auditId: string;
  eventKind: AirbnbEmailEventKind;
  match: ReservationMatchResult;
  communicationIntent?: SafeCommunicationIntent | null;
}) {
  if (input.match.requiresManualReview) {
    await createEmailDerivedTask({
      auditId: input.auditId,
      kind: AirbnbEmailTaskKind.MANUAL_REVIEW,
      title: "Revisar correo Airbnb (match pendiente)",
      description: `Evento ${input.eventKind}`,
      match: input.match,
    });
  }

  const intent = input.communicationIntent;
  if (intent === "EARLY_CHECKIN") {
    await createEmailDerivedTask({
      auditId: input.auditId,
      kind: AirbnbEmailTaskKind.EARLY_CHECKIN_REQUEST,
      title: "Solicitud de check-in temprano",
      match: input.match,
    });
  }
  if (intent === "TRANSPORT") {
    await createEmailDerivedTask({
      auditId: input.auditId,
      kind: AirbnbEmailTaskKind.TRANSPORT_REQUEST,
      title: "Solicitud de transporte",
      match: input.match,
    });
  }
  if (intent === "REVIEW_RESPONSE") {
    await createEmailDerivedTask({
      auditId: input.auditId,
      kind: AirbnbEmailTaskKind.REVIEW_RESPONSE_PENDING,
      title: "Responder mensaje / reseña",
      match: input.match,
    });
  }

  if (input.eventKind === AirbnbEmailEventKind.HOST_REVIEW_REQUESTED) {
    await createEmailDerivedTask({
      auditId: input.auditId,
      kind: AirbnbEmailTaskKind.REVIEW_RESPONSE_PENDING,
      title: "Responder reseña pendiente",
      match: input.match,
    });
  }

  if (
    input.eventKind === AirbnbEmailEventKind.PAYOUT_PROCESSED &&
    !input.match.reservationId
  ) {
    await createEmailDerivedTask({
      auditId: input.auditId,
      kind: AirbnbEmailTaskKind.PAYOUT_MISMATCH,
      title: "Pago Airbnb sin reserva vinculada",
      match: input.match,
    });
  }

  if (
    input.eventKind === AirbnbEmailEventKind.UNKNOWN &&
    !input.match.reservationId
  ) {
    await createEmailDerivedTask({
      auditId: input.auditId,
      kind: AirbnbEmailTaskKind.ORPHAN_EMAIL_EVENT,
      title: "Correo Airbnb no clasificado",
      match: input.match,
    });
  }
}

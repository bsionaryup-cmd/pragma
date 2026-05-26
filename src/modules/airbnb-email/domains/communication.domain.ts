import type { Prisma } from "@prisma/client";
import { AirbnbEmailEventKind } from "@prisma/client";
import { db } from "@/lib/db";
import { detectSafeCommunicationIntent } from "@/modules/airbnb-email/domains/communication-intent";
import type { ReservationMatchResult } from "@/modules/airbnb-email/types";

export function isCommunicationEventKind(kind: AirbnbEmailEventKind): boolean {
  return kind === AirbnbEmailEventKind.RESERVATION_MESSAGE;
}

export async function persistReservationCommunication(input: {
  auditId: string;
  match: ReservationMatchResult;
  messageBody: string;
  payload: Prisma.InputJsonValue;
}) {
  const intent = detectSafeCommunicationIntent(input.messageBody);
  const requiresAction = intent === "REQUIRES_ATTENTION";

  await db.reservationCommunication.create({
    data: {
      auditId: input.auditId,
      reservationId: input.match.reservationId,
      senderType: "GUEST",
      threadId: null,
      rawMessage: input.messageBody,
      parsedIntent: intent,
      requiresAction,
      payload: input.payload,
    },
  });

  return intent;
}

import type { Prisma, ReservationEventType } from "@prisma/client";
import { db } from "@/lib/db";
import type { ModificationEventMetadata } from "@/modules/reservation-events/types";

export async function persistReservationObservabilityEvent(input: {
  organizationId: string | null;
  reservationId?: string | null;
  propertyId?: string | null;
  eventType: ReservationEventType;
  title: string;
  description: string;
  metadata?: ModificationEventMetadata | null;
  source?: string;
  sourceEmailId?: string | null;
  rawSubject?: string | null;
  classificationConfidence?: number | null;
}): Promise<{ created: boolean; id?: string }> {
  if (input.sourceEmailId) {
    const existing = await db.reservationEvent.findFirst({
      where: {
        sourceEmailId: input.sourceEmailId,
        eventType: input.eventType,
      },
      select: { id: true },
    });
    if (existing) {
      return { created: false, id: existing.id };
    }
  }

  const row = await db.reservationEvent.create({
    data: {
      organizationId: input.organizationId,
      reservationId: input.reservationId ?? null,
      propertyId: input.propertyId ?? null,
      eventType: input.eventType,
      title: input.title,
      description: input.description,
      metadataJson: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      source: input.source ?? "airbnb_email",
      sourceEmailId: input.sourceEmailId ?? null,
      rawSubject: input.rawSubject ?? null,
      classificationConfidence:
        input.classificationConfidence != null
          ? input.classificationConfidence
          : null,
    },
    select: { id: true },
  });

  return { created: true, id: row.id };
}

async function resolvePropertyIdForObservability(input: {
  reservationId?: string | null;
  propertyId?: string | null;
}): Promise<string | null> {
  if (input.propertyId) return input.propertyId;
  if (!input.reservationId) return null;

  const reservation = await db.reservation.findUnique({
    where: { id: input.reservationId },
    select: { propertyId: true },
  });
  return reservation?.propertyId ?? null;
}

export { resolvePropertyIdForObservability };

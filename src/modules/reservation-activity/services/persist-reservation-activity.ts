import type { Prisma, ReservationActivityType } from "@prisma/client";
import { db } from "@/lib/db";
import type { ActivityMetadata } from "@/modules/reservation-activity/types";

export async function persistReservationActivity(input: {
  reservationId: string;
  propertyId?: string | null;
  activityType: ReservationActivityType;
  title: string;
  content: string;
  source?: string;
  sourceEmailId: string;
  senderName?: string | null;
  senderEmail?: string | null;
  metadata?: ActivityMetadata | null;
  createdAt?: Date | null;
}): Promise<{ created: boolean; id?: string }> {
  const existing = await db.reservationActivity.findUnique({
    where: { sourceEmailId: input.sourceEmailId },
    select: { id: true },
  });
  if (existing) {
    return { created: false, id: existing.id };
  }

  const row = await db.reservationActivity.create({
    data: {
      reservationId: input.reservationId,
      propertyId: input.propertyId ?? null,
      activityType: input.activityType,
      title: input.title,
      content: input.content,
      source: input.source ?? "airbnb_email",
      sourceEmailId: input.sourceEmailId,
      senderName: input.senderName ?? null,
      senderEmail: input.senderEmail ?? null,
      metadataJson: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
    select: { id: true },
  });

  return { created: true, id: row.id };
}

export async function resolvePropertyIdForActivity(input: {
  reservationId: string;
  propertyId?: string | null;
}): Promise<string | null> {
  if (input.propertyId) return input.propertyId;

  const reservation = await db.reservation.findUnique({
    where: { id: input.reservationId },
    select: { propertyId: true },
  });
  return reservation?.propertyId ?? null;
}

import type { Prisma, ReservationActivityType } from "@prisma/client";
import { db } from "@/lib/db";
import type { ActivityMetadata } from "@/modules/reservation-activity/types";

export async function persistReservationActivityPending(input: {
  organizationId: string | null;
  propertyId?: string | null;
  activityType: ReservationActivityType;
  title: string;
  content: string;
  sourceEmailId: string;
  rawSubject?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  metadata?: ActivityMetadata | null;
  classificationConfidence?: number | null;
  createdAt?: Date | null;
}): Promise<{ created: boolean; id?: string }> {
  const existing = await db.reservationActivityPending.findUnique({
    where: { sourceEmailId: input.sourceEmailId },
    select: { id: true },
  });
  if (existing) {
    return { created: false, id: existing.id };
  }

  const row = await db.reservationActivityPending.create({
    data: {
      organizationId: input.organizationId,
      propertyId: input.propertyId ?? null,
      activityType: input.activityType,
      title: input.title,
      content: input.content,
      sourceEmailId: input.sourceEmailId,
      rawSubject: input.rawSubject ?? null,
      senderName: input.senderName ?? null,
      senderEmail: input.senderEmail ?? null,
      metadataJson: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      classificationConfidence:
        input.classificationConfidence != null
          ? input.classificationConfidence
          : null,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    },
    select: { id: true },
  });

  return { created: true, id: row.id };
}

export async function deletePendingActivityBySourceEmailId(
  sourceEmailId: string,
): Promise<void> {
  await db.reservationActivityPending.deleteMany({
    where: { sourceEmailId },
  });
}

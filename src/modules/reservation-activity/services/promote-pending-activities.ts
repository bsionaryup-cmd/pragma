import { db } from "@/lib/db";
import { persistReservationActivity } from "@/modules/reservation-activity/services/persist-reservation-activity";
import { deletePendingActivityBySourceEmailId } from "@/modules/reservation-activity/services/persist-reservation-activity-pending";

/**
 * Moves pending rows to reservation_activity when the audit is now linked.
 * Read-side promotion — does not mutate reservations or matching logic.
 */
export async function promotePendingActivitiesForReservation(
  reservationId: string,
): Promise<number> {
  const audits = await db.emailIngestionAudit.findMany({
    where: { reservationId },
    select: { id: true },
  });
  const auditIds = audits.map((row) => row.id);
  if (auditIds.length === 0) return 0;

  const pendingRows = await db.reservationActivityPending.findMany({
    where: { sourceEmailId: { in: auditIds } },
  });

  let promoted = 0;
  for (const pending of pendingRows) {
    const existingActivity = await db.reservationActivity.findUnique({
      where: { sourceEmailId: pending.sourceEmailId },
      select: { id: true },
    });
    if (existingActivity) {
      await deletePendingActivityBySourceEmailId(pending.sourceEmailId);
      continue;
    }

    await persistReservationActivity({
      reservationId,
      propertyId: pending.propertyId,
      activityType: pending.activityType,
      title: pending.title,
      content: pending.content,
      sourceEmailId: pending.sourceEmailId,
      senderName: pending.senderName,
      senderEmail: pending.senderEmail,
      metadata: pending.metadataJson as Record<string, unknown> | null,
      createdAt: pending.createdAt,
    });
    await deletePendingActivityBySourceEmailId(pending.sourceEmailId);
    promoted += 1;
  }

  return promoted;
}

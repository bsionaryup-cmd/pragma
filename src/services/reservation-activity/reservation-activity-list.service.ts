import "server-only";

import type { ReservationActivityType } from "@prisma/client";
import { db } from "@/lib/db";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { formatDateTime } from "@/lib/helpers/date";
import { promotePendingActivitiesForReservation } from "@/modules/reservation-activity/services/promote-pending-activities";

export type ReservationActivityRow = {
  id: string;
  activityType: ReservationActivityType;
  title: string;
  content: string;
  senderName: string | null;
  senderEmail: string | null;
  metadata: unknown;
  createdAt: string;
  createdAtFormatted: string;
};

const ACTIVITY_TYPE_LABELS: Record<ReservationActivityType, string> = {
  AIRBNB_MESSAGE: "Mensaje Airbnb",
  MODIFICATION_REQUEST: "Solicitud de modificación",
  MODIFICATION_APPROVED: "Modificación aprobada",
  UNMATCHED_AIRBNB: "Correo Airbnb",
};

export function reservationActivityTypeLabel(
  activityType: ReservationActivityType,
): string {
  return ACTIVITY_TYPE_LABELS[activityType];
}

export async function listReservationActivityForReservation(
  scope: TenantDataScope,
  reservationId: string,
): Promise<ReservationActivityRow[]> {
  await assertReservationInScope(scope, reservationId);
  await promotePendingActivitiesForReservation(reservationId);

  const rows = await db.reservationActivity.findMany({
    where: { reservationId },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      activityType: true,
      title: true,
      content: true,
      senderName: true,
      senderEmail: true,
      metadataJson: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    activityType: row.activityType,
    title: row.title,
    content: row.content,
    senderName: row.senderName,
    senderEmail: row.senderEmail,
    metadata: row.metadataJson,
    createdAt: row.createdAt.toISOString(),
    createdAtFormatted: formatDateTime(row.createdAt, "—", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  }));
}

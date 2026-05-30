import "server-only";

import type { ReservationActivityType } from "@prisma/client";
import { db } from "@/lib/db";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";

export type ReservationActivityUnreadSummary = {
  unreadCount: number;
  hint: string | null;
};

const HINT_BY_TYPE: Partial<Record<ReservationActivityType, string>> = {
  AIRBNB_MESSAGE: "Mensaje sin revisar",
  MODIFICATION_REQUEST: "Solicitud de cambio",
  MODIFICATION_APPROVED: "Cambio aprobado",
  UNMATCHED_AIRBNB: "Actividad nueva",
};

function buildHint(
  count: number,
  latestType: ReservationActivityType | null,
): string | null {
  if (count <= 0) return null;
  if (count === 1 && latestType) {
    return HINT_BY_TYPE[latestType] ?? "Actividad nueva";
  }
  return `${count} actividades nuevas`;
}

const UNREAD_QUERY_CHUNK = 100;

function buildUnreadActivityFilter(
  reservationIds: string[],
  seenByReservation: Map<string, Date>,
) {
  return reservationIds.map((reservationId) => {
    const seenAt = seenByReservation.get(reservationId);
    return seenAt
      ? { reservationId, createdAt: { gt: seenAt } }
      : { reservationId };
  });
}

async function loadUnreadActivities(
  reservationIds: string[],
  seenByReservation: Map<string, Date>,
) {
  if (reservationIds.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < reservationIds.length; i += UNREAD_QUERY_CHUNK) {
    chunks.push(reservationIds.slice(i, i + UNREAD_QUERY_CHUNK));
  }

  const chunkResults = await Promise.all(
    chunks.map((chunk) =>
      db.reservationActivity.findMany({
        where: { OR: buildUnreadActivityFilter(chunk, seenByReservation) },
        select: {
          reservationId: true,
          createdAt: true,
          activityType: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ),
  );

  return chunkResults.flat();
}

export async function getReservationActivityUnreadMap(
  scope: TenantDataScope,
  reservationIds: string[],
): Promise<Map<string, ReservationActivityUnreadSummary>> {
  const result = new Map<string, ReservationActivityUnreadSummary>();
  if (reservationIds.length === 0) return result;

  const seenRows = await db.reservationActivitySeen.findMany({
    where: {
      userId: scope.userId,
      reservationId: { in: reservationIds },
    },
    select: { reservationId: true, lastSeenAt: true },
  });

  const seenByReservation = new Map(
    seenRows.map((row) => [row.reservationId, row.lastSeenAt]),
  );

  for (const reservationId of reservationIds) {
    result.set(reservationId, { unreadCount: 0, hint: null });
  }

  const activityRows = await loadUnreadActivities(
    reservationIds,
    seenByReservation,
  );

  for (const activity of activityRows) {
    const seenAt = seenByReservation.get(activity.reservationId);
    if (seenAt && activity.createdAt <= seenAt) continue;

    const current = result.get(activity.reservationId) ?? {
      unreadCount: 0,
      hint: null,
    };
    current.unreadCount += 1;
    if (current.unreadCount === 1) {
      current.hint = HINT_BY_TYPE[activity.activityType] ?? "Actividad nueva";
    } else {
      current.hint = buildHint(current.unreadCount, null);
    }
    result.set(activity.reservationId, current);
  }

  return result;
}

export async function markReservationActivitySeen(
  scope: TenantDataScope,
  reservationId: string,
): Promise<void> {
  await db.reservationActivitySeen.upsert({
    where: {
      userId_reservationId: {
        userId: scope.userId,
        reservationId,
      },
    },
    create: {
      userId: scope.userId,
      reservationId,
      lastSeenAt: new Date(),
    },
    update: {
      lastSeenAt: new Date(),
    },
  });
}

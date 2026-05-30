import { BookingPlatform, ReservationStatus } from "@prisma/client";
import {
  activeIcalUrlOnPropertyFilter,
  hasActiveAirbnbIcalImport,
  HISTORICAL_BACKFILL_ICAL_PREFIX,
  isHistoricalBackfillUid,
} from "@/lib/airbnb/ical-sync-utils";
import { icalSyncLog } from "@/lib/airbnb/ical-sync-logger";
import { db } from "@/lib/db";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { mergeReservationScope } from "@/lib/platform/tenant-data-scope";
import { touchPropertyIcalExport } from "@/services/airbnb/airbnb-export-push.service";

function isGhostReservation(input: {
  platform: BookingPlatform;
  icalUid: string | null;
  status: ReservationStatus;
  propertyIcalUrl: string | null;
}): boolean {
  if (isHistoricalBackfillUid(input.icalUid)) return false;

  if (input.platform === BookingPlatform.BOOKING) return true;

  if (input.platform === BookingPlatform.AIRBNB) {
    if (!input.icalUid) return true;
    if (input.status === ReservationStatus.CANCELLED) return true;
    if (!hasActiveAirbnbIcalImport(input.propertyIcalUrl)) return true;
    return false;
  }

  if (input.icalUid && !hasActiveAirbnbIcalImport(input.propertyIcalUrl)) {
    return true;
  }

  return false;
}

/**
 * Elimina reservas que no son directas, importadas de Airbnb con iCal, o sincronizadas.
 * También borra imports cancelados/huérfanos que ya no existen en el calendario real.
 */
export async function purgeGhostReservations(
  scope: TenantDataScope,
): Promise<number> {
  const candidates = await db.reservation.findMany({
    where: mergeReservationScope(scope, {
      NOT: {
        icalUid: { startsWith: HISTORICAL_BACKFILL_ICAL_PREFIX },
      },
      OR: [
        { platform: BookingPlatform.BOOKING },
        { platform: BookingPlatform.AIRBNB, icalUid: null },
        { platform: BookingPlatform.AIRBNB, status: ReservationStatus.CANCELLED },
        {
          AND: [
            {
              OR: [
                { platform: BookingPlatform.AIRBNB },
                { icalUid: { not: null } },
              ],
            },
            {
              property: {
                NOT: activeIcalUrlOnPropertyFilter(),
              },
            },
          ],
        },
      ],
    }),
    select: {
      id: true,
      propertyId: true,
      platform: true,
      icalUid: true,
      status: true,
      property: { select: { icalUrl: true } },
    },
  });

  const ghostIds = candidates
    .filter((row) =>
      isGhostReservation({
        platform: row.platform,
        icalUid: row.icalUid,
        status: row.status,
        propertyIcalUrl: row.property.icalUrl,
      }),
    )
    .map((row) => row.id);

  if (ghostIds.length === 0) return 0;

  const affectedPropertyIds = [
    ...new Set(
      candidates
        .filter((row) => ghostIds.includes(row.id))
        .map((row) => row.propertyId),
    ),
  ];

  const deleted = await db.reservation.deleteMany({
    where: { id: { in: ghostIds } },
  });

  if (deleted.count > 0) {
    icalSyncLog.info("ghost_reservations_purged", {
      count: deleted.count,
      propertyCount: affectedPropertyIds.length,
    });
    await Promise.all(affectedPropertyIds.map((id) => touchPropertyIcalExport(id)));
  }

  return deleted.count;
}

const PURGE_THROTTLE_MS = 5 * 60 * 1000;
const lastPurgeAtByScope = new Map<string, number>();

function purgeScopeKey(scope: TenantDataScope): string {
  return `${scope.organizationId ?? "solo"}:${scope.userId}`;
}

/** Evita purgas repetidas en cada carga del calendario; sync/iCal siguen usando purge completo. */
export async function purgeGhostReservationsThrottled(
  scope: TenantDataScope,
): Promise<number> {
  const key = purgeScopeKey(scope);
  const now = Date.now();
  const last = lastPurgeAtByScope.get(key) ?? 0;
  if (now - last < PURGE_THROTTLE_MS) return 0;
  lastPurgeAtByScope.set(key, now);
  return purgeGhostReservations(scope);
}

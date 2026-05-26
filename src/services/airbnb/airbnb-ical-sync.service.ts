import {
  BookingPlatform,
  ReservationStatus,
} from "@prisma/client";
import {
  formatDateKey,
  isAirbnbBlockedSummary,
  parseIcsFeed,
} from "@/services/airbnb/ical-parser";
import { dateKeyToPrismaDate } from "@/lib/dates";
import {
  activePropertiesWithIcalFilter,
  canSyncAirbnbIcalImport,
  guardActiveIcalImportUrl,
  hasActiveAirbnbIcalImport,
  isPragmaExportedUid,
  sleep,
} from "@/lib/airbnb/ical-sync-utils";
import {
  enforceOwnerDisconnectedAirbnbImports,
  enforcePropertyAirbnbIcalIsolation,
} from "@/services/airbnb/airbnb-ical-orphan.service";
import { purgeGhostReservations } from "@/services/reservations/ghost-reservation.service";
import { icalSyncLog } from "@/lib/airbnb/ical-sync-logger";
import { normalizeIcalUrl } from "@/services/airbnb/airbnb-import.service";
import {
  ensureGuestRegistrationForReservation,
  isGuestRegistrationEligibleStatus,
} from "@/services/guests/guest-registration.service";
import {
  emitBookingCancelled,
  emitBookingCheckedOut,
  emitBookingConfirmed,
  emitBookingModified,
} from "@/modules/integrations/ttlock/ttlock.events";
import { findOverlappingReservation } from "@/services/reservations/reservation-conflicts";
import { deriveReservationStatusFromDates } from "@/services/reservations/reservation-status";
import { db } from "@/lib/db";

const FETCH_HEADERS = {
  "User-Agent": "PRAGMA-PMS/1.0 (iCal sync)",
  Accept: "text/calendar,text/plain,*/*",
  "Cache-Control": "no-cache, no-store",
};

/** Pausa entre propiedades para evitar rate-limit de Airbnb. */
const INTER_PROPERTY_SYNC_DELAY_MS = 450;

let syncInProgress = false;
const syncWaitQueue: Array<() => void> = [];

function releaseNextSyncWaiter() {
  const next = syncWaitQueue.shift();
  if (next) next();
}

async function acquireSyncLock() {
  while (syncInProgress) {
    await new Promise<void>((resolve) => {
      syncWaitQueue.push(resolve);
    });
  }
  syncInProgress = true;
}

async function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSyncLock();
  try {
    return await fn();
  } finally {
    syncInProgress = false;
    releaseNextSyncWaiter();
  }
}

async function findReservationByIcalUid(
  propertyId: string,
  icalUid: string,
) {
  return db.reservation.findFirst({
    where: { propertyId, icalUid },
    select: {
      id: true,
      checkIn: true,
      checkOut: true,
      status: true,
      guestRegistrationCompletedAt: true,
    },
  });
}

export type PropertyIcalSyncResult = {
  propertyId: string;
  propertyName: string;
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
  echoSkipped: number;
  eventsParsed: number;
  fetchMs: number;
  error?: string;
};

export type AirbnbSyncSummary = {
  propertiesSynced: number;
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
  echoSkipped: number;
  results: PropertyIcalSyncResult[];
  lastSyncedAt: string | null;
  durationMs: number;
};

function parseGuestName(summary: string, blocked: boolean): string {
  if (blocked) return "Bloqueo Airbnb";
  const cleaned = summary
    .replace(/^reserved\s*[-–:]?\s*/i, "")
    .replace(/^reservado\s*[-–:]?\s*/i, "")
    .trim();
  return cleaned || "Huésped Airbnb";
}

function cacheBustIcalUrl(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("_pragma_ts", String(Date.now()));
  return parsed.toString();
}

async function fetchIcalFeed(icalUrl: string): Promise<string> {
  const activeUrl = guardActiveIcalImportUrl(icalUrl);
  if (!activeUrl) {
    throw new Error("Propiedad sin iCal de Airbnb conectado");
  }
  const url = cacheBustIcalUrl(normalizeIcalUrl(activeUrl));
  const response = await fetch(url, {
    headers: FETCH_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new Error(`iCal no disponible (${response.status})`);
  }

  const text = await response.text();
  if (!text.includes("BEGIN:VCALENDAR")) {
    throw new Error("Respuesta iCal inválida");
  }

  return text;
}

async function fetchIcalFeedWithRetry(
  propertyId: string,
  propertyName: string,
  icalUrl: string,
): Promise<{ feed: string; fetchMs: number; attempts: number }> {
  if (!canSyncAirbnbIcalImport(icalUrl)) {
    throw new Error("Propiedad sin iCal de Airbnb conectado");
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = Date.now();
    try {
      const feed = await fetchIcalFeed(icalUrl);
      const fetchMs = Date.now() - started;
      icalSyncLog.info("fetch_ok", {
        propertyId,
        propertyName,
        fetchMs,
        attempt: attempt + 1,
      });
      return { feed, fetchMs, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      const message =
        error instanceof Error ? error.message : "Error al descargar iCal";
      icalSyncLog.warn("fetch_retry", {
        propertyId,
        propertyName,
        attempt: attempt + 1,
        message,
      });
      if (attempt === 0) await sleep(700);
    }
  }
  const message =
    lastError instanceof Error ? lastError.message : "Error al descargar iCal";
  icalSyncLog.error("fetch_failed", { propertyId, propertyName, message });
  throw lastError instanceof Error ? lastError : new Error(message);
}

function emptyPropertyResult(
  propertyId: string,
  propertyName: string,
  error?: string,
): PropertyIcalSyncResult {
  return {
    propertyId,
    propertyName,
    created: 0,
    updated: 0,
    cancelled: 0,
    skipped: 0,
    echoSkipped: 0,
    eventsParsed: 0,
    fetchMs: 0,
    error,
  };
}

export async function syncPropertyIcalCalendar(
  propertyId: string,
  ownerId: string,
): Promise<PropertyIcalSyncResult> {
  const property = await db.property.findFirst({
    where: { id: propertyId, ownerId },
    select: { id: true, name: true, icalUrl: true },
  });
  if (!property) {
    return emptyPropertyResult(propertyId, "—", "Propiedad no encontrada");
  }
  const activeUrl = guardActiveIcalImportUrl(property.icalUrl);
  if (!activeUrl) {
    await enforcePropertyAirbnbIcalIsolation(property.id, property.icalUrl);
    return emptyPropertyResult(
      property.id,
      property.name,
      "Propiedad sin iCal de Airbnb conectado",
    );
  }
  return withSyncLock(() => syncPropertyIcalCalendarInner(propertyId, ownerId));
}

export async function syncPropertyIcalCalendarInner(
  propertyId: string,
  ownerId: string,
): Promise<PropertyIcalSyncResult> {
  const property = await db.property.findFirst({
    where: { id: propertyId, ownerId },
    select: { id: true, name: true, icalUrl: true, currency: true, organizationId: true },
  });

  if (!property) {
    return emptyPropertyResult(propertyId, "—", "Propiedad no encontrada");
  }

  if (!canSyncAirbnbIcalImport(property.icalUrl)) {
    await enforcePropertyAirbnbIcalIsolation(property.id, property.icalUrl);
    icalSyncLog.warn("property_sync_skipped_not_connected", {
      propertyId: property.id,
      propertyName: property.name,
      icalUrl: property.icalUrl ?? null,
    });
    return emptyPropertyResult(
      property.id,
      property.name,
      "Propiedad sin iCal de Airbnb conectado",
    );
  }

  const trimmedIcal = guardActiveIcalImportUrl(property.icalUrl)!;

  icalSyncLog.info("property_sync_start", {
    propertyId: property.id,
    propertyName: property.name,
    ownerId,
  });

  let created = 0;
  let updated = 0;
  let cancelled = 0;
  let skipped = 0;
  let echoSkipped = 0;
  let eventsParsed = 0;
  let fetchMs = 0;

  try {
    const fetched = await fetchIcalFeedWithRetry(
      property.id,
      property.name,
      trimmedIcal,
    );
    fetchMs = fetched.fetchMs;

    const events = parseIcsFeed(fetched.feed);
    eventsParsed = events.length;
    const seenUids = new Set<string>();

    icalSyncLog.info("feed_parsed", {
      propertyId: property.id,
      propertyName: property.name,
      eventsParsed,
    });

    for (const event of events) {
      if (isPragmaExportedUid(event.uid)) {
        echoSkipped += 1;
        skipped += 1;
        continue;
      }

      const blocked = isAirbnbBlockedSummary(event.summary);
      if (blocked) {
        skipped += 1;
        continue;
      }

      seenUids.add(event.uid);
      const checkIn = dateKeyToPrismaDate(formatDateKey(event.dtstart));
      const checkOut = dateKeyToPrismaDate(formatDateKey(event.dtend));
      const guestName = parseGuestName(event.summary, blocked);
      const status = deriveReservationStatusFromDates(checkIn, checkOut, {
        blocked,
      });

      const existing = await findReservationByIcalUid(property.id, event.uid);

      const guestFirstName = blocked
        ? "Bloqueo"
        : (guestName.split(" ")[0] ?? "Huésped");
      const guestLastName = blocked
        ? "Airbnb"
        : guestName.split(" ").slice(1).join(" ") || null;

      const payload = {
        guestName,
        guestFirstName,
        guestLastName,
        checkIn,
        checkOut,
        status,
        platform: BookingPlatform.AIRBNB,
      };

      if (existing) {
        const prevStatus = existing.status;
        const datesChanged =
          existing.checkIn.getTime() !== checkIn.getTime() ||
          existing.checkOut.getTime() !== checkOut.getTime();

        await db.reservation.update({
          where: { id: existing.id },
          data: existing.guestRegistrationCompletedAt
            ? {
                checkIn: payload.checkIn,
                checkOut: payload.checkOut,
                status: payload.status,
                platform: payload.platform,
              }
            : payload,
        });
        if (!blocked && isGuestRegistrationEligibleStatus(status)) {
          await ensureGuestRegistrationForReservation(existing.id);
        }

        if (status === ReservationStatus.CHECKED_OUT && prevStatus !== ReservationStatus.CHECKED_OUT) {
          await emitBookingCheckedOut({
            reservationId: existing.id,
            propertyId: property.id,
            ownerId,
          });
        } else if (status === ReservationStatus.CANCELLED && prevStatus !== ReservationStatus.CANCELLED) {
          await emitBookingCancelled({
            reservationId: existing.id,
            propertyId: property.id,
            ownerId,
          });
        } else if (datesChanged) {
          await emitBookingModified({
            reservationId: existing.id,
            propertyId: property.id,
            ownerId,
            checkIn,
            checkOut,
            guestRegistrationCompleted: Boolean(existing.guestRegistrationCompletedAt),
          });
        }

        updated += 1;
        continue;
      }

      const overlap = await findOverlappingReservation(
        property.id,
        checkIn,
        checkOut,
      );

      if (overlap) {
        if (overlap.icalUid === event.uid) {
          await db.reservation.update({
            where: { id: overlap.id },
            data: payload,
          });
          if (!blocked && isGuestRegistrationEligibleStatus(status)) {
            await ensureGuestRegistrationForReservation(overlap.id);
          }
          updated += 1;
        } else {
          skipped += 1;
          icalSyncLog.info("overlap_skipped", {
            propertyId: property.id,
            propertyName: property.name,
            icalUid: event.uid,
            overlapId: overlap.id,
          });
        }
        continue;
      }

      const createdReservation = await db.reservation.create({
        data: {
          propertyId: property.id,
          icalUid: event.uid,
          ...payload,
          totalAmount: 0,
          currency: property.currency,
          internalNotes: blocked
            ? "Sincronizado desde iCal Airbnb (bloqueo)"
            : "Sincronizado desde iCal Airbnb",
        },
      });
      if (!blocked && isGuestRegistrationEligibleStatus(status)) {
        await ensureGuestRegistrationForReservation(createdReservation.id);
      }
      await emitBookingConfirmed({
        reservationId: createdReservation.id,
        propertyId: property.id,
        ownerId,
      });
      created += 1;
    }

    const stale = await db.reservation.findMany({
      where: {
        propertyId: property.id,
        platform: BookingPlatform.AIRBNB,
        icalUid: { not: null },
        status: { not: ReservationStatus.CANCELLED },
      },
      select: { id: true, icalUid: true },
    });

    for (const row of stale) {
      if (row.icalUid && !seenUids.has(row.icalUid)) {
        await db.reservation.update({
          where: { id: row.id },
          data: { status: ReservationStatus.CANCELLED },
        });
        await emitBookingCancelled({
          reservationId: row.id,
          propertyId: property.id,
          ownerId,
        });
        cancelled += 1;
      }
    }

    await db.property.update({
      where: { id: property.id },
      data: { lastIcalSyncedAt: new Date() },
    });

    await purgeGhostReservations({
      userId: ownerId,
      organizationId: property.organizationId ?? null,
    });

    icalSyncLog.info("property_sync_done", {
      propertyId: property.id,
      propertyName: property.name,
      created,
      updated,
      cancelled,
      skipped,
      echoSkipped,
      eventsParsed,
      fetchMs,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error de sincronización";
    icalSyncLog.error("property_sync_failed", {
      propertyId: property.id,
      propertyName: property.name,
      message,
      created,
      updated,
      cancelled,
      skipped,
    });
    return {
      ...emptyPropertyResult(property.id, property.name, message),
      created,
      updated,
      cancelled,
      skipped,
      echoSkipped,
      eventsParsed,
      fetchMs,
    };
  }

  return {
    propertyId: property.id,
    propertyName: property.name,
    created,
    updated,
    cancelled,
    skipped,
    echoSkipped,
    eventsParsed,
    fetchMs,
  };
}

export async function syncAllAirbnbCalendarsForOwner(
  ownerId: string,
): Promise<AirbnbSyncSummary> {
  return withSyncLock(() => syncAllAirbnbCalendarsForOwnerInner(ownerId));
}

async function syncAllAirbnbCalendarsForOwnerInner(
  ownerId: string,
): Promise<AirbnbSyncSummary> {
  const startedAt = Date.now();

  await enforceOwnerDisconnectedAirbnbImports(ownerId);

  const candidates = await db.property.findMany({
    where: activePropertiesWithIcalFilter(ownerId),
    select: { id: true, name: true, icalUrl: true },
    orderBy: { name: "asc" },
  });
  const properties = candidates.filter((p) =>
    hasActiveAirbnbIcalImport(p.icalUrl),
  );

  icalSyncLog.info("owner_sync_start", {
    ownerId,
    propertyCount: properties.length,
    propertyNames: properties.map((p) => p.name).join(", "),
  });

  const results: PropertyIcalSyncResult[] = [];
  let created = 0;
  let updated = 0;
  let cancelled = 0;
  let skipped = 0;
  let echoSkipped = 0;

  for (let index = 0; index < properties.length; index += 1) {
    const property = properties[index];
    icalSyncLog.info("owner_sync_property", {
      ownerId,
      index: index + 1,
      total: properties.length,
      propertyId: property.id,
      propertyName: property.name,
    });

    const result = await syncPropertyIcalCalendarInner(property.id, ownerId);
    results.push(result);
    created += result.created;
    updated += result.updated;
    cancelled += result.cancelled;
    skipped += result.skipped;
    echoSkipped += result.echoSkipped;

    if (result.error) {
      icalSyncLog.warn("owner_sync_property_error", {
        ownerId,
        propertyId: property.id,
        propertyName: property.name,
        message: result.error,
      });
    }

    if (index < properties.length - 1) {
      await sleep(INTER_PROPERTY_SYNC_DELAY_MS);
    }
  }

  const lastRow = await db.property.findFirst({
    where: { ownerId, lastIcalSyncedAt: { not: null } },
    orderBy: { lastIcalSyncedAt: "desc" },
    select: { lastIcalSyncedAt: true },
  });

  const durationMs = Date.now() - startedAt;
  const errors = results.filter((r) => r.error).length;

  icalSyncLog.info("owner_sync_complete", {
    ownerId,
    propertiesSynced: properties.length,
    created,
    updated,
    cancelled,
    skipped,
    echoSkipped,
    errors,
    durationMs,
  });

  return {
    propertiesSynced: properties.length,
    created,
    updated,
    cancelled,
    skipped,
    echoSkipped,
    results,
    lastSyncedAt: lastRow?.lastIcalSyncedAt?.toISOString() ?? null,
    durationMs,
  };
}

export async function getAirbnbSyncStatusForOwner(ownerId: string) {
  const candidates = await db.property.findMany({
    where: activePropertiesWithIcalFilter(ownerId),
    select: {
      id: true,
      name: true,
      unitNumber: true,
      icalUrl: true,
      lastIcalSyncedAt: true,
    },
    orderBy: { name: "asc" },
  });
  const properties = candidates.filter((p) =>
    hasActiveAirbnbIcalImport(p.icalUrl),
  );

  const lastSyncedAt = properties.reduce<Date | null>((max, p) => {
    if (!p.lastIcalSyncedAt) return max;
    if (!max || p.lastIcalSyncedAt > max) return p.lastIcalSyncedAt;
    return max;
  }, null);

  return {
    linkedCount: properties.length,
    lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      unitNumber: p.unitNumber,
      lastSyncedAt: p.lastIcalSyncedAt?.toISOString() ?? null,
    })),
  };
}

import {
  BookingPlatform,
  PropertyStatus,
  ReservationStatus,
} from "@prisma/client";
import {
  formatDateKey,
  isAirbnbBlockedSummary,
  parseIcsFeed,
} from "@/services/airbnb/ical-parser";
import { dateKeyToPrismaDate } from "@/lib/dates";
import { normalizeIcalUrl } from "@/services/airbnb/airbnb-import.service";
import { findOverlappingReservation } from "@/services/reservations/reservation-conflicts";
import { deriveReservationStatusFromDates } from "@/services/reservations/reservation-status";
import { db } from "@/lib/db";

const FETCH_HEADERS = {
  "User-Agent": "PRAGMA-PMS/1.0 (iCal sync)",
  Accept: "text/calendar,text/plain,*/*",
  "Cache-Control": "no-cache, no-store",
};

let syncInProgress = false;

async function withSyncLock<T>(
  fn: () => Promise<T>,
  onBusy: () => T,
): Promise<T> {
  if (syncInProgress) return onBusy();

  syncInProgress = true;
  try {
    return await fn();
  } finally {
    syncInProgress = false;
  }
}

async function findReservationByIcalUid(
  propertyId: string,
  icalUid: string,
) {
  return db.reservation.findFirst({
    where: { propertyId, icalUid },
    select: { id: true },
  });
}

export type PropertyIcalSyncResult = {
  propertyId: string;
  propertyName: string;
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
  error?: string;
};

export type AirbnbSyncSummary = {
  propertiesSynced: number;
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
  results: PropertyIcalSyncResult[];
  lastSyncedAt: string | null;
};

function parseGuestName(summary: string, blocked: boolean): string {
  if (blocked) return "Bloqueo Airbnb";
  const cleaned = summary
    .replace(/^reserved\s*[-–:]?\s*/i, "")
    .replace(/^reservado\s*[-–:]?\s*/i, "")
    .trim();
  return cleaned || "Huésped Airbnb";
}

async function fetchIcalFeed(icalUrl: string): Promise<string> {
  const url = normalizeIcalUrl(icalUrl);
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

export async function syncPropertyIcalCalendar(
  propertyId: string,
  ownerId: string,
): Promise<PropertyIcalSyncResult> {
  return withSyncLock(
    () => syncPropertyIcalCalendarInner(propertyId, ownerId),
    () => ({
      propertyId,
      propertyName: "—",
      created: 0,
      updated: 0,
      cancelled: 0,
      skipped: 0,
      error: "Sincronización en curso",
    }),
  );
}

export async function syncPropertyIcalCalendarInner(
  propertyId: string,
  ownerId: string,
): Promise<PropertyIcalSyncResult> {
  const property = await db.property.findFirst({
    where: { id: propertyId, ownerId },
    select: { id: true, name: true, icalUrl: true, currency: true },
  });

  if (!property?.icalUrl) {
    return {
      propertyId,
      propertyName: property?.name ?? "—",
      created: 0,
      updated: 0,
      cancelled: 0,
      skipped: 0,
      error: "Sin enlace iCal configurado",
    };
  }

  let created = 0;
  let updated = 0;
  let cancelled = 0;
  let skipped = 0;

  try {
    const feed = await fetchIcalFeed(property.icalUrl);
    const events = parseIcsFeed(feed);
    const seenUids = new Set<string>();

    for (const event of events) {
      seenUids.add(event.uid);
      const blocked = isAirbnbBlockedSummary(event.summary);
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
        await db.reservation.update({
          where: { id: existing.id },
          data: payload,
        });
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
          updated += 1;
        } else if (
          overlap.platform === BookingPlatform.AIRBNB &&
          overlap.icalUid
        ) {
          skipped += 1;
        } else {
          skipped += 1;
        }
        continue;
      }

      await db.reservation.create({
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
        cancelled += 1;
      }
    }

    await db.property.update({
      where: { id: property.id },
      data: { lastIcalSyncedAt: new Date() },
    });
  } catch (error) {
    return {
      propertyId: property.id,
      propertyName: property.name,
      created,
      updated,
      cancelled,
      skipped,
      error: error instanceof Error ? error.message : "Error de sincronización",
    };
  }

  return {
    propertyId: property.id,
    propertyName: property.name,
    created,
    updated,
    cancelled,
    skipped,
  };
}

export async function syncAllAirbnbCalendarsForOwner(
  ownerId: string,
): Promise<AirbnbSyncSummary> {
  return withSyncLock(
    () => syncAllAirbnbCalendarsForOwnerInner(ownerId),
    () => ({
      propertiesSynced: 0,
      created: 0,
      updated: 0,
      cancelled: 0,
      skipped: 0,
      results: [],
      lastSyncedAt: null,
    }),
  );
}

async function syncAllAirbnbCalendarsForOwnerInner(
  ownerId: string,
): Promise<AirbnbSyncSummary> {
  const properties = await db.property.findMany({
    where: {
      ownerId,
      status: PropertyStatus.ACTIVE,
      icalUrl: { not: null },
    },
    select: { id: true },
    orderBy: { name: "asc" },
  });

  const results: PropertyIcalSyncResult[] = [];
  let created = 0;
  let updated = 0;
  let cancelled = 0;
  let skipped = 0;

  const syncResults = await Promise.all(
    properties.map((property) =>
      syncPropertyIcalCalendarInner(property.id, ownerId),
    ),
  );

  for (const result of syncResults) {
    results.push(result);
    created += result.created;
    updated += result.updated;
    cancelled += result.cancelled;
    skipped += result.skipped;
  }

  const lastRow = await db.property.findFirst({
    where: { ownerId, lastIcalSyncedAt: { not: null } },
    orderBy: { lastIcalSyncedAt: "desc" },
    select: { lastIcalSyncedAt: true },
  });

  return {
    propertiesSynced: properties.length,
    created,
    updated,
    cancelled,
    skipped,
    results,
    lastSyncedAt: lastRow?.lastIcalSyncedAt?.toISOString() ?? null,
  };
}

export async function getAirbnbSyncStatusForOwner(ownerId: string) {
  const properties = await db.property.findMany({
    where: {
      ownerId,
      status: PropertyStatus.ACTIVE,
      icalUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      lastIcalSyncedAt: true,
    },
    orderBy: { name: "asc" },
  });

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
      lastSyncedAt: p.lastIcalSyncedAt?.toISOString() ?? null,
    })),
  };
}

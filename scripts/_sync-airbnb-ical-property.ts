/**
 * Force iCal sync for Comuna 13 (or propertyId arg) without Next server-only barrier.
 *   npx tsx scripts/_sync-airbnb-ical-property.ts [propertyId]
 */
import { createRequire } from "node:module";
import { config } from "dotenv";
import { BookingPlatform, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  formatDateKey,
  isAirbnbBlockedSummary,
  parseIcsFeed,
} from "../src/services/airbnb/ical-parser";
import { isPragmaExportedUid } from "../src/lib/airbnb/ical-sync-utils";
import { dateKeyToPrismaDate } from "../src/lib/dates";
import { deriveReservationStatusFromDates } from "../src/services/reservations/reservation-status";
import { normalizeIcalGuestNameFromSummary } from "../src/modules/airbnb-email/domains/safe-reservation-enrichment";
import { PILOT_PMS_ORGANIZATION_ID } from "../src/lib/platform/constants.client";

config();
config({ path: ".env.local", override: true });

// Allow importing modules that pull `server-only` transitively if needed later.
const require = createRequire(import.meta.url);
try {
  const p = require.resolve("server-only");
  require.cache[p] = {
    id: p,
    filename: p,
    loaded: true,
    exports: {},
  } as NodeModule;
} catch {
  /* optional */
}

const TARGET_UID =
  "1418fb94e984-83d174a1a9f1237ded726032b27f0d9c@airbnb.com";
const COMUNA13_PROPERTY_ID = "cmpmqaeea000004jvytqozsq1";

async function syncProperty(
  db: PrismaClient,
  property: {
    id: string;
    name: string;
    icalUrl: string | null;
    currency: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
  },
) {
  const url = property.icalUrl?.trim();
  if (!url) return { propertyId: property.id, error: "no_ical", created: 0, updated: 0, skipped: 0 };

  const fetchUrl = url.replace(/^webcal:/i, "https:");
  const res = await fetch(fetchUrl, {
    headers: { "User-Agent": "PRAGMA-Airbnb-Sync/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    return {
      propertyId: property.id,
      error: `http_${res.status}`,
      created: 0,
      updated: 0,
      skipped: 0,
    };
  }
  const feed = await res.text();
  const events = parseIcsFeed(feed);

  const existing = await db.reservation.findMany({
    where: { propertyId: property.id, icalUid: { not: null } },
    select: {
      id: true,
      icalUid: true,
      status: true,
      checkIn: true,
      checkOut: true,
      guestName: true,
    },
  });
  const byUid = new Map(existing.map((r) => [r.icalUid!, r]));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const event of events) {
    if (isPragmaExportedUid(event.uid)) {
      skipped += 1;
      continue;
    }
    const blocked = isAirbnbBlockedSummary(event.summary);
    if (blocked) {
      skipped += 1;
      continue;
    }

    const checkIn = dateKeyToPrismaDate(formatDateKey(event.dtstart));
    const checkOut = dateKeyToPrismaDate(formatDateKey(event.dtend));
    const guestName = normalizeIcalGuestNameFromSummary(event.summary, false);
    const status = deriveReservationStatusFromDates(checkIn, checkOut, {
      blocked: false,
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
    });
    const guestFirstName = guestName.split(" ")[0] ?? "Huésped";
    const guestLastName = guestName.split(" ").slice(1).join(" ") || null;

    const prev = byUid.get(event.uid);
    if (prev) {
      await db.reservation.update({
        where: { id: prev.id },
        data: {
          guestName,
          guestFirstName,
          guestLastName,
          checkIn,
          checkOut,
          status,
          platform: BookingPlatform.AIRBNB,
        },
      });
      updated += 1;
      continue;
    }

    const row = await db.reservation.create({
      data: {
        propertyId: property.id,
        guestName,
        guestFirstName,
        guestLastName,
        checkIn,
        checkOut,
        status,
        platform: BookingPlatform.AIRBNB,
        icalUid: event.uid,
        currency: property.currency || "COP",
        totalAmount: 0,
      },
    });
    byUid.set(event.uid, {
      id: row.id,
      icalUid: event.uid,
      status: row.status,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      guestName: row.guestName,
    });
    created += 1;
  }

  await db.property.update({
    where: { id: property.id },
    data: { lastIcalSyncedAt: new Date() },
  });

  return {
    propertyId: property.id,
    name: property.name,
    events: events.length,
    created,
    updated,
    skipped,
    error: null as string | null,
  };
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  const orgId =
    process.env.PILOT_PMS_ORGANIZATION_ID?.trim() || PILOT_PMS_ORGANIZATION_ID;
  const onlyId = process.argv[2]?.trim() || COMUNA13_PROPERTY_ID;

  try {
    const properties = await db.property.findMany({
      where: {
        organizationId: orgId,
        status: "ACTIVE",
        id: onlyId,
      },
      select: {
        id: true,
        name: true,
        icalUrl: true,
        currency: true,
        checkInTime: true,
        checkOutTime: true,
      },
    });

    if (!properties.length) {
      console.error("property_not_found");
      process.exit(1);
    }

    const results = [];
    for (const p of properties) {
      results.push(await syncProperty(db, p));
    }

    const imported = await db.reservation.findFirst({
      where: { icalUid: TARGET_UID },
      select: {
        id: true,
        guestName: true,
        status: true,
        checkIn: true,
        checkOut: true,
        propertyId: true,
        icalUid: true,
        platform: true,
      },
    });

    console.log(
      JSON.stringify(
        {
          syncResults: results,
          targetUid: TARGET_UID,
          importedReservation: imported
            ? {
                id: imported.id,
                guestName: imported.guestName,
                status: imported.status,
                platform: imported.platform,
                propertyId: imported.propertyId,
                icalUid: imported.icalUid,
                checkIn: imported.checkIn.toISOString().slice(0, 10),
                checkOut: imported.checkOut.toISOString().slice(0, 10),
              }
            : null,
          ok: Boolean(imported),
        },
        null,
        2,
      ),
    );

    if (!imported) process.exit(2);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Compare live Airbnb iCal feeds vs DB reservations (pilot org).
 * Read-only. Detects UIDs in feed missing from system.
 *
 *   npx tsx scripts/_audit-airbnb-ical-feed-vs-db.ts
 */
import { config } from "dotenv";
import { BookingPlatform, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PILOT_PMS_ORGANIZATION_ID } from "../src/lib/platform/constants.client";

config();
config({ path: ".env.local", override: true });

type ParsedEvent = {
  uid: string;
  summary: string | null;
  dtStart: string | null;
  dtEnd: string | null;
};

function unfoldIcal(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function parseIcalEvents(raw: string): ParsedEvent[] {
  const text = unfoldIcal(raw);
  const blocks = text.split("BEGIN:VEVENT").slice(1);
  const out: ParsedEvent[] = [];
  for (const block of blocks) {
    const body = block.split("END:VEVENT")[0] || "";
    const uid = /(?:^|\n)UID:(.+)/i.exec(body)?.[1]?.trim();
    if (!uid) continue;
    const summary = /(?:^|\n)SUMMARY:(.+)/i.exec(body)?.[1]?.trim() || null;
    const dtStart =
      /(?:^|\n)DTSTART(?:;[^:]*)?:([0-9TZX-]+)/i.exec(body)?.[1]?.trim() ||
      null;
    const dtEnd =
      /(?:^|\n)DTEND(?:;[^:]*)?:([0-9TZX-]+)/i.exec(body)?.[1]?.trim() || null;
    out.push({ uid, summary, dtStart, dtEnd });
  }
  return out;
}

function icalDateToKey(v: string | null): string | null {
  if (!v) return null;
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  const orgId =
    process.env.PILOT_PMS_ORGANIZATION_ID?.trim() || PILOT_PMS_ORGANIZATION_ID;

  try {
    const properties = await db.property.findMany({
      where: {
        organizationId: orgId,
        status: "ACTIVE",
        icalUrl: { not: null },
      },
      select: { id: true, name: true, icalUrl: true },
    });

    const dbRows = await db.reservation.findMany({
      where: {
        property: { organizationId: orgId },
        OR: [
          { platform: BookingPlatform.AIRBNB },
          { icalUid: { not: null } },
        ],
      },
      select: {
        id: true,
        icalUid: true,
        status: true,
        guestName: true,
        checkIn: true,
        checkOut: true,
        propertyId: true,
      },
    });

    const byUid = new Map(
      dbRows.filter((r) => r.icalUid).map((r) => [r.icalUid!, r]),
    );

    const todayKey = new Date().toISOString().slice(0, 10);
    const perProperty = [];

    for (const p of properties) {
      const url = p.icalUrl!.replace(/^webcal:/i, "https:");
      let fetchOk = false;
      let fetchError: string | null = null;
      let events: ParsedEvent[] = [];
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "PRAGMA-Airbnb-Audit/1.0" },
          signal: AbortSignal.timeout(25_000),
        });
        if (!res.ok) {
          fetchError = `http_${res.status}`;
        } else {
          const text = await res.text();
          events = parseIcalEvents(text);
          fetchOk = true;
        }
      } catch (e) {
        fetchError = e instanceof Error ? e.message : String(e);
      }

      const futureOrActive = events.filter((ev) => {
        const end = icalDateToKey(ev.dtEnd) || icalDateToKey(ev.dtStart);
        return !end || end >= todayKey;
      });

      const missingInDb = futureOrActive.filter((ev) => !byUid.has(ev.uid));
      const present = futureOrActive.filter((ev) => byUid.has(ev.uid));
      const presentCancelled = present.filter(
        (ev) => byUid.get(ev.uid)?.status === "CANCELLED",
      );

      perProperty.push({
        propertyId: p.id,
        name: p.name,
        fetchOk,
        fetchError,
        feedEventsTotal: events.length,
        feedFutureOrActive: futureOrActive.length,
        matchedInDb: present.length,
        missingInDbCount: missingInDb.length,
        missingInDb: missingInDb.slice(0, 20).map((ev) => ({
          uid: ev.uid,
          summary: ev.summary,
          start: icalDateToKey(ev.dtStart),
          end: icalDateToKey(ev.dtEnd),
        })),
        presentButCancelled: presentCancelled.map((ev) => ({
          uid: ev.uid,
          reservationId: byUid.get(ev.uid)?.id,
          guest: byUid.get(ev.uid)?.guestName,
          status: byUid.get(ev.uid)?.status,
        })),
      });
    }

    const totalMissing = perProperty.reduce(
      (s, p) => s + p.missingInDbCount,
      0,
    );
    const fetchFails = perProperty.filter((p) => !p.fetchOk);

    console.log(
      JSON.stringify(
        {
          organizationId: orgId,
          auditedAt: new Date().toISOString(),
          propertiesAudited: perProperty.length,
          feedFetchFailures: fetchFails.length,
          totalMissingFutureEventsInDb: totalMissing,
          perProperty,
          verdict:
            fetchFails.length > 0
              ? "INCOMPLETE: could not fetch one or more iCal feeds — cannot certify full Airbnb reflection."
              : totalMissing === 0
                ? "PASS: every future/active VEVENT UID in live Airbnb iCal feeds exists in PRAGMA DB."
                : `GAP: ${totalMissing} future/active iCal event(s) in Airbnb feeds are NOT in PRAGMA DB.`,
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Audit + repair: restore channel titular when Guest Registration overwrote it.
 *
 * Dry-run:  npx tsx scripts/_repair-gr-overwritten-titular.ts
 * Apply:    npx tsx scripts/_repair-gr-overwritten-titular.ts --apply
 *
 * Rule: only update when
 *  - guestRegistrationCompletedAt is set
 *  - trusted channel guestName exists (CONFIRMED enrichment / audit)
 *  - current reservation.guestName differs from channel name
 *  - current reservation.guestName matches a registered ReservationGuest (GR overwrite fingerprint)
 */
import { config } from "dotenv";
import { AirbnbEmailEventKind, BookingPlatform, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { isPlaceholderGuestName, splitGuestName } from "../src/modules/airbnb-email/domains/safe-reservation-enrichment";
import { isPlausibleGuestName } from "../src/modules/airbnb-email/parsing/guest-name-extract";
import {
  extractGuestNameFromAuditPayload,
  pickGuestNameFromReservationEmailEvents,
} from "../src/services/reservations/airbnb-display-guest-name.service";
import { PILOT_PMS_ORGANIZATION_ID } from "../src/lib/platform/constants.client";

config();
config({ path: ".env.local", override: true });

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function namesMatch(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const orgId =
    process.env.PILOT_PMS_ORGANIZATION_ID?.trim() || PILOT_PMS_ORGANIZATION_ID;
  const allOrgs = process.argv.includes("--all-orgs");

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const reservations = await db.reservation.findMany({
      where: {
        platform: BookingPlatform.AIRBNB,
        guestRegistrationCompletedAt: { not: null },
        status: { not: "CANCELLED" },
        ...(allOrgs ? {} : { property: { organizationId: orgId } }),
      },
      select: {
        id: true,
        guestName: true,
        guestFirstName: true,
        guestLastName: true,
        reservationCode: true,
        checkIn: true,
        checkOut: true,
        property: { select: { name: true, unitNumber: true, organizationId: true } },
        guests: { select: { fullName: true } },
        emailEvents: {
          select: {
            eventKind: true,
            confirmationCode: true,
            enrichedFields: true,
            payload: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { checkIn: "desc" },
      take: 500,
    });

    const candidates: Array<{
      reservationId: string;
      property: string;
      checkIn: string;
      currentGuestName: string;
      channelGuestName: string;
      matchedRegisteredGuest: string;
      code: string | null;
    }> = [];

    for (const row of reservations) {
      const current = row.guestName?.trim() || "";
      if (!current || isPlaceholderGuestName(current)) continue;

      const channel =
        pickGuestNameFromReservationEmailEvents({
          events: row.emailEvents,
          reservationCode: row.reservationCode,
        }) ?? null;

      let channelName = channel;
      if (!channelName) {
        const audits = await db.emailIngestionAudit.findMany({
          where: {
            reservationId: row.id,
            classification: AirbnbEmailEventKind.CONFIRMED,
          },
          select: { parsedPayload: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        });
        for (const audit of audits) {
          const fromAudit = extractGuestNameFromAuditPayload(audit.parsedPayload);
          if (fromAudit) {
            channelName = fromAudit;
            break;
          }
        }
      }

      if (
        !channelName ||
        isPlaceholderGuestName(channelName) ||
        !isPlausibleGuestName(channelName)
      ) {
        continue;
      }

      if (namesMatch(current, channelName)) continue;

      const matchedGuest = row.guests.find((g) =>
        namesMatch(g.fullName || "", current),
      );
      if (!matchedGuest) continue;

      candidates.push({
        reservationId: row.id,
        property: `${row.property.name}${row.property.unitNumber ? ` #${row.property.unitNumber}` : ""}`,
        checkIn: row.checkIn.toISOString().slice(0, 10),
        currentGuestName: current,
        channelGuestName: channelName,
        matchedRegisteredGuest: matchedGuest.fullName,
        code: row.reservationCode,
      });
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? "apply" : "dry-run",
          scope: allOrgs ? "all-orgs" : orgId,
          scanned: reservations.length,
          affected: candidates.length,
          candidates,
        },
        null,
        2,
      ),
    );

    if (!apply || candidates.length === 0) return;

    let updated = 0;
    for (const c of candidates) {
      const split = splitGuestName(c.channelGuestName);
      await db.reservation.update({
        where: { id: c.reservationId },
        data: {
          guestName: split.guestName,
          guestFirstName: split.guestFirstName,
          guestLastName: split.guestLastName,
        },
      });
      updated += 1;
      console.log(
        `restored ${c.reservationId}: "${c.currentGuestName}" → "${c.channelGuestName}"`,
      );
    }
    console.log(JSON.stringify({ updated }, null, 2));
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Simulate display resolution for Sergio reservation.
 *   npx tsx scripts/_audit-display-name-resolve.ts
 */
import { config } from "dotenv";
import { BookingPlatform } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { resolveReservationDisplayGuestName } from "../src/lib/reservations/display-guest-name";
import { getAirbnbEnrichedGuestNameByReservationIds } from "../src/services/reservations/airbnb-display-guest-name.service";

config();
config({ path: ".env.local", override: true });

async function main() {
  const rid = "cms6fztsq000004l3n664gyiw";
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const r = await db.reservation.findUnique({
      where: { id: rid },
      select: {
        guestName: true,
        platform: true,
        guestRegistrationCompletedAt: true,
      },
    });
    const owner = await db.reservationGuest.findFirst({
      where: { reservationId: rid, OR: [{ isReservationOwner: true }, { isPrimary: true }] },
      orderBy: [{ isReservationOwner: "desc" }, { isPrimary: "desc" }],
      select: { fullName: true },
    });
    const map = await getAirbnbEnrichedGuestNameByReservationIds([rid]);
    const enrichment = map.get(rid) ?? null;
    const visible = resolveReservationDisplayGuestName({
      platform: BookingPlatform.AIRBNB,
      guestName: r?.guestName,
      airbnbEnrichmentGuestName: enrichment,
      primaryGuestName: owner?.fullName ?? null,
      guestRegistrationCompletedAt: r?.guestRegistrationCompletedAt,
    });
    console.log(
      JSON.stringify(
        {
          rowGuestName: r?.guestName,
          enrichment,
          primaryGuest: owner?.fullName ?? null,
          grAt: r?.guestRegistrationCompletedAt,
          visibleGuestName: visible,
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

import { config } from "dotenv";
config();
config({ path: ".env.local", override: true });

const RESERVATION_IDS = {
  yuly: "cmqfv2qsi000004kz8fcg1xj1",
  karla: "cmpnc1v7e000004juw7z33cz8",
  jairo: "cmqfjayyy000004jlnndtd4qi",
  alexander: "cmqegpzso000004if34la52oo",
  milena: "cmpmqfh1a000104jm8upw39ka",
};

const ids = Object.values(RESERVATION_IDS);

const { getAirbnbEnrichedGuestNameByReservationIds } = await import(
  "../src/services/reservations/airbnb-display-guest-name.service.ts"
);
const { resolveReservationDisplayGuestName } = await import(
  "../src/lib/reservations/display-guest-name.ts"
);
const { PrismaPg } = await import("@prisma/adapter-pg");
const { PrismaClient } = await import("@prisma/client");
const pg = await import("pg");

const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const rows = await db.reservation.findMany({
  where: { id: { in: ids } },
  select: {
    id: true,
    guestName: true,
    platform: true,
    guestRegistrationCompletedAt: true,
    checkIn: true,
    checkOut: true,
    guests: {
      where: { OR: [{ isReservationOwner: true }, { isPrimary: true }] },
      orderBy: [{ isReservationOwner: "desc" }, { isPrimary: "desc" }],
      take: 1,
      select: { fullName: true },
    },
  },
});

const enriched = await getAirbnbEnrichedGuestNameByReservationIds(ids);

function resolveForView(row, view) {
  const primaryGuestName = row.guests[0]?.fullName ?? null;
  const airbnbEnrichmentGuestName = enriched.get(row.id) ?? null;
  const input = {
    platform: row.platform,
    airbnbEnrichmentGuestName,
    guestName: row.guestName,
    primaryGuestName,
    guestRegistrationCompletedAt: row.guestRegistrationCompletedAt,
  };
  return {
    view,
    display: resolveReservationDisplayGuestName(input),
  };
}

const byKey = Object.fromEntries(
  Object.entries(RESERVATION_IDS).map(([key, id]) => [key, id]),
);
const rowById = new Map(rows.map((r) => [r.id, r]));

const views = ["calendar", "inbox", "drawer", "dashboard", "detail"];
const report = {};

for (const [guest, id] of Object.entries(byKey)) {
  const row = rowById.get(id);
  if (!row) {
    report[guest] = { error: "reservation not found" };
    continue;
  }
  const resolved = views.map((view) => resolveForView(row, view));
  const uniqueNames = [...new Set(resolved.map((r) => r.display))];
  report[guest] = {
    reservationId: id,
    dbGuestName: row.guestName,
    guestRegistrationCompletedAt: row.guestRegistrationCompletedAt,
    airbnbEnrichment: enriched.get(id) ?? null,
    views: Object.fromEntries(resolved.map((r) => [r.view, r.display])),
    consistent: uniqueNames.length === 1,
    displayName: uniqueNames[0] ?? null,
  };
}

console.log(JSON.stringify(report, null, 2));
await db.$disconnect();
await pool.end();

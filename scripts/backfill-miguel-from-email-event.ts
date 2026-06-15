/**
 * Backfill reservation row from email event enrichedFields (Miguel Castro).
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";
import { splitGuestName } from "@/modules/airbnb-email/domains/safe-reservation-enrichment";

config();
config({ path: ".env.local", override: true });

const AUDIT_ID = "cmqem616w000004jmapjhyqt3";
const RESERVATION_ID = "cmqegpzvl000404ifzh990xtf";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const audit = await db.emailIngestionAudit.findUnique({
  where: { id: AUDIT_ID },
  select: {
    parsedPayload: true,
    reservationEvent: { select: { enrichedFields: true } },
  },
});

const signals =
  audit?.parsedPayload &&
  typeof audit.parsedPayload === "object" &&
  !Array.isArray(audit.parsedPayload)
    ? audit.parsedPayload.signals
    : null;

const enriched = audit?.reservationEvent?.enrichedFields;
const guestFromEnriched =
  enriched &&
  typeof enriched === "object" &&
  !Array.isArray(enriched) &&
  typeof enriched.guestName === "string"
    ? enriched.guestName
    : null;

const guestFromSubject =
  typeof signals?.guestName === "string"
    ? signals.guestName
    : "Miguel Castro";

const guestName = guestFromEnriched || guestFromSubject;
const split = splitGuestName(guestName);

const hostPayout =
  enriched &&
  typeof enriched === "object" &&
  !Array.isArray(enriched) &&
  typeof enriched.hostPayoutAmount === "number"
    ? enriched.hostPayoutAmount
    : signals?.hostPayoutAmount ?? signals?.netPayout ?? null;

const code =
  (enriched &&
    typeof enriched === "object" &&
    !Array.isArray(enriched) &&
    typeof enriched.reservationCode === "string" &&
    enriched.reservationCode) ||
  signals?.confirmationCode ||
  "HMQDRNFBZW";

const updated = await db.reservation.update({
  where: { id: RESERVATION_ID },
  data: {
    guestName: split.guestName,
    guestFirstName: split.guestFirstName,
    guestLastName: split.guestLastName,
    reservationCode: code,
    ...(hostPayout != null && hostPayout > 0
      ? { totalAmount: hostPayout, currency: "COP" }
      : {}),
    ...(signals?.adultCount != null ? { adults: signals.adultCount } : {}),
    ...(signals?.childCount != null ? { children: signals.childCount } : {}),
  },
  select: {
    guestName: true,
    reservationCode: true,
    totalAmount: true,
    adults: true,
    children: true,
  },
});

console.log(JSON.stringify({ updated, signalsGuest: signals?.guestName, hostPayout }, null, 2));

await db.$disconnect();
await pool.end();

import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, BookingPlatform } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG = "cmplxfg0a000105jrs0gqtwyc";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const PLACEHOLDERS = [
  "Huésped Airbnb",
  "Airbnb",
  "Reserved",
  "Reservado",
  "Airbnb Guest",
];

const enriched = await db.reservation.findMany({
  where: {
    platform: BookingPlatform.AIRBNB,
    property: { organizationId: ORG },
    NOT: { guestName: { in: PLACEHOLDERS, mode: "insensitive" } },
  },
  orderBy: { updatedAt: "desc" },
  take: 50,
  select: {
    id: true,
    guestName: true,
    reservationCode: true,
    totalAmount: true,
    checkIn: true,
    checkOut: true,
    createdAt: true,
    updatedAt: true,
    icalUid: true,
    property: { select: { name: true } },
    emailEvents: {
      select: {
        eventKind: true,
        enrichedFields: true,
        createdAt: true,
        audit: {
          select: {
            subject: true,
            fromAddress: true,
            classification: true,
            createdAt: true,
            rawEmail: true,
            matchMethod: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    },
    emailPayouts: {
      select: {
        netPayout: true,
        grossAmount: true,
        createdAt: true,
        audit: { select: { subject: true, fromAddress: true } },
      },
      take: 1,
    },
  },
});

const rows = enriched.map((r) => {
  const firstEnriching = r.emailEvents.find(
    (e) =>
      e.eventKind === "CONFIRMED" ||
      (e.enrichedFields &&
        typeof e.enrichedFields === "object" &&
        e.enrichedFields.guestName),
  );
  const audit = firstEnriching?.audit;
  const from = audit?.fromAddress ?? "";
  const subj = audit?.subject ?? "";
  const forwarded =
    /^(?:fwd?|fw|rv|reenviado|re):/i.test(subj.trim()) ||
    (!from.includes("@airbnb.com") && from.length > 0);
  const raw =
    audit?.rawEmail &&
    typeof audit.rawEmail === "object" &&
    !Array.isArray(audit.rawEmail)
      ? audit.rawEmail
      : {};
  return {
    reservationId: r.id,
    property: r.property.name,
    guestName: r.guestName,
    reservationCode: r.reservationCode,
    totalAmount: r.totalAmount?.toString(),
    checkIn: r.checkIn.toISOString().slice(0, 10),
    reservationCreated: r.createdAt.toISOString(),
    reservationUpdated: r.updatedAt.toISOString(),
    hasIcal: Boolean(r.icalUid),
    emailEventCount: r.emailEvents.length,
    enrichingEventKind: firstEnriching?.eventKind ?? null,
    auditCreated: audit?.createdAt?.toISOString() ?? null,
    auditSubject: subj.slice(0, 90),
    fromAddress: from,
    forwarded,
    resendProvider: raw.provider === "resend",
    ingestSource: raw.source ?? (raw.provider === "resend" ? "webhook" : null),
    payoutFromEmail: r.emailPayouts[0]
      ? {
          net: r.emailPayouts[0].netPayout?.toString(),
          subject: r.emailPayouts[0].audit?.subject?.slice(0, 60),
        }
      : null,
  };
});

console.log(JSON.stringify({ total: rows.length, rows }, null, 2));
await db.$disconnect();
await pool.end();

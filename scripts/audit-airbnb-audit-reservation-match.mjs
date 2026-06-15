/**
 * Busca auditorías / señales que coincidan con reservas placeholder.
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG = "cmplxfg0a000105jrs0gqtwyc";
const PLACEHOLDER_IDS = [
  "cmqegpzso000004if34la52oo",
  "cmqegpzue000204iffd78tkxk",
  "cmqegpzvl000404ifzh990xtf",
  "cmpnc1v7e000004juw7z33cz8",
  "cmpm0xawm000304jgd2k8vui7",
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const reservations = await db.reservation.findMany({
    where: { id: { in: PLACEHOLDER_IDS } },
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      propertyId: true,
      property: { select: { name: true } },
    },
  });

  const allAudits = await db.emailIngestionAudit.findMany({
    where: { organizationId: ORG },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      subject: true,
      classification: true,
      reservationId: true,
      propertyId: true,
      createdAt: true,
      parsedPayload: true,
    },
  });

  const matches = [];
  for (const r of reservations) {
    const ci = r.checkIn.toISOString().slice(0, 10);
    const co = r.checkOut.toISOString().slice(0, 10);
    for (const a of allAudits) {
      const signals =
        a.parsedPayload &&
        typeof a.parsedPayload === "object" &&
        !Array.isArray(a.parsedPayload)
          ? a.parsedPayload.signals
          : null;
      const aci =
        signals &&
        typeof signals === "object" &&
        typeof signals.checkIn === "string"
          ? signals.checkIn.slice(0, 10)
          : null;
      const aco =
        signals &&
        typeof signals === "object" &&
        typeof signals.checkOut === "string"
          ? signals.checkOut.slice(0, 10)
          : null;
      const guestName =
        signals &&
        typeof signals === "object" &&
        typeof signals.guestName === "string"
          ? signals.guestName
          : null;
      const subjectMatch =
        a.subject?.toLowerCase().includes("confirm") ||
        a.subject?.toLowerCase().includes("reserva");
      if (
        (aci === ci && aco === co) ||
        (a.propertyId === r.propertyId && aci === ci) ||
        (subjectMatch && a.propertyId === r.propertyId)
      ) {
        matches.push({
          reservationId: r.id,
          reservationDates: `${ci} → ${co}`,
          property: r.property.name,
          auditId: a.id,
          classification: a.classification,
          reservationIdLinked: a.reservationId,
          subject: a.subject?.slice(0, 80),
          signalDates: aci && aco ? `${aci} → ${aco}` : aci ?? null,
          guestNameFromSignals: guestName,
          createdAt: a.createdAt.toISOString(),
        });
      }
    }
  }

  const subjectsWithConfirm = allAudits
    .filter((a) => /confirm|confirmad|reserva confirm/i.test(a.subject ?? ""))
    .map((a) => ({
      id: a.id,
      classification: a.classification,
      subject: a.subject,
      reservationId: a.reservationId,
      createdAt: a.createdAt.toISOString(),
    }));

  console.log(
    JSON.stringify(
      {
        reservationCount: reservations.length,
        auditCount: allAudits.length,
        subjectsWithConfirm,
        datePropertyMatches: matches,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });

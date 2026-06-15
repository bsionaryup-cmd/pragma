/**
 * Audita reservas placeholder jun/jul: busca correo histórico con fechas exactas.
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG = "cmplxfg0a000105jrs0gqtwyc";
const TARGETS = [
  {
    id: "cmqegpzso000004if34la52oo",
    checkIn: "2026-06-27",
    checkOut: "2026-06-30",
  },
  {
    id: "cmqegpzue000204iffd78tkxk",
    checkIn: "2026-07-07",
    checkOut: "2026-07-14",
  },
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function readSignalDates(parsedPayload) {
  const signals =
    parsedPayload &&
    typeof parsedPayload === "object" &&
    !Array.isArray(parsedPayload)
      ? parsedPayload.signals
      : null;
  if (!signals || typeof signals !== "object") return null;
  const checkIn =
    typeof signals.checkIn === "string" ? signals.checkIn.slice(0, 10) : null;
  const checkOut =
    typeof signals.checkOut === "string" ? signals.checkOut.slice(0, 10) : null;
  if (!checkIn || !checkOut) return null;
  return { checkIn, checkOut, guestName: signals.guestName ?? null };
}

async function main() {
  const reservations = await db.reservation.findMany({
    where: { id: { in: TARGETS.map((t) => t.id) } },
    select: {
      id: true,
      guestName: true,
      reservationCode: true,
      checkIn: true,
      checkOut: true,
      totalAmount: true,
      emailEvents: { select: { id: true }, take: 1 },
    },
  });

  const audits = await db.emailIngestionAudit.findMany({
    where: { organizationId: ORG },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      subject: true,
      classification: true,
      reservationId: true,
      parsedPayload: true,
      createdAt: true,
    },
  });

  const report = [];
  for (const target of TARGETS) {
    const reservation = reservations.find((r) => r.id === target.id);
    const exactDateAudits = [];
    const subjectHints = [];

    for (const audit of audits) {
      const dates = readSignalDates(audit.parsedPayload);
      if (
        dates &&
        dates.checkIn === target.checkIn &&
        dates.checkOut === target.checkOut
      ) {
        exactDateAudits.push({
          auditId: audit.id,
          classification: audit.classification,
          reservationIdLinked: audit.reservationId,
          subject: audit.subject,
          guestName: dates.guestName,
          createdAt: audit.createdAt.toISOString(),
        });
      }

      const subject = audit.subject ?? "";
      if (
        /confirm/i.test(subject) &&
        subject.includes(target.checkIn.slice(5).replace("-0", "-")) === false
      ) {
        // subject date hints like "27 jun" or "7 jul"
      }
      const monthDay = target.checkIn.slice(5); // MM-DD
      const esMonth = monthDay.startsWith("06-27")
        ? "27 jun"
        : monthDay.startsWith("07-07")
          ? "7 jul"
          : null;
      if (esMonth && subject.toLowerCase().includes(esMonth)) {
        subjectHints.push({
          auditId: audit.id,
          subject: audit.subject,
          classification: audit.classification,
          reservationIdLinked: audit.reservationId,
          signalDates: readSignalDates(audit.parsedPayload),
          createdAt: audit.createdAt.toISOString(),
        });
      }
    }

    report.push({
      reservationId: target.id,
      expectedDates: `${target.checkIn} → ${target.checkOut}`,
      current: reservation
        ? {
            guestName: reservation.guestName,
            reservationCode: reservation.reservationCode,
            totalAmount: String(reservation.totalAmount),
            emailEventCount: reservation.emailEvents.length,
          }
        : null,
      exactDateAudits,
      subjectDateHints: subjectHints,
      recoverable: exactDateAudits.length > 0,
      cause:
        exactDateAudits.length === 0
          ? "NO_AUDIT_IN_DB — el correo de confirmación nunca ingresó a PRAGMA para estas fechas exactas"
          : "Correo histórico encontrado; pendiente vincular/enriquecer",
    });
  }

  console.log(JSON.stringify({ auditedAt: new Date().toISOString(), report }, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });

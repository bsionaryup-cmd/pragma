/**
 * Audita cancelaciones en Novedades: reservas canceladas vs eventos de email.
 *
 * Uso:
 *   npx tsx scripts/audit-novedades-cancellations.ts
 *   npx tsx scripts/audit-novedades-cancellations.ts --apply
 */
import { config } from "dotenv";
import {
  AirbnbEmailEventKind,
  PrismaClient,
  ReservationStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const PILOT_ORG_ID = "cmplxfg0a000105jrs0gqtwyc";
const apply = process.argv.includes("--apply");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const orgId = PILOT_ORG_ID;

  const canceled = await db.reservation.findMany({
    where: {
      property: { organizationId: orgId },
      status: ReservationStatus.CANCELLED,
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      guestName: true,
      reservationCode: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      checkIn: true,
      checkOut: true,
      property: { select: { name: true } },
    },
  });

  console.log(`Auditoría cancelaciones — org: ${orgId}`);
  console.log(`Canceladas recientes: ${canceled.length}\n`);

  const staleStatusIds: string[] = [];

  for (const row of canceled) {
    const emailEvents = await db.reservationEmailEvent.findMany({
      where: { reservationId: row.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, eventKind: true, createdAt: true },
    });
    const cancelEvent = emailEvents.find(
      (event) => event.eventKind === AirbnbEmailEventKind.CANCELED,
    );
    const confirmEvent = emailEvents.find(
      (event) => event.eventKind === AirbnbEmailEventKind.CONFIRMED,
    );

    console.log({
      id: row.id,
      guest: row.guestName,
      code: row.reservationCode,
      property: row.property.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      checkIn: row.checkIn.toISOString().slice(0, 10),
      checkOut: row.checkOut.toISOString().slice(0, 10),
      hasConfirmEmail: Boolean(confirmEvent),
      hasCancelEmail: Boolean(cancelEvent),
      cancelEmailAt: cancelEvent?.createdAt.toISOString() ?? null,
      emailEventKinds: emailEvents.map((event) => event.eventKind),
    });
  }

  const cancelEventsStale = await db.reservationEmailEvent.findMany({
    where: {
      eventKind: AirbnbEmailEventKind.CANCELED,
      reservation: {
        property: { organizationId: orgId },
        status: { not: ReservationStatus.CANCELLED },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      reservationId: true,
      createdAt: true,
      reservation: {
        select: {
          guestName: true,
          reservationCode: true,
          status: true,
        },
      },
    },
  });

  console.log("\n=== Email CANCELED con status distinto de CANCELLED ===");
  console.log(JSON.stringify(cancelEventsStale, null, 2));

  for (const row of cancelEventsStale) {
    if (
      row.reservationId &&
      row.reservation &&
      (row.reservation.status === ReservationStatus.CONFIRMED ||
        row.reservation.status === ReservationStatus.BLOCKED)
    ) {
      staleStatusIds.push(row.reservationId);
    }
  }

  if (apply && staleStatusIds.length > 0) {
    const uniqueIds = [...new Set(staleStatusIds)];
    await db.reservation.updateMany({
      where: { id: { in: uniqueIds } },
      data: { status: ReservationStatus.CANCELLED },
    });
    console.log(`\nBackfill aplicado: ${uniqueIds.length} reserva(s) → CANCELLED`);
  } else if (staleStatusIds.length > 0) {
    console.log(
      `\nDry-run: ejecuta con --apply para marcar ${new Set(staleStatusIds).size} reserva(s) como CANCELLED`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });

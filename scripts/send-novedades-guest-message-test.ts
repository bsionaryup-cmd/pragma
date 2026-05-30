import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { processInboundAirbnbEmail } from "@/modules/airbnb-email";
import { buildEmailBody, extractReservationSignals } from "@/modules/airbnb-email/parsing/extractors";
import { recordReservationActivityFromInboundEmail } from "@/modules/reservation-activity";
import { recordModificationObservabilityFromInboundEmail } from "@/modules/reservation-events";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const integration = await db.tenantAirbnbEmailIntegration.findFirst({
    where: { enabled: true },
    select: { organizationId: true, inboundEmailAddress: true },
  });

  if (!integration) {
    throw new Error("No hay integración Airbnb email activa.");
  }

  const reservation = await db.reservation.findFirst({
    where: {
      property: { organizationId: integration.organizationId },
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
    },
    select: {
      id: true,
      guestName: true,
      propertyId: true,
      property: { select: { name: true, unitNumber: true } },
    },
    orderBy: { checkIn: "desc" },
  });

  const guestName = reservation?.guestName?.trim() || "María López";
  const listingLabel = reservation?.property?.unitNumber
    ? `Apartamento ${reservation.property.unitNumber}`
    : reservation?.property?.name ?? "Loft Laureles";

  const subject = `${guestName} te envió un mensaje sobre su reserva`;
  const text = [
    "Hola Samuel,",
    "",
    `"¿Podemos hacer check-in a las 11:00? Llegamos en vuelo temprano. Gracias."`,
    "",
    `Reserva · ${listingLabel}`,
    "",
    "Responder en Airbnb",
  ].join("\n");

  const messageId = `novedades-test-${Date.now()}@pragma.local`;

  console.log("Procesando correo de prueba…");
  console.log({ organizationId: integration.organizationId, subject });

  const outcome = await processInboundAirbnbEmail(
    {
      messageId,
      from: `${guestName} via Airbnb <express@airbnb.com>`,
      to: integration.inboundEmailAddress,
      subject,
      text,
      receivedAt: new Date().toISOString(),
      raw: { provider: "test-script" },
    },
    {
      organizationId: integration.organizationId,
      propertyId: reservation?.propertyId ?? null,
    },
  );

  console.log("pipeline outcome:", outcome);

  if (!outcome.auditId) {
    throw new Error("El pipeline no devolvió auditId.");
  }

  const bodyPreview = buildEmailBody({ subject, text });
  const signals = extractReservationSignals({ subject, body: bodyPreview });

  const activity = await recordReservationActivityFromInboundEmail({
    organizationId: integration.organizationId,
    auditId: outcome.auditId,
    reservationId: outcome.reservationId ?? reservation?.id ?? null,
    propertyId: reservation?.propertyId ?? null,
    subject,
    text,
    from: `${guestName} via Airbnb <express@airbnb.com>`,
    signals,
    pipelineEventKind: outcome.eventKind ?? null,
    receivedAt: new Date().toISOString(),
  });

  const novedad = await recordModificationObservabilityFromInboundEmail({
    organizationId: integration.organizationId,
    auditId: outcome.auditId,
    reservationId: outcome.reservationId ?? reservation?.id ?? null,
    propertyId: reservation?.propertyId ?? null,
    subject,
    text,
    signals,
  });

  console.log("activity:", activity);
  console.log("modification observability:", novedad);

  const activityRows = await db.reservationActivity.findMany({
    where: { activityType: "AIRBNB_MESSAGE" },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { title: true, content: true, senderName: true, createdAt: true },
  });

  console.log("\nÚltimos mensajes en reservation_activity:");
  for (const row of activityRows) {
    console.log(
      `- ${row.senderName ?? "—"} · ${row.content.slice(0, 80)} (${row.createdAt.toISOString()})`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });

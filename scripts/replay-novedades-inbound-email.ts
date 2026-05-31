/**
 * Reprocesa un correo Airbnb ya auditado para poblar Novedades (prueba local).
 *
 * Uso:
 *   npx tsx scripts/replay-novedades-inbound-email.ts --auditId=<cuid>
 *   npx tsx scripts/replay-novedades-inbound-email.ts --latest
 *
 * Genera un messageId nuevo para evitar el guard de duplicados y vuelve a ejecutar
 * el pipeline + actividad + observabilidad de modificaciones.
 */
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

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : null;
}

function readRawEmailFields(rawEmail: unknown): {
  from: string;
  to: string | null;
  subject: string;
  html?: string | null;
  text?: string | null;
} {
  if (!rawEmail || typeof rawEmail !== "object" || Array.isArray(rawEmail)) {
    throw new Error("rawEmail inválido en la auditoría.");
  }
  const record = rawEmail as Record<string, unknown>;
  const from = typeof record.from === "string" ? record.from : "";
  const subject = typeof record.subject === "string" ? record.subject : "";
  if (!from || !subject) {
    throw new Error("La auditoría no tiene from/subject reutilizables.");
  }
  return {
    from,
    to: typeof record.to === "string" ? record.to : null,
    subject,
    html: typeof record.html === "string" ? record.html : null,
    text: typeof record.text === "string" ? record.text : null,
  };
}

async function main() {
  const auditId = readArg("auditId");
  const useLatest = process.argv.includes("--latest");

  const audit = auditId
    ? await db.emailIngestionAudit.findUnique({
        where: { id: auditId },
        select: {
          id: true,
          organizationId: true,
          propertyId: true,
          reservationId: true,
          subject: true,
          fromAddress: true,
          toAddress: true,
          rawEmail: true,
        },
      })
    : useLatest
      ? await db.emailIngestionAudit.findFirst({
          where: { organizationId: { not: null } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            organizationId: true,
            propertyId: true,
            reservationId: true,
            subject: true,
            fromAddress: true,
            toAddress: true,
            rawEmail: true,
          },
        })
      : null;

  if (!audit?.organizationId) {
    throw new Error("Indica --auditId=<id> o --latest con una auditoría existente.");
  }

  const raw = readRawEmailFields(audit.rawEmail);
  const messageId = `novedades-replay-${audit.id}-${Date.now()}@pragma.local`;

  console.log("Reprocesando correo para Novedades…");
  console.log({
    sourceAuditId: audit.id,
    organizationId: audit.organizationId,
    subject: raw.subject,
    messageId,
  });

  const outcome = await processInboundAirbnbEmail(
    {
      messageId,
      from: raw.from || audit.fromAddress,
      to: raw.to ?? audit.toAddress,
      subject: raw.subject || audit.subject,
      html: raw.html,
      text: raw.text,
      receivedAt: new Date().toISOString(),
      raw: { provider: "novedades-replay", sourceAuditId: audit.id },
    },
    {
      organizationId: audit.organizationId,
      propertyId: audit.propertyId ?? null,
    },
  );

  console.log("pipeline outcome:", outcome);

  if (!outcome.auditId) {
    throw new Error("El pipeline no devolvió auditId.");
  }

  const bodyPreview = buildEmailBody({
    subject: raw.subject || audit.subject,
    html: raw.html,
    text: raw.text,
  });
  const signals = extractReservationSignals({
    subject: raw.subject || audit.subject,
    body: bodyPreview,
    html: raw.html,
  });

  const activity = await recordReservationActivityFromInboundEmail({
    organizationId: audit.organizationId,
    auditId: outcome.auditId,
    reservationId: outcome.reservationId ?? audit.reservationId ?? null,
    propertyId: audit.propertyId ?? null,
    subject: raw.subject || audit.subject,
    html: raw.html,
    text: raw.text,
    from: raw.from || audit.fromAddress,
    signals,
    pipelineEventKind: outcome.eventKind ?? null,
    receivedAt: new Date().toISOString(),
  });

  const observability = await recordModificationObservabilityFromInboundEmail({
    organizationId: audit.organizationId,
    auditId: outcome.auditId,
    reservationId: outcome.reservationId ?? audit.reservationId ?? null,
    propertyId: audit.propertyId ?? null,
    subject: raw.subject || audit.subject,
    html: raw.html,
    text: raw.text,
    signals,
  });

  console.log("activity:", activity);
  console.log("modification observability:", observability);
  console.log("\nListo. Revisa /novedades en la app.");
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

/**
 * Audita y prepara Novedades para piloto: mensajes huésped desde 2026-06-01.
 *
 * Uso:
 *   npx tsx scripts/audit-novedades-messages.ts
 *   npx tsx scripts/audit-novedades-messages.ts --orgId=<cuid>
 */
import { config } from "dotenv";
import { PrismaClient, ReservationActivityType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { buildEmailBody, extractReservationSignals } from "@/modules/airbnb-email/parsing/extractors";
import { buildActivityContent } from "@/modules/reservation-activity/parsing/activity-content-build";
import {
  resolveGuestMessageBodiesForDisplay,
} from "@/services/novedades/operational-feed.message";
import { isGuestMessageNoise } from "@/services/novedades/operational-feed.policy";

config();
config({ path: ".env.local", override: true });

const PILOT_ORG_ID = "cmplxfg0a000105jrs0gqtwyc";
const PILOT_OWNER_EMAIL = "urbanovaloft@gmail.com";
const CUTOFF = new Date("2026-06-01T00:00:00.000Z");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : null;
}

function readRawEmailFields(rawEmail: unknown): {
  html?: string | null;
  text?: string | null;
  subject: string;
  from: string;
} {
  if (!rawEmail || typeof rawEmail !== "object" || Array.isArray(rawEmail)) {
    return { subject: "", from: "" };
  }
  const record = rawEmail as Record<string, unknown>;
  return {
    from: typeof record.from === "string" ? record.from : "",
    subject: typeof record.subject === "string" ? record.subject : "",
    html: typeof record.html === "string" ? record.html : null,
    text: typeof record.text === "string" ? record.text : null,
  };
}

function readMetadataRaw(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as { rawMessageBody?: unknown }).rawMessageBody;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

async function resolveOrgId(): Promise<string> {
  const explicit = readArg("orgId");
  if (explicit) return explicit;

  const pilotUser = await db.user.findFirst({
    where: { email: { equals: PILOT_OWNER_EMAIL, mode: "insensitive" } },
    select: { organizationId: true },
  });
  if (pilotUser?.organizationId) return pilotUser.organizationId;

  return PILOT_ORG_ID;
}

async function main() {
  const orgId = await resolveOrgId();
  console.log("Auditoría Novedades — org:", orgId);
  console.log("Corte:", CUTOFF.toISOString());

  const reservationIds = (
    await db.reservation.findMany({
      where: { property: { organizationId: orgId } },
      select: { id: true, guestName: true },
    })
  ).map((row) => row.id);

  const guestNameByReservation = new Map(
    (
      await db.reservation.findMany({
        where: { id: { in: reservationIds } },
        select: { id: true, guestName: true },
      })
    ).map((row) => [row.id, row.guestName]),
  );

  const activities = await db.reservationActivity.findMany({
    where: {
      reservationId: { in: reservationIds },
      activityType: ReservationActivityType.AIRBNB_MESSAGE,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      reservationId: true,
      content: true,
      senderName: true,
      metadataJson: true,
      sourceEmailId: true,
      createdAt: true,
    },
  });

  const auditsById = new Map(
    (
      await db.emailIngestionAudit.findMany({
        where: { organizationId: orgId },
        select: { id: true, subject: true, rawEmail: true, createdAt: true, reservationId: true },
      })
    ).map((row) => [row.id, row]),
  );

  const pending = await db.reservationActivityPending.count({
    where: { organizationId: orgId },
  });

  const messageAudits = [...auditsById.values()].filter((audit) =>
    /mensaje|message|pregunta|question|inquiry/i.test(audit.subject),
  );

  let beforeCutoff = 0;
  let afterCutoff = 0;
  let parseableAfter = 0;
  let emptyAfter = 0;
  let recoverableAfter = 0;
  let spamAfter = 0;
  const samples: Record<string, unknown[]> = {
    keep: [],
    deleteBeforeCutoff: [],
    deleteSpam: [],
    backfill: [],
    emptyUnrecoverable: [],
  };

  for (const activity of activities) {
    const guestName =
      guestNameByReservation.get(activity.reservationId) ?? activity.senderName;
    const metadataRaw = readMetadataRaw(activity.metadataJson);
    const audit = activity.sourceEmailId ? auditsById.get(activity.sourceEmailId) : null;
    let auditBody = "";
    if (audit) {
      const raw = readRawEmailFields(audit.rawEmail);
      auditBody = buildEmailBody({
        subject: audit.subject,
        html: raw.html,
        text: raw.text,
      });
    }

    const source = metadataRaw || auditBody || activity.content;
    const bodies = resolveGuestMessageBodiesForDisplay(source, { guestName });
    const isBefore = activity.createdAt < CUTOFF;
    const noise = isGuestMessageNoise({ content: source, guestName, senderName: activity.senderName });

    if (isBefore) {
      beforeCutoff += 1;
      if (samples.deleteBeforeCutoff.length < 5) {
        samples.deleteBeforeCutoff.push({
          id: activity.id,
          createdAt: activity.createdAt,
          content: activity.content.slice(0, 120),
        });
      }
      continue;
    }

    afterCutoff += 1;
    if (bodies.length > 0) {
      parseableAfter += 1;
      if (samples.keep.length < 5) {
        samples.keep.push({
          id: activity.id,
          createdAt: activity.createdAt,
          preview: bodies[bodies.length - 1],
        });
      }
      continue;
    }

    if (auditBody && !noise) {
      recoverableAfter += 1;
      if (samples.backfill.length < 5) {
        samples.backfill.push({
          id: activity.id,
          auditSubject: audit?.subject,
          contentLen: activity.content.length,
        });
      }
      continue;
    }

    if (activity.content.trim().length === 0 && !auditBody) {
      emptyAfter += 1;
      if (samples.emptyUnrecoverable.length < 5) {
        samples.emptyUnrecoverable.push({ id: activity.id, sourceEmailId: activity.sourceEmailId });
      }
      continue;
    }

    spamAfter += 1;
    if (samples.deleteSpam.length < 5) {
      samples.deleteSpam.push({
        id: activity.id,
        createdAt: activity.createdAt,
        content: activity.content.slice(0, 120),
        noise,
      });
    }
  }

  console.log("\n=== Resumen reservation_activity (AIRBNB_MESSAGE) ===");
  console.log({
    total: activities.length,
    beforeCutoff,
    afterCutoff,
    parseableAfter,
    recoverableAfter,
    emptyUnrecoverable: emptyAfter,
    spamAfter,
    pendingActivities: pending,
    messageAuditsTotal: messageAudits.length,
    messageAuditsAfterCutoff: messageAudits.filter((a) => a.createdAt >= CUTOFF).length,
  });
  console.log("\n=== Muestras ===");
  console.log(JSON.stringify(samples, null, 2));
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

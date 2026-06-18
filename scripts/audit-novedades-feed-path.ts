/**
 * Auditoría pre-deploy (sin imports server-only).
 */
import { config } from "dotenv";
import { PrismaClient, ReservationActivityType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { buildEmailBody } from "@/modules/airbnb-email/parsing/extractors";
import { isLikelyGuestMessageEmail } from "@/modules/reservation-activity/classifiers/activity-email-classifier";
import { resolveGuestMessageBodiesForDisplay } from "@/services/novedades/operational-feed.message";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const orgId = "cmplxfg0a000105jrs0gqtwyc";
const karlaReservationId = "cmpnc1v7e000004juw7z33cz8";

function readMetadataRaw(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as { rawMessageBody?: unknown }).rawMessageBody;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

async function repairMisclassified(org: string) {
  const candidates = await db.reservationActivity.findMany({
    where: {
      activityType: ReservationActivityType.UNMATCHED_AIRBNB,
      sourceEmailId: { not: null },
      reservation: { property: { organizationId: org } },
    },
    select: { id: true, sourceEmailId: true },
    take: 100,
    orderBy: { createdAt: "desc" },
  });

  let repaired = 0;
  for (const row of candidates) {
    const audit = await db.emailIngestionAudit.findUnique({
      where: { id: row.sourceEmailId! },
      select: { subject: true, rawEmail: true },
    });
    if (!audit) continue;
    const raw = audit.rawEmail as Record<string, unknown> | null;
    const body = buildEmailBody({
      subject: audit.subject,
      html: typeof raw?.html === "string" ? raw.html : null,
      text: typeof raw?.text === "string" ? raw.text : null,
    });
    if (!isLikelyGuestMessageEmail({ subject: audit.subject, body })) continue;
    await db.reservationActivity.update({
      where: { id: row.id },
      data: { activityType: ReservationActivityType.AIRBNB_MESSAGE },
    });
    repaired += 1;
  }
  return repaired;
}

async function promotePending(org: string) {
  const pending = await db.reservationActivityPending.findMany({
    where: { organizationId: org, activityType: ReservationActivityType.AIRBNB_MESSAGE },
    select: {
      id: true,
      sourceEmailId: true,
      propertyId: true,
      activityType: true,
      title: true,
      content: true,
      senderName: true,
      senderEmail: true,
      metadataJson: true,
      createdAt: true,
    },
  });

  let promoted = 0;
  for (const p of pending) {
    const audit = await db.emailIngestionAudit.findUnique({
      where: { id: p.sourceEmailId },
      select: { reservationId: true },
    });
    if (!audit?.reservationId) continue;

    const existing = await db.reservationActivity.findUnique({
      where: { sourceEmailId: p.sourceEmailId },
    });
    if (existing) {
      await db.reservationActivityPending.delete({ where: { id: p.id } });
      continue;
    }

    await db.reservationActivity.create({
      data: {
        reservationId: audit.reservationId,
        propertyId: p.propertyId,
        activityType: p.activityType,
        title: p.title,
        content: p.content,
        sourceEmailId: p.sourceEmailId,
        senderName: p.senderName,
        senderEmail: p.senderEmail,
        metadataJson: p.metadataJson ?? undefined,
        createdAt: p.createdAt,
      },
    });
    await db.reservationActivityPending.delete({ where: { id: p.id } });
    promoted += 1;
  }
  return promoted;
}

async function auditReservation(reservationId: string, guestName: string) {
  console.log(`\n=== ${guestName} (${reservationId}) ===`);
  const activities = await db.reservationActivity.findMany({
    where: { reservationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      activityType: true,
      content: true,
      senderName: true,
      metadataJson: true,
      createdAt: true,
    },
  });

  for (const a of activities) {
    if (
      a.activityType !== ReservationActivityType.AIRBNB_MESSAGE &&
      a.activityType !== ReservationActivityType.UNMATCHED_AIRBNB
    ) {
      continue;
    }
    const source = readMetadataRaw(a.metadataJson) ?? a.content;
    const bodies = resolveGuestMessageBodiesForDisplay(source, {
      guestName: a.senderName ?? guestName,
    });
    console.log({
      at: a.createdAt.toISOString(),
      type: a.activityType,
      parseable: bodies.length,
      preview: bodies[bodies.length - 1]?.slice(0, 100) ?? "(FILTERED OUT)",
      contentLen: source.length,
    });
  }
}

async function main() {
  console.log("Repair misclassified...");
  console.log("repaired:", await repairMisclassified(orgId));
  console.log("promoted pending:", await promotePending(orgId));

  await auditReservation(karlaReservationId, "Karla");

  const recentAudits = await db.emailIngestionAudit.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: new Date("2026-06-17T00:00:00Z") },
      OR: [
        { subject: { contains: "Reserva de", mode: "insensitive" } },
        { subject: { contains: "mensaje", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, subject: true, reservationId: true, createdAt: true },
  });

  console.log("\n=== Recent message audits ===");
  for (const audit of recentAudits) {
    const act = await db.reservationActivity.findFirst({
      where: { sourceEmailId: audit.id },
      select: { activityType: true, id: true },
    });
    console.log({
      at: audit.createdAt.toISOString().slice(0, 16),
      subject: audit.subject.slice(0, 65),
      res: audit.reservationId?.slice(-6),
      activity: act?.activityType ?? "MISSING",
    });
  }
}

main()
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });

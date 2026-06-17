/**
 * Prepara Novedades para piloto: limpia basura, conserva mensajes reales desde 2026-06-01.
 *
 * Uso:
 *   npx tsx scripts/prepare-novedades-pilot.ts
 *   npx tsx scripts/prepare-novedades-pilot.ts --apply
 */
import { config } from "dotenv";
import { PrismaClient, ReservationActivityType, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { promotePendingActivitiesForReservation } from "@/modules/reservation-activity/services/promote-pending-activities";
import {
  resolveGuestMessageBodiesForDisplay,
  resolveGuestMessageParseName,
} from "@/services/novedades/operational-feed.message";

config();
config({ path: ".env.local", override: true });

const PILOT_ORG_ID = "cmplxfg0a000105jrs0gqtwyc";
const PILOT_OWNER_EMAIL = "urbanovaloft@gmail.com";
const CUTOFF = new Date("2026-06-01T00:00:00.000Z");
const apply = process.argv.includes("--apply");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : null;
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
  return pilotUser?.organizationId ?? PILOT_ORG_ID;
}

type ActivityRow = {
  id: string;
  reservationId: string;
  content: string;
  senderName: string | null;
  metadataJson: unknown;
  createdAt: Date;
};

function scoreActivity(content: string, bodies: string[]): number {
  let score = bodies.length * 10;
  if (/persona que reserva/i.test(content)) score += 100;
  score += bodies.filter((body) => body.length >= 24).length * 5;
  return score;
}

function evaluateActivity(
  activity: ActivityRow,
  reservationGuestName: string | null,
): {
  action: "delete" | "keep" | "update";
  bodies: string[];
  reason: string;
} {
  if (activity.createdAt < CUTOFF) {
    return { action: "delete", bodies: [], reason: "before_cutoff" };
  }

  const source = readMetadataRaw(activity.metadataJson) || activity.content;
  const parseGuestName = resolveGuestMessageParseName({
    raw: source,
    guestName: reservationGuestName,
    senderName: activity.senderName,
  });
  const bodies = resolveGuestMessageBodiesForDisplay(source, { guestName: parseGuestName });

  if (bodies.length === 0) {
    return { action: "delete", bodies, reason: "no_guest_text" };
  }

  return { action: "update", bodies, reason: "valid_guest_messages" };
}

async function main() {
  const orgId = await resolveOrgId();
  console.log(`${apply ? "APLICANDO" : "DRY-RUN"} — Novedades piloto`);
  console.log({ orgId, cutoff: CUTOFF.toISOString() });

  const reservations = await db.reservation.findMany({
    where: { property: { organizationId: orgId } },
    select: { id: true, guestName: true },
  });
  const guestByReservation = new Map(reservations.map((row) => [row.id, row.guestName]));

  let promoted = 0;
  for (const reservation of reservations) {
    if (apply) {
      promoted += await promotePendingActivitiesForReservation(reservation.id);
    }
  }

  const activities = await db.reservationActivity.findMany({
    where: {
      reservationId: { in: reservations.map((row) => row.id) },
      activityType: ReservationActivityType.AIRBNB_MESSAGE,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      reservationId: true,
      content: true,
      senderName: true,
      metadataJson: true,
      createdAt: true,
    },
  });

  const toDelete: string[] = [];
  const toUpdate: Array<{ id: string; metadata: Record<string, unknown>; preview: string }> = [];
  const keepPreview: Array<{
    id: string;
    reservationId: string;
    bodies: string[];
    createdAt: Date;
  }> = [];

  for (const activity of activities) {
    const result = evaluateActivity(
      activity,
      guestByReservation.get(activity.reservationId) ?? null,
    );
    if (result.action === "delete") {
      toDelete.push(activity.id);
      continue;
    }
    keepPreview.push({
      id: activity.id,
      reservationId: activity.reservationId,
      bodies: result.bodies,
      createdAt: activity.createdAt,
    });
    const metadata =
      activity.metadataJson && typeof activity.metadataJson === "object" && !Array.isArray(activity.metadataJson)
        ? { ...(activity.metadataJson as Record<string, unknown>) }
        : {};
    metadata.rawMessageBody = readMetadataRaw(activity.metadataJson) || activity.content;
    toUpdate.push({
      id: activity.id,
      metadata,
      preview: result.bodies[result.bodies.length - 1] ?? "",
    });
  }

  const bestByReservation = new Map<
    string,
    { id: string; bodies: string[]; createdAt: Date; score: number }
  >();
  for (const item of keepPreview) {
    const activity = activities.find((row) => row.id === item.id);
    const score = scoreActivity(activity?.content ?? "", item.bodies);
    const current = bestByReservation.get(item.reservationId);
    if (!current) {
      bestByReservation.set(item.reservationId, { ...item, score });
      continue;
    }
    const keepCurrent =
      current.score > score ||
      (current.score === score && current.createdAt >= item.createdAt);
    if (keepCurrent) {
      toDelete.push(item.id);
    } else {
      toDelete.push(current.id);
      bestByReservation.set(item.reservationId, { ...item, score });
    }
  }

  const pendingRows = await db.reservationActivityPending.findMany({
    where: { organizationId: orgId, activityType: ReservationActivityType.AIRBNB_MESSAGE },
    select: { id: true, content: true, rawSubject: true, senderName: true, createdAt: true },
  });
  const pendingDelete: string[] = [];
  for (const pending of pendingRows) {
    if (pending.createdAt < CUTOFF) {
      pendingDelete.push(pending.id);
      continue;
    }
    const bodies = resolveGuestMessageBodiesForDisplay(pending.content, {
      guestName: resolveGuestMessageParseName({
        raw: pending.content,
        senderName: pending.senderName,
      }),
    });
    if (bodies.length === 0) pendingDelete.push(pending.id);
  }

  console.log("\n=== Plan ===");
  console.log({
    activitiesTotal: activities.length,
    activitiesDelete: toDelete.length,
    activitiesKeep: keepPreview.filter((row) => !toDelete.includes(row.id)).length,
    activitiesUpdate: toUpdate.filter((row) => !toDelete.includes(row.id)).length,
    pendingDelete: pendingDelete.length,
    promoted,
  });

  console.log("\n=== Mensajes que quedarán (muestra) ===");
  for (const item of keepPreview.filter((row) => !toDelete.includes(row.id)).slice(-12)) {
    console.log({
      reservationId: item.reservationId.slice(0, 10),
      messages: item.bodies,
    });
  }

  if (!apply) {
    console.log("\nDry-run completo. Ejecuta con --apply para aplicar cambios.");
    return;
  }

  if (toDelete.length > 0) {
    await db.reservationActivity.deleteMany({ where: { id: { in: toDelete } } });
  }

  for (const row of toUpdate) {
    if (toDelete.includes(row.id)) continue;
    await db.reservationActivity.update({
      where: { id: row.id },
      data: { metadataJson: row.metadata as Prisma.InputJsonValue },
    });
  }

  if (pendingDelete.length > 0) {
    await db.reservationActivityPending.deleteMany({ where: { id: { in: pendingDelete } } });
  }

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

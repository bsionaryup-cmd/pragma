import { NextResponse } from "next/server";
import {
  activeIcalUrlOnPropertyFilter,
  hasActiveAirbnbIcalImport,
} from "@/lib/airbnb/ical-sync-utils";
import { icalSyncLog } from "@/lib/airbnb/ical-sync-logger";
import { db } from "@/lib/db";
import { syncAllAirbnbCalendarsForOwner } from "@/services/airbnb/airbnb-ical-sync.service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

/**
 * Sincronización programada Airbnb → PRAGMA para todos los owners con iCal.
 * Configurar en Vercel Cron con header Authorization: Bearer CRON_SECRET
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    icalSyncLog.warn("cron_unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  icalSyncLog.info("cron_sync_start");

  const ownerRows = await db.property.findMany({
    where: activeIcalUrlOnPropertyFilter(),
    select: { ownerId: true, icalUrl: true },
  });
  const owners = [
    ...new Set(
      ownerRows
        .filter((row) => hasActiveAirbnbIcalImport(row.icalUrl))
        .map((row) => row.ownerId),
    ),
  ].map((ownerId) => ({ ownerId }));

  const summaries: Array<{
    ownerId: string;
    propertiesSynced: number;
    created: number;
    updated: number;
    cancelled: number;
    skipped: number;
    errors: number;
  }> = [];

  for (const { ownerId } of owners) {
    icalSyncLog.info("cron_owner_sync_start", { ownerId });
    try {
      const summary = await syncAllAirbnbCalendarsForOwner(ownerId);
      const errors = summary.results.filter((r) => r.error).length;
      summaries.push({
        ownerId,
        propertiesSynced: summary.propertiesSynced,
        created: summary.created,
        updated: summary.updated,
        cancelled: summary.cancelled,
        skipped: summary.skipped,
        errors,
      });
      icalSyncLog.info("cron_owner_sync_done", {
        ownerId,
        propertiesSynced: summary.propertiesSynced,
        created: summary.created,
        updated: summary.updated,
        cancelled: summary.cancelled,
        skipped: summary.skipped,
        errors,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error de sincronización";
      icalSyncLog.error("cron_owner_sync_failed", { ownerId, message });
      summaries.push({
        ownerId,
        propertiesSynced: 0,
        created: 0,
        updated: 0,
        cancelled: 0,
        skipped: 0,
        errors: 1,
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  icalSyncLog.info("cron_sync_complete", {
    owners: owners.length,
    durationMs,
  });

  return NextResponse.json({
    ok: true,
    ownersProcessed: owners.length,
    durationMs,
    summaries,
  });
}

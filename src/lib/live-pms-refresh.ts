import { revalidatePath } from "next/cache";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { icalSyncLog } from "@/lib/airbnb/ical-sync-logger";

type RefreshSource = "ical_sync" | "email_enrichment" | "reservation_linkage";

export function invalidateReservationCaches(source: RefreshSource): void {
  try {
    revalidatePath("/reservations");
    revalidatePath("/inbox");
    icalSyncLog.info("reservation_ui_refresh_triggered", { source });
  } catch (error) {
    icalSyncLog.warn("reservation_ui_refresh_skipped", {
      source,
      reason: "revalidate_unavailable",
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export function invalidateDashboardCaches(source: RefreshSource): void {
  try {
    revalidatePath("/");
    revalidatePath("/panel");
    icalSyncLog.info("dashboard_cache_invalidated", { source });
  } catch (error) {
    icalSyncLog.warn("dashboard_cache_invalidation_skipped", {
      source,
      reason: "revalidate_unavailable",
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export function invalidateCalendarCaches(source: RefreshSource): void {
  try {
    revalidatePath("/calendar");
    icalSyncLog.info("calendar_cache_invalidated", { source });
  } catch (error) {
    icalSyncLog.warn("calendar_cache_invalidation_skipped", {
      source,
      reason: "revalidate_unavailable",
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export function invalidateLivePmsCaches(source: RefreshSource): void {
  invalidateReservationCaches(source);
  invalidateDashboardCaches(source);
  invalidateCalendarCaches(source);
  if (source !== "ical_sync") {
    airbnbEmailLog.info("reservation_ui_refresh_triggered", { source });
  }
}

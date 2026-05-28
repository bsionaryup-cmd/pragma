import { revalidatePath } from "next/cache";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { icalSyncLog } from "@/lib/airbnb/ical-sync-logger";

type RefreshSource = "ical_sync" | "email_enrichment" | "reservation_linkage";

export function invalidateReservationCaches(source: RefreshSource): void {
  revalidatePath("/reservations");
  revalidatePath("/inbox");
  icalSyncLog.info("reservation_ui_refresh_triggered", { source });
}

export function invalidateDashboardCaches(source: RefreshSource): void {
  revalidatePath("/");
  revalidatePath("/panel");
  icalSyncLog.info("dashboard_cache_invalidated", { source });
}

export function invalidateCalendarCaches(source: RefreshSource): void {
  revalidatePath("/calendar");
  icalSyncLog.info("calendar_cache_invalidated", { source });
}

export function invalidateLivePmsCaches(source: RefreshSource): void {
  invalidateReservationCaches(source);
  invalidateDashboardCaches(source);
  invalidateCalendarCaches(source);
  if (source !== "ical_sync") {
    airbnbEmailLog.info("reservation_ui_refresh_triggered", { source });
  }
}

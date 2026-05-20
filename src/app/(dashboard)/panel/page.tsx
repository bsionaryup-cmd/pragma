import { PanelControlView } from "@/components/dashboard/panel-control-view";
import { hasPermission, requireDbUser } from "@/lib/auth";
import type { AppUserRole } from "@/types/auth";
import {
  getCurrentStays,
  getDashboardStats,
  getPanelCounts,
  getUpcomingArrivals,
  getUpcomingDepartures,
  toPanelReservationRow,
} from "@/services/dashboard/dashboard.service";

export default async function PanelControlPage() {
  const user = await requireDbUser();
  const canCreateProperties = hasPermission(
    user.role as AppUserRole,
    "properties:write",
  );

  const [stats, counts, arrivals, departures, currentStays] = await Promise.all([
    getDashboardStats(),
    getPanelCounts(),
    getUpcomingArrivals(),
    getUpcomingDepartures(),
    getCurrentStays(),
  ]);

  return (
    <PanelControlView
      firstName={user.firstName}
      stats={stats}
      counts={counts}
      arrivals={arrivals.map(toPanelReservationRow)}
      departures={departures.map(toPanelReservationRow)}
      currentStays={currentStays.map(toPanelReservationRow)}
      showEmptyBanner={stats.totalProperties === 0}
      canCreateProperties={canCreateProperties}
    />
  );
}

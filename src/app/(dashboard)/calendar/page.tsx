import { Topbar } from "@/components/layout/topbar";
import { MultiCalendar } from "@/features/calendar/components/multi-calendar";
import { resolveCalendarAnchor } from "@/features/calendar/lib/calendar-dates";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getCalendarData } from "@/services/calendar/calendar.service";
import { listPropertiesForInbox } from "@/services/properties/property.service";
import type { AppUserRole } from "@/types/auth";

type CalendarPageProps = {
  searchParams: Promise<{ anchor?: string }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const auth = await requirePermission("calendar:read");
  const params = await searchParams;
  const anchor = resolveCalendarAnchor(params.anchor);
  const canWrite = hasPermission(auth.role as AppUserRole, "reservations:write");
  const canSyncAirbnb = hasPermission(
    auth.role as AppUserRole,
    "properties:write",
  );

  const [data, propertyOptions] = await Promise.all([
    getCalendarData(anchor),
    listPropertiesForInbox(),
  ]);

  return (
    <>
      <Topbar title="Calendario" />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <MultiCalendar
          data={data}
          canWrite={canWrite}
          canSyncAirbnb={canSyncAirbnb}
          propertyOptions={propertyOptions}
        />
      </div>
    </>
  );
}

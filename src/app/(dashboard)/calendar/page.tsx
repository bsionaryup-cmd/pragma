import { ModuleShellFill } from "@/components/layout/module-shell";
import { MultiCalendar } from "@/features/calendar/components/multi-calendar";
import { resolveCalendarAnchor } from "@/features/calendar/lib/calendar-dates";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getCalendarData } from "@/services/calendar/calendar.service";
import { listPropertiesForInbox } from "@/services/properties/property.service";
import type { AppUserRole } from "@/types/auth";

type CalendarPageProps = {
  searchParams: Promise<{ anchor?: string; reservation?: string }>;
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

  const reservationParam = params.reservation?.trim() ?? null;
  const initialReservationId =
    reservationParam &&
    data.reservations.some((r) => r.id === reservationParam)
      ? reservationParam
      : null;

  return (
    <ModuleShellFill>
      <MultiCalendar
        data={data}
        canWrite={canWrite}
        canSyncAirbnb={canSyncAirbnb}
        propertyOptions={propertyOptions}
        initialReservationId={initialReservationId}
      />
    </ModuleShellFill>
  );
}

import dynamic from "next/dynamic";
import { ModuleShellFill } from "@/components/layout/module-shell";
import { resolveCalendarAnchor } from "@/features/calendar/lib/calendar-dates";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import { getCalendarData } from "@/services/calendar/calendar.service";
import { listPropertiesForInbox } from "@/services/properties/property.service";
import type { AppUserRole } from "@/types/auth";
import { redirectIfBillingLocked } from "@/lib/billing/require-billing-route";
import CalendarLoading from "./loading";

const MultiCalendar = dynamic(
  () =>
    import("@/features/calendar/components/multi-calendar").then((m) => ({
      default: m.MultiCalendar,
    })),
  { loading: () => <CalendarLoading /> },
);

type CalendarPageProps = {
  searchParams: Promise<{ anchor?: string; reservation?: string }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const [auth, billing, params] = await Promise.all([
    requirePermission("calendar:read"),
    getBillingAccessSnapshot(),
    searchParams,
  ]);
  await redirectIfBillingLocked("/calendar");

  const anchor = resolveCalendarAnchor(params.anchor);
  const canWrite =
    !billing.locked &&
    hasPermission(auth.role as AppUserRole, "reservations:write");
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

import dynamic from "next/dynamic";
import { ModuleShellFill } from "@/components/layout/module-shell";
import { resolveCalendarAnchor } from "@/features/calendar/lib/calendar-dates";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import { getCalendarData } from "@/services/calendar/calendar.service";
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
  const canManageGuestRegistration =
    !billing.locked &&
    (hasPermission(auth.role as AppUserRole, "reservations:write") ||
      hasPermission(auth.role as AppUserRole, "properties:write"));
  const canManagePayments =
    !billing.locked &&
    hasPermission(auth.role as AppUserRole, "finance:write");
  const data = await getCalendarData(anchor);
  const propertyOptions = data.properties.map((property) => ({
    id: property.id,
    name: property.name,
    unitNumber: property.unitNumber,
    address: property.address,
    city: property.city,
  }));

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
        canManageGuestRegistration={canManageGuestRegistration}
        canManagePayments={canManagePayments}
        propertyOptions={propertyOptions}
        initialReservationId={initialReservationId}
      />
    </ModuleShellFill>
  );
}

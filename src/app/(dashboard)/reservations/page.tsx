import dynamic from "next/dynamic";
import { ModuleShellFill } from "@/components/layout/module-shell";
import { hasPermission, requirePermission } from "@/lib/auth";
import { listPropertiesForInbox } from "@/services/properties/property.service";
import { listReservationsForInbox } from "@/services/reservations/reservation.service";
import type { AppUserRole } from "@/types/auth";
import ReservationsLoading from "./loading";

const ReservationsInbox = dynamic(
  () =>
    import("@/features/reservations/components/reservations-inbox").then(
      (m) => ({ default: m.ReservationsInbox }),
    ),
  { loading: () => <ReservationsLoading /> },
);

type ReservationsPageProps = {
  searchParams: Promise<{
    create?: string;
    reservation?: string;
    propertyId?: string;
    checkIn?: string;
    checkOut?: string;
  }>;
};

export default async function ReservationsPage({
  searchParams,
}: ReservationsPageProps) {
  const authPromise = requirePermission("reservations:read");
  const [auth, params, reservations, properties] = await Promise.all([
    authPromise,
    searchParams,
    listReservationsForInbox(),
    authPromise.then((resolvedAuth) =>
      listPropertiesForInbox(resolvedAuth.dbUserId),
    ),
  ]);
  const role = auth.role as AppUserRole;
  const canCreate = hasPermission(role, "reservations:create");
  const canWrite = hasPermission(role, "reservations:write");
  const canManageGuestRegistration =
    hasPermission(role, "reservations:write") ||
    hasPermission(role, "properties:write");
  const canDelete = hasPermission(role, "reservations:delete");
  const canManagePayments = hasPermission(role, "finance:write");
  const reservationId = params.reservation ?? null;
  const validReservationId =
    reservationId && reservations.some((r) => r.id === reservationId)
      ? reservationId
      : null;

  return (
    <ModuleShellFill>
      <ReservationsInbox
        initialReservations={reservations}
        properties={properties}
        canCreate={canCreate}
        canWrite={canWrite}
        canManageGuestRegistration={canManageGuestRegistration}
        canDelete={canDelete}
        canManagePayments={canManagePayments}
        openCreateOnMount={params.create === "true" && canCreate}
        initialSelectedId={validReservationId}
        initialCreateValues={
          params.create === "true" && canCreate
            ? {
                propertyId: params.propertyId,
                checkIn: params.checkIn,
                checkOut: params.checkOut,
              }
            : undefined
        }
      />
    </ModuleShellFill>
  );
}

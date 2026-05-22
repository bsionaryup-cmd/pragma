import dynamic from "next/dynamic";
import { ModuleShellFill } from "@/components/layout/module-shell";
import { hasPermission, requirePermission } from "@/lib/auth";
import { listPropertiesForInbox } from "@/services/properties/property.service";
import { listReservationsForInbox } from "@/services/reservations/reservation.service";
import type { AppUserRole } from "@/types/auth";

const ReservationsInbox = dynamic(
  () =>
    import("@/features/reservations/components/reservations-inbox").then(
      (m) => ({ default: m.ReservationsInbox }),
    ),
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
  const auth = await requirePermission("reservations:read");
  const [params, reservations, properties] = await Promise.all([
    searchParams,
    listReservationsForInbox(),
    listPropertiesForInbox(auth.dbUserId),
  ]);
  const role = auth.role as AppUserRole;
  const canCreate = hasPermission(role, "reservations:create");
  const canWrite = hasPermission(role, "reservations:write");
  const canDelete = hasPermission(role, "reservations:delete");

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
        canDelete={canDelete}
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

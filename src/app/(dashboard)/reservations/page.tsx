import { ModuleShellFill } from "@/components/layout/module-shell";
import { ReservationsInbox } from "@/features/reservations/components/reservations-inbox";
import { hasPermission, requirePermission } from "@/lib/auth";
import { listPropertiesForInbox } from "@/services/properties/property.service";
import { listReservationsForInbox } from "@/services/reservations/reservation.service";
import type { AppUserRole } from "@/types/auth";

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
  const params = await searchParams;
  const canWrite = hasPermission(auth.role as AppUserRole, "reservations:write");

  const [reservations, properties] = await Promise.all([
    listReservationsForInbox(),
    listPropertiesForInbox(),
  ]);

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
        canWrite={canWrite}
        openCreateOnMount={params.create === "true" && canWrite}
        initialSelectedId={validReservationId}
        initialCreateValues={
          params.create === "true" && canWrite
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

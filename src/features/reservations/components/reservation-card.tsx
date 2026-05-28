"use client";

import { memo } from "react";
import {
  formatStayRange,
  totalGuests,
} from "@/features/reservations/lib/reservation-dates";
import {
  displayStatusLabels,
  getStatusBadgeClass,
  resolveDisplayStatus,
} from "@/features/reservations/lib/reservation-status";
import type { ReservationInboxItem } from "@/features/reservations/types/reservation.types";
import { ReservationSourceBadge } from "@/components/reservations/reservation-source-badge";
import { PropertyIdentity } from "@/components/properties/property-identity";
import { formatCurrency } from "@/lib/helpers";
import { isGuestRegistrationDueSoon } from "@/lib/guest-registration-alert";
import { isReservationHoldActive } from "@/lib/reservations/reservation-hold";
import { cn } from "@/lib/utils";

type ReservationCardProps = {
  reservation: ReservationInboxItem;
  isActive: boolean;
  onSelect: () => void;
};

function ReservationCardComponent({
  reservation,
  isActive,
  onSelect,
}: ReservationCardProps) {
  const displayStatus = resolveDisplayStatus(
    reservation.status,
    reservation.checkOut,
  );
  const guests = totalGuests(
    reservation.adults,
    reservation.children,
    reservation.infants,
  );
  const registrationDueSoon = isGuestRegistrationDueSoon({
    checkIn: reservation.checkIn,
    guestRegistrationCompletedAt: reservation.guestRegistrationCompletedAt,
  });
  const holdActive = isReservationHoldActive({
    holdExpiresAt: reservation.holdExpiresAt,
    paymentStatus: reservation.paymentStatus,
  });

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex w-full flex-col gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-left shadow-pragma-soft transition-colors duration-150",
        "hover:border-primary/15 hover:bg-muted/20",
        isActive && "border-primary/25 bg-primary/[0.03] ring-1 ring-primary/15",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-0.5">
            <PropertyIdentity
              name={reservation.property.name}
              unitNumber={reservation.property.unitNumber}
              showName={false}
              size="sm"
            />
          </div>
          <p className="truncate text-base font-semibold leading-tight text-foreground">
            {reservation.guestName}
          </p>
          <p className="mt-0.5 truncate text-base text-foreground/80">
            {reservation.property.name}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {holdActive ? (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400">
              Pago pendiente
            </span>
          ) : registrationDueSoon ? (
            <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[9px] font-medium text-warning">
              Registro pendiente
            </span>
          ) : null}
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
              getStatusBadgeClass(displayStatus),
            )}
          >
            {displayStatusLabels[displayStatus]}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-base text-foreground/80">
          <span className="tabular-nums">
            {formatStayRange(reservation.checkIn, reservation.checkOut)}
          </span>
          <span aria-hidden>·</span>
          <span>
            {guests} huésped{guests === 1 ? "" : "es"}
          </span>
          <ReservationSourceBadge
            platform={reservation.platform}
            showLabel={false}
          />
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
          {formatCurrency(Number(reservation.totalAmount), reservation.currency)}
        </span>
      </div>
    </button>
  );
}

export const ReservationCard = memo(ReservationCardComponent);

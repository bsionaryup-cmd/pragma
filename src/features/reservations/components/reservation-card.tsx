"use client";

import { memo } from "react";
import { CalendarDays, Users } from "lucide-react";
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
import { formatPropertyLabel } from "@/lib/property-display";
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
  const displayStatus = resolveDisplayStatus(reservation.status);
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
  const amount = Number(reservation.totalAmount);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors",
        "hover:border-pragma-electric/30 hover:bg-muted/30",
        isActive && "border-pragma-electric bg-pragma-electric/5 ring-1 ring-pragma-electric/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <ReservationSourceBadge
              platform={reservation.platform}
              showLabel={false}
              size="sm"
            />
            {holdActive ? (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                Cobro pendiente
              </span>
            ) : registrationDueSoon ? (
              <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                Falta registro
              </span>
            ) : null}
            {(reservation.activityUnreadCount ?? 0) > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 dark:text-sky-200">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden />
                {reservation.activityUnreadHint ??
                  `${reservation.activityUnreadCount} actividades nuevas`}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {reservation.guestName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {formatPropertyLabel(reservation.property)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
            getStatusBadgeClass(displayStatus),
          )}
        >
          {displayStatusLabels[displayStatus]}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <CalendarDays className="h-3 w-3 shrink-0" />
            {formatStayRange(reservation.checkIn, reservation.checkOut)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3 shrink-0" />
            {guests}
          </span>
        </div>
        {amount > 0 ? (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
            {formatCurrency(amount, reservation.currency)}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export const ReservationCard = memo(ReservationCardComponent);

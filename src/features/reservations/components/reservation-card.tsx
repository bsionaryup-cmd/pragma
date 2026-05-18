"use client";

import { Building2 } from "lucide-react";
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
import { formatCurrency } from "@/lib/helpers";
import { platformLabels } from "@/lib/labels";
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

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors",
        "hover:bg-muted/50",
        isActive && "bg-muted/70 ring-1 ring-inset ring-border",
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Building2 className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              getStatusBadgeClass(displayStatus),
            )}
          >
            {displayStatusLabels[displayStatus]}
          </span>
          <span className="shrink-0 text-xs font-semibold tabular-nums">
            {formatCurrency(Number(reservation.totalAmount), reservation.currency)}
          </span>
        </div>

        <p className="truncate text-sm font-semibold leading-tight">
          {reservation.guestName}
        </p>

        <p className="truncate text-xs text-muted-foreground">
          {formatStayRange(reservation.checkIn, reservation.checkOut)}
          <span className="mx-1">·</span>
          {guests} huésped{guests === 1 ? "" : "es"}
        </p>

        <p className="truncate text-[11px] text-muted-foreground">
          {platformLabels[reservation.platform]}
          <span className="mx-1">·</span>
          {reservation.property.name}
        </p>
      </div>
    </button>
  );
}

export const ReservationCard = memo(ReservationCardComponent);

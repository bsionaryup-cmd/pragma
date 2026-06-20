"use client";

import { memo } from "react";
import type { ReservationInquiryInboxItem } from "@/features/reservations/types/reservation.types";
import { cn } from "@/lib/utils";

type ReservationInquiryCardProps = {
  inquiry: ReservationInquiryInboxItem;
  isActive: boolean;
  onSelect: () => void;
};

function ReservationInquiryCardComponent({
  inquiry,
  isActive,
  onSelect,
}: ReservationInquiryCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors",
        "hover:border-sky-500/30 hover:bg-muted/30",
        isActive && "border-sky-500/50 bg-sky-500/5 ring-1 ring-sky-500/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-sky-500/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
              Consulta
            </span>
            {inquiry.latestIntentLabel ? (
              <span className="rounded-full bg-indigo-500/12 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800 dark:text-indigo-200">
                {inquiry.latestIntentLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {inquiry.guestName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {inquiry.propertyLabel}
            {inquiry.dateRangeLabel ? ` · ${inquiry.dateRangeLabel}` : ""}
          </p>
        </div>
        <time className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {inquiry.latestTimeLabel}
        </time>
      </div>

      <p className="line-clamp-2 text-xs leading-snug text-foreground/85">
        {inquiry.latestNarrative}
      </p>
    </button>
  );
}

export const ReservationInquiryCard = memo(ReservationInquiryCardComponent);

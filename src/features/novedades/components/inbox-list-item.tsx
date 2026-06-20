"use client";

import { Building2 } from "lucide-react";
import type { InboxUnifiedThread } from "@/features/novedades/lib/inbox-unified-list";
import { InboxStatusBadge } from "@/features/novedades/components/inbox-status-badge";
import {
  displayInboxGuestName,
  displayInboxText,
  extractInboxUnitLabel,
  formatInboxDateRangeLabel,
} from "@/features/novedades/lib/inbox-display";
import { resolveInboxThreadStatus } from "@/features/novedades/lib/inbox-thread-status";
import { cn } from "@/lib/utils";

type InboxListItemProps = {
  thread: InboxUnifiedThread;
  isActive: boolean;
  onSelect: () => void;
};

function InboxPropertyThumbnail({
  propertyLabel,
  unitLabel,
}: {
  propertyLabel: string;
  unitLabel: string | null;
}) {
  return (
    <div
      className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted"
      aria-hidden
    >
      {unitLabel ? (
        <span className="text-lg font-semibold tabular-nums text-foreground/80">{unitLabel}</span>
      ) : (
        <Building2 className="h-5 w-5 text-muted-foreground/70" />
      )}
      <span className="sr-only">{propertyLabel}</span>
    </div>
  );
}

export function InboxListItem({ thread, isActive, onSelect }: InboxListItemProps) {
  const isInquiry = thread.kind === "inquiry";
  const item = thread.item;
  const guestName = displayInboxGuestName(item.guestName, isInquiry ? "Consulta" : "Reserva");
  const unitLabel = extractInboxUnitLabel(item.propertyLabel);
  const dateRange = formatInboxDateRangeLabel(item.dateRangeLabel);
  const status = resolveInboxThreadStatus({
    isInquiry,
    reservationStatus: thread.kind === "reservation" ? thread.item.reservationStatus : null,
    stayStage: null,
  });
  const unread = thread.attentionCount > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex w-full border-b border-border/60 px-3 py-3 text-left transition-colors",
        isActive
          ? "bg-primary/[0.06] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary"
          : "hover:bg-module-pane-alt/70",
      )}
    >
      <div className="flex w-full items-start gap-3">
        <InboxPropertyThumbnail propertyLabel={item.propertyLabel} unitLabel={unitLabel} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "truncate text-[15px] leading-tight text-foreground",
                unread || isActive ? "font-semibold" : "font-medium",
              )}
            >
              {guestName}
            </p>
            <time className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
              {item.latestTimeLabel}
            </time>
          </div>

          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {unitLabel ? `${unitLabel}` : item.propertyLabel}
            {dateRange ? ` · ${dateRange}` : ""}
          </p>

          <div className="mt-2">
            <InboxStatusBadge status={status} />
          </div>

          <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-foreground/90">
            {displayInboxText(item.latestNarrative)}
          </p>
        </div>
      </div>
    </button>
  );
}

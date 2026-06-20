"use client";

import type { NovedadesUnlinkedInquiryItem } from "@/services/novedades/novedades-inbox.types";
import { cn } from "@/lib/utils";

type NovedadesUnlinkedInquiryListItemProps = {
  item: NovedadesUnlinkedInquiryItem;
  isActive: boolean;
  onSelect: () => void;
};

export function NovedadesUnlinkedInquiryListItem({
  item,
  isActive,
  onSelect,
}: NovedadesUnlinkedInquiryListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex w-full border-b border-border/70 px-3 py-3.5 text-left transition-colors",
        isActive
          ? "bg-primary/[0.07] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary"
          : "hover:bg-module-pane-alt/80",
      )}
    >
      <div className="flex w-full items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/12 text-xs font-semibold text-sky-900 dark:text-sky-200">
          {item.guestInitials}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "truncate text-[15px] leading-tight text-foreground",
                    isActive ? "font-semibold" : "font-medium",
                  )}
                >
                  {item.guestName}
                </span>
                <span className="rounded bg-sky-500/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
                  Consulta
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {item.propertyLabel}
                {item.dateRangeLabel ? ` · ${item.dateRangeLabel}` : ""}
              </p>
            </div>
            <time className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
              {item.latestTimeLabel}
            </time>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {item.latestIntentLabel ? (
              <span className="rounded bg-indigo-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 dark:text-indigo-200">
                {item.latestIntentLabel}
              </span>
            ) : null}
            <span className="text-[10px] text-muted-foreground">Sin reserva</span>
          </div>

          <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-foreground">
            {item.latestNarrative}
          </p>
        </div>
      </div>
    </button>
  );
}

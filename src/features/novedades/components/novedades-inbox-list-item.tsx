"use client";

import type {
  NovedadesInboxListItem as NovedadesInboxListItemType,
  NovedadesTimelineKind,
} from "@/services/novedades/novedades-inbox.types";
import { ReservationSourceBadge } from "@/components/reservations/reservation-source-badge";
import { cn } from "@/lib/utils";

type NovedadesInboxListItemProps = {
  item: NovedadesInboxListItemType;
  isActive: boolean;
  onSelect: () => void;
};

const KIND_PREVIEW: Partial<Record<NovedadesTimelineKind, { label: string; className: string }>> = {
  GUEST_MESSAGE: { label: "Mensaje", className: "bg-sky-500/12 text-sky-800 dark:text-sky-200" },
  NEW_RESERVATION: { label: "Reserva", className: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200" },
  RESERVATION_CREATED: { label: "Reserva", className: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-200" },
  PAYMENT_CONFIRMED: { label: "Pago", className: "bg-violet-500/12 text-violet-800 dark:text-violet-200" },
  PAYOUT_SENT: { label: "Desembolso", className: "bg-violet-500/12 text-violet-800 dark:text-violet-200" },
  MODIFICATION_REQUEST: { label: "Cambio", className: "bg-amber-500/12 text-amber-800 dark:text-amber-200" },
  ALERT: { label: "Atención", className: "bg-amber-500/12 text-amber-800 dark:text-amber-200" },
};

export function NovedadesInboxListItem({
  item,
  isActive,
  onSelect,
}: NovedadesInboxListItemProps) {
  const kindPreview = item.latestKind ? KIND_PREVIEW[item.latestKind] : null;

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
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            item.attentionCount > 0
              ? "bg-amber-500/15 text-amber-900 dark:text-amber-200"
              : "bg-muted text-muted-foreground",
          )}
        >
          {item.guestInitials}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "truncate text-[15px] leading-tight text-foreground",
                    item.attentionCount > 0 || isActive ? "font-semibold" : "font-medium",
                  )}
                >
                  {item.guestName}
                </span>
                {item.platform ? (
                  <ReservationSourceBadge
                    platform={item.platform}
                    showLabel={false}
                    size="sm"
                  />
                ) : null}
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
            {kindPreview ? (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  kindPreview.className,
                )}
              >
                {kindPreview.label}
              </span>
            ) : null}
            {item.latestKind === "GUEST_MESSAGE" && item.latestIntentLabel ? (
              <span className="rounded bg-indigo-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 dark:text-indigo-200">
                {item.latestIntentLabel}
              </span>
            ) : null}
            {item.amountLabel ? (
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {item.amountLabel}
              </span>
            ) : null}
            {item.statusLabel ? (
              <span className="text-[10px] text-muted-foreground">{item.statusLabel}</span>
            ) : null}
            {item.attentionCount > 0 ? (
              <span className="rounded bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                {item.attentionCount} pendiente{item.attentionCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          <p
            className={cn(
              "mt-1.5 line-clamp-2 text-[13px] leading-snug",
              item.latestKind === "GUEST_MESSAGE"
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            {item.latestNarrative}
          </p>
        </div>
      </div>
    </button>
  );
}

"use client";

import { ArrowLeft, MessageCircleQuestion } from "lucide-react";
import type { ReservationInquiryInboxItem } from "@/features/reservations/types/reservation.types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReservationInquiryPanelProps = {
  inquiry: ReservationInquiryInboxItem | null;
  loading?: boolean;
  onBack?: () => void;
};

export function ReservationInquiryPanel({
  inquiry,
  loading = false,
  onBack,
}: ReservationInquiryPanelProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Cargando consulta…
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Consulta no disponible
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border/60 px-5 py-4">
        <div className="flex items-start gap-3">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-0.5 shrink-0"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                {inquiry.guestName}
              </h2>
              <span className="rounded-full bg-sky-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
                Consulta
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{inquiry.propertyLabel}</p>
            {inquiry.dateRangeLabel ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {inquiry.dateRangeLabel}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="pragma-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <article
          className={cn(
            "rounded-xl border border-sky-200/60 bg-sky-50/40 px-4 py-3 dark:border-sky-900/40 dark:bg-sky-950/20",
          )}
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
              <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden />
              Consulta
            </span>
            <time className="text-[11px] tabular-nums text-muted-foreground">
              {inquiry.latestTimeLabel}
            </time>
            {inquiry.latestIntentLabel ? (
              <span className="rounded bg-indigo-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 dark:text-indigo-200">
                {inquiry.latestIntentLabel}
              </span>
            ) : null}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {inquiry.latestNarrative}
          </p>
        </article>

        {inquiry.subject ? (
          <p className="mt-3 text-xs text-muted-foreground">{inquiry.subject}</p>
        ) : null}
      </div>
    </div>
  );
}

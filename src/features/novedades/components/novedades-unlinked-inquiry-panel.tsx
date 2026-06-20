"use client";

import { ArrowLeft } from "lucide-react";
import type { NovedadesUnlinkedInquiryItem } from "@/services/novedades/novedades-inbox.types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NovedadesUnlinkedInquiryPanelProps = {
  inquiry: NovedadesUnlinkedInquiryItem | null;
  loading: boolean;
  onBack?: () => void;
};

export function NovedadesUnlinkedInquiryPanel({
  inquiry,
  loading,
  onBack,
}: NovedadesUnlinkedInquiryPanelProps) {
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border px-4 py-3">
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
              <h2 className="truncate text-base font-semibold text-foreground">
                {inquiry.guestName}
              </h2>
              <span className="rounded bg-sky-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200">
                Consulta sin reserva
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{inquiry.propertyLabel}</p>
            {inquiry.dateRangeLabel ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Fechas consultadas: {inquiry.dateRangeLabel}
              </p>
            ) : null}
            {inquiry.subject ? (
              <p className="mt-2 text-xs text-muted-foreground">{inquiry.subject}</p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="pragma-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
        <div
          className={cn(
            "mx-auto max-w-2xl rounded-xl border border-border/80 bg-module-pane-alt p-4",
          )}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Mensaje del huésped
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
        </div>

        <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-muted-foreground">
          Esta conversación aún no tiene una reserva vinculada en PRAGMA. Cuando el huésped
          confirme, el hilo se integrará al historial de la reserva.
        </p>
      </div>
    </div>
  );
}

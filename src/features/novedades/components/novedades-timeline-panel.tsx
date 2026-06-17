"use client";

import Link from "next/link";
import { ArrowLeft, ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NovedadesCopyActions } from "@/features/novedades/components/novedades-copy-actions";
import type {
  NovedadesReservationDetail,
  NovedadesTimelineEntry,
  NovedadesTimelineKind,
} from "@/services/novedades/novedades-inbox.types";
import { moduleShellClasses } from "@/components/layout/module-shell";
import { ReservationSourceBadge } from "@/components/reservations/reservation-source-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/helpers/date";
import { cn } from "@/lib/utils";

type NovedadesTimelinePanelProps = {
  detail: NovedadesReservationDetail | null;
  loading?: boolean;
  onBack?: () => void;
};

const KIND_META: Record<
  NovedadesTimelineKind,
  { label: string; tone: string }
> = {
  RESERVATION_CREATED: { label: "Reserva confirmada", tone: "text-emerald-700 dark:text-emerald-300" },
  NEW_RESERVATION: { label: "Reserva confirmada", tone: "text-emerald-700 dark:text-emerald-300" },
  MODIFICATION_REQUEST: { label: "Solicitud de cambio", tone: "text-amber-700 dark:text-amber-300" },
  MODIFICATION_APPROVED: { label: "Cambio confirmado", tone: "text-amber-700 dark:text-amber-300" },
  RESERVATION_UPDATED: { label: "Actualización", tone: "text-muted-foreground" },
  STAY_EXTENDED: { label: "Extensión", tone: "text-muted-foreground" },
  RESERVATION_CANCELLED: { label: "Cancelación", tone: "text-red-700 dark:text-red-300" },
  GUEST_MESSAGE: { label: "Mensaje del huésped", tone: "text-sky-700 dark:text-sky-300" },
  PAYMENT_CONFIRMED: { label: "Pago recibido", tone: "text-violet-700 dark:text-violet-300" },
  PAYOUT_SENT: { label: "Desembolso Airbnb", tone: "text-violet-700 dark:text-violet-300" },
  GUEST_REGISTRATION: { label: "Registro", tone: "text-muted-foreground" },
  ACCESS_CODE: { label: "Acceso", tone: "text-muted-foreground" },
  CHECK_IN: { label: "Check-in", tone: "text-muted-foreground" },
  CHECK_OUT: { label: "Check-out", tone: "text-muted-foreground" },
  TASK: { label: "Tarea", tone: "text-muted-foreground" },
  ALERT: { label: "Requiere atención", tone: "text-amber-700 dark:text-amber-300" },
};

const MONEY_KINDS = new Set<NovedadesTimelineKind>([
  "NEW_RESERVATION",
  "RESERVATION_CREATED",
  "PAYMENT_CONFIRMED",
  "PAYOUT_SENT",
]);

function formatDayLabel(iso: string): string {
  return formatDateTime(iso, "—", { dateStyle: "full" });
}

function formatTimeOnly(iso: string): string {
  return formatDateTime(iso, "—", { timeStyle: "short" });
}

function groupEntriesByDay(entries: NovedadesTimelineEntry[]) {
  const sorted = [...entries].sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt);
    if (byTime !== 0) return byTime;
    return a.id.localeCompare(b.id);
  });
  const groups: { dayLabel: string; entries: NovedadesTimelineEntry[] }[] = [];
  let currentDay = "";

  for (const entry of sorted) {
    const dayLabel = formatDayLabel(entry.createdAt);
    if (dayLabel !== currentDay) {
      currentDay = dayLabel;
      groups.push({ dayLabel, entries: [entry] });
    } else {
      groups[groups.length - 1]?.entries.push(entry);
    }
  }

  return groups;
}

function GuestMessageRow({
  entry,
  guestName,
  isLast,
}: {
  entry: NovedadesTimelineEntry;
  guestName: string;
  isLast: boolean;
}) {
  return (
    <li className={cn("pb-6", isLast && "pb-1")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">
          Mensaje del huésped
        </span>
        <time
          className="text-[11px] tabular-nums text-muted-foreground"
          dateTime={entry.createdAt}
        >
          {formatTimeOnly(entry.createdAt)}
        </time>
      </div>
      <div className="max-w-[min(100%,36rem)]">
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">{guestName}</p>
        <div className="rounded-2xl rounded-tl-sm border border-primary/20 bg-pragma-soft-cyan/40 px-4 py-3 shadow-sm dark:bg-primary/[0.08]">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
            {entry.messageBody}
          </p>
        </div>
      </div>
      {entry.suggestedReplies && entry.suggestedReplies.length > 0 ? (
        <div className="mt-3 max-w-[min(100%,36rem)]">
          <p className="mb-2 text-[11px] font-medium text-muted-foreground">
            Sugerencia de respuesta
          </p>
          <NovedadesCopyActions actions={entry.suggestedReplies} compact />
        </div>
      ) : null}
    </li>
  );
}

function ActivityRow({
  entry,
  isLast,
}: {
  entry: NovedadesTimelineEntry;
  isLast: boolean;
}) {
  const meta = KIND_META[entry.kind];
  const showAmount = Boolean(entry.amountLabel) && MONEY_KINDS.has(entry.kind);

  return (
    <li className={cn("relative pb-4", isLast && "pb-1")}>
      <div className="flex gap-3">
        <time
          className="w-14 shrink-0 pt-0.5 text-right text-[11px] tabular-nums text-muted-foreground sm:w-16"
          dateTime={entry.createdAt}
        >
          {formatTimeOnly(entry.createdAt)}
        </time>

        <article className="min-w-0 flex-1 rounded-lg border border-border/70 bg-module-pane/80 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn("text-[11px] font-semibold", meta.tone)}>{meta.label}</span>
            {showAmount ? (
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {entry.amountLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">{entry.narrative}</p>
        </article>
      </div>
    </li>
  );
}

export function NovedadesTimelinePanel({
  detail,
  loading = false,
  onBack,
}: NovedadesTimelinePanelProps) {
  const [activityOpen, setActivityOpen] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  const { guestMessages, activityEntries } = useMemo(() => {
    if (!detail) {
      return { guestMessages: [] as NovedadesTimelineEntry[], activityEntries: [] as NovedadesTimelineEntry[] };
    }
    const guestMessages = detail.entries.filter(
      (entry) => entry.kind === "GUEST_MESSAGE" && entry.messageBody,
    );
    const guestIds = new Set(guestMessages.map((entry) => entry.id));
    const activityEntries = detail.entries.filter((entry) => !guestIds.has(entry.id));
    return { guestMessages, activityEntries };
  }, [detail]);

  const guestDayGroups = useMemo(
    () => groupEntriesByDay(guestMessages),
    [guestMessages],
  );
  const activityDayGroups = useMemo(
    () => groupEntriesByDay(activityEntries),
    [activityEntries],
  );

  useEffect(() => {
    const node = messagesScrollRef.current;
    if (!node || guestMessages.length === 0) return;
    node.scrollTop = node.scrollHeight;
  }, [detail?.reservationId, guestMessages.length]);

  if (loading && !detail) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Cargando historial…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        No se encontró la reserva.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className={cn("shrink-0 px-4 py-4", moduleShellClasses.paneHeader)}>
        <div className="flex items-start gap-3">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-0.5 h-8 w-8 shrink-0 md:hidden"
              onClick={onBack}
              aria-label="Volver al listado"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
            {detail.guestInitials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-foreground">
                {detail.guestName}
              </h2>
              <ReservationSourceBadge platform={detail.platform} size="sm" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {detail.propertyLabel} · {detail.dateRangeLabel}
              {detail.confirmationCode ? ` · ${detail.confirmationCode}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                {detail.stayStage}
              </span>
              <span className="text-xs text-muted-foreground">{detail.statusLabel}</span>
              {detail.totalAmountLabel ? (
                <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                  {detail.totalAmountLabel}
                </span>
              ) : null}
            </div>
          </div>

          <Link
            href={`/reservations?reservation=${detail.reservationId}`}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted/40"
          >
            Abrir reserva
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-3">
          <p className="mb-2 text-xs font-medium text-foreground">
            Copiar mensaje — pega en Airbnb o WhatsApp
          </p>
          <NovedadesCopyActions actions={detail.copyMessageActions} />
        </div>
      </header>

      <div
        ref={messagesScrollRef}
        className="pragma-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain bg-module-canvas/60 px-4 py-6"
      >
        <div className="mx-auto max-w-3xl space-y-8">
          <section>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mensajes del huésped
            </h3>
            {guestMessages.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/80 bg-module-pane/50 px-4 py-8 text-center text-sm text-muted-foreground">
                Aún no hay mensajes legibles del huésped en esta reserva.
              </p>
            ) : (
              <div className="space-y-8">
                {guestDayGroups.map((group) => (
                  <div key={group.dayLabel}>
                    <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.dayLabel}
                    </p>
                    <ol className="space-y-1">
                      {group.entries.map((entry, index) => (
                        <GuestMessageRow
                          key={entry.id}
                          entry={entry}
                          guestName={detail.guestName}
                          isLast={index === group.entries.length - 1}
                        />
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </section>

          {activityEntries.length > 0 ? (
            <section>
              <button
                type="button"
                onClick={() => setActivityOpen((open) => !open)}
                className="mb-4 flex w-full items-center justify-between gap-2 rounded-lg border border-border/70 bg-module-pane/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-module-pane"
              >
                <span>Actividad de la reserva ({activityEntries.length})</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    activityOpen && "rotate-180",
                  )}
                />
              </button>
              {activityOpen ? (
                <div className="space-y-6">
                  {activityDayGroups.map((group) => (
                    <div key={group.dayLabel}>
                      <p className="mb-3 text-center text-[11px] font-medium text-muted-foreground">
                        {group.dayLabel}
                      </p>
                      <ol className="space-y-1">
                        {group.entries.map((entry, index) => (
                          <ActivityRow
                            key={entry.id}
                            entry={entry}
                            isLast={index === group.entries.length - 1}
                          />
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

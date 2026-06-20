"use client";

import Link from "next/link";
import { ArrowLeft, ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { InboxActionBar } from "@/features/novedades/components/inbox-action-bar";
import {
  InboxDetailTabs,
  type InboxDetailTab,
} from "@/features/novedades/components/inbox-detail-tabs";
import { InboxStatusBadge } from "@/features/novedades/components/inbox-status-badge";
import {
  NovedadesAiDraftPanel,
  type NovedadesAiDraftPanelHandle,
} from "@/features/novedades/components/novedades-ai-draft-panel";
import { NovedadesCopyActions } from "@/features/novedades/components/novedades-copy-actions";
import {
  displayInboxGuestName,
  displayInboxText,
  extractInboxUnitLabel,
  formatInboxDateRangeLabel,
} from "@/features/novedades/lib/inbox-display";
import { groupInboxActivityEntries } from "@/features/novedades/lib/inbox-activity-grouping";
import { resolveInboxThreadStatus } from "@/features/novedades/lib/inbox-thread-status";
import type {
  NovedadesReservationDetail,
  NovedadesTimelineEntry,
  NovedadesTimelineKind,
} from "@/services/novedades/novedades-inbox.types";
import { moduleShellClasses } from "@/components/layout/module-shell";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/helpers/date";
import { cn } from "@/lib/utils";

type NovedadesTimelinePanelProps = {
  detail: NovedadesReservationDetail | null;
  loading?: boolean;
  onBack?: () => void;
};

const KIND_META: Record<NovedadesTimelineKind, { label: string }> = {
  RESERVATION_CREATED: { label: "Reserva confirmada" },
  NEW_RESERVATION: { label: "Reserva confirmada" },
  MODIFICATION_REQUEST: { label: "Solicitud de cambio" },
  MODIFICATION_APPROVED: { label: "Cambio confirmado" },
  RESERVATION_UPDATED: { label: "Actualización" },
  STAY_EXTENDED: { label: "Extensión" },
  RESERVATION_CANCELLED: { label: "Cancelación" },
  GUEST_MESSAGE: { label: "Mensaje del huésped" },
  PAYMENT_CONFIRMED: { label: "Pago recibido" },
  PAYOUT_SENT: { label: "Desembolso Airbnb" },
  GUEST_REGISTRATION: { label: "Registro" },
  ACCESS_CODE: { label: "Acceso" },
  CHECK_IN: { label: "Check-in" },
  CHECK_OUT: { label: "Check-out" },
  TASK: { label: "Tarea" },
  ALERT: { label: "Requiere atención" },
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
  reservationId,
  isLast,
  draftRef,
}: {
  entry: NovedadesTimelineEntry;
  guestName: string;
  reservationId: string;
  isLast: boolean;
  draftRef?: RefObject<NovedadesAiDraftPanelHandle | null>;
}) {
  return (
    <li className={cn("pb-6", isLast && "pb-1")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{guestName}</span>
        <time
          className="text-[11px] tabular-nums text-muted-foreground"
          dateTime={entry.createdAt}
        >
          {formatTimeOnly(entry.createdAt)}
        </time>
      </div>
      <div className="max-w-[min(100%,36rem)]">
        <div className="rounded-2xl rounded-tl-sm border border-border/80 bg-module-pane px-4 py-3">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
            {displayInboxText(entry.messageBody)}
          </p>
        </div>
      </div>
      {entry.suggestedReplies && entry.suggestedReplies.length > 0 ? (
        <details className="mt-3 max-w-[min(100%,36rem)]">
          <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
            Más respuestas sugeridas
          </summary>
          <div className="mt-2">
            <NovedadesCopyActions actions={entry.suggestedReplies} compact />
          </div>
        </details>
      ) : null}
      {entry.messageBody && isLast ? (
        <NovedadesAiDraftPanel
          ref={draftRef}
          reservationId={reservationId}
          guestMessageId={entry.id}
          guestMessageBody={entry.messageBody}
          hideInlineTrigger
        />
      ) : null}
    </li>
  );
}

function ActivityGroupRow({
  group,
  expanded,
  onToggle,
}: {
  group: ReturnType<typeof groupInboxActivityEntries>[number];
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta = KIND_META[group.kind];
  const showAmount =
    Boolean(group.amountLabel) && MONEY_KINDS.has(group.kind) && group.count === 1;

  return (
    <li className="rounded-lg border border-border/60 bg-module-pane/50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-3 text-left"
      >
        <time
          className="w-14 shrink-0 pt-0.5 text-right text-[11px] tabular-nums text-muted-foreground"
          dateTime={group.latestAt}
        >
          {formatTimeOnly(group.latestAt)}
        </time>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">
              {group.count > 1 ? group.title : meta.label}
            </span>
            {showAmount ? (
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {group.amountLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">
            {group.narrative}
          </p>
          {group.count > 1 ? (
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              {expanded ? "Ocultar" : "Mostrar más"}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
            </span>
          ) : null}
        </div>
      </button>
      {expanded && group.count > 1 ? (
        <ul className="space-y-2 border-t border-border/60 px-3 py-2">
          {group.entries.map((entry) => (
            <li key={entry.id} className="text-xs text-muted-foreground">
              <span className="tabular-nums">{formatTimeOnly(entry.createdAt)}</span>
              {" · "}
              {entry.narrative}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function NovedadesTimelinePanel({
  detail,
  loading = false,
  onBack,
}: NovedadesTimelinePanelProps) {
  const [activeTab, setActiveTab] = useState<InboxDetailTab>("messages");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<NovedadesAiDraftPanelHandle>(null);
  const [generating, setGenerating] = useState(false);

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
  const activityGroups = useMemo(
    () => groupInboxActivityEntries(activityEntries),
    [activityEntries],
  );
  const activityDayGroups = useMemo(() => {
    const byDay = new Map<string, ReturnType<typeof groupInboxActivityEntries>>();
    for (const group of activityGroups) {
      const day = formatDayLabel(group.latestAt);
      const list = byDay.get(day) ?? [];
      list.push(group);
      byDay.set(day, list);
    }
    return [...byDay.entries()].map(([dayLabel, groups]) => ({ dayLabel, groups }));
  }, [activityGroups]);

  const lastGuestMessage = guestMessages[guestMessages.length - 1] ?? null;
  const guestName = detail ? displayInboxGuestName(detail.guestName) : "";
  const unitLabel = detail ? extractInboxUnitLabel(detail.propertyLabel) : null;
  const dateRange = detail ? formatInboxDateRangeLabel(detail.dateRangeLabel) : null;
  const threadStatus = detail
    ? resolveInboxThreadStatus({
        isInquiry: false,
        reservationStatus: detail.reservationStatus,
        stayStage: detail.stayStage,
      })
    : "reservada";

  useEffect(() => {
    const node = messagesScrollRef.current;
    if (!node || guestMessages.length === 0 || activeTab !== "messages") return;
    node.scrollTop = node.scrollHeight;
  }, [detail?.reservationId, guestMessages.length, activeTab]);

  useEffect(() => {
    setActiveTab("messages");
    setExpandedGroups({});
  }, [detail?.reservationId]);

  const handleGenerateAi = async () => {
    if (!draftRef.current) {
      toast.error("No hay mensaje del huésped para responder");
      return;
    }
    setGenerating(true);
    try {
      await draftRef.current.generate();
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    const draftText = draftRef.current?.getDraftText()?.trim();
    if (draftText) {
      await draftRef.current?.copy();
      return;
    }

    const fallback = detail?.copyMessageActions[0]?.messageText?.trim();
    if (!fallback) {
      toast.error("Genera una respuesta con IA o usa una plantilla");
      return;
    }

    try {
      await navigator.clipboard.writeText(fallback);
      toast.success("Respuesta copiada");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  if (loading && !detail) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Cargando conversación…
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

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-foreground">{guestName}</h2>
              <InboxStatusBadge status={threadStatus} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {unitLabel ?? detail.propertyLabel}
              {dateRange ? ` · ${dateRange}` : ""}
              {detail.confirmationCode ? ` · ${detail.confirmationCode}` : ""}
            </p>
          </div>

          <Link
            href={`/reservations?reservation=${detail.reservationId}`}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-muted/40"
          >
            Abrir reserva
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <InboxDetailTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activityCount={activityEntries.length}
      />

      <div
        ref={messagesScrollRef}
        className={cn(
          "pragma-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain bg-module-canvas/40 px-4 py-6",
          activeTab !== "messages" && "hidden",
        )}
      >
        <div className="mx-auto max-w-3xl space-y-8">
          {guestMessages.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/80 bg-module-pane/50 px-4 py-10 text-center text-sm text-muted-foreground">
              Aún no hay mensajes del huésped en esta conversación.
            </p>
          ) : (
            guestDayGroups.map((group) => (
              <div key={group.dayLabel}>
                <p className="mb-4 text-center text-[11px] font-medium text-muted-foreground">
                  {group.dayLabel}
                </p>
                <ol className="space-y-1">
                  {group.entries.map((entry) => (
                    <GuestMessageRow
                      key={entry.id}
                      entry={entry}
                      guestName={guestName}
                      reservationId={detail.reservationId}
                      isLast={entry.id === lastGuestMessage?.id}
                      draftRef={entry.id === lastGuestMessage?.id ? draftRef : undefined}
                    />
                  ))}
                </ol>
              </div>
            ))
          )}
        </div>
      </div>

      <div
        className={cn(
          "pragma-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain bg-module-canvas/40 px-4 py-6",
          activeTab !== "activity" && "hidden",
        )}
      >
        <div className="mx-auto max-w-3xl space-y-6">
          {activityEntries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/80 bg-module-pane/50 px-4 py-10 text-center text-sm text-muted-foreground">
              Sin actividad registrada para esta reserva.
            </p>
          ) : (
            activityDayGroups.map((group) => (
              <div key={group.dayLabel}>
                <p className="mb-3 text-center text-[11px] font-medium text-muted-foreground">
                  {group.dayLabel}
                </p>
                <ol className="space-y-2">
                  {group.groups.map((activityGroup) => (
                    <ActivityGroupRow
                      key={activityGroup.id}
                      group={activityGroup}
                      expanded={Boolean(expandedGroups[activityGroup.id])}
                      onToggle={() =>
                        setExpandedGroups((current) => ({
                          ...current,
                          [activityGroup.id]: !current[activityGroup.id],
                        }))
                      }
                    />
                  ))}
                </ol>
              </div>
            ))
          )}
        </div>
      </div>

      {activeTab === "messages" ? (
        <InboxActionBar
          onGenerateAi={lastGuestMessage ? () => void handleGenerateAi() : undefined}
          onCopy={() => void handleCopy()}
          generating={generating}
          airbnbHref="https://www.airbnb.com/hosting/inbox"
        />
      ) : null}
    </div>
  );
}

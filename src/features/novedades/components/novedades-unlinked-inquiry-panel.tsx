"use client";

import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { InboxActionBar } from "@/features/novedades/components/inbox-action-bar";
import {
  InboxDetailTabs,
  type InboxDetailTab,
} from "@/features/novedades/components/inbox-detail-tabs";
import { InboxStatusBadge } from "@/features/novedades/components/inbox-status-badge";
import {
  displayInboxGuestName,
  displayInboxText,
  extractInboxUnitLabel,
  formatInboxDateRangeLabel,
} from "@/features/novedades/lib/inbox-display";
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
  const [activeTab, setActiveTab] = useState<InboxDetailTab>("messages");

  const guestName = inquiry ? displayInboxGuestName(inquiry.guestName, "Consulta") : "";
  const unitLabel = inquiry ? extractInboxUnitLabel(inquiry.propertyLabel) : null;
  const dateRange = inquiry ? formatInboxDateRangeLabel(inquiry.dateRangeLabel) : null;

  const activityItems = useMemo(() => {
    if (!inquiry) return [];
    const items = [
      {
        id: "inquiry-received",
        title: "Consulta recibida",
        narrative: inquiry.latestNarrative,
        timeLabel: inquiry.latestTimeLabel,
      },
    ];
    if (inquiry.subject) {
      items.push({
        id: "inquiry-subject",
        title: "Asunto",
        narrative: inquiry.subject,
        timeLabel: inquiry.latestTimeLabel,
      });
    }
    return items;
  }, [inquiry]);

  const handleCopy = async () => {
    const text = inquiry?.latestNarrative.trim();
    if (!text) {
      toast.error("No hay mensaje para copiar");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Mensaje copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Cargando conversación…
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
      <header className="shrink-0 border-b border-border px-4 py-4">
        <div className="flex items-start gap-3">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-0.5 shrink-0 md:hidden"
              onClick={onBack}
              aria-label="Volver al listado"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-foreground">{guestName}</h2>
              <InboxStatusBadge status="consulta" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {unitLabel ?? inquiry.propertyLabel}
              {dateRange ? ` · ${dateRange}` : ""}
            </p>
          </div>
        </div>
      </header>

      <InboxDetailTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activityCount={activityItems.length}
      />

      <div
        className={cn(
          "pragma-scrollbar min-h-0 flex-1 overflow-y-auto p-4",
          activeTab !== "messages" && "hidden",
        )}
      >
        <div className="mx-auto max-w-2xl rounded-xl border border-border/80 bg-module-pane-alt p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Mensaje del huésped</span>
            <time className="text-[11px] tabular-nums text-muted-foreground">
              {inquiry.latestTimeLabel}
            </time>
          </div>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
            {displayInboxText(inquiry.latestNarrative)}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "pragma-scrollbar min-h-0 flex-1 overflow-y-auto p-4",
          activeTab !== "activity" && "hidden",
        )}
      >
        <div className="mx-auto max-w-2xl space-y-3">
          {activityItems.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-border/70 bg-module-pane/60 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
                <time className="text-[11px] tabular-nums text-muted-foreground">
                  {item.timeLabel}
                </time>
              </div>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">
                {displayInboxText(item.narrative)}
              </p>
            </article>
          ))}
          <p className="text-center text-xs text-muted-foreground">
            Cuando el huésped confirme, esta conversación pasará al historial de la reserva.
          </p>
        </div>
      </div>

      {activeTab === "messages" ? (
        <InboxActionBar onCopy={() => void handleCopy()} airbnbHref="https://www.airbnb.com/hosting/inbox" />
      ) : null}
    </div>
  );
}

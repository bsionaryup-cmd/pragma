"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getNovedadesReservationDetailAction, getNovedadesUnlinkedInquiryDetailAction } from "@/features/novedades/actions/novedades.actions";
import { InboxListItem } from "@/features/novedades/components/inbox-list-item";
import { NovedadesUnlinkedInquiryPanel } from "@/features/novedades/components/novedades-unlinked-inquiry-panel";
import { NovedadesTimelinePanel } from "@/features/novedades/components/novedades-timeline-panel";
import {
  buildUnifiedInboxThreads,
  filterUnifiedInboxThreads,
} from "@/features/novedades/lib/inbox-unified-list";
import { moduleShellClasses } from "@/components/layout/module-shell";
import { Input } from "@/components/ui/input";
import type {
  NovedadesInboxListItem as NovedadesInboxListItemType,
  NovedadesReservationDetail,
  NovedadesUnlinkedInquiryItem,
} from "@/services/novedades/novedades-inbox.types";
import { cn } from "@/lib/utils";

type InboxQuickFilter = "all" | "pending";

type NovedadesInboxProps = {
  items: NovedadesInboxListItemType[];
  unlinkedInquiries: NovedadesUnlinkedInquiryItem[];
  initialSelectedId?: string | null;
  initialSelectedInquiryId?: string | null;
};

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}

export function NovedadesInbox({
  items,
  unlinkedInquiries,
  initialSelectedId = null,
  initialSelectedInquiryId = null,
}: NovedadesInboxProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<InboxQuickFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(
    initialSelectedInquiryId,
  );
  const [detail, setDetail] = useState<NovedadesReservationDetail | null>(null);
  const [inquiryDetail, setInquiryDetail] = useState<NovedadesUnlinkedInquiryItem | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const openedInitialRef = useRef(false);

  const unifiedThreads = useMemo(
    () => buildUnifiedInboxThreads({ items, unlinkedInquiries }),
    [items, unlinkedInquiries],
  );

  const filteredThreads = useMemo(
    () =>
      filterUnifiedInboxThreads(unifiedThreads, {
        query,
        pendingOnly: quickFilter === "pending",
      }),
    [unifiedThreads, query, quickFilter],
  );

  const pendingCount = useMemo(
    () => unifiedThreads.filter((thread) => thread.attentionCount > 0).length,
    [unifiedThreads],
  );

  const loadDetail = useCallback(async (reservationId: string) => {
    setDetailLoading(true);
    try {
      const result = await getNovedadesReservationDetailAction(reservationId);
      if (!result.success) {
        toast.error(result.error);
        return null;
      }
      setDetail(result.detail);
      return result.detail;
    } catch {
      toast.error("No se pudo cargar la conversación");
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadInquiryDetail = useCallback(async (pendingActivityId: string) => {
    setDetailLoading(true);
    try {
      const result = await getNovedadesUnlinkedInquiryDetailAction(pendingActivityId);
      if (!result.success) {
        toast.error(result.error);
        return null;
      }
      setInquiryDetail(result.inquiry);
      return result.inquiry;
    } catch {
      toast.error("No se pudo cargar la consulta");
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const selectInquiry = useCallback(
    async (pendingActivityId: string) => {
      setSelectedInquiryId(pendingActivityId);
      setSelectedId(null);
      setDetail(null);
      router.replace(`/novedades?inquiry=${pendingActivityId}`, { scroll: false });
      await loadInquiryDetail(pendingActivityId);
    },
    [loadInquiryDetail, router],
  );

  const selectReservation = useCallback(
    async (reservationId: string) => {
      setSelectedId(reservationId);
      setSelectedInquiryId(null);
      setInquiryDetail(null);
      router.replace(`/novedades?reservation=${reservationId}`, { scroll: false });
      await loadDetail(reservationId);
    },
    [loadDetail, router],
  );

  const selectThread = useCallback(
    (thread: (typeof filteredThreads)[number]) => {
      if (thread.kind === "inquiry") {
        void selectInquiry(thread.threadId);
        return;
      }
      void selectReservation(thread.threadId);
    },
    [selectInquiry, selectReservation],
  );

  useEffect(() => {
    if (openedInitialRef.current) return;
    openedInitialRef.current = true;

    const targetInquiryId =
      initialSelectedInquiryId &&
      unlinkedInquiries.some((item) => item.pendingActivityId === initialSelectedInquiryId)
        ? initialSelectedInquiryId
        : null;

    if (targetInquiryId) {
      void selectInquiry(targetInquiryId);
      return;
    }

    const targetId =
      initialSelectedId && items.some((item) => item.reservationId === initialSelectedId)
        ? initialSelectedId
        : items[0]?.reservationId ?? unlinkedInquiries[0]?.pendingActivityId ?? null;

    if (!targetId) return;

    if (unlinkedInquiries.some((item) => item.pendingActivityId === targetId)) {
      void selectInquiry(targetId);
      return;
    }

    void selectReservation(targetId);
  }, [initialSelectedId, initialSelectedInquiryId, items, unlinkedInquiries, selectInquiry, selectReservation]);

  const showListOnMobile = isMobile && !selectedId && !selectedInquiryId;
  const showDetailOnMobile = isMobile && Boolean(selectedId || selectedInquiryId);

  const isThreadActive = (thread: (typeof filteredThreads)[number]) =>
    thread.kind === "inquiry"
      ? selectedInquiryId === thread.threadId
      : selectedId === thread.threadId;

  return (
    <div className={cn("flex h-full min-h-0 w-full overflow-hidden", moduleShellClasses.canvas)}>
      <aside
        className={cn(
          "flex h-full min-h-0 w-full shrink-0 flex-col border-r border-border md:max-w-[360px] lg:max-w-[400px]",
          moduleShellClasses.paneList,
          showDetailOnMobile && "hidden md:flex",
        )}
      >
        <header className={cn("shrink-0 space-y-3 px-3 py-3", moduleShellClasses.paneHeader)}>
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight">Bandeja de entrada</h1>
            <p className="text-xs text-muted-foreground">
              {filteredThreads.length} conversación
              {filteredThreads.length === 1 ? "" : "es"}
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar huésped o apartamento…"
              className="h-8 pl-8 pr-8 text-sm"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "all" as const, label: "Todas", count: unifiedThreads.length },
                { id: "pending" as const, label: "Pendientes", count: pendingCount },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setQuickFilter(tab.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  quickFilter === tab.id
                    ? "border-primary/25 bg-primary/[0.08] text-foreground"
                    : "border-border/70 bg-module-pane-alt text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.count > 0 ? (
                  <span className="ml-1 tabular-nums text-[10px] opacity-80">{tab.count}</span>
                ) : null}
              </button>
            ))}
          </div>
        </header>

        <div className="pragma-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {filteredThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 px-3 py-12 text-center">
              <p className="text-sm font-medium text-foreground">Sin conversaciones</p>
              <p className="max-w-[240px] text-xs text-muted-foreground">
                {query || quickFilter !== "all"
                  ? "Prueba otra búsqueda o quita el filtro."
                  : "Cuando lleguen mensajes o consultas, aparecerán aquí."}
              </p>
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <InboxListItem
                key={`${thread.kind}-${thread.threadId}`}
                thread={thread}
                isActive={isThreadActive(thread)}
                onSelect={() => selectThread(thread)}
              />
            ))
          )}
        </div>
      </aside>

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          moduleShellClasses.paneDetail,
          showListOnMobile && "hidden md:flex",
        )}
      >
        {selectedInquiryId ? (
          <NovedadesUnlinkedInquiryPanel
            inquiry={inquiryDetail}
            loading={detailLoading}
            onBack={
              isMobile
                ? () => {
                    setSelectedInquiryId(null);
                    setInquiryDetail(null);
                    router.replace("/novedades", { scroll: false });
                  }
                : undefined
            }
          />
        ) : selectedId ? (
          <NovedadesTimelinePanel
            detail={detail}
            loading={detailLoading}
            onBack={
              isMobile
                ? () => {
                    setSelectedId(null);
                    setDetail(null);
                    router.replace("/novedades", { scroll: false });
                  }
                : undefined
            }
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="text-sm font-medium text-foreground">Selecciona una conversación</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Aquí verás mensajes del huésped y la actividad de la reserva, sin ruido ni eventos
              técnicos.
            </p>
            <Link href="/reservations" className="text-xs font-medium text-primary hover:underline">
              Ir al módulo de reservas
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

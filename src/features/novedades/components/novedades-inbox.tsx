"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getNovedadesReservationDetailAction } from "@/features/novedades/actions/novedades.actions";
import { NovedadesInboxListItem } from "@/features/novedades/components/novedades-inbox-list-item";
import { NovedadesTimelinePanel } from "@/features/novedades/components/novedades-timeline-panel";
import { moduleShellClasses } from "@/components/layout/module-shell";
import { Input } from "@/components/ui/input";
import type {
  NovedadesInboxListItem as NovedadesInboxListItemType,
  NovedadesReservationDetail,
} from "@/services/novedades/novedades-inbox.types";
import { cn } from "@/lib/utils";

type InboxQuickFilter = "all" | "messages" | "pending";

type NovedadesInboxProps = {
  items: NovedadesInboxListItemType[];
  initialSelectedId?: string | null;
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
  initialSelectedId = null,
}: NovedadesInboxProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<InboxQuickFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [detail, setDetail] = useState<NovedadesReservationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const openedInitialRef = useRef(false);

  const filtered = useMemo(() => {
    let list = items;

    if (quickFilter === "messages") {
      list = list.filter((item) => item.latestKind === "GUEST_MESSAGE");
    } else if (quickFilter === "pending") {
      list = list.filter((item) => item.attentionCount > 0);
    }

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => {
      return (
        item.guestName.toLowerCase().includes(q) ||
        item.propertyLabel.toLowerCase().includes(q) ||
        item.latestNarrative.toLowerCase().includes(q) ||
        (item.confirmationCode?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, query, quickFilter]);

  const pendingCount = useMemo(
    () => items.filter((item) => item.attentionCount > 0).length,
    [items],
  );
  const messageCount = useMemo(
    () => items.filter((item) => item.latestKind === "GUEST_MESSAGE").length,
    [items],
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
      toast.error("No se pudo cargar la actividad de la reserva");
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const selectReservation = useCallback(
    async (reservationId: string) => {
      setSelectedId(reservationId);
      router.replace(`/novedades?reservation=${reservationId}`, { scroll: false });
      await loadDetail(reservationId);
    },
    [loadDetail, router],
  );

  useEffect(() => {
    if (openedInitialRef.current) return;
    openedInitialRef.current = true;

    const targetId =
      initialSelectedId && items.some((item) => item.reservationId === initialSelectedId)
        ? initialSelectedId
        : items[0]?.reservationId ?? null;

    if (targetId) {
      void selectReservation(targetId);
    }
  }, [initialSelectedId, items, selectReservation]);

  const showListOnMobile = isMobile && !selectedId;
  const showDetailOnMobile = isMobile && Boolean(selectedId);

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
            <h1 className="text-base font-semibold tracking-tight">Novedades</h1>
            <p className="text-xs text-muted-foreground">
              {filtered.length} reserva{filtered.length === 1 ? "" : "s"} con actividad
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar huésped o propiedad…"
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
                { id: "all" as const, label: "Todas", count: items.length },
                { id: "messages" as const, label: "Mensajes", count: messageCount },
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
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 px-3 py-12 text-center">
              <p className="text-sm font-medium text-foreground">Sin actividad</p>
              <p className="max-w-[240px] text-xs text-muted-foreground">
                {query || quickFilter !== "all"
                  ? "Prueba otra búsqueda o quita el filtro."
                  : "Cuando haya reservas, pagos o mensajes importantes, aparecerán aquí."}
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <NovedadesInboxListItem
                key={item.reservationId}
                item={item}
                isActive={selectedId === item.reservationId}
                onSelect={() => void selectReservation(item.reservationId)}
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
        {selectedId ? (
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
            <p className="text-sm font-medium text-foreground">
              Selecciona una reserva
            </p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Aquí verás el historial completo: reserva, pagos, mensajes, registro,
              acceso y tareas — sin ruido ni eventos técnicos.
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

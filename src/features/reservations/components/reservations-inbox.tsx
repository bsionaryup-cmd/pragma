"use client";

import { Filter, Plus, Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getReservationInboxItemAction } from "@/features/reservations/actions/reservation.actions";
import { getReservationInquiryDetailAction } from "@/features/reservations/actions/reservation-inquiry.actions";
import { ReservationCard } from "@/features/reservations/components/reservation-card";
import { ReservationInquiryCard } from "@/features/reservations/components/reservation-inquiry-card";
import { ReservationInquiryPanel } from "@/features/reservations/components/reservation-inquiry-panel";
import type {
  ReservationCreateInitialValues,
} from "@/features/reservations/components/reservation-drawer";
import { sortByUpcomingArrivals } from "@/features/reservations/lib/reservation-sort";
import { formatPropertyLabel, propertyMatchesQuery } from "@/lib/property-display";
import { moduleShellClasses } from "@/components/layout/module-shell";
import { useI18n } from "@/components/providers/i18n-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { subscribeDashboardDataRefresh } from "@/lib/dashboard-refresh";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import type {
  PropertyOption,
  ReservationDetailItem,
  ReservationInboxItem,
  ReservationInquiryInboxItem,
} from "@/features/reservations/types/reservation.types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ReservationSidePanel = dynamic(
  () =>
    import("@/features/reservations/components/reservation-side-panel").then(
      (m) => ({ default: m.ReservationSidePanel }),
    ),
  { loading: () => <div className="h-full min-h-0 w-full bg-background" /> },
);

const ReservationDrawer = dynamic(
  () =>
    import("@/features/reservations/components/reservation-drawer").then(
      (m) => ({ default: m.ReservationDrawer }),
    ),
  { loading: () => null },
);

type InboxPanelMode = "create" | "detail" | "inquiry" | null;

type ReservationsInboxProps = {
  initialReservations: ReservationInboxItem[];
  initialInquiries: ReservationInquiryInboxItem[];
  properties: PropertyOption[];
  canCreate: boolean;
  canWrite: boolean;
  canManageGuestRegistration?: boolean;
  canDelete?: boolean;
  canManagePayments?: boolean;
  openCreateOnMount?: boolean;
  initialSelectedId?: string | null;
  initialSelectedInquiryId?: string | null;
  initialCreateValues?: ReservationCreateInitialValues;
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

export function ReservationsInbox({
  initialReservations,
  initialInquiries,
  properties,
  canCreate,
  canWrite,
  canManageGuestRegistration = canWrite,
  canDelete = false,
  canManagePayments = false,
  openCreateOnMount = false,
  initialSelectedId = null,
  initialSelectedInquiryId = null,
  initialCreateValues,
}: ReservationsInboxProps) {
  const { t } = useI18n();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [pendingReservations, setPendingReservations] = useState<
    ReservationInboxItem[]
  >([]);
  const reservations = useMemo(() => {
    const knownIds = new Set(initialReservations.map((r) => r.id));
    const pending = pendingReservations.filter((r) => !knownIds.has(r.id));
    return sortByUpcomingArrivals([...pending, ...initialReservations]);
  }, [initialReservations, pendingReservations]);

  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [selectedDetail, setSelectedDetail] =
    useState<ReservationDetailItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(
    initialSelectedInquiryId,
  );
  const [selectedInquiry, setSelectedInquiry] =
    useState<ReservationInquiryInboxItem | null>(null);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [drawerMode, setDrawerMode] = useState<InboxPanelMode>(() => {
    if (openCreateOnMount && canCreate) return "create";
    if (initialSelectedInquiryId) return "inquiry";
    if (initialSelectedId) return "detail";
    return null;
  });
  const openedInitialRef = useRef(false);
  const drawerModeRef = useRef(drawerMode);
  const selectedIdRef = useRef(selectedId);

  useEffect(() => {
    drawerModeRef.current = drawerMode;
    selectedIdRef.current = selectedId;
  }, [drawerMode, selectedId]);

  const filteredReservations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reservations.filter((r) => {
      if (propertyFilter !== "all" && r.property.id !== propertyFilter) {
        return false;
      }
      if (!propertyMatchesQuery(r.property, query)) return false;
      if (!q) return true;
      return (
        r.guestName.toLowerCase().includes(q) ||
        r.guestFirstName.toLowerCase().includes(q) ||
        (r.guestLastName?.toLowerCase().includes(q) ?? false) ||
        r.guestEmail?.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [reservations, query, propertyFilter]);

  const filteredInquiries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialInquiries.filter((inquiry) => {
      if (propertyFilter !== "all") {
        const property = properties.find((p) => p.id === propertyFilter);
        if (property) {
          const label = formatPropertyLabel(property).toLowerCase();
          if (!inquiry.propertyLabel.toLowerCase().includes(label)) return false;
        }
      }
      if (!q) return true;
      return (
        inquiry.guestName.toLowerCase().includes(q) ||
        inquiry.propertyLabel.toLowerCase().includes(q) ||
        inquiry.latestNarrative.toLowerCase().includes(q)
      );
    });
  }, [initialInquiries, properties, propertyFilter, query]);

  const filteredCount = filteredReservations.length + filteredInquiries.length;
  const totalCount = reservations.length + initialInquiries.length;

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const result = await getReservationInboxItemAction(id);
      if (!result.success) {
        toast.error(result.error);
        return null;
      }
      setSelectedDetail(result.reservation);
      return result.reservation;
    } catch {
      toast.error("No se pudo cargar la reserva");
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadInquiryDetail = useCallback(async (pendingActivityId: string) => {
    setInquiryLoading(true);
    try {
      const cached = initialInquiries.find(
        (item) => item.pendingActivityId === pendingActivityId,
      );
      if (cached) {
        setSelectedInquiry(cached);
      }
      const result = await getReservationInquiryDetailAction(pendingActivityId);
      if (!result.success) {
        toast.error(result.error);
        return null;
      }
      setSelectedInquiry(result.inquiry);
      return result.inquiry;
    } catch {
      toast.error("No se pudo cargar la consulta");
      return null;
    } finally {
      setInquiryLoading(false);
    }
  }, [initialInquiries]);

  const openInquiry = useCallback(
    async (pendingActivityId: string) => {
      setSelectedId(null);
      setSelectedDetail(null);
      setSelectedInquiryId(pendingActivityId);
      setDrawerMode("inquiry");
      router.replace(`/reservations?inquiry=${pendingActivityId}`, { scroll: false });
      await loadInquiryDetail(pendingActivityId);
    },
    [loadInquiryDetail, router],
  );

  const openDetail = useCallback(
    async (id: string) => {
      setSelectedInquiryId(null);
      setSelectedInquiry(null);
      setSelectedId(id);
      setDrawerMode("detail");
      router.replace(`/reservations?reservation=${id}`, { scroll: false });
      await loadDetail(id);
    },
    [loadDetail, router],
  );

  useEffect(() => {
    if (initialSelectedInquiryId && !openedInitialRef.current) {
      openedInitialRef.current = true;
      void openInquiry(initialSelectedInquiryId);
      return;
    }
    if (!initialSelectedId || openedInitialRef.current) return;
    openedInitialRef.current = true;
    void openDetail(initialSelectedId);
  }, [initialSelectedId, initialSelectedInquiryId, openDetail, openInquiry]);

  useEffect(() => {
    return subscribeDashboardDataRefresh(() => {
      if (drawerModeRef.current !== "detail") return;
      const id = selectedIdRef.current;
      if (!id) return;
      void loadDetail(id);
    });
  }, [loadDetail]);

  function openCreate() {
    setSelectedId(null);
    setSelectedDetail(null);
    setSelectedInquiryId(null);
    setSelectedInquiry(null);
    setDrawerMode("create");
  }

  function closePanel() {
    setDrawerMode(null);
    setSelectedDetail(null);
    setSelectedInquiryId(null);
    setSelectedInquiry(null);
    router.replace("/reservations", { scroll: false });
  }

  function handleCreated(reservation: ReservationInboxItem) {
    setPendingReservations((prev) => [reservation, ...prev]);
    setSelectedId(reservation.id);
    setDrawerMode("detail");
    router.replace(`/reservations?reservation=${reservation.id}`, { scroll: false });
    void loadDetail(reservation.id);
    router.refresh();
  }

  function handleUpdated(reservation: ReservationDetailItem) {
    setSelectedDetail(reservation);
    router.refresh();
  }

  function handleDeleted(id: string) {
    setPendingReservations((prev) => prev.filter((r) => r.id !== id));
    setSelectedId(null);
    setSelectedDetail(null);
    setDrawerMode(null);
    router.replace("/reservations", { scroll: false });
  }

  const hasActiveFilters = propertyFilter !== "all" || query.trim().length > 0;

  return (
    <>
      <div className={cn("flex h-full min-h-0 w-full overflow-hidden", moduleShellClasses.canvas)}>
        <aside className={cn("relative flex h-full w-full min-w-0 shrink-0 flex-col border-r border-border md:max-w-[360px] lg:max-w-[380px]", moduleShellClasses.paneList)}>
          <header className={cn("shrink-0 space-y-3 px-3 py-3", moduleShellClasses.paneHeader)}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-base font-semibold tracking-tight">
                  {t("reservations.moduleTitle")}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {filteredCount} de {totalCount} · reservas y consultas
                </p>
              </div>
              {canCreate ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 shrink-0 gap-1 px-2.5 md:hidden"
                  onClick={openCreate}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva
                </Button>
              ) : null}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
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

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 flex-1 justify-start gap-1.5 text-xs font-normal",
                  hasActiveFilters && "border-pragma-electric/40 text-pragma-electric",
                )}
                onClick={() => setShowFilters((v) => !v)}
              >
                <Filter className="h-3.5 w-3.5" />
                {propertyFilter === "all"
                  ? "Todas las propiedades"
                  : formatPropertyLabel(
                      properties.find((p) => p.id === propertyFilter) ?? {
                        name: "Propiedad",
                        unitNumber: null,
                      },
                    )}
              </Button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setPropertyFilter("all");
                  }}
                  className="shrink-0 text-xs text-pragma-electric hover:underline"
                >
                  Limpiar
                </button>
              ) : null}
            </div>

            {showFilters ? (
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Propiedad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las propiedades</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {formatPropertyLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </header>

          <div className="pragma-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {filteredCount === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 px-3 py-12 text-center">
                <p className="text-sm font-medium text-foreground">Sin resultados</p>
                <p className="max-w-[220px] text-xs text-muted-foreground">
                  {hasActiveFilters
                    ? "Prueba otra búsqueda o quita los filtros."
                    : canCreate
                      ? "Crea la primera reserva con el botón de abajo."
                      : "No hay reservas ni consultas en el listado."}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredInquiries.map((inquiry) => (
                  <ReservationInquiryCard
                    key={inquiry.pendingActivityId}
                    inquiry={inquiry}
                    isActive={
                      selectedInquiryId === inquiry.pendingActivityId &&
                      drawerMode === "inquiry"
                    }
                    onSelect={() => void openInquiry(inquiry.pendingActivityId)}
                  />
                ))}
                {filteredReservations.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    isActive={
                      selectedId === reservation.id && drawerMode === "detail"
                    }
                    onSelect={() => void openDetail(reservation.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {canCreate ? (
            <footer className={cn("hidden shrink-0 border-t border-border p-3 md:block", moduleShellClasses.paneList)}>
              <Button type="button" className="h-10 w-full gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Crear reserva
              </Button>
            </footer>
          ) : null}
        </aside>

        <div className={cn("hidden min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden md:flex", moduleShellClasses.paneDetail)}>
          {drawerMode === "inquiry" ? (
            <ReservationInquiryPanel
              inquiry={selectedInquiry}
              loading={inquiryLoading}
            />
          ) : drawerMode ? (
            <ReservationSidePanel
              mode={drawerMode === "create" ? "create" : "detail"}
              reservation={selectedDetail}
              properties={properties}
              canWrite={canWrite}
              canManageGuestRegistration={canManageGuestRegistration}
              canDelete={canDelete}
              canManagePayments={canManagePayments}
              initialCreateValues={initialCreateValues}
              onClose={closePanel}
              onCreated={handleCreated}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
              detailLoading={detailLoading}
              showHeader={drawerMode === "create"}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Selecciona una reserva o consulta
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                El detalle aparece aquí: mensajes, fechas, registro y cobro.
              </p>
            </div>
          )}
        </div>
      </div>

      {isMobile ? (
        drawerMode === "inquiry" ? (
          <Sheet open onOpenChange={(isOpen) => !isOpen && closePanel()}>
            <SheetContent
              side="right"
              showCloseButton
              className="flex w-full flex-col gap-0 border-l border-border p-0 sm:max-w-[min(100%,480px)]"
            >
              <ReservationInquiryPanel
                inquiry={selectedInquiry}
                loading={inquiryLoading}
                onBack={closePanel}
              />
            </SheetContent>
          </Sheet>
        ) : (
          <ReservationDrawer
            open={drawerMode !== null}
            mode={drawerMode === "create" ? "create" : drawerMode === "detail" ? "detail" : null}
            reservation={selectedDetail}
            properties={properties}
            canWrite={canWrite}
            canManageGuestRegistration={canManageGuestRegistration}
            canDelete={canDelete}
            canManagePayments={canManagePayments}
            initialCreateValues={initialCreateValues}
            onClose={closePanel}
            onCreated={handleCreated}
            onDeleted={handleDeleted}
            detailLoading={detailLoading}
            onUpdated={handleUpdated}
          />
        )
      ) : null}
    </>
  );
}

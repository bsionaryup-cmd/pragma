"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getReservationInboxItemAction } from "@/features/reservations/actions/reservation.actions";
import { CALENDAR_DAY_WIDTH } from "@/features/calendar/constants";
import { CalendarDayHeader } from "@/features/calendar/components/calendar-day-header";
import { CalendarGrid } from "@/features/calendar/components/calendar-grid";
import { CalendarToolbar } from "@/features/calendar/components/calendar-toolbar";
import { PropertySidebar } from "@/features/calendar/components/property-sidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { groupReservationsByProperty } from "@/features/calendar/lib/reservation-span";
import type {
  CalendarDataDto,
  CalendarDateSelection,
  CalendarReservationDto,
} from "@/features/calendar/types/calendar.types";
import {
  type ReservationDrawerMode,
} from "@/features/reservations/components/reservation-drawer";
import type {
  PropertyOption,
  ReservationDetailItem,
  ReservationInboxItem,
} from "@/features/reservations/types/reservation.types";

const ReservationDrawer = dynamic(
  () =>
    import("@/features/reservations/components/reservation-drawer").then((m) => ({
      default: m.ReservationDrawer,
    })),
  { loading: () => null },
);

type MultiCalendarProps = {
  data: CalendarDataDto;
  canWrite: boolean;
  canManageGuestRegistration?: boolean;
  canSyncAirbnb: boolean;
  propertyOptions: PropertyOption[];
  /** Abre detalle al montar (p. ej. /calendar?reservation=id) sin ir a /reservations */
  initialReservationId?: string | null;
};

export function MultiCalendar({
  data,
  canWrite,
  canManageGuestRegistration = canWrite,
  canSyncAirbnb,
  propertyOptions,
  initialReservationId = null,
}: MultiCalendarProps) {
  const viewport = data.viewport;
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<CalendarDateSelection | null>(null);
  const [drawerMode, setDrawerMode] = useState<ReservationDrawerMode>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<ReservationDetailItem | null>(null);
  const [calendarReservations, setCalendarReservations] = useState<
    CalendarReservationDto[] | null
  >(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{
    propertyId: string;
    checkIn: string;
    checkOut: string;
  } | null>(null);
  const [propertyPanelOpen, setPropertyPanelOpen] = useState(false);

  const gridScrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const scrolledRef = useRef<string | null>(null);
  const openedInitialReservationRef = useRef(false);

  const filteredProperties = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.properties;
    return data.properties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q),
    );
  }, [data.properties, search]);

  const visibleReservations = calendarReservations ?? data.reservations;

  const reservationsByProperty = useMemo(
    () => groupReservationsByProperty(visibleReservations),
    [visibleReservations],
  );

  useEffect(() => {
    if (scrolledRef.current === viewport.anchor) return;
    const targetIdx = viewport.days.findIndex((d) => d.date === viewport.anchor);
    if (targetIdx < 0) return;

    const grid = gridScrollRef.current;
    const header = headerScrollRef.current;
    if (!grid) return;

    const scrollLeft = Math.max(
      0,
      targetIdx * CALENDAR_DAY_WIDTH - grid.clientWidth * 0.12,
    );

    requestAnimationFrame(() => {
      grid.scrollLeft = scrollLeft;
      if (header) header.scrollLeft = scrollLeft;
      scrolledRef.current = viewport.anchor;
    });
  }, [viewport.anchor, viewport.days]);

  const syncFromGrid = useCallback(() => {
    if (syncingRef.current) return;
    const grid = gridScrollRef.current;
    if (!grid) return;

    syncingRef.current = true;
    if (sidebarScrollRef.current) {
      sidebarScrollRef.current.scrollTop = grid.scrollTop;
    }
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = grid.scrollLeft;
    }
    syncingRef.current = false;
  }, []);

  const syncFromSidebar = useCallback(() => {
    if (syncingRef.current) return;
    const sidebar = sidebarScrollRef.current;
    const grid = gridScrollRef.current;
    if (!sidebar || !grid) return;

    syncingRef.current = true;
    grid.scrollTop = sidebar.scrollTop;
    syncingRef.current = false;
  }, []);

  const syncFromHeader = useCallback(() => {
    if (syncingRef.current) return;
    const header = headerScrollRef.current;
    const grid = gridScrollRef.current;
    if (!header || !grid) return;

    syncingRef.current = true;
    grid.scrollLeft = header.scrollLeft;
    syncingRef.current = false;
  }, []);

  const handleDayClick = useCallback(
    (propertyId: string, dateKey: string) => {
      if (!canWrite) {
        toast.error(
          "Modo restringido o sin permiso: no puedes crear reservas. Ve a Facturación.",
        );
        return;
      }

      if (
        !selection ||
        selection.propertyId !== propertyId ||
        (selection.checkOut !== null && selection.checkOut !== undefined)
      ) {
        setSelection({ propertyId, checkIn: dateKey, checkOut: null });
        return;
      }

      const checkIn = selection.checkIn;
      if (dateKey <= checkIn) {
        setSelection({ propertyId, checkIn: dateKey, checkOut: null });
        return;
      }

      setCreateDefaults({ propertyId, checkIn, checkOut: dateKey });
      setSelection(null);
      setDrawerMode("create");
    },
    [canWrite, selection],
  );

  function closeDrawer() {
    setDrawerMode(null);
    setSelectedReservation(null);
    setDetailLoading(false);
    setCreateDefaults(null);
    setSelection(null);
  }

  const openReservationDetail = useCallback(async (reservationId: string) => {
    // Siempre en calendario: drawer lateral, sin cambiar ruta ni ir a /reservations
    setDrawerMode("detail");
    setSelectedReservation(null);
    setDetailLoading(true);
    setCreateDefaults(null);
    setSelection(null);

    try {
      const result = await getReservationInboxItemAction(reservationId);
      if (!result.success) {
        toast.error(result.error);
        closeDrawer();
        return;
      }
      setSelectedReservation(result.reservation);
    } catch {
      toast.error("No se pudo cargar la reserva");
      closeDrawer();
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialReservationId || openedInitialReservationRef.current) return;
    openedInitialReservationRef.current = true;
    void openReservationDetail(initialReservationId);
  }, [initialReservationId, openReservationDetail]);

  function inboxToCalendarBar(
    reservation: ReservationInboxItem,
  ): CalendarReservationDto {
    return {
      id: reservation.id,
      propertyId: reservation.property.id,
      guestName: reservation.guestName,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      status: reservation.status,
      totalAmount: reservation.totalAmount,
      currency: reservation.currency,
      platform: reservation.platform,
    };
  }

  function handleCreated(reservation: ReservationInboxItem) {
    const bar = inboxToCalendarBar(reservation);
    setCalendarReservations((prev) => [...(prev ?? data.reservations), bar]);
    closeDrawer();
  }

  function handleDeleted(id: string) {
    setCalendarReservations((prev) =>
      (prev ?? data.reservations).filter((r) => r.id !== id),
    );
    closeDrawer();
  }

  return (
    <div className="cal-module flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--cal-bg-canvas)]">
      <CalendarToolbar
        viewport={viewport}
        canSyncAirbnb={canSyncAirbnb}
        showPropertiesToggle
        onToggleProperties={() => setPropertyPanelOpen(true)}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden h-full shrink-0 lg:flex">
          <PropertySidebar
            properties={filteredProperties}
            search={search}
            onSearchChange={setSearch}
            scrollRef={sidebarScrollRef}
            onScroll={syncFromSidebar}
          />
        </div>

        <div className="calendar-workspace flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-20 shrink-0 border-b border-[var(--cal-border)] bg-white">
            <CalendarDayHeader
              days={viewport.days}
              gridWidth={viewport.gridWidth}
              scrollRef={headerScrollRef}
              onScroll={syncFromHeader}
            />
          </div>

          <CalendarGrid
            properties={filteredProperties}
            reservationsByProperty={reservationsByProperty}
            days={viewport.days}
            rangeStart={viewport.rangeStart}
            gridWidth={viewport.gridWidth}
            scrollRef={gridScrollRef}
            onScroll={syncFromGrid}
            canWrite={canWrite}
            selection={selection}
            onDayClick={handleDayClick}
            onReservationClick={openReservationDetail}
          />
        </div>
      </div>

      {canWrite ? (
        <div className="shrink-0 border-t border-[var(--cal-border)] bg-white px-3 py-2 text-[11px] text-[var(--cal-text-secondary)] sm:px-4">
          {selection?.checkOut === null ? (
            <span>
              1.er clic: entrada ({selection.checkIn}). Elige la fecha de salida
              en la misma propiedad.
            </span>
          ) : (
            <span>
              Haz dos clics en una fila para crear una reserva (entrada → salida).
            </span>
          )}
        </div>
      ) : null}

      <ReservationDrawer
        open={drawerMode !== null}
        mode={drawerMode}
        reservation={drawerMode === "detail" ? selectedReservation : null}
        properties={propertyOptions}
        canWrite={canWrite}
        canManageGuestRegistration={canManageGuestRegistration}
        initialCreateValues={createDefaults ?? undefined}
        detailLoading={detailLoading}
        refreshAfterDelete={false}
        onClose={closeDrawer}
        onCreated={handleCreated}
        onDeleted={handleDeleted}
      />

      <Sheet open={propertyPanelOpen} onOpenChange={setPropertyPanelOpen}>
        <SheetContent side="left" className="w-[min(100vw,300px)] gap-0 p-0 sm:max-w-[300px]">
          <SheetTitle className="sr-only">Propiedades del calendario</SheetTitle>
          <PropertySidebar
            properties={filteredProperties}
            search={search}
            onSearchChange={setSearch}
            scrollRef={sidebarScrollRef}
            onScroll={syncFromSidebar}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

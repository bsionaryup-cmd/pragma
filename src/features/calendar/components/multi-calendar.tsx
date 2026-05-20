"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getReservationInboxItemAction } from "@/features/reservations/actions/reservation.actions";
import { CALENDAR_DAY_WIDTH } from "@/features/calendar/constants";
import { CalendarDayHeader } from "@/features/calendar/components/calendar-day-header";
import { CalendarGrid } from "@/features/calendar/components/calendar-grid";
import { CalendarToolbar } from "@/features/calendar/components/calendar-toolbar";
import { PropertySidebar } from "@/features/calendar/components/property-sidebar";
import { groupReservationsByProperty } from "@/features/calendar/lib/reservation-span";
import type {
  CalendarDataDto,
  CalendarDateSelection,
} from "@/features/calendar/types/calendar.types";
import {
  ReservationDrawer,
  type ReservationDrawerMode,
} from "@/features/reservations/components/reservation-drawer";
import type {
  PropertyOption,
  ReservationInboxItem,
} from "@/features/reservations/types/reservation.types";

type MultiCalendarProps = {
  data: CalendarDataDto;
  canWrite: boolean;
  canSyncAirbnb: boolean;
  propertyOptions: PropertyOption[];
};

export function MultiCalendar({
  data,
  canWrite,
  canSyncAirbnb,
  propertyOptions,
}: MultiCalendarProps) {
  const router = useRouter();
  const viewport = data.viewport;
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<CalendarDateSelection | null>(null);
  const [drawerMode, setDrawerMode] = useState<ReservationDrawerMode>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<ReservationInboxItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{
    propertyId: string;
    checkIn: string;
    checkOut: string;
  } | null>(null);

  const gridScrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const scrolledRef = useRef<string | null>(null);

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

  const reservationsByProperty = useMemo(
    () => groupReservationsByProperty(data.reservations),
    [data.reservations],
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
      if (!canWrite) return;

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

  function handleCreated(_reservation: ReservationInboxItem) {
    closeDrawer();
    router.refresh();
  }

  function handleDeleted(_id: string) {
    closeDrawer();
    router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-background">
      <CalendarToolbar viewport={viewport} canSyncAirbnb={canSyncAirbnb} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <PropertySidebar
          properties={filteredProperties}
          search={search}
          onSearchChange={setSearch}
          scrollRef={sidebarScrollRef}
          onScroll={syncFromSidebar}
        />

        <div className="calendar-workspace flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-background">
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
        <div className="shrink-0 border-t border-[#E9ECEF] bg-white px-4 py-2 text-[11px] text-[#6B7280] dark:border-border dark:bg-card dark:text-muted-foreground">
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
        initialCreateValues={createDefaults ?? undefined}
        detailLoading={detailLoading}
        onClose={closeDrawer}
        onCreated={handleCreated}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

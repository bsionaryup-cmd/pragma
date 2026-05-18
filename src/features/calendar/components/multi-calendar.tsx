"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    setCreateDefaults(null);
    setSelection(null);
  }

  function handleCreated(_reservation: ReservationInboxItem) {
    closeDrawer();
    router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <CalendarToolbar viewport={viewport} canSyncAirbnb={canSyncAirbnb} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <PropertySidebar
          properties={filteredProperties}
          search={search}
          onSearchChange={setSearch}
          scrollRef={sidebarScrollRef}
          onScroll={syncFromSidebar}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
          />
        </div>
      </div>

      {canWrite ? (
        <div className="shrink-0 border-t border-border bg-muted/20 px-4 py-1.5 text-[10px] text-muted-foreground">
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
        open={drawerMode === "create"}
        mode={drawerMode}
        reservation={null}
        properties={propertyOptions}
        canWrite={canWrite}
        initialCreateValues={createDefaults ?? undefined}
        onClose={closeDrawer}
        onCreated={handleCreated}
        onDeleted={() => {}}
      />
    </div>
  );
}

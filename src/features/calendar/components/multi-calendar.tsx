"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getReservationInboxItemAction } from "@/features/reservations/actions/reservation.actions";
import { subscribeDashboardDataRefresh } from "@/lib/dashboard-refresh";
import { CALENDAR_DAY_WIDTH } from "@/features/calendar/constants";
import { CalendarDayHeader } from "@/features/calendar/components/calendar-day-header";
import { CalendarGrid } from "@/features/calendar/components/calendar-grid";
import { CalendarToolbar } from "@/features/calendar/components/calendar-toolbar";
import { PropertySidebar } from "@/features/calendar/components/property-sidebar";
import { CalendarCreateBudgetDialog } from "@/features/calendar/components/calendar-create-budget-dialog";
import { CalendarViewSettingsDialog } from "@/features/calendar/components/calendar-view-settings-dialog";
import {
  applyWeekStartsOnToDays,
  loadCalendarViewSettings,
  saveCalendarViewSettings,
  type CalendarViewSettings,
} from "@/features/calendar/lib/calendar-view-settings";
import {
  addDaysToKey,
  resolveMonthFromScrollLeft,
  getTodayKey,
} from "@/features/calendar/lib/calendar-dates";
import { sumBudgetReservationTotal } from "@/features/calendar/lib/daily-pricing";
import {
  clampSelectableCheckOut,
  findStayRangeConflict,
  formatCalendarStayConflictMessage,
  isNightUnavailable,
  isStayRangeAvailable,
} from "@/features/calendar/lib/stay-availability";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { groupReservationsByProperty } from "@/features/calendar/lib/reservation-span";
import type {
  CalendarDataDto,
  CalendarDateSelection,
  CalendarReservationDto,
} from "@/features/calendar/types/calendar.types";
import {
  type ReservationCreateInitialValues,
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
  canManagePayments?: boolean;
  propertyOptions: PropertyOption[];
  /** Abre detalle al montar (p. ej. /calendar?reservation=id) sin ir a /reservations */
  initialReservationId?: string | null;
};

export function MultiCalendar({
  data,
  canWrite,
  canManageGuestRegistration = canWrite,
  canManagePayments = false,
  propertyOptions,
  initialReservationId = null,
}: MultiCalendarProps) {
  const router = useRouter();
  const viewport = data.viewport;
  const [search, setSearch] = useState("");
  const [displayMonth, setDisplayMonth] = useState(() => ({
    year: data.viewport.year,
    month: data.viewport.month,
  }));
  const [selection, setSelection] = useState<CalendarDateSelection | null>(null);
  const [selectionHoverDate, setSelectionHoverDate] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<ReservationDrawerMode>(null);
  const [selectedReservation, setSelectedReservation] =
    useState<ReservationDetailItem | null>(null);
  const [calendarReservations, setCalendarReservations] = useState<
    CalendarReservationDto[] | null
  >(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createDefaults, setCreateDefaults] =
    useState<ReservationCreateInitialValues | null>(null);
  const [pendingCreate, setPendingCreate] = useState<{
    propertyId: string;
    checkIn: string;
    checkOut: string;
  } | null>(null);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false);
  const [viewSettings, setViewSettings] = useState<CalendarViewSettings>(
    loadCalendarViewSettings,
  );
  const [propertyPanelOpen, setPropertyPanelOpen] = useState(false);

  const gridScrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const gridScrollRafRef = useRef<number | null>(null);
  const scrolledRef = useRef<string | null>(null);
  const extendingViewportRef = useRef(false);
  const openedInitialReservationRef = useRef(false);
  const drawerModeRef = useRef<ReservationDrawerMode>(null);
  const selectedReservationIdRef = useRef<string | null>(null);

  useEffect(() => {
    drawerModeRef.current = drawerMode;
    selectedReservationIdRef.current = selectedReservation?.id ?? null;
  }, [drawerMode, selectedReservation?.id]);

  useEffect(() => {
    extendingViewportRef.current = false;
  }, [viewport.anchor, viewport.rangeEnd]);

  const filteredProperties = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.properties;
    return data.properties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.unitNumber?.toLowerCase().includes(q) ?? false) ||
        p.address.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q),
    );
  }, [data.properties, search]);

  const visibleReservations = calendarReservations ?? data.reservations;

  const serverReservationsKey = useMemo(
    () =>
      data.reservations
        .map((r) => `${r.id}:${r.guestName}:${r.status}:${r.checkIn}`)
        .join("|"),
    [data.reservations],
  );

  useEffect(() => {
    queueMicrotask(() => setCalendarReservations(null));
  }, [serverReservationsKey]);

  const reservationsByProperty = useMemo(
    () => groupReservationsByProperty(visibleReservations),
    [visibleReservations],
  );

  const displayDays = useMemo(
    () => applyWeekStartsOnToDays(viewport.days, viewSettings.weekStartsOn),
    [viewport.days, viewSettings.weekStartsOn],
  );

  function handleSaveViewSettings(settings: CalendarViewSettings) {
    setViewSettings(settings);
    saveCalendarViewSettings(settings);
  }

  const pendingBudgetTotal = useMemo(() => {
    if (!pendingCreate) return 0;
    const property = data.properties.find((p) => p.id === pendingCreate.propertyId);
    if (!property) return 0;
    return sumBudgetReservationTotal(
      property.dailyPricesByDate,
      pendingCreate.checkIn,
      pendingCreate.checkOut,
      property.cleaningFee,
    );
  }, [pendingCreate, data.properties]);

  function openCreateDrawer(values: ReservationCreateInitialValues) {
    setCreateDefaults(values);
    setDrawerMode("create");
  }

  function closeBudgetDialog() {
    setBudgetDialogOpen(false);
    setPendingCreate(null);
  }

  function handleChooseWithBudget() {
    if (pendingCreate) {
      const property = data.properties.find((p) => p.id === pendingCreate.propertyId);
      const totalAmount = property
        ? sumBudgetReservationTotal(
            property.dailyPricesByDate,
            pendingCreate.checkIn,
            pendingCreate.checkOut,
            property.cleaningFee,
          )
        : 0;
      openCreateDrawer({
        ...pendingCreate,
        totalAmount,
        clearTotalAmount: false,
        lockTotalAmount: true,
      });
    } else {
      openCreateDrawer({ clearTotalAmount: false, lockTotalAmount: true });
    }
    setBudgetDialogOpen(false);
    setPendingCreate(null);
  }

  function handleChooseWithoutBudget() {
    if (pendingCreate) {
      openCreateDrawer({
        ...pendingCreate,
        clearTotalAmount: true,
      });
    } else {
      openCreateDrawer({ clearTotalAmount: true });
    }
    setBudgetDialogOpen(false);
    setPendingCreate(null);
  }

  function handleToolbarCreateClick() {
    if (!canWrite) {
      toast.error(
        "Modo restringido o sin permiso: no puedes crear reservas. Ve a Mi Suscripción.",
      );
      return;
    }
    setSelection(null);
    setSelectionHoverDate(null);
    setPendingCreate(null);
    setBudgetDialogOpen(true);
  }

  useEffect(() => {
    queueMicrotask(() => {
      setDisplayMonth({ year: viewport.year, month: viewport.month });
    });
  }, [viewport.anchor, viewport.year, viewport.month]);

  const updateDisplayMonth = useCallback(
    (scrollLeft: number) => {
      const next = resolveMonthFromScrollLeft(scrollLeft, viewport.days);
      setDisplayMonth((prev) =>
        prev.year === next.year && prev.month === next.month ? prev : next,
      );
    },
    [viewport.days],
  );

  const applyCalendarScrollLeft = useCallback(
    (scrollLeft: number) => {
      const grid = gridScrollRef.current;
      if (!grid) return false;

      syncingRef.current = true;
      grid.scrollLeft = scrollLeft;
      if (headerScrollRef.current) {
        headerScrollRef.current.scrollLeft = scrollLeft;
      }
      syncingRef.current = false;
      updateDisplayMonth(scrollLeft);
      return Math.abs(grid.scrollLeft - scrollLeft) <= 2;
    },
    [updateDisplayMonth],
  );

  const scrollToDate = useCallback(
    (dateKey: string) => {
      const targetIdx = viewport.days.findIndex((d) => d.date === dateKey);
      if (targetIdx < 0) return false;

      return applyCalendarScrollLeft(targetIdx * CALENDAR_DAY_WIDTH);
    },
    [viewport.days, applyCalendarScrollLeft],
  );

  const handleGoToToday = useCallback(() => {
    const today = getTodayKey();
    if (scrollToDate(today)) return;
    scrolledRef.current = null;
    router.push("/calendar");
  }, [router, scrollToDate]);

  useLayoutEffect(() => {
    const today = getTodayKey();
    const scrollDate = viewport.anchor === today ? today : viewport.anchor;
    const scrollSessionKey = `${viewport.anchor}:${scrollDate}`;
    if (scrolledRef.current === scrollSessionKey) return;

    const targetIdx = viewport.days.findIndex((d) => d.date === scrollDate);
    if (targetIdx < 0) return;

    const scrollLeft = targetIdx * CALENDAR_DAY_WIDTH;
    const grid = gridScrollRef.current;
    if (!grid) return;

    let cancelled = false;

    const tryScroll = () => {
      if (cancelled) return true;
      if (grid.scrollWidth < viewport.gridWidth - 1) return false;
      if (applyCalendarScrollLeft(scrollLeft)) {
        scrolledRef.current = scrollSessionKey;
        return true;
      }
      return false;
    };

    if (tryScroll()) return;

    const observer = new ResizeObserver(() => {
      if (tryScroll()) observer.disconnect();
    });
    observer.observe(grid);

    let frames = 0;
    const tick = () => {
      if (cancelled || tryScroll() || frames++ >= 30) {
        observer.disconnect();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [
    viewport.anchor,
    viewport.days,
    viewport.gridWidth,
    filteredProperties.length,
    applyCalendarScrollLeft,
  ]);

  const syncFromGrid = useCallback(() => {
    if (syncingRef.current || gridScrollRafRef.current !== null) return;
    gridScrollRafRef.current = requestAnimationFrame(() => {
      gridScrollRafRef.current = null;
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
      updateDisplayMonth(grid.scrollLeft);

      const maxScroll = Math.max(0, grid.scrollWidth - grid.clientWidth - 4);
      if (
        maxScroll > 0 &&
        grid.scrollLeft >= maxScroll - CALENDAR_DAY_WIDTH * 3 &&
        !extendingViewportRef.current
      ) {
        extendingViewportRef.current = true;
        const nextAnchor = addDaysToKey(viewport.rangeEnd, 28);
        router.push(`/calendar?anchor=${encodeURIComponent(nextAnchor)}`);
      }

      syncingRef.current = false;
    });
  }, [updateDisplayMonth, router, viewport.rangeEnd]);

  useEffect(() => {
    return () => {
      if (gridScrollRafRef.current !== null) {
        cancelAnimationFrame(gridScrollRafRef.current);
      }
    };
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

  const getPropertyStays = useCallback(
    (propertyId: string) => reservationsByProperty.get(propertyId) ?? [],
    [reservationsByProperty],
  );

  const isPropertyNightBooked = useCallback(
    (propertyId: string, dateKey: string) => {
      const property = data.properties.find((p) => p.id === propertyId);
      return property?.dailyPricesByDate[dateKey]?.isBooked ?? false;
    },
    [data.properties],
  );

  const handleDayHover = useCallback(
    (propertyId: string, dateKey: string | null) => {
      if (!selection || selection.checkOut !== null) return;
      if (dateKey === null || propertyId !== selection.propertyId) {
        setSelectionHoverDate(null);
        return;
      }

      const stays = getPropertyStays(propertyId);
      const isNightBooked = (night: string) =>
        isPropertyNightBooked(propertyId, night);

      if (
        isNightUnavailable(dateKey, stays, isNightBooked(dateKey)) &&
        !isStayRangeAvailable(selection.checkIn, dateKey, stays, isNightBooked)
      ) {
        const clamped = clampSelectableCheckOut(
          selection.checkIn,
          dateKey,
          stays,
          isNightBooked,
        );
        setSelectionHoverDate(clamped);
        return;
      }

      const clamped = clampSelectableCheckOut(
        selection.checkIn,
        dateKey,
        stays,
        isNightBooked,
      );
      setSelectionHoverDate(clamped ?? dateKey);
    },
    [getPropertyStays, isPropertyNightBooked, selection],
  );

  const handleDayClick = useCallback(
    (propertyId: string, dateKey: string) => {
      if (!canWrite) {
        toast.error(
          "Modo restringido o sin permiso: no puedes crear reservas. Ve a Mi Suscripción.",
        );
        return;
      }

      const stays = getPropertyStays(propertyId);
      const isNightBooked = (night: string) =>
        isPropertyNightBooked(propertyId, night);

      const isCompletingRange =
        selection != null &&
        selection.propertyId === propertyId &&
        selection.checkOut === null &&
        dateKey > selection.checkIn;

      if (
        !isCompletingRange &&
        isNightUnavailable(dateKey, stays, isNightBooked(dateKey))
      ) {
        toast.error("No disponible: esa fecha ya está ocupada o bloqueada.");
        return;
      }

      if (
        !selection ||
        selection.propertyId !== propertyId ||
        (selection.checkOut !== null && selection.checkOut !== undefined)
      ) {
        setSelectionHoverDate(null);
        setSelection({ propertyId, checkIn: dateKey, checkOut: null });
        return;
      }

      const checkIn = selection.checkIn;
      if (dateKey === checkIn && selection.checkOut === null) {
        setSelectionHoverDate(null);
        setSelection(null);
        return;
      }

      if (dateKey <= checkIn) {
        if (isNightUnavailable(dateKey, stays, isNightBooked(dateKey))) {
          toast.error("No disponible: esa fecha ya está ocupada o bloqueada.");
          return;
        }
        setSelectionHoverDate(null);
        setSelection({ propertyId, checkIn: dateKey, checkOut: null });
        return;
      }

      const checkOut = dateKey;
      if (
        !isStayRangeAvailable(checkIn, checkOut, stays, isNightBooked)
      ) {
        const conflict = findStayRangeConflict(checkIn, checkOut, stays);
        if (conflict) {
          toast.error(formatCalendarStayConflictMessage(conflict));
        } else {
          toast.error(
            "No disponible: el rango incluye fechas ocupadas o sincronizadas desde OTA.",
          );
        }
        setSelectionHoverDate(null);
        setSelection(null);
        return;
      }

      setSelectionHoverDate(null);
      setSelection(null);
      setPendingCreate({ propertyId, checkIn, checkOut });
      setBudgetDialogOpen(true);
    },
    [canWrite, getPropertyStays, isPropertyNightBooked, selection],
  );

  function closeDrawer() {
    setDrawerMode(null);
    setSelectedReservation(null);
    setDetailLoading(false);
    setCreateDefaults(null);
    setSelection(null);
    setSelectionHoverDate(null);
  }

  const openReservationDetail = useCallback(async (reservationId: string) => {
    // Siempre en calendario: drawer lateral, sin cambiar ruta ni ir a /reservations
    setDrawerMode("detail");
    setSelectedReservation(null);
    setDetailLoading(true);
    setCreateDefaults(null);
    setSelection(null);
    setSelectionHoverDate(null);

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

  useEffect(() => {
    return subscribeDashboardDataRefresh(() => {
      if (drawerModeRef.current !== "detail") return;
      const reservationId = selectedReservationIdRef.current;
      if (!reservationId) return;

      void (async () => {
        const result = await getReservationInboxItemAction(reservationId);
        if (result.success) {
          setSelectedReservation(result.reservation);
        }
      })();
    });
  }, []);

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
    <div className="cal-module flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <CalendarToolbar
        viewport={viewport}
        displayYear={displayMonth.year}
        displayMonth={displayMonth.month}
        showPropertiesToggle
        onToggleProperties={() => setPropertyPanelOpen(true)}
        canCreate={canWrite}
        onCreateClick={handleToolbarCreateClick}
        onGoToToday={handleGoToToday}
        onOpenViewSettings={() => setViewSettingsOpen(true)}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden h-full shrink-0 lg:flex">
          <PropertySidebar
            properties={filteredProperties}
            search={search}
            onSearchChange={setSearch}
            scrollRef={sidebarScrollRef}
            onScroll={syncFromSidebar}
            viewSettings={viewSettings}
          />
        </div>

        <div className="calendar-workspace flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-20 shrink-0 border-b border-[var(--cal-row-divider)] bg-white">
            <CalendarDayHeader
              days={displayDays}
              gridWidth={viewport.gridWidth}
              scrollRef={headerScrollRef}
            />
          </div>

          <CalendarGrid
            properties={filteredProperties}
            reservationsByProperty={reservationsByProperty}
            days={displayDays}
            rangeStart={viewport.rangeStart}
            gridWidth={viewport.gridWidth}
            scrollRef={gridScrollRef}
            onScroll={syncFromGrid}
            canWrite={canWrite}
            selection={selection}
            selectionHoverDate={selectionHoverDate}
            onDayClick={handleDayClick}
            onDayHover={handleDayHover}
            onReservationClick={openReservationDetail}
            showPrice={viewSettings.showPrice}
            showMinimumStay={viewSettings.showMinimumStay}
          />
        </div>
      </div>

      {canWrite ? (
        <div className="shrink-0 border-t border-[var(--cal-row-divider)] bg-white px-3 py-2 text-xs text-[var(--cal-text-secondary)] sm:px-4">
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

      <CalendarCreateBudgetDialog
        open={budgetDialogOpen}
        budgetTotal={pendingBudgetTotal}
        hasSelectedDates={pendingCreate !== null}
        onChooseWithBudget={handleChooseWithBudget}
        onChooseWithoutBudget={handleChooseWithoutBudget}
        onClose={closeBudgetDialog}
      />

      <CalendarViewSettingsDialog
        open={viewSettingsOpen}
        settings={viewSettings}
        onClose={() => setViewSettingsOpen(false)}
        onSave={handleSaveViewSettings}
      />

      <ReservationDrawer
        open={drawerMode !== null}
        mode={drawerMode}
        reservation={drawerMode === "detail" ? selectedReservation : null}
        properties={propertyOptions}
        canWrite={canWrite}
        canManageGuestRegistration={canManageGuestRegistration}
        canManagePayments={canManagePayments}
        initialCreateValues={createDefaults ?? undefined}
        detailLoading={detailLoading}
        refreshAfterDelete={false}
        onClose={closeDrawer}
        onCreated={handleCreated}
        onDeleted={handleDeleted}
        onUpdated={(updated) => setSelectedReservation(updated)}
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
            viewSettings={viewSettings}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

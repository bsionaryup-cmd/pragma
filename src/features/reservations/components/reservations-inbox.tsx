"use client";

import { Filter, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CreateReservationButton } from "@/features/reservations/components/create-reservation-button";
import { ReservationCard } from "@/features/reservations/components/reservation-card";
import {
  ReservationDrawer,
  type ReservationCreateInitialValues,
  type ReservationDrawerMode,
} from "@/features/reservations/components/reservation-drawer";
import type {
  PropertyOption,
  ReservationInboxItem,
} from "@/features/reservations/types/reservation.types";

type ReservationsInboxProps = {
  initialReservations: ReservationInboxItem[];
  properties: PropertyOption[];
  canWrite: boolean;
  openCreateOnMount?: boolean;
  initialSelectedId?: string | null;
  initialCreateValues?: ReservationCreateInitialValues;
};

export function ReservationsInbox({
  initialReservations,
  properties,
  canWrite,
  openCreateOnMount = false,
  initialSelectedId = null,
  initialCreateValues,
}: ReservationsInboxProps) {
  const router = useRouter();
  const [pendingReservations, setPendingReservations] = useState<
    ReservationInboxItem[]
  >([]);
  const reservations = useMemo(() => {
    const knownIds = new Set(initialReservations.map((r) => r.id));
    const pending = pendingReservations.filter((r) => !knownIds.has(r.id));
    return [...pending, ...initialReservations];
  }, [initialReservations, pendingReservations]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [drawerMode, setDrawerMode] = useState<ReservationDrawerMode>(() => {
    if (openCreateOnMount && canWrite) return "create";
    if (initialSelectedId) return "detail";
    return null;
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reservations;
    return reservations.filter(
      (r) =>
        r.guestName.toLowerCase().includes(q) ||
        r.property.name.toLowerCase().includes(q) ||
        r.guestEmail?.toLowerCase().includes(q),
    );
  }, [reservations, query]);

  const selected = reservations.find((r) => r.id === selectedId) ?? null;

  function openCreate() {
    setSelectedId(null);
    setDrawerMode("create");
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setDrawerMode("detail");
    router.replace(`/reservations?reservation=${id}`, { scroll: false });
  }

  function closeDrawer() {
    setDrawerMode(null);
    router.replace("/reservations", { scroll: false });
  }

  function handleCreated(reservation: ReservationInboxItem) {
    setPendingReservations((prev) => [reservation, ...prev]);
    setSelectedId(reservation.id);
    setDrawerMode("detail");
    router.replace(`/reservations?reservation=${reservation.id}`, { scroll: false });
    router.refresh();
  }

  function handleDeleted(id: string) {
    setPendingReservations((prev) => prev.filter((r) => r.id !== id));
    setSelectedId(null);
    setDrawerMode(null);
    router.replace("/reservations", { scroll: false });
  }

  return (
    <>
      <div className="flex h-full min-h-0 w-full overflow-hidden bg-white dark:bg-background">
        {/* Inbox Lodgify — panel izquierdo fijo */}
        <aside className="relative flex h-full w-full max-w-[420px] shrink-0 flex-col border-r border-border bg-white dark:bg-background">
          <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold tracking-tight">Reservas</h2>
              <p className="text-xs text-muted-foreground">
                {reservations.length} en total
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Buscar"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Filtros"
            >
              <Filter className="h-4 w-4" />
            </button>
          </header>

          {searchOpen ? (
            <div className="shrink-0 border-b border-border px-4 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar huésped o propiedad..."
                  className="h-8 w-full rounded-md border border-input bg-transparent py-1 pl-8 pr-8 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Listado con scroll — el footer queda fuera */}
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            style={canWrite ? { paddingBottom: 4 } : undefined}
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <p className="text-sm font-medium">Sin reservas</p>
                <p className="text-xs text-muted-foreground">
                  {query
                    ? "No hay resultados para tu búsqueda."
                    : "Usa el botón inferior para crear la primera reserva."}
                </p>
              </div>
            ) : (
              filtered.map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  isActive={
                    selectedId === reservation.id && drawerMode === "detail"
                  }
                  onSelect={() => openDetail(reservation.id)}
                />
              ))
            )}
          </div>

          {/* Bottom action area — Lodgify */}
          {canWrite ? (
            <footer className="shrink-0 border-t border-border/80 bg-white px-4 pb-4 pt-3 dark:bg-background">
              <CreateReservationButton onClick={openCreate} />
            </footer>
          ) : null}
        </aside>

        <div className="hidden min-w-0 flex-1 flex-col bg-muted/15 md:flex">
          <div className="flex flex-1 items-center justify-center p-8">
            {!drawerMode ? (
              <p className="max-w-xs text-center text-sm text-muted-foreground">
                Selecciona una reserva o crea una nueva con el botón inferior del
                listado.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <ReservationDrawer
        open={drawerMode !== null}
        mode={drawerMode}
        reservation={selected}
        properties={properties}
        canWrite={canWrite}
        initialCreateValues={initialCreateValues}
        onClose={closeDrawer}
        onCreated={handleCreated}
        onDeleted={handleDeleted}
      />
    </>
  );
}

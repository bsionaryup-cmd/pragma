"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { searchReservationsAction } from "@/features/reservations/actions/reservation.actions";
import { formatStayRange } from "@/features/reservations/lib/reservation-dates";
import { formatPropertyLabel } from "@/lib/property-display";
import type { ReservationSearchHit } from "@/services/reservations/reservation.service";
import { cn } from "@/lib/utils";

type CalendarReservationSearchProps = {
  onSelect: (reservationId: string) => void;
  className?: string;
};

export function CalendarReservationSearch({
  onSelect,
  className,
}: CalendarReservationSearchProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReservationSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestSeq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    const seq = ++requestSeq.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        const result = await searchReservationsAction(q);
        if (seq !== requestSeq.current) return;
        setLoading(false);
        if (!result.success) {
          setResults([]);
          return;
        }
        setResults(result.results);
        setOpen(true);
        setActiveIndex(result.results.length > 0 ? 0 : -1);
      })();
    }, 220);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function selectHit(hit: ReservationSearchHit) {
    setQuery("");
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(hit.id);
  }

  function clearQuery() {
    setQuery("");
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cal-text-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!showPanel || results.length === 0) {
              if (e.key === "Escape") clearQuery();
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              const hit = results[activeIndex];
              if (hit) selectHit(hit);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
            }
          }}
          placeholder="Huésped o código…"
          aria-label="Buscar reservas por huésped o código"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showPanel}
          className="h-8 w-full min-w-[10rem] rounded-md border border-[var(--cal-border)] bg-white pl-8 pr-8 text-[12px] text-[var(--cal-text-day)] outline-none transition-colors placeholder:text-[var(--cal-text-muted)] focus:border-[var(--cal-border-strong)] sm:min-w-[14rem] md:w-56"
        />
        {query ? (
          <button
            type="button"
            onClick={clearQuery}
            className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-[var(--cal-text-muted)] hover:bg-[var(--cal-bg-hover)] hover:text-[var(--cal-text-day)]"
            aria-label="Limpiar búsqueda de reservas"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 max-h-72 overflow-y-auto rounded-md border border-[var(--cal-border)] bg-white py-1 shadow-md sm:left-auto sm:right-0 sm:w-80"
        >
          {loading ? (
            <p className="px-3 py-2 text-[12px] text-[var(--cal-text-secondary)]">
              Buscando…
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-[12px] text-[var(--cal-text-secondary)]">
              Sin coincidencias
            </p>
          ) : (
            results.map((hit, index) => {
              const propertyLabel = formatPropertyLabel({
                name: hit.propertyName,
                unitNumber: hit.propertyUnitNumber,
              });
              const code = hit.reservationCode?.trim();
              return (
                <button
                  key={hit.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={cn(
                    "flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors",
                    index === activeIndex
                      ? "bg-[var(--cal-bg-hover)]"
                      : "hover:bg-[var(--cal-bg-hover)]",
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectHit(hit)}
                >
                  <span className="truncate text-[13px] font-medium text-[var(--cal-text-day)]">
                    {hit.guestName}
                  </span>
                  <span className="truncate text-[11px] text-[var(--cal-text-secondary)]">
                    {propertyLabel}
                    {" · "}
                    {formatStayRange(hit.checkIn, hit.checkOut)}
                    {code ? ` · ${code}` : ""}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

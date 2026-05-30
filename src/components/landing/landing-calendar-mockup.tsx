"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { PragmaLogo } from "@/components/brand/pragma-logo";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
const DAY_NUMBERS = [12, 13, 14, 15, 16, 17, 18] as const;

const PROPERTIES = [
  { id: "p1", label: "Loft Chapinero", unit: "301" },
  { id: "p2", label: "Estudio Usaquén", unit: "102" },
  { id: "p3", label: "Penthouse Rosales", unit: "A" },
  { id: "p4", label: "Aparta Zona T", unit: "504" },
] as const;

const RESERVATIONS = [
  {
    id: "r1",
    propertyId: "p1",
    startCol: 1,
    span: 3,
    guest: "María González",
    tone: "bg-pragma-electric text-white",
  },
  {
    id: "r2",
    propertyId: "p2",
    startCol: 3,
    span: 4,
    guest: "James Miller",
    tone: "bg-pragma-cyan text-pragma-navy",
  },
  {
    id: "r3",
    propertyId: "p3",
    startCol: 0,
    span: 2,
    guest: "Ana Restrepo",
    tone: "bg-pragma-aqua/90 text-pragma-navy",
  },
  {
    id: "r4",
    propertyId: "p3",
    startCol: 4,
    span: 3,
    guest: "Carlos Ruiz",
    tone: "bg-pragma-electric/85 text-white",
  },
  {
    id: "r5",
    propertyId: "p4",
    startCol: 2,
    span: 2,
    guest: "Sofía López",
    tone: "bg-pragma-cyan/80 text-pragma-navy",
  },
] as const;

export function LandingCalendarMockup() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white shadow-pragma-glow">
      <div className="flex items-center justify-between border-b border-pragma-border bg-pragma-soft-gray px-4 py-3">
        <div className="flex items-center gap-2.5">
          <PragmaLogo variant="mark" symbolClassName="h-7 w-7" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-pragma-electric">
              Calendario
            </p>
            <p className="font-heading text-sm font-semibold text-pragma-black">
              Mayo 2026
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-pragma-border bg-white text-pragma-mid-gray">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </span>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-pragma-border bg-white text-pragma-mid-gray">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[9.5rem_repeat(7,minmax(0,1fr))] border-b border-pragma-border bg-white">
            <div className="border-r border-pragma-border px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-pragma-mid-gray">
              Propiedad
            </div>
            {DAYS.map((day, index) => (
              <div
                key={day}
                className="border-r border-pragma-border px-2 py-2 text-center last:border-r-0"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-pragma-mid-gray">
                  {day}
                </p>
                <p
                  className={`mt-0.5 text-sm font-semibold ${
                    index === 3 ? "text-pragma-electric" : "text-pragma-black"
                  }`}
                >
                  {DAY_NUMBERS[index]}
                </p>
              </div>
            ))}
          </div>

          {PROPERTIES.map((property) => {
            const rows = RESERVATIONS.filter((row) => row.propertyId === property.id);
            return (
              <div
                key={property.id}
                className="grid grid-cols-[9.5rem_repeat(7,minmax(0,1fr))] border-b border-pragma-border last:border-b-0"
              >
                <div className="flex flex-col justify-center border-r border-pragma-border bg-pragma-soft-gray/70 px-3 py-3">
                  <p className="truncate text-xs font-semibold text-pragma-black">
                    {property.label}
                  </p>
                  <p className="text-[11px] text-pragma-mid-gray">Unidad {property.unit}</p>
                </div>
                <div className="relative col-span-7 grid grid-cols-7">
                  {DAYS.map((day) => (
                    <div
                      key={`${property.id}-${day}`}
                      className="h-14 border-r border-pragma-border/80 last:border-r-0"
                    />
                  ))}
                  {rows.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="pointer-events-none absolute inset-y-2 flex items-center"
                      style={{
                        left: `${(reservation.startCol / 7) * 100}%`,
                        width: `${(reservation.span / 7) * 100}%`,
                      }}
                    >
                      <div
                        className={`mx-0.5 flex h-9 w-[calc(100%-0.25rem)] items-center truncate rounded-lg px-2 text-[11px] font-semibold shadow-sm ${reservation.tone}`}
                      >
                        {reservation.guest}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-pragma-border bg-pragma-soft-gray/80 px-4 py-3 text-xs">
        <span className="font-medium text-pragma-black">
          5 reservas activas · 4 propiedades
        </span>
        <span className="rounded-full bg-pragma-soft-cyan px-2.5 py-1 font-semibold text-pragma-electric">
          Sync Airbnb · iCal
        </span>
      </div>
    </div>
  );
}

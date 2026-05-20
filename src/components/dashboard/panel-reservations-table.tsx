"use client";

import Image from "next/image";
import { Clock, Download } from "lucide-react";
import { PlatformBadge } from "@/components/dashboard/platform-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPanelDate } from "@/lib/helpers/date";
import type { PanelReservationRow } from "@/services/dashboard/dashboard.service";

type PanelTab = "arrivals" | "departures" | "current";

type PanelReservationsTableProps = {
  tab: PanelTab;
  rows: PanelReservationRow[];
  downloadLabel: string;
};

function guestTotal(row: PanelReservationRow) {
  return row.adults + row.children + row.infants;
}

function guestCountLabel(total: number) {
  return total === 1 ? "1 huésped" : `${total} huéspedes`;
}

function dateLabel(row: PanelReservationRow, tab: PanelTab) {
  const date = tab === "departures" ? row.checkOut : row.checkIn;
  return formatPanelDate(date);
}

function timeLabel(row: PanelReservationRow, tab: PanelTab) {
  if (tab === "current") return null;
  if (tab === "departures") return row.property.checkOutTime ?? "11:00";
  return row.property.checkInTime ?? "15:00";
}

export function PanelReservationsTable({
  tab,
  rows,
  downloadLabel,
}: PanelReservationsTableProps) {
  const dateColumn =
    tab === "departures" ? "Salida" : tab === "current" ? "Estancia" : "Fecha";

  return (
    <div>
      <div className="overflow-x-auto px-4 sm:px-6">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="h-11 ps-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Alojamiento
              </TableHead>
              <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {dateColumn}
              </TableHead>
              <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Canal
              </TableHead>
              <TableHead className="h-11 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Huéspedes
              </TableHead>
              <TableHead className="h-11 pe-0 text-end" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="py-16 text-center text-sm text-muted-foreground"
                >
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Clock className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <p className="mt-3 font-medium text-foreground">
                      Sin registros para mostrar
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cuando haya actividad, aparecerá aquí con prioridad
                      operativa.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const time = timeLabel(row, tab);
                const totalGuests = guestTotal(row);

                return (
                  <TableRow
                    key={row.id}
                    className="border-border transition-colors hover:bg-muted/45"
                  >
                    <TableCell className="py-3.5 ps-0">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border">
                          {row.property.coverImageUrl ? (
                            <Image
                              src={row.property.coverImageUrl}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-muted-foreground">
                              {row.property.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-[260px] truncate text-sm font-semibold text-foreground">
                            {row.property.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {row.property.neighborhood || "Sin barrio asignado"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex flex-col gap-1 text-sm text-foreground">
                        <span className="font-medium">{dateLabel(row, tab)}</span>
                        {time ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                            {time}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Hasta {formatPanelDate(row.checkOut)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      <PlatformBadge platform={row.platform} />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <p className="max-w-[220px] truncate text-sm font-medium text-foreground">
                        {row.guestName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {guestCountLabel(totalGuests)}
                      </p>
                    </TableCell>
                    <TableCell className="py-3.5 pe-0 text-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full border-border bg-card px-4 text-xs font-semibold text-foreground shadow-none hover:bg-accent"
                      >
                        Contacto
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full border-border bg-card shadow-none"
            disabled
            aria-label="Página anterior"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full border-border bg-card shadow-none"
            disabled
            aria-label="Página siguiente"
          />
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm font-semibold text-foreground underline-offset-4 hover:underline"
        >
          <Download className="h-4 w-4" />
          {downloadLabel}
        </button>
      </div>
    </div>
  );
}

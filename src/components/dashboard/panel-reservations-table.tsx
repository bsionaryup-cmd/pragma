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
    <div className="px-6 pb-6 pt-2">
      <Table>
        <TableHeader>
          <TableRow className="border-[#E9ECEF] hover:bg-transparent dark:border-border">
            <TableHead className="h-10 ps-0 text-xs font-normal text-[#6B7280]">
              Alojamiento
            </TableHead>
            <TableHead className="h-10 text-xs font-normal text-[#6B7280]">
              {dateColumn}
            </TableHead>
            <TableHead className="h-10 text-xs font-normal text-[#6B7280]">
              OTA
            </TableHead>
            <TableHead className="h-10 text-xs font-normal text-[#6B7280]">
              Huéspedes
            </TableHead>
            <TableHead className="h-10 pe-0 text-end" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={5}
                className="py-16 text-center text-sm text-[#6B7280]"
              >
                No hay registros para mostrar
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const time = timeLabel(row, tab);
              const totalGuests = guestTotal(row);

              return (
                <TableRow
                  key={row.id}
                  className="border-[#E9ECEF] hover:bg-[#FAFBFC] dark:border-border dark:hover:bg-accent/50"
                >
                  <TableCell className="py-4 ps-0">
                    <div className="flex items-center gap-3">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-[#F0F2F5]">
                        {row.property.coverImageUrl ? (
                          <Image
                            src={row.property.coverImageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="44px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[#9CA3AF]">
                            {row.property.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#111111] dark:text-foreground">
                          {row.property.name}
                        </p>
                        {row.property.neighborhood ? (
                          <p className="truncate text-sm text-[#6B7280] dark:text-muted-foreground">
                            {row.property.neighborhood}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2 text-sm text-[#111111] dark:text-foreground">
                      <span className="font-medium">{dateLabel(row, tab)}</span>
                      {time ? (
                        <span className="inline-flex items-center gap-1 text-[#6B7280] dark:text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                          {time}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <PlatformBadge platform={row.platform} />
                  </TableCell>
                  <TableCell className="py-4">
                    <p className="text-sm font-medium text-[#111111] dark:text-foreground">
                      {row.guestName}
                    </p>
                    <p className="text-sm text-[#6B7280] dark:text-muted-foreground">
                      {guestCountLabel(totalGuests)}
                    </p>
                  </TableCell>
                  <TableCell className="py-4 pe-0 text-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full border-0 bg-[#F0F2F5] px-5 text-sm font-medium text-[#111111] shadow-none hover:bg-[#E9ECEF] dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-accent"
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

      <div className="mt-6 flex items-center justify-between border-t border-[#E9ECEF] pt-5 dark:border-border">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-[#E9ECEF] bg-white shadow-none dark:border-border dark:bg-card"
            disabled
            aria-label="Página anterior"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-[#E9ECEF] bg-white shadow-none dark:border-border dark:bg-card"
            disabled
            aria-label="Página siguiente"
          />
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#111111] underline-offset-4 hover:underline dark:text-foreground"
        >
          <Download className="h-4 w-4" />
          {downloadLabel}
        </button>
      </div>
    </div>
  );
}

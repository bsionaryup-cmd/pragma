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

function guestCount(row: PanelReservationRow) {
  const total = row.adults + row.children + row.infants;
  return total > 1 ? `${row.guestName} · ${total}` : row.guestName;
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
    <div className="mt-2">
      <Table>
        <TableHeader>
          <TableRow className="border-[#ebebeb] hover:bg-transparent">
            <TableHead className="h-11 ps-0 text-sm font-semibold text-[#1a1a1a]">
              Alojamiento
            </TableHead>
            <TableHead className="h-11 text-sm font-semibold text-[#1a1a1a]">
              {dateColumn}
            </TableHead>
            <TableHead className="h-11 text-sm font-semibold text-[#1a1a1a]">
              OTA
            </TableHead>
            <TableHead className="h-11 text-sm font-semibold text-[#1a1a1a]">
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
                className="py-16 text-center text-sm text-[#6b6b6b]"
              >
                No hay registros para mostrar
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const time = timeLabel(row, tab);
              return (
                <TableRow
                  key={row.id}
                  className="border-[#ebebeb] hover:bg-[#fafafa]"
                >
                  <TableCell className="py-4 ps-0">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#efefef]">
                        {row.property.coverImageUrl ? (
                          <Image
                            src={row.property.coverImageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-medium text-[#9a9a9a]">
                            {row.property.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1a1a1a]">
                          {row.property.name}
                        </p>
                        {row.property.neighborhood ? (
                          <p className="truncate text-sm text-[#6b6b6b]">
                            {row.property.neighborhood}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
                      <span className="font-medium">{dateLabel(row, tab)}</span>
                      {time ? (
                        <span className="inline-flex items-center gap-1 text-[#6b6b6b]">
                          <Clock className="h-3.5 w-3.5" />
                          {time}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <PlatformBadge platform={row.platform} />
                  </TableCell>
                  <TableCell className="py-4 text-sm text-[#1a1a1a]">
                    {guestCount(row)}
                  </TableCell>
                  <TableCell className="py-4 pe-0 text-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-lg border-[#d9d9d9] bg-white px-4 text-sm font-medium text-[#1a1a1a] shadow-none hover:bg-[#fafafa]"
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

      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-[#d9d9d9] bg-white shadow-none"
            disabled
            aria-label="Página anterior"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-[#d9d9d9] bg-white shadow-none"
            disabled
            aria-label="Página siguiente"
          />
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#1a1a1a] underline-offset-4 hover:underline"
        >
          <Download className="h-4 w-4" />
          {downloadLabel}
        </button>
      </div>
    </div>
  );
}

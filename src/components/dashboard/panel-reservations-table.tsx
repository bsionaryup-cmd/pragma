"use client";

import { useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Clock, Download } from "lucide-react";
import { PlatformBadge } from "@/components/dashboard/platform-badge";
import {
  formatCalendarUnitDisplay,
  resolveCalendarUnitLabel,
} from "@/features/calendar/lib/property-unit";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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

function dateLabel(row: PanelReservationRow, tab: PanelTab) {
  const date = tab === "departures" ? row.checkOut : row.checkIn;
  return formatPanelDate(date);
}

function resolveUnitNumber(row: PanelReservationRow): string | null {
  if (row.property.unitDisplay) return row.property.unitDisplay;

  const unitLabel = resolveCalendarUnitLabel({
    name: row.property.name,
    unitNumber: row.property.unitNumber,
  });
  return unitLabel ? formatCalendarUnitDisplay(unitLabel) : null;
}

function PropertyCell({ row }: { row: PanelReservationRow }) {
  const unitNumber = resolveUnitNumber(row);

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
        {row.property.coverImageUrl ? (
          <Image
            src={row.property.coverImageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="44px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
            {(unitNumber ?? row.property.name).slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {row.property.name}
        </p>
        {unitNumber ? (
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
            {unitNumber}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function PanelReservationsTable({
  tab,
  rows,
  downloadLabel,
}: PanelReservationsTableProps) {
  const { t } = useI18n();
  const router = useRouter();

  const dateColumn =
    tab === "departures"
      ? t("table.departure")
      : tab === "current"
        ? t("table.stay")
        : t("table.date");

  const openReservation = useCallback(
    (reservationId: string) => {
      router.push(`/reservations?reservation=${reservationId}`);
    },
    [router],
  );

  function handleRowKeyDown(event: React.KeyboardEvent, reservationId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openReservation(reservationId);
    }
  }

  return (
    <div>
      <div className="space-y-3 px-4 py-4 md:hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={Clock}
            title={t("common.noRecords")}
            description={t("common.noRecordsDetail")}
          />
        ) : (
          rows.map((row) => {
            const totalGuests = guestTotal(row);
            const guestLabel =
              totalGuests === 1
                ? `1 ${t("common.guest")}`
                : `${totalGuests} ${t("common.guests")}`;

            return (
              <article
                key={row.id}
                role="button"
                tabIndex={0}
                onClick={() => openReservation(row.id)}
                onKeyDown={(event) => handleRowKeyDown(event, row.id)}
                className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/20"
              >
                <PropertyCell row={row} />
                <div className="mt-3 border-t border-border/70 pt-3">
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2.5 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      {dateLabel(row, tab)}
                    </span>
                    <PlatformBadge platform={row.platform} />
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="min-w-0 text-center">
                        <p className="truncate font-medium text-foreground">{row.guestName}</p>
                        <p className="text-xs text-muted-foreground">{guestLabel}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 rounded-md border-border bg-muted/40 px-3 text-xs font-medium shadow-none hover:bg-muted/60"
                      >
                        {t("common.contact")}
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="hidden md:block">
        <div className="mx-auto max-w-6xl overflow-x-auto px-4 sm:px-6">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="h-10 w-[38%] ps-0 pe-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("table.property")}
                </TableHead>
                <TableHead className="h-10 w-[14%] px-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {dateColumn}
                </TableHead>
                <TableHead className="h-10 w-[10%] px-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  OTA
                </TableHead>
                <TableHead className="h-10 w-[24%] px-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("table.guests")}
                </TableHead>
                <TableHead className="h-10 w-[14%] pe-0 ps-2 text-center" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      icon={Clock}
                      title={t("common.noRecords")}
                      description={t("common.noRecordsDetail")}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const totalGuests = guestTotal(row);
                  const guestLabel =
                    totalGuests === 1
                      ? `1 ${t("common.guest")}`
                      : `${totalGuests} ${t("common.guests")}`;

                  return (
                    <TableRow
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openReservation(row.id)}
                      onKeyDown={(event) => handleRowKeyDown(event, row.id)}
                      className="cursor-pointer border-border hover:bg-muted/20"
                    >
                      <TableCell className="align-middle py-3 ps-0 pe-3">
                        <PropertyCell row={row} />
                      </TableCell>
                      <TableCell className="align-middle px-2 py-3 text-center">
                        <span className="inline-flex items-center justify-center gap-1.5 text-sm text-foreground">
                          <Clock
                            className="h-4 w-4 shrink-0 text-muted-foreground"
                            strokeWidth={1.75}
                          />
                          {dateLabel(row, tab)}
                        </span>
                      </TableCell>
                      <TableCell className="align-middle px-2 py-3 text-center">
                        <div className="flex justify-center">
                          <PlatformBadge platform={row.platform} />
                        </div>
                      </TableCell>
                      <TableCell className="align-middle px-2 py-3 text-center">
                        <p className="mx-auto max-w-[200px] truncate text-sm font-medium text-foreground">
                          {row.guestName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{guestLabel}</p>
                      </TableCell>
                      <TableCell className="align-middle py-3 pe-0 ps-2 text-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-md border-border bg-muted/40 px-3 text-xs font-medium shadow-none hover:bg-muted/60"
                        >
                          {t("common.contact")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
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
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          <Download className="h-4 w-4" />
          {downloadLabel}
        </button>
      </div>
    </div>
  );
}

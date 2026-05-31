"use client";

import { SectionCard } from "@/components/ui/section-card";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FinanceOverview } from "@/services/finance/finance.service";
import { cn } from "@/lib/utils";

type FinanceMonthlyOccupancyHistoryTableProps = {
  data: FinanceOverview;
  embedded?: boolean;
};

export function FinanceMonthlyOccupancyHistoryTable({
  data,
  embedded = false,
}: FinanceMonthlyOccupancyHistoryTableProps) {
  const { t } = useI18n();
  const rows = data.monthlyOccupancy.history.filter((row) => !row.isFuture);

  if (rows.length === 0) return null;

  const table = (
    <div className={cn("overflow-x-auto", embedded ? "px-0" : "px-4 pb-4 sm:px-6")}>
      <table className="w-full text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">{t("finance.monthlyOccupancy.month")}</TableHead>
            <TableHead className="text-right text-xs">
              {t("finance.comparison.occupancy")}
            </TableHead>
            <TableHead className="text-right text-xs">
              {t("finance.kpi.revenue")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.monthKey}>
              <TableCell className="py-2 font-medium">{row.label}</TableCell>
              <TableCell className="py-2 text-right tabular-nums">
                {row.occupancyPct}%
              </TableCell>
              <TableCell className="py-2 text-right tabular-nums">
                {row.revenueFormatted}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  );

  if (embedded) return table;

  return (
    <SectionCard title={t("finance.monthlyOccupancy.historyTitle")} className="mb-5">
      {table}
    </SectionCard>
  );
}

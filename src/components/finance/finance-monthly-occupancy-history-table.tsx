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

type FinanceMonthlyOccupancyHistoryTableProps = {
  data: FinanceOverview;
};

export function FinanceMonthlyOccupancyHistoryTable({
  data,
}: FinanceMonthlyOccupancyHistoryTableProps) {
  const { t } = useI18n();
  const rows = data.monthlyOccupancy.history.filter((row) => !row.isFuture);

  if (rows.length === 0) return null;

  return (
    <SectionCard
      title={t("finance.monthlyOccupancy.historyTitle")}
      className="mb-5"
    >
      <div className="overflow-x-auto px-4 pb-4 sm:px-6">
        <table className="w-full text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>{t("finance.monthlyOccupancy.month")}</TableHead>
              <TableHead className="text-right">
                {t("finance.comparison.occupancy")}
              </TableHead>
              <TableHead className="text-right">
                {t("finance.kpi.revenue")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.monthKey}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.occupancyPct}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.revenueFormatted}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
    </SectionCard>
  );
}

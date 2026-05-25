"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { searchGuestPaymentHistoryAction } from "@/features/payments/actions/guest-payment.actions";
import type { PaymentHistoryRow } from "@/services/payments/payment-history.service";
import { SectionCard } from "@/components/ui/section-card";
import { Button } from "@/components/ui/button";

type PaymentHistoryPanelProps = {
  initialRows: PaymentHistoryRow[];
};

export function PaymentHistoryPanel({ initialRows }: PaymentHistoryPanelProps) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  function search() {
    if (!query.trim()) {
      setRows(initialRows);
      return;
    }
    startTransition(async () => {
      const result = await searchGuestPaymentHistoryAction(query);
      if (result.success) setRows(result.rows);
    });
  }

  return (
    <SectionCard
      title="Historial de cobros"
      description="Payment Links del tenant: categoría contable, estado y reserva asociada."
      className="mt-6"
    >
      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3 sm:px-6">
        <input
          className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="Buscar por nombre de huésped…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={search}>
          <Search className="mr-1.5 h-4 w-4" />
          Buscar
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">Sin cobros registrados.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.description}</p>
                <p className="text-xs text-muted-foreground">
                  {row.incomeCategory} · {row.statusLabel}
                  {row.guestName ? ` · ${row.guestName}` : ""}
                  {row.propertyLabel ? ` · ${row.propertyLabel}` : ""}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{row.amountFormatted}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

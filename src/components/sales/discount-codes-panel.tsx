"use client";

import { useState, useTransition } from "react";
import type { BillingPlanCode, SalesDiscountKind } from "@prisma/client";
import { toast } from "sonner";
import { createDiscountCodeAction } from "@/features/sales/actions/sales.actions";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/helpers/date";

type DiscountRow = {
  id: string;
  code: string;
  label: string | null;
  kind: SalesDiscountKind;
  value: unknown;
  scope: string;
  plan: BillingPlanCode | null;
  redemptionCount: number;
  maxRedemptions: number | null;
  active: boolean;
  expiresAt: Date | null;
  createdAt: Date;
};

export function DiscountCodesPanel({
  initialCodes,
}: {
  initialCodes: DiscountRow[];
}) {
  const [codes, setCodes] = useState(initialCodes);
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<SalesDiscountKind>("PERCENT");
  const [value, setValue] = useState("10");
  const [scope, setScope] = useState<"GLOBAL" | "PLAN" | "TENANT">("GLOBAL");
  const [plan, setPlan] = useState<BillingPlanCode>("PRO");

  function create() {
    startTransition(async () => {
      const result = await createDiscountCodeAction({
        code,
        label,
        kind,
        value: Number(value),
        scope,
        plan: scope === "PLAN" ? plan : null,
        recurring: true,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setCodes((prev) => [result.row as DiscountRow, ...prev]);
      toast.success("Código creado");
      setCode("");
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">Discount Codes</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Owner-only · validación contra catálogo real.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="rounded-lg border border-border px-3 py-2 text-sm uppercase"
            placeholder="Código"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <input
            className="rounded-lg border border-border px-3 py-2 text-sm"
            placeholder="Etiqueta"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <select
            className="rounded-lg border border-border px-3 py-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as SalesDiscountKind)}
          >
            <option value="PERCENT">Porcentaje</option>
            <option value="FIXED_COP">Fijo COP</option>
          </select>
          <input
            className="rounded-lg border border-border px-3 py-2 text-sm"
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-border px-3 py-2 text-sm"
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
          >
            <option value="GLOBAL">Global</option>
            <option value="PLAN">Por plan</option>
          </select>
          {scope === "PLAN" ? (
            <select
              className="rounded-lg border border-border px-3 py-2 text-sm"
              value={plan}
              onChange={(e) => setPlan(e.target.value as BillingPlanCode)}
            >
              <option value="STARTER">Start</option>
              <option value="PRO">Pro</option>
              <option value="SCALE">Scale</option>
            </select>
          ) : null}
          <Button type="button" variant="brand" size="sm" disabled={pending} onClick={create}>
            Crear código
          </Button>
        </div>
      </div>

      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {codes.length === 0 ? (
          <li className="p-6 text-sm text-muted-foreground">Sin códigos aún.</li>
        ) : (
          codes.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <p className="font-mono text-sm font-semibold">{row.code}</p>
                <p className="text-xs text-muted-foreground">
                  {row.kind === "PERCENT" ? `${row.value}%` : `$${row.value} COP`} ·{" "}
                  {row.scope}
                  {row.plan ? ` · ${row.plan}` : ""}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {row.redemptionCount}
                {row.maxRedemptions != null ? `/${row.maxRedemptions}` : ""} usos ·{" "}
                {row.active ? "Activo" : "Inactivo"}
                {row.expiresAt ? ` · vence ${formatDate(row.expiresAt)}` : ""}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

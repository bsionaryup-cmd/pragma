"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { BillingPlanCode, SalesBillingInterval } from "@prisma/client";
import { Minus, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  calculateQuotePreviewAction,
  createSalesQuoteAction,
  issueSalesQuoteOfferAction,
} from "@/features/sales/actions/sales.actions";
import {
  PLAN_CATALOG,
  formatCop,
  getPlanDefinition,
} from "@/modules/billing/domain/plan-catalog";
import type { QuoteCalculatorResult } from "@/modules/sales/domain/quote-calculator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuoteCalculatorPanel() {
  const [pending, startTransition] = useTransition();
  const [plan, setPlan] = useState<BillingPlanCode>("PRO");
  const [propertyCount, setPropertyCount] = useState(3);
  const [billingInterval, setBillingInterval] =
    useState<SalesBillingInterval>("MONTHLY");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [overrideMonthly, setOverrideMonthly] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [calc, setCalc] = useState<QuoteCalculatorResult | null>(null);
  const [lastQuoteId, setLastQuoteId] = useState<string | null>(null);

  const plans = useMemo(() => Object.values(PLAN_CATALOG), []);
  const planDef = getPlanDefinition(plan);

  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(async () => {
        const result = await calculateQuotePreviewAction({
          plan,
          propertyCount,
          billingInterval,
          discountPercent: discountPercent ? Number(discountPercent) : null,
          discountAmountCop: discountAmount ? Number(discountAmount) : null,
          overrideMonthlyCop: overrideMonthly ? Number(overrideMonthly) : null,
          discountCode: discountCode || null,
        });
        if (result.success) setCalc(result.calc);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [
    plan,
    propertyCount,
    billingInterval,
    discountPercent,
    discountAmount,
    overrideMonthly,
    discountCode,
  ]);

  function saveAndIssue() {
    startTransition(async () => {
      const created = await createSalesQuoteAction({
        prospectName,
        prospectEmail,
        plan,
        propertyCount,
        billingInterval,
        discountPercent: discountPercent ? Number(discountPercent) : null,
        discountAmountCop: discountAmount ? Number(discountAmount) : null,
        overrideMonthlyCop: overrideMonthly ? Number(overrideMonthly) : null,
        discountCode: discountCode || null,
      });
      if (!created.success) {
        toast.error(created.error);
        return;
      }
      setLastQuoteId(created.quote.id);
      const issued = await issueSalesQuoteOfferAction(created.quote.id);
      if (!issued.success) {
        toast.error(issued.error);
        return;
      }
      await navigator.clipboard.writeText(issued.offerUrl);
      toast.success("Cotización guardada · enlace copiado");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-pragma-electric" />
          <h2 className="font-heading text-lg font-semibold">Calculadora rápida</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Precios del catálogo PRAGMA actual · sin alterar planes base.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => setPlan(p.code)}
              className={cn(
                "rounded-xl border px-3 py-2 text-start text-sm transition-colors",
                plan === p.code
                  ? "border-pragma-electric bg-pragma-light-blue/40"
                  : "border-border hover:bg-muted/40",
              )}
            >
              <span className="font-medium">{p.name}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {formatCop(p.pricePerPropertyCop)}/prop.
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Propiedades</span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setPropertyCount((c) => Math.max(1, c - 1))}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="min-w-[2rem] text-center font-semibold tabular-nums">
            {propertyCount}
          </span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() =>
              setPropertyCount((c) =>
                Math.min(planDef.maxProperties, c + 1),
              )
            }
          >
            <Plus className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Tope plan: {planDef.maxProperties}
          </span>
        </div>

        <div className="flex gap-2">
          {(["MONTHLY", "ANNUAL"] as const).map((interval) => (
            <button
              key={interval}
              type="button"
              onClick={() => setBillingInterval(interval)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium",
                billingInterval === interval
                  ? "border-pragma-electric bg-pragma-electric/10"
                  : "border-border",
              )}
            >
              {interval === "MONTHLY" ? "Mensual" : "Anual (×12)"}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Descuento %
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              type="number"
              min={0}
              max={80}
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Descuento fijo (COP)
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              type="number"
              min={0}
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Override mensual (COP, opcional)
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              type="number"
              min={0}
              value={overrideMonthly}
              onChange={(e) => setOverrideMonthly(e.target.value)}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            Código descuento
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 uppercase"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              placeholder="PRAGMA20"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Prospecto
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              value={prospectName}
              onChange={(e) => setProspectName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
              type="email"
              value={prospectEmail}
              onChange={(e) => setProspectEmail(e.target.value)}
            />
          </label>
        </div>

        <Button
          type="button"
          variant="brand"
          disabled={pending}
          onClick={saveAndIssue}
        >
          Guardar cotización y generar offer link
        </Button>
        {lastQuoteId ? (
          <p className="text-[11px] text-muted-foreground">Última quote: {lastQuoteId}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-pragma-electric/25 bg-gradient-to-b from-pragma-navy/90 to-card p-5 text-card-foreground shadow-pragma-card">
        <p className="text-xs font-semibold uppercase tracking-wider text-pragma-electric">
          Pricing live
        </p>
        {calc ? (
          <dl className="mt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Base mensual</dt>
              <dd className="font-medium">{formatCop(calc.listMonthlyCop)}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Ahorro</dt>
              <dd className="font-medium text-pragma-electric">
                −{formatCop(calc.savingsCop)}
              </dd>
            </div>
            <div className="border-t border-border/60 pt-3">
              <div className="flex justify-between">
                <dt className="text-sm font-medium">Final mensual</dt>
                <dd className="text-xl font-bold tabular-nums">
                  {formatCop(calc.finalMonthlyCop)}
                </dd>
              </div>
              {billingInterval === "ANNUAL" ? (
                <p className="mt-1 text-end text-xs text-muted-foreground">
                  Anual: {formatCop(calc.finalDisplayCop)}
                </p>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {calc.propertyCount} propiedades · {planDef.name} ·{" "}
              {formatCop(calc.pricePerPropertyCop)}/prop.
            </p>
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Calculando…</p>
        )}
      </div>
    </div>
  );
}

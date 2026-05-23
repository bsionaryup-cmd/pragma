"use client";

import { useMemo, useState, useTransition } from "react";
import type { BillingPlanCode } from "@prisma/client";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { selectPlanAction } from "@/features/billing/actions/billing.actions";
import {
  calculateSubscriptionAmount,
  clampPropertyCount,
  formatCop,
  PLAN_CATALOG,
  proPlanMonthlySavingsVsStarter,
} from "@/modules/billing/domain/plan-catalog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlanSelectorProps = {
  currentPlan: BillingPlanCode;
  propertyCount: number;
  disabled?: boolean;
};

export function PlanSelector({
  currentPlan,
  propertyCount: initialPropertyCount,
  disabled,
}: PlanSelectorProps) {
  const [pending, startTransition] = useTransition();
  const [propertyCount, setPropertyCount] = useState(
    clampPropertyCount(initialPropertyCount),
  );
  const plans = Object.values(PLAN_CATALOG);

  const proExtraCost = useMemo(
    () => proPlanMonthlySavingsVsStarter(propertyCount),
    [propertyCount],
  );

  const onSelect = (plan: BillingPlanCode) => {
    if (disabled) return;
    startTransition(async () => {
      const result = await selectPlanAction(plan, propertyCount);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <label htmlFor="propertyCount" className="text-sm font-medium">
          ¿Cuántas propiedades gestionas?
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Cobramos por propiedad activa. Puedes empezar con 1 y escalar cuando lo
          necesites.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || propertyCount <= 1}
            onClick={() => setPropertyCount((c) => clampPropertyCount(c - 1))}
          >
            −
          </Button>
          <input
            id="propertyCount"
            type="number"
            min={1}
            max={999}
            value={propertyCount}
            onChange={(e) =>
              setPropertyCount(clampPropertyCount(Number(e.target.value)))
            }
            className="h-10 w-20 rounded-lg border border-border bg-background text-center text-sm font-semibold tabular-nums"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || propertyCount >= 999}
            onClick={() => setPropertyCount((c) => clampPropertyCount(c + 1))}
          >
            +
          </Button>
          <span className="text-sm text-muted-foreground">
            propiedad{propertyCount === 1 ? "" : "es"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((plan) => {
          const active = plan.code === currentPlan;
          const total = calculateSubscriptionAmount(plan.code, propertyCount);
          const isPro = plan.code === "PRO";

          return (
            <div
              key={plan.code}
              className={cn(
                "relative rounded-xl border p-4 transition-colors",
                plan.highlighted
                  ? "border-pragma-cyan bg-pragma-light-blue/20 ring-1 ring-pragma-cyan/30"
                  : "border-border bg-card",
              )}
            >
              {plan.badge ? (
                <span className="absolute -top-2.5 right-3 inline-flex items-center gap-1 rounded-full bg-pragma-electric px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  <Sparkles className="h-3 w-3" />
                  {plan.badge}
                </span>
              ) : null}

              <p className="font-semibold">{plan.name}</p>
              <p className="text-xs text-muted-foreground">{plan.tagline}</p>
              <p className="mt-2 text-lg font-bold tabular-nums">
                {formatCop(plan.pricePerPropertyCop)}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / propiedad / mes
                </span>
              </p>
              <p className="mt-1 text-sm font-semibold text-pragma-electric tabular-nums">
                Total: {formatCop(total)}/mes
              </p>

              {isPro ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Solo {formatCop(proExtraCost)} más al mes vs Básico — incluye
                  PriceLabs, reportes avanzados y soporte prioritario.
                </p>
              ) : null}

              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                {plan.features.slice(0, 4).map((feature) => (
                  <li key={feature}>· {feature}</li>
                ))}
              </ul>

              <Button
                type="button"
                variant={plan.highlighted ? "default" : "outline"}
                size="sm"
                className={cn("mt-4 w-full", plan.highlighted && "bg-pragma-electric hover:bg-pragma-electric/90")}
                disabled={pending || disabled || active}
                onClick={() => onSelect(plan.code)}
              >
                {active ? "Plan actual" : `Elegir ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { BillingPlanCode } from "@prisma/client";
import { toast } from "sonner";
import { selectPlanAction } from "@/features/billing/actions/billing.actions";
import {
  calculateSubscriptionAmount,
  clampPropertyCount,
  clampPropertyCountForBillingPlan,
  formatCop,
  getPlanDefinition,
  PLAN_CATALOG,
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
  const [selectedPlan, setSelectedPlan] = useState<BillingPlanCode>(currentPlan);
  const planDef = getPlanDefinition(selectedPlan);
  const maxForPlan = planDef.maxProperties;

  const [propertyCount, setPropertyCount] = useState(() =>
    clampPropertyCountForBillingPlan(
      currentPlan,
      clampPropertyCount(initialPropertyCount),
    ),
  );

  const plans = Object.values(PLAN_CATALOG);

  const onSelect = (plan: BillingPlanCode) => {
    if (disabled) return;
    const slots = clampPropertyCountForBillingPlan(plan, propertyCount);
    startTransition(async () => {
      const result = await selectPlanAction(plan, slots);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  };

  const adjustCount = (delta: number) => {
    setPropertyCount((c) =>
      clampPropertyCountForBillingPlan(selectedPlan, c + delta),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Propiedades</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 px-0"
          disabled={pending || propertyCount <= 1}
          onClick={() => adjustCount(-1)}
        >
          −
        </Button>
        <input
          id="propertyCount"
          type="number"
          min={1}
          max={maxForPlan}
          value={propertyCount}
          onChange={(e) =>
            setPropertyCount(
              clampPropertyCountForBillingPlan(selectedPlan, Number(e.target.value)),
            )
          }
          className="h-8 w-14 rounded-md border border-border bg-background text-center text-sm font-semibold tabular-nums"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 px-0"
          disabled={pending || propertyCount >= maxForPlan}
          onClick={() => adjustCount(1)}
        >
          +
        </Button>
        <span className="text-xs text-muted-foreground">máx. {maxForPlan} en {planDef.name}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {plans.map((plan) => {
          const active = plan.code === currentPlan;
          const total = calculateSubscriptionAmount(plan.code, propertyCount);

          return (
            <div
              key={plan.code}
              className={cn(
                "rounded-lg border p-3",
                selectedPlan === plan.code
                  ? "border-pragma-electric bg-pragma-electric/5"
                  : "border-border",
              )}
            >
              <p className="text-sm font-semibold">{plan.name}</p>
              <p className="mt-1 text-sm font-bold tabular-nums text-pragma-electric">
                {formatCop(total)}
                <span className="text-xs font-normal text-muted-foreground">/mes</span>
              </p>
              <Button
                type="button"
                variant={active ? "outline" : "brand"}
                size="sm"
                className="mt-2 h-8 w-full text-xs"
                disabled={pending || disabled || active}
                onClick={() => {
                  const slots = clampPropertyCountForBillingPlan(plan.code, propertyCount);
                  setPropertyCount(slots);
                  setSelectedPlan(plan.code);
                  onSelect(plan.code);
                }}
              >
                {active ? "Actual" : "Elegir"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import type { BillingPlanCode } from "@prisma/client";
import { toast } from "sonner";
import { selectPlanAction } from "@/features/billing/actions/billing.actions";
import { PLAN_CATALOG } from "@/modules/billing/domain/plan-catalog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlanSelectorProps = {
  currentPlan: BillingPlanCode;
  disabled?: boolean;
};

export function PlanSelector({ currentPlan, disabled }: PlanSelectorProps) {
  const [pending, startTransition] = useTransition();
  const plans = Object.values(PLAN_CATALOG);

  const onSelect = (plan: BillingPlanCode) => {
    if (plan === currentPlan || disabled) return;
    startTransition(async () => {
      const result = await selectPlanAction(plan);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {plans.map((plan) => {
        const active = plan.code === currentPlan;
        return (
          <button
            key={plan.code}
            type="button"
            disabled={pending || disabled || active}
            onClick={() => onSelect(plan.code)}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors",
              active
                ? "border-pragma-cyan bg-pragma-light-blue/30 ring-1 ring-pragma-cyan/30"
                : "border-border hover:border-pragma-cyan/40 hover:bg-muted/30",
            )}
          >
            <p className="font-semibold">{plan.name}</p>
            <p className="mt-1 text-lg font-bold tabular-nums">
              {plan.monthlyAmountCop.toLocaleString("es-CO")} {plan.currency}/mes
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{plan.description}</p>
            {active ? (
              <span className="mt-2 inline-block text-xs font-medium text-pragma-electric">
                Plan actual
              </span>
            ) : (
              <span className="mt-2 inline-block text-xs text-muted-foreground">
                Seleccionar
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

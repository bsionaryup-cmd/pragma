"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionCard } from "@/components/ui/section-card";
import {
  addRepeatedExpenseAsFixedAction,
  upsertFinancePlanningSettingsAction,
} from "@/features/finance/actions/finance-planning.actions";
import type { FinanceOverview } from "@/services/finance/finance.service";
import type {
  FinancePlanningFixedExpense,
  FinancePlanningVariableExpense,
} from "@/lib/finance/finance-planning-types";

type FinancePlanningSectionProps = {
  data: FinanceOverview;
  canWrite?: boolean;
  showEditButton?: boolean;
};

type DraftSettings = {
  monthlyProfitGoal: string;
  fixedExpenses: FinancePlanningFixedExpense[];
  variableExpenses: FinancePlanningVariableExpense[];
};

function emptyDraft(): DraftSettings {
  return {
    monthlyProfitGoal: "0",
    fixedExpenses: [{ name: "", amount: 0 }],
    variableExpenses: [],
  };
}

function draftFromPlanning(data: FinanceOverview): DraftSettings {
  const { settings } = data.planning;
  return {
    monthlyProfitGoal: String(settings.monthlyProfitGoal || 0),
    fixedExpenses:
      settings.fixedExpenses.length > 0
        ? settings.fixedExpenses
        : [{ name: "", amount: 0 }],
    variableExpenses: settings.variableExpenses,
  };
}

function PlanningMetrics({ data }: { data: FinanceOverview }) {
  const { t } = useI18n();
  const { planning } = data;

  const rows = [
    {
      label: t("finance.planning.profitGoal"),
      value: planning.monthlyProfitGoalFormatted,
    },
    {
      label: t("finance.planning.fixedCosts"),
      value: planning.totalFixedCostFormatted,
    },
    {
      label: t("finance.planning.variableCosts"),
      value: planning.totalVariableCostFormatted,
    },
    {
      label: t("finance.planning.requiredRevenue"),
      value: planning.requiredRevenueFormatted,
      highlight: true,
    },
    {
      label: t("finance.planning.targetOccupancy"),
      value: `${planning.requiredOccupancyPct}%`,
    },
    {
      label: t("finance.planning.currentOccupancy"),
      value: `${planning.currentOccupancyPct}%`,
    },
    {
      label: t("finance.planning.remaining"),
      value: planning.remainingToGoalFormatted,
      emphasis: planning.remainingToGoal > 0,
    },
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-xl border border-border bg-card px-4 py-3"
        >
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {row.label}
          </dt>
          <dd
            className={
              row.highlight
                ? "mt-1 text-lg font-semibold text-pragma-electric"
                : row.emphasis
                  ? "mt-1 text-lg font-semibold text-amber-700"
                  : "mt-1 text-lg font-semibold tabular-nums"
            }
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function FinancePlanningSection({
  data,
  canWrite = false,
  showEditButton = true,
}: FinancePlanningSectionProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftSettings>(() => draftFromPlanning(data));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hints = useMemo(
    () => data.planning.repeatedExpenseHints,
    [data.planning.repeatedExpenseHints],
  );

  function openEditor() {
    setDraft(draftFromPlanning(data));
    setError(null);
    setOpen(true);
  }

  function saveSettings() {
    startTransition(async () => {
      const fixedExpenses = draft.fixedExpenses
        .map((row) => ({
          name: row.name.trim(),
          amount: Number(row.amount),
        }))
        .filter((row) => row.name && Number.isFinite(row.amount) && row.amount >= 0);

      const variableExpenses = draft.variableExpenses
        .map((row) => ({
          name: row.name.trim(),
          type: row.type,
          value: Number(row.value),
        }))
        .filter(
          (row) =>
            row.name &&
            Number.isFinite(row.value) &&
            row.value >= 0 &&
            (row.type === "percent" || row.type === "fixed_per_booking"),
        );

      const monthlyProfitGoal = Number(draft.monthlyProfitGoal);
      if (!Number.isFinite(monthlyProfitGoal) || monthlyProfitGoal < 0) {
        setError(t("finance.planning.errors.invalidGoal"));
        return;
      }

      const result = await upsertFinancePlanningSettingsAction({
        monthlyProfitGoal,
        fixedExpenses,
        variableExpenses,
        propertyId: data.planning.settings.propertyId ?? null,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  function addRepeatedExpense(name: string, amount: number) {
    startTransition(async () => {
      const result = await addRepeatedExpenseAsFixedAction({ name, amount });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <SectionCard
        title={t("finance.planning.title", { month: data.selectedMonthLabel })}
        description={t("finance.planning.description")}
        headerAction={
          showEditButton && canWrite ? (
            <Button type="button" variant="outline" size="sm" onClick={openEditor}>
              {t("finance.planning.editSettings")}
            </Button>
          ) : null
        }
      >
        <div className="space-y-4 px-4 pb-4 sm:px-6">
          {!data.planning.hasConfiguration ? (
            <p className="text-sm text-muted-foreground">
              {t("finance.planning.empty")}
            </p>
          ) : null}
          <PlanningMetrics data={data} />
          {canWrite && hints.length > 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
              <p className="text-sm font-medium">{t("finance.planning.repeatHintTitle")}</p>
              <ul className="mt-2 space-y-2">
                {hints.map((hint) => (
                  <li
                    key={`${hint.name}-${hint.amount}`}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {t("finance.planning.repeatHintItem", {
                        name: hint.name,
                        amount: hint.amount.toLocaleString(),
                        count: hint.occurrences,
                      })}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => addRepeatedExpense(hint.name, hint.amount)}
                    >
                      {t("finance.planning.addAsFixed")}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("finance.planning.editTitle")}</DialogTitle>
            <DialogDescription>{t("finance.planning.editDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">
                {t("finance.planning.profitGoal")}
              </span>
              <input
                type="number"
                min={0}
                value={draft.monthlyProfitGoal}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    monthlyProfitGoal: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t("finance.planning.fixedCosts")}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      fixedExpenses: [...current.fixedExpenses, { name: "", amount: 0 }],
                    }))
                  }
                >
                  <Plus className="mr-1 size-4" />
                  {t("finance.planning.addRow")}
                </Button>
              </div>
              {draft.fixedExpenses.map((row, index) => (
                <div key={`fixed-${index}`} className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                  <input
                    type="text"
                    value={row.name}
                    placeholder={t("finance.planning.namePlaceholder")}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        fixedExpenses: current.fixedExpenses.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    value={row.amount}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        fixedExpenses: current.fixedExpenses.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, amount: Number(event.target.value) }
                            : item,
                        ),
                      }))
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        fixedExpenses:
                          current.fixedExpenses.length === 1
                            ? emptyDraft().fixedExpenses
                            : current.fixedExpenses.filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                      }))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t("finance.planning.variableCosts")}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      variableExpenses: [
                        ...current.variableExpenses,
                        { name: "", type: "percent", value: 0 },
                      ],
                    }))
                  }
                >
                  <Plus className="mr-1 size-4" />
                  {t("finance.planning.addRow")}
                </Button>
              </div>
              {draft.variableExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("finance.planning.noVariableCosts")}
                </p>
              ) : null}
              {draft.variableExpenses.map((row, index) => (
                <div
                  key={`variable-${index}`}
                  className="grid gap-2 sm:grid-cols-[1fr_140px_120px_auto]"
                >
                  <input
                    type="text"
                    value={row.name}
                    placeholder={t("finance.planning.namePlaceholder")}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        variableExpenses: current.variableExpenses.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      }))
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <select
                    value={row.type}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        variableExpenses: current.variableExpenses.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                type: event.target.value as FinancePlanningVariableExpense["type"],
                              }
                            : item,
                        ),
                      }))
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="percent">{t("finance.planning.variablePercent")}</option>
                    <option value="fixed_per_booking">
                      {t("finance.planning.variablePerBooking")}
                    </option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={row.value}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        variableExpenses: current.variableExpenses.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, value: Number(event.target.value) }
                            : item,
                        ),
                      }))
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        variableExpenses: current.variableExpenses.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("finance.planning.cancel")}
            </Button>
            <Button type="button" onClick={saveSettings} disabled={isPending}>
              {t("finance.planning.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

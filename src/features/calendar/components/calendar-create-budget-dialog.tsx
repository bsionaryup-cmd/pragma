"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/helpers";

type CalendarCreateBudgetDialogProps = {
  open: boolean;
  budgetTotal: number;
  hasSelectedDates?: boolean;
  onChooseWithBudget: () => void;
  onChooseWithoutBudget: () => void;
  onClose: () => void;
};

export function CalendarCreateBudgetDialog({
  open,
  budgetTotal,
  hasSelectedDates = false,
  onChooseWithBudget,
  onChooseWithoutBudget,
  onClose,
}: CalendarCreateBudgetDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="gap-5 sm:max-w-sm" showCloseButton>
        <DialogHeader>
          <DialogTitle className="text-base">Nueva reserva</DialogTitle>
          <DialogDescription>
            {hasSelectedDates
              ? "Elige si usar las tarifas actuales de PriceLabs para las fechas seleccionadas o ingresar un monto manualmente."
              : "Elige si usar las tarifas de PriceLabs al crear la reserva o ingresar un monto manualmente."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Button type="button" className="h-10 w-full" onClick={onChooseWithBudget}>
            Reserva con presupuesto
            {hasSelectedDates && budgetTotal > 0 ? (
              <span className="ml-1 font-normal opacity-80">
                ({formatCurrency(budgetTotal)})
              </span>
            ) : null}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full"
            onClick={onChooseWithoutBudget}
          >
            Reserva sin presupuesto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

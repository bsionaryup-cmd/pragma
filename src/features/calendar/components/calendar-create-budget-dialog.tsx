"use client";

import { Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { countNights } from "@/features/reservations/lib/reservation-dates";
import {
  copyReservationQuoteToClipboard,
  type ReservationQuoteBreakdown,
} from "@/features/reservations/lib/reservation-quote-clipboard";
import { formatCurrency } from "@/lib/helpers";

type CalendarCreateBudgetDialogProps = {
  open: boolean;
  budgetTotal: number;
  hasSelectedDates?: boolean;
  quotePreview?: ReservationQuoteBreakdown | null;
  onChooseWithBudget: () => void;
  onChooseWithoutBudget: () => void;
  onClose: () => void;
};

export function CalendarCreateBudgetDialog({
  open,
  budgetTotal,
  hasSelectedDates = false,
  quotePreview = null,
  onChooseWithBudget,
  onChooseWithoutBudget,
  onClose,
}: CalendarCreateBudgetDialogProps) {
  const [isCopyingQuote, setIsCopyingQuote] = useState(false);

  async function handleCopyQuote() {
    if (!quotePreview?.checkIn || !quotePreview.checkOut) {
      toast.error("Selecciona fechas de check-in y check-out.");
      return;
    }

    setIsCopyingQuote(true);
    try {
      await copyReservationQuoteToClipboard(quotePreview);
      toast.success("Cotización copiada al portapapeles.");
    } catch {
      toast.error("No se pudo copiar la cotización.");
    } finally {
      setIsCopyingQuote(false);
    }
  }

  const nights =
    quotePreview?.checkIn && quotePreview.checkOut
      ? countNights(quotePreview.checkIn, quotePreview.checkOut)
      : 0;
  const currency = quotePreview?.currency ?? "COP";

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

        {quotePreview ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs space-y-1">
              {quotePreview.propertyLabel?.trim() ? (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Propiedad</span>
                  <span className="font-medium text-right">
                    {quotePreview.propertyLabel.trim()}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Check-in</span>
                <span className="font-medium tabular-nums">{quotePreview.checkIn}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Check-out</span>
                <span className="font-medium tabular-nums">{quotePreview.checkOut}</span>
              </div>
              {nights > 0 ? (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Noches</span>
                  <span className="font-medium">{nights}</span>
                </div>
              ) : null}
              {quotePreview.accommodationTotal != null &&
              quotePreview.accommodationTotal > 0 ? (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Alojamiento</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(quotePreview.accommodationTotal, currency)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between gap-2 border-t border-border/60 pt-1">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold tabular-nums">
                  {quotePreview.totalAmount != null && quotePreview.totalAmount > 0
                    ? formatCurrency(quotePreview.totalAmount, currency)
                    : "Pendiente"}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-full text-[11px] font-semibold uppercase tracking-wide"
              disabled={isCopyingQuote}
              onClick={handleCopyQuote}
            >
              {isCopyingQuote ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Copy className="mr-2 h-3.5 w-3.5" />
              )}
              Copiar cotización
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Button type="button" className="h-10 w-full" onClick={onChooseWithBudget}>
              Reserva con presupuesto
              {hasSelectedDates && budgetTotal > 0 ? (
                <span className="ml-1 font-normal opacity-80">
                  ({formatCurrency(budgetTotal)})
                </span>
              ) : null}
            </Button>
            {hasSelectedDates ? (
              <p className="text-center text-xs text-muted-foreground">
                El total incluye la tarifa de aseo de la propiedad.
              </p>
            ) : null}
          </div>
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

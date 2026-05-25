"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createManualPaymentLinkAction } from "@/features/payments/actions/guest-payment.actions";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  { value: "MANUAL_OPERATIONAL", label: "Cobro operativo" },
  { value: "DAMAGE_FEE", label: "Daños" },
  { value: "CLEANING_FEE", label: "Limpieza" },
  { value: "LATE_CHECKOUT", label: "Late check-out" },
  { value: "EXTRA_SERVICES", label: "Servicios extra" },
  { value: "DEPOSIT", label: "Depósito" },
] as const;

export function PaymentLinkCreateForm() {
  const [pending, startTransition] = useTransition();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]["value"]>("MANUAL_OPERATIONAL");

  function submit(issue: boolean) {
    const parsed = Number(amount.replace(/,/g, ""));
    if (!description.trim() || !parsed || parsed <= 0) {
      toast.error("Completa descripción y monto válido");
      return;
    }
    startTransition(async () => {
      const result = await createManualPaymentLinkAction({
        category,
        description: description.trim(),
        amount: parsed,
        issue,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(issue ? "Enlace emitido" : "Borrador creado");
      setDescription("");
      setAmount("");
    });
  }

  return (
    <div className="rounded-xl border border-border bg-pragma-light-blue/20 p-4">
      <h3 className="text-sm font-semibold text-foreground">Nuevo Payment Link</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Cobros manuales, fees o cargos sin reserva vinculada.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="font-medium">Descripción</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Categoría</span>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as (typeof CATEGORIES)[number]["value"])
            }
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Monto (COP)</span>
          <input
            type="number"
            min={1}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="brand"
          size="sm"
          disabled={pending}
          onClick={() => submit(true)}
        >
          Crear y emitir
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => submit(false)}
        >
          Guardar borrador
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  createManualExpenseAction,
  createOtherIncomeAction,
} from "@/features/finance/actions/manual-finance.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionCard } from "@/components/ui/section-card";

export function ManualFinanceForms() {
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard title="Otros egresos" description="Gastos manuales con comprobante.">
        <form
          className="grid gap-3 p-4 sm:grid-cols-2"
          action={(fd) =>
            startTransition(async () => {
              try {
                await createManualExpenseAction(fd);
                toast.success("Egreso registrado");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error");
              }
            })
          }
        >
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Input name="category" required placeholder="Limpieza, mantenimiento…" />
          </div>
          <div className="space-y-2">
            <Label>Monto (COP)</Label>
            <Input name="amount" type="number" min="0" step="1" required />
          </div>
          <div className="space-y-2">
            <Label>Método de pago</Label>
            <select
              name="paymentMethod"
              className="flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
              defaultValue="CASH"
            >
              <option value="CASH">Efectivo</option>
              <option value="TRANSFER">Transferencia</option>
              <option value="CARD">Tarjeta</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input name="expenseDate" type="date" required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Descripción</Label>
            <Input name="description" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>URL adjunto (factura / foto)</Label>
            <Input name="attachmentUrl" type="url" placeholder="https://…" />
          </div>
          <Button type="submit" disabled={pending} className="sm:col-span-2">
            Registrar egreso
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Otros ingresos" description="Servicios extra, check-in tardío, etc.">
        <form
          className="grid gap-3 p-4 sm:grid-cols-2"
          action={(fd) =>
            startTransition(async () => {
              try {
                await createOtherIncomeAction(fd);
                toast.success("Ingreso registrado");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error");
              }
            })
          }
        >
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Input name="incomeType" required placeholder="Check-in tardío" />
          </div>
          <div className="space-y-2">
            <Label>Monto (COP)</Label>
            <Input name="amount" type="number" min="0" step="1" required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Fecha</Label>
            <Input name="incomeDate" type="date" required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Descripción</Label>
            <Input name="description" />
          </div>
          <Button type="submit" disabled={pending} className="sm:col-span-2">
            Registrar ingreso
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createMobilityServiceAction,
  updateMobilityServiceAction,
} from "@/features/qr-mobility/actions/service.actions";
import {
  MOBILITY_SERVICE_CATEGORIES,
  emptyMobilityServiceFormValues,
  formatMobilityServiceCategory,
  serviceToFormValues,
  type MobilityServiceFormValues,
  type SerializedMobilityServiceRow,
} from "@/features/qr-mobility/types/service";
import {
  MOBILITY_RECORD_STATUSES,
  formatMobilityRecordStatus,
} from "@/features/qr-mobility/types/ally";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MobilityServiceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  service: SerializedMobilityServiceRow | null;
  onSuccess: () => void;
};

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

export function MobilityServiceFormDialog({
  open,
  onOpenChange,
  mode,
  service,
  onSuccess,
}: MobilityServiceFormDialogProps) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<MobilityServiceFormValues>(
    emptyMobilityServiceFormValues,
  );

  function handleOpenChange(next: boolean) {
    if (next) {
      setValues(
        mode === "edit" && service
          ? serviceToFormValues(service)
          : emptyMobilityServiceFormValues(),
      );
    }
    onOpenChange(next);
  }

  function updateField<K extends keyof MobilityServiceFormValues>(
    key: K,
    value: MobilityServiceFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const basePrice = Number.parseFloat(values.basePrice);
      if (Number.isNaN(basePrice)) {
        toast.error("El precio base es obligatorio");
        return;
      }

      const payload = {
        name: values.name,
        category: values.category,
        description: values.description || null,
        basePrice,
        nightPrice: parseOptionalNumber(values.nightPrice),
        holidayPrice: parseOptionalNumber(values.holidayPrice),
        scheduleText: values.scheduleText || null,
        status: values.status,
        sortOrder: Number.parseInt(values.sortOrder, 10) || 0,
        imageUrl: values.imageUrl || null,
        recommendedVehicle: values.recommendedVehicle || null,
        maxCapacity: parseOptionalNumber(values.maxCapacity),
        luggageAllowed: values.luggageAllowed || null,
      };

      const result =
        mode === "create"
          ? await createMobilityServiceAction(payload)
          : await updateMobilityServiceAction({ ...payload, id: service!.id });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(mode === "create" ? "Servicio creado" : "Servicio actualizado");
      handleOpenChange(false);
      onSuccess();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nuevo servicio" : "Editar servicio"}</DialogTitle>
          <DialogDescription>
            Configura traslados, tours, experiencias y otros servicios de movilidad.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="service-name">Nombre *</Label>
              <Input
                id="service-name"
                value={values.name}
                onChange={(event) => updateField("name", event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-category">Categoría *</Label>
              <select
                id="service-category"
                value={values.category}
                onChange={(event) =>
                  updateField(
                    "category",
                    event.target.value as MobilityServiceFormValues["category"],
                  )
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {MOBILITY_SERVICE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {formatMobilityServiceCategory(category)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-status">Estado</Label>
              <select
                id="service-status"
                value={values.status}
                onChange={(event) =>
                  updateField("status", event.target.value as MobilityServiceFormValues["status"])
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={mode === "create"}
              >
                {MOBILITY_RECORD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatMobilityRecordStatus(status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-description">Descripción</Label>
            <textarea
              id="service-description"
              value={values.description}
              onChange={(event) => updateField("description", event.target.value)}
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="service-base-price">Precio base *</Label>
              <Input
                id="service-base-price"
                type="number"
                min="0"
                step="0.01"
                value={values.basePrice}
                onChange={(event) => updateField("basePrice", event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-night-price">Precio nocturno</Label>
              <Input
                id="service-night-price"
                type="number"
                min="0"
                step="0.01"
                value={values.nightPrice}
                onChange={(event) => updateField("nightPrice", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-holiday-price">Precio festivo</Label>
              <Input
                id="service-holiday-price"
                type="number"
                min="0"
                step="0.01"
                value={values.holidayPrice}
                onChange={(event) => updateField("holidayPrice", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="service-schedule">Horarios</Label>
              <Input
                id="service-schedule"
                value={values.scheduleText}
                onChange={(event) => updateField("scheduleText", event.target.value)}
                placeholder="Ej. 06:00 – 22:00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-sort-order">Orden</Label>
              <Input
                id="service-sort-order"
                type="number"
                min="0"
                step="1"
                value={values.sortOrder}
                onChange={(event) => updateField("sortOrder", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-image">Imagen (URL)</Label>
            <Input
              id="service-image"
              value={values.imageUrl}
              onChange={(event) => updateField("imageUrl", event.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="service-vehicle">Vehículo recomendado</Label>
              <Input
                id="service-vehicle"
                value={values.recommendedVehicle}
                onChange={(event) => updateField("recommendedVehicle", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-capacity">Capacidad máxima</Label>
              <Input
                id="service-capacity"
                type="number"
                min="1"
                step="1"
                value={values.maxCapacity}
                onChange={(event) => updateField("maxCapacity", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-luggage">Equipaje permitido</Label>
              <Input
                id="service-luggage"
                value={values.luggageAllowed}
                onChange={(event) => updateField("luggageAllowed", event.target.value)}
                placeholder="Ej. 2 maletas"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : mode === "create" ? "Crear servicio" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

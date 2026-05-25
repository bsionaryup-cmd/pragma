"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deletePriceLabsOverridesAction,
  savePriceLabsOverrideAction,
} from "@/features/integrations/pricelabs/actions/pricelabs.actions";
import type { PriceLabsOverviewDto } from "@/services/integrations/pricelabs.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPriceLabsMoney, formatShortDate } from "@/features/integrations/pricelabs/lib/pricelabs-format";

type PriceLabsOverridesPanelProps = {
  overview: PriceLabsOverviewDto;
  canManage: boolean;
};

export function PriceLabsOverridesPanel({
  overview,
  canManage,
}: PriceLabsOverridesPanelProps) {
  const mapped = overview.properties.filter((property) => property.listingId);
  const [propertyId, setPropertyId] = useState(mapped[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [price, setPrice] = useState("");
  const [minStay, setMinStay] = useState("");
  const [pending, startTransition] = useTransition();

  const selected = mapped.find((property) => property.id === propertyId);
  const overrides = selected?.insights.upcomingOverrides ?? [];

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error inesperado");
      }
    });
  };

  return (
    <Card className="border-border bg-card shadow-pragma-soft">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Overrides / DSO</CardTitle>
        <p className="text-sm text-muted-foreground">
          Crea o elimina precios especiales por fecha vía API de PriceLabs.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canManage ? (
          <p className="text-sm text-muted-foreground">
            Solo usuarios con permiso de integraciones pueden editar overrides.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Propiedad</Label>
            <Select value={propertyId} onValueChange={setPropertyId} disabled={!canManage || pending}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona propiedad" />
              </SelectTrigger>
              <SelectContent>
                {mapped.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-override-date">Fecha</Label>
            <Input
              id="pl-override-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={!canManage || pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-override-price">Precio</Label>
            <Input
              id="pl-override-price"
              inputMode="numeric"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Opcional"
              disabled={!canManage || pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-override-min-stay">Min. noches</Label>
            <Input
              id="pl-override-min-stay"
              inputMode="numeric"
              value={minStay}
              onChange={(event) => setMinStay(event.target.value)}
              placeholder="Opcional"
              disabled={!canManage || pending}
            />
          </div>
        </div>

        {canManage ? (
          <Button
            type="button"
            size="sm"
            disabled={pending || !propertyId || !date}
            onClick={() =>
              run(() =>
                savePriceLabsOverrideAction({
                  propertyId,
                  date,
                  price,
                  minStay,
                }),
              )
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Guardar override
          </Button>
        ) : null}

        {overrides.length > 0 ? (
          <ul className="divide-y divide-border rounded-xl border border-border/70">
            {overrides.map((row) => (
              <li
                key={row.date}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{formatShortDate(row.date)}</p>
                  <p className="text-muted-foreground">
                    {row.price != null ? formatPriceLabsMoney(row.price) : "Sin precio"}
                    {row.minStay != null ? ` · min ${row.minStay} noche(s)` : ""}
                  </p>
                </div>
                {canManage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={pending || !propertyId}
                    onClick={() =>
                      run(() =>
                        deletePriceLabsOverridesAction({
                          propertyId,
                          dates: [row.date],
                        }),
                      )
                    }
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Eliminar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay overrides próximos para esta propiedad. Usa «Pull overrides» en sync o crea uno arriba.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateReservationOccupancyAction } from "@/features/reservations/actions/reservation.actions";
import {
  reservationOccupancyEditSchema,
  type ReservationOccupancyEditValues,
} from "@/features/reservations/schemas/reservation.schema";
import type { ReservationDetailItem } from "@/features/reservations/types/reservation.types";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { dispatchDashboardDataRefresh } from "@/lib/dashboard-refresh";
import {
  guestCapacityMessage,
  resolvePropertyMaxGuests,
} from "@/features/reservations/lib/reservation-guest-capacity";

type ReservationOccupancyEditFormProps = {
  reservation: ReservationDetailItem;
  onSaved: (reservation: ReservationDetailItem) => void;
  onCancel: () => void;
};

export function ReservationOccupancyEditForm({
  reservation,
  onSaved,
  onCancel,
}: ReservationOccupancyEditFormProps) {
  const router = useRouter();
  const propertyCapacity = resolvePropertyMaxGuests(
    reservation.property.maxGuests,
  );

  const form = useForm<ReservationOccupancyEditValues>({
    resolver: zodResolver(reservationOccupancyEditSchema),
    defaultValues: {
      adults: reservation.adults,
      children: reservation.children,
      infants: reservation.infants,
      maxGuests: propertyCapacity ?? undefined,
    },
  });

  const adults = form.watch("adults");
  const children = form.watch("children");
  const infants = form.watch("infants");
  const totalGuests = useMemo(
    () =>
      Math.max(0, Number(adults) || 0) +
      Math.max(0, Number(children) || 0) +
      Math.max(0, Number(infants) || 0),
    [adults, children, infants],
  );
  const expectedRegistration = Math.max(
    0,
    (Number(adults) || 0) + (Number(children) || 0),
  );

  async function onSubmit(values: ReservationOccupancyEditValues) {
    const result = await updateReservationOccupancyAction(reservation.id, {
      ...values,
      maxGuests: propertyCapacity ?? undefined,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.occupancy.registrationReopened) {
      toast.success(
        `Ocupación actualizada. Registro reabierto: faltan ${result.occupancy.pendingGuests} huésped${result.occupancy.pendingGuests === 1 ? "" : "es"}. STAY bloqueado hasta completar.`,
      );
    } else {
      toast.success("Ocupación actualizada");
    }
    dispatchDashboardDataRefresh();
    router.refresh();
    onSaved(result.reservation);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-3"
      >
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Editar ocupación
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Actualiza adultos, niños y bebés. Si aumentas la ocupación tras un
            registro completo, se reabre Guest Registration solo para los
            faltantes y STAY queda bloqueado hasta completar.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <FormField
            control={form.control}
            name="adults"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adultos</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="children"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Niños</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="infants"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bebés</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Total huéspedes:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {totalGuests}
          </span>
          {" · "}
          Esperados en registro (adultos+niños):{" "}
          <span className="font-medium tabular-nums text-foreground">
            {expectedRegistration}
          </span>
          {propertyCapacity != null
            ? ` · ${guestCapacityMessage(propertyCapacity)}`
            : null}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Guardar ocupación
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={form.formState.isSubmitting}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}

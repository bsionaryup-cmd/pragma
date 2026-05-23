"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateReservationAction } from "@/features/reservations/actions/reservation.actions";
import {
  reservationEditSchema,
  type ReservationEditValues,
} from "@/features/reservations/schemas/reservation.schema";
import type {
  PropertyOption,
  ReservationDetailItem,
} from "@/features/reservations/types/reservation.types";
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
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { dispatchDashboardDataRefresh } from "@/lib/dashboard-refresh";
import { formatPropertyLabel } from "@/lib/property-display";

type ReservationEditFormProps = {
  reservation: ReservationDetailItem;
  properties: PropertyOption[];
  onSaved: (reservation: ReservationDetailItem) => void;
  onCancel: () => void;
};

export function ReservationEditForm({
  reservation,
  properties,
  onSaved,
  onCancel,
}: ReservationEditFormProps) {
  const router = useRouter();
  const selectedProperty = properties.find((p) => p.id === reservation.property.id);
  const maxGuests = selectedProperty?.maxGuests ?? reservation.property.maxGuests ?? 99;

  const form = useForm<ReservationEditValues>({
    resolver: zodResolver(reservationEditSchema),
    defaultValues: {
      propertyId: reservation.property.id,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      adults: reservation.adults,
      children: reservation.children,
      infants: reservation.infants,
      guestFirstName: reservation.guestFirstName,
      guestLastName: reservation.guestLastName ?? "",
      guestEmail: reservation.guestEmail ?? "",
      guestPhone: reservation.guestPhone ?? "",
      guestCountry: reservation.guestCountry ?? "CO",
      guestLanguage: reservation.guestLanguage ?? "es",
      totalAmount: Number(reservation.totalAmount),
      internalNotes: reservation.internalNotes ?? "",
      maxGuests,
    },
  });

  const watchedPropertyId = form.watch("propertyId");
  const watchedMaxGuests =
    properties.find((p) => p.id === watchedPropertyId)?.maxGuests ?? maxGuests;

  async function onSubmit(values: ReservationEditValues) {
    const result = await updateReservationAction(reservation.id, {
      ...values,
      maxGuests: watchedMaxGuests,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Reserva actualizada");
    onSaved(result.reservation);
    router.refresh();
    dispatchDashboardDataRefresh();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 border-b border-border pb-4"
      >
        <FormField
          control={form.control}
          name="propertyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Propiedad</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {formatPropertyLabel(p)}
                      {p.maxGuests ? ` (máx. ${p.maxGuests})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="checkIn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Check-in</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="checkOut"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Check-out</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(["adults", "children", "infants"] as const).map((name) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {name === "adults"
                      ? "Adultos"
                      : name === "children"
                        ? "Niños"
                        : "Bebés"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={name === "adults" ? 1 : 0}
                      max={
                        name === "adults"
                          ? watchedMaxGuests
                          : watchedMaxGuests - 1
                      }
                      value={field.value}
                      onChange={(e) =>
                        field.onChange(e.target.valueAsNumber || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Capacidad máxima: {watchedMaxGuests} persona
          {watchedMaxGuests === 1 ? "" : "s"}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="guestFirstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="guestLastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellido</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="guestEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="guestPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Teléfono</FormLabel>
              <FormControl>
                <PhoneInput value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="totalAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Total ({reservation.currency})</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="internalNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas internas</FormLabel>
              <FormControl>
                <Textarea rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-1">
          <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Guardar cambios
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}

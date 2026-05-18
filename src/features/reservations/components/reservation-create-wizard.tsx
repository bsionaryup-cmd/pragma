"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createReservationAction } from "@/features/reservations/actions/reservation.actions";
import { countNights } from "@/features/reservations/lib/reservation-dates";
import {
  reservationStep1Schema,
  reservationStep2Schema,
  reservationWizardSchema,
  type ReservationWizardValues,
} from "@/features/reservations/schemas/reservation.schema";
import type {
  PropertyOption,
  ReservationInboxItem,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BookingPlatform, ReservationStatus } from "@prisma/client";
import { formatCurrency } from "@/lib/helpers";
import { platformLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Reserva" },
  { id: 2, label: "Huésped" },
  { id: 3, label: "Resumen" },
] as const;

export type ReservationCreateInitialValues = {
  propertyId?: string;
  checkIn?: string;
  checkOut?: string;
};

type ReservationCreateWizardProps = {
  properties: PropertyOption[];
  initialValues?: ReservationCreateInitialValues;
  onSuccess: (reservation: ReservationInboxItem) => void;
  onCancel: () => void;
};

export function ReservationCreateWizard({
  properties,
  initialValues,
  onSuccess,
  onCancel,
}: ReservationCreateWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ReservationWizardValues>({
    resolver: zodResolver(reservationWizardSchema),
    defaultValues: {
      propertyId: initialValues?.propertyId ?? "",
      checkIn: initialValues?.checkIn ?? "",
      checkOut: initialValues?.checkOut ?? "",
      adults: 1,
      children: 0,
      infants: 0,
      platform: BookingPlatform.DIRECT,
      internalNotes: "",
      guestFirstName: "",
      guestLastName: "",
      guestEmail: "",
      guestPhone: "",
      guestCountry: "CO",
      guestLanguage: "es",
      totalAmount: 0,
      status: ReservationStatus.CONFIRMED,
    },
  });

  useEffect(() => {
    if (!initialValues?.propertyId && !initialValues?.checkIn) return;
    form.reset({
      ...form.getValues(),
      propertyId: initialValues.propertyId ?? "",
      checkIn: initialValues.checkIn ?? "",
      checkOut: initialValues.checkOut ?? "",
    });
  }, [
    initialValues?.propertyId,
    initialValues?.checkIn,
    initialValues?.checkOut,
    form,
  ]);

  const values = form.getValues();
  const selectedProperty = properties.find((p) => p.id === values.propertyId);
  const nights =
    step === 3 && values.checkIn && values.checkOut
      ? countNights(values.checkIn, values.checkOut)
      : 0;

  async function goNext() {
    if (step === 1) {
      const ok = await form.trigger([
        "propertyId",
        "checkIn",
        "checkOut",
        "adults",
        "children",
        "infants",
        "platform",
      ]);
      if (!ok) return;
      const parsed = reservationStep1Schema.safeParse(form.getValues());
      if (!parsed.success) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      const ok = await form.trigger([
        "guestFirstName",
        "guestLastName",
        "guestEmail",
        "guestPhone",
        "guestCountry",
        "guestLanguage",
      ]);
      if (!ok) return;
      const parsed = reservationStep2Schema.safeParse(form.getValues());
      if (!parsed.success) return;
      setStep(3);
    }
  }

  async function onSubmit(data: ReservationWizardValues) {
    setIsSubmitting(true);
    try {
      const result = await createReservationAction(data);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Reserva creada");
      onSuccess(result.reservation);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo crear la reserva",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="flex border-b border-border px-1">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={cn(
                "flex-1 border-b-2 py-2.5 text-center text-xs font-medium transition-colors",
                step === s.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground",
              )}
            >
              {s.label}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Propiedad</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {properties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
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
                  name="children"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Niños</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
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
                  name="infants"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bebés</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origen</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(BookingPlatform).map((p) => (
                          <SelectItem key={p} value={p}>
                            {platformLabels[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
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
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="guestCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>País</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="guestLanguage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Idioma</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Propiedad</span>
                  <span className="font-medium text-right">{selectedProperty?.name ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Fechas</span>
                  <span className="font-medium tabular-nums">
                    {values.checkIn} → {values.checkOut}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Noches</span>
                  <span className="font-medium">{nights}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Huéspedes</span>
                  <span className="font-medium">
                    {values.adults} adultos
                    {values.children > 0 ? `, ${values.children} niños` : ""}
                    {values.infants > 0 ? `, ${values.infants} bebés` : ""}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Huésped</span>
                  <span className="font-medium">
                    {values.guestFirstName} {values.guestLastName}
                  </span>
                </div>
              </div>

              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor total (COP)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={1000}
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={ReservationStatus.CONFIRMED}>
                          Confirmada
                        </SelectItem>
                        <SelectItem value={ReservationStatus.CHECKED_IN}>
                          En curso
                        </SelectItem>
                        <SelectItem value={ReservationStatus.CHECKOUT_TODAY}>
                          Checkout hoy
                        </SelectItem>
                        <SelectItem value={ReservationStatus.BLOCKED}>
                          Bloqueada
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {values.totalAmount > 0 && (
                <p className="text-sm text-muted-foreground">
                  Total:{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(values.totalAmount)}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setStep((s) => s - 1)}
              disabled={isSubmitting}
            >
              Atrás
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
          )}

          {step < 3 ? (
            <Button type="button" className="flex-1" onClick={goNext}>
              Continuar
            </Button>
          ) : (
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear reserva"
              )}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type MouseEvent, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createReservationAction } from "@/features/reservations/actions/reservation.actions";
import { countNights } from "@/features/reservations/lib/reservation-dates";
import {
  clampGuestsToCapacity,
  guestCapacityMessage,
  guestTotalExceedsCapacity,
  resolvePropertyMaxGuests,
} from "@/features/reservations/lib/reservation-guest-capacity";
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
import { PhoneInput } from "@/components/ui/phone-input";
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
import { formatPropertyLabel } from "@/lib/property-display";
import { cn } from "@/lib/utils";
import type { ReservationCreateInitialValues } from "@/features/reservations/components/reservation-drawer";
import { copyReservationQuoteToClipboard } from "@/features/reservations/lib/reservation-quote-clipboard";

const STEPS = [
  { id: 1, label: "Reserva" },
  { id: 2, label: "Huésped" },
  { id: 3, label: "Resumen" },
] as const;

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
  const [summaryConfirmed, setSummaryConfirmed] = useState(false);
  const [isCopyingQuote, setIsCopyingQuote] = useState(false);

  const leaveTotalBlank = initialValues?.clearTotalAmount === true;
  const lockTotalAmount = initialValues?.lockTotalAmount === true;

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
      totalAmount: leaveTotalBlank ? 0 : (initialValues?.totalAmount ?? 0),
      status: ReservationStatus.CONFIRMED,
    },
  });

  const [totalAmountBlank, setTotalAmountBlank] = useState(leaveTotalBlank);

  useEffect(() => {
    if (
      !initialValues?.propertyId &&
      !initialValues?.checkIn &&
      initialValues?.totalAmount === undefined &&
      !initialValues?.clearTotalAmount
    ) {
      return;
    }

    const blank = initialValues?.clearTotalAmount === true;
    setTotalAmountBlank(blank);
    form.reset({
      ...form.getValues(),
      propertyId: initialValues?.propertyId ?? "",
      checkIn: initialValues?.checkIn ?? "",
      checkOut: initialValues?.checkOut ?? "",
      totalAmount: blank ? 0 : (initialValues?.totalAmount ?? 0),
    });
  }, [
    initialValues?.propertyId,
    initialValues?.checkIn,
    initialValues?.checkOut,
    initialValues?.totalAmount,
    initialValues?.clearTotalAmount,
    form,
  ]);

  const values = form.watch();
  const watchedPropertyId = values.propertyId;
  const selectedProperty = properties.find((p) => p.id === watchedPropertyId);
  const propertyCapacity = resolvePropertyMaxGuests(selectedProperty?.maxGuests);

  useEffect(() => {
    if (!watchedPropertyId) return;
    form.setValue("maxGuests", propertyCapacity ?? undefined, { shouldValidate: false });
    if (propertyCapacity == null) return;

    const { adults, children, infants } = form.getValues();
    if (guestTotalExceedsCapacity(adults, children, infants, propertyCapacity)) {
      const clamped = clampGuestsToCapacity(adults, children, infants, propertyCapacity);
      form.setValue("adults", clamped.adults, { shouldValidate: false });
      form.setValue("children", clamped.children, { shouldValidate: false });
      form.setValue("infants", clamped.infants, { shouldValidate: false });
      form.setError("adults", { message: guestCapacityMessage(propertyCapacity) });
    } else {
      form.clearErrors("adults");
    }
  }, [watchedPropertyId, propertyCapacity, form]);

  function applyGuestCount(
    field: "adults" | "children" | "infants",
    raw: number,
  ) {
    const min = field === "adults" ? 1 : 0;
    const next = Math.max(min, Number.isFinite(raw) ? Math.floor(raw) : min);
    const current = form.getValues();

    if (propertyCapacity == null) {
      form.setValue(field, next);
      return;
    }

    const draft = { ...current, [field]: next };
    if (
      guestTotalExceedsCapacity(
        draft.adults,
        draft.children,
        draft.infants,
        propertyCapacity,
      )
    ) {
      const clamped = clampGuestsToCapacity(
        draft.adults,
        draft.children,
        draft.infants,
        propertyCapacity,
      );
      form.setValue("adults", clamped.adults);
      form.setValue("children", clamped.children);
      form.setValue("infants", clamped.infants);
      form.setError("adults", { message: guestCapacityMessage(propertyCapacity) });
      return;
    }

    form.clearErrors("adults");
    form.setValue(field, next);
  }
  const nights =
    step === 3 && values.checkIn && values.checkOut
      ? countNights(values.checkIn, values.checkOut)
      : 0;

  async function handleCopyQuote() {
    if (!values.checkIn || !values.checkOut) {
      toast.error("Selecciona fechas de check-in y check-out.");
      return;
    }

    setIsCopyingQuote(true);
    try {
      await copyReservationQuoteToClipboard({
        checkIn: values.checkIn,
        checkOut: values.checkOut,
        propertyLabel: selectedProperty
          ? formatPropertyLabel(selectedProperty)
          : null,
        accommodationTotal: initialValues?.quoteBreakdown?.accommodationTotal,
        cleaningFee: initialValues?.quoteBreakdown?.cleaningFee,
        otherCharges: initialValues?.quoteBreakdown?.otherCharges,
        totalAmount: totalAmountBlank ? null : values.totalAmount,
        currency: initialValues?.quoteBreakdown?.currency ?? "COP",
      });
      toast.success("Cotización copiada al portapapeles.");
    } catch {
      toast.error("No se pudo copiar la cotización.");
    } finally {
      setIsCopyingQuote(false);
    }
  }

  async function goNext() {
    if (step === 1) {
      const ok = await form.trigger([
        "propertyId",
        "checkIn",
        "checkOut",
        "adults",
        "children",
        "infants",
      ]);
      if (!ok) return;
      const stepValues = form.getValues();
      const parsed = reservationStep1Schema.safeParse({
        ...stepValues,
        maxGuests: propertyCapacity ?? undefined,
      });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const path = issue.path[0];
          if (
            typeof path === "string" &&
            (path === "adults" || path === "checkOut" || path === "propertyId")
          ) {
            form.setError(path as "adults" | "checkOut" | "propertyId", {
              message: issue.message,
            });
          }
        }
        return;
      }
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
      setSummaryConfirmed(false);
      setStep(3);
    }
  }

  function goBack() {
    setSummaryConfirmed(false);
    setStep((s) => s - 1);
  }

  async function handleContinueClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    await goNext();
  }

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step < 3) {
      await goNext();
      return;
    }

    await form.handleSubmit(onSubmit)(event);
  }

  async function onSubmit(data: ReservationWizardValues) {
    if (step !== 3) return;
    if (!summaryConfirmed) {
      toast.error("Lee el resumen y confirma antes de crear la reserva");
      return;
    }
    if (totalAmountBlank) {
      form.setError("totalAmount", { message: "Ingresa el valor total" });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createReservationAction({
        ...data,
        maxGuests: propertyCapacity ?? undefined,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.airbnbCalendarLinked) {
        toast.success(
          "Reserva creada. Las fechas se publicaron al calendario de exportación; Airbnb las bloqueará en su próxima sincronización.",
          { duration: 6000 },
        );
      } else {
        toast.success("Reserva creada");
      }
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
      <form onSubmit={handleFormSubmit} className="flex h-full flex-col">
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
              {propertyCapacity != null ? (
                <p className="text-xs text-muted-foreground">
                  Capacidad máxima: {propertyCapacity} huésped
                  {propertyCapacity === 1 ? "" : "es"} (total adultos + niños + bebés)
                </p>
              ) : watchedPropertyId ? (
                <p className="text-xs text-warning">
                  Esta propiedad no tiene capacidad configurada.
                </p>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                          max={propertyCapacity ?? undefined}
                          value={field.value}
                          onChange={(e) =>
                            applyGuestCount("adults", e.target.valueAsNumber)
                          }
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
                          max={propertyCapacity ?? undefined}
                          value={field.value}
                          onChange={(e) =>
                            applyGuestCount("children", e.target.valueAsNumber)
                          }
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
                          max={propertyCapacity ?? undefined}
                          value={field.value}
                          onChange={(e) =>
                            applyGuestCount("infants", e.target.valueAsNumber)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                      <PhoneInput
                        value={field.value ?? ""}
                        onChange={field.onChange}
                      />
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
                  <span className="font-medium text-right">
                    {selectedProperty ? formatPropertyLabel(selectedProperty) : "—"}
                  </span>
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
                <p className="rounded-lg border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
                  La tarifa de aseo de la propiedad, si está configurada, se muestra en el
                  presupuesto solo como referencia. No se registra automáticamente como gasto
                  en finanzas.
                </p>
              </div>

              {values.checkIn && values.checkOut ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full text-[11px] font-semibold uppercase tracking-wide"
                  disabled={isCopyingQuote || isSubmitting}
                  onClick={handleCopyQuote}
                >
                  {isCopyingQuote ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Copy className="mr-2 h-3.5 w-3.5" />
                  )}
                  Copiar cotización
                </Button>
              ) : null}

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
                        readOnly={lockTotalAmount}
                        disabled={lockTotalAmount}
                        placeholder={totalAmountBlank ? "Ingrese el valor" : undefined}
                        className={cn(lockTotalAmount && "cursor-not-allowed bg-muted")}
                        value={totalAmountBlank ? "" : field.value}
                        onChange={(e) => {
                          if (lockTotalAmount) return;
                          const raw = e.target.value;
                          if (raw === "") {
                            setTotalAmountBlank(true);
                            field.onChange(0);
                            return;
                          }
                          setTotalAmountBlank(false);
                          field.onChange(e.target.valueAsNumber || 0);
                        }}
                        onFocus={() => {
                          if (lockTotalAmount) return;
                          if (totalAmountBlank && field.value === 0) {
                            setTotalAmountBlank(true);
                          }
                        }}
                      />
                    </FormControl>
                    {lockTotalAmount ? (
                      <p className="text-xs text-muted-foreground">
                        Monto calculado con tarifas PriceLabs y tarifa de aseo.
                      </p>
                    ) : null}
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

              {values.totalAmount > 0 && !totalAmountBlank && (
                <p className="text-sm text-muted-foreground">
                  Total:{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(values.totalAmount)}
                  </span>
                </p>
              )}

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={summaryConfirmed}
                  onChange={(event) =>
                    setSummaryConfirmed(event.currentTarget.checked)
                  }
                />
                <span>
                  Confirmo que leí el resumen y que los datos de la reserva son
                  correctos.
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={goBack}
              disabled={isSubmitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
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
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          )}

          {step < 3 ? (
            <Button
              type="button"
              className="flex-1"
              onClick={handleContinueClick}
              disabled={isSubmitting}
            >
              Continuar
            </Button>
          ) : (
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || !summaryConfirmed}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Confirmar reserva"
              )}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}

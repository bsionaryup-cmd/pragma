import { BookingPlatform, ReservationStatus } from "@prisma/client";
import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

/** Paso 1 — sin refine (fechas se validan en step1Schema y en wizard final) */
export const reservationStep1BaseSchema = z.object({
  propertyId: z.string().min(1, "Selecciona una propiedad"),
  checkIn: dateString,
  checkOut: dateString,
  adults: z.number().int().min(1, "Mínimo 1 adulto"),
  children: z.number().int().min(0),
  infants: z.number().int().min(0),
  platform: z.nativeEnum(BookingPlatform),
  internalNotes: z.string().optional(),
});

/** Paso 2 — huésped principal */
export const reservationStep2BaseSchema = z.object({
  guestFirstName: z.string().min(1, "Nombre requerido"),
  guestLastName: z.string().min(1, "Apellido requerido"),
  guestEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  guestPhone: z.string().optional(),
  guestCountry: z.string().optional(),
  guestLanguage: z.string().optional(),
});

/** Paso 3 — resumen / cobro */
export const reservationStep3BaseSchema = z.object({
  totalAmount: z.number().min(0, "Valor inválido"),
  status: z.nativeEnum(ReservationStatus),
});

/** Schemas por paso (con reglas de paso; NO derivados de .pick() sobre wizard refinado) */
export const reservationStep1Schema = reservationStep1BaseSchema.refine(
  (data) => new Date(data.checkOut) > new Date(data.checkIn),
  {
    message: "Check-out debe ser posterior al check-in",
    path: ["checkOut"],
  },
);

export const reservationStep2Schema = reservationStep2BaseSchema;

export const reservationStep3Schema = reservationStep3BaseSchema;

const reservationWizardBaseSchema = reservationStep1BaseSchema
  .merge(reservationStep2BaseSchema)
  .merge(reservationStep3BaseSchema);

function validateStayDates(
  data: z.infer<typeof reservationWizardBaseSchema>,
  ctx: z.RefinementCtx,
) {
  if (!data.checkIn || !data.checkOut) return;
  if (new Date(data.checkOut) <= new Date(data.checkIn)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Check-out debe ser posterior al check-in",
      path: ["checkOut"],
    });
  }
}

function validateGuestCounts(
  data: z.infer<typeof reservationWizardBaseSchema>,
  ctx: z.RefinementCtx,
) {
  const total = data.adults + data.children + data.infants;
  if (total < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe haber al menos un huésped",
      path: ["adults"],
    });
  }
}

/** Schema final del wizard — refine/superRefine solo aquí */
export const reservationWizardSchema = reservationWizardBaseSchema.superRefine(
  (data, ctx) => {
    validateStayDates(data, ctx);
    validateGuestCounts(data, ctx);
  },
);

export type ReservationWizardValues = z.infer<typeof reservationWizardBaseSchema>;

/** @deprecated Usar reservationWizardSchema */
export const reservationFormSchema = reservationWizardSchema;
export type ReservationFormValues = ReservationWizardValues;

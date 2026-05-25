import { BookingPlatform, ReservationStatus } from "@prisma/client";
import { z } from "zod";
import { isValidPhoneNumber } from "@/lib/phone/phone-number";

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
export const reservationStep1Schema = reservationStep1BaseSchema
  .extend({ maxGuests: z.number().int().min(1).optional() })
  .superRefine((data, ctx) => {
    if (new Date(data.checkOut) <= new Date(data.checkIn)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Check-out debe ser posterior al check-in",
        path: ["checkOut"],
      });
    }
    validateGuestCounts(data, ctx);
    validateMaxGuests(data, ctx);
  });

export const reservationStep2Schema = reservationStep2BaseSchema;

export const reservationStep3Schema = reservationStep3BaseSchema;

const reservationWizardBaseSchema = reservationStep1BaseSchema
  .merge(reservationStep2BaseSchema)
  .merge(reservationStep3BaseSchema);

function validateStayDates(
  data: { checkIn: string; checkOut: string },
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
  data: { adults: number; children: number; infants: number },
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

function validateMaxGuests(
  data: { adults: number; children: number; infants: number; maxGuests?: number },
  ctx: z.RefinementCtx,
) {
  const max = data.maxGuests;
  if (!max || max < 1) return;
  const total = data.adults + data.children + data.infants;
  if (total > max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Máximo ${max} huésped${max === 1 ? "" : "es"} (capacidad de la propiedad)`,
      path: ["adults"],
    });
  }
}

/** Schema final del wizard — refine/superRefine solo aquí */
export const reservationWizardSchema = reservationWizardBaseSchema
  .extend({ maxGuests: z.number().int().min(1).optional() })
  .superRefine((data, ctx) => {
    validateStayDates(data, ctx);
    validateGuestCounts(data, ctx);
    validateMaxGuests(data, ctx);
    if (data.platform !== BookingPlatform.DIRECT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Solo se permiten reservas directas desde el panel",
        path: ["platform"],
      });
    }
    if (data.guestPhone?.trim() && !isValidPhoneNumber(data.guestPhone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Teléfono inválido. Selecciona el código de país.",
        path: ["guestPhone"],
      });
    }
  });

export type ReservationWizardValues = z.infer<typeof reservationWizardBaseSchema> & {
  maxGuests?: number;
};

/** Edición de reserva (administradores) */
export const reservationEditSchema = reservationStep1BaseSchema
  .omit({ platform: true })
  .merge(reservationStep2BaseSchema)
  .merge(
    z.object({
      totalAmount: z.number().min(0, "Valor inválido"),
      internalNotes: z.string().optional(),
      maxGuests: z.number().int().min(1).optional(),
    }),
  )
  .superRefine((data, ctx) => {
    validateStayDates(data, ctx);
    validateGuestCounts(data, ctx);
    validateMaxGuests(data, ctx);
    if (data.guestPhone?.trim() && !isValidPhoneNumber(data.guestPhone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Teléfono inválido. Selecciona el código de país.",
        path: ["guestPhone"],
      });
    }
  });

export type ReservationEditValues = z.infer<typeof reservationEditSchema>;

/** @deprecated Usar reservationWizardSchema */
export const reservationFormSchema = reservationWizardSchema;
export type ReservationFormValues = ReservationWizardValues;

import { z } from "zod";
import {
  GUEST_SEX_CODES,
  GUEST_TRAVEL_MOTIVE_CODES,
  isIsoCountryCode,
} from "@/lib/guest-registration/canonical-guest-catalogs";
import { guestDocumentTypes } from "@/lib/guest-document-types";
import { isValidPhoneNumber } from "@/lib/phone/phone-number";

export const documentTypes = guestDocumentTypes;

const optionalEmail = z
  .string()
  .trim()
  .email("Email inválido")
  .optional()
  .or(z.literal(""));

const placeCountry = z
  .string()
  .trim()
  .min(2, "Selecciona un país")
  .refine(isIsoCountryCode, "País inválido");

const guestProfileFields = {
  sex: z.enum(GUEST_SEX_CODES, { message: "Selecciona el sexo" }),
  travelMotive: z.enum(GUEST_TRAVEL_MOTIVE_CODES, {
    message: "Selecciona el motivo de viaje",
  }),
  occupation: z.string().trim().min(2, "Ocupación / profesión requerida"),
  nationality: placeCountry,
  dateOfBirth: z
    .string()
    .trim()
    .min(1, "Fecha de nacimiento requerida")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  residenceCountry: placeCountry,
  residenceAdminArea: z.string().trim().min(1, "Departamento / estado requerido"),
  residenceCity: z.string().trim().min(1, "Ciudad de residencia requerida"),
  originCountry: placeCountry,
  originAdminArea: z.string().trim().min(1, "Departamento / estado de procedencia requerido"),
  originCity: z.string().trim().min(1, "Ciudad de procedencia requerida"),
  destinationCountry: placeCountry,
  destinationAdminArea: z
    .string()
    .trim()
    .min(1, "Departamento / estado de destino requerido"),
  destinationCity: z.string().trim().min(1, "Ciudad de destino requerida"),
};

export const guestStepSchema = z.object({
  token: z.string().min(16),
  firstName: z.string().trim().min(1, "Nombre requerido"),
  lastName: z.string().trim().min(1, "Apellido requerido"),
  documentType: z.enum(documentTypes, {
    message: "Selecciona un tipo de documento",
  }),
  documentNumber: z.string().trim().min(4, "Documento inválido"),
  email: optionalEmail,
  phone: z.string().trim().optional(),
  ...guestProfileFields,
});

export const completeGuestRegistrationSchema = z.object({
  token: z.string().min(16),
  confirmAllGuests: z.literal(true, {
    message: "Debes confirmar que registraste a todos los huéspedes",
  }),
  acceptLodgingContract: z.literal(true, {
    message: "Debes aceptar el contrato de hospedaje",
  }),
  acceptHabeasData: z.literal(true, {
    message: "Debes autorizar el tratamiento de datos personales",
  }),
  locale: z.string().trim().min(2).max(16).default("es-CO"),
});

const guestSchema = z.object({
  firstName: z.string().trim().min(1, "Nombre requerido"),
  lastName: z.string().trim().min(1, "Apellido requerido"),
  documentType: z.enum(documentTypes, {
    message: "Selecciona un tipo de documento",
  }),
  documentNumber: z.string().trim().min(4, "Documento inválido"),
  email: optionalEmail,
  phone: z.string().trim().optional(),
  ...guestProfileFields,
});

/** Legacy bulk submit — kept for compatibility; capped by property capacity server-side. */
export const guestRegistrationSchema = z
  .object({
    token: z.string().min(16),
    guests: z.array(guestSchema).min(1),
    acceptLodgingContract: z.literal(true, {
      message: "Debes aceptar el contrato de hospedaje",
    }),
    acceptHabeasData: z.literal(true, {
      message: "Debes autorizar el tratamiento de datos personales",
    }),
    locale: z.string().trim().min(2).max(16).default("es-CO"),
  })
  .superRefine((data, ctx) => {
    const documents = new Set<string>();

    data.guests.forEach((guest, index) => {
      if (index === 0) {
        if (!guest.email?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Email requerido para huésped principal",
            path: ["guests", index, "email"],
          });
        }
        if (!guest.phone?.trim() || !isValidPhoneNumber(guest.phone)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Teléfono inválido. Selecciona el código de país.",
            path: ["guests", index, "phone"],
          });
        }
      }

      const docKey = guest.documentNumber.trim().toLowerCase();
      if (documents.has(docKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Documento duplicado",
          path: ["guests", index, "documentNumber"],
        });
      }
      documents.add(docKey);
    });
  });

export type GuestStepValues = z.infer<typeof guestStepSchema>;
export type CompleteGuestRegistrationValues = z.infer<
  typeof completeGuestRegistrationSchema
>;
export type GuestRegistrationValues = z.infer<typeof guestRegistrationSchema>;

export type GuestRegistrationRequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

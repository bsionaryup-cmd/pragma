import { z } from "zod";
import { guestDocumentTypes } from "@/lib/guest-document-types";
import { isValidPhoneNumber } from "@/lib/phone/phone-number";

export const documentTypes = guestDocumentTypes;

export const guestStepSchema = z.object({
  token: z.string().min(16),
  firstName: z.string().trim().min(1, "Nombre requerido"),
  lastName: z.string().trim().min(1, "Apellido requerido"),
  documentType: z.enum(documentTypes, {
    message: "Selecciona un tipo de documento",
  }),
  documentNumber: z.string().trim().min(4, "Documento inválido"),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  nationality: z.string().trim().optional(),
  dateOfBirth: z.string().trim().optional(),
});

export const completeGuestRegistrationSchema = z.object({
  token: z.string().min(16),
  confirmAllGuests: z.literal(true, {
    message: "Debes confirmar que registraste a todos los huéspedes",
  }),
});

const guestSchema = z.object({
  firstName: z.string().trim().min(1, "Nombre requerido"),
  lastName: z.string().trim().min(1, "Apellido requerido"),
  documentType: z.enum(documentTypes, {
    message: "Selecciona un tipo de documento",
  }),
  documentNumber: z.string().trim().min(4, "Documento inválido"),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  nationality: z.string().trim().optional(),
  dateOfBirth: z.string().trim().optional(),
});

/** Legacy bulk submit — kept for compatibility; capped by property capacity server-side. */
export const guestRegistrationSchema = z
  .object({
    token: z.string().min(16),
    guests: z.array(guestSchema).min(1),
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

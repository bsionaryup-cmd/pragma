import { z } from "zod";

export const documentTypes = ["CC", "CE", "PASSPORT", "DNI", "OTHER"] as const;

const guestSchema = z.object({
  firstName: z.string().trim().min(1, "Nombre requerido"),
  lastName: z.string().trim().min(1, "Apellido requerido"),
  documentType: z.enum(documentTypes, {
    message: "Selecciona un tipo de documento",
  }),
  documentNumber: z.string().trim().min(4, "Documento inválido"),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().trim().optional(),
});

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
        if (!guest.phone?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Teléfono requerido para huésped principal",
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

export type GuestRegistrationValues = z.infer<typeof guestRegistrationSchema>;

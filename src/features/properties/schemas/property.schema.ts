import { PropertyStatus, PropertyType } from "@prisma/client";
import { z } from "zod";
import { parsePropertyNotificationEmails } from "@/lib/property-notification-emails";

export const propertyFormSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  unitNumber: z.string().optional(),
  description: z.string().optional(),
  propertyType: z.nativeEnum(PropertyType),
  maxGuests: z.number().int().min(1, "Mínimo 1 huésped"),
  bedrooms: z.number().int().min(0),
  beds: z.number().int().min(0),
  bathrooms: z.number().min(0.5, "Mínimo 0.5"),
  country: z.string().min(2, "País requerido"),
  city: z.string().min(2, "Ciudad requerida"),
  address: z.string().min(5, "Dirección requerida"),
  neighborhood: z.string().optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  accessCode: z.string().optional(),
  accessInstructions: z.string().optional(),
  wifiName: z.string().optional(),
  wifiPassword: z.string().optional(),
  houseRules: z.string().optional(),
  baseRate: z.number().min(0).optional(),
  cleaningFee: z.number().min(0).optional(),
  coverImageUrl: z
    .string()
    .optional()
    .refine((v) => !v || v === "" || /^https?:\/\/.+/.test(v), "URL inválida"),
  status: z.nativeEnum(PropertyStatus),
  /** One email per line in the form; stored as JSON array on the property. */
  notificationEmails: z.string().optional(),
  receptionWhatsapp: z.string().optional(),
  useDefaultQuickMessages: z.boolean().optional(),
  quickMessageWELCOME: z.string().optional(),
  quickMessageREGISTRATION: z.string().optional(),
  quickMessageACCESS: z.string().optional(),
  quickMessageFOLLOW_UP: z.string().optional(),
  quickMessageHOUSE_RULES: z.string().optional(),
  quickMessageCHECKOUT: z.string().optional(),
  quickMessageREVIEW: z.string().optional(),
});

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

export function notificationEmailsFormToJson(
  value: string | undefined,
): string[] {
  return parsePropertyNotificationEmails(value ?? "");
}

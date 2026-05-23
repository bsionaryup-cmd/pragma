import { PropertyStatus, PropertyType } from "@prisma/client";
import { z } from "zod";

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
});

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

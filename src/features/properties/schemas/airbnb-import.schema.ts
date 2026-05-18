import { z } from "zod";

export const airbnbImportSchema = z.object({
  listingUrl: z.string().min(10, "Enlace del anuncio requerido"),
  icalUrl: z.string().min(10, "Enlace iCal requerido"),
});

export type AirbnbImportInput = z.infer<typeof airbnbImportSchema>;

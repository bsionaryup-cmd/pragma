import type { BillingPlanCode } from "@prisma/client";

/** WhatsApp comercial oficial de PRAGMA (+57 323 390 2256). */
export const PRAGMA_COMMERCIAL_WHATSAPP_PHONE = "573233902256";

/** Enlace wa.me con mensaje de interés predefinido. */
export const PRAGMA_COMMERCIAL_WHATSAPP_URL = `https://wa.me/${PRAGMA_COMMERCIAL_WHATSAPP_PHONE}?text=Hola%2C%20estoy%20buscando%20una%20soluci%C3%B3n%20para%20administrar%20mis%20alojamientos%20y%20quisiera%20conocer%20PRAGMA.`;

export const LANDING_COMMERCIAL_CTAS = [
  "Solicitar demostración",
  "Solicitar información",
  "Hablar con un asesor",
  "Recibir propuesta personalizada",
] as const;

export const PLAN_COMMERCIAL_CTA: Record<BillingPlanCode, (typeof LANDING_COMMERCIAL_CTAS)[number]> =
  {
    STARTER: "Solicitar información",
    PRO: "Solicitar demostración",
    SCALE: "Recibir propuesta personalizada",
  };

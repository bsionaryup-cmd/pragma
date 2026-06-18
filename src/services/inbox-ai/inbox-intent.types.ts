/** Intenciones unificadas para Inbox AI (Fase 2+). */
export const INBOX_AI_INTENTS = [
  "CHECK_IN",
  "CHECK_OUT",
  "WIFI",
  "PARKING",
  "HOT_WATER",
  "EARLY_CHECKIN",
  "LATE_CHECKOUT",
  "HOUSE_RULES",
  "LOCATION",
  "PAYMENT",
  "DISCOUNT",
  "COMPLAINT",
  "EMERGENCY",
  "ACCESS",
  "OTHER",
] as const;

export type InboxAiIntent = (typeof INBOX_AI_INTENTS)[number];

export type InboxAiIntentDetection = {
  intent: InboxAiIntent;
  confidence: number;
  /** Detector que ganó (auditoría / compatibilidad). */
  source: "unified" | "legacy-novedades" | "legacy-airbnb-email";
};

export const INBOX_AI_INTENT_LABELS: Record<InboxAiIntent, string> = {
  CHECK_IN: "Check-in",
  CHECK_OUT: "Check-out",
  WIFI: "WiFi",
  PARKING: "Parqueadero",
  HOT_WATER: "Agua caliente",
  EARLY_CHECKIN: "Check-in anticipado",
  LATE_CHECKOUT: "Salida tardía",
  HOUSE_RULES: "Reglas de la casa",
  LOCATION: "Ubicación / llegada",
  PAYMENT: "Pago",
  DISCOUNT: "Descuento",
  COMPLAINT: "Queja",
  EMERGENCY: "Urgencia",
  ACCESS: "Acceso / llaves",
  OTHER: "General",
};

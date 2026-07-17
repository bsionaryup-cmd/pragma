/** Biblioteca de intenciones del Master Doc + mapeo operativo. */
export const CONCIERGE_INTENTS = [
  "WIFI",
  "TTLOCK",
  "CHECKIN",
  "CHECKOUT",
  "DIRECCION",
  "PARQUEADERO",
  "MASCOTAS",
  "LAVADORA",
  "TOALLAS",
  "RESTAURANTES",
  "FACTURACION",
  "PAGO",
  "GUEST_REGISTRATION",
  "DISPONIBILIDAD",
  "COTIZACION",
  "RESERVA",
  "REGLAS",
  "EARLY_CHECKIN",
  "LATE_CHECKOUT",
  "EMERGENCY",
  "COMPLAINT",
  "REFUND",
  "DISCOUNT",
  "OTHER",
] as const;

export type ConciergeIntent = (typeof CONCIERGE_INTENTS)[number];

export type ConciergeIntentDetection = {
  intent: ConciergeIntent;
  confidence: number;
  /** Nivel híbrido que resolvió la intención. */
  level: "L1" | "L2";
  source: "concierge-rules" | "inbox-ai-adapter";
};

export type ConciergeIntentDefinition = {
  intent: ConciergeIntent;
  label: string;
  /** Plantilla determinística; variables se sustituyen solo con hechos conocidos. */
  template: string;
  requiredFacts: string[];
  /** Tools de lectura sugeridas (Fase 6 las cableará). */
  suggestedReadTools: string[];
  /** Si true, nunca auto-responde (escala). */
  alwaysEscalate: boolean;
  /** Complejidad baja = candidata a automatización parcial (Fase 9). */
  complexity: "low" | "medium" | "high";
};

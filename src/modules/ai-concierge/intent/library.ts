import type {
  ConciergeIntent,
  ConciergeIntentDefinition,
} from "@/modules/ai-concierge/types/intent";
import { CONCIERGE_INTENTS } from "@/modules/ai-concierge/types/intent";

const DEFINITIONS: Record<ConciergeIntent, ConciergeIntentDefinition> = {
  WIFI: {
    intent: "WIFI",
    label: "WiFi",
    template:
      "La red WiFi es {{wifiName}}. La contraseña es {{wifiPassword}}.",
    requiredFacts: ["wifiName", "wifiPassword"],
    suggestedReadTools: ["get_property_guest_info"],
    alwaysEscalate: false,
    complexity: "low",
  },
  TTLOCK: {
    intent: "TTLOCK",
    label: "Código TTLock",
    template:
      "Tu código de acceso es {{accessCode}}. Es válido desde {{accessValidFrom}} hasta {{accessValidTo}}.",
    requiredFacts: ["accessCode", "accessValidFrom", "accessValidTo"],
    suggestedReadTools: ["get_access_status"],
    alwaysEscalate: false,
    complexity: "low",
  },
  CHECKIN: {
    intent: "CHECKIN",
    label: "Check-in",
    template:
      "El check-in es a partir de las {{checkInTime}}. {{accessInstructions}}",
    requiredFacts: ["checkInTime"],
    suggestedReadTools: ["get_property_guest_info", "get_reservation"],
    alwaysEscalate: false,
    complexity: "low",
  },
  CHECKOUT: {
    intent: "CHECKOUT",
    label: "Check-out",
    template:
      "El check-out es hasta las {{checkOutTime}}. Por favor deja las llaves/acceso según las instrucciones.",
    requiredFacts: ["checkOutTime"],
    suggestedReadTools: ["get_property_guest_info", "get_reservation"],
    alwaysEscalate: false,
    complexity: "low",
  },
  DIRECCION: {
    intent: "DIRECCION",
    label: "Dirección",
    template: "La dirección de la propiedad es {{address}}.",
    requiredFacts: ["address"],
    suggestedReadTools: ["get_property_guest_info"],
    alwaysEscalate: false,
    complexity: "low",
  },
  PARQUEADERO: {
    intent: "PARQUEADERO",
    label: "Parqueadero",
    template: "{{parkingInfo}}",
    requiredFacts: ["parkingInfo"],
    suggestedReadTools: ["get_property_guest_info"],
    alwaysEscalate: false,
    complexity: "low",
  },
  MASCOTAS: {
    intent: "MASCOTAS",
    label: "Mascotas",
    template: "{{petsPolicy}}",
    requiredFacts: ["petsPolicy"],
    suggestedReadTools: ["get_property_guest_info"],
    alwaysEscalate: false,
    complexity: "low",
  },
  LAVADORA: {
    intent: "LAVADORA",
    label: "Lavadora",
    template: "{{laundryInfo}}",
    requiredFacts: ["laundryInfo"],
    suggestedReadTools: ["get_property_guest_info"],
    alwaysEscalate: false,
    complexity: "low",
  },
  TOALLAS: {
    intent: "TOALLAS",
    label: "Toallas",
    template: "{{towelsInfo}}",
    requiredFacts: ["towelsInfo"],
    suggestedReadTools: ["get_property_guest_info"],
    alwaysEscalate: false,
    complexity: "low",
  },
  RESTAURANTES: {
    intent: "RESTAURANTES",
    label: "Restaurantes",
    template: "{{restaurantsInfo}}",
    requiredFacts: ["restaurantsInfo"],
    suggestedReadTools: ["get_property_guest_info"],
    alwaysEscalate: false,
    complexity: "medium",
  },
  FACTURACION: {
    intent: "FACTURACION",
    label: "Facturación",
    template: "{{billingInfo}}",
    requiredFacts: ["billingInfo"],
    suggestedReadTools: ["get_payment_balance"],
    alwaysEscalate: false,
    complexity: "medium",
  },
  PAGO: {
    intent: "PAGO",
    label: "Pago",
    template:
      "El saldo pendiente es {{balanceDue}} {{currency}}. {{paymentInstructions}}",
    requiredFacts: ["balanceDue", "currency"],
    suggestedReadTools: ["get_payment_balance", "list_payment_links"],
    alwaysEscalate: false,
    complexity: "medium",
  },
  GUEST_REGISTRATION: {
    intent: "GUEST_REGISTRATION",
    label: "Guest Registration",
    template:
      "Por favor completa tu registro de huéspedes aquí: {{guestRegistrationUrl}}. Estado actual: {{guestRegistrationStatus}}.",
    requiredFacts: ["guestRegistrationUrl", "guestRegistrationStatus"],
    suggestedReadTools: ["get_guest_registration_status"],
    alwaysEscalate: false,
    complexity: "low",
  },
  DISPONIBILIDAD: {
    intent: "DISPONIBILIDAD",
    label: "Disponibilidad",
    template:
      "Para esas fechas te confirmo lo que veo en el calendario. Si aún no tengo el detalle, te pido entrada, salida y número de huéspedes.",
    requiredFacts: [],
    suggestedReadTools: ["search_availability", "get_calendar"],
    alwaysEscalate: false,
    complexity: "medium",
  },
  COTIZACION: {
    intent: "COTIZACION",
    label: "Cotización",
    template:
      "Con gusto te armo la cotización. ¿Me compartes fechas de entrada y salida y para cuántas personas?",
    requiredFacts: [],
    suggestedReadTools: ["calculate_stay_quote"],
    alwaysEscalate: false,
    complexity: "medium",
  },
  RESERVA: {
    intent: "RESERVA",
    label: "Reserva",
    template:
      "Para avanzar con tu reserva necesito fechas, número de personas y confirmar la propiedad. ¿Me las compartes?",
    requiredFacts: [],
    suggestedReadTools: ["get_reservation", "search_reservations"],
    alwaysEscalate: false,
    complexity: "high",
  },
  REGLAS: {
    intent: "REGLAS",
    label: "Reglas",
    template:
      "Te comparto las reglas de la casa de la propiedad. ¿Me confirmas de cuál se trata?",
    requiredFacts: [],
    suggestedReadTools: ["get_property_guest_info"],
    alwaysEscalate: false,
    complexity: "low",
  },
  EARLY_CHECKIN: {
    intent: "EARLY_CHECKIN",
    label: "Check-in anticipado",
    template: "{{earlyCheckInPolicy}}",
    requiredFacts: ["earlyCheckInPolicy"],
    suggestedReadTools: ["get_property_guest_info", "get_reservation"],
    alwaysEscalate: false,
    complexity: "medium",
  },
  LATE_CHECKOUT: {
    intent: "LATE_CHECKOUT",
    label: "Check-out tardío",
    template: "{{lateCheckOutPolicy}}",
    requiredFacts: ["lateCheckOutPolicy"],
    suggestedReadTools: ["get_property_guest_info", "get_reservation"],
    alwaysEscalate: false,
    complexity: "medium",
  },
  EMERGENCY: {
    intent: "EMERGENCY",
    label: "Emergencia",
    template: "",
    requiredFacts: [],
    suggestedReadTools: [],
    alwaysEscalate: true,
    complexity: "high",
  },
  COMPLAINT: {
    intent: "COMPLAINT",
    label: "Queja",
    template: "",
    requiredFacts: [],
    suggestedReadTools: [],
    alwaysEscalate: true,
    complexity: "high",
  },
  REFUND: {
    intent: "REFUND",
    label: "Reembolso",
    template: "",
    requiredFacts: [],
    suggestedReadTools: [],
    alwaysEscalate: true,
    complexity: "high",
  },
  DISCOUNT: {
    intent: "DISCOUNT",
    label: "Descuento extraordinario",
    template: "",
    requiredFacts: [],
    suggestedReadTools: [],
    alwaysEscalate: true,
    complexity: "high",
  },
  OTHER: {
    intent: "OTHER",
    label: "General / ambiguo",
    template: "",
    requiredFacts: [],
    suggestedReadTools: [],
    alwaysEscalate: false,
    complexity: "high",
  },
};

export { CONCIERGE_INTENTS };

export function getConciergeIntentDefinition(
  intent: ConciergeIntent,
): ConciergeIntentDefinition {
  return DEFINITIONS[intent];
}

export function listConciergeIntentDefinitions(): ConciergeIntentDefinition[] {
  return CONCIERGE_INTENTS.map((intent) => DEFINITIONS[intent]);
}

/** Sustituye {{var}} solo si el hecho existe; deja marcadores sin inventar. */
export function renderIntentTemplate(
  template: string,
  facts: Record<string, string | number | boolean | null | undefined>,
): { text: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const text = template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const value = facts[key];
    if (value === null || value === undefined || value === "") {
      unresolved.push(key);
      return `{{${key}}}`;
    }
    return String(value);
  });
  return { text, unresolved };
}

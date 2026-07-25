/**
 * Conversation domain knowledge index (v2.0 corpus).
 * Additive metadata for flows — does NOT replace intent library or tools.
 */
import type { ConciergeIntent } from "@/modules/ai-concierge/types/intent";

export type ConciergeConversationDomain = {
  id: string;
  label: string;
  intents: ConciergeIntent[];
  /** Ordered dialogue steps (human funnel) */
  flow: string[];
  /** Slots typically required */
  slots: string[];
  /** Clarifying questions when slots missing */
  missingQuestions: string[];
  /** Example guest phrasings (informal + formal) */
  variations: string[];
};

export const CONCIERGE_CONVERSATION_DOMAINS: ConciergeConversationDomain[] = [
  {
    id: "disponibilidad",
    label: "Disponibilidad",
    intents: ["DISPONIBILIDAD", "COTIZACION", "RESERVA"],
    flow: ["fechas", "personas", "consultar_calendario", "responder", "invitar_reserva"],
    slots: ["checkIn", "checkOut", "guests", "propertyId"],
    missingQuestions: [
      "¿Para qué fechas?",
      "¿Para cuántas personas?",
      "¿Qué propiedad o zona te interesa?",
    ],
    variations: [
      "hay cupo",
      "tienes algo",
      "necesito un apartamento",
      "busco alojamiento",
      "tienen habitaciones",
      "esta libre",
      "hay disponibilidad",
    ],
  },
  {
    id: "wifi",
    label: "WiFi",
    intents: ["WIFI"],
    flow: ["identificar_propiedad", "consultar_wifi", "responder_clave"],
    slots: ["propertyId", "wifiName", "wifiPassword"],
    missingQuestions: ["¿De qué propiedad necesitas el WiFi?"],
    variations: ["wifi", "clave del wifi", "contraseña internet", "y la contraseña"],
  },
  {
    id: "checkin",
    label: "Check-in / llegada",
    intents: ["CHECKIN", "EARLY_CHECKIN", "TTLOCK", "GUEST_REGISTRATION"],
    flow: ["confirmar_reserva", "horario", "acceso", "responder"],
    slots: ["reservationId", "checkInTime", "accessCode"],
    missingQuestions: ["¿A qué nombre está la reserva?"],
    variations: ["a que hora entro", "llegada", "check in", "codigo puerta"],
  },
  {
    id: "checkout",
    label: "Check-out / salida",
    intents: ["CHECKOUT", "LATE_CHECKOUT"],
    flow: ["confirmar_reserva", "horario_salida", "responder"],
    slots: ["reservationId", "checkOutTime"],
    missingQuestions: ["¿Hasta qué hora necesitas la salida?"],
    variations: ["hora de salida", "late checkout", "salir mas tarde"],
  },
  {
    id: "pagos",
    label: "Pagos",
    intents: ["PAGO", "FACTURACION", "REFUND"],
    flow: ["identificar_reserva", "consultar_saldo", "responder_o_escalar"],
    slots: ["reservationId", "amountDue"],
    missingQuestions: ["¿Me confirmas el nombre de la reserva?"],
    variations: ["link de pago", "transferencia", "factura", "abono"],
  },
  {
    id: "ubicacion",
    label: "Ubicación / transporte",
    intents: ["DIRECCION"],
    flow: ["identificar_propiedad", "consultar_direccion", "responder"],
    slots: ["propertyId", "address"],
    missingQuestions: ["¿Para qué propiedad necesitas la dirección?"],
    variations: ["como llegar", "direccion", "mapa", "uber", "taxi"],
  },
  {
    id: "mascotas",
    label: "Mascotas",
    intents: ["MASCOTAS"],
    flow: ["consultar_politica", "responder"],
    slots: ["propertyId", "petsAllowed"],
    missingQuestions: [],
    variations: ["aceptan perros", "mascota", "gato", "pet friendly"],
  },
  {
    id: "problemas",
    label: "Problemas / emergencias",
    intents: ["COMPLAINT", "EMERGENCY", "TTLOCK"],
    flow: ["clasificar", "escalar_o_guiar"],
    slots: [],
    missingQuestions: ["¿Qué está pasando exactamente?"],
    variations: ["no funciona", "urgente", "emergencia", "no abre la puerta"],
  },
];

export function findDomainForIntent(
  intent: ConciergeIntent,
): ConciergeConversationDomain | null {
  return (
    CONCIERGE_CONVERSATION_DOMAINS.find((d) => d.intents.includes(intent)) ??
    null
  );
}

/**
 * Registry of operational hospitality protocols (v3.0).
 * Cards only — execution stays in workflow-menu / availability-flow / tools.
 */
import type {
  HospitalityProtocolDefinition,
  HospitalityProtocolId,
} from "@/modules/ai-concierge/hospitality-protocols/types";

export const HOSPITALITY_PROTOCOL_DEFINITIONS: Record<
  Exclude<HospitalityProtocolId, "WELCOME" | "MAIN_MENU" | "IDLE">,
  HospitalityProtocolDefinition
> = {
  BOOKINGS: {
    id: "BOOKINGS",
    name: "Reservas y disponibilidad",
    objective: "Cotizar o iniciar creación de reserva con datos reales de PRAGMA",
    required: ["checkIn", "checkOut", "guests"],
    optional: ["propertyId"],
    validations: ["fechas ordenadas", "huéspedes 1–20"],
    pmsQueries: ["search_availability", "calculate_stay_quote"],
    tools: ["search_availability", "calculate_stay_quote"],
    advanceWhen: "Cada slot obligatorio capturado",
    finishWhen: "Disponibilidad/precio mostrados y decisión de reservar respondida",
    escalateWhen: "Tool FAILED o propiedad ambigua",
    workflowIds: ["availability", "quote", "promotions", "bookings"],
  },
  BOOKING_CREATE: {
    id: "BOOKING_CREATE",
    name: "Creación de reserva",
    objective: "Crear reserva Direct solo tras confirmación y resultado real del PMS",
    required: ["checkIn", "checkOut", "guests", "guestName", "confirm"],
    optional: ["guestEmail", "guestPhone", "propertyId"],
    validations: ["nombre", "email o skip", "sí/no explícito"],
    pmsQueries: ["search_availability", "calculate_stay_quote"],
    tools: ["reservation_adapter", "create_direct_reservation"],
    advanceWhen: "Dato faltante capturado",
    finishWhen: "Adapter OK con reservationId real (nunca asumir éxito)",
    escalateWhen: "Adapter FAILED — entonces sí handoff",
    workflowIds: ["booking_create"],
  },
  MY_RESERVATION: {
    id: "MY_RESERVATION",
    name: "Mi reserva",
    objective: "Consultar/modificar/cancelar solo tras consultar PRAGMA",
    required: ["reservationId|guestName"],
    optional: ["confirmationCode"],
    validations: ["identidad mínima antes de mutar"],
    pmsQueries: ["get_reservation"],
    tools: ["get_reservation"],
    advanceWhen: "Reserva identificada en PMS",
    finishWhen: "Dato PMS entregado o cancelación escalada",
    escalateWhen: "Modificar/cancelar sin escritura segura",
    workflowIds: [
      "reservation_info",
      "reservation_modify",
      "cancel",
      "registration_docs",
      "my_reservation",
    ],
  },
  STAY: {
    id: "STAY",
    name: "Durante mi estancia",
    objective: "WiFi, acceso, check-in/out, limpieza, problemas — solo datos PMS",
    required: ["propertyId|reservation"],
    optional: ["guestName"],
    validations: ["nunca inventar claves/códigos"],
    pmsQueries: ["get_property_facts", "get_access_status", "get_reservation"],
    tools: ["get_property_facts", "get_access_status", "get_reservation"],
    advanceWhen: "Propiedad o reserva identificada",
    finishWhen: "Hecho PMS entregado",
    escalateWhen: "Sin dato en PMS o problema operativo",
    workflowIds: [
      "wifi",
      "ttlock",
      "checkin",
      "issue",
      "cleaning",
      "tourism",
      "stay",
    ],
  },
  PAYMENTS: {
    id: "PAYMENTS",
    name: "Pagos y facturación",
    objective: "Saldos, pagos y enlaces solo desde PMS — nunca calcular a mano",
    required: ["reservationId|guestName"],
    optional: [],
    validations: ["montos solo de tool"],
    pmsQueries: ["get_payment_balance", "get_reservation"],
    tools: ["get_payment_balance", "get_reservation"],
    advanceWhen: "Reserva identificada",
    finishWhen: "Saldo/enlace PMS entregado",
    escalateWhen: "Sin registro de pago",
    workflowIds: ["payments"],
  },
  RECEPTION: {
    id: "RECEPTION",
    name: "Hablar con recepción",
    objective: "Escalar a humano conservando contexto completo",
    required: [],
    optional: ["guestName", "summary"],
    validations: [],
    pmsQueries: [],
    tools: [],
    advanceWhen: "Solicitud explícita de asesor",
    finishWhen: "Handoff registrado sin perder hechos",
    escalateWhen: "Inmediato",
    workflowIds: ["human", "human_handoff"],
  },
};

export function getHospitalityProtocol(
  id: HospitalityProtocolId,
): HospitalityProtocolDefinition | null {
  if (id === "WELCOME" || id === "MAIN_MENU" || id === "IDLE") return null;
  return HOSPITALITY_PROTOCOL_DEFINITIONS[id] ?? null;
}

export function listHospitalityProtocols(): HospitalityProtocolDefinition[] {
  return Object.values(HOSPITALITY_PROTOCOL_DEFINITIONS);
}

/** Map workflow-menu ids / flow names → protocol. */
export function protocolFromWorkflowId(
  workflowId: string | null | undefined,
): HospitalityProtocolId {
  if (!workflowId || workflowId === "menu" || workflowId === "idle") {
    return workflowId === "idle" ? "IDLE" : "MAIN_MENU";
  }
  for (const def of listHospitalityProtocols()) {
    if (def.workflowIds.includes(workflowId)) return def.id;
  }
  if (workflowId === "availability") return "BOOKINGS";
  return "MAIN_MENU";
}

export function protocolFromPendingAction(
  pendingAction: string | null | undefined,
  flow: string | null | undefined,
  activeWorkflow?: string | null,
): HospitalityProtocolId {
  if (
    pendingAction === "ask_guest_name" ||
    pendingAction === "ask_guest_email" ||
    pendingAction === "await_final_confirm" ||
    pendingAction === "booking_created"
  ) {
    return "BOOKING_CREATE";
  }
  if (
    pendingAction === "ask_check_in" ||
    pendingAction === "ask_check_out" ||
    pendingAction === "ask_guests" ||
    pendingAction === "ask_dates" ||
    pendingAction === "ask_dates_guests" ||
    pendingAction === "ask_property" ||
    pendingAction === "await_confirm" ||
    pendingAction === "await_book_confirm" ||
    pendingAction === "offer_alternative" ||
    flow === "availability"
  ) {
    return "BOOKINGS";
  }
  if (pendingAction === "await_cancel_confirm") return "MY_RESERVATION";
  if (pendingAction === "human_review" || pendingAction === "human_handoff") {
    return "RECEPTION";
  }
  if (pendingAction === "await_guest_name") return "WELCOME";
  if (pendingAction === "await_menu_choice" || flow === "menu") return "MAIN_MENU";
  return protocolFromWorkflowId(activeWorkflow || flow);
}

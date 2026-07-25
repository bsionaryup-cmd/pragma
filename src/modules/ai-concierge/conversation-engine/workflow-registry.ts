/**
 * Workflow Registry — single catalog of Concierge workflows.
 * Reuses WORKFLOW_DEFINITIONS / menu; does not duplicate business logic.
 */
import {
  WORKFLOW_DEFINITIONS,
  MAIN_MENU,
  type ConciergeWorkflowDefinition,
  type MenuGroupId,
} from "@/modules/ai-concierge/dialogue/workflow-menu";
import {
  RESERVATION_WORKFLOW_STEPS,
  type ReservationWorkflowStep,
  type WorkflowStepDefinition,
} from "@/modules/ai-concierge/conversation-engine/types";

export {
  WORKFLOW_DEFINITIONS,
  MAIN_MENU,
  type ConciergeWorkflowDefinition,
  type MenuGroupId,
};

/**
 * Plan registry ids → existing WORKFLOW_DEFINITIONS keys.
 * Planned-but-not-yet-defined (Ubicacion/Equipaje/Factura/FAQ) map to closest
 * leaf or human until those definitions are added — never invent a second engine.
 */
export const WORKFLOW_REGISTRY_IDS = [
  "Reservation",
  "Availability",
  "CheckIn",
  "CheckOut",
  "Tarifas",
  "Ubicacion",
  "Equipaje",
  "Factura",
  "FAQ",
  "Recepcion",
  "Wifi",
  "Ttlock",
  "Cancel",
  "Payments",
] as const;

export type WorkflowRegistryId = (typeof WORKFLOW_REGISTRY_IDS)[number];

const REGISTRY_TO_DEFINITION: Record<WorkflowRegistryId, string> = {
  Reservation: "booking_create",
  Availability: "availability",
  CheckIn: "checkin",
  CheckOut: "checkin",
  Tarifas: "quote",
  Ubicacion: "human",
  Equipaje: "human",
  Factura: "payments",
  FAQ: "human",
  Recepcion: "human",
  Wifi: "wifi",
  Ttlock: "ttlock",
  Cancel: "cancel",
  Payments: "payments",
};

export function getWorkflowDefinition(
  id: WorkflowRegistryId | string,
): ConciergeWorkflowDefinition | null {
  const key =
    id in REGISTRY_TO_DEFINITION
      ? REGISTRY_TO_DEFINITION[id as WorkflowRegistryId]
      : id;
  return WORKFLOW_DEFINITIONS[key] ?? null;
}

export function listRegisteredWorkflows(): Array<{
  registryId: WorkflowRegistryId;
  definitionKey: string;
  definition: ConciergeWorkflowDefinition | null;
}> {
  return WORKFLOW_REGISTRY_IDS.map((registryId) => ({
    registryId,
    definitionKey: REGISTRY_TO_DEFINITION[registryId],
    definition: getWorkflowDefinition(registryId),
  }));
}

/** Formal reservation step machine (messages are rendered elsewhere). */
export const RESERVATION_STEP_MACHINE: Record<
  ReservationWorkflowStep,
  WorkflowStepDefinition
> = {
  WELCOME: {
    id: "WELCOME",
    messageHint: "Saludo + menú principal",
    validationHint: "ninguna",
    next: "MENU",
    onError: "menu",
  },
  MENU: {
    id: "MENU",
    messageHint: "Opciones 1–5 / NL",
    validationHint: "opción válida o keyword",
    next: "RESERVATION",
    onError: "reprompt",
  },
  RESERVATION: {
    id: "RESERVATION",
    messageHint: "Entrar flujo disponibilidad/reserva",
    validationHint: "intent comercial o menú 1",
    next: "PEOPLE",
    onError: "menu",
  },
  PEOPLE: {
    id: "PEOPLE",
    messageHint: "Número de huéspedes",
    validationHint: "entero 1–20",
    next: "CHECKIN",
    onError: "reprompt",
  },
  CHECKIN: {
    id: "CHECKIN",
    messageHint: "Fecha check-in",
    validationHint: "fecha parseable",
    next: "CHECKOUT",
    onError: "reprompt",
  },
  CHECKOUT: {
    id: "CHECKOUT",
    messageHint: "Fecha check-out",
    validationHint: "fecha > check-in",
    next: "AVAILABILITY",
    onError: "reprompt",
  },
  AVAILABILITY: {
    id: "AVAILABILITY",
    messageHint: "Resultado PMS availability + quote",
    validationHint: "tools OK",
    next: "SUMMARY",
    onError: "escalate",
  },
  SUMMARY: {
    id: "SUMMARY",
    messageHint: "Resumen estancia",
    validationHint: "huésped entiende oferta",
    next: "CONFIRM",
    onError: "reprompt",
  },
  CONFIRM: {
    id: "CONFIRM",
    messageHint: "Confirmación explícita SÍ/NO",
    validationHint: "sí|no",
    next: "GUEST_DATA",
    onError: "reprompt",
  },
  GUEST_DATA: {
    id: "GUEST_DATA",
    messageHint: "Nombre (+ email opcional)",
    validationHint: "nombre no vacío",
    next: "CREATE_RESERVATION",
    onError: "reprompt",
  },
  CREATE_RESERVATION: {
    id: "CREATE_RESERVATION",
    messageHint: "Solo vía Reservation Adapter",
    validationHint: "adapter.ok && reservationId",
    next: "FINISHED",
    onError: "escalate",
  },
  FINISHED: {
    id: "FINISHED",
    messageHint: "Confirmación con ID real o handoff",
    validationHint: "n/a",
    next: null,
    onError: "end",
  },
};

export function assertReservationStepMachineComplete(): boolean {
  return RESERVATION_WORKFLOW_STEPS.every((s) => Boolean(RESERVATION_STEP_MACHINE[s]));
}

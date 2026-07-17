import type { ConciergeToolDefinition } from "@/modules/ai-concierge/types/tool";

export const PLANNED_WRITE_TOOLS: ConciergeToolDefinition[] = [
  {
    name: "register_arrival_time",
    description: "Registrar hora de llegada estimada en notas internas",
    risk: "write",
    enabledFromPhase: 10,
    inputSchemaHint: { reservationId: "string", arrivalTime: "string" },
  },
  {
    name: "create_operational_task",
    description: "Crear tarea operativa vinculada a reserva/propiedad",
    risk: "write",
    enabledFromPhase: 10,
    inputSchemaHint: {
      title: "string",
      description: "string?",
      reservationId: "string?",
      propertyId: "string?",
    },
  },
  {
    name: "send_guest_registration_invite",
    description: "Enviar/reenviar correo de Guest Registration",
    risk: "write",
    enabledFromPhase: 10,
    inputSchemaHint: { reservationId: "string", force: "boolean?" },
  },
  {
    name: "resend_access_code_email",
    description: "Reenviar correo de código TTLock",
    risk: "access",
    enabledFromPhase: 10,
    inputSchemaHint: { reservationId: "string", force: "boolean?" },
  },
  {
    name: "create_direct_reservation",
    description: "Crear reserva Directa",
    risk: "write",
    enabledFromPhase: 11,
    inputSchemaHint: {
      propertyId: "string",
      checkIn: "string",
      checkOut: "string",
      guestFirstName: "string",
      guestEmail: "string?",
      totalAmount: "number",
    },
  },
];

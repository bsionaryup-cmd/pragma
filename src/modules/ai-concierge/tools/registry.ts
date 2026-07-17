import type {
  ConciergeToolDefinition,
  ConciergeToolInvocationRecord,
  ConciergeToolResult,
} from "@/modules/ai-concierge/types/tool";

/** Contratos de tools — cableado a servicios = Fase 6+ (enabledFromPhase). */
export const PLANNED_READ_TOOLS: ConciergeToolDefinition[] = [
  {
    name: "search_reservations",
    description: "Buscar reservas del tenant",
    risk: "read",
    enabledFromPhase: 6,
    inputSchemaHint: { query: "string", propertyId: "string?" },
  },
  {
    name: "get_reservation",
    description: "Obtener detalle de reserva",
    risk: "read",
    enabledFromPhase: 6,
    inputSchemaHint: { reservationId: "string" },
  },
  {
    name: "get_property_guest_info",
    description: "WiFi, reglas, dirección, check-in/out (filtrado)",
    risk: "read",
    enabledFromPhase: 6,
    inputSchemaHint: { propertyId: "string" },
  },
  {
    name: "get_calendar",
    description: "Consultar calendario / ocupación",
    risk: "read",
    enabledFromPhase: 6,
    inputSchemaHint: { propertyId: "string", anchorKey: "string?" },
  },
  {
    name: "search_availability",
    description: "Disponibilidad por fechas",
    risk: "read",
    enabledFromPhase: 6,
    inputSchemaHint: { propertyId: "string", checkIn: "string", checkOut: "string" },
  },
  {
    name: "calculate_stay_quote",
    description: "Cotización grounded en tarifas",
    risk: "read",
    enabledFromPhase: 6,
    inputSchemaHint: { propertyId: "string", checkIn: "string", checkOut: "string" },
  },
  {
    name: "get_payment_balance",
    description: "Saldo / estado de pago de reserva",
    risk: "read",
    enabledFromPhase: 6,
    inputSchemaHint: { reservationId: "string" },
  },
  {
    name: "list_payment_links",
    description: "Links de pago de la reserva",
    risk: "read",
    enabledFromPhase: 6,
    inputSchemaHint: { reservationId: "string" },
  },
  {
    name: "get_guest_registration_status",
    description: "Estado / link de Guest Registration",
    risk: "read",
    enabledFromPhase: 6,
    inputSchemaHint: { reservationId: "string" },
  },
  {
    name: "get_access_status",
    description: "Estado TTLock / código (sin filtrar secretos indebidos)",
    risk: "access",
    enabledFromPhase: 6,
    inputSchemaHint: { reservationId: "string" },
  },
  {
    name: "get_operational_contacts",
    description: "Contactos operativos de la propiedad",
    risk: "read",
    enabledFromPhase: 6,
    inputSchemaHint: { propertyId: "string" },
  },
];

export type ConciergeToolHandler = (
  input: unknown,
) => Promise<ConciergeToolResult> | ConciergeToolResult;

export type ConciergeToolRegistry = {
  listDefinitions: () => ConciergeToolDefinition[];
  getDefinition: (name: string) => ConciergeToolDefinition | undefined;
  registerHandler: (name: string, handler: ConciergeToolHandler) => void;
  /**
   * Fase 5: si no hay handler o fase < enabledFromPhase → planned/skipped, nunca inventa data.
   */
  invoke: (input: {
    toolName: string;
    args: unknown;
    currentPhase: number;
  }) => Promise<ConciergeToolInvocationRecord>;
};

function newId(): string {
  return `tool_${Math.random().toString(36).slice(2, 10)}`;
}

export function createToolRegistry(
  definitions: ConciergeToolDefinition[] = PLANNED_READ_TOOLS,
): ConciergeToolRegistry {
  const defs = new Map(definitions.map((d) => [d.name, d]));
  const handlers = new Map<string, ConciergeToolHandler>();

  return {
    listDefinitions: () => [...defs.values()],
    getDefinition: (name) => defs.get(name),
    registerHandler: (name, handler) => {
      if (!defs.has(name)) {
        throw new Error(`Tool no registrada en catálogo: ${name}`);
      }
      handlers.set(name, handler);
    },
    invoke: async ({ toolName, args, currentPhase }) => {
      const at = new Date().toISOString();
      const def = defs.get(toolName);
      if (!def) {
        return {
          id: newId(),
          toolName,
          input: args,
          result: { ok: false, error: "Tool desconocida" },
          status: "denied",
          at,
        };
      }
      if (currentPhase < def.enabledFromPhase) {
        return {
          id: newId(),
          toolName,
          input: args,
          result: {
            ok: false,
            error: `Tool habilitada desde Fase ${def.enabledFromPhase}`,
          },
          status: "planned",
          at,
        };
      }
      const handler = handlers.get(toolName);
      if (!handler) {
        return {
          id: newId(),
          toolName,
          input: args,
          result: { ok: false, error: "Handler no cableado" },
          status: "skipped",
          at,
        };
      }
      try {
        const result = await handler(args);
        return {
          id: newId(),
          toolName,
          input: args,
          result,
          status: "executed",
          at,
        };
      } catch (error) {
        return {
          id: newId(),
          toolName,
          input: args,
          result: {
            ok: false,
            error: error instanceof Error ? error.message : "Tool error",
          },
          status: "executed",
          at,
        };
      }
    },
  };
}

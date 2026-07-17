export type ConciergeToolRisk = "read" | "write" | "financial" | "access";

export type ConciergeToolDefinition = {
  name: string;
  description: string;
  risk: ConciergeToolRisk;
  /** Fase en la que se autoriza cablear el servicio real. */
  enabledFromPhase: number;
  inputSchemaHint: Record<string, string>;
};

export type ConciergeToolResult = {
  ok: boolean;
  /** Datos grounded; nunca inventados por el orquestador. */
  data?: unknown;
  error?: string;
  /** Si faltan hechos, el motor debe pedirlos o escalar. */
  missingFacts?: string[];
};

export type ConciergeToolInvocationRecord = {
  id: string;
  toolName: string;
  input: unknown;
  result: ConciergeToolResult | null;
  /** Fase 5: execute no cableado → siempre planned. */
  status: "planned" | "executed" | "skipped" | "denied";
  at: string;
};

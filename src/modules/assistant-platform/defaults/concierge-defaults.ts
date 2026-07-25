/**
 * Default Concierge playbook — mirrors current hardcoded guest copy.
 * Studio publishes overrides; resolver always falls back here.
 */
import type {
  AssistantGuardRailsConfig,
  AssistantIdentityConfig,
  AssistantMessageTemplates,
  AssistantPromptConfig,
  AssistantProtocolsConfig,
  ResolvedAssistantPlaybook,
} from "@/modules/assistant-platform/types";
import { CONCIERGE_SYSTEM_PROMPT } from "@/modules/ai-concierge/engine/behavior-context";
import { CONCIERGE_IDENTITY_LINE_GUEST } from "@/modules/ai-concierge/hospitality-protocols/welcome";
import { defaultMessageTemplates } from "@/modules/assistant-platform/defaults/default-message-templates";

export const DEFAULT_IDENTITY: AssistantIdentityConfig = {
  displayName: "Asistente Virtual de Recepción",
  presentation: CONCIERGE_IDENTITY_LINE_GUEST,
  language: "es",
  tone: "profesional, cálido, breve",
  formality: "warm",
  useEmojis: true,
  signature: "",
  welcomeMessage: "",
  farewellMessage: "Que tengas una excelente estadía.",
};

import { DEFAULT_INSTRUCTIONS, SYSTEM_RULES } from "@/modules/assistant-platform/studio/studio-model";

export const DEFAULT_PROMPT: AssistantPromptConfig = {
  globalBehavior: CONCIERGE_SYSTEM_PROMPT,
  objectives:
    "Ayudar con reservas, estancia, pagos y consultas usando solo datos oficiales del proveedor PMS.",
  priorities: "1) No inventar 2) Un paso lógico 3) Confirmar writes 4) Escalar emergencias",
  howToAsk:
    "Pedir datos relacionados en un solo mensaje; guiar con ejemplos no parseables.",
  howToFinish:
    "Confirmar resultado con referencia oficial; ofrecer menú; no continuar solo.",
  whenConfused: "Pedir aclaración breve o ofrecer menú / recepción humana.",
  whenAmbiguous: "Listar opciones concretas y esperar elección del huésped.",
  style: "Claro, breve, profesional; sin jerga técnica innecesaria.",
  behavior:
    "Un mensaje por turno; avanzar un paso lógico; preferir datos del Knowledge Center y del PMS.",
  restrictions:
    "No inventar; no confirmar writes sin tool; no mezclar sesiones; no usar ejemplos del copy como datos.",
  escalation:
    "Emergencias, disputas de pago, fallos de herramienta o pedidos fuera de alcance → recepción humana.",
  instructions: DEFAULT_INSTRUCTIONS,
};

export const DEFAULT_GUARD_RAILS: AssistantGuardRailsConfig = {
  neverInventFacts: true,
  neverConfirmWithoutValidation: true,
  neverCrossSessionContext: true,
  neverMultiSend: true,
  neverDoubleReply: true,
  neverCreateFakeReservations: true,
  neverSwitchWorkflowWithoutAuth: true,
  extraRules: [
    "Nunca usar ejemplos del copy como datos reales del huésped.",
    "Nunca reutilizar contexto de una sesión cerrada.",
  ],
  rules: SYSTEM_RULES,
};

export { defaultMessageTemplates };

export const DEFAULT_PROTOCOLS: AssistantProtocolsConfig = {
  WELCOME: {
    objective: "Identificar al huésped y presentar al asistente virtual",
    messagesByStep: {
      await_guest_name: "welcome_ask_name",
    },
  },
  BOOKINGS: {
    objective: "Consultar disponibilidad y cotizar con datos PMS",
    messagesByStep: {
      ask_dates_guests: "ask_dates_guests",
    },
  },
  BOOKING_CREATE: {
    objective: "Crear reserva solo tras confirmación y tool OK",
    finishWhen: "create_direct_reservation ok",
    escalateWhen: "tool fail / disputa",
  },
};

export function buildDefaultPlaybook(): ResolvedAssistantPlaybook {
  const messages = defaultMessageTemplates();
  return {
    assistantId: null,
    version: null,
    identity: DEFAULT_IDENTITY,
    prompt: DEFAULT_PROMPT,
    guardRails: DEFAULT_GUARD_RAILS,
    messages,
    protocols: DEFAULT_PROTOCOLS,
    systemPrompt: CONCIERGE_SYSTEM_PROMPT,
    source: "defaults",
  };
}

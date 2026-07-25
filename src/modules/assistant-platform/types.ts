/**
 * Assistant Platform — shared types (Studio + runtime resolver).
 * Additive: Concierge remains the first assistant; PMS is a knowledge provider.
 */

export type AssistantIdentityConfig = {
  displayName: string;
  presentation: string;
  language: string;
  tone: string;
  formality: "formal" | "neutral" | "warm";
  useEmojis: boolean;
  signature: string;
  welcomeMessage: string;
  farewellMessage: string;
};

export type AssistantPromptConfig = {
  globalBehavior: string;
  objectives: string;
  priorities: string;
  howToAsk: string;
  howToFinish: string;
  whenConfused: string;
  whenAmbiguous: string;
  /** Prompt Studio — estilo / restricciones / escalamiento (texto libre). */
  style?: string;
  behavior?: string;
  restrictions?: string;
  escalation?: string;
  /** Instrucciones editables desde Assistant Studio (español). */
  instructions?: Array<{
    id: string;
    title: string;
    description: string;
    text: string;
    enabled: boolean;
    sortOrder: number;
  }>;
  /** Metadatos de UI (protocolos/acciones/recepcionista) — no altera el FSM hasta Fase 3. */
  studioMeta?: {
    protocolsList?: Array<Record<string, unknown>>;
    actions?: Array<Record<string, unknown>>;
    menuItems?: Array<Record<string, unknown>>;
    workflowFlags?: Record<string, boolean>;
    workflows?: Array<Record<string, unknown>>;
  };
};

export type AssistantGuardRailsConfig = {
  neverInventFacts: boolean;
  neverConfirmWithoutValidation: boolean;
  neverCrossSessionContext: boolean;
  neverMultiSend: boolean;
  neverDoubleReply: boolean;
  neverCreateFakeReservations: boolean;
  neverSwitchWorkflowWithoutAuth: boolean;
  extraRules: string[];
  /** Reglas visuales del Studio (prioridad máxima). */
  rules?: Array<{
    id: string;
    title: string;
    description: string;
    enabled: boolean;
    system?: boolean;
  }>;
};

/** Stable keys — Studio edits values; engine looks up by key. */
export type MessageTemplateKey =
  | "welcome_ask_name"
  | "welcome_post_name"
  | "ask_dates_guests"
  | "ask_dates_guests_partial"
  | "soft_continue_ask_dates"
  | "soft_continue_await_confirm"
  | "soft_continue_ask_guest_name"
  | "soft_continue_ask_guest_email"
  | "soft_continue_await_final_confirm"
  | "soft_continue_post_booking"
  | "soft_continue_default"
  | "availability_entry"
  | "identity_line"
  | "menu_main"
  | "payment_info"
  | "wifi_info"
  | "checkin_info"
  | "checkout_info"
  | "escalate_human"
  | "farewell";

export type AssistantMessageTemplates = Partial<
  Record<MessageTemplateKey, string>
>;

export type AssistantProtocolStepOverride = {
  objective?: string;
  messagesByStep?: Record<string, string>;
  escalateWhen?: string;
  finishWhen?: string;
};

export type AssistantProtocolsConfig = Record<
  string,
  AssistantProtocolStepOverride
>;

export type ResolvedAssistantPlaybook = {
  assistantId: string | null;
  version: number | null;
  identity: AssistantIdentityConfig;
  prompt: AssistantPromptConfig;
  guardRails: AssistantGuardRailsConfig;
  messages: AssistantMessageTemplates;
  protocols: AssistantProtocolsConfig;
  /** Merged system prompt for LLM (defaults + Studio). */
  systemPrompt: string;
  source: "defaults" | "published";
};

export type KnowledgeProviderDescriptor = {
  key: string;
  displayName: string;
  description: string;
  capabilities: string[];
};

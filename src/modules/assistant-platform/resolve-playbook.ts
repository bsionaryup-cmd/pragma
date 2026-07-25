/**
 * Resolve published playbook for an org — always falls back to Concierge defaults.
 */
import { db } from "@/lib/db";
import { buildDefaultPlaybook } from "@/modules/assistant-platform/defaults/concierge-defaults";
import type {
  AssistantGuardRailsConfig,
  AssistantIdentityConfig,
  AssistantMessageTemplates,
  AssistantPromptConfig,
  AssistantProtocolsConfig,
  MessageTemplateKey,
  ResolvedAssistantPlaybook,
} from "@/modules/assistant-platform/types";

export {
  renderTemplate,
  resolveMessage,
  resolveWelcomeAskName,
  resolvePostNameMenu,
} from "@/modules/assistant-platform/resolve-playbook-messages";

const CONCIERGE_SLUG = "pragma-concierge";

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mergeIdentity(
  base: AssistantIdentityConfig,
  raw: Record<string, unknown>,
): AssistantIdentityConfig {
  return {
    displayName:
      typeof raw.displayName === "string" ? raw.displayName : base.displayName,
    presentation:
      typeof raw.presentation === "string" ? raw.presentation : base.presentation,
    language: typeof raw.language === "string" ? raw.language : base.language,
    tone: typeof raw.tone === "string" ? raw.tone : base.tone,
    formality:
      raw.formality === "formal" ||
      raw.formality === "neutral" ||
      raw.formality === "warm"
        ? raw.formality
        : base.formality,
    useEmojis:
      typeof raw.useEmojis === "boolean" ? raw.useEmojis : base.useEmojis,
    signature:
      typeof raw.signature === "string" ? raw.signature : base.signature,
    welcomeMessage:
      typeof raw.welcomeMessage === "string"
        ? raw.welcomeMessage
        : base.welcomeMessage,
    farewellMessage:
      typeof raw.farewellMessage === "string"
        ? raw.farewellMessage
        : base.farewellMessage,
  };
}

function mergePrompt(
  base: AssistantPromptConfig,
  raw: Record<string, unknown>,
): AssistantPromptConfig {
  return {
    globalBehavior:
      typeof raw.globalBehavior === "string"
        ? raw.globalBehavior
        : base.globalBehavior,
    objectives:
      typeof raw.objectives === "string" ? raw.objectives : base.objectives,
    priorities:
      typeof raw.priorities === "string" ? raw.priorities : base.priorities,
    howToAsk: typeof raw.howToAsk === "string" ? raw.howToAsk : base.howToAsk,
    howToFinish:
      typeof raw.howToFinish === "string" ? raw.howToFinish : base.howToFinish,
    whenConfused:
      typeof raw.whenConfused === "string"
        ? raw.whenConfused
        : base.whenConfused,
    whenAmbiguous:
      typeof raw.whenAmbiguous === "string"
        ? raw.whenAmbiguous
        : base.whenAmbiguous,
    style: typeof raw.style === "string" ? raw.style : base.style,
    behavior: typeof raw.behavior === "string" ? raw.behavior : base.behavior,
    restrictions:
      typeof raw.restrictions === "string"
        ? raw.restrictions
        : base.restrictions,
    escalation:
      typeof raw.escalation === "string" ? raw.escalation : base.escalation,
    instructions: Array.isArray(raw.instructions)
      ? (raw.instructions as AssistantPromptConfig["instructions"])
      : base.instructions,
    studioMeta:
      raw.studioMeta && typeof raw.studioMeta === "object"
        ? (raw.studioMeta as AssistantPromptConfig["studioMeta"])
        : base.studioMeta,
  };
}

function mergeGuards(
  base: AssistantGuardRailsConfig,
  raw: Record<string, unknown>,
): AssistantGuardRailsConfig {
  const bool = (k: keyof AssistantGuardRailsConfig, fallback: boolean) =>
    typeof raw[k] === "boolean" ? (raw[k] as boolean) : fallback;
  return {
    neverInventFacts: bool("neverInventFacts", base.neverInventFacts),
    neverConfirmWithoutValidation: bool(
      "neverConfirmWithoutValidation",
      base.neverConfirmWithoutValidation,
    ),
    neverCrossSessionContext: bool(
      "neverCrossSessionContext",
      base.neverCrossSessionContext,
    ),
    neverMultiSend: bool("neverMultiSend", base.neverMultiSend),
    neverDoubleReply: bool("neverDoubleReply", base.neverDoubleReply),
    neverCreateFakeReservations: bool(
      "neverCreateFakeReservations",
      base.neverCreateFakeReservations,
    ),
    neverSwitchWorkflowWithoutAuth: bool(
      "neverSwitchWorkflowWithoutAuth",
      base.neverSwitchWorkflowWithoutAuth,
    ),
    extraRules: Array.isArray(raw.extraRules)
      ? raw.extraRules.filter((x): x is string => typeof x === "string")
      : base.extraRules,
    rules: Array.isArray(raw.rules)
      ? (raw.rules as AssistantGuardRailsConfig["rules"])
      : base.rules,
  };
}

function mergeMessages(
  base: AssistantMessageTemplates,
  raw: Record<string, unknown>,
): AssistantMessageTemplates {
  const out: AssistantMessageTemplates = { ...base };
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v.trim()) {
      out[k as MessageTemplateKey] = v;
    }
  }
  return out;
}

function composeSystemPrompt(
  identity: AssistantIdentityConfig,
  prompt: AssistantPromptConfig,
  guards: AssistantGuardRailsConfig,
): string {
  const ruleLines =
    guards.rules
      ?.filter((r) => r.enabled)
      .map((r) => `- ${r.title}: ${r.description}`) ?? [];
  const guardLines = [
    guards.neverInventFacts && "Nunca inventes hechos (wifi, precios, códigos, disponibilidad).",
    guards.neverConfirmWithoutValidation &&
      "Nunca confirmes acciones sin validación de herramienta.",
    guards.neverCrossSessionContext &&
      "Nunca uses contexto de otra sesión o contacto.",
    guards.neverMultiSend && "Nunca envíes múltiples mensajes por turno.",
    guards.neverDoubleReply && "Nunca respondas dos veces al mismo inbound.",
    guards.neverCreateFakeReservations &&
      "Nunca afirmes una reserva sin tool OK.",
    guards.neverSwitchWorkflowWithoutAuth &&
      "Nunca cambies de workflow sin autorización explícita.",
    ...guards.extraRules,
    ...ruleLines,
  ].filter(Boolean);

  const instructionLines =
    prompt.instructions
      ?.filter((i) => i.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => `- ${i.title}: ${i.text}`) ?? [];

  return [
    `Identidad: ${identity.displayName}. ${identity.presentation}`,
    `Idioma: ${identity.language}. Tono: ${identity.tone}. Formalidad: ${identity.formality}.`,
    prompt.globalBehavior,
    `Objetivos: ${prompt.objectives}`,
    `Prioridades: ${prompt.priorities}`,
    instructionLines.length
      ? ["Instrucciones generales:", ...instructionLines].join("\n")
      : "",
    `Cómo pedir info: ${prompt.howToAsk}`,
    `Cómo finalizar: ${prompt.howToFinish}`,
    `Si no entiende: ${prompt.whenConfused}`,
    `Si hay ambigüedad: ${prompt.whenAmbiguous}`,
    prompt.style ? `Estilo: ${prompt.style}` : "",
    prompt.behavior ? `Comportamiento: ${prompt.behavior}` : "",
    prompt.restrictions ? `Restricciones: ${prompt.restrictions}` : "",
    prompt.escalation ? `Escalamiento: ${prompt.escalation}` : "",
    "REGLAS OBLIGATORIAS (prioridad máxima):",
    ...guardLines.map((l) => (String(l).startsWith("-") ? String(l) : `- ${l}`)),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Load published org playbook or safe defaults (never throws into guest path).
 */
export async function resolveAssistantPlaybook(input: {
  organizationId: string;
  slug?: string;
}): Promise<ResolvedAssistantPlaybook> {
  const defaults = buildDefaultPlaybook();
  try {
    const slug = input.slug ?? CONCIERGE_SLUG;
    const assistant = await db.assistantDefinition.findFirst({
      where: {
        organizationId: input.organizationId,
        slug,
        status: "PUBLISHED",
      },
      include: {
        publishedVersion: true,
      },
    });
    const ver = assistant?.publishedVersion;
    if (!assistant || !ver) return defaults;

    const identity = mergeIdentity(defaults.identity, asObject(ver.identityJson));
    const prompt = mergePrompt(defaults.prompt, asObject(ver.promptJson));
    const guardRails = mergeGuards(
      defaults.guardRails,
      asObject(ver.guardRailsJson),
    );
    const messages = mergeMessages(
      defaults.messages,
      asObject(ver.messageTemplatesJson),
    );
    const protocols = {
      ...defaults.protocols,
      ...(asObject(ver.protocolsJson) as AssistantProtocolsConfig),
    };

    return {
      assistantId: assistant.id,
      version: ver.version,
      identity,
      prompt,
      guardRails,
      messages,
      protocols,
      systemPrompt: composeSystemPrompt(identity, prompt, guardRails),
      source: "published",
    };
  } catch {
    return defaults;
  }
}

function playbookFromVersionRow(
  defaults: ResolvedAssistantPlaybook,
  assistantId: string,
  ver: {
    version: number;
    identityJson: unknown;
    promptJson: unknown;
    guardRailsJson: unknown;
    messageTemplatesJson: unknown;
    protocolsJson: unknown;
  },
  source: "defaults" | "published",
): ResolvedAssistantPlaybook {
  const identity = mergeIdentity(defaults.identity, asObject(ver.identityJson));
  const prompt = mergePrompt(defaults.prompt, asObject(ver.promptJson));
  const guardRails = mergeGuards(
    defaults.guardRails,
    asObject(ver.guardRailsJson),
  );
  const messages = mergeMessages(
    defaults.messages,
    asObject(ver.messageTemplatesJson),
  );
  const protocols = {
    ...defaults.protocols,
    ...(asObject(ver.protocolsJson) as AssistantProtocolsConfig),
  };
  return {
    assistantId,
    version: ver.version,
    identity,
    prompt,
    guardRails,
    messages,
    protocols,
    systemPrompt: composeSystemPrompt(identity, prompt, guardRails),
    source,
  };
}

/** Load a specific version (draft or published) for Studio simulator / restore preview. */
export async function resolvePlaybookFromVersionId(
  versionId: string,
  organizationId: string,
): Promise<ResolvedAssistantPlaybook> {
  const defaults = buildDefaultPlaybook();
  try {
    const ver = await db.assistantPlaybookVersion.findFirst({
      where: { id: versionId },
      include: {
        assistant: { select: { id: true, organizationId: true } },
      },
    });
    if (!ver || ver.assistant.organizationId !== organizationId) {
      return defaults;
    }
    return playbookFromVersionRow(
      defaults,
      ver.assistant.id,
      ver,
      ver.publishedAt ? "published" : "defaults",
    );
  } catch {
    return defaults;
  }
}

export { CONCIERGE_SLUG };

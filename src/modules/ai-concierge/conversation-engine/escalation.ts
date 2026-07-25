/**
 * Escalation paths — never leave conversations blocked.
 * Pure helpers; compose/availability apply the replies.
 */
import { buildMainMenuMessage } from "@/modules/ai-concierge/dialogue/workflow-menu";

export type EscalationKind = "menu" | "reception" | "end" | "reprompt";

export type EscalationOutcome = {
  kind: EscalationKind;
  reply: string;
  flow: string;
  pendingAction: string | null;
  path: "deterministic" | "escalate";
  factsPatch: Record<string, string | number | boolean | null>;
};

export function escalateToMenu(guestName?: string | null): EscalationOutcome {
  return {
    kind: "menu",
    reply: buildMainMenuMessage(guestName),
    flow: "menu",
    pendingAction: "await_menu_choice",
    path: "deterministic",
    factsPatch: {
      flowTopic: "menu",
      bookingConfirmed: false,
      reservationWorkflowStep: "MENU",
    },
  };
}

export function escalateToReception(input?: {
  guestName?: string | null;
  summary?: string | null;
}): EscalationOutcome {
  const nameBit = input?.guestName ? ` (${input.guestName})` : "";
  const summaryBit = input?.summary ? ` Contexto: ${input.summary}` : "";
  return {
    kind: "reception",
    reply: `Te conecto con recepción${nameBit}. Un asesor humano continúa desde aquí.${summaryBit} Si quieres, también puedes escribir menú.`,
    flow: "human",
    pendingAction: "human_review",
    path: "escalate",
    factsPatch: {
      flowTopic: "human",
      reservationWorkflowStep: "FINISHED",
      escalatedToReception: true,
    },
  };
}

export function escalateEndConversation(): EscalationOutcome {
  return {
    kind: "end",
    reply:
      "Listo, cerramos esta conversación. Cuando quieras, escribe menú o Hola para empezar de nuevo.",
    flow: "idle",
    pendingAction: null,
    path: "deterministic",
    factsPatch: {
      flowTopic: null,
      reservationWorkflowStep: "FINISHED",
      conversationEnded: true,
    },
  };
}

/** Detect escape intents mid-flow (rules only). */
export function detectEscalationIntent(
  text: string,
): EscalationKind | null {
  const t = text.trim();
  if (!t) return null;
  if (/^(men[uú]|volver al men[uú]|inicio|opciones)[\s!.?]*$/i.test(t)) {
    return "menu";
  }
  if (
    /asesor|humano|recepci[oó]n|hablar con (alguien|una persona)|operador/i.test(
      t,
    )
  ) {
    return "reception";
  }
  if (/^(adi[oó]s|chao|bye|terminar|fin|no gracias)[\s!.?]*$/i.test(t)) {
    return "end";
  }
  return null;
}

export function applyEscalationIntent(
  text: string,
  guestName?: string | null,
): EscalationOutcome | null {
  const kind = detectEscalationIntent(text);
  if (!kind) return null;
  if (kind === "menu") return escalateToMenu(guestName);
  if (kind === "reception") {
    return escalateToReception({ guestName });
  }
  if (kind === "end") return escalateEndConversation();
  return null;
}

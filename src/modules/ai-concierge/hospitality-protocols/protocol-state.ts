/**
 * Protocol runtime state — persisted in Concierge facts (additive).
 */
import type { ConciergeFactMap } from "@/modules/ai-concierge/memory/fact-memory";
import type { ConciergeConversationFlowState } from "@/modules/ai-concierge/memory/fact-memory";
import {
  getHospitalityProtocol,
  protocolFromPendingAction,
} from "@/modules/ai-concierge/hospitality-protocols/registry";
import type {
  HospitalityProtocolId,
  ProtocolRuntimeState,
  ProtocolStatus,
} from "@/modules/ai-concierge/hospitality-protocols/types";

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function readProtocolState(
  facts: ConciergeFactMap,
  flow: ConciergeConversationFlowState,
): ProtocolRuntimeState {
  const fromFacts =
    typeof facts.activeProtocol === "string"
      ? (facts.activeProtocol as HospitalityProtocolId)
      : null;
  const activeProtocol =
    fromFacts && fromFacts.length > 0
      ? fromFacts
      : protocolFromPendingAction(
          flow.pendingAction,
          flow.flow,
          typeof facts.activeWorkflow === "string" ? facts.activeWorkflow : null,
        );

  const def = getHospitalityProtocol(activeProtocol);
  return {
    activeProtocol,
    objective:
      (typeof facts.protocolObjective === "string" && facts.protocolObjective) ||
      def?.objective ||
      (activeProtocol === "MAIN_MENU"
        ? "Orientar al huésped por menú o consulta libre"
        : activeProtocol === "WELCOME"
          ? "Identificarse como asistente virtual y pedir nombre"
          : ""),
    step:
      (typeof facts.protocolStep === "string" && facts.protocolStep) ||
      flow.pendingAction ||
      "start",
    collectedKeys: asStringArray(facts.protocolCollectedKeys),
    pendingKeys: asStringArray(facts.protocolPendingKeys),
    pendingTool:
      typeof facts.protocolPendingTool === "string"
        ? facts.protocolPendingTool
        : null,
    lastAction:
      typeof facts.protocolLastAction === "string"
        ? facts.protocolLastAction
        : null,
    nextAction:
      typeof facts.protocolNextAction === "string"
        ? facts.protocolNextAction
        : null,
    status: (typeof facts.protocolStatus === "string"
      ? facts.protocolStatus
      : "active") as ProtocolStatus,
  };
}

export function protocolFactsPatch(input: {
  protocol: HospitalityProtocolId;
  step?: string | null;
  lastAction?: string | null;
  nextAction?: string | null;
  pendingTool?: string | null;
  status?: ProtocolStatus;
  collectedKeys?: string[];
  pendingKeys?: string[];
  clear?: boolean;
}): ConciergeFactMap {
  if (input.clear) {
    return {
      activeProtocol: "MAIN_MENU",
      protocolObjective: null,
      protocolStep: "await_menu_choice",
      protocolCollectedKeys: null,
      protocolPendingKeys: null,
      protocolPendingTool: null,
      protocolLastAction: "cleared",
      protocolNextAction: "await_menu_or_nl",
      protocolStatus: "awaiting_guest",
      contextLocked: false,
      activeWorkflow: null,
    };
  }

  const def = getHospitalityProtocol(input.protocol);
  return {
    activeProtocol: input.protocol,
    protocolObjective: def?.objective ?? null,
    protocolStep: input.step ?? null,
    protocolLastAction: input.lastAction ?? null,
    protocolNextAction: input.nextAction ?? null,
    protocolPendingTool: input.pendingTool ?? null,
    protocolStatus: input.status ?? "active",
    ...(input.collectedKeys ? { protocolCollectedKeys: input.collectedKeys.join(",") } : {}),
    ...(input.pendingKeys ? { protocolPendingKeys: input.pendingKeys.join(",") } : {}),
    contextLocked:
      input.protocol !== "MAIN_MENU" &&
      input.protocol !== "WELCOME" &&
      input.protocol !== "IDLE" &&
      input.status !== "finished",
  };
}

/**
 * Conversation Lock: one active protocol; switch only if allowed.
 */
export function maySwitchProtocol(input: {
  current: HospitalityProtocolId;
  next: HospitalityProtocolId;
  guestMessage: string;
  explicitMenu: boolean;
  protocolFinished: boolean;
}): boolean {
  if (input.protocolFinished) return true;
  if (input.current === "IDLE" || input.current === "MAIN_MENU" || input.current === "WELCOME") {
    return true;
  }
  if (input.current === input.next) return true;
  if (input.explicitMenu) return true;
  // Explicit reception request always allowed
  if (input.next === "RECEPTION") return true;
  // Explicit NL "menú"
  if (/^(men[uú]|volver al men[uú]|inicio|opciones)[\s!.?]*$/i.test(input.guestMessage.trim())) {
    return true;
  }
  return false;
}

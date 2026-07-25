/**
 * Additive conversational guards for Concierge v1.1 / v2.1 workflow menu.
 * Reuses existing flow/memory — does not create a second brain.
 */
import type { ConciergeConversationFlowState } from "@/modules/ai-concierge/memory/fact-memory";
import type { ConciergeRecentSnippet } from "@/modules/ai-concierge/memory/fact-memory";
import type { ConciergeIntent } from "@/modules/ai-concierge/types/intent";
import type { ConciergeToolInvocationRecord } from "@/modules/ai-concierge/types/tool";
import {
  buildMainMenuMessage,
  isConversationIdle,
} from "@/modules/ai-concierge/dialogue/workflow-menu";

export type ConciergeToolOutcome = "SUCCESS" | "FAILED" | "PENDING";

const PURE_ACK =
  /^(hola+|holi+|ola+|wenas+|buenas?(?: (?:tardes|noches|días|dias))?|hey+|hi+|hello+|gracias+|ok+|okay+|vale+|perfecto+|listo+|👍|🙏|👌|🙂|😊|okey|de acuerdo)[\s!.?]*$/i;

const FOLLOW_UP =
  /^(y |entonces |ya |la |el |eso |esa |ese |ella )?(ya qued[oó]|y la contrase[nñ]a|y el (wifi|c[oó]digo|link)|entonces s[ií]|la cre[oó]|ella puede|puede entrar|y eso|y el wifi|la clave|la contrase[nñ]a|hay disponibilidad\??|qued[oó]\??|me confirmas|y eso\??)\b/i;

const THANKS_VARIANTS = [
  "¡Con gusto! Si necesitas algo más de la propiedad, aquí estoy.",
  "¡Con mucho gusto! Cualquier otra duda de la estadía, avísame.",
  "Para eso estoy. Si surge algo más, escríbeme.",
  "¡Dale! Aquí seguimos si necesitas otra cosa.",
];

const OK_VARIANTS = [
  "Perfecto. Avísame si surge otra duda.",
  "Listo. Aquí sigo si necesitas algo más.",
  "De acuerdo. Cualquier cosa me escribes.",
  "Queda anotado. Aquí estoy si hace falta.",
];

const FAREWELL_VARIANTS = [
  "Que tengas una excelente estadía.",
  "Que descanses. Aquí estoy si necesitas algo.",
  "Con gusto. ¡Buen día!",
];

function pickVariant(variants: string[], salt: string): string {
  let hash = 0;
  for (let i = 0; i < salt.length; i += 1) {
    hash = (hash + salt.charCodeAt(i) * (i + 1)) % 997;
  }
  return variants[hash % variants.length]!;
}

export function isPureAckMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 40) return false;
  return PURE_ACK.test(trimmed);
}

export function isThanksOrEmojiOnly(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 24) return false;
  return /^(gracias+|👍|🙏|👌|🙂|😊|ok+|okay+|vale+)[\s!.?]*$/i.test(trimmed);
}

/** Concrete soft-continue copy so mid-flow "Hola" stays coherent. */
export function softContinueHint(pendingAction: string | null): string {
  switch (pendingAction) {
    case "ask_dates_guests":
    case "ask_check_in":
    case "ask_check_out":
    case "ask_guests":
    case "ask_dates":
      return "Seguimos con tu reserva. ¿Me compartes fecha de entrada, fecha de salida y número de huéspedes?";
    case "ask_property":
      return "Seguimos. ¿De qué propiedad o zona quieres consultar disponibilidad?";
    case "await_confirm":
      return "Seguimos. ¿Te armo la reserva con las fechas que revisamos? Responde sí o no.";
    case "ask_guest_name":
      return "Seguimos. ¿Me compartes el nombre completo del titular de la reserva?";
    case "ask_guest_email":
      return "Seguimos. ¿Cuál es tu correo? Si prefieres sin correo, escribe «continuar».";
    case "await_final_confirm":
      return "Seguimos. ¿Confirmas que cree la reserva? Responde «sí» o «no».";
    default:
      return "Seguimos con tu solicitud. ¿Me confirmas el dato pendiente de este paso?";
  }
}

/**
 * Mid-flow pure acks / thanks often need silence, not a new speech.
 * Greetings after a recent agent ack → soft continue, not full intro.
 */
export function evaluateNoReplyPolicy(input: {
  guestMessage: string;
  flow: ConciergeConversationFlowState;
  recent: ConciergeRecentSnippet[];
}): {
  silence: boolean;
  reason: string | null;
  softContinue: string | null;
} {
  const text = input.guestMessage.trim();
  if (!isPureAckMessage(text) && !isThanksOrEmojiOnly(text)) {
    return { silence: false, reason: null, softContinue: null };
  }

  const lastAgent = [...input.recent].reverse().find((m) => m.role === "agent");
  // Idle threads: never silence / soft-continue — unlock to main menu path.
  if (isConversationIdle(input.recent)) {
    return { silence: false, reason: null, softContinue: null };
  }

  const inActiveFlow =
    input.flow.awaitingReply ||
    Boolean(input.flow.pendingAction) ||
    (input.flow.flow != null && input.flow.flow !== "idle");

  if (isThanksOrEmojiOnly(text) && inActiveFlow) {
    return {
      silence: true,
      reason: "ack_mid_flow_silence",
      softContinue: null,
    };
  }

  if (/^(ok+|okay+|vale+|perfecto+|listo+|👍|👌)[\s!.?]*$/i.test(text) && inActiveFlow) {
    // Exception: "sí/ok" while awaiting final booking confirm must NOT silence.
    if (input.flow.pendingAction === "await_final_confirm") {
      return { silence: false, reason: null, softContinue: null };
    }
    return {
      silence: true,
      reason: "confirm_mid_flow_silence",
      softContinue: null,
    };
  }

  // Mid-workflow greeting: nudge with the concrete missing step (not opaque).
  if (
    /^hola+|holi+|ola+/i.test(text) &&
    inActiveFlow &&
    input.flow.pendingAction &&
    input.flow.pendingAction !== "await_menu_choice"
  ) {
    // Already asking for name: do not send a second distinct ask (double-tick).
    if (input.flow.pendingAction === "await_guest_name") {
      return {
        silence: true,
        reason: "greeting_while_awaiting_name",
        softContinue: null,
      };
    }
    if (
      input.flow.pendingAction === "booking_created" ||
      input.flow.pendingAction === "done"
    ) {
      return {
        silence: false,
        reason: "post_booking_greeting",
        softContinue:
          "Tu reserva ya quedó registrada. Si necesitas otra cosa, escribe menú o cuéntame en qué te ayudo.",
      };
    }
    return {
      silence: false,
      reason: "mid_workflow_greeting",
      softContinue: softContinueHint(input.flow.pendingAction),
    };
  }

  // Fresh greeting while we already asked for the name in the last agent turn.
  if (
    /^hola+|holi+|ola+/i.test(text) &&
    lastAgent &&
    /me regalas tu nombre/i.test(lastAgent.body)
  ) {
    return {
      silence: true,
      reason: "duplicate_name_ask_suppressed",
      softContinue: null,
    };
  }

  return { silence: false, reason: null, softContinue: null };
}

export function humanizeDeterministicAck(
  message: string,
  salt = "",
): string | null {
  const trimmed = message.trim();
  if (!isPureAckMessage(trimmed)) return null;
  if (/gracias|🙏/i.test(trimmed)) {
    return pickVariant(THANKS_VARIANTS, salt + trimmed);
  }
  if (/👍|👌|ok|okay|vale|perfecto|listo|de acuerdo|okey/i.test(trimmed)) {
    return pickVariant(OK_VARIANTS, salt + trimmed);
  }
  // v3.1 — guided welcome asks for name (no menu yet).
  return buildMainMenuMessage();
}

/**
 * Resolve follow-up / anaphora using existing flow + lastIntent.
 */
export function resolveFollowUpIntent(input: {
  guestMessage: string;
  flow: ConciergeConversationFlowState;
  recent: ConciergeRecentSnippet[];
}): ConciergeIntent | null {
  const text = input.guestMessage.trim();
  if (!text) return null;

  const lastIntent = input.flow.lastIntent;
  const lastAgent = [...input.recent].reverse().find((m) => m.role === "agent");

  if (
    /contrase[nñ]a|clave|password|wifi|wi-fi|red/i.test(text) &&
    (lastIntent === "WIFI" || /wifi|internet|clave|contrase/i.test(lastAgent?.body ?? ""))
  ) {
    return "WIFI";
  }

  if (
    /ella puede|puede entrar|entrar primero|llegan? (antes|temprano)/i.test(text) &&
    (lastIntent === "CHECKIN" ||
      lastIntent === "TTLOCK" ||
      lastIntent === "EARLY_CHECKIN" ||
      /check[- ]?in|acceso|llegada|puerta/i.test(lastAgent?.body ?? ""))
  ) {
    return "CHECKIN";
  }

  if (
    /ya qued[oó]|la cre[oó]|entonces s[ií]|armaste|reserv|confirm/i.test(text) &&
    (input.flow.flow === "availability" ||
      lastIntent === "DISPONIBILIDAD" ||
      lastIntent === "COTIZACION" ||
      lastIntent === "RESERVA")
  ) {
    return "RESERVA";
  }

  if (
    /disponib|libre|vacante/i.test(text) &&
    (input.flow.flow === "availability" || lastIntent === "DISPONIBILIDAD")
  ) {
    return "DISPONIBILIDAD";
  }

  if (FOLLOW_UP.test(text) && lastIntent && lastIntent !== "OTHER") {
    return lastIntent as ConciergeIntent;
  }

  return null;
}

export function mapToolOutcome(
  inv: Pick<ConciergeToolInvocationRecord, "status" | "result">,
): ConciergeToolOutcome {
  if (inv.status === "planned" || inv.status === "skipped") return "PENDING";
  if (inv.status === "denied") return "FAILED";
  if (inv.status === "executed") {
    if (inv.result == null) return "PENDING";
    return inv.result.ok ? "SUCCESS" : "FAILED";
  }
  return "PENDING";
}

export function mapToolOutcomes(
  invocations: Array<Pick<ConciergeToolInvocationRecord, "toolName" | "status" | "result">>,
): Array<{ toolName: string; outcome: ConciergeToolOutcome; ok: boolean }> {
  return invocations.map((inv) => ({
    toolName: inv.toolName,
    outcome: mapToolOutcome(inv),
    ok: inv.result?.ok === true,
  }));
}

/**
 * Block replies that contradict the active flow (e.g. inventing "reserva creada").
 */
export function validateConversationalCoherence(input: {
  reply: string | null | undefined;
  flow: ConciergeConversationFlowState;
  guestMessage: string;
  path: string;
}): { ok: boolean; reason: string | null; reply: string | null } {
  const reply = input.reply?.trim() || null;
  if (!reply) return { ok: true, reason: null, reply: null };

  const claimsCreated =
    /reserva.{0,40}(cread|confirmad|agendad)|ya qued[oó] (cread|reservad)|qued[oó] reservad|ya agend[eé]|confirm[eé] tu reserva|reservation created/i.test(
      reply,
    );
  const writePending =
    input.flow.pendingAction === "ask_guest_name" ||
    input.flow.pendingAction === "ask_guest_email" ||
    input.flow.pendingAction === "await_final_confirm" ||
    input.flow.pendingAction === "ask_dates" ||
    input.flow.pendingAction === "ask_check_in" ||
    input.flow.pendingAction === "ask_check_out" ||
    input.flow.pendingAction === "ask_guests" ||
    (input.flow.flow === "availability" &&
      input.flow.pendingAction !== "booking_created" &&
      input.flow.pendingAction !== "done");

  if (claimsCreated && writePending && input.path !== "deterministic") {
    return {
      ok: false,
      reason: "premature_booking_claim",
      reply:
        "Aún no he creado la reserva. Cuando me confirmes, te pido el nombre del titular y la gestionamos.",
    };
  }

  if (
    claimsCreated &&
    input.flow.pendingAction !== "booking_created" &&
    input.flow.pendingAction !== "registration_complete" &&
    input.flow.pendingAction !== "done" &&
    !/titular|nombre completo|confirmar/i.test(input.guestMessage)
  ) {
    if (
      input.flow.pendingAction &&
      input.flow.pendingAction !== "human_finalize"
    ) {
      return {
        ok: false,
        reason: "booking_not_confirmed",
        reply:
          "Todavía no está creada. Si quieres que la arme, confírmame y te pido el dato del titular.",
      };
    }
  }

  return { ok: true, reason: null, reply };
}

/** Natural typing delay for extension (ms). */
export function naturalReplyDelayMs(reply: string, usedTools: boolean): number {
  const len = reply.trim().length;
  const base = Math.min(2_400, Math.max(650, Math.round(len * 18)));
  const toolBias = usedTools ? 400 : 0;
  return Math.min(3_200, base + toolBias);
}

export function confidenceClarification(input: {
  intent: ConciergeIntent;
  confidence: number;
  guestMessage: string;
}): string | null {
  if (input.confidence >= 0.62) return null;
  if (input.intent !== "OTHER" && input.confidence >= 0.5) return null;
  const text = input.guestMessage.trim();
  if (text.length < 2) return null;
  return "Para ayudarte bien, ¿me confirmas si es sobre la reserva, el WiFi, el check-in u otra consulta de la propiedad?";
}

export function pickFarewellVariant(salt = ""): string {
  return pickVariant(FAREWELL_VARIANTS, salt || "bye");
}

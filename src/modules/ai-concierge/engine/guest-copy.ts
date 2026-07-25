/**
 * Guest-facing copy — never expose internal fact keys; natural Spanish clarifications.
 */
import type { ConciergeIntent } from "@/modules/ai-concierge/types/intent";

/** Internal keys / jargon that must never appear in outbound guest text. */
const INTERNAL_FACT_KEY =
  /\b(wifiName|wifiPassword|availabilitySummary|quoteSummary|reservationSummary|billingInfo|balanceDue|currency|paymentInstructions|guestRegistrationUrl|guestRegistrationStatus|accessCode|accessValidFrom|accessValidTo|checkInTime|checkOutTime|parkingInfo|petsPolicy|laundryInfo|towelsInfo|restaurantsInfo|houseRules|earlyCheckInPolicy|lateCheckOutPolicy|address|accessInstructions)\b/i;

const INTERNAL_JARGON =
  /\b(LLM|Context Engine|PriceLabs|OpenAI|GPT-?4|tokenHint|factKeys|pendingAction|activeProtocol|workflowId|Prisma|TypeScript|JSON)\b/i;

/** Raw tool/fact tokens that must never be the entire guest message. */
const INTERNAL_RAW_TOKEN =
  /^(unavailable|available|success|failed|pending|true|false|null|undefined|ok|error)$/i;

const HUMAN_CLARIFY: Partial<Record<ConciergeIntent, string>> = {
  WIFI:
    "Con gusto te paso el WiFi. ¿Me confirmas en qué propiedad estás o el nombre de tu reserva?",
  DISPONIBILIDAD:
    "¿Para qué fechas te gustaría hospedarte y para cuántas personas?",
  COTIZACION:
    "Para armarte la cotización, ¿me compartes fechas de entrada y salida y cuántas personas?",
  RESERVA:
    "Perfecto. Para avanzar con la reserva necesito fechas, número de personas y confirmar la propiedad. ¿Me las compartes?",
  TTLOCK:
    "Te ayudo con el código de acceso. ¿Me confirmas tu reserva o el nombre del huésped a cargo?",
  CHECKIN:
    "¿Quieres saber la hora de check-in o las instrucciones de llegada de una propiedad en particular?",
  CHECKOUT:
    "¿Te indico la hora de check-out y cómo dejar la propiedad al salir?",
  DIRECCION:
    "Con gusto te paso la ubicación. ¿De qué propiedad o reserva hablamos?",
  PARQUEADERO:
    "Te confirmo lo del parqueadero. ¿Para qué propiedad es?",
  MASCOTAS:
    "Te confirmo la política de mascotas. ¿Para qué propiedad consultas?",
  LAVADORA:
    "Te confirmo lo de la lavadora. ¿En qué propiedad estás?",
  TOALLAS:
    "Te ayudo con amenities/toallas. ¿Me confirmas la propiedad o reserva?",
  RESTAURANTES:
    "Te paso recomendaciones cercanas. ¿En qué zona o propiedad te hospedas?",
  PAGO:
    "Te ayudo con el pago. ¿Es sobre una reserva ya creada o una cotización nueva?",
  FACTURACION:
    "Con gusto. ¿Necesitas factura de una reserva específica? Si tienes el nombre o fechas, mejor.",
  GUEST_REGISTRATION:
    "Te reenvío o confirmo el link de registro. ¿Me das el nombre de la reserva o del huésped principal?",
  REGLAS:
    "Te comparto las reglas de la casa. ¿Para qué propiedad?",
  EARLY_CHECKIN:
    "Puedo revisar check-in anticipado. ¿Qué día llegas y a qué hora aproximada?",
  LATE_CHECKOUT:
    "Puedo revisar late checkout. ¿Qué día sales y hasta qué hora te gustaría?",
  EMERGENCY:
    "Entiendo que es urgente. Un administrador te contactará de inmediato. Si hay riesgo, llama a emergencias locales.",
  COMPLAINT:
    "Lamento lo ocurrido. Voy a escalarlo con el equipo para ayudarte lo antes posible.",
  REFUND:
    "Entendido. Un administrador revisará el tema de reembolso y te responderá a la brevedad.",
  DISCOUNT:
    "Las solicitudes de descuento especial las revisa el equipo. Te confirman en cuanto puedan.",
  OTHER:
    "¿En qué te puedo ayudar? Por ejemplo: disponibilidad, WiFi, dirección, check-in o cotización.",
};

/**
 * Human clarification when required facts are missing — never list raw keys.
 */
export function humanClarifyMissingFacts(
  intent: ConciergeIntent,
  missingKeys: string[],
): string {
  const specific = HUMAN_CLARIFY[intent];
  if (specific) return specific;

  if (missingKeys.some((k) => /wifi/i.test(k))) {
    return HUMAN_CLARIFY.WIFI!;
  }
  if (missingKeys.some((k) => /availab|quote/i.test(k))) {
    return HUMAN_CLARIFY.DISPONIBILIDAD!;
  }
  if (missingKeys.some((k) => /access|ttlock|code/i.test(k))) {
    return HUMAN_CLARIFY.TTLOCK!;
  }

  return "Para darte una respuesta precisa, ¿me das un poco más de detalle (fechas, propiedad o reserva)?";
}

/** Soft handoff — used once when LLM/path cannot answer; not a spam loop. */
export function humanSoftHandoff(): string {
  return "Déjame revisar bien tu consulta con el equipo para darte la información correcta. Mientras, ¿me cuentas un poco más del detalle?";
}

/**
 * Returns true if draft leaks internal keys or looks like a broken template.
 */
export function guestCopyLooksUnsafe(draft: string | null | undefined): boolean {
  if (!draft?.trim()) return true;
  const trimmed = draft.trim();
  if (INTERNAL_FACT_KEY.test(trimmed)) return true;
  if (INTERNAL_JARGON.test(trimmed)) return true;
  if (INTERNAL_RAW_TOKEN.test(trimmed)) return true;
  if (/\{\{[a-zA-Z0-9_]+\}\}/.test(trimmed)) return true;
  if (/necesito confirmar:\s*[a-zA-Z]+/.test(trimmed)) return true;
  // Template rendered to a single internal enum-like token.
  if (/^(unavailable|available)\b/i.test(trimmed) && trimmed.length < 40) {
    return true;
  }
  return false;
}

/**
 * Sanitize outbound: strip unsafe drafts; collapse accidental repetition.
 */
export function sanitizeGuestOutbound(
  draft: string | null | undefined,
  fallback: string,
): string | null {
  if (!draft?.trim()) return null;
  let text = draft.trim();

  // Collapse exact 2–N× concatenation — shortest repeating unit first.
  {
    const maxLen = Math.floor(text.length / 2);
    for (let len = 12; len <= maxLen; len += 1) {
      if (text.length % len !== 0) continue;
      const chunk = text.slice(0, len);
      const times = text.length / len;
      if (times >= 2 && chunk.repeat(times) === text) {
        text = chunk;
        break;
      }
    }
  }
  const firstQ = text.indexOf("?");
  if (firstQ >= 8) {
    const unit = text.slice(0, firstQ + 1);
    if (
      unit.length >= 8 &&
      text.length >= unit.length * 2 &&
      text.split(unit).join("") === ""
    ) {
      text = unit;
    }
  }

  if (guestCopyLooksUnsafe(text)) return fallback;
  return text;
}

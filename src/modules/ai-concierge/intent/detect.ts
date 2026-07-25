import { detectInboxMessageIntent } from "@/services/inbox-ai/inbox-intent.service";
import type { InboxAiIntent } from "@/services/inbox-ai/inbox-intent.types";
import type {
  ConciergeIntent,
  ConciergeIntentDetection,
} from "@/modules/ai-concierge/types/intent";
import { matchGuestUtterance } from "@/modules/ai-concierge/intent/utterance-bank";

type IntentRule = {
  intent: ConciergeIntent;
  weight: number;
  test: (text: string) => boolean;
};

/** Reglas propias del Concierge (Master Doc). Prioridad por weight. */
const RULES: IntentRule[] = [
  {
    intent: "EMERGENCY",
    weight: 100,
    test: (t) =>
      /urgente|emergenc|911|ambulanc|incendio|fuga de gas|ayuda inmediata|amenaza|accidente|lesi[oó]n|demanda legal|abogado|polic[ií]a|denuncia/i.test(
        t,
      ),
  },
  {
    intent: "REFUND",
    weight: 98,
    test: (t) => /reembolso|refund|devolver.*dinero|devoluci[oó]n del pago/i.test(t),
  },
  {
    intent: "COMPLAINT",
    weight: 95,
    test: (t) =>
      /queja|reclamo|inaceptable|muy mal|p[eé]simo|horrible|problema grave|problema legal/i.test(
        t,
      ),
  },
  {
    intent: "DISCOUNT",
    weight: 92,
    test: (t) =>
      /descuento extraordin|descuento especial|mejor precio|rebaja fuerte|pago especial/i.test(
        t,
      ),
  },
  {
    intent: "GUEST_REGISTRATION",
    weight: 90,
    test: (t) =>
      /registro de hu[eé]sped|guest registration|formulario de registro|link de registro|completar el registro/i.test(
        t,
      ),
  },
  {
    intent: "TTLOCK",
    weight: 89,
    test: (t) =>
      /ttlock|c[oó]digo de (la )?puerta|c[oó]digo de acceso|llave digital|smart.?lock|cerradura/i.test(
        t,
      ),
  },
  {
    intent: "WIFI",
    weight: 88,
    test: (t) => /wifi|wi-fi|internet|clave.*wifi|contrase[nñ]a.*wifi|red wi/i.test(t),
  },
  {
    intent: "COTIZACION",
    weight: 87,
    test: (t) => /cotiz|presupuesto|cu[aá]nto (cuesta|vale)|tarifa|precio por noche/i.test(t),
  },
  {
    intent: "DISPONIBILIDAD",
    weight: 86,
    test: (t) =>
      /disponib|hay fechas|est[aá] libre|vacante|pueden hosped|hay cupo|tienes algo|tienen algo|necesito (un |una )?(apto|apartamento|depto|habitaci|alojamiento)|busco (apto|apartamento|alojamiento|hosped)|tienen habitaci/i.test(
        t,
      ),
  },
  {
    intent: "RESERVA",
    weight: 85,
    test: (t) => /quiero reservar|hacer una reserva|confirmar (la )?reserva|booking/i.test(t),
  },
  {
    intent: "PAGO",
    weight: 84,
    // Avoid false hits on greetings / short chat ("hola", "ok").
    test: (t) =>
      /\b(pagar|pago|transferencia|saldo|abono|link de pago|comprobante de pago)\b/i.test(
        t,
      ) && !/^(hola+|hi+|hey+|buenas?)\b/i.test(t.trim()),
  },
  {
    intent: "FACTURACION",
    weight: 83,
    test: (t) => /factura|facturaci[oó]n|recibo|nit|raz[oó]n social/i.test(t),
  },
  {
    intent: "PARQUEADERO",
    weight: 82,
    test: (t) => /parqueadero|parking|estacionamiento/i.test(t),
  },
  {
    intent: "MASCOTAS",
    weight: 81,
    test: (t) => /mascota|perro|gato|pet.?friendly|aceptan perros/i.test(t),
  },
  {
    intent: "LAVADORA",
    weight: 80,
    test: (t) => /lavadora|lavander[ií]a|washing machine/i.test(t),
  },
  {
    intent: "TOALLAS",
    weight: 79,
    test: (t) => /toalla/i.test(t),
  },
  {
    intent: "RESTAURANTES",
    weight: 78,
    test: (t) => /restaurante|d[oó]nde comer|comida cerca|caf[eé]/i.test(t),
  },
  {
    intent: "DIRECCION",
    weight: 77,
    test: (t) => /direcci[oó]n|ubicaci[oó]n|c[oó]mo llegar|mapa|queda en/i.test(t),
  },
  {
    intent: "REGLAS",
    weight: 76,
    test: (t) => /reglas|normas|fiesta|visitas|fumar|prohibido/i.test(t),
  },
  {
    intent: "EARLY_CHECKIN",
    weight: 75,
    test: (t) => /check[- ]?in temprano|early check|llegar antes|entrada anticipada/i.test(t),
  },
  {
    intent: "LATE_CHECKOUT",
    weight: 74,
    test: (t) => /late checkout|check[- ]?out tard|salida tard[ií]a|salir m[aá]s tarde/i.test(t),
  },
  {
    intent: "CHECKIN",
    weight: 70,
    test: (t) =>
      /check[- ]?in|hora de (entrada|llegada)|a qu[eé] hora (entro|llego|es la entrada)/i.test(
        t,
      ),
  },
  {
    intent: "CHECKOUT",
    weight: 69,
    // Do not treat booking "fecha de salida" / bare "salida" as checkout FAQ.
    test: (t) =>
      /check[- ]?out|hora de salida|a qu[eé] hora (salgo|es la salida)|late checkout/i.test(
        t,
      ) && !/\b(del|desde|entre).{0,40}\b(al|hasta)\b/i.test(t),
  },
];

const INBOX_TO_CONCIERGE: Partial<Record<InboxAiIntent, ConciergeIntent>> = {
  WIFI: "WIFI",
  ACCESS: "TTLOCK",
  PARKING: "PARQUEADERO",
  HOUSE_RULES: "REGLAS",
  LOCATION: "DIRECCION",
  PAYMENT: "PAGO",
  DISCOUNT: "DISCOUNT",
  COMPLAINT: "COMPLAINT",
  EMERGENCY: "EMERGENCY",
  CHECK_IN: "CHECKIN",
  CHECK_OUT: "CHECKOUT",
  EARLY_CHECKIN: "EARLY_CHECKIN",
  LATE_CHECKOUT: "LATE_CHECKOUT",
};

function detectFromRules(text: string): ConciergeIntentDetection | null {
  let best: IntentRule | null = null;
  for (const rule of RULES) {
    if (!rule.test(text)) continue;
    if (!best || rule.weight > best.weight) best = rule;
  }
  if (!best) return null;
  return {
    intent: best.intent,
    confidence: Math.min(0.95, best.weight / 100),
    level: "L1",
    source: "concierge-rules",
  };
}

/**
 * L1/L2: utterance bank → reglas Concierge → Inbox AI adapter (sin LLM).
 * Optional flow bias keeps follow-ups on the same topic (additive).
 */
export function detectConciergeIntent(
  body: string | null | undefined,
  options?: {
    flowLastIntent?: string | null;
    flowTopic?: string | null;
    preferIntent?: ConciergeIntent | null;
  },
): ConciergeIntentDetection {
  const text = body?.trim() ?? "";
  if (!text) {
    return {
      intent: "OTHER",
      confidence: 0.2,
      level: "L1",
      source: "concierge-rules",
    };
  }

  if (options?.preferIntent) {
    return {
      intent: options.preferIntent,
      confidence: 0.78,
      level: "L1",
      source: "concierge-rules",
    };
  }

  // Top-100 utterance bank (exact/phrase) — boosts coverage without replacing RULES.
  const uttered = matchGuestUtterance(text);
  if (uttered && uttered.score >= 8) {
    // Pure greetings stay OTHER so deterministic-ack path can own them.
    if (
      uttered.entry.id === "q001" ||
      uttered.entry.id === "q088"
    ) {
      // fall through to rules / ack
    } else {
      return {
        intent: uttered.entry.intent,
        confidence: Math.min(0.96, 0.72 + uttered.score / 200),
        level: "L1",
        source: "concierge-rules",
      };
    }
  }

  const fromRules = detectFromRules(text.toLowerCase());
  if (fromRules) return fromRules;

  const inbox = detectInboxMessageIntent(text);
  const mapped = INBOX_TO_CONCIERGE[inbox.intent];
  if (mapped && inbox.intent !== "OTHER") {
    // Guard: inbox PAYMENT must not steal pure greetings.
    if (mapped === "PAGO" && /^(hola+|hi+|hey+|buenas?)\b/i.test(text)) {
      return {
        intent: "OTHER",
        confidence: 0.9,
        level: "L1",
        source: "concierge-rules",
      };
    }
    return {
      intent: mapped,
      confidence: Math.max(0.5, inbox.confidence * 0.9),
      level: "L2",
      source: "inbox-ai-adapter",
    };
  }

  // Low-confidence OTHER: keep prior commercial/wifi topic when message is short follow-up.
  if (
    options?.flowLastIntent &&
    options.flowLastIntent !== "OTHER" &&
    text.length <= 48 &&
    /^(y |entonces |ya |la |el |eso )/i.test(text)
  ) {
    return {
      intent: options.flowLastIntent as ConciergeIntent,
      confidence: 0.62,
      level: "L1",
      source: "concierge-rules",
    };
  }

  return {
    intent: "OTHER",
    confidence: 0.4,
    level: "L2",
    source: "concierge-rules",
  };
}

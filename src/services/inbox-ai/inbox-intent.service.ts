import { detectGuestMessageIntent } from "@/services/novedades/novedades-suggested-actions.service";
import type { SafeCommunicationIntent } from "@/modules/airbnb-email/types";
import {
  INBOX_AI_INTENT_LABELS,
  type InboxAiIntent,
  type InboxAiIntentDetection,
} from "@/services/inbox-ai/inbox-intent.types";

type IntentRule = {
  intent: InboxAiIntent;
  weight: number;
  test: (text: string) => boolean;
};

const RULES: IntentRule[] = [
  {
    intent: "EMERGENCY",
    weight: 100,
    test: (t) =>
      /urgente|emergenc|911|ambulanc|incendio|fuga de gas|no puedo entrar ahora|ayuda inmediata/i.test(
        t,
      ),
  },
  {
    intent: "COMPLAINT",
    weight: 90,
    test: (t) =>
      /queja|reclamo|inaceptable|muy mal|pésimo|horrible|ruido|sucio|no funciona|problema grave/i.test(
        t,
      ),
  },
  {
    intent: "HOT_WATER",
    weight: 88,
    test: (t) =>
      /agua caliente|no sale agua caliente|calentador|ducha fr[ií]a|sin agua caliente/i.test(
        t,
      ),
  },
  {
    intent: "EARLY_CHECKIN",
    weight: 85,
    test: (t) =>
      /check[- ]?in temprano|early check|llegar antes|antes de las \d|entrada anticipada/i.test(
        t,
      ),
  },
  {
    intent: "LATE_CHECKOUT",
    weight: 85,
    test: (t) =>
      /late checkout|check[- ]?out tard|salir m[aá]s tarde|salida tard[ií]a|quedarnos hasta/i.test(
        t,
      ),
  },
  {
    intent: "WIFI",
    weight: 84,
    test: (t) => /wifi|wi-fi|internet|clave.*wifi|contraseña.*wifi|red wi/i.test(t),
  },
  {
    intent: "ACCESS",
    weight: 83,
    test: (t) =>
      /c[oó]digo|codigo|acceso|llave|puerta|key|lock|entrar|porter[ií]a|cerradura/i.test(
        t,
      ),
  },
  {
    intent: "PARKING",
    weight: 82,
    test: (t) => /parqueadero|parking|estacionamiento|carro|auto|veh[ií]culo/i.test(t),
  },
  {
    intent: "HOUSE_RULES",
    weight: 80,
    test: (t) =>
      /reglas|normas|fiesta|visitas|mascotas|fumar|ruido|prohibido|allowed|pets|smoking/i.test(
        t,
      ),
  },
  {
    intent: "LOCATION",
    weight: 78,
    test: (t) =>
      /ubicaci[oó]n|direcci[oó]n|c[oó]mo llegar|mapa|transporte|taxi|aeropuerto|pickup|recogida|llego a las|vuelo/i.test(
        t,
      ),
  },
  {
    intent: "PAYMENT",
    weight: 77,
    test: (t) =>
      /pago|pag[oó]|factura|recibo|cobro|tarjeta|transferencia|reembolso|refund|deposito|dep[oó]sito/i.test(
        t,
      ),
  },
  {
    intent: "DISCOUNT",
    weight: 76,
    test: (t) =>
      /descuento|discount|oferta|precio m[aá]s bajo|rebaja|mejor precio|negociar/i.test(t),
  },
  {
    intent: "CHECK_IN",
    weight: 70,
    test: (t) =>
      /check[- ]?in|llegada|llegar|hora de entrada|entrada el|registro de llegada/i.test(t),
  },
  {
    intent: "CHECK_OUT",
    weight: 70,
    test: (t) => /check[- ]?out|salida|hora de salida|dejar las llaves|checkout/i.test(t),
  },
];

function mapLegacyNovedadesIntent(
  body: string | null | undefined,
): InboxAiIntent | null {
  const legacy = detectGuestMessageIntent(body);
  switch (legacy) {
    case "EARLY_CHECKIN":
      return "EARLY_CHECKIN";
    case "LATE_CHECKOUT":
      return "LATE_CHECKOUT";
    case "WIFI":
      return "WIFI";
    case "ACCESS":
      return "ACCESS";
    case "PARKING":
      return "PARKING";
    case "GENERAL":
      return null;
    default:
      return null;
  }
}

function mapLegacyAirbnbIntent(
  intent: SafeCommunicationIntent,
): InboxAiIntent | null {
  switch (intent) {
    case "EARLY_CHECKIN":
      return "EARLY_CHECKIN";
    case "TRANSPORT":
      return "LOCATION";
    case "ARRIVAL_SUPPORT":
      return "CHECK_IN";
    case "REVIEW_RESPONSE":
      return "OTHER";
    case "REQUIRES_ATTENTION":
      return "EMERGENCY";
    default:
      return null;
  }
}

function detectFromRules(text: string): InboxAiIntentDetection | null {
  let best: IntentRule | null = null;
  for (const rule of RULES) {
    if (!rule.test(text)) continue;
    if (!best || rule.weight > best.weight) {
      best = rule;
    }
  }
  if (!best) return null;
  return {
    intent: best.intent,
    confidence: Math.min(0.95, best.weight / 100),
    source: "unified",
  };
}

export function inboxIntentLabel(intent: InboxAiIntent): string {
  return INBOX_AI_INTENT_LABELS[intent];
}

/**
 * Detector unificado — no reemplaza legacy; los consulta como señales adicionales.
 */
export function detectInboxMessageIntent(
  body: string | null | undefined,
  options?: { legacyAirbnbIntent?: SafeCommunicationIntent | null },
): InboxAiIntentDetection {
  const text = body?.trim() ?? "";
  if (!text) {
    return { intent: "OTHER", confidence: 0.2, source: "unified" };
  }

  const normalized = text.toLowerCase();
  const fromRules = detectFromRules(normalized);
  if (fromRules) return fromRules;

  const fromNovedades = mapLegacyNovedadesIntent(text);
  if (fromNovedades) {
    return {
      intent: fromNovedades,
      confidence: 0.72,
      source: "legacy-novedades",
    };
  }

  if (options?.legacyAirbnbIntent) {
    const mapped = mapLegacyAirbnbIntent(options.legacyAirbnbIntent);
    if (mapped) {
      return {
        intent: mapped,
        confidence: 0.68,
        source: "legacy-airbnb-email",
      };
    }
  }

  return { intent: "OTHER", confidence: 0.4, source: "unified" };
}

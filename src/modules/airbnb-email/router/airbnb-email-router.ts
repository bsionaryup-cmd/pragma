import {
  AirbnbEmailEventKind,
  AirbnbEmailSenderChannel,
} from "@prisma/client";
import type { ClassifiedAirbnbEmail } from "@/modules/airbnb-email/types";

const AUTOMATED_SENDER = "automated@airbnb.com";
const EXPRESS_SENDER = "express@airbnb.com";

type ClassificationRule = {
  kind: AirbnbEmailEventKind;
  senderChannel: AirbnbEmailSenderChannel;
  subjectIncludes?: string[];
  bodyIncludes?: string[];
  priority?: number;
};

const CONFIRMED_SUBJECT_MARKERS = [
  "reserva confirmada",
  "booking confirmed",
  "is confirmed",
  "confirmed reservation",
];

const CANCELED_SUBJECT_MARKERS = [
  "reserva cancelada",
  "booking canceled",
  "booking cancelled",
  "reservation canceled",
  "reservation cancelled",
];

/** Frases fuertes de cancelación — no el "cancelled" suelto del footer legal. */
const CANCELED_BODY_STRONG_MARKERS = [
  "reserva cancelada",
  "reservation canceled",
  "reservation cancelled",
  "booking canceled",
  "booking cancelled",
  "tu reserva fue cancelada",
  "your reservation was canceled",
  "your reservation was cancelled",
  "we're sorry to inform you that your reservation has been canceled",
];

/** Higher priority wins when multiple rules could match. */
const RULES: ClassificationRule[] = [
  {
    kind: AirbnbEmailEventKind.PAYOUT_PROCESSED,
    senderChannel: AirbnbEmailSenderChannel.AUTOMATED,
    priority: 90,
    subjectIncludes: [
      "pago enviado",
      "pago procesado",
      "payout",
      "payment sent",
      "transfer",
    ],
    bodyIncludes: ["pago procesado", "payout", "transfer", "deposit"],
  },
  {
    kind: AirbnbEmailEventKind.CANCELED,
    senderChannel: AirbnbEmailSenderChannel.AUTOMATED,
    priority: 85,
    subjectIncludes: CANCELED_SUBJECT_MARKERS,
    bodyIncludes: CANCELED_BODY_STRONG_MARKERS,
  },
  {
    kind: AirbnbEmailEventKind.EXTENDED,
    senderChannel: AirbnbEmailSenderChannel.AUTOMATED,
    priority: 84,
    subjectIncludes: ["extend", "extensión", "alteration", "modificación"],
    bodyIncludes: ["extend", "alteration", "fechas actualizadas"],
  },
  {
    kind: AirbnbEmailEventKind.UPDATED,
    senderChannel: AirbnbEmailSenderChannel.AUTOMATED,
    priority: 83,
    subjectIncludes: ["actualiz", "updated", "change to your reservation"],
    bodyIncludes: ["actualiz", "updated reservation"],
  },
  {
    kind: AirbnbEmailEventKind.CONFIRMED,
    senderChannel: AirbnbEmailSenderChannel.AUTOMATED,
    priority: 80,
    subjectIncludes: [
      "reserva confirmada",
      "booking confirmed",
      "is confirmed",
      "confirmed reservation",
    ],
  },
  {
    kind: AirbnbEmailEventKind.CHECKIN_REMINDER,
    senderChannel: AirbnbEmailSenderChannel.AUTOMATED,
    priority: 75,
    subjectIncludes: [
      "check-in",
      "check in",
      "llegada",
      "arrival",
      "getting ready",
    ],
  },
  {
    kind: AirbnbEmailEventKind.RESERVATION_MESSAGE,
    senderChannel: AirbnbEmailSenderChannel.EXPRESS,
    priority: 70,
    subjectIncludes: [
      "mensaje",
      "message",
      "pregunta",
      "question",
      "inquiry",
    ],
  },
  {
    kind: AirbnbEmailEventKind.HOST_REVIEW_REQUESTED,
    senderChannel: AirbnbEmailSenderChannel.AUTOMATED,
    priority: 65,
    subjectIncludes: [
      "deja una reseña",
      "leave a review",
      "review your guest",
      "write a review",
    ],
  },
  {
    kind: AirbnbEmailEventKind.GUEST_REVIEW_SUBMITTED,
    senderChannel: AirbnbEmailSenderChannel.AUTOMATED,
    priority: 64,
    subjectIncludes: [
      "reseña de",
      "review from",
      "left you a review",
      "wrote you a review",
    ],
  },
  {
    kind: AirbnbEmailEventKind.GUEST_REVIEW_PUBLISHED,
    senderChannel: AirbnbEmailSenderChannel.AUTOMATED,
    priority: 63,
    subjectIncludes: ["reseña publicada", "review published", "published a review"],
  },
  {
    kind: AirbnbEmailEventKind.EARLY_CHECKIN_REQUEST,
    senderChannel: AirbnbEmailSenderChannel.EXPRESS,
    priority: 60,
    bodyIncludes: [
      "early check",
      "check-in temprano",
      "llegar antes",
      "early arrival",
    ],
  },
  {
    kind: AirbnbEmailEventKind.TRANSPORT_REQUEST,
    senderChannel: AirbnbEmailSenderChannel.EXPRESS,
    priority: 59,
    bodyIncludes: [
      "transporte",
      "taxi",
      "airport",
      "aeropuerto",
      "pickup",
      "recogida",
    ],
  },
].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

function subjectIndicatesConfirmed(subject: string): boolean {
  return CONFIRMED_SUBJECT_MARKERS.some((needle) => subject.includes(needle));
}

function subjectIndicatesCanceled(subject: string): boolean {
  return CANCELED_SUBJECT_MARKERS.some((needle) => subject.includes(needle));
}

function bodyIndicatesCanceled(body: string): boolean {
  return CANCELED_BODY_STRONG_MARKERS.some((needle) => body.includes(needle));
}

function resolveSenderChannel(from: string): AirbnbEmailSenderChannel {
  const normalized = from.toLowerCase();
  if (normalized.includes(AUTOMATED_SENDER)) {
    return AirbnbEmailSenderChannel.AUTOMATED;
  }
  if (normalized.includes(EXPRESS_SENDER)) {
    return AirbnbEmailSenderChannel.EXPRESS;
  }
  return AirbnbEmailSenderChannel.OTHER;
}

function matchesRule(
  rule: ClassificationRule,
  subject: string,
  body: string,
  senderChannel: AirbnbEmailSenderChannel,
): boolean {
  if (
    rule.senderChannel !== senderChannel &&
    senderChannel !== AirbnbEmailSenderChannel.OTHER
  ) {
    return false;
  }

  const subjectOk =
    !rule.subjectIncludes?.length ||
    rule.subjectIncludes.some((needle) => subject.includes(needle));
  const bodyOk =
    !rule.bodyIncludes?.length ||
    rule.bodyIncludes.some((needle) => body.includes(needle));

  if (rule.subjectIncludes?.length && rule.bodyIncludes?.length) {
    return subjectOk || bodyOk;
  }

  return subjectOk && bodyOk;
}

export function classifyAirbnbEmail(input: {
  from: string;
  subject: string;
  body: string;
}): ClassifiedAirbnbEmail {
  const subject = input.subject.toLowerCase();
  const body = input.body.toLowerCase();
  const senderChannel = resolveSenderChannel(input.from);
  const anchors: string[] = [];

  // Confirmaciones reenviadas (Fwd:) deben ganar sobre "cancelled" en footer legal.
  if (subjectIndicatesConfirmed(subject) && !subjectIndicatesCanceled(subject)) {
    anchors.push(AirbnbEmailEventKind.CONFIRMED);
    return {
      eventKind: AirbnbEmailEventKind.CONFIRMED,
      senderChannel,
      anchors,
    };
  }

  if (subjectIndicatesCanceled(subject) || bodyIndicatesCanceled(body)) {
    anchors.push(AirbnbEmailEventKind.CANCELED);
    return {
      eventKind: AirbnbEmailEventKind.CANCELED,
      senderChannel,
      anchors,
    };
  }

  for (const rule of RULES) {
    if (matchesRule(rule, subject, body, senderChannel)) {
      anchors.push(rule.kind);
      return { eventKind: rule.kind, senderChannel, anchors };
    }
  }

  return {
    eventKind: AirbnbEmailEventKind.UNKNOWN,
    senderChannel,
    anchors,
  };
}

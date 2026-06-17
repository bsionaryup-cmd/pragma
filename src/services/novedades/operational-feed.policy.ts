import type {
  OperationalFeedCard,
  OperationalFeedKind,
} from "@/services/novedades/operational-feed.types";
import {
  isAirbnbPlatformBoilerplate,
  isIncoherentFeedText,
  isPlaceholderGuestName,
  looksLikeSubjectNoise,
  normalizeGuestMessageBody,
  resolveGuestMessageBodiesForDisplay,
} from "@/services/novedades/operational-feed.message";

const ATTENTION_KINDS = new Set<OperationalFeedKind>([
  "MODIFICATION_REQUEST",
  "ALERT",
]);

const GUEST_MESSAGE_NOISE = [
  /^te envi[oó] un mensaje/i,
  /^message from\b/i,
  /^mensaje sobre su reserva/i,
  /^new message about your reservation/i,
  /^nuevo mensaje sobre tu reserva/i,
  /^airbnb\s*(automated|notification)?$/i,
  /^notificaci[oó]n de airbnb/i,
  /^responder en airbnb/i,
  /^reply on airbnb/i,
  /^nueva calificaci[oó]n/i,
  /^new review/i,
  /^write a review/i,
  /^escribe una reseña/i,
  /^your guest left a review/i,
  /^tu hu[eé]sped dej[oó] una reseña/i,
  /^reminder:/i,
  /^recordatorio:/i,
  /^don'?t forget/i,
  /^no olvides/i,
  /^view (your|the) (reservation|message)/i,
  /^ver (tu|la) reserva/i,
  /^inquiry about\b/i,
  /^consulta sobre\b/i,
  /^cuanto antes respondas/i,
  /^por tu seguridad y protecci[oó]n/i,
  /^env[ií]a un mensaje a\b/i,
  /airbnb\.com(?:\.[a-z]{2,3})?\/(?:ac\/)?account-settings\/email-unsubscribe/i,
];

const GENERIC_SENDER_NOISE = [
  /^airbnb$/i,
  /^notificaciones? airbnb/i,
  /^airbnb support/i,
];

const ALWAYS_USEFUL_KINDS = new Set<OperationalFeedKind>([
  "NEW_RESERVATION",
  "RESERVATION_CANCELLED",
  "MODIFICATION_REQUEST",
  "MODIFICATION_APPROVED",
  "RESERVATION_UPDATED",
  "STAY_EXTENDED",
  "PAYOUT_SENT",
  "PAYMENT_CONFIRMED",
  "ALERT",
]);

export function operationalFeedPriority(
  kind: OperationalFeedKind,
): "normal" | "attention" {
  return ATTENTION_KINDS.has(kind) ? "attention" : "normal";
}

export function isGuestMessageNoise(input: {
  content: string | null | undefined;
  senderName?: string | null;
  guestName?: string | null;
}): boolean {
  const parseGuestName = input.guestName ?? input.senderName;
  const normalized = normalizeGuestMessageBody(input.content, {
    guestName: parseGuestName,
  });

  if (normalized) {
    if (isAirbnbPlatformBoilerplate(normalized)) return true;
    for (const pattern of GUEST_MESSAGE_NOISE) {
      if (pattern.test(normalized)) return true;
    }
    return false;
  }

  const raw = input.content?.trim() ?? "";
  if (!raw) return true;

  const lineCount = raw.split(/\n/).filter((line) => line.trim()).length;
  if (lineCount <= 1 && looksLikeSubjectNoise(raw)) return true;

  if (isIncoherentFeedText(raw)) return true;

  const sender = input.senderName?.trim() ?? "";
  if (sender && isPlaceholderGuestName(sender) && raw.length < 48) return true;

  if (sender && GENERIC_SENDER_NOISE.some((pattern) => pattern.test(sender))) {
    if (raw.length < 40) return true;
  }

  return false;
}

export function isOperationalFeedCardUseful(card: OperationalFeedCard): boolean {
  if (ALWAYS_USEFUL_KINDS.has(card.kind)) {
    if (card.kind === "PAYOUT_SENT" && !card.amountLabel && !card.reservationId) {
      return false;
    }
    if (
      card.kind === "RESERVATION_UPDATED" &&
      card.detailLines.length === 0 &&
      !card.amountLabel
    ) {
      return false;
    }
    if (
      card.kind === "STAY_EXTENDED" &&
      card.detailLines.length === 0
    ) {
      return false;
    }
    return true;
  }

  if (card.kind === "GUEST_MESSAGE") {
    return (
      resolveGuestMessageBodiesForDisplay(card.summary, {
        guestName: card.guestName,
      }).length > 0
    );
  }

  if (card.kind === "ALERT") {
    if (
      isAirbnbPlatformBoilerplate(card.summary) ||
      isIncoherentFeedText(card.summary) ||
      isGuestMessageNoise({ content: card.summary, senderName: card.guestName })
    ) {
      return card.detailLines.some((line) => line.trim().length > 0);
    }
    return true;
  }

  return Boolean(
    card.summary?.trim() ||
      card.amountLabel ||
      card.detailLines.some((line) => line.trim().length > 0),
  );
}

function normalizeDedupeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function buildDedupeKey(card: OperationalFeedCard): string {
  if (!card.reservationId) return card.id;

  if (card.kind === "GUEST_MESSAGE") {
    return `${card.reservationId}:GUEST_MESSAGE:${normalizeDedupeText(
      normalizeGuestMessageBody(card.summary, { guestName: card.guestName }) ??
        card.summary,
    )}`;
  }

  if (card.kind === "NEW_RESERVATION") {
    return `${card.reservationId}:NEW_RESERVATION`;
  }

  if (card.kind === "PAYOUT_SENT") {
    return `${card.reservationId}:PAYOUT_SENT:${card.createdAt.slice(0, 10)}`;
  }

  if (
    card.kind === "MODIFICATION_APPROVED" ||
    card.kind === "RESERVATION_UPDATED"
  ) {
    return `${card.reservationId}:RESERVATION_CHANGE:${card.createdAt.slice(0, 10)}`;
  }

  return `${card.reservationId}:${card.kind}:${card.createdAt.slice(0, 10)}`;
}

/** Elimina duplicados y eventos de bajo valor antes de mostrar la bandeja. */
export function sanitizeOperationalFeedCards(
  cards: OperationalFeedCard[],
): OperationalFeedCard[] {
  const sorted = [...cards].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const seen = new Set<string>();
  const result: OperationalFeedCard[] = [];

  for (const card of sorted) {
    if (!isOperationalFeedCardUseful(card)) continue;

    const key = buildDedupeKey(card);
    if (seen.has(key)) continue;
    seen.add(key);

    if (
      card.kind === "RESERVATION_UPDATED" &&
      result.some(
        (existing) =>
          existing.reservationId === card.reservationId &&
          existing.kind === "MODIFICATION_APPROVED" &&
          existing.createdAt.slice(0, 10) === card.createdAt.slice(0, 10),
      )
    ) {
      continue;
    }

    result.push(card);
  }

  return result;
}

/** Oculta desembolsos huérfanos sin contexto de reserva. */
export function filterUnlinkedFeedCards(
  cards: OperationalFeedCard[],
): OperationalFeedCard[] {
  return cards.filter(
    (card) => card.kind === "PAYOUT_SENT" && Boolean(card.amountLabel),
  );
}

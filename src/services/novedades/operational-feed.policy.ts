import type {
  OperationalFeedCard,
  OperationalFeedKind,
} from "@/services/novedades/operational-feed.types";

const ATTENTION_KINDS = new Set<OperationalFeedKind>([
  "MODIFICATION_REQUEST",
  "ALERT",
]);

const GUEST_MESSAGE_NOISE = [
  /^te envi[oó] un mensaje/i,
  /^message from\b/i,
  /^mensaje sobre su reserva/i,
  /^airbnb\s*(automated|notification)?$/i,
  /^notificaci[oó]n de airbnb/i,
  /^responder en airbnb/i,
  /^reply on airbnb/i,
  /^nueva calificaci[oó]n/i,
  /^new review/i,
];

const GENERIC_SENDER_NOISE = [
  /^airbnb$/i,
  /^notificaciones? airbnb/i,
  /^airbnb support/i,
];

export function operationalFeedPriority(
  kind: OperationalFeedKind,
): "normal" | "attention" {
  return ATTENTION_KINDS.has(kind) ? "attention" : "normal";
}

export function isGuestMessageNoise(input: {
  content: string | null | undefined;
  senderName?: string | null;
}): boolean {
  const content = input.content?.trim() ?? "";
  const sender = input.senderName?.trim() ?? "";

  if (content.length < 8) return true;

  for (const pattern of GUEST_MESSAGE_NOISE) {
    if (pattern.test(content)) return true;
  }

  if (sender && GENERIC_SENDER_NOISE.some((pattern) => pattern.test(sender))) {
    if (content.length < 40) return true;
  }

  return false;
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
    return `${card.reservationId}:GUEST_MESSAGE:${normalizeDedupeText(card.summary)}`;
  }

  if (card.kind === "NEW_RESERVATION") {
    return `${card.reservationId}:NEW_RESERVATION`;
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
    if (card.kind === "GUEST_MESSAGE" && isGuestMessageNoise({ content: card.summary })) {
      continue;
    }

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

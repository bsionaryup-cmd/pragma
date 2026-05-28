export type GuestCountSignals = {
  guestCountTotal: number | null;
  adultCount: number | null;
  childCount: number | null;
  infantCount: number | null;
  petCount: number | null;
};

const EMPTY_GUEST_COUNTS: GuestCountSignals = {
  guestCountTotal: null,
  adultCount: null,
  childCount: null,
  infantCount: null,
  petCount: null,
};

const GUEST_LABEL_RE = /(?:^|\n)\s*(?:viajeros?|travellers?|travelers?|guests?)\s*(?:\n|$)/i;
const COUNT_TOKEN_RE =
  /(\d{1,2})\s*(adulto?s?|adults?|niñ[oa]s?|children|child|beb[eé]s?|infants?|mascotas?|pets?|hu[eé]spedes?|guests?|viajeros?|travelers?|travellers?)/gi;

function clampCount(value: number | null): number | null {
  if (!Number.isFinite(value) || value == null || value < 0 || value > 30) return null;
  return value;
}

function readLineAfterGuestLabel(text: string): string | null {
  const match = text.match(GUEST_LABEL_RE);
  if (!match || match.index == null) return null;
  const after = text.slice(match.index + match[0].length);
  const lines = after
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines[0] ?? null;
}

function normalizedTokenType(
  rawToken: string,
): "adult" | "child" | "infant" | "pet" | "guest" | null {
  const token = rawToken
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (token.startsWith("adult")) return "adult";
  if (token.startsWith("nin") || token.startsWith("child")) return "child";
  if (token.startsWith("bebe") || token.startsWith("infant")) return "infant";
  if (token.startsWith("mascota") || token.startsWith("pet")) return "pet";
  if (token.startsWith("huesped") || token.startsWith("guest") || token.startsWith("viajero") || token.startsWith("traveler") || token.startsWith("traveller")) {
    return "guest";
  }
  return null;
}

function parseGuestCountLine(line: string): GuestCountSignals {
  let adultCount: number | null = null;
  let childCount: number | null = null;
  let infantCount: number | null = null;
  let petCount: number | null = null;
  let genericGuestCount: number | null = null;

  for (const match of line.matchAll(COUNT_TOKEN_RE)) {
    const count = clampCount(Number(match[1]));
    const type = normalizedTokenType(match[2] ?? "");
    if (count == null || !type) continue;
    if (type === "adult") adultCount = count;
    if (type === "child") childCount = count;
    if (type === "infant") infantCount = count;
    if (type === "pet") petCount = count;
    if (type === "guest") genericGuestCount = count;
  }

  const specificTotal =
    (adultCount ?? 0) + (childCount ?? 0) + (infantCount ?? 0) + (petCount ?? 0);
  const hasSpecific = adultCount != null || childCount != null || infantCount != null || petCount != null;

  let guestCountTotal: number | null = null;
  if (hasSpecific) guestCountTotal = specificTotal;
  else guestCountTotal = genericGuestCount;

  if (!hasSpecific && genericGuestCount != null) {
    adultCount = genericGuestCount;
  }

  return {
    guestCountTotal,
    adultCount,
    childCount,
    infantCount,
    petCount,
  };
}

export function extractGuestCountSignals(text: string): GuestCountSignals {
  const line = readLineAfterGuestLabel(text);
  if (!line) return EMPTY_GUEST_COUNTS;
  return parseGuestCountLine(line);
}

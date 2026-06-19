import { extractAirbnbEmbeddedHtmlSlices } from "@/modules/airbnb-email/parsing/structured-html-extract";
import { stripHtmlToText } from "@/modules/airbnb-email/parsing/html-parse";

export type ReservationFinancialSignals = {
  guestTotalPaid: number | null;
  hostPayoutAmount: number | null;
  currency: string | null;
  nightCount: number | null;
};

export type ReservationFinancialScope = {
  html?: string | null;
  confirmationCode?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  /** Total bruto ya validado (p. ej. del HTML estructurado) para anclar Ganas correcto. */
  anchorGuestTotal?: number | null;
};

const EMPTY_FINANCIALS: ReservationFinancialSignals = {
  guestTotalPaid: null,
  hostPayoutAmount: null,
  currency: null,
  nightCount: null,
};

const MONEY_TOKEN_RE = /(?:\$|COP|USD|EUR|€)?\s*([\d.,]+)/i;
const HOST_PAYOUT_MAX_GUEST_RATIO = 1.15;

function parseMoneyLocalized(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const normalized = raw.replace(/[^\d.,-]/g, "");
  let value = normalized;
  if (/^\d{1,3}(\.\d{3})+,\d{2}$/.test(normalized)) {
    value = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) {
    value = normalized.replace(/,/g, "");
  } else if (/^\d+,\d+$/.test(normalized)) {
    value = normalized.replace(",", ".");
  } else if (/^\d+(\.\d+)?$/.test(normalized)) {
    value = normalized;
  } else {
    value = normalized.replace(/\./g, "").replace(",", ".");
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findGuestTotalPaid(text: string): { amount: number | null; currency: string | null } {
  const byLabel =
    text.match(
      /(?:^|\n)\s*Total\s*\(([A-Z]{3})\)\s*(?:\n|$)\s*([^\n]+)/i,
    ) ??
    text.match(/Total\s*\(([A-Z]{3})\)\s*(?:\n|\s+)\$?\s*([\d.,]+)/i);
  if (byLabel) {
    return {
      amount: parseMoneyLocalized(byLabel[2]),
      currency: byLabel[1]?.toUpperCase() ?? null,
    };
  }
  return { amount: null, currency: null };
}

function findGanasCandidates(text: string): number[] {
  const amounts = new Set<number>();
  for (const match of text.matchAll(/Ganas[\s\S]{0,120}?(?:\$|\bCOP\b|\bUSD\b)?\s*([\d.,]+)/gi)) {
    const amount = parseMoneyLocalized(match[1]);
    if (amount != null && amount > 0) amounts.add(amount);
  }
  for (const match of text.matchAll(/(?:^|\n)\s*Ganas\s*(?:\n|$)\s*([^\n]+)/gi)) {
    const amount = parseMoneyLocalized(match[1]);
    if (amount != null && amount > 0) amounts.add(amount);
  }
  return [...amounts];
}

function findCobroSectionCandidates(text: string): number[] {
  const amounts = new Set<number>();
  const hostSection = text.match(
    /(?:^|\n)\s*Cobro del anfitri[oó]n\s*(?:\n|$)([\s\S]{0,300})/i,
  )?.[1];
  if (hostSection) {
    for (const line of hostSection.split("\n")) {
      const token = line.trim().match(MONEY_TOKEN_RE)?.[1];
      const amount = parseMoneyLocalized(token);
      if (amount != null && amount > 0) amounts.add(amount);
    }
  }
  return [...amounts];
}

function pickHostPayoutAmount(
  candidates: number[],
  guestTotalPaid: number | null,
): number | null {
  const monetaryCandidates = candidates.filter((amount) => amount >= 10_000);
  const pool = monetaryCandidates.length > 0 ? monetaryCandidates : candidates;
  if (pool.length === 0) return null;
  if (guestTotalPaid != null && guestTotalPaid > 0) {
    const viable = pool.filter(
      (amount) =>
        amount <= guestTotalPaid * HOST_PAYOUT_MAX_GUEST_RATIO &&
        amount >= guestTotalPaid * 0.45,
    );
    if (viable.length > 0) {
      return viable.sort(
        (a, b) =>
          Math.abs(a - guestTotalPaid * 0.85) - Math.abs(b - guestTotalPaid * 0.85),
      )[0];
    }
    return null;
  }
  if (pool.length === 1) return pool[0];
  return Math.max(...pool);
}

function findHostPayoutAmount(text: string, guestTotalPaid: number | null): number | null {
  const fromGanas = pickHostPayoutAmount(findGanasCandidates(text), guestTotalPaid);
  if (fromGanas != null) return fromGanas;
  return pickHostPayoutAmount(findCobroSectionCandidates(text), guestTotalPaid);
}

function findNightCount(text: string): number | null {
  const token = text.match(/\b(\d{1,2})\s+noches?\b/i)?.[1];
  if (!token) return null;
  const nights = Number(token);
  return Number.isFinite(nights) && nights > 0 && nights <= 60 ? nights : null;
}

function extractFromPlainText(
  text: string,
  anchorGuestTotal?: number | null,
): ReservationFinancialSignals {
  const guest = findGuestTotalPaid(text);
  const guestTotalPaid =
    anchorGuestTotal != null && anchorGuestTotal > 0
      ? anchorGuestTotal
      : guest.amount;
  const hostPayoutAmount = findHostPayoutAmount(text, guestTotalPaid);
  const nightCount = findNightCount(text);
  if (!guestTotalPaid && !hostPayoutAmount && !nightCount) {
    return EMPTY_FINANCIALS;
  }
  return {
    guestTotalPaid: guestTotalPaid ?? null,
    hostPayoutAmount,
    currency: guest.currency,
    nightCount,
  };
}

function sliceScopeScore(slice: string, scope: ReservationFinancialScope): number {
  let score = 0;
  const code = scope.confirmationCode?.trim();
  const hasFinancial =
    /Total\s*\((?:COP|USD|EUR)\)/i.test(slice) || /Ganas/i.test(slice);
  if (code && slice.includes(code)) {
    score += hasFinancial ? 120 : 15;
  }
  if (scope.checkIn && slice.includes(scope.checkIn)) score += hasFinancial ? 45 : 10;
  if (scope.checkOut && slice.includes(scope.checkOut)) score += hasFinancial ? 45 : 10;
  if (/Ganas/i.test(slice)) score += 15;
  if (/Cobro del anfitri/i.test(slice)) score += 8;
  if (/Total\s*\((?:COP|USD|EUR)\)/i.test(slice)) score += 10;
  return score;
}

function isFinanciallyConsistent(signals: ReservationFinancialSignals): boolean {
  const guest = signals.guestTotalPaid;
  const host = signals.hostPayoutAmount;
  if (host == null || host <= 0) return Boolean(guest && guest > 0);
  if (guest == null || guest <= 0) return true;
  return host <= guest * HOST_PAYOUT_MAX_GUEST_RATIO && host >= guest * 0.45;
}

function extractFromHtmlSlices(
  html: string,
  scope: ReservationFinancialScope,
): ReservationFinancialSignals | null {
  const slices = extractAirbnbEmbeddedHtmlSlices(html);
  const ranked = slices
    .map((slice, index) => ({
      index,
      score: sliceScopeScore(slice, scope),
      text: stripHtmlToText(slice),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  for (const row of ranked) {
    const signals = extractFromPlainText(row.text, scope.anchorGuestTotal);
    if (isFinanciallyConsistent(signals) && signals.hostPayoutAmount != null) {
      return signals;
    }
  }

  for (const slice of slices) {
    const signals = extractFromPlainText(stripHtmlToText(slice), scope.anchorGuestTotal);
    if (isFinanciallyConsistent(signals) && signals.hostPayoutAmount != null) {
      return signals;
    }
  }

  return null;
}

export function extractReservationFinancialSignals(
  text: string,
  scope?: ReservationFinancialScope,
): ReservationFinancialSignals {
  if (scope?.html?.trim()) {
    const fromHtml = extractFromHtmlSlices(scope.html, scope);
    if (fromHtml?.hostPayoutAmount != null || fromHtml?.guestTotalPaid != null) {
      return fromHtml;
    }
  }

  const plain = extractFromPlainText(text, scope?.anchorGuestTotal);
  if (isFinanciallyConsistent(plain)) return plain;

  if (plain.hostPayoutAmount != null && plain.guestTotalPaid != null) {
    return {
      ...plain,
      hostPayoutAmount: pickHostPayoutAmount(
        findGanasCandidates(text),
        plain.guestTotalPaid,
      ),
    };
  }

  return plain;
}

/** Rechaza payout del anfitrión incoherente con total pagado por huésped (forwards anidados). */
export function sanitizeHostPayoutAgainstGuestTotal(
  signals: ReservationFinancialSignals,
): ReservationFinancialSignals {
  const guest = signals.guestTotalPaid;
  const host = signals.hostPayoutAmount;
  if (host == null || guest == null || guest <= 0) return signals;
  if (host <= guest * HOST_PAYOUT_MAX_GUEST_RATIO && host >= guest * 0.45) {
    return signals;
  }
  return { ...signals, hostPayoutAmount: null };
}

export function isHostPayoutConsistentWithGuestTotal(input: {
  hostPayoutAmount?: number | null;
  guestTotalPaid?: number | null;
  grossAmount?: number | null;
}): boolean {
  const host = input.hostPayoutAmount ?? 0;
  if (host <= 0) return true;

  const refs = [input.guestTotalPaid, input.grossAmount].filter(
    (value): value is number => value != null && value > 0,
  );
  if (refs.length === 0) return true;

  const minRef = Math.min(...refs);
  const maxRef = Math.max(...refs);
  if (maxRef > minRef * 1.2) {
    return host <= minRef * HOST_PAYOUT_MAX_GUEST_RATIO && host >= minRef * 0.45;
  }
  return host <= maxRef * HOST_PAYOUT_MAX_GUEST_RATIO && host >= minRef * 0.45;
}

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
const BREAKDOWN_TOLERANCE_RATIO = 0.02;
const RESERVATION_CODE_RE = /\b(HM[A-Z0-9]{8,12})\b/gi;
const FORWARD_DELIMITER_RE = /-{5,}\s*Forwarded message\s*-{5,}/gi;
const HOST_CHARGE_SECTION_RE = /Cobro del anfitri[oó]n/gi;

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
  return Number.isFinite(parsed) ? Math.abs(parsed) : null;
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

function findHostChargeSection(text: string): string | null {
  return text.match(/Cobro del anfitri[oó]n([\s\S]{0,900})/i)?.[1] ?? null;
}

function findRoomPriceFromHostSection(text: string): number | null {
  const section = findHostChargeSection(text) ?? text;
  const match = section.match(
    /precio de la habitaci[oó]n[\s\S]{0,140}?\$?\s*([\d.,]+)/i,
  );
  return parseMoneyLocalized(match?.[1]);
}

function findHostCommissionFromHostSection(text: string): number | null {
  const section = findHostChargeSection(text) ?? text;
  const match = section.match(
    /comisi[oó]n de servicio del anfitri[oó]n[\s\S]{0,140}?-?\s*\$?\s*([\d.,]+)/i,
  );
  return parseMoneyLocalized(match?.[1]);
}

export function amountsRoughlyEqual(a: number, b: number): boolean {
  const tolerance = Math.max(2, Math.max(a, b) * BREAKDOWN_TOLERANCE_RATIO);
  return Math.abs(a - b) <= tolerance;
}

function collectBoundaryIndexes(text: string): number[] {
  const boundaries = new Set<number>([0]);
  for (const match of text.matchAll(RESERVATION_CODE_RE)) {
    if (match.index != null) boundaries.add(match.index);
  }
  for (const match of text.matchAll(FORWARD_DELIMITER_RE)) {
    if (match.index != null) boundaries.add(match.index);
  }
  return [...boundaries].sort((a, b) => a - b);
}

/** Restringe el texto al bloque de la reserva identificada por confirmationCode. */
export function scopeTextToReservation(
  text: string,
  scope: Pick<ReservationFinancialScope, "confirmationCode" | "checkIn" | "checkOut">,
): string {
  const code = scope.confirmationCode?.trim().toUpperCase();
  if (!code) return text;

  const upper = text.toUpperCase();
  const codeIdx = upper.indexOf(code);
  if (codeIdx === -1) {
    if (scope.checkIn && text.includes(scope.checkIn)) {
      const dateIdx = text.indexOf(scope.checkIn);
      return text.slice(Math.max(0, dateIdx - 2500), dateIdx + 9000);
    }
    if (scope.checkOut && text.includes(scope.checkOut)) {
      const dateIdx = text.indexOf(scope.checkOut);
      return text.slice(Math.max(0, dateIdx - 9000), dateIdx + 2500);
    }
    return text;
  }

  const boundaries = collectBoundaryIndexes(text);
  let start = 0;
  let end = text.length;

  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i]!;
    if (boundary < codeIdx) start = boundary;
    if (boundary > codeIdx) {
      end = boundary;
      break;
    }
  }

  return text.slice(start, end);
}

function splitHostChargeSections(text: string): string[] {
  const matches = [...text.matchAll(HOST_CHARGE_SECTION_RE)];
  if (matches.length === 0) return [text];
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end =
      index + 1 < matches.length
        ? (matches[index + 1]!.index ?? text.length)
        : text.length;
    return text.slice(start, end);
  });
}

function countAuthoritativeBreakdowns(text: string): number {
  let count = 0;
  for (const section of splitHostChargeSections(text)) {
    if (findAuthoritativeHostBreakdownInSection(section) != null) count++;
  }
  return count;
}

/** Desglose explícito Airbnb: habitación − comisión = Ganas. Sin heurísticas ambiguas. */
function findAuthoritativeHostBreakdownInSection(
  text: string,
): ReservationFinancialSignals | null {
  const guest = findGuestTotalPaid(text);
  const roomPrice = findRoomPriceFromHostSection(text);
  const commission = findHostCommissionFromHostSection(text);
  const ganasCandidates = findGanasCandidates(text);

  if (roomPrice == null || ganasCandidates.length === 0) return null;

  const validatedGanas = ganasCandidates.filter((ganas) => {
    if (commission == null) return ganasCandidates.length === 1;
    return amountsRoughlyEqual(ganas, roomPrice - commission);
  });

  if (validatedGanas.length !== 1) return null;

  const ganas = validatedGanas[0]!;
  const guestTotalPaid =
    guest.amount != null && guest.amount >= roomPrice * 0.9
      ? guest.amount
      : roomPrice;

  return {
    guestTotalPaid,
    hostPayoutAmount: ganas,
    currency: guest.currency,
    nightCount: findNightCount(text),
  };
}

function findAuthoritativeHostBreakdown(
  text: string,
  scope?: Pick<ReservationFinancialScope, "confirmationCode" | "checkIn" | "checkOut">,
): ReservationFinancialSignals | null {
  const scopedText = scope ? scopeTextToReservation(text, scope) : text;
  const breakdown = findAuthoritativeHostBreakdownInSection(scopedText);
  if (breakdown != null) return breakdown;

  if (!scope?.confirmationCode && countAuthoritativeBreakdowns(text) > 1) {
    return null;
  }

  return null;
}

function pickHostPayoutAmount(
  candidates: number[],
  guestTotalPaid: number | null,
  excludedAmounts: number[] = [],
): number | null {
  const excluded = new Set(excludedAmounts);
  const filtered = candidates.filter((amount) => !excluded.has(amount));
  if (filtered.length !== 1) return null;

  const amount = filtered[0]!;
  if (guestTotalPaid != null && guestTotalPaid > 0) {
    if (
      amount <= guestTotalPaid * HOST_PAYOUT_MAX_GUEST_RATIO &&
      amount >= guestTotalPaid * 0.45
    ) {
      return amount;
    }
    return null;
  }
  return amount;
}

function findHostPayoutAmount(
  text: string,
  guestTotalPaid: number | null,
  hostCommission: number | null,
): number | null {
  const ganasCandidates = findGanasCandidates(text);
  if (ganasCandidates.length === 1) {
    const ganas = ganasCandidates[0]!;
    if (guestTotalPaid != null && guestTotalPaid > 0) {
      if (
        ganas <= guestTotalPaid * HOST_PAYOUT_MAX_GUEST_RATIO &&
        ganas >= guestTotalPaid * 0.45
      ) {
        return ganas;
      }
      return null;
    }
    return ganas;
  }

  return pickHostPayoutAmount(
    ganasCandidates,
    guestTotalPaid,
    hostCommission != null ? [hostCommission] : [],
  );
}

function findNightCount(text: string): number | null {
  const token = text.match(/\b(\d{1,2})\s+noches?\b/i)?.[1];
  if (!token) return null;
  const nights = Number(token);
  return Number.isFinite(nights) && nights > 0 && nights <= 60 ? nights : null;
}

function extractFromPlainText(
  text: string,
  scope?: ReservationFinancialScope,
): ReservationFinancialSignals {
  const codeScope = scope
    ? {
        confirmationCode: scope.confirmationCode,
        checkIn: scope.checkIn,
        checkOut: scope.checkOut,
      }
    : undefined;
  const scopedText = codeScope ? scopeTextToReservation(text, codeScope) : text;

  const breakdown = findAuthoritativeHostBreakdown(text, codeScope);
  if (breakdown?.hostPayoutAmount != null) {
    if (scope?.anchorGuestTotal != null && scope.anchorGuestTotal > 0) {
      return { ...breakdown, guestTotalPaid: scope.anchorGuestTotal };
    }
    return breakdown;
  }

  if (!scope?.confirmationCode && countAuthoritativeBreakdowns(text) > 1) {
    return EMPTY_FINANCIALS;
  }

  const guest = findGuestTotalPaid(scopedText);
  const roomPrice = findRoomPriceFromHostSection(scopedText);
  const hostCommission = findHostCommissionFromHostSection(scopedText);
  const guestTotalPaid =
    scope?.anchorGuestTotal != null && scope.anchorGuestTotal > 0
      ? scope.anchorGuestTotal
      : guest.amount ?? roomPrice;
  const hostPayoutAmount = findHostPayoutAmount(
    scopedText,
    guestTotalPaid,
    hostCommission,
  );
  const nightCount = findNightCount(scopedText);
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

  const code = scope.confirmationCode?.trim();

  for (const row of ranked) {
    if (code && !row.text.toUpperCase().includes(code.toUpperCase())) continue;
    const breakdown = findAuthoritativeHostBreakdown(row.text, scope);
    if (breakdown?.hostPayoutAmount != null) {
      return scope.anchorGuestTotal != null && scope.anchorGuestTotal > 0
        ? { ...breakdown, guestTotalPaid: scope.anchorGuestTotal }
        : breakdown;
    }
  }

  for (const row of ranked) {
    if (code && !row.text.toUpperCase().includes(code.toUpperCase())) continue;
    const signals = extractFromPlainText(row.text, scope);
    if (isFinanciallyConsistent(signals) && signals.hostPayoutAmount != null) {
      return signals;
    }
  }

  if (!code && countAuthoritativeBreakdowns(stripHtmlToText(html)) > 1) {
    return null;
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

  const plain = extractFromPlainText(text, scope);
  if (isFinanciallyConsistent(plain) && plain.hostPayoutAmount != null) return plain;

  const breakdown = findAuthoritativeHostBreakdown(text, scope);
  if (breakdown?.hostPayoutAmount != null) return breakdown;

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

/** Señales del blob prevalecen cuando las señales persistidas parecen comisión vs Ganas. */
export function preferBlobFinancialsOverInconsistentSignals(input: {
  signals: ReservationFinancialSignals;
  blob: ReservationFinancialSignals;
}): ReservationFinancialSignals {
  const signalHost = input.signals.hostPayoutAmount;
  const blobHost = input.blob.hostPayoutAmount;
  if (signalHost == null || blobHost == null) {
    return input.signals.hostPayoutAmount != null ? input.signals : input.blob;
  }

  if (amountsRoughlyEqual(signalHost, blobHost)) {
    return {
      guestTotalPaid: input.signals.guestTotalPaid ?? input.blob.guestTotalPaid,
      hostPayoutAmount: signalHost,
      currency: input.signals.currency ?? input.blob.currency,
      nightCount: input.signals.nightCount ?? input.blob.nightCount,
    };
  }

  const blobBreakdownValid =
    input.blob.guestTotalPaid != null &&
    isHostPayoutConsistentWithGuestTotal({
      hostPayoutAmount: blobHost,
      guestTotalPaid: input.blob.guestTotalPaid,
      grossAmount: input.blob.guestTotalPaid,
    });

  const signalLooksLikeCommission =
    input.blob.guestTotalPaid != null &&
    amountsRoughlyEqual(
      signalHost,
      input.blob.guestTotalPaid - blobHost,
    );

  if (blobBreakdownValid && signalLooksLikeCommission) {
    return input.blob;
  }

  if (
    blobBreakdownValid &&
    !isHostPayoutConsistentWithGuestTotal({
      hostPayoutAmount: signalHost,
      guestTotalPaid: input.signals.guestTotalPaid,
      grossAmount: input.signals.guestTotalPaid,
    })
  ) {
    return input.blob;
  }

  return input.signals;
}

export type ReservationFinancialSignals = {
  guestTotalPaid: number | null;
  hostPayoutAmount: number | null;
  currency: string | null;
  nightCount: number | null;
};

const EMPTY_FINANCIALS: ReservationFinancialSignals = {
  guestTotalPaid: null,
  hostPayoutAmount: null,
  currency: null,
  nightCount: null,
};

const MONEY_TOKEN_RE = /(?:\$|COP|USD|EUR|€)?\s*([\d.,]+)/i;

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
  const byLabel = text.match(
    /(?:^|\n)\s*Total\s*\(([A-Z]{3})\)\s*(?:\n|$)\s*([^\n]+)/i,
  );
  if (byLabel) {
    return {
      amount: parseMoneyLocalized(byLabel[2]),
      currency: byLabel[1]?.toUpperCase() ?? null,
    };
  }
  return { amount: null, currency: null };
}

function findHostPayoutAmount(text: string): number | null {
  const byGanas = text.match(/(?:^|\n)\s*Ganas\s*(?:\n|$)\s*([^\n]+)/i);
  if (byGanas?.[1]) {
    const amount = parseMoneyLocalized(byGanas[1]);
    if (amount != null) return amount;
  }

  const hostSection = text.match(
    /(?:^|\n)\s*Cobro del anfitri[oó]n\s*(?:\n|$)([\s\S]{0,300})/i,
  )?.[1];
  if (hostSection) {
    const lines = hostSection
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of lines) {
      const token = line.match(MONEY_TOKEN_RE)?.[1];
      const amount = parseMoneyLocalized(token);
      if (amount != null) return amount;
    }
  }

  return null;
}

function findNightCount(text: string): number | null {
  const token = text.match(/\b(\d{1,2})\s+noches?\b/i)?.[1];
  if (!token) return null;
  const nights = Number(token);
  return Number.isFinite(nights) && nights > 0 && nights <= 60 ? nights : null;
}

export function extractReservationFinancialSignals(
  text: string,
): ReservationFinancialSignals {
  const guest = findGuestTotalPaid(text);
  const hostPayoutAmount = findHostPayoutAmount(text);
  const nightCount = findNightCount(text);
  if (!guest.amount && !hostPayoutAmount && !nightCount) {
    return EMPTY_FINANCIALS;
  }
  return {
    guestTotalPaid: guest.amount,
    hostPayoutAmount,
    currency: guest.currency,
    nightCount,
  };
}

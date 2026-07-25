/**
 * Extract booking slots (guests, dates) from Spanish guest messages.
 * Additive dialogue helper — no LLM.
 */

export type BookingSlots = {
  guests: number | null;
  checkIn: string | null; // YYYY-MM-DD
  checkOut: string | null;
  confirmedIntent: boolean;
};

const MONTHS: Record<string, number> = {
  enero: 1,
  ene: 1,
  february: 2,
  febrero: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  jun: 6,
  julio: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  septiembre: 9,
  setiembre: 9,
  sep: 9,
  octubre: 10,
  oct: 10,
  noviembre: 11,
  nov: 11,
  diciembre: 12,
  dic: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function defaultYear(month: number, day: number, now = new Date()): number {
  const y = now.getFullYear();
  const candidate = new Date(y, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (candidate < today) return y + 1;
  return y;
}

function extractGuests(text: string): number | null {
  const patterns = [
    /(\d{1,2})\s*(?:personas?a*|pax|hu[eé]spedes?|adultos?)/i,
    /(?:para|somos|somos\s+un\s+grupo\s+de)\s+(\d{1,2})\b/i,
    /\bpara\s+(\d{1,2})\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 30) return n;
    }
  }
  return null;
}

/**
 * Parse ranges like:
 * - 21 al 23 de julio
 * - del 21 de julio al 28 de julio
 * - 21/07 al 23/07
 * - 2026-07-21 al 2026-07-23
 */
function extractDateRange(
  text: string,
  now = new Date(),
): { checkIn: string; checkOut: string } | null {
  const lower = text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

  // ISO range
  const iso = lower.match(
    /(\d{4}-\d{2}-\d{2}).{0,20}?(\d{4}-\d{2}-\d{2})/,
  );
  if (iso) {
    if (iso[2] > iso[1]) return { checkIn: iso[1], checkOut: iso[2] };
  }

  // dd/mm(/yyyy) al dd/mm(/yyyy)
  const slash = lower.match(
    /(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\s*(?:al|a|hasta|-|–|—)\s*(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/,
  );
  if (slash) {
    const m1 = Number(slash[2]);
    const d1 = Number(slash[1]);
    const y1 = slash[3]
      ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3])
      : defaultYear(m1, d1, now);
    const m2 = Number(slash[5]);
    const d2 = Number(slash[4]);
    const y2 = slash[6]
      ? Number(slash[6].length === 2 ? `20${slash[6]}` : slash[6])
      : defaultYear(m2, d2, now);
    const a = toIso(y1, m1, d1);
    const b = toIso(y2, m2, d2);
    if (a && b && b > a) return { checkIn: a, checkOut: b };
  }

  // 21 al 23 de julio / del 21 al 28 de julio
  const monthNames = Object.keys(MONTHS).join("|");
  const sameMonth = lower.match(
    new RegExp(
      `(?:del?\\s*)?(\\d{1,2})\\s*(?:al|a|hasta|-|–|—)\\s*(\\d{1,2})\\s*(?:de\\s+)?(${monthNames})(?:\\s*(?:de\\s+)?(\\d{4}))?`,
      "i",
    ),
  );
  if (sameMonth) {
    const d1 = Number(sameMonth[1]);
    const d2 = Number(sameMonth[2]);
    const month = MONTHS[sameMonth[3].toLowerCase()];
    const year = sameMonth[4]
      ? Number(sameMonth[4])
      : defaultYear(month, d1, now);
    const a = toIso(year, month, d1);
    const b = toIso(year, month, d2);
    if (a && b && b > a) return { checkIn: a, checkOut: b };
  }

  // del 21 de julio al 28 de julio / hasta el 28 de julio
  const twoMonths = lower.match(
    new RegExp(
      `(?:del?\\s*)?(\\d{1,2})\\s*(?:de\\s+)?(${monthNames})(?:\\s*(?:de\\s+)?(\\d{4}))?\\s*(?:al|a|hasta|-|–|—)\\s*(?:el\\s*)?(\\d{1,2})\\s*(?:de\\s+)?(${monthNames})(?:\\s*(?:de\\s+)?(\\d{4}))?`,
      "i",
    ),
  );
  if (twoMonths) {
    const d1 = Number(twoMonths[1]);
    const m1 = MONTHS[twoMonths[2].toLowerCase()];
    const y1 = twoMonths[3]
      ? Number(twoMonths[3])
      : defaultYear(m1, d1, now);
    const d2 = Number(twoMonths[4]);
    const m2 = MONTHS[twoMonths[5].toLowerCase()];
    const y2 = twoMonths[6] ? Number(twoMonths[6]) : defaultYear(m2, d2, now);
    const a = toIso(y1, m1, d1);
    const b = toIso(y2, m2, d2);
    if (a && b && b > a) return { checkIn: a, checkOut: b };
  }

  return null;
}

function extractBareDayRange(
  text: string,
  prefer: { checkIn?: string | null; checkOut?: string | null },
  now = new Date(),
): { checkIn: string; checkOut: string } | null {
  const lower = text.toLowerCase();
  const bare = lower.match(
    /(?:^|[^\d])(\d{1,2})\s*(?:al|a|hasta|-|–|—)\s*(\d{1,2})(?!\s*de\b)/,
  );
  if (!bare) return null;
  const d1 = Number(bare[1]);
  const d2 = Number(bare[2]);
  if (d1 < 1 || d1 > 31 || d2 < 1 || d2 > 31 || d2 <= d1) return null;

  let month = now.getMonth() + 1;
  let year = now.getFullYear();
  const ref = prefer.checkIn || prefer.checkOut;
  if (ref && /^\d{4}-\d{2}-\d{2}$/.test(ref)) {
    year = Number(ref.slice(0, 4));
    month = Number(ref.slice(5, 7));
  } else {
    year = defaultYear(month, d1, now);
  }
  const a = toIso(year, month, d1);
  const b = toIso(year, month, d2);
  if (a && b && b > a) return { checkIn: a, checkOut: b };
  return null;
}

function extractLabeledSingleDate(
  text: string,
  label: RegExp,
  now = new Date(),
): string | null {
  const lower = text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const monthNames = Object.keys(MONTHS).join("|");
  const labeled = lower.match(
    new RegExp(
      `${label.source}\\s*[:=]?\\s*(?:el\\s*)?(\\d{1,2})\\s*(?:de\\s+)?(${monthNames})(?:\\s*(?:de\\s+)?(\\d{4}))?`,
      "i",
    ),
  );
  if (labeled) {
    const day = Number(labeled[1]);
    const month = MONTHS[labeled[2].toLowerCase()];
    const year = labeled[3]
      ? Number(labeled[3])
      : defaultYear(month, day, now);
    return toIso(year, month, day);
  }
  const slash = lower.match(
    new RegExp(
      `${label.source}\\s*[:=]?\\s*(\\d{1,2})[\\/\\-.](\\d{1,2})(?:[\\/\\-.](\\d{2,4}))?`,
      "i",
    ),
  );
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = slash[3]
      ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3])
      : defaultYear(month, day, now);
    return toIso(year, month, day);
  }
  return null;
}

function extractBareSingleDate(
  text: string,
  now = new Date(),
): string | null {
  const lower = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
  if (/\s+(?:al|hasta|-|–|—)\s+/.test(lower)) return null;
  const monthNames = Object.keys(MONTHS).join("|");
  const named = lower.match(
    new RegExp(
      `^(?:el\\s+)?(\\d{1,2})\\s*(?:de\\s+)?(${monthNames})(?:\\s*(?:de\\s+)?(\\d{4}))?[\\s!.?]*$`,
      "i",
    ),
  );
  if (named) {
    const day = Number(named[1]);
    const month = MONTHS[named[2].toLowerCase()];
    const year = named[3]
      ? Number(named[3])
      : defaultYear(month, day, now);
    return toIso(year, month, day);
  }
  const slash = lower.match(
    /^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?[\s!.?]*$/,
  );
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = slash[3]
      ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3])
      : defaultYear(month, day, now);
    return toIso(year, month, day);
  }
  const iso = lower.match(/^(\d{4}-\d{2}-\d{2})[\s!.?]*$/);
  if (iso) return iso[1];
  return null;
}

/**
 * Agent ask templates / mis-read outbound must never seed booking slots.
 */
export function shouldIgnoreSlotSource(body: string): boolean {
  const t = body.trim();
  if (!t) return true;
  if (
    /Puedes responder as[ií]|Para revisar disponibilidad solo necesito|Me falta un dato para continuar/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /Entrada:\s*DD de mes|Salida:\s*DD de mes|\bN personas\b/i.test(t)
  ) {
    return true;
  }
  // Legacy bot example only when embedded in ask template (not real guest dates).
  if (
    /Puedes responder as[ií]|Para revisar disponibilidad solo necesito/i.test(
      t,
    ) &&
    /Entrada:\s*12 de agosto/i.test(t)
  ) {
    return true;
  }
  if (
    /Asistente Virtual de Recepci|Todav[ií]a no est[aá] creada|¿Te armo la reserva\?|S[ií] hay disponibilidad del/i.test(
      t,
    )
  ) {
    return true;
  }
  if (isLikelyMainMenuEcho(t)) {
    return true;
  }
  return false;
}

export function isLikelyMainMenuEcho(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    /1️⃣/.test(t) &&
    /5️⃣/.test(t) &&
    /seleccionar una de estas opciones/i.test(t)
  ) {
    return true;
  }
  if (
    /Mucho gusto,/i.test(t) &&
    /1️⃣/.test(t) &&
    /5️⃣/.test(t)
  ) {
    return true;
  }
  if (
    /Mucho gusto,/i.test(t) &&
    /Consultar disponibilidad/i.test(t) &&
    /Hablar con un asesor/i.test(t)
  ) {
    return true;
  }
  return false;
}

/** True when inbound text is likely an echo of our last outbound. */
export function isLikelyAgentEcho(
  guestMessage: string,
  lastAgentBody: string | null | undefined,
): boolean {
  if (!lastAgentBody?.trim() || !guestMessage.trim()) return false;
  const guest = guestMessage.trim();
  const mine = lastAgentBody.trim();
  if (guest === mine) return true;
  const n = Math.min(48, mine.length, guest.length);
  if (n < 24) return false;
  return (
    guest.startsWith(mine.slice(0, n)) || mine.startsWith(guest.slice(0, n))
  );
}

export function extractBookingSlotsFromText(
  text: string,
  now = new Date(),
  prefer: { checkIn?: string | null; checkOut?: string | null } = {},
): BookingSlots {
  if (shouldIgnoreSlotSource(text)) {
    return {
      guests: null,
      checkIn: null,
      checkOut: null,
      confirmedIntent: false,
    };
  }
  const guests = extractGuests(text);
  const range =
    extractDateRange(text, now) ?? extractBareDayRange(text, prefer, now);
  const labeledIn =
    extractLabeledSingleDate(text, /(?:entrada|llegada|check[\s-]?in)/i, now) ??
    null;
  const labeledOut =
    extractLabeledSingleDate(
      text,
      /(?:salida|check[\s-]?out)/i,
      now,
    ) ?? null;
  const bareSingle =
    !range && !labeledIn && !labeledOut
      ? extractBareSingleDate(text, now)
      : null;
  let bareCheckIn: string | null = null;
  let bareCheckOut: string | null = null;
  if (bareSingle) {
    if (!prefer.checkIn) bareCheckIn = bareSingle;
    else if (!prefer.checkOut && bareSingle > prefer.checkIn) {
      bareCheckOut = bareSingle;
    }
  }
  const confirmedIntent =
    /\b(s[ií]|ok|okay|dale|perfecto|confirmo|reservemos|quiero reservar|hagamos la reserva|de una)\b/i.test(
      text,
    ) && !/\bno\b/i.test(text);

  return {
    guests,
    checkIn: range?.checkIn ?? labeledIn ?? bareCheckIn ?? null,
    checkOut: range?.checkOut ?? labeledOut ?? bareCheckOut ?? null,
    confirmedIntent,
  };
}

export function mergeBookingSlots(
  base: BookingSlots,
  extra: BookingSlots,
): BookingSlots {
  return {
    guests: extra.guests ?? base.guests,
    checkIn: extra.checkIn ?? base.checkIn,
    checkOut: extra.checkOut ?? base.checkOut,
    confirmedIntent: base.confirmedIntent || extra.confirmedIntent,
  };
}

export function slotsFromFacts(facts: Record<string, string | number | boolean | null>): BookingSlots {
  const guestsRaw = facts.guests;
  const guests =
    typeof guestsRaw === "number"
      ? guestsRaw
      : typeof guestsRaw === "string" && /^\d+$/.test(guestsRaw)
        ? Number(guestsRaw)
        : null;
  return {
    guests: guests && guests >= 1 ? guests : null,
    checkIn: typeof facts.checkIn === "string" ? facts.checkIn : null,
    checkOut: typeof facts.checkOut === "string" ? facts.checkOut : null,
    confirmedIntent: facts.bookingConfirmed === true,
  };
}

/**
 * Stay slots only from guest speech — never seed checkIn/out/guests from facts
 * (facts may hold phantom example dates from echo contamination).
 */
export function collectSlotsFromTranscript(
  currentMessage: string,
  recentGuestBodies: string[],
  facts: Record<string, string | number | boolean | null>,
  now = new Date(),
): BookingSlots {
  let slots: BookingSlots = {
    guests: null,
    checkIn: null,
    checkOut: null,
    confirmedIntent: facts.bookingConfirmed === true,
  };
  for (const body of [...recentGuestBodies, currentMessage]) {
    if (shouldIgnoreSlotSource(body)) continue;
    slots = mergeBookingSlots(
      slots,
      extractBookingSlotsFromText(body, now, {
        checkIn: slots.checkIn,
        checkOut: slots.checkOut,
      }),
    );
  }
  return slots;
}

export function formatDateEs(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const names = [
    "",
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${d} de ${names[m] ?? m} de ${y}`;
}

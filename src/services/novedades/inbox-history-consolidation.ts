import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";
import { isPlausibleGuestName } from "@/modules/airbnb-email/parsing/guest-name-extract";
import { parseInquiryPropertyFromSubject } from "@/services/novedades/novedades-unlinked-inquiry.logic";

const REJECTED_GUEST_RE =
  /^(consulta\s+airbnb|airbnb\s+inquiry|sin\s+reserva|hu[eé]sped\s+airbnb|airbnb|consulta|reserva\s+[a-z0-9]+)$/i;

export type InboxHistoryPropertyHint = {
  propertyId: string;
  name: string;
  unitNumber: string | null;
};

export type InboxHistoryInquiryCandidate = {
  pendingActivityId: string;
  propertyId: string | null;
  propertyHint: string | null;
  createdAt: string;
  guestName: string;
  dateRangeLabel: string | null;
  subject: string | null;
  narrative: string;
  content: string;
};

export type InboxHistoryReservationCandidate = {
  reservationId: string;
  propertyId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  createdAt: string;
};

export type InboxHistoryAbsorptionMatch = {
  pendingActivityId: string;
  reservationId: string;
  reason: "guest_name" | "property_dates" | "property_timing";
  resolvedGuestName: string;
};

export type InboxHistoryConsolidationPlan = {
  matches: InboxHistoryAbsorptionMatch[];
  unmatchedInquiryIds: string[];
  stats: {
    inquiryCount: number;
    reservationCount: number;
    absorbedCount: number;
    consultaAirbnbBefore: number;
    consultaAirbnbAfterUnmatched: number;
  };
};

export function isGenericInboxGuestLabel(name: string | null | undefined): boolean {
  const trimmed = decodeHtmlEntities(name?.trim() ?? "");
  if (!trimmed) return true;
  return REJECTED_GUEST_RE.test(trimmed) || !isPlausibleGuestName(trimmed);
}

export function normalizeInboxPersonName(name: string): string {
  return decodeHtmlEntities(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function inboxGuestNamesMatch(a: string, b: string): boolean {
  if (isGenericInboxGuestLabel(a) || isGenericInboxGuestLabel(b)) return false;
  const na = normalizeInboxPersonName(a);
  const nb = normalizeInboxPersonName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const firstA = na.split(/\s+/)[0] ?? "";
  const firstB = nb.split(/\s+/)[0] ?? "";
  if (firstA.length >= 3 && firstA === firstB) {
    return na.split(/\s+/).length >= 2 || nb.split(/\s+/).length >= 2;
  }
  return false;
}

const SPANISH_MONTHS: Record<string, number> = {
  ene: 0,
  enero: 0,
  feb: 1,
  febrero: 1,
  mar: 2,
  marzo: 2,
  abr: 3,
  abril: 3,
  may: 4,
  mayo: 4,
  jun: 5,
  junio: 5,
  jul: 6,
  julio: 6,
  ago: 7,
  agosto: 7,
  sep: 8,
  sept: 8,
  septiembre: 8,
  oct: 9,
  octubre: 9,
  nov: 10,
  noviembre: 10,
  dic: 11,
  diciembre: 11,
};

function normalizePropertyText(text: string): string {
  return decodeHtmlEntities(text)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function propertyHintTokens(text: string): string[] {
  const stopWords = new Set([
    "loft",
    "para",
    "con",
    "los",
    "las",
    "del",
    "una",
    "min",
    "de",
    "la",
    "el",
    "en",
    "top",
    "zona",
    "personas",
    "moderno",
    "amplio",
    "vista",
    "premium",
    "panoramica",
    "laureles",
    "sobre",
  ]);

  return normalizePropertyText(text)
    .split(/\s+|(?:\|)/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

export function resolveInquiryPropertyIdFromHints(input: {
  subject: string | null;
  propertyHint: string | null;
  properties: InboxHistoryPropertyHint[];
}): string | null {
  const hint =
    input.propertyHint?.trim() || parseInquiryPropertyFromSubject(input.subject);
  if (!hint || input.properties.length === 0) return null;

  const hintNorm = normalizePropertyText(hint);
  const hintTokens = propertyHintTokens(hint);

  let best: { propertyId: string; score: number } | null = null;

  for (const property of input.properties) {
    const nameNorm = normalizePropertyText(property.name);
    const unit = property.unitNumber?.trim().toLowerCase() ?? "";

    if (unit && hintNorm.includes(unit)) {
      return property.propertyId;
    }

    if (
      hintNorm.length >= 12 &&
      (nameNorm.includes(hintNorm.slice(0, Math.min(hintNorm.length, 28))) ||
        hintNorm.includes(nameNorm.slice(0, Math.min(nameNorm.length, 28))))
    ) {
      return property.propertyId;
    }

    const propTokens = propertyHintTokens(`${property.name} ${property.unitNumber ?? ""}`);
    let score = 0;
    for (const token of hintTokens) {
      if (propTokens.includes(token) || nameNorm.includes(token)) score += 1;
    }
    if (hintNorm.includes("comuna") && nameNorm.includes("comuna")) score += 2;
    if (hintNorm.includes("laureles") && nameNorm.includes("laureles")) score += 1;

    if (score >= 2 && (!best || score > best.score)) {
      best = { propertyId: property.propertyId, score };
    }
  }

  return best?.propertyId ?? null;
}

function resolveInquiryPropertyId(
  inquiry: InboxHistoryInquiryCandidate,
  properties: InboxHistoryPropertyHint[],
): string | null {
  if (inquiry.propertyId) return inquiry.propertyId;
  return resolveInquiryPropertyIdFromHints({
    subject: inquiry.subject,
    propertyHint: inquiry.propertyHint,
    properties,
  });
}

function parseDayMonthToken(token: string, fallbackYear: number): Date | null {
  const cleaned = token.trim().toLowerCase().replace(/\./g, "");
  const match = cleaned.match(/^(\d{1,2})\s*(?:de\s+)?([a-záéíóúñ]+)(?:\s+de\s+(\d{4}))?$/i);
  if (!match) return null;
  const day = Number(match[1]);
  const monthKey = match[2]?.slice(0, 3).normalize("NFD").replace(/\p{M}/gu, "") ?? "";
  const month = SPANISH_MONTHS[monthKey] ?? SPANISH_MONTHS[match[2]?.toLowerCase() ?? ""];
  if (month == null || !Number.isFinite(day)) return null;
  const year = match[3] ? Number(match[3]) : fallbackYear;
  return new Date(Date.UTC(year, month, day, 12, 0, 0));
}

export function inquiryDateRangeOverlapsReservation(input: {
  dateRangeLabel: string | null;
  checkIn: string;
  checkOut: string;
}): boolean {
  const label = decodeHtmlEntities(input.dateRangeLabel?.trim() ?? "");
  if (!label) return false;

  const checkInDate = new Date(`${input.checkIn}T12:00:00.000Z`);
  const checkOutDate = new Date(`${input.checkOut}T12:00:00.000Z`);
  const fallbackYear = checkInDate.getUTCFullYear();

  const monthDayRangeMatch = label.match(
    /^([a-záéíóúñ]+)\.?\s+(\d{1,2})\s*[–—-]\s*(\d{1,2})(?:,?\s*(\d{4}))?$/i,
  );
  if (monthDayRangeMatch) {
    const monthKey = monthDayRangeMatch[1]
      ?.slice(0, 3)
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();
    const month = SPANISH_MONTHS[monthKey ?? ""];
    const startDay = Number(monthDayRangeMatch[2]);
    const endDay = Number(monthDayRangeMatch[3]);
    const year = monthDayRangeMatch[4] ? Number(monthDayRangeMatch[4]) : fallbackYear;
    if (month != null && Number.isFinite(startDay) && Number.isFinite(endDay)) {
      const start = new Date(Date.UTC(year, month, startDay, 12, 0, 0));
      const end = new Date(Date.UTC(year, month, endDay, 12, 0, 0));
      return start.getTime() <= checkOutDate.getTime() && end.getTime() >= checkInDate.getTime();
    }
  }

  const rangeParts = label.split(/\s*[–—-]\s*/);
  const start = parseDayMonthToken(rangeParts[0] ?? "", fallbackYear);
  const end = parseDayMonthToken(rangeParts[1] ?? rangeParts[0] ?? "", fallbackYear);
  if (!start || !end) {
    const inDay = checkInDate.getUTCDate();
    const outDay = checkOutDate.getUTCDate();
    const month = checkInDate.getUTCMonth();
    const monthToken = Object.entries(SPANISH_MONTHS).find(([, v]) => v === month)?.[0] ?? "";
    return (
      label.includes(String(inDay)) &&
      label.includes(String(outDay)) &&
      (monthToken ? label.includes(monthToken) : true)
    );
  }

  return start.getTime() <= checkOutDate.getTime() && end.getTime() >= checkInDate.getTime();
}

export function inquiryTimingPlausibleForReservation(input: {
  inquiryCreatedAt: string;
  reservationCreatedAt: string;
  checkIn: string;
}): boolean {
  const inquiryAt = new Date(input.inquiryCreatedAt).getTime();
  const reservationAt = new Date(input.reservationCreatedAt).getTime();
  const checkInAt = new Date(`${input.checkIn}T12:00:00.000Z`).getTime();
  const maxAfterReservation = reservationAt + 3 * 24 * 60 * 60 * 1000;
  return inquiryAt <= maxAfterReservation && inquiryAt <= checkInAt + 24 * 60 * 60 * 1000;
}

export function resolveAbsorbedInquiryGuestName(input: {
  inquiryGuestName: string;
  reservationGuestName: string;
}): string {
  if (!isGenericInboxGuestLabel(input.inquiryGuestName)) return input.inquiryGuestName;
  if (!isGenericInboxGuestLabel(input.reservationGuestName)) return input.reservationGuestName;
  return input.inquiryGuestName;
}

export function planInboxHistoryConsolidation(input: {
  inquiries: InboxHistoryInquiryCandidate[];
  reservations: InboxHistoryReservationCandidate[];
  properties?: InboxHistoryPropertyHint[];
}): InboxHistoryConsolidationPlan {
  const matches: InboxHistoryAbsorptionMatch[] = [];
  const matchedInquiryIds = new Set<string>();
  const matchedReservationIds = new Set<string>();
  const properties = input.properties ?? [];

  const reservationsByProperty = new Map<string, InboxHistoryReservationCandidate[]>();
  for (const reservation of input.reservations) {
    const list = reservationsByProperty.get(reservation.propertyId) ?? [];
    list.push(reservation);
    reservationsByProperty.set(reservation.propertyId, list);
  }

  for (const inquiry of input.inquiries) {
    const propertyId = resolveInquiryPropertyId(inquiry, properties);
    if (!propertyId) continue;
    const candidates = reservationsByProperty.get(propertyId) ?? [];

    let best: { reservation: InboxHistoryReservationCandidate; reason: InboxHistoryAbsorptionMatch["reason"] } | null =
      null;

    for (const reservation of candidates) {
      if (matchedReservationIds.has(reservation.reservationId)) continue;

      if (inboxGuestNamesMatch(inquiry.guestName, reservation.guestName)) {
        if (
          inquiryDateRangeOverlapsReservation({
            dateRangeLabel: inquiry.dateRangeLabel,
            checkIn: reservation.checkIn,
            checkOut: reservation.checkOut,
          }) ||
          inquiryTimingPlausibleForReservation({
            inquiryCreatedAt: inquiry.createdAt,
            reservationCreatedAt: reservation.createdAt,
            checkIn: reservation.checkIn,
          })
        ) {
          best = { reservation, reason: "guest_name" };
          break;
        }
      }
    }

    if (!best) {
      for (const reservation of candidates) {
        if (matchedReservationIds.has(reservation.reservationId)) continue;
        if (
          inquiryDateRangeOverlapsReservation({
            dateRangeLabel: inquiry.dateRangeLabel,
            checkIn: reservation.checkIn,
            checkOut: reservation.checkOut,
          }) &&
          inquiryTimingPlausibleForReservation({
            inquiryCreatedAt: inquiry.createdAt,
            reservationCreatedAt: reservation.createdAt,
            checkIn: reservation.checkIn,
          })
        ) {
          best = { reservation, reason: "property_dates" };
          break;
        }
      }
    }

    if (!best && isGenericInboxGuestLabel(inquiry.guestName)) {
      for (const reservation of candidates) {
        if (matchedReservationIds.has(reservation.reservationId)) continue;
        if (
          inquiryTimingPlausibleForReservation({
            inquiryCreatedAt: inquiry.createdAt,
            reservationCreatedAt: reservation.createdAt,
            checkIn: reservation.checkIn,
          }) &&
          inquiryDateRangeOverlapsReservation({
            dateRangeLabel: inquiry.dateRangeLabel,
            checkIn: reservation.checkIn,
            checkOut: reservation.checkOut,
          })
        ) {
          best = { reservation, reason: "property_timing" };
          break;
        }
      }
    }

    if (!best) continue;

    matchedInquiryIds.add(inquiry.pendingActivityId);
    matchedReservationIds.add(best.reservation.reservationId);
    matches.push({
      pendingActivityId: inquiry.pendingActivityId,
      reservationId: best.reservation.reservationId,
      reason: best.reason,
      resolvedGuestName: resolveAbsorbedInquiryGuestName({
        inquiryGuestName: inquiry.guestName,
        reservationGuestName: best.reservation.guestName,
      }),
    });
  }

  const consultaAirbnbBefore = input.inquiries.filter((row) =>
    /^consulta\s+airbnb$/i.test(row.guestName.trim()),
  ).length;

  const unmatchedInquiryIds = input.inquiries
    .filter((row) => !matchedInquiryIds.has(row.pendingActivityId))
    .map((row) => row.pendingActivityId);

  const consultaAirbnbAfterUnmatched = input.inquiries.filter(
    (row) =>
      !matchedInquiryIds.has(row.pendingActivityId) &&
      /^consulta\s+airbnb$/i.test(row.guestName.trim()),
  ).length;

  return {
    matches,
    unmatchedInquiryIds,
    stats: {
      inquiryCount: input.inquiries.length,
      reservationCount: input.reservations.length,
      absorbedCount: matches.length,
      consultaAirbnbBefore,
      consultaAirbnbAfterUnmatched,
    },
  };
}

export function buildAbsorbedInquiryTimelineEntry(input: {
  pendingActivityId: string;
  createdAt: string;
  narrative: string;
  guestName: string;
}): {
  id: string;
  kind: "GUEST_MESSAGE";
  title: string;
  narrative: string;
  messageBody: string;
  createdAt: string;
} {
  const narrative = decodeHtmlEntities(input.narrative);
  return {
    id: `inquiry:${input.pendingActivityId}`,
    kind: "GUEST_MESSAGE",
    title: "Consulta inicial",
    narrative,
    messageBody: narrative,
    createdAt: input.createdAt,
  };
}

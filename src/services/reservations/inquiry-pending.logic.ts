import { ReservationActivityType } from "@prisma/client";
import { isPlausibleGuestName } from "@/modules/airbnb-email/parsing/guest-name-extract";
import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";
import {
  resolveGuestMessageBodiesForDisplay,
  resolveGuestMessageParseName,
} from "@/services/novedades/operational-feed.message";
import { isGuestMessageNoise } from "@/services/novedades/operational-feed.policy";

const PRE_RESERVATION_SUBJECT_RE =
  /consulta|preaprobaci|inquiry|pregunta|question/i;

const EXCLUDED_PENDING_SUBJECT_RE =
  /reserva confirmada:|cancelada:|evaluaci[oó]n|review|reseña|te hemos enviado un cobro|payout|desembolso/i;

export function isPreReservationInquirySubject(subject: string | null | undefined): boolean {
  const trimmed = subject?.trim() ?? "";
  if (!trimmed) return false;
  if (EXCLUDED_PENDING_SUBJECT_RE.test(trimmed)) return false;
  return PRE_RESERVATION_SUBJECT_RE.test(trimmed);
}

export function parseInquiryDateRangeFromSubject(
  subject: string | null | undefined,
): string | null {
  const trimmed = subject?.trim() ?? "";
  if (!trimmed) return null;

  const periodMatch = trimmed.match(
    /(?:periodo|para el periodo|estancia en)\s+([^,]+)/i,
  );
  if (periodMatch?.[1]) {
    return periodMatch[1].trim().replace(/\s+/g, " ");
  }

  const inlineMatch = trimmed.match(
    /\b(\d{1,2}[–-]\d{1,2}\s+\w+(?:\s+\d{4})?|\w+\.?\s+\d{1,2}\s*[-–]\s*\d{1,2},?\s*\d{4})\b/i,
  );
  return inlineMatch?.[1]?.trim().replace(/\s+/g, " ") ?? null;
}

export function parseInquiryPropertyFromSubject(
  subject: string | null | undefined,
): string | null {
  const trimmed = subject?.trim() ?? "";
  if (!trimmed) return null;

  const consultaMatch = trimmed.match(
    /^consulta(?:\s+sobre|\s+para una estancia en)\s+(.+?)(?:\s+para el periodo|\s+para\s+el\s+periodo|,|$)/i,
  );
  if (consultaMatch?.[1]) {
    return consultaMatch[1].trim().replace(/\s+/g, " ");
  }

  return null;
}

const REJECTED_INQUIRY_GUEST_RE =
  /^(consulta\s+airbnb|airbnb\s+inquiry|sin\s+reserva|hu[eé]sped\s+airbnb|airbnb|consulta)$/i;

function isRejectedInquiryGuestLabel(name: string | null | undefined): boolean {
  const trimmed = name?.trim();
  if (!trimmed) return true;
  return REJECTED_INQUIRY_GUEST_RE.test(trimmed);
}

function acceptInquiryGuestName(name: string | null | undefined): string | null {
  const decoded = decodeHtmlEntities(name?.trim() ?? "");
  if (!decoded || isRejectedInquiryGuestLabel(decoded)) return null;
  if (!isPlausibleGuestName(decoded)) return null;
  return decoded;
}

function extractGuestNameFromInquirySubject(
  subject: string | null | undefined,
): string | null {
  const decoded = decodeHtmlEntities(subject?.trim() ?? "");
  if (!decoded) return null;

  const preapprovalMatch = decoded.match(
    /preaprobaci[oó]n para\s+(.+?)(?:\s+para|\s*,|$)/i,
  );
  const preapprovalName = acceptInquiryGuestName(preapprovalMatch?.[1]?.trim());
  if (preapprovalName) return preapprovalName;

  const consultaDeMatch = decoded.match(
    /consulta\s+(?:de|from)\s+([A-Za-zÀ-ÿ][\s'A-Za-zÀ-ÿ.-]{2,50}?)(?:\s+sobre|\s+para|,|$)/i,
  );
  const consultaDeName = acceptInquiryGuestName(consultaDeMatch?.[1]?.trim());
  if (consultaDeName) return consultaDeName;

  const mensajeDeMatch = decoded.match(
    /mensaje\s+de\s+([A-Za-zÀ-ÿ][\s'A-Za-zÀ-ÿ.-]{2,50}?)(?:\s+sobre|,|$)/i,
  );
  const mensajeDeName = acceptInquiryGuestName(mensajeDeMatch?.[1]?.trim());
  if (mensajeDeName) return mensajeDeName;

  return null;
}

function extractGuestNameFromInquiryContent(
  content: string | null | undefined,
): string | null {
  const decoded = decodeHtmlEntities(content?.trim() ?? "");
  if (!decoded) return null;

  const wroteMatch = decoded.match(
    /(?:^|\n)\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{1,40}?)\s+escribi[oó]\s*:/i,
  );
  const wroteName = acceptInquiryGuestName(wroteMatch?.[1]?.trim());
  if (wroteName) return wroteName;

  const parseName = resolveGuestMessageParseName({ raw: decoded });
  return acceptInquiryGuestName(parseName);
}

export function resolveInquiryGuestName(input: {
  senderName: string | null | undefined;
  subject: string | null | undefined;
  narrative: string | null | undefined;
  auditGuestName: string | null | undefined;
  enrichedGuestName?: string | null | undefined;
  content?: string | null | undefined;
}): string {
  const candidates = [
    input.enrichedGuestName,
    input.auditGuestName,
    extractGuestNameFromInquirySubject(input.subject),
    extractGuestNameFromInquiryContent(input.content ?? input.narrative),
    input.senderName,
  ];

  for (const candidate of candidates) {
    const name = acceptInquiryGuestName(candidate);
    if (name) return name;
  }

  return "Consulta Airbnb";
}

export function formatInquiryPropertyLabel(input: {
  propertyName: string | null | undefined;
  unitNumber: string | null | undefined;
  subject: string | null | undefined;
}): string {
  const name = input.propertyName?.trim();
  const unit = input.unitNumber?.trim();
  if (unit && name) return `${unit} — ${name}`;
  if (name) return name;
  return parseInquiryPropertyFromSubject(input.subject) ?? "Propiedad por confirmar";
}

export function resolveInquiryNarrative(input: {
  content: string;
  subject: string | null | undefined;
  senderName: string | null | undefined;
  auditGuestName: string | null | undefined;
}): string | null {
  const guestName = resolveInquiryGuestName({
    senderName: input.senderName,
    subject: input.subject,
    narrative: null,
    auditGuestName: input.auditGuestName,
  });
  const parseGuestName = resolveGuestMessageParseName({
    raw: input.content,
    guestName,
  });
  const bodies = resolveGuestMessageBodiesForDisplay(input.content, {
    guestName: parseGuestName,
  });
  if (bodies.length > 0) {
    return decodeHtmlEntities(bodies[bodies.length - 1]!);
  }

  if (isPreReservationInquirySubject(input.subject)) {
    const subject = input.subject?.trim();
    return subject ? decodeHtmlEntities(subject) : null;
  }

  return null;
}

export function shouldIncludePendingInquiry(input: {
  activityType: ReservationActivityType;
  subject: string | null | undefined;
  content: string;
  senderName: string | null | undefined;
  auditGuestName: string | null | undefined;
}): boolean {
  if (input.activityType !== ReservationActivityType.AIRBNB_MESSAGE) {
    return false;
  }

  const subject = input.subject?.trim() ?? "";
  if (EXCLUDED_PENDING_SUBJECT_RE.test(subject)) return false;

  const narrative = resolveInquiryNarrative({
    content: input.content,
    subject: input.subject,
    senderName: input.senderName,
    auditGuestName: input.auditGuestName,
  });

  if (!narrative) return false;

  if (isGuestMessageNoise({
    content: narrative,
    senderName: input.senderName,
    guestName: input.auditGuestName ?? input.senderName,
  })) {
    return false;
  }

  if (isPreReservationInquirySubject(subject)) return true;

  if (/^re:\s*reserva de\b/i.test(subject)) return false;

  return true;
}

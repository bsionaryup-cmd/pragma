import { ReservationActivityType } from "@prisma/client";
import { isPlausibleGuestName } from "@/modules/airbnb-email/parsing/guest-name-extract";
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

export function resolveInquiryGuestName(input: {
  senderName: string | null | undefined;
  subject: string | null | undefined;
  narrative: string | null | undefined;
  auditGuestName: string | null | undefined;
}): string {
  const auditName = input.auditGuestName?.trim();
  if (auditName && isPlausibleGuestName(auditName)) return auditName;

  const sender = input.senderName?.trim();
  if (sender && isPlausibleGuestName(sender)) return sender;

  const preapprovalMatch = input.subject?.match(
    /preaprobaci[oó]n para\s+(.+?)(?:\s+para|\s*,|$)/i,
  );
  const preapprovalName = preapprovalMatch?.[1]?.trim();
  if (preapprovalName && isPlausibleGuestName(preapprovalName)) return preapprovalName;

  return "Consulta Airbnb";
}

export function formatInquiryPropertyLabel(input: {
  propertyName: string | null | undefined;
  unitNumber: string | null | undefined;
  subject: string | null | undefined;
}): string {
  const name = input.propertyName?.trim();
  const unit = input.unitNumber?.trim();
  if (name) return unit ? `${name} ${unit}` : name;
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
  if (bodies.length > 0) return bodies[bodies.length - 1]!;

  if (isPreReservationInquirySubject(input.subject)) {
    return input.subject?.trim() ?? null;
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

/** Accept only likely Airbnb transactional senders (not arbitrary forwarders). */

const AIRBNB_SENDER_PATTERNS = [
  "automated@airbnb.com",
  "express@airbnb.com",
  "@airbnb.com",
  "@mail.airbnb.com",
  "@reply.airbnb.com",
];

const FORWARD_SUBJECT_PREFIX_RE =
  /^(?:fwd?|fw|rv|reenviado|resend|rv:)[\s:.—-]*/i;

const FORWARD_BODY_MARKERS = [
  "forwarded message",
  "mensaje reenviado",
  "-----original message-----",
  "-----mensaje original-----",
  "begin forwarded message",
  "inicio del mensaje reenviado",
];

export function isLikelyAirbnbSender(fromAddress: string): boolean {
  const email = extractEmailAddress(fromAddress);
  return AIRBNB_SENDER_PATTERNS.some((pattern) => email.includes(pattern));
}

export function isForwardedSubject(subject: string): boolean {
  return FORWARD_SUBJECT_PREFIX_RE.test(subject.trim());
}

export function hasForwardBodyMarkers(body: string): boolean {
  const lower = body.toLowerCase();
  if (FORWARD_BODY_MARKERS.some((marker) => lower.includes(marker))) {
    return true;
  }
  return /(^|\n)\s*(from|de|para|to|date|fecha):\s/mi.test(body);
}

/** Gmail/Outlook manual forward — subject prefix and/or quoted headers in body. */
export function isForwardedEmail(subject: string, body: string): boolean {
  return isForwardedSubject(subject) || hasForwardBodyMarkers(body);
}

/**
 * Trusted manual forward: strong Airbnb signals only (no arbitrary spam).
 * Requires HM code + at least two independent reservation cues.
 */
export function allowTrustedForwardedAirbnbEmail(
  subject: string,
  body: string,
): boolean {
  const text = `${subject}\n${body}`;
  const hasCode = /\bhm[a-z0-9]{6,12}\b/i.test(text);
  if (!hasCode) return false;

  const lower = text.toLowerCase();
  let signalCount = 0;

  if (lower.includes("airbnb") || lower.includes("@airbnb.com")) signalCount += 1;
  if (/check-?in|llegada|arrival/i.test(text)) signalCount += 1;
  if (/check-?out|salida|departure/i.test(text)) signalCount += 1;
  if (
    /c[oó]digo de confirmaci[oó]n|confirmation code|reservation code/i.test(
      text,
    )
  ) {
    signalCount += 1;
  }
  if (/alojamiento|listing|property/i.test(text)) signalCount += 1;
  if (/hu[eé]sped|guest/i.test(text)) signalCount += 1;

  return signalCount >= 2;
}

/** @deprecated Use allowTrustedForwardedAirbnbEmail — kept for tests. */
export function isLikelyAirbnbEmailContent(subject: string, body: string): boolean {
  return allowTrustedForwardedAirbnbEmail(subject, body);
}

export function shouldProcessAirbnbEmail(input: {
  from: string;
  subject: string;
  body: string;
}): boolean {
  if (isLikelyAirbnbSender(input.from)) return true;

  return allowTrustedForwardedAirbnbEmail(input.subject, input.body);
}

export function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match?.[1] ?? fromHeader).trim().toLowerCase();
}

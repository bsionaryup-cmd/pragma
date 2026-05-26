/** Accept only likely Airbnb transactional senders (not arbitrary forwarders). */

const AIRBNB_SENDER_PATTERNS = [
  "automated@airbnb.com",
  "express@airbnb.com",
  "@airbnb.com",
  "@mail.airbnb.com",
  "@reply.airbnb.com",
];

export function isLikelyAirbnbSender(fromAddress: string): boolean {
  const email = extractEmailAddress(fromAddress);
  return AIRBNB_SENDER_PATTERNS.some((pattern) => email.includes(pattern));
}

/** Gmail forwarding may rewrite From — accept strong Airbnb signals in content. */
export function isLikelyAirbnbEmailContent(subject: string, body: string): boolean {
  const text = `${subject}\n${body}`.toLowerCase();
  const hasCode = /\bhm[a-z0-9]{6,12}\b/i.test(text);
  const hasAirbnbCue =
    text.includes("airbnb") ||
    text.includes("reserva") ||
    text.includes("reservation") ||
    text.includes("check-in") ||
    text.includes("check-out") ||
    text.includes("payout") ||
    text.includes("pago procesado");
  return hasCode && hasAirbnbCue;
}

export function shouldProcessAirbnbEmail(input: {
  from: string;
  subject: string;
  body: string;
}): boolean {
  return (
    isLikelyAirbnbSender(input.from) ||
    isLikelyAirbnbEmailContent(input.subject, input.body)
  );
}

export function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match?.[1] ?? fromHeader).trim().toLowerCase();
}

import { createHash, timingSafeEqual } from "crypto";

/**
 * Resolve dotted paths relative to Wompi event `data`
 * (e.g. "transaction.id" → data.transaction.id).
 */
export function resolveWompiDataProperty(
  data: unknown,
  propertyPath: string,
): string {
  const parts = propertyPath.split(".").filter(Boolean);
  let current: unknown = data;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[part];
  }
  if (current == null) return "";
  return String(current);
}

type WompiEventLike = {
  data?: unknown;
  signature?: { properties?: string[]; checksum?: string };
  timestamp?: number | string;
};

/**
 * Official Wompi event checksum:
 * SHA256(concat(property values in order) + timestamp + eventsSecret)
 * @see https://docs.wompi.co/docs/colombia/eventos/
 */
export function computeWompiEventChecksumFromEvent(
  event: WompiEventLike,
  secret: string,
): string {
  const properties = event.signature?.properties ?? [];
  const propertyValues = properties
    .map((path) => resolveWompiDataProperty(event.data, path))
    .join("");
  const timestamp =
    event.timestamp === undefined || event.timestamp === null
      ? ""
      : String(event.timestamp);
  return createHash("sha256")
    .update(`${propertyValues}${timestamp}${secret}`)
    .digest("hex")
    .toUpperCase();
}

/** @deprecated Prefer computeWompiEventChecksumFromEvent — kept for call-site migration. */
export function computeWompiEventChecksum(
  payload: string,
  secret: string,
): string {
  try {
    const event = JSON.parse(payload) as WompiEventLike;
    return computeWompiEventChecksumFromEvent(event, secret);
  } catch {
    return createHash("sha256").update(`${payload}${secret}`).digest("hex").toUpperCase();
  }
}

export function verifyWompiEventChecksum(input: {
  payload: string;
  signature: string;
  secret: string;
}): boolean {
  let expected: string;
  try {
    const event = JSON.parse(input.payload) as WompiEventLike;
    expected = computeWompiEventChecksumFromEvent(event, input.secret);
  } catch {
    return false;
  }

  try {
    const a = Buffer.from(expected.toUpperCase(), "utf8");
    const b = Buffer.from(input.signature.trim().toUpperCase(), "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function buildWompiIntegritySignature(input: {
  reference: string;
  amountInCents: number;
  currency: string;
  integritySecret: string;
}): string {
  return createHash("sha256")
    .update(
      `${input.reference}${input.amountInCents}${input.currency}${input.integritySecret}`,
    )
    .digest("hex");
}

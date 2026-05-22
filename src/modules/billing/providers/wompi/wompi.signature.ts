import { createHash, timingSafeEqual } from "crypto";

export function computeWompiEventChecksum(payload: string, secret: string): string {
  return createHash("sha256").update(`${payload}${secret}`).digest("hex");
}

export function verifyWompiEventChecksum(input: {
  payload: string;
  signature: string;
  secret: string;
}): boolean {
  const expected = computeWompiEventChecksum(input.payload, input.secret);
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(input.signature, "utf8");
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

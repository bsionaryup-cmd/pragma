import { createHash } from "crypto";

/** Validates ePayco confirmation webhook signature (x_signature). */
export function verifyEpaycoConfirmationSignature(input: {
  custIdCliente: string;
  refPayco: string;
  transactionId: string;
  amount: string;
  currencyCode: string;
  pKey: string;
  signature: string;
}): boolean {
  // Orden oficial ePayco (confirmación): custId ^ pKey ^ refPayco ^ transactionId ^ amount ^ currency
  const payload = [
    input.custIdCliente.trim(),
    input.pKey.trim(),
    input.refPayco.trim(),
    input.transactionId.trim(),
    input.amount.trim(),
    input.currencyCode.trim(),
  ].join("^");

  const expected = createHash("sha256").update(payload).digest("hex");
  return timingSafeEqualHex(expected, input.signature.trim());
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

export function mapEpaycoResponseCode(
  code: string | null | undefined,
): "APPROVED" | "PENDING" | "FAILED" | "UNKNOWN" {
  const normalized = code?.trim();
  switch (normalized) {
    case "1":
      return "APPROVED";
    case "3":
      return "PENDING";
    case "2":
    case "4":
      return "FAILED";
    default:
      return "UNKNOWN";
  }
}

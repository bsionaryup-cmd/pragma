import { randomBytes } from "node:crypto";

const WEB_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Código legible para reservas DIRECT creadas desde WEB BUILDER (no Airbnb). */
export function generateWebDirectReservationCode(): string {
  const bytes = randomBytes(8);
  let suffix = "";
  for (let i = 0; i < 8; i += 1) {
    suffix += WEB_CODE_ALPHABET[bytes[i]! % WEB_CODE_ALPHABET.length];
  }
  return `WB${suffix}`;
}

export function isWebBuilderReservationNotes(
  internalNotes: string | null | undefined,
): boolean {
  return Boolean(internalNotes?.includes("[WEB_BUILDER]"));
}

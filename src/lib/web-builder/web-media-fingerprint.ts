import { createHash } from "node:crypto";

/** Normalizes URLs for duplicate comparison within an org. */
export function normalizeWebMediaUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    const port =
      parsed.port &&
      !(
        (parsed.protocol === "https:" && parsed.port === "443") ||
        (parsed.protocol === "http:" && parsed.port === "80")
      )
        ? `:${parsed.port}`
        : "";
    return `${parsed.protocol}//${host}${port}${path}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

export function webMediaContentFingerprint(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function webMediaUrlFingerprint(url: string): string {
  return createHash("sha256").update(normalizeWebMediaUrl(url)).digest("hex");
}

const FP_PREFIX = "fp:";

export function formatMediaFingerprintNote(fingerprint: string): string {
  return `${FP_PREFIX}${fingerprint}`;
}

export function parseMediaFingerprintFromRightsNote(
  rightsNote: string | null | undefined,
): string | null {
  if (!rightsNote?.trim()) return null;
  const match = rightsNote
    .split(/\s+/)
    .find((token) => token.startsWith(FP_PREFIX));
  if (!match) return null;
  const fp = match.slice(FP_PREFIX.length);
  return fp.length === 64 ? fp : null;
}
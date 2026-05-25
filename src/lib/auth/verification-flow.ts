/** Shared helpers for Clerk email/phone verification in sign-up and sign-in flows. */

export const VERIFICATION_RESEND_COOLDOWN_MS = 60_000;

type VerificationSnapshot = {
  status?: string | null;
  expireAt?: Date | null;
};

/** True when Clerk already issued a code that has not expired yet. */
export function isVerificationCodeActive(
  verification: VerificationSnapshot | null | undefined,
): boolean {
  if (!verification) return false;

  if (verification.status === "verified") return false;
  if (verification.status === "expired" || verification.status === "failed") {
    return false;
  }

  if (verification.expireAt instanceof Date) {
    return verification.expireAt.getTime() > Date.now();
  }

  return false;
}

/** Restrict post-auth redirects to same-origin relative paths. */
export function sanitizeAuthRedirectPath(
  next: string | null | undefined,
  fallback: string,
): string {
  if (!next) return fallback;

  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  return trimmed;
}

export function formatResendCooldown(seconds: number): string {
  if (seconds <= 0) return "";
  if (seconds === 1) return "1 segundo";
  return `${seconds} segundos`;
}

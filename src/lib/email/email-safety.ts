/**
 * Guards outbound product email against synthetic / audit / E2E traffic.
 * Used so temporary guests (UIVis, E2E, scripts) never notify real ops in live Resend.
 */

const BLOCKED_RECIPIENT_SUFFIXES = [
  "@example.com",
  "@localhost",
  "@test.com",
  "@email.invalid",
] as const;

const SYNTHETIC_EMAIL_MARKERS = [
  "e2e-owner-",
  "e2e-user-",
  "e2e-",
  "+e2e@",
] as const;

const SYNTHETIC_NAME_PATTERNS = [
  /^E2E\b/i,
  /^UIVis\b/i,
  /^Guest-\d/i,
  /^Prod\s*Smoke\b/i,
  /^Dupe\s*Audit\b/i,
  /^Incident\s*Repro\b/i,
  /^LAT\b/i,
  /^RC\s*Final\b/i,
  /^HoldFix\b/i,
  /^BR\s*Direct\b/i,
  /^Full[-\s]?Flow\b/i,
] as const;

export function isBlockedTestRecipient(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return true;
  if (BLOCKED_RECIPIENT_SUFFIXES.some((s) => normalized.endsWith(s))) {
    return true;
  }
  return SYNTHETIC_EMAIL_MARKERS.some((m) => normalized.includes(m));
}

export function isSyntheticGuestName(name: string | null | undefined): boolean {
  const value = name?.trim() ?? "";
  if (!value) return false;
  return SYNTHETIC_NAME_PATTERNS.some((re) => re.test(value));
}

export function isSyntheticGuestContext(input: {
  guestEmail?: string | null;
  guestName?: string | null;
  guestFirstName?: string | null;
}): boolean {
  const email = input.guestEmail?.trim().toLowerCase() ?? "";
  if (email && isBlockedTestRecipient(email)) return true;
  if (isSyntheticGuestName(input.guestName)) return true;
  if (isSyntheticGuestName(input.guestFirstName)) return true;
  return false;
}

/** Allow intentional QA only when explicitly opted in. */
export function allowTestEmailRecipients(): boolean {
  return process.env.EMAIL_ALLOW_TEST_RECIPIENTS?.trim() === "1";
}

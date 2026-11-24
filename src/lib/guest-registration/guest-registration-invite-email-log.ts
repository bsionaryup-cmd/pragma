export type GuestRegistrationInviteAttemptStatus = "success" | "failed";

export type GuestRegistrationInviteLogEntry = {
  at: string;
  status: GuestRegistrationInviteAttemptStatus;
  recipient: string;
  providerId?: string;
  error?: string;
  triggeredBy: "auto" | "manual";
  userId?: string;
};

export const GUEST_REGISTRATION_INVITE_SENDING_MARKER = "__SENDING__";

export function parseGuestRegistrationInviteLog(
  value: unknown,
): GuestRegistrationInviteLogEntry[] {
  if (!Array.isArray(value)) return [];

  const entries: GuestRegistrationInviteLogEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.at !== "string" || typeof row.status !== "string") continue;
    if (typeof row.recipient !== "string" || !row.recipient.trim()) continue;
    if (row.triggeredBy !== "auto" && row.triggeredBy !== "manual") continue;
    if (row.status !== "success" && row.status !== "failed") continue;

    entries.push({
      at: row.at,
      status: row.status,
      recipient: row.recipient.trim().toLowerCase(),
      providerId:
        typeof row.providerId === "string" ? row.providerId : undefined,
      error: typeof row.error === "string" ? row.error : undefined,
      triggeredBy: row.triggeredBy,
      userId: typeof row.userId === "string" ? row.userId : undefined,
    });
  }

  return entries;
}

export function getLatestGuestRegistrationInviteLogEntry(
  value: unknown,
): GuestRegistrationInviteLogEntry | null {
  const entries = parseGuestRegistrationInviteLog(value);
  return entries.length > 0 ? entries[entries.length - 1]! : null;
}

/** Validación mínima de correo para el disparador automático. */
export function isValidGuestInviteEmail(value: string | null | undefined): boolean {
  const email = value?.trim().toLowerCase() ?? "";
  if (!email || email.length > 254) return false;
  // Simple RFC-ish check; Resend will still reject invalid destinations.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

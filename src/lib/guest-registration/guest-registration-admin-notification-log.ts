export type GuestRegistrationAdminNotificationAttemptStatus =
  | "success"
  | "partial"
  | "failed";

export type GuestRegistrationAdminNotificationLogEntry = {
  at: string;
  status: GuestRegistrationAdminNotificationAttemptStatus;
  recipients: string[];
  providerIds?: Record<string, string>;
  error?: string;
  triggeredBy: "auto" | "manual";
  userId?: string;
  source?: "operational-contact" | "legacy-notification-emails";
  selectedContactKey?: string;
};

export const GUEST_REGISTRATION_ADMIN_NOTIFICATION_SENDING_MARKER =
  "__SENDING__";

export function parseGuestRegistrationAdminNotificationLog(
  value: unknown,
): GuestRegistrationAdminNotificationLogEntry[] {
  if (!Array.isArray(value)) return [];

  const entries: GuestRegistrationAdminNotificationLogEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.at !== "string" || typeof row.status !== "string") continue;
    if (!Array.isArray(row.recipients)) continue;
    if (row.triggeredBy !== "auto" && row.triggeredBy !== "manual") continue;

    const recipients = row.recipients.filter(
      (email): email is string => typeof email === "string" && email.trim().length > 0,
    );
    if (recipients.length === 0) continue;

    const status = row.status;
    if (status !== "success" && status !== "partial" && status !== "failed") {
      continue;
    }

    const providerIds =
      row.providerIds && typeof row.providerIds === "object"
        ? Object.fromEntries(
            Object.entries(row.providerIds as Record<string, unknown>).filter(
              (entry): entry is [string, string] =>
                typeof entry[0] === "string" && typeof entry[1] === "string",
            ),
          )
        : undefined;

    entries.push({
      at: row.at,
      status,
      recipients,
      providerIds:
        providerIds && Object.keys(providerIds).length > 0 ? providerIds : undefined,
      error: typeof row.error === "string" ? row.error : undefined,
      triggeredBy: row.triggeredBy,
      userId: typeof row.userId === "string" ? row.userId : undefined,
      source:
        row.source === "operational-contact" ||
        row.source === "legacy-notification-emails"
          ? row.source
          : undefined,
      selectedContactKey:
        typeof row.selectedContactKey === "string"
          ? row.selectedContactKey
          : undefined,
    });
  }

  return entries;
}

export function getLatestGuestRegistrationAdminNotificationLogEntry(
  value: unknown,
): GuestRegistrationAdminNotificationLogEntry | null {
  const entries = parseGuestRegistrationAdminNotificationLog(value);
  return entries.length > 0 ? entries[entries.length - 1]! : null;
}

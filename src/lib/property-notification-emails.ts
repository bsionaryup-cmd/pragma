const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidNotificationEmail(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 && EMAIL_PATTERN.test(trimmed);
}

/** Normalizes property notificationEmails JSON or form text into deduped lowercase emails. */
export function parsePropertyNotificationEmails(value: unknown): string[] {
  const raw: string[] = [];

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.trim()) raw.push(item.trim());
    }
  } else if (typeof value === "string" && value.trim()) {
    raw.push(
      ...value
        .split(/[\n,;]+/)
        .map((part) => part.trim())
        .filter(Boolean),
    );
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const email of raw) {
    const normalized = email.toLowerCase();
    if (!isValidNotificationEmail(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function formatNotificationEmailsForForm(emails: unknown): string {
  return parsePropertyNotificationEmails(emails).join("\n");
}

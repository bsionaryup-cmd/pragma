import { parsePropertyNotificationEmails } from "@/lib/property-notification-emails";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type OperationalContact = {
  key: string;
  name: string;
  role: string;
  email: string | null;
  whatsapp: string | null;
  isActive: boolean;
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseOperationalContacts(value: unknown): OperationalContact[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const output: OperationalContact[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;

    const key = normalizeText(row.key);
    const name = normalizeText(row.name);
    const role = normalizeText(row.role);
    if (!key || !name || !role || seen.has(key)) continue;
    seen.add(key);

    output.push({
      key,
      name,
      role,
      email: normalizeEmail(row.email),
      whatsapp: normalizeText(row.whatsapp) || null,
      isActive: row.isActive !== false,
    });
  }

  return output;
}

export function findOperationalContactByKey(
  contacts: OperationalContact[],
  key: string | null | undefined,
): OperationalContact | null {
  if (!key?.trim()) return null;
  return contacts.find((c) => c.key === key.trim()) ?? null;
}

export const GUEST_REGISTRATION_LEGACY_CONTACT_KEY = "__legacy__";

export function guestRegistrationContactKeyToFormValue(
  key: string | null | undefined,
): string {
  return key?.trim() ? key.trim() : GUEST_REGISTRATION_LEGACY_CONTACT_KEY;
}

export function guestRegistrationContactKeyFromFormValue(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === GUEST_REGISTRATION_LEGACY_CONTACT_KEY) return null;
  return trimmed;
}

export type GuestRegistrationRecipientResolution = {
  recipients: string[];
  source: "operational-contact" | "legacy-notification-emails";
  selectedContact: OperationalContact | null;
};

export function resolveGuestRegistrationAdminRecipients(input: {
  notificationEmails: unknown;
  operationalContacts: unknown;
  guestRegistrationContactKey: string | null | undefined;
}): GuestRegistrationRecipientResolution {
  const contacts = parseOperationalContacts(input.operationalContacts);
  const contactKey =
    input.guestRegistrationContactKey === GUEST_REGISTRATION_LEGACY_CONTACT_KEY
      ? null
      : input.guestRegistrationContactKey;
  const selected = findOperationalContactByKey(contacts, contactKey);
  if (selected?.isActive && selected.email) {
    return {
      recipients: [selected.email],
      source: "operational-contact",
      selectedContact: selected,
    };
  }

  return {
    recipients: parsePropertyNotificationEmails(input.notificationEmails),
    source: "legacy-notification-emails",
    selectedContact: null,
  };
}


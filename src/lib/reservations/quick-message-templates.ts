import {
  getDefaultMessageTitle,
  getQuickMessageButtonLabel,
  QUICK_MESSAGE_TYPE_ORDER,
  type QuickMessageType,
} from "@/lib/default-message-templates";
import { formatStayRange } from "@/features/reservations/lib/reservation-dates";
import { formatAccessCode } from "@/lib/access-code";
import { formatPropertyLabel } from "@/lib/property-display";
import type { QuickMessageData } from "@/lib/reservations/quick-messages";
import { quickMessageLabel } from "@/lib/reservations/quick-messages";

export const QUICK_MESSAGE_TYPES: QuickMessageType[] = [...QUICK_MESSAGE_TYPE_ORDER];

export type QuickMessageTemplates = Partial<Record<QuickMessageType, string>>;

/** @deprecated Use QuickMessageTemplates */
export type PropertyQuickMessageTemplates = QuickMessageTemplates;

export function parseQuickMessageTemplates(value: unknown): QuickMessageTemplates {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const raw = value as Record<string, unknown>;
  const out: QuickMessageTemplates = {};

  for (const type of QUICK_MESSAGE_TYPES) {
    const text = raw[type];
    if (typeof text === "string" && text.trim()) {
      out[type] = text.trim();
    }
  }

  return out;
}

export function parsePropertyQuickMessageTemplates(
  value: unknown,
): QuickMessageTemplates {
  return parseQuickMessageTemplates(value);
}

export function quickMessageTemplatesToFormFields(
  templates: QuickMessageTemplates,
): Record<`quickMessage${QuickMessageType}`, string> {
  return Object.fromEntries(
    QUICK_MESSAGE_TYPES.map((type) => [
      `quickMessage${type}`,
      templates[type] ?? "",
    ]),
  ) as Record<`quickMessage${QuickMessageType}`, string>;
}

export function hasCustomQuickMessageTemplates(
  templates: QuickMessageTemplates,
): boolean {
  return QUICK_MESSAGE_TYPES.some((type) => Boolean(templates[type]?.trim()));
}

type QuickMessageFormInput = {
  useDefaultQuickMessages?: boolean;
} & Partial<Record<`quickMessage${QuickMessageType}`, string>>;

export function formFieldsToQuickMessageTemplates(
  input: QuickMessageFormInput,
): QuickMessageTemplates | null {
  if (input.useDefaultQuickMessages) return null;
  const templates: QuickMessageTemplates = {};

  for (const type of QUICK_MESSAGE_TYPES) {
    const value = input[`quickMessage${type}`]?.trim();
    if (value) {
      templates[type] = value;
    }
  }

  return Object.keys(templates).length > 0 ? templates : null;
}

function firstName(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

function formatMessageTime(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  }
  return trimmed;
}

/** Convierte {{variable}} al formato {variable} antes de sustituir. */
function normalizeTemplatePlaceholders(template: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, "{$1}");
}

/** Elimina variables sin reemplazar para que no lleguen al portapapeles. */
function stripUnresolvedPlaceholders(text: string): string {
  return text.replace(/\{[a-zA-Z][a-zA-Z0-9]*\}/g, "");
}

function cleanupCopiedMessage(text: string): string {
  return stripUnresolvedPlaceholders(text)
    .replace(/[ \t]+(\r?\n)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildQuickMessageDataFromReservation(input: {
  guestName: string;
  checkIn: string;
  checkOut: string;
  property: {
    name: string;
    unitNumber?: string | null;
    address: string;
    neighborhood?: string | null;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    accessCode?: string | null;
    accessInstructions?: string | null;
    houseRules?: string | null;
    wifiName?: string | null;
    wifiPassword?: string | null;
    receptionWhatsapp?: string | null;
  };
  registrationLink?: string | null;
  accessCode?: string | null;
}): QuickMessageData {
  const address =
    formatPropertyAddressForMessage({
      address: input.property.address,
      neighborhood: input.property.neighborhood ?? null,
    }) || input.property.address.trim();

  return {
    guestName: input.guestName,
    propertyName: formatPropertyLabel(input.property),
    address,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    stayRange: formatStayRange(input.checkIn, input.checkOut),
    checkInTime: formatMessageTime(input.property.checkInTime),
    checkOutTime: formatMessageTime(input.property.checkOutTime),
    wifiName: input.property.wifiName?.trim() ?? "",
    wifiPassword: input.property.wifiPassword?.trim() ?? "",
    accessCode:
      formatAccessCode(input.accessCode ?? input.property.accessCode ?? null) ?? "",
    accessInstructions: input.property.accessInstructions?.trim() ?? "",
    houseRules: input.property.houseRules?.trim() ?? "",
    registrationLink: input.registrationLink?.trim() ?? "",
    receptionWhatsapp: input.property.receptionWhatsapp?.trim() ?? "",
  };
}

export function applyQuickMessageTemplate(
  template: string,
  data: QuickMessageData,
): string {
  const guestFull = data.guestName?.trim() ?? "";
  const replacements: Record<string, string> = {
    guestName: firstName(data.guestName) || "huésped",
    guestFullName: guestFull || "huésped",
    propertyName: data.propertyName?.trim() ?? "",
    address: data.address?.trim() ?? "",
    checkIn: data.checkIn?.trim() ?? "",
    checkOut: data.checkOut?.trim() ?? "",
    stayRange: data.stayRange?.trim() ?? "",
    checkInTime: formatMessageTime(data.checkInTime),
    checkOutTime: formatMessageTime(data.checkOutTime),
    wifiName: data.wifiName?.trim() ?? "",
    wifiPassword: data.wifiPassword?.trim() ?? "",
    accessCode: data.accessCode?.trim() ?? "",
    accessInstructions: data.accessInstructions?.trim() ?? "",
    houseRules: data.houseRules?.trim() ?? "",
    registrationLink: data.registrationLink?.trim() ?? "",
    hostName: data.hostName?.trim() ?? "",
    receptionWhatsapp: data.receptionWhatsapp?.trim() ?? "",
  };

  let result = normalizeTemplatePlaceholders(template);
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return cleanupCopiedMessage(result);
}

export function quickMessageFormFieldName(
  type: QuickMessageType,
): `quickMessage${QuickMessageType}` {
  return `quickMessage${type}`;
}

export function quickMessageFieldLabel(type: QuickMessageType): string {
  return getDefaultMessageTitle(type);
}

export function quickMessageButtonLabel(type: QuickMessageType): string {
  return getQuickMessageButtonLabel(type);
}

export const QUICK_MESSAGE_TEMPLATE_HINT =
  "Variables: {guestName}, {guestFullName}, {propertyName}, {address}, {checkIn}, {checkOut}, {stayRange}, {checkInTime}, {checkOutTime}, {wifiName}, {wifiPassword}, {accessCode}, {accessInstructions}, {houseRules}, {registrationLink}, {receptionWhatsapp}. Al copiar se reemplazan por los datos de la reserva.";

/** Dirección mostrada en mensajes (calle/número; no solo ciudad). */
export function formatPropertyAddressForMessage(input: {
  address: string;
  neighborhood?: string | null;
}): string {
  const street = input.address.trim();
  const neighborhood = input.neighborhood?.trim();
  if (!street) return "";
  if (!neighborhood) return street;
  return `${street}, ${neighborhood}`;
}

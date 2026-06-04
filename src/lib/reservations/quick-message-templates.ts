import type { QuickMessageData, QuickMessageType } from "@/lib/reservations/quick-messages";
import { quickMessageLabel } from "@/lib/reservations/quick-messages";

export const QUICK_MESSAGE_TYPES: QuickMessageType[] = [
  "WELCOME",
  "REGISTRATION",
  "ACCESS",
  "FOLLOW_UP",
  "CHECKOUT",
];

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
  return {
    quickMessageWELCOME: templates.WELCOME ?? "",
    quickMessageREGISTRATION: templates.REGISTRATION ?? "",
    quickMessageACCESS: templates.ACCESS ?? "",
    quickMessageFOLLOW_UP: templates.FOLLOW_UP ?? "",
    quickMessageCHECKOUT: templates.CHECKOUT ?? "",
  };
}

export function hasCustomQuickMessageTemplates(
  templates: QuickMessageTemplates,
): boolean {
  return QUICK_MESSAGE_TYPES.some((type) => Boolean(templates[type]?.trim()));
}

export function formFieldsToQuickMessageTemplates(input: {
  useDefaultQuickMessages?: boolean;
  quickMessageWELCOME?: string;
  quickMessageREGISTRATION?: string;
  quickMessageACCESS?: string;
  quickMessageFOLLOW_UP?: string;
  quickMessageCHECKOUT?: string;
}): QuickMessageTemplates | null {
  if (input.useDefaultQuickMessages) return null;
  const templates: QuickMessageTemplates = {};

  if (input.quickMessageWELCOME?.trim()) {
    templates.WELCOME = input.quickMessageWELCOME.trim();
  }
  if (input.quickMessageREGISTRATION?.trim()) {
    templates.REGISTRATION = input.quickMessageREGISTRATION.trim();
  }
  if (input.quickMessageACCESS?.trim()) {
    templates.ACCESS = input.quickMessageACCESS.trim();
  }
  if (input.quickMessageFOLLOW_UP?.trim()) {
    templates.FOLLOW_UP = input.quickMessageFOLLOW_UP.trim();
  }
  if (input.quickMessageCHECKOUT?.trim()) {
    templates.CHECKOUT = input.quickMessageCHECKOUT.trim();
  }

  return Object.keys(templates).length > 0 ? templates : null;
}

function firstName(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
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
    checkInTime: data.checkInTime?.trim() ?? "",
    checkOutTime: data.checkOutTime?.trim() ?? "",
    wifiName: data.wifiName?.trim() ?? "",
    wifiPassword: data.wifiPassword?.trim() ?? "",
    accessCode: data.accessCode?.trim() ?? "",
    registrationLink: data.registrationLink?.trim() ?? "",
    hostName: data.hostName?.trim() ?? "",
    receptionWhatsapp: data.receptionWhatsapp?.trim() ?? "",
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

export function quickMessageFormFieldName(
  type: QuickMessageType,
): `quickMessage${QuickMessageType}` {
  return `quickMessage${type}`;
}

export function quickMessageFieldLabel(type: QuickMessageType): string {
  return quickMessageLabel(type);
}

export const QUICK_MESSAGE_TEMPLATE_HINT =
  "Variables: {guestName}, {guestFullName}, {propertyName}, {address}, {checkInTime}, {checkOutTime}, {wifiName}, {wifiPassword}, {accessCode}, {registrationLink}, {receptionWhatsapp}. Deja vacío para usar el mensaje predeterminado.";

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

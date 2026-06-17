import {
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_MESSAGE_TITLES,
  getDefaultMessageTemplate,
  type QuickMessageType,
} from "@/lib/default-message-templates";
import {
  applyQuickMessageTemplate,
  type QuickMessageTemplates,
} from "@/lib/reservations/quick-message-templates";

export type { QuickMessageType } from "@/lib/default-message-templates";

export type QuickMessageData = {
  guestName?: string | null;
  propertyName?: string | null;
  address?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  stayRange?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  wifiName?: string | null;
  wifiPassword?: string | null;
  accessCode?: string | null;
  accessInstructions?: string | null;
  houseRules?: string | null;
  registrationLink?: string | null;
  hostName?: string | null;
  receptionWhatsapp?: string | null;
};

/** @deprecated Use DEFAULT_MESSAGE_TEMPLATES from @/lib/default-message-templates */
export const SYSTEM_QUICK_MESSAGE_TEMPLATES = DEFAULT_MESSAGE_TEMPLATES;

export function buildQuickMessage(
  type: QuickMessageType,
  data: QuickMessageData,
  customTemplates?: QuickMessageTemplates | null,
): string {
  const custom = customTemplates?.[type]?.trim();
  if (custom) {
    return applyQuickMessageTemplate(custom, data);
  }

  return applyQuickMessageTemplate(DEFAULT_MESSAGE_TEMPLATES[type], data);
}

export function quickMessageLabel(type: QuickMessageType): string {
  return DEFAULT_MESSAGE_TITLES[type];
}

export function getDefaultQuickMessageTemplate(type: QuickMessageType): string {
  return getDefaultMessageTemplate(type);
}

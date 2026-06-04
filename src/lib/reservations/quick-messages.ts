import {
  applyQuickMessageTemplate,
  type QuickMessageTemplates,
} from "@/lib/reservations/quick-message-templates";

export type QuickMessageType =
  | "WELCOME"
  | "REGISTRATION"
  | "ACCESS"
  | "FOLLOW_UP"
  | "CHECKOUT";

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

/** Plantillas predeterminadas de PRAGMA (con variables). */
export const SYSTEM_QUICK_MESSAGE_TEMPLATES: Record<QuickMessageType, string> = {
  WELCOME: `Hola {guestName},

Tu reserva en {propertyName} está confirmada.

Check-in: {checkInTime}

Si necesitas algo antes de tu llegada, escríbenos por WhatsApp: {receptionWhatsapp}`,

  REGISTRATION: `Hola {guestName},

Para tu estadía en {propertyName}, completa el registro de huéspedes aquí:
{registrationLink}

Cualquier duda, WhatsApp recepción: {receptionWhatsapp}`,

  ACCESS: `Hola {guestName},

Datos para tu llegada a {propertyName}:

📍 Dirección: {address}
🕒 Check-in: {checkInTime}
🔐 Acceso: {accessCode}

WhatsApp recepción: {receptionWhatsapp}`,

  FOLLOW_UP: `Hola {guestName},

Esperamos que disfrutes tu estadía en {propertyName}.

📶 WiFi: {wifiName}
🔑 Clave: {wifiPassword}

¿Necesitas algo? WhatsApp: {receptionWhatsapp}`,

  CHECKOUT: `Hola {guestName},

Gracias por hospedarte en {propertyName}.

Check-out: {checkOutTime}

Si todo estuvo bien, una reseña de 5 estrellas nos ayuda mucho.

WhatsApp: {receptionWhatsapp}`,
};

const quickMessageTitle: Record<QuickMessageType, string> = {
  WELCOME: "Reserva confirmada",
  REGISTRATION: "Registro de huéspedes",
  ACCESS: "Información de llegada",
  FOLLOW_UP: "Información durante la estadía",
  CHECKOUT: "Recordatorio de salida",
};

export function buildQuickMessage(
  type: QuickMessageType,
  data: QuickMessageData,
  customTemplates?: QuickMessageTemplates | null,
): string {
  const custom = customTemplates?.[type]?.trim();
  if (custom) {
    return applyQuickMessageTemplate(custom, data);
  }

  return applyQuickMessageTemplate(SYSTEM_QUICK_MESSAGE_TEMPLATES[type], data);
}

export function quickMessageLabel(type: QuickMessageType): string {
  return quickMessageTitle[type];
}

/** Texto plantilla del sistema (con variables) para vista previa o edición avanzada. */
export function getDefaultQuickMessageTemplate(type: QuickMessageType): string {
  return SYSTEM_QUICK_MESSAGE_TEMPLATES[type];
}

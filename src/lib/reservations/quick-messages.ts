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
  checkInTime?: string | null;
  checkOutTime?: string | null;
  wifiName?: string | null;
  wifiPassword?: string | null;
  accessCode?: string | null;
  registrationLink?: string | null;
  hostName?: string | null;
};

const quickMessageTitle: Record<QuickMessageType, string> = {
  WELCOME: "Bienvenida",
  REGISTRATION: "Registro",
  ACCESS: "Acceso",
  FOLLOW_UP: "Seguimiento",
  CHECKOUT: "Check-out",
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function firstName(value: string | null | undefined): string | null {
  const normalized = clean(value);
  if (!normalized) return null;
  return normalized.split(/\s+/)[0] ?? null;
}

function line(label: string, value: string | null | undefined): string | null {
  const normalized = clean(value);
  if (!normalized) return null;
  return `${label} ${normalized}`;
}

function buildWelcome(data: QuickMessageData): string {
  const guest = firstName(data.guestName);
  const property = clean(data.propertyName);
  return [
    guest ? `Hola ${guest}, ¿cómo estás?` : "Hola, ¿cómo estás?",
    "",
    "Nos alegra mucho que nos hayas elegido para tu estadía.",
    "",
    property
      ? `En ${property} te esperamos con mucho cariño para que te sientas como en casa.`
      : "Te esperamos con mucho cariño para que te sientas como en casa.",
    "",
    "Si necesitas cualquier cosa antes de tu llegada, aquí estamos para ayudarte.",
  ].join("\n");
}

function buildRegistration(data: QuickMessageData): string {
  const guest = firstName(data.guestName);
  const registrationLink = clean(data.registrationLink);
  return [
    guest ? `Hola ${guest}.` : "Hola.",
    "",
    "Para dejar todo listo para tu llegada, te agradecemos completar el registro de las personas que se hospedarán:",
    ...(registrationLink ? ["", registrationLink] : []),
    "",
    "Es súper rápido y nos ayuda a que tu ingreso sea más cómodo.",
  ].join("\n");
}

function buildAccess(data: QuickMessageData): string {
  const guest = firstName(data.guestName);
  const lines = [
    guest ? `Hola ${guest}.` : "Hola.",
    "",
    "Gracias por completar el registro, te compartimos los datos para tu llegada:",
    "",
    line("📍 Dirección:", data.address),
    line("🕒 Check-in:", data.checkInTime),
    line("🔐 Código de acceso:", data.accessCode),
    line("📶 WiFi:", data.wifiName),
    line("🔑 Contraseña:", data.wifiPassword),
    "",
    "Te deseamos una estadía hermosa.",
    "",
    "Cualquier cosa que necesites, escríbenos con confianza.",
  ].filter((row) => row != null) as string[];
  return lines.join("\n");
}

function buildFollowUp(data: QuickMessageData): string {
  const guest = firstName(data.guestName);
  return [
    guest ? `Hola ${guest}.` : "Hola.",
    "",
    "Esperamos que estés disfrutando tu estadía.",
    "",
    "Pasamos a saludarte y recordarte que estamos pendientes de ti para lo que necesites: ayuda, recomendaciones o cualquier inquietud.",
    "",
    "Será un gusto ayudarte.",
  ].join("\n");
}

function buildCheckout(data: QuickMessageData): string {
  const guest = firstName(data.guestName);
  return [
    guest ? `Hola ${guest}.` : "Hola.",
    "",
    "Esperamos que hayas disfrutado tu estadía con nosotros.",
    "",
    line("Te recordamos que la hora de salida es a las", data.checkOutTime)
      ?? "Te recordamos la hora de salida de tu reserva.",
    "",
    "Si todo estuvo bien durante tu visita, una reseña de 5 estrellas nos ayudaría muchísimo.",
    "",
    "Gracias por hospedarte con nosotros y esperamos recibirte nuevamente.",
  ].join("\n");
}

export function buildQuickMessage(type: QuickMessageType, data: QuickMessageData): string {
  switch (type) {
    case "WELCOME":
      return buildWelcome(data);
    case "REGISTRATION":
      return buildRegistration(data);
    case "ACCESS":
      return buildAccess(data);
    case "FOLLOW_UP":
      return buildFollowUp(data);
    case "CHECKOUT":
      return buildCheckout(data);
    default:
      return buildWelcome(data);
  }
}

export function quickMessageLabel(type: QuickMessageType): string {
  return quickMessageTitle[type];
}

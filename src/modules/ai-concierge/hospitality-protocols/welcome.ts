/**
 * Welcome protocol v3.1 — ask name first, then guided menu.
 * Guest-facing: never pretend human; do not mention PRAGMA / internals.
 */
export const WELCOME_NAME_STEP = "await_guest_name";

export const CONCIERGE_IDENTITY_LINE_GUEST =
  "Soy el Asistente Virtual de Recepción. Estoy aquí para ayudarte con tu reserva o tu estancia.";

/** Initial contact — presentation + name ask. NO menu. */
export function buildWelcomeAskNameMessage(input?: {
  propertyName?: string | null;
}): string {
  const property = input?.propertyName?.trim();
  const lines = ["¡Hola! 👋", ""];
  if (property) {
    lines.push(`Bienvenido(a) a ${property}.`, "");
  }
  lines.push(
    CONCIERGE_IDENTITY_LINE_GUEST,
    "",
    "Antes de comenzar, ¿me regalas tu nombre?",
  );
  return lines.join("\n");
}

/** After name is known — personal greeting + navigation menu. */
export function buildPostNameMenuMessage(
  guestName: string,
  menuLines: string[],
): string {
  const name = guestName.trim() || "allí";
  return [
    `Mucho gusto, ${name}. 😊`,
    "",
    "Estoy listo para ayudarte.",
    "Puedes escribir directamente lo que necesitas o, si lo prefieres, seleccionar una de estas opciones:",
    "",
    ...menuLines,
  ].join("\n");
}

/** @deprecated Prefer buildWelcomeAskNameMessage / buildPostNameMenuMessage */
export function buildVirtualReceptionistWelcome(guestName?: string | null): string {
  if (guestName?.trim()) {
    return [
      `Hola, ${guestName.trim()}.`,
      "",
      CONCIERGE_IDENTITY_LINE_GUEST,
      "",
      "¿En qué te puedo ayudar hoy?",
    ].join("\n");
  }
  return buildWelcomeAskNameMessage();
}

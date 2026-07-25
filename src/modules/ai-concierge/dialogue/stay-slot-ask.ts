/**
 * Shared stay-slot ask copy — REGLA 5–7 (one logical step, guide with examples).
 * Examples use non-parseable placeholders so echo/DOM never seeds real slots.
 */

export function buildAvailabilitySlotsAsk(missing: {
  checkIn: boolean;
  checkOut: boolean;
  guests: boolean;
}): string {
  const lines: string[] = [];
  if (missing.checkIn) lines.push("📅 Fecha de entrada");
  if (missing.checkOut) lines.push("📅 Fecha de salida");
  if (missing.guests) lines.push("👥 Número de huéspedes");

  if (missing.checkIn && missing.checkOut && missing.guests) {
    return `Para revisar disponibilidad solo necesito:

${lines.join("\n")}

Puedes responder así (con tus fechas reales):
Entrada: DD de mes
Salida: DD de mes
N personas`;
  }

  const exampleBits: string[] = [];
  if (missing.checkIn) exampleBits.push("Entrada: DD de mes");
  if (missing.checkOut) exampleBits.push("Salida: DD de mes");
  if (missing.guests) exampleBits.push("N personas");

  return `Me falta un dato para continuar. ¿Me compartes por favor:

${lines.join("\n")}

Puedes responder así (con tus datos reales):
${exampleBits.join("\n")}`;
}

/** Mensajes motivacionales cortos para el Command Center. */
const PANEL_MOTIVATIONAL_MESSAGES = [
  "¡Qué gran día para gestionar tu negocio!",
  "Hoy es un buen día para ofrecer experiencias memorables.",
  "Cada reserva es una oportunidad de hacerlo excelente.",
  "Tu operación avanza con claridad y enfoque.",
  "Un equipo organizado, huéspedes más felices.",
  "Gestiona con calma: lo importante ya está en marcha.",
  "Pequeños detalles, grandes diferencias en cada estancia.",
  "La constancia construye negocios que escalan.",
] as const;

/** Mismo mensaje durante el día (no cambia en cada render). */
export function getPanelMotivationalMessage(): string {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return PANEL_MOTIVATIONAL_MESSAGES[dayIndex % PANEL_MOTIVATIONAL_MESSAGES.length];
}

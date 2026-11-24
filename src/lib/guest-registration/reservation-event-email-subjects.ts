/**
 * Asuntos oficiales del flujo Reserva → GR → TTLock → notificaciones.
 * Fuente única para builders y evidencia (sin server-only).
 */
export const GUEST_RESERVATION_CONFIRMATION_SUBJECT =
  "Reserva confirmada — Solo falta completar el registro de huéspedes";

export const GUEST_ACCESS_CODE_EMAIL_SUBJECT =
  "Bienvenido — Tu código de acceso ya está disponible";

export function buildTenantRegistrationCompletedSubject(input: {
  guestName: string | null | undefined;
  propertyLabel: string;
  allOk: boolean;
  forceResend?: boolean;
}): string {
  const guest = input.guestName?.trim() || "Huésped";
  const property = input.propertyLabel.trim() || "Alojamiento";
  if (input.allOk) {
    return input.forceResend
      ? `Reenvío · Registro completado | ${guest} | ${property}`
      : `Registro completado | ${guest} | ${property}`;
  }
  return input.forceResend
    ? `Reenvío · Revisar registro | ${guest} | ${property}`
    : `Revisar registro | ${guest} | ${property}`;
}

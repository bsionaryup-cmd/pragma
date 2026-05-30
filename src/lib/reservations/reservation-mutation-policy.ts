import type { ReservationStatus } from "@prisma/client";
import { getTodayKey } from "@/features/calendar/lib/calendar-dates";

/** TEMP: quitar cuando termine el backfill de reservas directas históricas. */
export const TEMP_ALLOW_PAST_RESERVATION_CREATE = true;

export type ReservationDateSnapshot = {
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
};

/** Platform owner en sesión de impersonación auditada. */
export function canUseHistoricalReservationOverride(options: {
  isPlatformOwner: boolean;
  isImpersonating: boolean;
}): boolean {
  return options.isPlatformOwner && options.isImpersonating;
}

export function isHistoricalOrClosedReservation(
  checkOut: string,
  status: ReservationStatus,
): boolean {
  const today = getTodayKey();
  if (status === "CHECKED_OUT" || status === "CANCELLED") return true;
  return checkOut < today;
}

export class ReservationMutationPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationMutationPolicyError";
  }
}

/**
 * Reglas operativas pre-lanzamiento:
 * - Sin crear estancias que empiecen en el pasado.
 * - Sin mover fechas al pasado.
 * - Sin editar reservas históricas/cerradas.
 * - Excepción: owner de plataforma en impersonación (auditado en el servicio).
 */
export function assertReservationDateMutationAllowed(options: {
  operation: "create" | "update";
  checkIn: string;
  checkOut: string;
  existing?: ReservationDateSnapshot;
  allowHistoricalOverride: boolean;
}): void {
  if (options.allowHistoricalOverride) return;

  const today = getTodayKey();
  const { checkIn, checkOut, existing, operation } = options;

  if (operation === "create") {
    if (!TEMP_ALLOW_PAST_RESERVATION_CREATE && checkIn < today) {
      throw new ReservationMutationPolicyError(
        "No se pueden crear reservas con fecha de entrada en el pasado.",
      );
    }
    return;
  }

  if (!existing) return;

  if (
    isHistoricalOrClosedReservation(existing.checkOut, existing.status)
  ) {
    throw new ReservationMutationPolicyError(
      "No se pueden modificar reservas históricas o cerradas.",
    );
  }

  if (checkOut < today) {
    throw new ReservationMutationPolicyError(
      "No se puede mover la salida a una fecha pasada.",
    );
  }

  if (checkIn < today && checkIn !== existing.checkIn) {
    throw new ReservationMutationPolicyError(
      "No se puede mover la entrada a una fecha pasada.",
    );
  }
}

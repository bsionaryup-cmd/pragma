import { PaymentStatus } from "@prisma/client";
import { todayPrismaDate } from "@/lib/dates";

/** Ingreso pendiente: estancia con check-in futuro (como Airbnb). */
export function isReservationIncomePending(
  checkIn: Date,
  _paymentStatus: PaymentStatus,
  today = todayPrismaDate(),
): boolean {
  return checkIn.getTime() > today.getTime();
}

/** Ingreso confirmado: check-in ya ocurrió (incluye reservas directas históricas). */
export function isReservationIncomeConfirmed(
  checkIn: Date,
  _paymentStatus: PaymentStatus,
  today = todayPrismaDate(),
): boolean {
  return checkIn.getTime() <= today.getTime();
}

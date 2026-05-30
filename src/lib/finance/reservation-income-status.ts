import { PaymentStatus } from "@prisma/client";
import { todayPrismaDate } from "@/lib/dates";

const PAID_STATUSES: PaymentStatus[] = [PaymentStatus.PAID];
const UNPAID_STATUSES: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.PARTIAL,
];

/** Ingreso pendiente hasta el check-in (como Airbnb) o si aún no está pagado. */
export function isReservationIncomePending(
  checkIn: Date,
  paymentStatus: PaymentStatus,
  today = todayPrismaDate(),
): boolean {
  if (checkIn.getTime() > today.getTime()) return true;
  return UNPAID_STATUSES.includes(paymentStatus);
}

/** Ingreso confirmado: check-in ya ocurrió y el pago está registrado. */
export function isReservationIncomeConfirmed(
  checkIn: Date,
  paymentStatus: PaymentStatus,
  today = todayPrismaDate(),
): boolean {
  return (
    checkIn.getTime() <= today.getTime() &&
    PAID_STATUSES.includes(paymentStatus)
  );
}

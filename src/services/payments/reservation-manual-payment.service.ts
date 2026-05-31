import "server-only";

import {
  BookingPlatform,
  ReservationPaymentMethod,
  ReservationStatus,
} from "@prisma/client";
import { dateKeyToPrismaDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { reservationPaymentMethodLabel } from "@/lib/payments/reservation-payment-method-labels";
import type { SerializedReservationPayment } from "@/lib/payments/organization-payment-methods-types";
import { formatMoney } from "@/lib/format-currency";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  assertAmountWithinReservationBalance,
  getReservationPaymentBalance,
} from "@/services/payments/reservation-payment-balance";
import { syncReservationPaymentStatus } from "@/services/payments/reservation-payment-status.service";
import {
  findOrganizationPaymentMethodLabel,
  getOrganizationPaymentMethods,
} from "@/services/payments/organization-payment-methods.service";
import type { Locale } from "@/i18n/types";

export type CreateReservationManualPaymentInput = {
  reservationId: string;
  createdById: string;
  amount: number;
  method: ReservationPaymentMethod;
  paymentReference?: string;
  accountMethodId?: string;
  receivedAt: string;
  notes?: string;
};

function assertDirectReservation(platform: BookingPlatform) {
  if (platform !== BookingPlatform.DIRECT) {
    throw new Error("Solo reservas directas admiten pagos manuales");
  }
}

export async function listReservationManualPayments(
  reservationId: string,
  locale: Locale = "es",
): Promise<SerializedReservationPayment[]> {
  const scope = await requireTenantDataScope();
  await assertReservationInScope(scope, reservationId);

  const [rows, methods] = await Promise.all([
    db.reservationPayment.findMany({
      where: { reservationId },
      orderBy: { receivedAt: "desc" },
      select: {
        id: true,
        amount: true,
        currency: true,
        method: true,
        paymentReference: true,
        accountMethodId: true,
        receivedAt: true,
        notes: true,
        createdAt: true,
      },
    }),
    getOrganizationPaymentMethods(),
  ]);

  return rows.map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    amountFormatted: formatMoney(Number(row.amount), row.currency, locale),
    currency: row.currency,
    method: row.method,
    methodLabel: reservationPaymentMethodLabel(row.method),
    paymentReference: row.paymentReference,
    accountMethodLabel: findOrganizationPaymentMethodLabel(
      methods,
      row.accountMethodId,
    ),
    receivedAt: row.receivedAt.toISOString().slice(0, 10),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createReservationManualPayment(
  input: CreateReservationManualPaymentInput,
) {
  const scope = await requireTenantDataScope();
  await assertReservationInScope(scope, input.reservationId);

  const reservation = await db.reservation.findUnique({
    where: { id: input.reservationId },
    select: {
      id: true,
      platform: true,
      status: true,
      currency: true,
    },
  });

  if (!reservation) {
    throw new Error("Reserva no encontrada");
  }

  assertDirectReservation(reservation.platform);

  if (reservation.status === ReservationStatus.CANCELLED) {
    throw new Error("No se pueden registrar pagos en reservas canceladas");
  }

  const balance = await getReservationPaymentBalance(input.reservationId);
  assertAmountWithinReservationBalance(balance, input.amount);

  if (
    input.method === ReservationPaymentMethod.BANK_TRANSFER &&
    !input.accountMethodId?.trim()
  ) {
    throw new Error("Selecciona la cuenta destino");
  }

  const payment = await db.reservationPayment.create({
    data: {
      reservationId: input.reservationId,
      amount: Math.round(input.amount),
      currency: reservation.currency,
      method: input.method,
      paymentReference: input.paymentReference?.trim() || null,
      accountMethodId: input.accountMethodId?.trim() || null,
      receivedAt: dateKeyToPrismaDate(input.receivedAt),
      notes: input.notes?.trim() || null,
      createdById: input.createdById,
    },
  });

  await syncReservationPaymentStatus(input.reservationId);

  return payment;
}

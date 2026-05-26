import "server-only";

import type {
  GuestPaymentCategory,
  GuestPaymentLinkStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { mergePropertyScope } from "@/lib/platform/tenant-data-scope";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
import { createGuestWompiCheckout } from "@/services/payments/guest-wompi-checkout.service";
import {
  assertAmountWithinReservationBalance,
  getReservationPaymentBalance,
} from "@/services/payments/reservation-payment-balance";
import { writePaymentAuditLog } from "@/modules/billing/repositories/audit-log.repository";

const ACTIVE_DUPLICATE_STATUSES: GuestPaymentLinkStatus[] = [
  "DRAFT",
  "SENT",
  "PENDING",
  "PROCESSING",
];

export async function listGuestPaymentLinksForOrg() {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) return [];

  return db.guestPaymentLink.findMany({
    where: { organizationId: scope.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reservation: {
        select: { id: true, guestName: true, checkIn: true, checkOut: true },
      },
      property: { select: { id: true, name: true, unitNumber: true } },
    },
  });
}

export async function listGuestPaymentLinksForReservation(reservationId: string) {
  const scope = await requireTenantDataScope();
  await assertReservationInScope(scope, reservationId);

  return db.guestPaymentLink.findMany({
    where: { reservationId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

async function assertNoDuplicateActiveLink(
  reservationId: string | null | undefined,
  category: GuestPaymentCategory,
) {
  if (!reservationId) return;

  const duplicate = await db.guestPaymentLink.findFirst({
    where: {
      reservationId,
      category,
      status: { in: ACTIVE_DUPLICATE_STATUSES },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new Error(
      "Ya existe un enlace activo de esta categoría para la reserva",
    );
  }
}

export async function createGuestPaymentLinkDraft(input: {
  category: GuestPaymentCategory;
  description: string;
  amount: number;
  currency?: string;
  reservationId?: string | null;
  propertyId?: string | null;
  guestName?: string | null;
  expiresAt?: Date | null;
  notes?: string | null;
  createdById: string;
}) {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    throw new Error("Organización requerida para Payment Links");
  }

  if (input.propertyId) {
    await db.property.findFirstOrThrow({
      where: mergePropertyScope(scope, { id: input.propertyId }),
      select: { id: true },
    });
  }

  if (input.reservationId) {
    await assertReservationInScope(scope, input.reservationId);
    const balance = await getReservationPaymentBalance(input.reservationId);
    assertAmountWithinReservationBalance(balance, input.amount);
    await assertNoDuplicateActiveLink(input.reservationId, input.category);
  } else if (input.amount <= 0) {
    throw new Error("El monto debe ser mayor a cero");
  }

  return db.guestPaymentLink.create({
    data: {
      organizationId: scope.organizationId,
      createdById: input.createdById,
      category: input.category,
      description: input.description.trim(),
      amount: input.amount,
      currency: input.currency ?? "COP",
      status: "DRAFT",
      reservationId: input.reservationId ?? null,
      propertyId: input.propertyId ?? null,
      guestName: input.guestName?.trim() || null,
      expiresAt: input.expiresAt ?? null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function issueGuestPaymentLink(linkId: string, customerEmail?: string | null) {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    throw new Error("Organización requerida");
  }

  const link = await db.guestPaymentLink.findFirst({
    where: { id: linkId, organizationId: scope.organizationId },
    include: {
      reservation: { select: { guestEmail: true } },
    },
  });

  if (!link) throw new Error("Enlace no encontrado");
  if (link.status === "PAID" || link.status === "CANCELLED") {
    throw new Error("El enlace ya no se puede emitir");
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    await db.guestPaymentLink.update({
      where: { id: link.id },
      data: { status: "EXPIRED" },
    });
    throw new Error("El enlace está vencido");
  }

  const checkout = await createGuestWompiCheckout({
    organizationId: scope.organizationId,
    linkId: link.id,
    description: link.description,
    amount: Number(link.amount),
    currency: link.currency,
    customerEmail: customerEmail ?? link.reservation?.guestEmail ?? null,
  });

  if (!checkout.ok || !checkout.checkoutUrl) {
    throw new Error(checkout.message);
  }

  const updated = await db.guestPaymentLink.update({
    where: { id: link.id },
    data: {
      status: "SENT",
      wompiCheckoutUrl: checkout.checkoutUrl,
      wompiLinkId: checkout.wompiLinkId ?? null,
    },
  });

  await writePaymentAuditLog({
    entityType: "guest_payment_link",
    entityId: link.id,
    action: "checkout_issued",
    after: { wompiLinkId: checkout.wompiLinkId },
  });

  return updated;
}

export async function duplicateGuestPaymentLink(linkId: string, createdById: string) {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) throw new Error("Organización requerida");

  const source = await db.guestPaymentLink.findFirst({
    where: { id: linkId, organizationId: scope.organizationId },
  });
  if (!source) throw new Error("Enlace no encontrado");
  if (source.status === "PAID") {
    throw new Error("No se puede duplicar un enlace ya pagado");
  }

  if (source.reservationId) {
    const balance = await getReservationPaymentBalance(source.reservationId);
    assertAmountWithinReservationBalance(balance, Number(source.amount));
  }

  const copy = await createGuestPaymentLinkDraft({
    category: source.category,
    description: `${source.description} (copia)`,
    amount: Number(source.amount),
    currency: source.currency,
    reservationId: source.reservationId,
    propertyId: source.propertyId,
    guestName: source.guestName,
    notes: source.notes,
    createdById,
    expiresAt: source.expiresAt,
  });

  return copy;
}

export async function cancelGuestPaymentLink(linkId: string) {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) throw new Error("Organización requerida");

  const link = await db.guestPaymentLink.findFirst({
    where: { id: linkId, organizationId: scope.organizationId },
  });
  if (!link) throw new Error("Enlace no encontrado");
  if (link.status === "PAID") {
    throw new Error("No se puede cancelar un enlace ya pagado");
  }

  return db.guestPaymentLink.update({
    where: { id: linkId },
    data: { status: "CANCELLED" },
  });
}

export async function createReservationPaymentLink(input: {
  reservationId: string;
  mode: "full" | "deposit_50" | "remaining" | "custom";
  customAmount?: number;
  category?: GuestPaymentCategory;
  description?: string;
  createdById: string;
  issue?: boolean;
  expiresAt?: Date;
}) {
  const balance = await getReservationPaymentBalance(input.reservationId);

  let amount = balance.remainingBalance;
  let category: GuestPaymentCategory = input.category ?? "RESERVATION_FULL";
  let description =
    input.description ??
    `Pago reserva · ${balance.guestName}`;

  if (input.mode === "deposit_50") {
    category = "DEPOSIT";
    amount = Math.min(
      balance.remainingBalance,
      Math.round(balance.totalAmount * 0.5 * 100) / 100,
    );
    description = `Depósito 50% · ${balance.guestName}`;
  } else if (input.mode === "remaining") {
    category = "REMAINING_BALANCE";
    amount = balance.remainingBalance;
    description = `Saldo pendiente · ${balance.guestName}`;
  } else if (input.mode === "full") {
    category = "RESERVATION_FULL";
    amount = balance.remainingBalance;
    description = `Pago total · ${balance.guestName}`;
  } else if (input.mode === "custom") {
    if (!input.customAmount) throw new Error("Monto personalizado requerido");
    amount = input.customAmount;
    category = input.category ?? "EXTRA_SERVICES";
  }

  assertAmountWithinReservationBalance(balance, amount);

  const draft = await createGuestPaymentLinkDraft({
    category,
    description,
    amount,
    currency: balance.currency,
    reservationId: input.reservationId,
    propertyId: balance.propertyId,
    guestName: balance.guestName,
    createdById: input.createdById,
    expiresAt:
      input.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  if (input.issue) {
    return issueGuestPaymentLink(draft.id);
  }

  return draft;
}

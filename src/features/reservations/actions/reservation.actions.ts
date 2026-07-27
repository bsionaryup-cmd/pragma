"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { BookingPlatform } from "@prisma/client";
import {
  reservationWizardSchema,
  reservationEditSchema,
  type ReservationWizardValues,
  type ReservationEditValues,
} from "@/features/reservations/schemas/reservation.schema";
import type { ReservationInboxItem, ReservationDetailItem } from "@/features/reservations/types/reservation.types";
import { assertBillingUnlocked } from "@/lib/billing/billing-guard";
import {
  currentDbUser,
  hasPermission,
  requirePermission,
} from "@/lib/auth";
import { buildTenantContext } from "@/lib/platform/tenant-context";
import { ReservationConflictError } from "@/services/reservations/reservation-conflicts";
import { ReservationMutationPolicyError } from "@/lib/reservations/reservation-mutation-policy";
import { isPropertyLinkedToAirbnb } from "@/services/airbnb/airbnb-export-push.service";
import {
  createReservation,
  deleteReservation,
  getReservationForInbox,
  getReservationMutationContext,
  OtaReservationDeleteError,
  searchReservationsForCalendar,
  updateReservation,
  type ReservationSearchHit,
} from "@/services/reservations/reservation.service";
import { prismaDateToKey } from "@/lib/dates";
import { schedulePriceLabsRefresh } from "@/services/integrations/pricelabs/pricelabs-refresh";
import { scheduleMonthlyFinanceMetricsRefreshForStay } from "@/services/finance/monthly-finance-metrics-refresh";

function toInboxFromCreated(
  r: Awaited<ReturnType<typeof createReservation>>,
): ReservationInboxItem {
  return {
    id: r.id,
    guestName: r.guestName,
    guestFirstName: r.guestFirstName,
    guestLastName: r.guestLastName,
    guestEmail: r.guestEmail,
    guestPhone: r.guestPhone,
    guestCountry: r.guestCountry,
    guestLanguage: r.guestLanguage,
    adults: r.adults,
    children: r.children,
    infants: r.infants,
    checkIn: prismaDateToKey(r.checkIn),
    checkOut: prismaDateToKey(r.checkOut),
    createdAt: r.createdAt.toISOString(),
    platform: r.platform,
    status: r.status,
    paymentStatus: r.paymentStatus,
    holdExpiresAt: r.holdExpiresAt?.toISOString() ?? null,
    totalAmount: r.totalAmount.toString(),
    currency: r.currency,
    internalNotes: r.internalNotes,
    guestRegistrationUrl: null,
    guestRegistrationCompletedAt: null,
    property: {
      id: r.property.id,
      name: r.property.name,
      unitNumber: r.property.unitNumber ?? null,
      address: r.property.address,
      city: r.property.city,
    },
  };
}

export async function createReservationAction(data: ReservationWizardValues) {
  await requirePermission("reservations:create");
  await assertBillingUnlocked();
  const parsed = reservationWizardSchema.parse(data);

  try {
    const created = await createReservation(parsed);
    schedulePriceLabsRefresh("reservation");
    scheduleMonthlyFinanceMetricsRefreshForStay(null, {
      checkIn: prismaDateToKey(created.checkIn),
      checkOut: prismaDateToKey(created.checkOut),
    });

    revalidatePath("/calendar");
    revalidatePath("/properties");
    revalidatePath("/");
    revalidatePath("/finance");

    const airbnbCalendarLinked = await isPropertyLinkedToAirbnb(
      parsed.propertyId,
    );

    return {
      success: true as const,
      reservation: toInboxFromCreated(created),
      airbnbCalendarLinked,
    };
  } catch (error) {
    if (error instanceof ReservationConflictError) {
      return { success: false as const, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
}

export async function getReservationInboxItemAction(id: string) {
  const reservationId = typeof id === "string" ? id.trim() : "";
  if (!reservationId) {
    return { success: false as const, error: "Reserva no válida" };
  }

  try {
    // Soft auth: never redirect() from this read path — redirects break the
    // calendar drawer promise and only surface as "No se pudo cargar…".
    const user = await currentDbUser();
    if (!user) {
      return {
        success: false as const,
        error: "Sesión expirada. Recarga la página e inicia sesión de nuevo.",
      };
    }

    const tenant = await buildTenantContext(user);
    const canRead =
      hasPermission(tenant.effectiveRole, "reservations:read") ||
      hasPermission(tenant.effectiveRole, "calendar:read");
    if (!canRead) {
      return {
        success: false as const,
        error: "No tienes permiso para ver esta reserva",
      };
    }

    const reservation = await getReservationForInbox(reservationId, {
      organizationId: tenant.organizationId,
      userId: tenant.userId,
    });
    if (!reservation) {
      return { success: false as const, error: "Reserva no encontrada" };
    }

    // Flight/Server Actions reject non-plain payloads (rare Decimal/Date leaks).
    const safe = JSON.parse(JSON.stringify(reservation)) as typeof reservation;
    return { success: true as const, reservation: safe };
  } catch (error) {
    if (isRedirectError(error)) {
      return {
        success: false as const,
        error: "Sesión expirada. Recarga la página e inicia sesión de nuevo.",
      };
    }
    console.error("[getReservationInboxItemAction]", reservationId, error);
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "No se pudo cargar la reserva";
    return { success: false as const, error: message };
  }
}

export async function searchReservationsAction(query: string) {
  const q = typeof query === "string" ? query.trim() : "";
  if (q.length < 1) {
    return { success: true as const, results: [] as ReservationSearchHit[] };
  }

  try {
    const user = await currentDbUser();
    if (!user) {
      return {
        success: false as const,
        error: "Sesión expirada. Recarga la página e inicia sesión de nuevo.",
        results: [] as ReservationSearchHit[],
      };
    }

    const tenant = await buildTenantContext(user);
    const canRead =
      hasPermission(tenant.effectiveRole, "reservations:read") ||
      hasPermission(tenant.effectiveRole, "calendar:read");
    if (!canRead) {
      return {
        success: false as const,
        error: "No tienes permiso para buscar reservas",
        results: [] as ReservationSearchHit[],
      };
    }

    const results = await searchReservationsForCalendar(q);
    return { success: true as const, results };
  } catch (error) {
    if (isRedirectError(error)) {
      return {
        success: false as const,
        error: "Sesión expirada. Recarga la página e inicia sesión de nuevo.",
        results: [] as ReservationSearchHit[],
      };
    }
    console.error("[searchReservationsAction]", q, error);
    return {
      success: false as const,
      error: "No se pudo buscar reservas",
      results: [] as ReservationSearchHit[],
    };
  }
}

export async function updateReservationAction(
  id: string,
  data: ReservationEditValues,
) {
  await requirePermission("reservations:write");
  await assertBillingUnlocked();
  const parsed = reservationEditSchema.parse(data);
  const existing = await getReservationMutationContext(id);
  if (!existing) {
    return { success: false as const, error: "Reserva no encontrada" };
  }
  if (existing.platform === BookingPlatform.AIRBNB) {
    return {
      success: false as const,
      error: "Las reservas de Airbnb no se pueden editar manualmente.",
    };
  }

  try {
    await updateReservation(id, parsed);
    schedulePriceLabsRefresh("reservation");
    scheduleMonthlyFinanceMetricsRefreshForStay(
      { checkIn: existing.checkIn, checkOut: existing.checkOut },
      { checkIn: parsed.checkIn, checkOut: parsed.checkOut },
    );

    revalidatePath("/calendar");
    revalidatePath("/properties");
    revalidatePath("/");
    revalidatePath("/smart-access");
    revalidatePath("/finance");

    const reservation = await getReservationForInbox(id);
    if (!reservation) {
      return { success: false as const, error: "Reserva no encontrada" };
    }
    return { success: true as const, reservation };
  } catch (error) {
    if (
      error instanceof ReservationConflictError ||
      error instanceof ReservationMutationPolicyError
    ) {
      return { success: false as const, error: error.message };
    }
    if (error instanceof Error) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
}

export async function deleteReservationAction(id: string) {
  await requirePermission("reservations:delete");
  await assertBillingUnlocked();
  const existing = await getReservationMutationContext(id);
  if (!existing) {
    return { success: false as const, error: "Reserva no encontrada" };
  }
  try {
    await deleteReservation(id);
  } catch (error) {
    if (error instanceof OtaReservationDeleteError) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
  schedulePriceLabsRefresh("reservation");
  scheduleMonthlyFinanceMetricsRefreshForStay(
    { checkIn: existing.checkIn, checkOut: existing.checkOut },
    null,
  );
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath("/finance");
  return { success: true as const };
}

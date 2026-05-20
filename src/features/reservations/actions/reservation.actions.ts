"use server";

import { revalidatePath } from "next/cache";
import {
  reservationWizardSchema,
  type ReservationWizardValues,
} from "@/features/reservations/schemas/reservation.schema";
import type { ReservationInboxItem } from "@/features/reservations/types/reservation.types";
import { requirePermission } from "@/lib/auth";
import { ReservationConflictError } from "@/services/reservations/reservation-conflicts";
import { isPropertyLinkedToAirbnb } from "@/services/airbnb/airbnb-export-push.service";
import {
  createReservation,
  deleteReservation,
} from "@/services/reservations/reservation.service";
import { prismaDateToKey } from "@/lib/dates";

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
    platform: r.platform,
    status: r.status,
    totalAmount: r.totalAmount.toString(),
    currency: r.currency,
    internalNotes: r.internalNotes,
    property: {
      id: r.property.id,
      name: r.property.name,
      address: r.property.address,
      city: r.property.city,
    },
  };
}

export async function createReservationAction(data: ReservationWizardValues) {
  await requirePermission("reservations:write");
  const parsed = reservationWizardSchema.parse(data);

  try {
    const created = await createReservation(parsed);

    revalidatePath("/reservations");
    revalidatePath("/calendar");
    revalidatePath("/properties");
    revalidatePath("/");

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
    throw error;
  }
}

export async function deleteReservationAction(id: string) {
  await requirePermission("reservations:write");
  await deleteReservation(id);
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true as const };
}

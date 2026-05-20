import { PropertyStatus, ReservationStatus } from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { db } from "@/lib/db";
import { startOfDay } from "@/lib/helpers/date";

export type DashboardStats = {
  activeReservations: number;
  checkInsToday: number;
  checkOutsToday: number;
  occupancyRate: number;
  totalProperties: number;
  activeProperties: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = startOfDay();

  const [
    totalProperties,
    activeProperties,
    activeReservations,
    checkInsToday,
    checkOutsToday,
  ] = await Promise.all([
    db.property.count(),
    db.property.count({ where: { status: PropertyStatus.ACTIVE } }),
    db.reservation.count({
      where: withVisibleReservationsFilter({
        status: {
          in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
        },
      }),
    }),
    db.reservation.count({
      where: withVisibleReservationsFilter({
        checkIn: today,
        status: { not: ReservationStatus.CANCELLED },
      }),
    }),
    db.reservation.count({
      where: withVisibleReservationsFilter({
        checkOut: today,
        status: { not: ReservationStatus.CANCELLED },
      }),
    }),
  ]);

  const occupancyRate =
    activeProperties > 0
      ? Math.round((activeReservations / activeProperties) * 100)
      : 0;

  return {
    activeReservations,
    checkInsToday,
    checkOutsToday,
    occupancyRate,
    totalProperties,
    activeProperties,
  };
}

const panelReservationInclude = {
  property: {
    select: {
      name: true,
      coverImageUrl: true,
      checkInTime: true,
      checkOutTime: true,
      neighborhood: true,
    },
  },
} as const;

export type PanelReservation = Awaited<
  ReturnType<typeof getUpcomingArrivals>
>[number];

/** Serializable para Client Components (sin Decimal ni Date). */
export type PanelReservationRow = {
  id: string;
  guestName: string;
  adults: number;
  children: number;
  infants: number;
  checkIn: string;
  checkOut: string;
  platform: PanelReservation["platform"];
  property: {
    name: string;
    coverImageUrl: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    neighborhood: string | null;
  };
};

type PanelReservationWithPrimaryGuest = PanelReservation & {
  primaryGuestName: string | null;
};

async function attachPrimaryGuestNames<T extends { id: string }>(
  reservations: T[],
): Promise<Array<T & { primaryGuestName: string | null }>> {
  if (reservations.length === 0) return [];

  const primaryGuests = await db.reservationGuest.findMany({
    where: {
      isPrimary: true,
      reservationId: { in: reservations.map((reservation) => reservation.id) },
    },
    select: {
      reservationId: true,
      fullName: true,
    },
  });
  const nameByReservation = new Map(
    primaryGuests.map((guest) => [guest.reservationId, guest.fullName]),
  );

  return reservations.map((reservation) => ({
    ...reservation,
    primaryGuestName: nameByReservation.get(reservation.id) ?? null,
  }));
}

export function toPanelReservationRow(
  reservation: PanelReservationWithPrimaryGuest,
): PanelReservationRow {
  return {
    id: reservation.id,
    guestName:
      reservation.primaryGuestName?.trim() ||
      reservation.guestName.trim() ||
      "Registro pendiente",
    adults: reservation.adults,
    children: reservation.children,
    infants: reservation.infants,
    checkIn: reservation.checkIn.toISOString(),
    checkOut: reservation.checkOut.toISOString(),
    platform: reservation.platform,
    property: {
      name: reservation.property.name,
      coverImageUrl: reservation.property.coverImageUrl,
      checkInTime: reservation.property.checkInTime,
      checkOutTime: reservation.property.checkOutTime,
      neighborhood: reservation.property.neighborhood,
    },
  };
}

export type PanelCounts = {
  arrivals: number;
  departures: number;
  current: number;
};

export async function getPanelCounts(): Promise<PanelCounts> {
  const today = startOfDay();
  const weekAhead = new Date(today);
  weekAhead.setDate(weekAhead.getDate() + 7);

  const [arrivals, departures, current] = await Promise.all([
    db.reservation.count({
      where: withVisibleReservationsFilter({
        checkIn: { gte: today, lte: weekAhead },
        status: ReservationStatus.CONFIRMED,
      }),
    }),
    db.reservation.count({
      where: withVisibleReservationsFilter({
        checkOut: { gte: today, lte: weekAhead },
        status: {
          in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
        },
      }),
    }),
    db.reservation.count({
      where: withVisibleReservationsFilter({
        status: ReservationStatus.CHECKED_IN,
      }),
    }),
  ]);

  return { arrivals, departures, current };
}

export async function getUpcomingArrivals(limit = 20) {
  const today = startOfDay();
  const weekAhead = new Date(today);
  weekAhead.setDate(weekAhead.getDate() + 7);

  const reservations = await db.reservation.findMany({
    where: withVisibleReservationsFilter({
      checkIn: { gte: today, lte: weekAhead },
      status: ReservationStatus.CONFIRMED,
    }),
    include: panelReservationInclude,
    orderBy: { checkIn: "asc" },
    take: limit,
  });
  return attachPrimaryGuestNames(reservations);
}

export async function getUpcomingDepartures(limit = 20) {
  const today = startOfDay();
  const weekAhead = new Date(today);
  weekAhead.setDate(weekAhead.getDate() + 7);

  const reservations = await db.reservation.findMany({
    where: withVisibleReservationsFilter({
      checkOut: { gte: today, lte: weekAhead },
      status: {
        in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
      },
    }),
    include: panelReservationInclude,
    orderBy: { checkOut: "asc" },
    take: limit,
  });
  return attachPrimaryGuestNames(reservations);
}

export async function getCurrentStays(limit = 20) {
  const reservations = await db.reservation.findMany({
    where: withVisibleReservationsFilter({
      status: ReservationStatus.CHECKED_IN,
    }),
    include: panelReservationInclude,
    orderBy: { checkOut: "asc" },
    take: limit,
  });
  return attachPrimaryGuestNames(reservations);
}

import { PropertyStatus, ReservationStatus } from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { db } from "@/lib/db";
import { prismaDateToKey } from "@/lib/dates";
import { startOfDay } from "@/lib/helpers/date";
import {
  formatCalendarUnitDisplay,
  resolveCalendarUnitLabel,
} from "@/features/calendar/lib/property-unit";
import type { StoredPriceLabsMeta } from "@/integrations/pricelabs/types";
import {
  mergeReservationScope,
  type TenantDataScope,
} from "@/lib/platform/tenant-data-scope";
import { resolveReservationDisplayGuestName } from "@/lib/reservations/display-guest-name";
import { getAirbnbEnrichedGuestNameByReservationIds } from "@/services/reservations/airbnb-display-guest-name.service";

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
      unitNumber: true,
      coverImageUrl: true,
      checkInTime: true,
      checkOutTime: true,
      neighborhood: true,
      priceLabs: {
        select: { meta: true },
      },
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
    unitNumber: string | null;
    unitDisplay: string | null;
    coverImageUrl: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    neighborhood: string | null;
  };
};

type PanelReservationWithPrimaryGuest = PanelReservation & {
  primaryGuestName: string | null;
  airbnbEnrichmentGuestName: string | null;
};

async function attachPrimaryGuestNames<T extends { id: string }>(
  reservations: T[],
): Promise<Array<T & { primaryGuestName: string | null }>> {
  if (reservations.length === 0) return [];

  const primaryGuests = await db.reservationGuest.findMany({
    where: {
      OR: [{ isReservationOwner: true }, { isPrimary: true }],
      reservationId: { in: reservations.map((reservation) => reservation.id) },
    },
    orderBy: [{ isReservationOwner: "desc" }, { isPrimary: "desc" }],
    select: {
      reservationId: true,
      fullName: true,
    },
  });
  const nameByReservation = new Map<string, string>();
  for (const guest of primaryGuests) {
    if (nameByReservation.has(guest.reservationId)) continue;
    nameByReservation.set(guest.reservationId, guest.fullName);
  }

  return reservations.map((reservation) => ({
    ...reservation,
    primaryGuestName: nameByReservation.get(reservation.id) ?? null,
  }));
}

async function attachAirbnbEnrichmentGuestNames<T extends { id: string }>(
  reservations: T[],
): Promise<Array<T & { airbnbEnrichmentGuestName: string | null }>> {
  if (reservations.length === 0) return [];
  const guestByReservation = await getAirbnbEnrichedGuestNameByReservationIds(
    reservations.map((reservation) => reservation.id),
  );
  return reservations.map((reservation) => ({
    ...reservation,
    airbnbEnrichmentGuestName: guestByReservation.get(reservation.id) ?? null,
  }));
}

function readPriceLabsListingName(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const name = (meta as StoredPriceLabsMeta).listing?.name?.trim();
  return name || null;
}

function resolvePanelPropertyUnit(property: {
  name: string;
  unitNumber: string | null;
  priceLabs?: { meta: unknown } | null;
}): string | null {
  const listingName = readPriceLabsListingName(property.priceLabs?.meta);
  const label = resolveCalendarUnitLabel({
    name: property.name,
    unitNumber: property.unitNumber,
    listingName,
  });
  if (!label) return null;
  const display = formatCalendarUnitDisplay(label);
  return display === "—" ? null : display;
}

export function toPanelReservationRow(
  reservation: PanelReservationWithPrimaryGuest,
): PanelReservationRow {
  return {
    id: reservation.id,
    guestName: resolveReservationDisplayGuestName({
      platform: reservation.platform,
      airbnbEnrichmentGuestName: reservation.airbnbEnrichmentGuestName,
      guestName: reservation.guestName,
      primaryGuestName: reservation.primaryGuestName,
    }),
    adults: reservation.adults,
    children: reservation.children,
    infants: reservation.infants,
    checkIn: prismaDateToKey(reservation.checkIn),
    checkOut: prismaDateToKey(reservation.checkOut),
    platform: reservation.platform,
    property: {
      name: reservation.property.name,
      unitNumber: reservation.property.unitNumber,
      unitDisplay: resolvePanelPropertyUnit(reservation.property),
      coverImageUrl: reservation.property.coverImageUrl,
      checkInTime: reservation.property.checkInTime,
      checkOutTime: reservation.property.checkOutTime,
      neighborhood: reservation.property.neighborhood,
    },
  };
}

function sortPanelRowsByCheckIn(rows: PanelReservationRow[]): PanelReservationRow[] {
  return [...rows].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
}

function sortPanelRowsByCheckOut(rows: PanelReservationRow[]): PanelReservationRow[] {
  return [...rows].sort((a, b) => a.checkOut.localeCompare(b.checkOut));
}

export { sortPanelRowsByCheckIn, sortPanelRowsByCheckOut };

export type PanelCounts = {
  arrivals: number;
  departures: number;
  current: number;
};

export async function getPanelCounts(scope: TenantDataScope): Promise<PanelCounts> {
  const today = startOfDay();
  const weekAhead = new Date(today);
  weekAhead.setDate(weekAhead.getDate() + 7);

  const [arrivals, departures, current] = await Promise.all([
    db.reservation.count({
      where: withVisibleReservationsFilter(
        mergeReservationScope(scope, {
          checkIn: { gte: today, lte: weekAhead },
          status: ReservationStatus.CONFIRMED,
        }),
      ),
    }),
    db.reservation.count({
      where: withVisibleReservationsFilter(
        mergeReservationScope(scope, {
          checkOut: { gte: today, lte: weekAhead },
          status: {
            in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
          },
        }),
      ),
    }),
    db.reservation.count({
      where: withVisibleReservationsFilter(
        mergeReservationScope(scope, {
          status: ReservationStatus.CHECKED_IN,
        }),
      ),
    }),
  ]);

  return { arrivals, departures, current };
}

export async function getUpcomingArrivals(scope: TenantDataScope, limit = 20) {
  const today = startOfDay();
  const weekAhead = new Date(today);
  weekAhead.setDate(weekAhead.getDate() + 7);

  const reservations = await db.reservation.findMany({
    where: withVisibleReservationsFilter(
      mergeReservationScope(scope, {
        checkIn: { gte: today, lte: weekAhead },
        status: ReservationStatus.CONFIRMED,
      }),
    ),
    include: panelReservationInclude,
    orderBy: { checkIn: "asc" },
    take: limit,
  });
  const withPrimary = await attachPrimaryGuestNames(reservations);
  return attachAirbnbEnrichmentGuestNames(withPrimary);
}

export async function getUpcomingDepartures(scope: TenantDataScope, limit = 20) {
  const today = startOfDay();
  const weekAhead = new Date(today);
  weekAhead.setDate(weekAhead.getDate() + 7);

  const reservations = await db.reservation.findMany({
    where: withVisibleReservationsFilter(
      mergeReservationScope(scope, {
        checkOut: { gte: today, lte: weekAhead },
        status: {
          in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
        },
      }),
    ),
    include: panelReservationInclude,
    orderBy: { checkOut: "asc" },
    take: limit,
  });
  const withPrimary = await attachPrimaryGuestNames(reservations);
  return attachAirbnbEnrichmentGuestNames(withPrimary);
}

export async function getCurrentStays(scope: TenantDataScope, limit = 20) {
  const reservations = await db.reservation.findMany({
    where: withVisibleReservationsFilter(
      mergeReservationScope(scope, {
        status: ReservationStatus.CHECKED_IN,
      }),
    ),
    include: panelReservationInclude,
    orderBy: { checkOut: "asc" },
    take: limit,
  });
  const withPrimary = await attachPrimaryGuestNames(reservations);
  return attachAirbnbEnrichmentGuestNames(withPrimary);
}

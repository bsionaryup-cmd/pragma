import { buildRollingCalendarViewport } from "@/features/calendar/lib/calendar-dates";
import type {
  CalendarDataDto,
  CalendarReservationDto,
} from "@/features/calendar/types/calendar.types";
import { PropertyStatus } from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { dateKeyToPrismaDate, prismaDateToKey } from "@/lib/dates";
import { db } from "@/lib/db";

export async function getCalendarData(anchorKey: string): Promise<CalendarDataDto> {
  const viewport = buildRollingCalendarViewport(anchorKey);
  const rangeStart = dateKeyToPrismaDate(viewport.rangeStart);
  const rangeEnd = dateKeyToPrismaDate(viewport.rangeEnd);

  const [properties, reservations] = await Promise.all([
    db.property.findMany({
      where: { status: PropertyStatus.ACTIVE },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        propertyType: true,
        status: true,
        coverImageUrl: true,
      },
      orderBy: [{ name: "asc" }],
    }),
    db.reservation.findMany({
      where: withVisibleReservationsFilter({
        status: { notIn: ["CANCELLED"] },
        checkIn: { lte: rangeEnd },
        checkOut: { gt: rangeStart },
      }),
      select: {
        id: true,
        propertyId: true,
        guestName: true,
        checkIn: true,
        checkOut: true,
        status: true,
        totalAmount: true,
        currency: true,
        platform: true,
      },
      orderBy: { checkIn: "asc" },
    }),
  ]);

  const primaryGuests = await db.reservationGuest.findMany({
    where: {
      isPrimary: true,
      reservationId: { in: reservations.map((r) => r.id) },
    },
    select: {
      reservationId: true,
      fullName: true,
    },
  });
  const primaryGuestByReservation = new Map(
    primaryGuests.map((guest) => [guest.reservationId, guest.fullName]),
  );

  const reservationDtos: CalendarReservationDto[] = reservations.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    guestName:
      primaryGuestByReservation.get(r.id)?.trim() ||
      r.guestName.trim() ||
      "Registro pendiente",
    checkIn: prismaDateToKey(r.checkIn),
    checkOut: prismaDateToKey(r.checkOut),
    status: r.status,
    totalAmount: r.totalAmount.toString(),
    currency: r.currency,
    platform: r.platform,
  }));

  return {
    properties,
    reservations: reservationDtos,
    viewport,
  };
}

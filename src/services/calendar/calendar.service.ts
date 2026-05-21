import { buildRollingCalendarViewport } from "@/features/calendar/lib/calendar-dates";
import type {
  CalendarDataDto,
  CalendarReservationDto,
} from "@/features/calendar/types/calendar.types";
import { PropertyStatus } from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { dateKeyToPrismaDate, prismaDateToKey } from "@/lib/dates";
import { parseDailyPricesFromMeta } from "@/features/calendar/lib/daily-pricing";
import type { CalendarPropertyDto } from "@/features/calendar/types/calendar.types";
import { isPriceLabsSchemaDriftError } from "@/services/integrations/pricelabs/pricelabs-prisma-guard";
import { db } from "@/lib/db";

async function loadCalendarProperties() {
  const base = {
    id: true,
    name: true,
    address: true,
    city: true,
    propertyType: true,
    status: true,
    coverImageUrl: true,
    baseRate: true,
  } as const;
  try {
    return await db.property.findMany({
      where: { status: PropertyStatus.ACTIVE },
      select: {
        ...base,
        priceLabs: {
          select: {
            recommendedRate: true,
            priceDelta: true,
            baseRateAtSync: true,
            meta: true,
          },
        },
      },
      orderBy: [{ name: "asc" }],
    });
  } catch (error) {
    if (!isPriceLabsSchemaDriftError(error)) throw error;
    return await db.property.findMany({
      where: { status: PropertyStatus.ACTIVE },
      select: base,
      orderBy: [{ name: "asc" }],
    });
  }
}

type PropertyRow = Awaited<ReturnType<typeof loadCalendarProperties>>[number];
type PriceLabsRow = {
  recommendedRate: { toString(): string } | null;
  priceDelta: { toString(): string } | null;
  baseRateAtSync: { toString(): string } | null;
  meta: unknown;
};

function mapCalendarProperty(p: PropertyRow): CalendarPropertyDto {
  const pl = (
    "priceLabs" in p ? p.priceLabs : null
  ) as PriceLabsRow | null;
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    city: p.city,
    propertyType: p.propertyType,
    status: p.status,
    coverImageUrl: p.coverImageUrl,
    pricing:
      pl || p.baseRate
        ? {
            baseRate:
              pl?.baseRateAtSync?.toString() ?? p.baseRate?.toString() ?? null,
            recommendedRate: pl?.recommendedRate?.toString() ?? null,
            priceDelta: pl?.priceDelta?.toString() ?? null,
          }
        : null,
    dailyPricesByDate: pl?.meta
      ? parseDailyPricesFromMeta(pl.meta)
      : {},
  };
}

export async function getCalendarData(anchorKey: string): Promise<CalendarDataDto> {
  const viewport = buildRollingCalendarViewport(anchorKey);
  const rangeStart = dateKeyToPrismaDate(viewport.rangeStart);
  const rangeEnd = dateKeyToPrismaDate(viewport.rangeEnd);

  const [propertiesRaw, reservations] = await Promise.all([
    loadCalendarProperties(),
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
    properties: propertiesRaw.map(mapCalendarProperty),
    reservations: reservationDtos,
    viewport,
  };
}

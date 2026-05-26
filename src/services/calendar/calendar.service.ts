import {
  buildRollingCalendarViewport,
  CALENDAR_DAYS_AFTER,
  CALENDAR_DAYS_BEFORE,
  CALENDAR_DEFAULT_DAYS_BEFORE,
  CALENDAR_MAX_DAYS_BEFORE,
  differenceInCalendarDays,
  getTodayKey,
} from "@/features/calendar/lib/calendar-dates";
import type {
  CalendarDataDto,
  CalendarReservationDto,
} from "@/features/calendar/types/calendar.types";
import { PropertyStatus } from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { dateKeyToPrismaDate, prismaDateToKey } from "@/lib/dates";
import {
  parseDailyPricesFromMeta,
  trimDailyPricesToRange,
} from "@/features/calendar/lib/daily-pricing";
import { resolveCalendarUnitLabel } from "@/features/calendar/lib/property-unit";
import type { StoredPriceLabsMeta } from "@/integrations/pricelabs/types";
import type { CalendarPropertyDto } from "@/features/calendar/types/calendar.types";
import { isPriceLabsSchemaDriftError } from "@/services/integrations/pricelabs/pricelabs-prisma-guard";
import { db } from "@/lib/db";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { sortPropertiesByUnitNumber } from "@/lib/property-display";
import {
  mergePropertyScope,
  mergeReservationScope,
  type TenantDataScope,
} from "@/lib/platform/tenant-data-scope";
import { purgeGhostReservationsThrottled } from "@/services/reservations/ghost-reservation.service";

async function loadCalendarProperties(scope: TenantDataScope) {
  const base = {
    id: true,
    name: true,
    unitNumber: true,
    address: true,
    city: true,
    propertyType: true,
    status: true,
    coverImageUrl: true,
    baseRate: true,
    cleaningFee: true,
  } as const;
  const propertyFilter = mergePropertyScope(scope, {
    status: PropertyStatus.ACTIVE,
  });
  try {
    return await db.property.findMany({
      where: propertyFilter,
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
      where: propertyFilter,
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

function mapCalendarProperty(
  p: PropertyRow,
  rangeStart: string,
  rangeEnd: string,
): CalendarPropertyDto {
  const pl = (
    "priceLabs" in p ? p.priceLabs : null
  ) as PriceLabsRow | null;
  const listingName =
    pl?.meta && typeof pl.meta === "object"
      ? (pl.meta as StoredPriceLabsMeta).listing?.name
      : null;
  const unitNumber =
    resolveCalendarUnitLabel({
      name: p.name,
      unitNumber: p.unitNumber,
    }) ??
    (listingName
      ? resolveCalendarUnitLabel({ name: listingName, unitNumber: null })
      : null) ??
    p.unitNumber;

  return {
    id: p.id,
    name: p.name,
    unitNumber,
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
      ? trimDailyPricesToRange(
          parseDailyPricesFromMeta(pl.meta),
          rangeStart,
          rangeEnd,
        )
      : {},
    cleaningFee: p.cleaningFee ? Number(p.cleaningFee) : null,
  };
}

async function resolveCalendarDaysBefore(
  anchorKey: string,
  scope: TenantDataScope,
): Promise<number> {
  const todayKey = getTodayKey();
  const anchor = anchorKey?.match(/^\d{4}-\d{2}-\d{2}$/) ? anchorKey : todayKey;

  if (anchor !== todayKey) {
    return CALENDAR_DEFAULT_DAYS_BEFORE;
  }

  const earliest = await db.reservation.findFirst({
    where: withVisibleReservationsFilter(
      mergeReservationScope(scope, {
        status: { notIn: ["CANCELLED", "BLOCKED"] },
      }),
    ),
    orderBy: { checkIn: "asc" },
    select: { checkIn: true },
  });

  if (!earliest) {
    return CALENDAR_DAYS_BEFORE;
  }

  const earliestKey = prismaDateToKey(earliest.checkIn);
  const span = differenceInCalendarDays(
    dateKeyToPrismaDate(todayKey),
    dateKeyToPrismaDate(earliestKey),
  );
  return Math.min(
    CALENDAR_MAX_DAYS_BEFORE,
    Math.max(CALENDAR_DAYS_BEFORE, span),
  );
}

export async function getCalendarData(anchorKey: string): Promise<CalendarDataDto> {
  const scope = await requireTenantDataScope();
  await purgeGhostReservationsThrottled(scope);
  const daysBefore = await resolveCalendarDaysBefore(anchorKey, scope);
  const viewport = buildRollingCalendarViewport(
    anchorKey,
    daysBefore,
    CALENDAR_DAYS_AFTER,
  );
  const rangeStartKey = viewport.rangeStart;
  const rangeEndKey = viewport.rangeEnd;
  const rangeStart = dateKeyToPrismaDate(rangeStartKey);
  const rangeEnd = dateKeyToPrismaDate(rangeEndKey);

  const [propertiesRaw, reservations] = await Promise.all([
    loadCalendarProperties(scope),
    db.reservation.findMany({
      where: withVisibleReservationsFilter(
        mergeReservationScope(scope, {
          status: { notIn: ["CANCELLED", "BLOCKED"] },
          checkIn: { lte: rangeEnd },
          checkOut: { gt: rangeStart },
        }),
      ),
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

  const primaryGuests =
    reservations.length === 0
      ? []
      : await db.reservationGuest.findMany({
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
    properties: sortPropertiesByUnitNumber(
      propertiesRaw.map((p) =>
        mapCalendarProperty(p, rangeStartKey, rangeEndKey),
      ),
      (p) => p,
    ),
    reservations: reservationDtos,
    viewport,
  };
}

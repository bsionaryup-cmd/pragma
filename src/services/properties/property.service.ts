import type { PropertyFormValues } from "@/features/properties/schemas/property.schema";
import { mapSmartLockSnapshot } from "@/modules/integrations/ttlock/ttlock.mapper";
import {
  isTTLockIntegrationConnected,
  resolveTTLockIntegrationForProperty,
} from "@/modules/integrations/ttlock/ttlock.persistence";
import type { AirbnbListingPreview } from "@/services/airbnb/airbnb-import.service";
import { ensurePropertyIcalExportToken } from "@/services/airbnb/ical-export.service";
import {
  computeMonthOccupancyPercent,
  startOfDay,
  sumMonthRevenue,
} from "@/features/properties/lib/property-stats";
import type {
  PropertyDetailDto,
  PropertyGridItem,
  PropertyTaskItem,
  PropertyUpcomingReservation,
} from "@/features/properties/types/property.types";
import {
  BookingPlatform,
  PropertyStatus,
  ReservationStatus,
} from "@prisma/client";
import { isOrphanAirbnbReservation } from "@/services/airbnb/airbnb-ical-orphan.service";
import { sortPropertiesByUnitNumber } from "@/lib/property-display";
import { formatAccessCode } from "@/lib/access-code";
import {
  hasActiveAirbnbIcalImport,
  withVisibleReservationsFilter,
} from "@/lib/airbnb/ical-sync-utils";
import { db } from "@/lib/db";
import { getEffectiveOrganizationIdForUser } from "@/lib/platform/tenant-context";

async function resolvePropertyScope(userId: string, propertyId?: string) {
  const organizationId = await getEffectiveOrganizationIdForUser(userId);

  if (organizationId) {
    return propertyId
      ? { id: propertyId, organizationId }
      : { organizationId };
  }

  return propertyId
    ? { id: propertyId, ownerId: userId }
    : { ownerId: userId };
}

function getMonthBounds(reference = new Date()) {
  const monthStart = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const monthEnd = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return { monthStart, monthEnd };
}

function toUpcomingReservation(r: {
  id: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  status: PropertyUpcomingReservation["status"];
}): PropertyUpcomingReservation {
  return {
    id: r.id,
    guestName: r.guestName,
    checkIn: r.checkIn.toISOString().slice(0, 10),
    checkOut: r.checkOut.toISOString().slice(0, 10),
    status: r.status,
  };
}

function filterVisibleReservations<
  T extends { icalUid: string | null; platform: BookingPlatform },
>(
  icalUrl: string | null,
  reservations: T[],
): T[] {
  if (hasActiveAirbnbIcalImport(icalUrl)) return reservations;
  return reservations.filter((r) => !isOrphanAirbnbReservation(r));
}

function mapPropertyRow(
  property: {
    id: string;
    name: string;
    unitNumber?: string | null;
    city: string;
    country: string;
    neighborhood: string | null;
    coverImageUrl: string | null;
    propertyType: PropertyGridItem["propertyType"];
    status: PropertyGridItem["status"];
    maxGuests: number;
    bedrooms: number;
    beds: number;
    bathrooms: { toString(): string };
    icalUrl: string | null;
    reservations: Array<{
      id: string;
      guestName: string;
      checkIn: Date;
      checkOut: Date;
      status: PropertyUpcomingReservation["status"];
      totalAmount?: { toString(): string };
      icalUid: string | null;
      platform: BookingPlatform;
    }>;
  },
  today: Date,
  monthStart: Date,
  monthEnd: Date,
): PropertyGridItem {
  const visible = filterVisibleReservations(
    property.icalUrl,
    property.reservations,
  );

  const upcoming = visible
    .filter(
      (r) =>
        r.status !== ReservationStatus.CANCELLED &&
        startOfDay(r.checkOut) > today,
    )
    .sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());

  const monthReservations = visible.filter(
    (r) =>
      r.status !== ReservationStatus.CANCELLED &&
      r.checkIn <= monthEnd &&
      r.checkOut > monthStart,
  );

  return {
    id: property.id,
    name: property.name,
    unitNumber: property.unitNumber ?? null,
    city: property.city,
    country: property.country,
    neighborhood: property.neighborhood,
    coverImageUrl: property.coverImageUrl,
    propertyType: property.propertyType,
    status: property.status,
    maxGuests: property.maxGuests,
    bedrooms: property.bedrooms,
    beds: property.beds,
    bathrooms: property.bathrooms.toString(),
    nextReservation: upcoming[0] ? toUpcomingReservation(upcoming[0]) : null,
    upcomingCount: upcoming.length,
    monthOccupancyPercent: computeMonthOccupancyPercent(
      monthReservations,
      monthStart,
      monthEnd,
    ),
  };
}

export async function listPropertiesForGrid(
  userId: string,
): Promise<PropertyGridItem[]> {
  const today = startOfDay(new Date());
  const { monthStart, monthEnd } = getMonthBounds();
  const scope = await resolvePropertyScope(userId);

  const properties = await db.property.findMany({
    where: scope,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      unitNumber: true,
      city: true,
      country: true,
      neighborhood: true,
      coverImageUrl: true,
      propertyType: true,
      status: true,
      maxGuests: true,
      bedrooms: true,
      beds: true,
      bathrooms: true,
      icalUrl: true,
    },
  });

  if (properties.length === 0) return [];

  const propertyIds = properties.map((property) => property.id);
  const reservations = await db.reservation.findMany({
    where: {
      propertyId: { in: propertyIds },
      status: { not: ReservationStatus.CANCELLED },
      OR: [
        { checkIn: { lte: monthEnd }, checkOut: { gt: monthStart } },
        { checkOut: { gt: today } },
      ],
    },
    select: {
      propertyId: true,
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      status: true,
      totalAmount: true,
      icalUid: true,
      platform: true,
    },
    orderBy: { checkIn: "asc" },
  });

  const reservationsByProperty = new Map<
    string,
    Array<(typeof reservations)[number]>
  >();
  for (const reservation of reservations) {
    const list = reservationsByProperty.get(reservation.propertyId) ?? [];
    list.push(reservation);
    reservationsByProperty.set(reservation.propertyId, list);
  }

  return sortPropertiesByUnitNumber(
    properties.map((property) =>
      mapPropertyRow(
        {
          ...property,
          reservations: reservationsByProperty.get(property.id) ?? [],
        },
        today,
        monthStart,
        monthEnd,
      ),
    ),
    (item) => item,
  );
}

export async function getPropertyDetail(
  id: string,
  userId: string,
): Promise<PropertyDetailDto | null> {
  const today = startOfDay(new Date());
  const { monthStart, monthEnd } = getMonthBounds();
  const scope = await resolvePropertyScope(userId, id);

  const property = await db.property.findFirst({
    where: scope,
    include: {
      propertyLock: true,
      reservations: {
        where: {
          status: { not: ReservationStatus.CANCELLED },
          checkOut: { gt: today },
        },
        select: {
          id: true,
          guestName: true,
          checkIn: true,
          checkOut: true,
          status: true,
          totalAmount: true,
          icalUid: true,
          platform: true,
        },
        orderBy: { checkIn: "asc" },
        take: 20,
      },
      tasks: {
        where: {
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          dueDate: true,
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        take: 6,
      },
    },
  });

  if (!property) return null;

  const allMonthReservations = await db.reservation.findMany({
    where: withVisibleReservationsFilter({
      propertyId: id,
      status: { not: ReservationStatus.CANCELLED },
      checkIn: { lte: monthEnd },
      checkOut: { gt: monthStart },
    }),
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      status: true,
      totalAmount: true,
      icalUid: true,
      platform: true,
    },
  });

  const grid = mapPropertyRow(
    {
      ...property,
      reservations: allMonthReservations.length
        ? allMonthReservations
        : property.reservations,
    },
    today,
    monthStart,
    monthEnd,
  );

  const pendingTasks: PropertyTaskItem[] = property.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    status: t.status,
    dueDate: t.dueDate?.toISOString() ?? null,
  }));

  const integration = await resolveTTLockIntegrationForProperty(id);
  const integrationConnected = integration
    ? isTTLockIntegrationConnected(integration)
    : false;

  return {
    ...grid,
    description: property.description,
    address: property.address,
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
    accessCode: formatAccessCode(property.accessCode),
    accessInstructions: property.accessInstructions,
    wifiName: property.wifiName,
    wifiPassword: property.wifiPassword,
    houseRules: property.houseRules,
    baseRate: property.baseRate?.toString() ?? null,
    cleaningFee: property.cleaningFee?.toString() ?? null,
    currency: property.currency,
    airbnbListingUrl: property.airbnbListingUrl,
    icalUrl: property.icalUrl,
    lastIcalSyncedAt: property.lastIcalSyncedAt?.toISOString() ?? null,
    upcomingReservations: filterVisibleReservations(
      property.icalUrl,
      property.reservations,
    ).map(toUpcomingReservation),
    pendingTasks,
    monthRevenue: String(sumMonthRevenue(allMonthReservations, monthStart, monthEnd)),
    createdAt: property.createdAt.toISOString(),
    smartAccess: {
      lock: property.propertyLock
        ? mapSmartLockSnapshot({
            lock: property.propertyLock,
            propertyName: property.name,
          })
        : null,
      integrationConnected,
    },
  };
}

/** Para selects en reservas/tareas — solo activas y reservables */
export async function listPropertiesForSelect(userId: string) {
  const scope = await resolvePropertyScope(userId);
  const rows = await db.property.findMany({
    where: { ...scope, status: PropertyStatus.ACTIVE },
    select: { id: true, name: true, unitNumber: true, maxGuests: true },
  });
  return sortPropertiesByUnitNumber(rows, (p) => p);
}

export async function listPropertiesForInbox(userId: string) {
  const scope = await resolvePropertyScope(userId);
  const rows = await db.property.findMany({
    where: { ...scope, status: PropertyStatus.ACTIVE },
    select: { id: true, name: true, unitNumber: true, address: true, city: true, maxGuests: true },
  });
  return sortPropertiesByUnitNumber(rows, (p) => p);
}

export async function getPropertyById(id: string, userId: string) {
  const scope = await resolvePropertyScope(userId, id);
  return db.property.findFirst({
    where: scope,
  });
}

function normalizeTime(value: string | undefined, fallback: string): string {
  if (!value?.trim()) return fallback;
  const match = value.trim().match(/^(\d{2}:\d{2})/);
  return match ? match[1] : fallback;
}

function normalizeFormData(data: PropertyFormValues) {
  return {
    name: data.name.trim(),
    unitNumber: data.unitNumber?.trim() || null,
    description: data.description?.trim() || null,
    address: data.address.trim(),
    neighborhood: data.neighborhood?.trim() || null,
    city: data.city.trim(),
    country: data.country.trim(),
    propertyType: data.propertyType,
    maxGuests: data.maxGuests,
    bedrooms: data.bedrooms,
    beds: data.beds,
    bathrooms: data.bathrooms,
    checkInTime: normalizeTime(data.checkInTime, "15:00"),
    checkOutTime: normalizeTime(data.checkOutTime, "13:00"),
    accessCode: data.accessCode?.trim()
      ? formatAccessCode(data.accessCode)
      : null,
    accessInstructions: data.accessInstructions?.trim() || null,
    wifiName: data.wifiName?.trim() || null,
    wifiPassword: data.wifiPassword?.trim() || null,
    houseRules: data.houseRules?.trim() || null,
    baseRate: data.baseRate ?? null,
    cleaningFee: data.cleaningFee ?? null,
    coverImageUrl: data.coverImageUrl?.trim() || null,
    status: data.status,
  };
}

export async function createProperty(ownerId: string, data: PropertyFormValues) {
  const organizationId = await getEffectiveOrganizationIdForUser(ownerId);

  const created = await db.property.create({
    data: {
      ownerId,
      organizationId: organizationId ?? null,
      ...normalizeFormData(data),
    },
  });
  await ensurePropertyIcalExportToken(created.id);
  return created;
}

export type AirbnbImportPayload = AirbnbListingPreview & {
  icalUrl: string;
};

function sanitizeAirbnbImport(preview: AirbnbImportPayload) {
  const address =
    preview.address.trim().length >= 5
      ? preview.address.trim()
      : `${preview.city.trim()} — importado desde Airbnb`;

  return {
    name: preview.name.trim().slice(0, 120),
    description: preview.description?.trim().slice(0, 4000) ?? null,
    address: address.slice(0, 200),
    neighborhood: preview.neighborhood?.trim().slice(0, 80) ?? null,
    city: preview.city.trim().slice(0, 80),
    country: preview.country.trim().slice(0, 2).toUpperCase() || "CO",
    propertyType: preview.propertyType,
    maxGuests: Math.max(1, Math.min(preview.maxGuests, 30)),
    bedrooms: Math.max(0, Math.min(preview.bedrooms, 20)),
    beds: Math.max(1, Math.min(preview.beds, 30)),
    bathrooms: Math.max(0.5, Math.min(preview.bathrooms, 20)),
    coverImageUrl: preview.coverImageUrl?.trim().slice(0, 2048) ?? null,
    airbnbListingUrl: preview.listingUrl.trim().slice(0, 2048),
    airbnbRoomId: preview.roomId?.trim().slice(0, 64) ?? null,
    icalUrl: preview.icalUrl.trim().slice(0, 2048),
  };
}

export async function createPropertyFromAirbnbImport(
  ownerId: string,
  preview: AirbnbImportPayload,
) {
  const data = sanitizeAirbnbImport(preview);
  const user = await db.user.findUnique({
    where: { id: ownerId },
    select: { organizationId: true },
  });

  const created = await db.property.create({
    data: {
      ownerId,
      organizationId: user?.organizationId ?? null,
      ...data,
      status: PropertyStatus.ACTIVE,
      checkInTime: "15:00",
      checkOutTime: "13:00",
    },
  });

  await ensurePropertyIcalExportToken(created.id);
  return created;
}

export async function updateProperty(
  id: string,
  userId: string,
  data: PropertyFormValues,
) {
  const scope = await resolvePropertyScope(userId, id);
  return db.property.updateMany({
    where: scope,
    data: normalizeFormData(data),
  });
}

export async function deleteProperty(id: string, userId: string) {
  const scope = await resolvePropertyScope(userId, id);
  return db.property.deleteMany({
    where: scope,
  });
}

/** @deprecated Usar listPropertiesForGrid */
export async function listProperties(userId: string) {
  const scope = await resolvePropertyScope(userId);
  return db.property.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
  });
}

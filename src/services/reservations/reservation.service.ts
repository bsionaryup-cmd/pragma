import type { ReservationWizardValues } from "@/features/reservations/schemas/reservation.schema";
import type {
  ReservationDetailItem,
  ReservationInboxItem,
  ReservationRelatedBlock,
} from "@/features/reservations/types/reservation.types";
import { PropertyStatus, ReservationStatus } from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
import { dateKeyToPrismaDate, prismaDateToKey } from "@/lib/dates";
import { db } from "@/lib/db";
import { touchPropertyIcalExport } from "@/services/airbnb/airbnb-export-push.service";
import { assertNoReservationOverlap } from "@/services/reservations/reservation-conflicts";
import { deriveReservationStatusFromDates } from "@/services/reservations/reservation-status";

function buildGuestName(firstName: string, lastName?: string | null): string {
  return [firstName.trim(), lastName?.trim()].filter(Boolean).join(" ");
}

type ReservationRow = {
  id: string;
  guestName: string;
  guestFirstName: string;
  guestLastName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  guestCountry: string | null;
  guestLanguage: string | null;
  adults: number;
  children: number;
  infants: number;
  checkIn: Date;
  checkOut: Date;
  platform: ReservationInboxItem["platform"];
  status: ReservationInboxItem["status"];
  totalAmount: { toString(): string };
  currency: string;
  internalNotes: string | null;
  property: ReservationInboxItem["property"];
};

function toInboxItem(r: ReservationRow): ReservationInboxItem {
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

export async function listReservationsForInbox(): Promise<ReservationInboxItem[]> {
  const rows = await db.reservation.findMany({
    where: withVisibleReservationsFilter({}),
    include: {
      property: {
        select: { id: true, name: true, address: true, city: true },
      },
    },
    orderBy: [{ checkIn: "desc" }, { createdAt: "desc" }],
  });

  return rows.map(toInboxItem);
}

/** @deprecated Usar listReservationsForInbox */
export async function listReservations() {
  return db.reservation.findMany({
    include: { property: { select: { name: true } } },
    orderBy: { checkIn: "desc" },
  });
}

export async function getReservationById(id: string) {
  return db.reservation.findUnique({
    where: { id },
    include: { property: true },
  });
}

type ReservationDetailRow = ReservationRow & {
  createdAt: Date;
  icalUid: string | null;
};

function toDetailItem(
  row: ReservationDetailRow,
  relatedBlocks: ReservationRelatedBlock[],
): ReservationDetailItem {
  return {
    ...toInboxItem(row),
    createdAt: row.createdAt.toISOString(),
    icalUid: row.icalUid,
    relatedBlocks,
  };
}

/** Detalle completo para panel/drawer (respeta filtros de visibilidad del calendario). */
export async function getReservationForInbox(
  id: string,
): Promise<ReservationDetailItem | null> {
  const row = await db.reservation.findFirst({
    where: withVisibleReservationsFilter({ id }),
    include: {
      property: {
        select: { id: true, name: true, address: true, city: true },
      },
    },
  });
  if (!row) return null;

  const blockRows = await db.reservation.findMany({
    where: withVisibleReservationsFilter({
      propertyId: row.propertyId,
      id: { not: row.id },
      status: ReservationStatus.BLOCKED,
      checkIn: { lt: row.checkOut },
      checkOut: { gt: row.checkIn },
    }),
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
    },
    orderBy: { checkIn: "asc" },
  });

  const relatedBlocks: ReservationRelatedBlock[] = blockRows.map((b) => ({
    id: b.id,
    guestName: b.guestName,
    checkIn: prismaDateToKey(b.checkIn),
    checkOut: prismaDateToKey(b.checkOut),
  }));

  return toDetailItem(row, relatedBlocks);
}

export async function createReservation(data: ReservationWizardValues) {
  const property = await db.property.findFirst({
    where: { id: data.propertyId, status: PropertyStatus.ACTIVE },
  });
  if (!property) throw new Error("Propiedad no encontrada");

  const checkIn = dateKeyToPrismaDate(data.checkIn);
  const checkOut = dateKeyToPrismaDate(data.checkOut);
  await assertNoReservationOverlap(data.propertyId, checkIn, checkOut);

  const guestName = buildGuestName(data.guestFirstName, data.guestLastName);
  const status =
    data.platform === "DIRECT" || data.platform === "BOOKING"
      ? deriveReservationStatusFromDates(checkIn, checkOut)
      : data.status;

  const created = await db.reservation.create({
    data: {
      propertyId: data.propertyId,
      guestName,
      guestFirstName: data.guestFirstName.trim(),
      guestLastName: data.guestLastName?.trim() || null,
      guestEmail: data.guestEmail?.trim() || null,
      guestPhone: data.guestPhone?.trim() || null,
      guestCountry: data.guestCountry?.trim() || null,
      guestLanguage: data.guestLanguage?.trim() || null,
      adults: data.adults,
      children: data.children,
      infants: data.infants,
      checkIn,
      checkOut,
      platform: data.platform,
      status,
      totalAmount: data.totalAmount,
      internalNotes: data.internalNotes?.trim() || null,
    },
    include: {
      property: {
        select: { id: true, name: true, address: true, city: true },
      },
    },
  });

  await touchPropertyIcalExport(data.propertyId);

  return created;
}

export async function deleteReservation(id: string) {
  const existing = await db.reservation.findUnique({
    where: { id },
    select: { propertyId: true },
  });
  const deleted = await db.reservation.delete({ where: { id } });
  if (existing) {
    await touchPropertyIcalExport(existing.propertyId);
  }
  return deleted;
}

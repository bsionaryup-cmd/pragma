import { ReservationStatus, type Reservation } from "@prisma/client";
import { getPublicAppUrl } from "@/lib/app-url";
import { prismaDateToKey, startOfTodayUtc } from "@/lib/dates";
import { platformLabels, reservationStatusLabels } from "@/lib/labels";
import { db } from "@/lib/db";
import { randomBytes } from "node:crypto";

function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldIcalLine(line: string): string {
  const max = 75;
  if (line.length <= max) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, max));
  rest = rest.slice(max);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, max - 1)}`);
    rest = rest.slice(max - 1);
  }
  return parts.join("\r\n");
}

function toIcalDateValue(date: Date): string {
  return prismaDateToKey(date).replace(/-/g, "");
}

function toIcalDateTimeStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z/, "Z");
}

export function stripIcsExtension(slug: string): string {
  return slug.endsWith(".ics") ? slug.slice(0, -4) : slug;
}

export async function ensurePropertyIcalExportToken(
  propertyId: string,
): Promise<string> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { icalExportToken: true },
  });
  if (!property) throw new Error("Propiedad no encontrada");
  if (property.icalExportToken) return property.icalExportToken;

  const token = randomBytes(24).toString("hex");
  await db.property.update({
    where: { id: propertyId },
    data: { icalExportToken: token },
  });
  return token;
}

type ExportReservationRow = Pick<
  Reservation,
  | "id"
  | "guestName"
  | "checkIn"
  | "checkOut"
  | "status"
  | "platform"
  | "updatedAt"
>;

function buildEventLines(r: ExportReservationRow, propertyName: string): string[] {
  const checkInKey = prismaDateToKey(r.checkIn);
  const checkOutKey = prismaDateToKey(r.checkOut);
  const statusLabel = reservationStatusLabels[r.status];
  const platformLabel = platformLabels[r.platform];

  /** Airbnb importa eventos con SUMMARY "Reserved" / "Not available" para bloquear fechas. */
  const summary =
    r.status === ReservationStatus.BLOCKED
      ? "(Not available)"
      : "Reserved";

  const description = [
    `Huésped: ${r.guestName}`,
    `Check-in: ${checkInKey}`,
    `Check-out: ${checkOutKey}`,
    `Estado: ${statusLabel}`,
    `Plataforma: ${platformLabel}`,
    `Propiedad: ${propertyName}`,
  ].join("\\n");

  const uid = `pragma-export-${r.id}@pragma-pms`;
  const stamp = toIcalDateTimeStamp(r.updatedAt ?? new Date());

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `LAST-MODIFIED:${stamp}`,
    `DTSTART;VALUE=DATE:${toIcalDateValue(r.checkIn)}`,
    `DTEND;VALUE=DATE:${toIcalDateValue(r.checkOut)}`,
    foldIcalLine(`SUMMARY:${escapeIcalText(summary)}`),
    foldIcalLine(`DESCRIPTION:${escapeIcalText(description)}`),
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "CLASS:PUBLIC",
    "END:VEVENT",
  ];
}

async function loadExportReservations(
  propertyId: string,
): Promise<{ propertyName: string; reservations: ExportReservationRow[] } | null> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { id: true, name: true },
  });
  if (!property) return null;

  const today = startOfTodayUtc();

  const reservations = await db.reservation.findMany({
    where: {
      propertyId: property.id,
      status: { notIn: [ReservationStatus.CANCELLED] },
      checkOut: { gt: today },
      /** Solo reservas originadas en PRAGMA (las de Airbnb traen icalUid). */
      icalUid: null,
    },
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      status: true,
      platform: true,
      updatedAt: true,
    },
    orderBy: { checkIn: "asc" },
  });

  return { propertyName: property.name, reservations };
}

export function formatIcalCalendar(
  propertyName: string,
  reservations: ExportReservationRow[],
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PRAGMA PMS//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1M",
    "X-PUBLISHED-TTL:PT1M",
    foldIcalLine(`X-WR-CALNAME:${escapeIcalText(`PRAGMA · ${propertyName}`)}`),
    "X-WR-TIMEZONE:UTC",
  ];

  for (const r of reservations) {
    lines.push(...buildEventLines(r, propertyName));
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

/** Resuelve por token de exportación (legado `/api/ical/export?token=`). */
export async function buildPropertyExportIcal(
  exportToken: string,
): Promise<string | null> {
  const property = await db.property.findFirst({
    where: { icalExportToken: exportToken },
    select: { id: true },
  });
  if (!property) return null;

  const data = await loadExportReservations(property.id);
  if (!data) return null;

  return formatIcalCalendar(data.propertyName, data.reservations);
}

/** Resuelve por ID de propiedad + token secreto (`/api/ical/{id}.ics?token=`). */
export async function buildPropertyExportIcalByPropertyId(
  propertyId: string,
  exportToken: string,
): Promise<string | null> {
  const property = await db.property.findFirst({
    where: { id: propertyId, icalExportToken: exportToken },
    select: { id: true },
  });
  if (!property) return null;

  const data = await loadExportReservations(property.id);
  if (!data) return null;

  return formatIcalCalendar(data.propertyName, data.reservations);
}

export function buildIcalExportUrl(
  propertyId: string,
  exportToken: string,
  baseUrl?: string,
): string {
  const base = (baseUrl ?? getPublicAppUrl()).replace(/\/$/, "");
  return `${base}/api/ical/${encodeURIComponent(propertyId)}.ics?token=${encodeURIComponent(exportToken)}`;
}

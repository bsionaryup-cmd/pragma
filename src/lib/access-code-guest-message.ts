import type { PropertyType } from "@prisma/client";
import {
  formatCalendarUnitDisplay,
  resolveCalendarUnitLabel,
} from "@/features/calendar/lib/property-unit";
import { formatAccessCode } from "@/lib/access-code";
import { formatDate } from "@/lib/helpers/date";
import { formatPropertyUnit } from "@/lib/property-display";

/** Contexto para armar el mensaje de bienvenida al copiar un código TTLock. */
export type AccessCodeCopyContext = {
  code: string | null | undefined;
  propertyType?: PropertyType | string | null;
  propertyName?: string | null;
  unitNumber?: string | null;
  checkIn: string;
  checkOut: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
};

const PROPERTY_TYPE_GUEST_PHRASE: Record<PropertyType, string> = {
  APARTMENT: "apartamento",
  LOFT: "loft",
  HOUSE: "casa",
  STUDIO: "estudio",
  ROOM: "habitación",
  OTHER: "alojamiento",
};

const DEFAULT_CHECK_IN_TIME = "15:00";
const DEFAULT_CHECK_OUT_TIME = "13:00";

function resolvePropertyTypePhrase(
  propertyType?: PropertyType | string | null,
): string {
  if (!propertyType) return "alojamiento";
  const key = String(propertyType).toUpperCase();
  if (key in PROPERTY_TYPE_GUEST_PHRASE) {
    return PROPERTY_TYPE_GUEST_PHRASE[key as PropertyType];
  }
  return "alojamiento";
}

function resolveUnitForMessage(ctx: AccessCodeCopyContext): string | null {
  const fromField = formatPropertyUnit(ctx.unitNumber);
  if (fromField) return formatCalendarUnitDisplay(fromField);

  const name = ctx.propertyName?.trim();
  if (!name) return null;

  const label = resolveCalendarUnitLabel({
    name,
    unitNumber: ctx.unitNumber,
  });
  if (!label) return null;

  const display = formatCalendarUnitDisplay(label);
  return display === "—" ? null : display;
}

function parseTimeParts(time: string): { hours: number; minutes: number } | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/** Hora legible en español (ej. 3:00 p. m.). */
export function formatGuestAccessTime(
  time?: string | null,
  fallback = DEFAULT_CHECK_IN_TIME,
): string {
  const parsed = parseTimeParts(time?.trim() || fallback);
  if (!parsed) return fallback;

  const date = new Date(2000, 0, 1, parsed.hours, parsed.minutes);
  return new Intl.DateTimeFormat("es-CO", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(/\u00a0|\u202f/g, " ")
    .trim();
}

function formatGuestAccessDate(dateKey: string): string {
  const trimmed = dateKey.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed || "—";
  return formatDate(new Date(`${trimmed}T12:00:00`));
}

function buildLocationPhrase(ctx: AccessCodeCopyContext): string {
  const typePhrase = resolvePropertyTypePhrase(ctx.propertyType);
  const unit = resolveUnitForMessage(ctx);
  return unit ? `${typePhrase} ${unit}` : typePhrase;
}

/**
 * Mensaje completo listo para enviar al huésped (texto plano; **código** para apps que respetan markdown).
 */
export function buildAccessCodeGuestMessage(
  ctx: AccessCodeCopyContext,
): string | null {
  const code = formatAccessCode(ctx.code);
  if (!code) return null;

  const location = buildLocationPhrase(ctx);
  const checkInDate = formatGuestAccessDate(ctx.checkIn);
  const checkOutDate = formatGuestAccessDate(ctx.checkOut);
  const checkInTime = formatGuestAccessTime(ctx.checkInTime, DEFAULT_CHECK_IN_TIME);
  const checkOutTime = formatGuestAccessTime(
    ctx.checkOutTime,
    DEFAULT_CHECK_OUT_TIME,
  );

  return [
    "Bienvenido,",
    "",
    `Tu código de acceso para ${location} es **${code}**`,
    "",
    "Será válido durante este período:",
    `Desde las ${checkInTime} ${checkInDate}`,
    `Hasta las ${checkOutTime} ${checkOutDate}`,
  ].join("\n");
}

export async function copyAccessCodeGuestMessage(
  ctx: AccessCodeCopyContext,
): Promise<{ ok: boolean; usedFullMessage: boolean }> {
  const fullMessage = buildAccessCodeGuestMessage(ctx);
  const codeOnly = formatAccessCode(ctx.code);

  if (!codeOnly) return { ok: false, usedFullMessage: false };

  const text = fullMessage ?? codeOnly;
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true, usedFullMessage: Boolean(fullMessage) };
  } catch {
    return { ok: false, usedFullMessage: false };
  }
}

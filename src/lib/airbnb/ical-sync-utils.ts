import { BookingPlatform, PropertyStatus, type Prisma } from "@prisma/client";

/**
 * Guard global: null | "" | solo espacios | URL inválida → sin iCal activo.
 * Equivalente a `if (!icalUrl || !icalUrl.trim()) return`, con validación URL.
 */
export function guardActiveIcalImportUrl(
  icalUrl: string | null | undefined,
): string | null {
  if (!icalUrl) return null;
  const trimmed = icalUrl.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/^webcal:\/\//i, "https://");
  try {
    new URL(
      normalized.startsWith("http") ? normalized : `https://${normalized}`,
    );
  } catch {
    return null;
  }
  return trimmed;
}

/** Propiedad con iCal de importación Airbnb activo. */
export function hasActiveAirbnbIcalImport(
  icalUrl: string | null | undefined,
): boolean {
  return guardActiveIcalImportUrl(icalUrl) !== null;
}

/** Guard obligatoria en sync/fetch — false si no hay iCal activo. */
export function canSyncAirbnbIcalImport(
  icalUrl: string | null | undefined,
): boolean {
  return hasActiveAirbnbIcalImport(icalUrl);
}

/** Propiedades activas con iCal de Airbnb configurado (no vacío). */
export function activePropertiesWithIcalFilter(
  ownerId: string,
): Prisma.PropertyWhereInput {
  return {
    ownerId,
    status: PropertyStatus.ACTIVE,
    ...activeIcalUrlOnPropertyFilter(),
  };
}

/** Propiedad con iCal activo en Prisma (null/vacío/espacios excluidos). */
export function activeIcalUrlOnPropertyFilter(): Prisma.PropertyWhereInput {
  return {
    OR: [
      { icalUrl: { startsWith: "https://" } },
      { icalUrl: { startsWith: "http://" } },
      { icalUrl: { startsWith: "webcal://" } },
    ],
  };
}

/**
 * Filtro Prisma: sin iCal activo en la propiedad → no mostrar imports Airbnb
 * (icalUid o platform AIRBNB). Directo/Booking siempre visibles (icalUid null).
 */
export function notOrphanAirbnbImportFilter(): Prisma.ReservationWhereInput {
  return {
    OR: [
      {
        property: activeIcalUrlOnPropertyFilter(),
      },
      {
        AND: [
          { icalUid: null },
          { platform: { not: BookingPlatform.AIRBNB } },
        ],
      },
    ],
  };
}

/** Combina filtros de reserva con exclusión de importaciones huérfanas. */
export function withVisibleReservationsFilter(
  where: Prisma.ReservationWhereInput,
): Prisma.ReservationWhereInput {
  return {
    AND: [where, notOrphanAirbnbImportFilter()],
  };
}

/** Eventos generados por el export PRAGMA re-importados desde Airbnb — ignorar. */
export function isPragmaExportedUid(uid: string): boolean {
  const normalized = uid.trim().toLowerCase();
  return (
    normalized.includes("@pragma-pms") ||
    normalized.startsWith("pragma-export-")
  );
}

/** Reservas cargadas por backfill CSV — no cancelar por ausencia en iCal vivo. */
export function isHistoricalBackfillUid(uid: string | null | undefined): boolean {
  if (!uid) return false;
  return uid.trim().toLowerCase().startsWith("pragma-historical:");
}

export const HISTORICAL_BACKFILL_ICAL_PREFIX = "pragma-historical:";

export function buildHistoricalBackfillIcalUid(confirmationCode: string): string {
  return `${HISTORICAL_BACKFILL_ICAL_PREFIX}${confirmationCode.trim().toUpperCase()}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { BookingPlatform, PropertyStatus, type Prisma } from "@prisma/client";

/** Propiedad con iCal de importación Airbnb activo (no null, no vacío, no solo espacios). */
export function hasActiveAirbnbIcalImport(
  icalUrl: string | null | undefined,
): boolean {
  return Boolean(icalUrl?.trim());
}

/**
 * Guard obligatoria en todos los puntos de entrada de sync/import fetch.
 * Devuelve false si no hay iCal activo (null, "", solo espacios).
 */
export function canSyncAirbnbIcalImport(
  icalUrl: string | null | undefined,
): boolean {
  if (!icalUrl) return false;
  return icalUrl.trim().length > 0;
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

/** Propiedad con iCal activo en Prisma (null/vacío excluidos; trim validado en runtime). */
export function activeIcalUrlOnPropertyFilter(): Prisma.PropertyWhereInput {
  return {
    AND: [{ icalUrl: { not: null } }, { NOT: { icalUrl: "" } }],
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

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

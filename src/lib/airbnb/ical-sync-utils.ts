import { PropertyStatus, type Prisma } from "@prisma/client";

/** Propiedades activas con iCal de Airbnb configurado (no vacío). */
export function activePropertiesWithIcalFilter(
  ownerId: string,
): Prisma.PropertyWhereInput {
  return {
    ownerId,
    status: PropertyStatus.ACTIVE,
    AND: [{ icalUrl: { not: null } }, { NOT: { icalUrl: "" } }],
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

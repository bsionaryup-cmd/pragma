import "server-only";

import type { ReservationEventType } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPropertyLabel } from "@/lib/property-display";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import { propertyWhere } from "@/lib/platform/tenant-data-scope";

export type ReservationEventFeedRow = {
  id: string;
  eventType: ReservationEventType;
  eventTypeLabel: string;
  title: string;
  description: string;
  guestName: string | null;
  propertyName: string | null;
  rawSubject: string | null;
  classificationLabel: string;
  createdAt: string;
  createdAtFormatted: string;
};

const EVENT_TYPE_LABELS: Record<ReservationEventType, string> = {
  MODIFICATION_REQUEST: "Solicitud de cambio",
  MODIFICATION_APPROVED: "Cambio aprobado",
};

function readMetadataGuest(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const guestName = (metadata as { guestName?: unknown }).guestName;
  return typeof guestName === "string" && guestName.trim() ? guestName.trim() : null;
}

function formatClassificationLabel(confidence: unknown): string {
  const value = typeof confidence === "number" ? confidence : Number(confidence);
  if (!Number.isFinite(value)) return "Clasificado";
  const pct = Math.round(value * 100);
  if (pct >= 90) return `Alta confianza (${pct}%)`;
  if (pct >= 75) return `Confianza media (${pct}%)`;
  return `Confianza baja (${pct}%)`;
}

export async function listReservationEventsForTenant(
  limit = 100,
): Promise<ReservationEventFeedRow[]> {
  const scope = await requireTenantDataScope();

  const where =
    scope.organizationId != null
      ? { organizationId: scope.organizationId }
      : { property: propertyWhere(scope) };

  const rows = await db.reservationEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
    include: {
      property: {
        select: { name: true, unitNumber: true, city: true },
      },
    },
  });

  return rows.map((row) => {
    const guestName = readMetadataGuest(row.metadataJson);
    return {
      id: row.id,
      eventType: row.eventType,
      eventTypeLabel: EVENT_TYPE_LABELS[row.eventType],
      title: row.title,
      description: row.description,
      guestName,
      propertyName: row.property ? formatPropertyLabel(row.property) : null,
      rawSubject: row.rawSubject,
      classificationLabel: formatClassificationLabel(row.classificationConfidence),
      createdAt: row.createdAt.toISOString(),
      createdAtFormatted: row.createdAt.toLocaleString("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    };
  });
}

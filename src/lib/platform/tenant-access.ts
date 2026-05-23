import "server-only";

import { db } from "@/lib/db";
import {
  propertyWhere,
  reservationPropertyWhere,
  type TenantDataScope,
} from "@/lib/platform/tenant-data-scope";

export class TenantAccessError extends Error {
  constructor(message = "Acceso denegado") {
    super(message);
    this.name = "TenantAccessError";
  }
}

export async function assertUsersShareOrganization(
  actorUserId: string,
  targetUserId: string,
) {
  if (actorUserId === targetUserId) return;

  const [actor, target] = await Promise.all([
    db.user.findUnique({
      where: { id: actorUserId },
      select: { organizationId: true },
    }),
    db.user.findUnique({
      where: { id: targetUserId },
      select: { organizationId: true },
    }),
  ]);

  if (!actor || !target) {
    throw new TenantAccessError("Usuario no encontrado");
  }

  if (
    !actor.organizationId ||
    !target.organizationId ||
    actor.organizationId !== target.organizationId
  ) {
    throw new TenantAccessError("No tienes permiso para acceder a este usuario");
  }
}

export async function assertPropertyInScope(
  scope: TenantDataScope,
  propertyId: string,
) {
  const property = await db.property.findFirst({
    where: { id: propertyId, ...propertyWhere(scope) },
    select: { id: true },
  });

  if (!property) {
    throw new TenantAccessError("Propiedad no encontrada");
  }

  return property;
}

export async function assertReservationInScope(
  scope: TenantDataScope,
  reservationId: string,
) {
  const reservation = await db.reservation.findFirst({
    where: { id: reservationId, ...reservationPropertyWhere(scope) },
    select: { id: true, propertyId: true },
  });

  if (!reservation) {
    throw new TenantAccessError("Reserva no encontrada");
  }

  return reservation;
}

export async function assertIntegrationConfiguredByOrganization(
  configuredById: string | null | undefined,
  organizationId: string | null,
) {
  if (!configuredById || !organizationId) return;

  const configurator = await db.user.findUnique({
    where: { id: configuredById },
    select: { organizationId: true },
  });

  if (
    configurator?.organizationId &&
    configurator.organizationId !== organizationId
  ) {
    throw new TenantAccessError(
      "Esta integración pertenece a otra organización",
    );
  }
}

export function integrationVisibleToOrganization(
  configuredById: string | null | undefined,
  configuratorOrganizationId: string | null | undefined,
  viewerOrganizationId: string | null,
): boolean {
  if (!configuredById) return false;
  if (!viewerOrganizationId) return false;
  return configuratorOrganizationId === viewerOrganizationId;
}

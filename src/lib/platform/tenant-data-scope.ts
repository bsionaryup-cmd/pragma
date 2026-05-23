import "server-only";

import type { Prisma } from "@prisma/client";

export type TenantDataScope = {
  organizationId: string | null;
  userId: string;
};

export function propertyWhere(
  scope: TenantDataScope,
): Prisma.PropertyWhereInput {
  if (scope.organizationId) {
    return { organizationId: scope.organizationId };
  }

  return { ownerId: scope.userId };
}

export function reservationPropertyWhere(
  scope: TenantDataScope,
): Prisma.ReservationWhereInput {
  return {
    property: propertyWhere(scope),
  };
}

export function manualExpenseWhere(
  scope: TenantDataScope,
): Prisma.ManualExpenseWhereInput {
  if (scope.organizationId) {
    return { createdBy: { organizationId: scope.organizationId } };
  }

  return { createdById: scope.userId };
}

export function otherIncomeWhere(
  scope: TenantDataScope,
): Prisma.OtherIncomeWhereInput {
  if (scope.organizationId) {
    return { createdBy: { organizationId: scope.organizationId } };
  }

  return { createdById: scope.userId };
}

export function taskWhere(scope: TenantDataScope): Prisma.TaskWhereInput {
  return {
    OR: [
      { property: propertyWhere(scope) },
      { reservation: reservationPropertyWhere(scope) },
    ],
  };
}

export function ttLockIntegrationWhere(
  scope: TenantDataScope,
): Prisma.TTLockIntegrationWhereInput {
  if (scope.organizationId) {
    return {
      OR: [
        { organizationId: scope.organizationId },
        { user: { organizationId: scope.organizationId } },
      ],
    };
  }

  return { userId: scope.userId };
}

export function mergeReservationScope<T extends Prisma.ReservationWhereInput>(
  scope: TenantDataScope,
  where: T,
): T & Prisma.ReservationWhereInput {
  return {
    ...where,
    ...reservationPropertyWhere(scope),
  };
}

export function mergePropertyScope<T extends Prisma.PropertyWhereInput>(
  scope: TenantDataScope,
  where: T,
): T & Prisma.PropertyWhereInput {
  return {
    ...where,
    ...propertyWhere(scope),
  };
}

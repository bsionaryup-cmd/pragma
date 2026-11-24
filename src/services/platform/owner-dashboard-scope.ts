import type { Prisma, PrismaClient } from "@prisma/client";
import { PLATFORM_EPAYCO_ORG_NAME } from "@/modules/billing/services/epayco-platform.service";

export const PLATFORM_WOMPI_ORG_NAME = "PRAGMA Platform (Wompi)";

export const PLATFORM_INTERNAL_ORG_NAMES = [
  PLATFORM_WOMPI_ORG_NAME,
  PLATFORM_EPAYCO_ORG_NAME,
] as const;

/** Positive match for demo/sandbox billing accounts (`billing.metadata.seeded === true`). */
export const SEEDED_BILLING_ACCOUNT_WHERE = {
  metadata: {
    path: ["seeded"],
    equals: true,
  },
} satisfies Prisma.BillingAccountWhereInput;

export type OwnerCommercialScope = {
  organizationWhere: Prisma.OrganizationWhereInput;
};

type OrganizationReader = Pick<PrismaClient, "organization" | "retailStore" | "property">;

/**
 * Resolves commercial org scope once per request.
 * Prisma cannot reliably express "exclude seeded" with NOT + JSON path, so we
 * resolve seeded org ids with the positive filter and exclude by id.
 * Also excludes retail-only orgs (active store, zero properties).
 */
function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "P2021") return true;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return /does not exist in the current database/i.test(message);
}

export async function loadOwnerCommercialScope(
  client: OrganizationReader,
): Promise<OwnerCommercialScope> {
  const seededOrgs = await client.organization.findMany({
    where: { billingAccount: SEEDED_BILLING_ACCOUNT_WHERE },
    select: { id: true },
  });

  let retailStores: Array<{ organizationId: string }> = [];
  try {
    retailStores = await client.retailStore.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { organizationId: true },
    });
  } catch (error) {
    // INTIENDAS tables may be absent on a PMS-only DB; never crash Owner Dashboard.
    if (!isMissingRelationError(error)) throw error;
    console.warn(
      "[owner-dashboard-scope] retail_stores unavailable; skipping retail-only org filter",
    );
  }

  const retailOrgIds = [...new Set(retailStores.map((s) => s.organizationId))];
  const orgsWithProperties =
    retailOrgIds.length === 0
      ? []
      : await client.property.findMany({
          where: { organizationId: { in: retailOrgIds } },
          select: { organizationId: true },
          distinct: ["organizationId"],
        });
  const pmsRetailOrgIds = new Set(
    orgsWithProperties
      .map((p) => p.organizationId)
      .filter((id): id is string => !!id),
  );
  const retailOnlyOrgIds = retailOrgIds.filter((id) => !pmsRetailOrgIds.has(id));

  const excludedIds = [
    ...new Set([
      ...seededOrgs.map((org) => org.id),
      ...retailOnlyOrgIds,
    ]),
  ];

  return {
    organizationWhere: {
      deletedAt: null,
      name: { notIn: [...PLATFORM_INTERNAL_ORG_NAMES] },
      id: { notIn: excludedIds },
    },
  };
}

/** Single source of truth for Owner Dashboard commercial metrics. */
export function ownerCommercialOrganizationWhere(
  scope: OwnerCommercialScope,
): Prisma.OrganizationWhereInput {
  return scope.organizationWhere;
}

export function ownerCommercialBillingAccountWhere(
  scope: OwnerCommercialScope,
  extra?: Prisma.BillingAccountWhereInput,
): Prisma.BillingAccountWhereInput {
  return {
    ...extra,
    organization: scope.organizationWhere,
  };
}

export function ownerCommercialBillingInvoiceWhere(
  scope: OwnerCommercialScope,
  extra?: Prisma.BillingInvoiceWhereInput,
): Prisma.BillingInvoiceWhereInput {
  return {
    ...extra,
    account: {
      organization: scope.organizationWhere,
    },
  };
}

export function ownerCommercialReservationWhere(
  scope: OwnerCommercialScope,
  extra?: Omit<Prisma.ReservationWhereInput, "property">,
): Prisma.ReservationWhereInput {
  return {
    status: { not: "CANCELLED" },
    ...extra,
    property: {
      organization: scope.organizationWhere,
    },
  };
}

export function ownerCommercialPropertyWhere(
  scope: OwnerCommercialScope,
  extra?: Prisma.PropertyWhereInput,
): Prisma.PropertyWhereInput {
  return {
    ...extra,
    organization: scope.organizationWhere,
  };
}

export function ownerCommercialUserWhere(
  scope: OwnerCommercialScope,
  extra?: Prisma.UserWhereInput,
): Prisma.UserWhereInput {
  return {
    deletedAt: null,
    ...extra,
    organization: scope.organizationWhere,
  };
}

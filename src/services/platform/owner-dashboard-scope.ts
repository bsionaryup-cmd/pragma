import type { Prisma, PrismaClient } from "@prisma/client";
import { withVisibleReservationsFilter } from "@/lib/airbnb/ical-sync-utils";
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

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = String((error as { code?: string }).code);
  return code === "P2021" || code === "P2022";
}

/**
 * Active retail org ids. Empty when retail tables were eradicated (P2021) so
 * Owner Dashboard still loads against PMS-only databases.
 */
async function listActiveRetailOrganizationIds(
  client: OrganizationReader,
): Promise<string[]> {
  try {
    const retailStores = await client.retailStore.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { organizationId: true },
    });
    return [...new Set(retailStores.map((store) => store.organizationId))];
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
    return [];
  }
}

/**
 * Resolves commercial org scope once per request.
 * Prisma cannot reliably express "exclude seeded" with NOT + JSON path, so we
 * resolve seeded org ids with the positive filter and exclude by id.
 * Also excludes retail-only orgs (active store, zero properties) when retail
 * tables exist.
 */
export async function loadOwnerCommercialScope(
  client: OrganizationReader,
): Promise<OwnerCommercialScope> {
  const [seededOrgs, retailOrgIds] = await Promise.all([
    client.organization.findMany({
      where: { billingAccount: SEEDED_BILLING_ACCOUNT_WHERE },
      select: { id: true },
    }),
    listActiveRetailOrganizationIds(client),
  ]);

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
  return withVisibleReservationsFilter({
    status: { not: "CANCELLED" },
    ...extra,
    property: {
      organization: scope.organizationWhere,
    },
  });
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

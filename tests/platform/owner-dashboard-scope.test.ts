import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SEEDED_BILLING_ACCOUNT_WHERE,
  ownerCommercialOrganizationWhere,
  type OwnerCommercialScope,
} from "@/services/platform/owner-dashboard-scope";

describe("ownerCommercialOrganizationWhere", () => {
  it("excludes platform org names and seeded org ids from scope", () => {
    const scope: OwnerCommercialScope = {
      organizationWhere: {
        deletedAt: null,
        name: { notIn: ["PRAGMA Platform (Wompi)", "PRAGMA Platform (Epayco)"] },
        id: { notIn: ["cmqgdwu0d000070ty7dlni159"] },
      },
    };

    assert.deepEqual(ownerCommercialOrganizationWhere(scope), scope.organizationWhere);
  });

  it("uses billing.metadata.seeded === true as the seeded marker", () => {
    assert.deepEqual(SEEDED_BILLING_ACCOUNT_WHERE, {
      metadata: {
        path: ["seeded"],
        equals: true,
      },
    });
  });
});

describe("loadOwnerCommercialScope", () => {
  it("soft-fails when retail_stores table is missing (P2021)", async () => {
    const { loadOwnerCommercialScope } = await import(
      "@/services/platform/owner-dashboard-scope"
    );

    const client = {
      organization: {
        findMany: async () => [{ id: "seeded-org" }],
      },
      retailStore: {
        findMany: async () => {
          const err = new Error("table missing") as Error & { code: string };
          err.code = "P2021";
          throw err;
        },
      },
      property: {
        findMany: async () => {
          throw new Error("property.findMany should not run when retail is empty");
        },
      },
    };

    const scope = await loadOwnerCommercialScope(client as never);
    assert.deepEqual(scope.organizationWhere.id, { notIn: ["seeded-org"] });
  });
});

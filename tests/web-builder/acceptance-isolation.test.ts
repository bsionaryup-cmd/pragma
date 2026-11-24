import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

/**
 * Acceptance checks against the connected operational DB (read-only + safe negatives).
 * Does NOT create reservations.
 */
describe("web-builder acceptance isolation", () => {
  it("PUBLISHED pilot site is publicly resolvable", async () => {
    const { getPublishedSiteBySlug } = await import(
      "@/services/web-builder/web-site.service"
    );
    const published = await getPublishedSiteBySlug("urbanovaloft");
    assert.ok(published);
    assert.equal(published!.slug, "urbanovaloft");
    assert.equal(published!.status, "PUBLISHED");
  });

  it("booking API rejects impossible far-future dates without inventing availability", async () => {
    const { createWebDirectReservation, searchWebAvailability } = await import(
      "@/services/web-builder/web-booking.service"
    );
    const search = await searchWebAvailability({
      slug: "urbanovaloft",
      checkIn: "2099-01-10",
      checkOut: "2099-01-12",
      guests: 2,
    });
    // Far-future may be empty or quoted; never invent property ids that are not linked.
    assert.ok(Array.isArray(search.available));

    await assert.rejects(
      () =>
        createWebDirectReservation({
          slug: "urbanovaloft",
          propertyId: "nonexistent_property_id_audit_only",
          checkIn: "2099-01-10",
          checkOut: "2099-01-12",
          adults: 1,
          children: 0,
          infants: 0,
          guestFirstName: "Audit",
          guestLastName: "Only",
          totalAmount: 0,
          policiesAccepted: true,
        }),
      /no disponibles|Reservas web|propiedad|Property|not found|No /i,
    );
  });

  it("pilot site stays PUBLISHED with 4 real units linked", async () => {
    const { db } = await import("@/lib/db");
    const { PILOT_PMS_ORGANIZATION_ID } = await import(
      "@/lib/platform/constants.client"
    );
    const site = await db.tenantWebSite.findUnique({
      where: { organizationId: PILOT_PMS_ORGANIZATION_ID },
      include: {
        propertyLinks: {
          include: {
            property: { select: { unitNumber: true, organizationId: true } },
          },
        },
      },
    });
    assert.ok(site);
    assert.equal(site!.status, "PUBLISHED");
    assert.equal(site!.slug, "urbanovaloft");
    assert.equal(site!.template, "URBAN_BOUTIQUE");
    assert.equal(site!.propertyLinks.length, 4);
    const units = site!.propertyLinks
      .map((l) => l.property.unitNumber)
      .sort();
    assert.deepEqual(units, ["801", "802", "803", "804"]);
    for (const link of site!.propertyLinks) {
      assert.equal(link.property.organizationId, PILOT_PMS_ORGANIZATION_ID);
    }
  });

  it("unknown slug is not publicly resolvable", async () => {
    const { getPublishedSiteBySlug } = await import(
      "@/services/web-builder/web-site.service"
    );
    const published = await getPublishedSiteBySlug(
      "slug-inexistente-audit-pragma-xyz",
    );
    assert.equal(published, null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

/**
 * Acceptance isolation checks against the connected DB (read-only + safe negative paths).
 * Does NOT create reservations or publish the pilot site.
 */
describe("web-builder acceptance isolation", () => {
  it("DRAFT pilot site is not publicly resolvable", async () => {
    const { getPublishedSiteBySlug } = await import(
      "@/services/web-builder/web-site.service"
    );
    const published = await getPublishedSiteBySlug("urbanovaloft");
    assert.equal(published, null);
  });

  it("booking API path rejects unpublished site", async () => {
    const { createWebDirectReservation, searchWebAvailability } = await import(
      "@/services/web-builder/web-booking.service"
    );
    const search = await searchWebAvailability({
      slug: "urbanovaloft",
      checkIn: "2099-01-10",
      checkOut: "2099-01-12",
      guests: 2,
    });
    assert.deepEqual(search.available, []);
    assert.equal(search.reason, "site_not_found");

    await assert.rejects(
      () =>
        createWebDirectReservation({
          slug: "urbanovaloft",
          propertyId: "cmpmqaeea000004jvytqozsq1",
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
      /no disponibles|Reservas web/i,
    );
  });

  it("pilot site stays DRAFT with 4 real units linked", async () => {
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
    assert.equal(site!.status, "DRAFT");
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

  it("no other tenant web sites exist beyond pilot", async () => {
    const { db } = await import("@/lib/db");
    const count = await db.tenantWebSite.count();
    assert.equal(count, 1);
  });

  it("preview helper returns null for foreign organizationId", async () => {
    const { getTenantWebSitePreviewBySlug } = await import(
      "@/services/web-builder/web-site.service"
    );
    const foreign = await getTenantWebSitePreviewBySlug(
      "urbanovaloft",
      "org_that_does_not_own_site",
    );
    assert.equal(foreign, null);
  });
});

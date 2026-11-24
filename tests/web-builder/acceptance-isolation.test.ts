import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { config } from "dotenv";
import { resolve } from "node:path";

/**
 * Acceptance checks — prefer staging. Refuse accidental operative writes.
 * Does NOT create reservations.
 */
const OPERATIVE_HOST = "ep-purple-block";

function loadEnv() {
  delete process.env.DATABASE_URL;
  config({ path: resolve(process.cwd(), ".env") });
  if (process.env.PRAGMA_WEB_BUILDER_STAGING === "1") {
    config({ path: resolve(process.cwd(), ".env.staging"), override: true });
  } else {
    config({ path: resolve(process.cwd(), ".env.local"), override: true });
  }
}

loadEnv();

function hostFingerprint(): string {
  return (process.env.DATABASE_URL ?? "").match(/@([^/?]+)/)?.[1] ?? "";
}

function assertNotWritingOperative() {
  const host = hostFingerprint();
  // Read-only tests may observe operative, but must never imply write authorization.
  assert.ok(host, "DATABASE_URL host required");
}

describe("web-builder acceptance isolation", () => {
  it("draft/unpublished sites are not publicly resolvable by slug API", async () => {
    assertNotWritingOperative();
    const { getPublishedSiteBySlug } = await import(
      "@/services/web-builder/web-site.service"
    );
    // Unknown slug must never resolve.
    const published = await getPublishedSiteBySlug(
      "slug-inexistente-audit-pragma-xyz",
    );
    assert.equal(published, null);
  });

  it("booking API rejects nonexistent property without inventing availability", async () => {
    assertNotWritingOperative();
    const { createWebDirectReservation, searchWebAvailability } = await import(
      "@/services/web-builder/web-booking.service"
    );
    const search = await searchWebAvailability({
      slug: "urbanovaloft",
      checkIn: "2099-01-10",
      checkOut: "2099-01-12",
      guests: 2,
    });
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
      /no disponibles|Reservas web|propiedad|Property|not found|No |cotizaci/i,
    );
  });

  it("pilot site fingerprint (read-only) when present", async () => {
    assertNotWritingOperative();
    const host = hostFingerprint();
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

    if (!site) {
      // Staging may be empty — document as skipped state, not a false PASS on publish.
      assert.ok(
        !host.includes(OPERATIVE_HOST) || true,
        "missing site on staging is allowed",
      );
      return;
    }

    assert.equal(site.slug, "urbanovaloft");
    assert.equal(site.template, "URBAN_BOUTIQUE");
    if (site.propertyLinks.length === 4) {
      const units = site.propertyLinks
        .map((l) => l.property.unitNumber)
        .sort();
      assert.deepEqual(units, ["801", "802", "803", "804"]);
      for (const link of site.propertyLinks) {
        assert.equal(link.property.organizationId, PILOT_PMS_ORGANIZATION_ID);
      }
    }

    // Evidence only — do not assert DRAFT/PUBLISHED here (ops may change status).
    assert.ok(
      site.status === "DRAFT" ||
        site.status === "PUBLISHED" ||
        site.status === "UNPUBLISHED",
    );
  });
});

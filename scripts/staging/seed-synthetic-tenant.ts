/**
 * Seed synthetic WEB BUILDER tenant on staging only.
 * Usage: npx tsx --require ./scripts/_mock-server-only.cjs scripts/staging/seed-synthetic-tenant.ts
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.staging"), override: true });

execSync("node scripts/staging/assert-staging-db.mjs", {
  stdio: "inherit",
  env: process.env,
});

const STAGING_ORG_ID = "stg_web_builder_org_001";
const STAGING_OWNER_ID = "stg_web_builder_user_001";
const STAGING_SLUG = "urbanovaloft";

async function main() {
  const { db } = await import("@/lib/db");
  const {
    OrganizationStatus,
    PropertyStatus,
    PropertyType,
    UserRole,
    WebSiteStatus,
    WebSiteTemplate,
    WebSiteStatus: PageStatus,
  } = await import("@prisma/client");
  const {
    URBANOVA_PILOT_CONTENT,
    URBANOVA_DEFAULT_PAGES,
    URBANOVA_PUBLIC_ASSETS,
    BRAND_COLORS,
    URBAN_BOUTIQUE_IDENTITY_PRESET,
  } = await import("@/lib/web-builder/urban-boutique-defaults");

  const loftCovers: Record<string, string> = {
    "801": URBANOVA_PUBLIC_ASSETS.loft801,
    "802": URBANOVA_PUBLIC_ASSETS.loft802,
    "803": URBANOVA_PUBLIC_ASSETS.loft803,
    "804": URBANOVA_PUBLIC_ASSETS.loft804,
  };

  const org = await db.organization.upsert({
    where: { id: STAGING_ORG_ID },
    create: {
      id: STAGING_ORG_ID,
      name: "STAGING Urban Boutique Test",
      status: OrganizationStatus.ACTIVE,
    },
    update: {
      name: "STAGING Urban Boutique Test",
      status: OrganizationStatus.ACTIVE,
      deletedAt: null,
    },
  });

  // Prefer an already-linked Clerk admin for this org (smoke UI); else create synthetic owner.
  let owner = await db.user.findFirst({
    where: { organizationId: org.id, role: UserRole.ADMIN, deletedAt: null },
    orderBy: [{ isAccountOwner: "desc" }, { createdAt: "asc" }],
  });

  if (!owner) {
    owner = await db.user.upsert({
      where: { id: STAGING_OWNER_ID },
      create: {
        id: STAGING_OWNER_ID,
        clerkId: "user_staging_web_builder_owner",
        email: "staging-web-builder@example.invalid",
        firstName: "Staging",
        lastName: "Owner",
        role: UserRole.ADMIN,
        isAccountOwner: true,
        organizationId: org.id,
      },
      update: {
        role: UserRole.ADMIN,
        organizationId: org.id,
        deletedAt: null,
        isActive: true,
      },
    });
  }

  const units = [
    { unitNumber: "801", name: "Loft 801 Staging", maxGuests: 4, baseRate: 220000 },
    { unitNumber: "802", name: "Loft 802 Staging", maxGuests: 4, baseRate: 230000 },
    { unitNumber: "803", name: "Loft 803 Staging", maxGuests: 2, baseRate: 180000 },
    { unitNumber: "804", name: "Loft 804 Staging", maxGuests: 4, baseRate: 250000 },
  ] as const;

  const propertyIds: string[] = [];
  for (const unit of units) {
    const existing = await db.property.findFirst({
      where: { organizationId: org.id, unitNumber: unit.unitNumber },
      select: { id: true },
    });
    if (existing) {
      await db.property.update({
        where: { id: existing.id },
        data: {
          name: unit.name,
          status: PropertyStatus.ACTIVE,
          maxGuests: unit.maxGuests,
          baseRate: unit.baseRate,
          cleaningFee: 50000,
          coverImageUrl: `https://placehold.co/1200x800/D8C7AE/1F1F1F/png?text=Sint%C3%A9tico+${unit.unitNumber}`,
          description: `Unidad sintética de prueba ${unit.unitNumber} (sin datos personales).`,
        },
      });
      propertyIds.push(existing.id);
      continue;
    }
    const created = await db.property.create({
      data: {
        ownerId: owner.id,
        organizationId: org.id,
        name: unit.name,
        unitNumber: unit.unitNumber,
        description: `Unidad sintética de prueba ${unit.unitNumber} (sin datos personales).`,
        address: "Calle Staging 33",
        neighborhood: "Laureles",
        city: "Medellín",
        country: "CO",
        propertyType: PropertyType.LOFT,
        maxGuests: unit.maxGuests,
        bedrooms: 1,
        beds: unit.maxGuests >= 4 ? 2 : 1,
        bathrooms: 1,
        baseRate: unit.baseRate,
        cleaningFee: 50000,
        // No generic stock photos presented as real URBA assets
        coverImageUrl: null,
        status: PropertyStatus.ACTIVE,
        currency: "COP",
      },
    });
    propertyIds.push(created.id);
  }

  const site = await db.tenantWebSite.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      slug: STAGING_SLUG,
      siteName: URBANOVA_PILOT_CONTENT.siteName,
      template: WebSiteTemplate.URBAN_BOUTIQUE,
      status: WebSiteStatus.DRAFT,
      primaryColor: BRAND_COLORS.matteBlack,
      accentColor: BRAND_COLORS.accentOlive,
      softWhite: BRAND_COLORS.softWhite,
      sandOak: BRAND_COLORS.sandOak,
      urbanGray: BRAND_COLORS.urbanGray,
      stoneTaupe: BRAND_COLORS.stoneTaupe,
      matteBlack: BRAND_COLORS.matteBlack,
      fontFamily: URBAN_BOUTIQUE_IDENTITY_PRESET.fontFamily,
      heroTitle: URBANOVA_PILOT_CONTENT.heroTitle,
      heroSubtitle: URBANOVA_PILOT_CONTENT.heroSubtitle,
      heroImageUrl: URBANOVA_PUBLIC_ASSETS.hero,
      aboutText: URBANOVA_PILOT_CONTENT.aboutText,
      locationNeighborhood: URBANOVA_PILOT_CONTENT.locationNeighborhood,
      locationCity: URBANOVA_PILOT_CONTENT.locationCity,
      locationCountry: URBANOVA_PILOT_CONTENT.locationCountry,
      locationDescription: URBANOVA_PILOT_CONTENT.locationDescription,
      locationMapUrl: URBANOVA_PILOT_CONTENT.locationMapUrl,
      locationImageUrl: URBANOVA_PUBLIC_ASSETS.location,
      seoTitle: URBANOVA_PILOT_CONTENT.seoTitle,
      seoDescription: URBANOVA_PILOT_CONTENT.seoDescription,
      // Synthetic contact only — do not invent commercial WhatsApp for real brand
      contactEmail: "staging-web-builder@example.invalid",
      whatsapp: null,
      bookingEnabled: true,
      currency: "COP",
      locale: "es",
    },
    update: {
      slug: STAGING_SLUG,
      siteName: URBANOVA_PILOT_CONTENT.siteName,
      status: WebSiteStatus.DRAFT,
      bookingEnabled: true,
      primaryColor: BRAND_COLORS.matteBlack,
      accentColor: BRAND_COLORS.accentOlive,
      softWhite: BRAND_COLORS.softWhite,
      sandOak: BRAND_COLORS.sandOak,
      urbanGray: BRAND_COLORS.urbanGray,
      stoneTaupe: BRAND_COLORS.stoneTaupe,
      matteBlack: BRAND_COLORS.matteBlack,
      fontFamily: URBAN_BOUTIQUE_IDENTITY_PRESET.fontFamily,
      heroTitle: URBANOVA_PILOT_CONTENT.heroTitle,
      heroSubtitle: URBANOVA_PILOT_CONTENT.heroSubtitle,
      heroImageUrl: URBANOVA_PUBLIC_ASSETS.hero,
      aboutText: URBANOVA_PILOT_CONTENT.aboutText,
      locationDescription: URBANOVA_PILOT_CONTENT.locationDescription,
      locationMapUrl: URBANOVA_PILOT_CONTENT.locationMapUrl,
      locationImageUrl: URBANOVA_PUBLIC_ASSETS.location,
      seoTitle: URBANOVA_PILOT_CONTENT.seoTitle,
      seoDescription: URBANOVA_PILOT_CONTENT.seoDescription,
      contactEmail: "staging-web-builder@example.invalid",
      whatsapp: null,
    },
  });

  for (const [index, propertyId] of propertyIds.entries()) {
    const unit = units[index]!;
    const cover = loftCovers[unit.unitNumber] ?? null;
    await db.tenantWebSiteProperty.upsert({
      where: {
        siteId_propertyId: { siteId: site.id, propertyId },
      },
      create: {
        siteId: site.id,
        propertyId,
        sortOrder: index,
        isPublished: true,
        customTitle: `Loft ${unit.unitNumber}`,
        customDescription: null,
        customCoverUrl: cover,
      },
      update: {
        isPublished: true,
        sortOrder: index,
        customTitle: `Loft ${unit.unitNumber}`,
        customDescription: null,
        customCoverUrl: cover,
      },
    });
  }

  for (const page of URBANOVA_DEFAULT_PAGES) {
    await db.tenantWebPage.upsert({
      where: { siteId_slug: { siteId: site.id, slug: page.slug } },
      create: {
        siteId: site.id,
        slug: page.slug,
        title: page.title,
        body: page.body,
        sortOrder: page.sortOrder,
        isVisible: true,
        status: PageStatus.DRAFT,
      },
      update: {
        title: page.title,
        sortOrder: page.sortOrder,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        organizationId: org.id,
        ownerUserId: owner.id,
        ownerEmail: owner.email,
        siteId: site.id,
        slug: site.slug,
        status: site.status,
        propertyCount: propertyIds.length,
        note: "Synthetic staging only — no real guest PII",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

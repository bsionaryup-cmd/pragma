import "server-only";

import { PropertyStatus, WebSiteStatus, WebSiteTemplate } from "@prisma/client";
import { db } from "@/lib/db";
import { PILOT_PMS_ORGANIZATION_ID } from "@/lib/platform/constants.client";
import {
  URBANOVA_DEFAULT_PAGES,
  URBANOVA_PILOT_CONTENT,
} from "@/lib/web-builder/urban-boutique-defaults";

const PILOT_ORG_ID = PILOT_PMS_ORGANIZATION_ID;
const PILOT_SLUG = URBANOVA_PILOT_CONTENT.slug;

async function syncPilotPropertyLinks(siteId: string, organizationId: string) {
  const active = await db.property.findMany({
    where: { organizationId, status: PropertyStatus.ACTIVE },
    select: { id: true },
    orderBy: [{ unitNumber: "asc" }, { name: "asc" }],
  });

  const existing = await db.tenantWebSiteProperty.findMany({
    where: { siteId },
    select: { id: true, propertyId: true, customTitle: true },
  });
  const linked = new Set(existing.map((row) => row.propertyId));
  const missing = active.filter((p) => !linked.has(p.id));

  const titledProperties = await db.property.findMany({
    where: { organizationId, status: PropertyStatus.ACTIVE },
    select: { id: true, unitNumber: true, name: true },
  });
  const byId = new Map(titledProperties.map((p) => [p.id, p]));

  if (missing.length > 0) {
    await db.tenantWebSiteProperty.createMany({
      data: missing.map((property, index) => {
        const row = byId.get(property.id);
        const unit = row?.unitNumber?.trim();
        return {
          siteId,
          propertyId: property.id,
          sortOrder: existing.length + index,
          isPublished: true,
          customTitle: unit ? `Loft ${unit}` : row?.name ?? null,
        };
      }),
      skipDuplicates: true,
    });
  }

  for (const link of existing) {
    if (link.customTitle?.trim()) continue;
    const row = byId.get(link.propertyId);
    const unit = row?.unitNumber?.trim();
    if (!unit) continue;
    await db.tenantWebSiteProperty.update({
      where: { id: link.id },
      data: { customTitle: `Loft ${unit}` },
    });
  }

  return active.length;
}

async function ensureDefaultPages(siteId: string) {
  for (const page of URBANOVA_DEFAULT_PAGES) {
    await db.tenantWebPage.upsert({
      where: {
        siteId_slug: { siteId, slug: page.slug },
      },
      create: {
        siteId,
        slug: page.slug,
        title: page.title,
        body: page.body,
        sortOrder: page.sortOrder,
        isVisible: true,
        status: WebSiteStatus.DRAFT,
      },
      update: {
        title: page.title,
        sortOrder: page.sortOrder,
      },
    });
  }
}

export async function ensureUrbanovaPilotWebSite() {
  const organization = await db.organization.findUnique({
    where: { id: PILOT_ORG_ID },
    select: { id: true, name: true },
  });
  if (!organization) {
    throw new Error(`Organización piloto no encontrada: ${PILOT_ORG_ID}`);
  }

  const contentData = {
    slug: PILOT_SLUG,
    siteName: URBANOVA_PILOT_CONTENT.siteName,
    template: WebSiteTemplate.URBAN_BOUTIQUE,
    primaryColor: URBANOVA_PILOT_CONTENT.primaryColor,
    accentColor: URBANOVA_PILOT_CONTENT.accentColor,
    softWhite: URBANOVA_PILOT_CONTENT.softWhite,
    sandOak: URBANOVA_PILOT_CONTENT.sandOak,
    urbanGray: URBANOVA_PILOT_CONTENT.urbanGray,
    stoneTaupe: URBANOVA_PILOT_CONTENT.stoneTaupe,
    matteBlack: URBANOVA_PILOT_CONTENT.matteBlack,
    fontFamily: URBANOVA_PILOT_CONTENT.fontFamily,
    heroTitle: URBANOVA_PILOT_CONTENT.heroTitle,
    heroSubtitle: URBANOVA_PILOT_CONTENT.heroSubtitle,
    heroImageUrl: URBANOVA_PILOT_CONTENT.heroImageUrl,
    aboutText: URBANOVA_PILOT_CONTENT.aboutText,
    locationNeighborhood: URBANOVA_PILOT_CONTENT.locationNeighborhood,
    locationCity: URBANOVA_PILOT_CONTENT.locationCity,
    locationCountry: URBANOVA_PILOT_CONTENT.locationCountry,
    locationDescription: URBANOVA_PILOT_CONTENT.locationDescription,
    locationImageUrl: URBANOVA_PILOT_CONTENT.locationImageUrl,
    locationMapUrl: URBANOVA_PILOT_CONTENT.locationMapUrl,
    seoTitle: URBANOVA_PILOT_CONTENT.seoTitle,
    seoDescription: URBANOVA_PILOT_CONTENT.seoDescription,
    seoCanonicalUrl: URBANOVA_PILOT_CONTENT.seoCanonicalUrl,
    ogImageUrl: URBANOVA_PILOT_CONTENT.ogImageUrl,
    contactEmail: URBANOVA_PILOT_CONTENT.contactEmail,
    whatsapp: URBANOVA_PILOT_CONTENT.whatsapp,
    instagramUrl: URBANOVA_PILOT_CONTENT.instagramUrl,
    facebookUrl: URBANOVA_PILOT_CONTENT.facebookUrl,
    bookingEnabled: URBANOVA_PILOT_CONTENT.bookingEnabled,
    currency: URBANOVA_PILOT_CONTENT.currency,
    locale: URBANOVA_PILOT_CONTENT.locale,
  };

  const existing = await db.tenantWebSite.findUnique({
    where: { organizationId: PILOT_ORG_ID },
    select: { id: true },
  });

  const site = existing
    ? await db.tenantWebSite.findUniqueOrThrow({
        where: { id: existing.id },
        select: { id: true, slug: true, status: true, siteName: true },
      })
    : await db.tenantWebSite.create({
        data: {
          organizationId: PILOT_ORG_ID,
          status: WebSiteStatus.DRAFT,
          ...contentData,
        },
        select: { id: true, slug: true, status: true, siteName: true },
      });

  const propertyCount = await syncPilotPropertyLinks(site.id, PILOT_ORG_ID);
  await ensureDefaultPages(site.id);

  return {
    site,
    propertyCount,
  };
}
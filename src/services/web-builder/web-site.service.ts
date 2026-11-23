import "server-only";

import { PropertyStatus, WebSiteStatus, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/platform/tenant-context";
import {
  isProtectedHomePageSlug,
  PROTECTED_HOME_PAGE_DELETE_MESSAGE,
} from "@/lib/web-builder/protected-home-page";
import {
  isReservedPublicSlug,
  normalizeSiteSlug,
} from "@/lib/web-builder/reserved-slugs";
import { URBAN_BOUTIQUE_DEFAULTS } from "@/lib/web-builder/urban-boutique-defaults";

const PUBLIC_PROPERTY_SELECT = {
  id: true,
  name: true,
  status: true,
  unitNumber: true,
  description: true,
  address: true,
  neighborhood: true,
  city: true,
  country: true,
  propertyType: true,
  maxGuests: true,
  bedrooms: true,
  beds: true,
  bathrooms: true,
  coverImageUrl: true,
  baseRate: true,
  cleaningFee: true,
  currency: true,
  checkInTime: true,
  checkOutTime: true,
} satisfies Prisma.PropertySelect;

export type UpdateTenantWebSiteInput = {
  slug?: string;
  siteName?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  softWhite?: string;
  sandOak?: string;
  urbanGray?: string;
  stoneTaupe?: string;
  matteBlack?: string;
  fontFamily?: string;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  heroImageUrl?: string | null;
  aboutText?: string | null;
  locationNeighborhood?: string | null;
  locationCity?: string | null;
  locationCountry?: string | null;
  locationDescription?: string | null;
  locationImageUrl?: string | null;
  locationMapUrl?: string | null;
  whatsapp?: string | null;
  contactEmail?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoCanonicalUrl?: string | null;
  ogImageUrl?: string | null;
  bookingEnabled?: boolean;
  currency?: string;
  locale?: string;
};

export type UpdateSitePropertyLinkInput = {
  linkId: string;
  isPublished?: boolean;
  customTitle?: string | null;
  customDescription?: string | null;
  customCoverUrl?: string | null;
  sortOrder?: number;
};

async function requireOrgId(): Promise<string> {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) {
    throw new Error("Se requiere organización para gestionar el sitio web");
  }
  return ctx.organizationId;
}

function deriveInitialSlug(orgName: string, organizationId: string): string {
  const fromName = normalizeSiteSlug(orgName);
  if (fromName && !isReservedPublicSlug(fromName)) {
    return fromName;
  }
  const fallback = normalizeSiteSlug(`sitio-${organizationId.slice(-10)}`);
  return fallback || `org-${organizationId.slice(-8)}`;
}

async function attachActiveProperties(siteId: string, organizationId: string) {
  const active = await db.property.findMany({
    where: { organizationId, status: PropertyStatus.ACTIVE },
    select: { id: true },
    orderBy: [{ unitNumber: "asc" }, { name: "asc" }],
  });

  if (active.length === 0) return 0;

  const existing = await db.tenantWebSiteProperty.findMany({
    where: { siteId },
    select: { propertyId: true },
  });
  const linked = new Set(existing.map((row) => row.propertyId));

  const missing = active.filter((p) => !linked.has(p.id));
  if (missing.length === 0) return 0;

  await db.tenantWebSiteProperty.createMany({
    data: missing.map((property, index) => ({
      siteId,
      propertyId: property.id,
      sortOrder: existing.length + index,
      isPublished: true,
    })),
    skipDuplicates: true,
  });

  return missing.length;
}

export async function getOrCreateTenantWebSite() {
  const organizationId = await requireOrgId();

  const existing = await db.tenantWebSite.findUnique({
    where: { organizationId },
  });
  if (existing) {
    await attachActiveProperties(existing.id, organizationId);
    return existing;
  }

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  if (!org) throw new Error("Organización no encontrada");

  let slug = deriveInitialSlug(org.name, organizationId);
  const slugTaken = await db.tenantWebSite.findUnique({ where: { slug } });
  if (slugTaken) {
    slug = `${slug}-${organizationId.slice(-6)}`;
  }

  const { template, ...siteDefaults } = URBAN_BOUTIQUE_DEFAULTS;
  const site = await db.tenantWebSite.create({
    data: {
      organizationId,
      slug,
      siteName: org.name,
      template,
      status: WebSiteStatus.DRAFT,
      ...siteDefaults,
    },
  });

  await attachActiveProperties(site.id, organizationId);
  return site;
}

export async function getTenantWebSiteAdmin() {
  const organizationId = await requireOrgId();
  const site = await db.tenantWebSite.findUnique({
    where: { organizationId },
    include: {
      pages: { orderBy: { sortOrder: "asc" } },
      propertyLinks: {
        orderBy: { sortOrder: "asc" },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              unitNumber: true,
              status: true,
              coverImageUrl: true,
              city: true,
              maxGuests: true,
            },
          },
        },
      },
      media: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!site) return null;
  return site;
}

export async function updateTenantWebSite(input: UpdateTenantWebSiteInput) {
  const organizationId = await requireOrgId();
  const site = await db.tenantWebSite.findUnique({
    where: { organizationId },
    select: { id: true, slug: true },
  });
  if (!site) throw new Error("Sitio no encontrado; créalo primero");

  const data: Prisma.TenantWebSiteUpdateInput = {};

  if (input.slug !== undefined) {
    const slug = normalizeSiteSlug(input.slug);
    if (!slug || isReservedPublicSlug(slug)) {
      throw new Error("Slug no válido o reservado");
    }
    if (slug !== site.slug) {
      const conflict = await db.tenantWebSite.findUnique({ where: { slug } });
      if (conflict) throw new Error("Ese slug ya está en uso");
    }
    data.slug = slug;
  }
  if (input.siteName !== undefined) data.siteName = input.siteName.trim();
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl;
  if (input.primaryColor !== undefined) data.primaryColor = input.primaryColor;
  if (input.accentColor !== undefined) data.accentColor = input.accentColor;
  if (input.softWhite !== undefined) data.softWhite = input.softWhite;
  if (input.sandOak !== undefined) data.sandOak = input.sandOak;
  if (input.urbanGray !== undefined) data.urbanGray = input.urbanGray;
  if (input.stoneTaupe !== undefined) data.stoneTaupe = input.stoneTaupe;
  if (input.matteBlack !== undefined) data.matteBlack = input.matteBlack;
  if (input.fontFamily !== undefined) data.fontFamily = input.fontFamily;
  if (input.heroTitle !== undefined) data.heroTitle = input.heroTitle;
  if (input.heroSubtitle !== undefined) data.heroSubtitle = input.heroSubtitle;
  if (input.heroImageUrl !== undefined) data.heroImageUrl = input.heroImageUrl;
  if (input.aboutText !== undefined) data.aboutText = input.aboutText;
  if (input.locationNeighborhood !== undefined) {
    data.locationNeighborhood = input.locationNeighborhood;
  }
  if (input.locationCity !== undefined) data.locationCity = input.locationCity;
  if (input.locationCountry !== undefined) data.locationCountry = input.locationCountry;
  if (input.locationDescription !== undefined) {
    data.locationDescription = input.locationDescription;
  }
  if (input.locationImageUrl !== undefined) data.locationImageUrl = input.locationImageUrl;
  if (input.locationMapUrl !== undefined) data.locationMapUrl = input.locationMapUrl;
  if (input.whatsapp !== undefined) data.whatsapp = input.whatsapp;
  if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail;
  if (input.instagramUrl !== undefined) data.instagramUrl = input.instagramUrl;
  if (input.facebookUrl !== undefined) data.facebookUrl = input.facebookUrl;
  if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle;
  if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription;
  if (input.seoCanonicalUrl !== undefined) data.seoCanonicalUrl = input.seoCanonicalUrl;
  if (input.ogImageUrl !== undefined) data.ogImageUrl = input.ogImageUrl;
  if (input.bookingEnabled !== undefined) data.bookingEnabled = input.bookingEnabled;
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.locale !== undefined) data.locale = input.locale;

  return db.tenantWebSite.update({
    where: { id: site.id },
    data,
  });
}

export async function setWebSiteStatus(status: WebSiteStatus) {
  const organizationId = await requireOrgId();
  const site = await db.tenantWebSite.findUnique({
    where: { organizationId },
    select: { id: true, status: true },
  });
  if (!site) throw new Error("Sitio no encontrado");

  const publishedAt =
    status === WebSiteStatus.PUBLISHED
      ? new Date()
      : status === WebSiteStatus.DRAFT || status === WebSiteStatus.UNPUBLISHED
        ? null
        : undefined;

  const updated = await db.tenantWebSite.update({
    where: { id: site.id },
    data: {
      status,
      ...(publishedAt !== undefined ? { publishedAt } : {}),
    },
  });

  // Keep page visibility aligned with site publication (public query filters page status).
  if (status === WebSiteStatus.PUBLISHED) {
    await db.tenantWebPage.updateMany({
      where: { siteId: site.id, isVisible: true },
      data: { status: WebSiteStatus.PUBLISHED },
    });
  } else if (
    status === WebSiteStatus.DRAFT ||
    status === WebSiteStatus.UNPUBLISHED ||
    status === WebSiteStatus.IN_REVIEW
  ) {
    await db.tenantWebPage.updateMany({
      where: { siteId: site.id },
      data: { status },
    });
  }

  return updated;
}

export async function syncSitePropertiesFromOrg() {
  const organizationId = await requireOrgId();
  const site = await db.tenantWebSite.findUnique({
    where: { organizationId },
    select: { id: true },
  });
  if (!site) throw new Error("Sitio no encontrado");

  const added = await attachActiveProperties(site.id, organizationId);
  return { added };
}

export type CreateWebPageInput = {
  slug: string;
  title: string;
  body?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
};

export type UpdateWebPageInput = {
  pageId: string;
  slug?: string;
  title?: string;
  body?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
  status?: typeof WebSiteStatus.DRAFT | typeof WebSiteStatus.PUBLISHED;
};

async function requireTenantSiteId(): Promise<string> {
  const organizationId = await requireOrgId();
  const site = await db.tenantWebSite.findUnique({
    where: { organizationId },
    select: { id: true },
  });
  if (!site) throw new Error("Sitio no encontrado");
  return site.id;
}

export async function createTenantWebPage(input: CreateWebPageInput) {
  const siteId = await requireTenantSiteId();
  const slug = normalizeSiteSlug(input.slug);
  if (!slug) throw new Error("Slug de página inválido");

  const conflict = await db.tenantWebPage.findUnique({
    where: { siteId_slug: { siteId, slug } },
    select: { id: true },
  });
  if (conflict) throw new Error("Ya existe una página con ese slug");

  return db.tenantWebPage.create({
    data: {
      siteId,
      slug,
      title: input.title.trim(),
      body: input.body?.trim() || null,
      sortOrder: input.sortOrder ?? 100,
      isVisible: input.isVisible ?? true,
      status: WebSiteStatus.DRAFT,
    },
  });
}

export async function updateTenantWebPage(input: UpdateWebPageInput) {
  const siteId = await requireTenantSiteId();
  const page = await db.tenantWebPage.findFirst({
    where: { id: input.pageId, siteId },
  });
  if (!page) throw new Error("Página no encontrada");

  let nextSlug = page.slug;
  if (input.slug !== undefined) {
    nextSlug = normalizeSiteSlug(input.slug);
    if (!nextSlug) throw new Error("Slug de página inválido");
    if (nextSlug !== page.slug) {
      const conflict = await db.tenantWebPage.findUnique({
        where: { siteId_slug: { siteId, slug: nextSlug } },
        select: { id: true },
      });
      if (conflict) throw new Error("Ya existe una página con ese slug");
    }
  }

  if (input.status !== undefined) {
    if (
      input.status !== WebSiteStatus.DRAFT &&
      input.status !== WebSiteStatus.PUBLISHED
    ) {
      throw new Error("Estado de página inválido");
    }
  }

  return db.tenantWebPage.update({
    where: { id: page.id },
    data: {
      slug: nextSlug,
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.body !== undefined ? { body: input.body?.trim() || null } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
}

export async function archiveTenantWebPage(pageId: string) {
  const siteId = await requireTenantSiteId();
  const page = await db.tenantWebPage.findFirst({
    where: { id: pageId, siteId },
    select: { id: true },
  });
  if (!page) throw new Error("Página no encontrada");

  const archived = await db.tenantWebPage.update({
    where: { id: page.id },
    data: {
      isVisible: false,
      status: WebSiteStatus.DRAFT,
    },
  });
  return { id: archived.id, archived: true as const };
}

export async function deleteTenantWebPage(pageId: string) {
  const organizationId = await requireOrgId();
  const site = await db.tenantWebSite.findUnique({
    where: { organizationId },
    select: { id: true, status: true },
  });
  if (!site) throw new Error("Sitio no encontrado");

  const page = await db.tenantWebPage.findFirst({
    where: { id: pageId, siteId: site.id },
    select: { id: true, slug: true, isVisible: true },
  });
  if (!page) throw new Error("Página no encontrada");

  if (isProtectedHomePageSlug(page.slug)) {
    throw new Error(PROTECTED_HOME_PAGE_DELETE_MESSAGE);
  }

  const softArchive =
    site.status === WebSiteStatus.PUBLISHED && page.isVisible;

  if (softArchive) {
    const archived = await db.tenantWebPage.update({
      where: { id: page.id },
      data: {
        isVisible: false,
        status: WebSiteStatus.DRAFT,
      },
    });
    return { id: archived.id, archived: true as const };
  }

  await db.tenantWebPage.delete({ where: { id: page.id } });
  return { id: page.id, archived: false as const };
}

export async function updateSitePropertyLink(input: UpdateSitePropertyLinkInput) {
  const organizationId = await requireOrgId();
  const site = await db.tenantWebSite.findUnique({
    where: { organizationId },
    select: { id: true },
  });
  if (!site) throw new Error("Sitio no encontrado");

  const link = await db.tenantWebSiteProperty.findFirst({
    where: { id: input.linkId, siteId: site.id },
  });
  if (!link) throw new Error("Enlace de propiedad no encontrado");

  return db.tenantWebSiteProperty.update({
    where: { id: link.id },
    data: {
      ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      ...(input.customTitle !== undefined ? { customTitle: input.customTitle } : {}),
      ...(input.customDescription !== undefined
        ? { customDescription: input.customDescription }
        : {}),
      ...(input.customCoverUrl !== undefined ? { customCoverUrl: input.customCoverUrl } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

export async function getPublishedSiteBySlug(slug: string) {
  const normalized = normalizeSiteSlug(slug);
  if (!normalized) return null;

  const site = await db.tenantWebSite.findFirst({
    where: {
      slug: normalized,
      status: WebSiteStatus.PUBLISHED,
    },
    include: {
      pages: {
        where: { isVisible: true, status: WebSiteStatus.PUBLISHED },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          slug: true,
          title: true,
          body: true,
          sortOrder: true,
        },
      },
      propertyLinks: {
        where: {
          isPublished: true,
          property: { status: PropertyStatus.ACTIVE },
        },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          sortOrder: true,
          customTitle: true,
          customDescription: true,
          customCoverUrl: true,
          property: { select: PUBLIC_PROPERTY_SELECT },
        },
      },
      media: {
        where: { isPublished: true, reviewStatus: "APPROVED" },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          url: true,
          thumbnailUrl: true,
          category: true,
          sortOrder: true,
          alt: true,
          description: true,
          propertyId: true,
        },
      },
    },
  });

  return site;
}

const RENDERABLE_SITE_INCLUDE = {
  pages: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      slug: true,
      title: true,
      body: true,
      sortOrder: true,
      isVisible: true,
      status: true,
    },
  },
  propertyLinks: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      sortOrder: true,
      isPublished: true,
      customTitle: true,
      customDescription: true,
      customCoverUrl: true,
      property: { select: PUBLIC_PROPERTY_SELECT },
    },
  },
  media: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      url: true,
      thumbnailUrl: true,
      category: true,
      sortOrder: true,
      alt: true,
      description: true,
      propertyId: true,
      isPublished: true,
      reviewStatus: true,
    },
  },
} satisfies Prisma.TenantWebSiteInclude;

export async function getTenantWebSitePreviewBySlug(
  slug: string,
  organizationId: string,
) {
  const normalized = normalizeSiteSlug(slug);
  if (!normalized) return null;

  return db.tenantWebSite.findFirst({
    where: {
      slug: normalized,
      organizationId,
    },
    include: RENDERABLE_SITE_INCLUDE,
  });
}
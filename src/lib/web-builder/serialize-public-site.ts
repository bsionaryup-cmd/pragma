import type { Prisma } from "@prisma/client";
import {
  PropertyStatus,
  WebContentReviewStatus,
  WebSiteStatus,
  WebSiteTemplate,
} from "@prisma/client";

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}

export type PublicPropertyCard = {
  id: string;
  name: string;
  unitNumber: string | null;
  description: string | null;
  maxGuests: number;
  baseRate: number;
  cleaningFee: number;
  currency: string;
  coverImageUrl: string | null;
};

export type PublicSitePayload = {
  id: string;
  slug: string;
  siteName: string;
  template: WebSiteTemplate;
  status: WebSiteStatus;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  softWhite: string;
  sandOak: string;
  urbanGray: string;
  stoneTaupe: string;
  matteBlack: string;
  fontFamily: string;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  aboutText: string | null;
  locationNeighborhood: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  locationDescription: string | null;
  locationImageUrl: string | null;
  locationMapUrl: string | null;
  whatsapp: string | null;
  contactEmail: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoCanonicalUrl: string | null;
  ogImageUrl: string | null;
  bookingEnabled: boolean;
  currency: string;
  locale: string;
  pages: Array<{
    id: string;
    slug: string;
    title: string;
    body: string | null;
    sortOrder: number;
  }>;
  listings: PublicPropertyCard[];
  media: Array<{
    id: string;
    url: string;
    thumbnailUrl: string | null;
    category: string;
    alt: string | null;
  }>;
};

type PublishedSiteRow = NonNullable<
  Awaited<ReturnType<typeof import("@/services/web-builder/web-site.service").getPublishedSiteBySlug>>
>;

type PreviewSiteRow = NonNullable<
  Awaited<ReturnType<typeof import("@/services/web-builder/web-site.service").getTenantWebSitePreviewBySlug>>
>;

type PropertySelect = {
  id: string;
  name: string;
  unitNumber: string | null;
  description: string | null;
  maxGuests: number;
  baseRate: Prisma.Decimal | number | null;
  cleaningFee: Prisma.Decimal | number | null;
  currency: string;
  coverImageUrl: string | null;
  status?: PropertyStatus;
};

function mapPropertyCard(
  link: {
    customTitle: string | null;
    customDescription: string | null;
    customCoverUrl: string | null;
    isPublished?: boolean;
    property: PropertySelect;
  },
  mode: "published" | "preview",
): PublicPropertyCard | null {
  if (mode === "published" && link.isPublished === false) return null;
  if (
    link.property.status !== undefined &&
    link.property.status !== PropertyStatus.ACTIVE
  ) {
    return null;
  }

  return {
    id: link.property.id,
    name: link.customTitle?.trim() || link.property.name,
    unitNumber: link.property.unitNumber,
    description:
      link.customDescription?.trim() || link.property.description,
    maxGuests: link.property.maxGuests,
    baseRate: decimalToNumber(link.property.baseRate),
    cleaningFee: decimalToNumber(link.property.cleaningFee),
    currency: link.property.currency,
    coverImageUrl: link.customCoverUrl || link.property.coverImageUrl,
  };
}

function baseSiteFields(site: PublishedSiteRow | PreviewSiteRow): Omit<PublicSitePayload, "pages" | "listings" | "media"> {
  return {
    id: site.id,
    slug: site.slug,
    siteName: site.siteName,
    template: site.template,
    status: site.status,
    logoUrl: site.logoUrl,
    primaryColor: site.primaryColor,
    accentColor: site.accentColor,
    softWhite: site.softWhite,
    sandOak: site.sandOak,
    urbanGray: site.urbanGray,
    stoneTaupe: site.stoneTaupe,
    matteBlack: site.matteBlack,
    fontFamily: site.fontFamily,
    heroTitle: site.heroTitle,
    heroSubtitle: site.heroSubtitle,
    heroImageUrl: site.heroImageUrl,
    aboutText: site.aboutText,
    locationNeighborhood: site.locationNeighborhood,
    locationCity: site.locationCity,
    locationCountry: site.locationCountry,
    locationDescription: site.locationDescription,
    locationImageUrl: site.locationImageUrl,
    locationMapUrl: site.locationMapUrl,
    whatsapp: site.whatsapp,
    contactEmail: site.contactEmail,
    instagramUrl: site.instagramUrl,
    facebookUrl: site.facebookUrl,
    seoTitle: site.seoTitle,
    seoDescription: site.seoDescription,
    seoCanonicalUrl: site.seoCanonicalUrl,
    ogImageUrl: site.ogImageUrl,
    bookingEnabled: site.bookingEnabled,
    currency: site.currency,
    locale: site.locale,
  };
}

export function serializePublishedSite(site: PublishedSiteRow): PublicSitePayload {
  const listings = site.propertyLinks
    .map((link) => mapPropertyCard(link, "published"))
    .filter((row): row is PublicPropertyCard => row != null)
    .slice(0, 12);

  return {
    ...baseSiteFields(site),
    pages: site.pages.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      body: p.body,
      sortOrder: p.sortOrder,
    })),
    listings,
    media: site.media.map((m) => ({
      id: m.id,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
      category: m.category,
      alt: m.alt,
    })),
  };
}

export function serializePreviewSite(site: PreviewSiteRow): PublicSitePayload {
  const listings = site.propertyLinks
    .map((link) => mapPropertyCard(link, "preview"))
    .filter((row): row is PublicPropertyCard => row != null)
    .slice(0, 12);

  const pages = site.pages
    .filter((p) => p.isVisible)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      body: p.body,
      sortOrder: p.sortOrder,
    }));

  const media = site.media
    .filter(
      (m) =>
        m.reviewStatus === WebContentReviewStatus.APPROVED ||
        m.reviewStatus === WebContentReviewStatus.PENDING_REVIEW,
    )
    .map((m) => ({
      id: m.id,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
      category: m.category,
      alt: m.alt,
    }));

  return {
    ...baseSiteFields(site),
    pages,
    listings,
    media,
  };
}
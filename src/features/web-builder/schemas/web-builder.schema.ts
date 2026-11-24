import { WebMediaCategory, WebSiteStatus } from "@prisma/client";
import { z } from "zod";
import { hostProfileSchema } from "@/lib/web-builder/host-profile";

const slugField = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido");

const optionalUrl = z
  .string()
  .trim()
  .url("URL inválida")
  .max(2048)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" ? null : v ?? null));

const colorHex = z
  .string()
  .trim()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Color hex inválido");

export const updateWebSiteSchema = z.object({
  slug: slugField.optional(),
  siteName: z.string().trim().min(1).max(120).optional(),
  logoUrl: optionalUrl,
  primaryColor: colorHex.optional(),
  accentColor: colorHex.optional(),
  softWhite: colorHex.optional(),
  sandOak: colorHex.optional(),
  urbanGray: colorHex.optional(),
  stoneTaupe: colorHex.optional(),
  matteBlack: colorHex.optional(),
  fontFamily: z.string().trim().min(1).max(80).optional(),
  heroTitle: z.string().trim().max(240).optional().nullable(),
  heroSubtitle: z.string().trim().max(500).optional().nullable(),
  heroImageUrl: optionalUrl,
  aboutText: z.string().trim().max(8000).optional().nullable(),
  hostProfile: hostProfileSchema.optional().nullable(),
  locationNeighborhood: z.string().trim().max(120).optional().nullable(),
  locationCity: z.string().trim().max(120).optional().nullable(),
  locationCountry: z.string().trim().max(120).optional().nullable(),
  locationDescription: z.string().trim().max(4000).optional().nullable(),
  locationImageUrl: optionalUrl,
  locationMapUrl: optionalUrl,
  whatsapp: z.string().trim().max(40).optional().nullable(),
  contactEmail: z.string().trim().email().max(200).optional().nullable().or(z.literal("")).transform((v) => (v === "" ? null : v ?? null)),
  instagramUrl: optionalUrl,
  facebookUrl: optionalUrl,
  seoTitle: z.string().trim().max(240).optional().nullable(),
  seoDescription: z.string().trim().max(500).optional().nullable(),
  seoCanonicalUrl: optionalUrl,
  ogImageUrl: optionalUrl,
  bookingEnabled: z.boolean().optional(),
  currency: z.string().trim().length(3).optional(),
  locale: z.enum(["es", "en"]).optional(),
});

export const createWebMediaSchema = z.object({
  url: z.string().trim().url().max(2048),
  category: z.nativeEnum(WebMediaCategory).optional(),
  alt: z.string().trim().max(240).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  thumbnailUrl: optionalUrl,
  propertyId: z.string().cuid().optional().nullable(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const reorderWebMediaSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().cuid(),
        sortOrder: z.number().int().min(0).max(9999),
      }),
    )
    .min(1)
    .max(500),
});

export const setWebMediaHeroSchema = z.object({
  mediaId: z.string().cuid(),
});

export const setWebMediaPropertyCoverSchema = z.object({
  mediaId: z.string().cuid(),
  propertyLinkId: z.string().cuid(),
});

export const importWebMediaJsonSchema = z.object({
  items: z
    .array(
      z.object({
        url: z.string().trim().url().max(2048),
        category: z.nativeEnum(WebMediaCategory).optional(),
        alt: z.string().trim().max(240).optional().nullable(),
        propertyId: z.string().cuid().optional().nullable(),
        sortOrder: z.number().int().min(0).max(9999).optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const updateSitePropertyLinkSchema = z.object({
  linkId: z.string().cuid(),
  isPublished: z.boolean().optional(),
  customTitle: z.string().trim().max(200).optional().nullable(),
  customDescription: z.string().trim().max(2000).optional().nullable(),
  customCoverUrl: optionalUrl,
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const setWebSiteStatusSchema = z.object({
  status: z.nativeEnum(WebSiteStatus),
});

const pageSlugField = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug de página inválido");

export const createWebPageSchema = z.object({
  slug: pageSlugField,
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(20000).optional().nullable(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isVisible: z.boolean().optional(),
});

const webPagePublishStatus = z.enum([WebSiteStatus.DRAFT, WebSiteStatus.PUBLISHED]);

export const updateWebPageSchema = z.object({
  pageId: z.string().cuid(),
  slug: pageSlugField.optional(),
  title: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().max(20000).optional().nullable(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isVisible: z.boolean().optional(),
  status: webPagePublishStatus.optional(),
});

export const deleteWebPageSchema = z.object({
  pageId: z.string().cuid(),
});

export const searchWebAvailabilitySchema = z.object({
  slug: slugField,
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.coerce.number().int().min(1).max(50),
});

export const createWebReservationSchema = z.object({
  slug: slugField,
  propertyId: z.string().cuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.coerce.number().int().min(1).max(30),
  children: z.coerce.number().int().min(0).max(20).default(0),
  infants: z.coerce.number().int().min(0).max(10).default(0),
  guestFirstName: z.string().trim().min(1).max(120),
  guestLastName: z.string().trim().min(1).max(120),
  guestEmail: z.string().trim().email().max(200).optional().nullable().or(z.literal("")).transform((v) => (v === "" ? null : v ?? null)),
  guestPhone: z.string().trim().max(40).optional().nullable(),
  totalAmount: z.coerce.number().min(0),
  policiesAccepted: z.literal(true, {
    error: "Debes aceptar las políticas para continuar",
  }),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

export type UpdateWebSiteInput = z.infer<typeof updateWebSiteSchema>;
export type CreateWebMediaInput = z.infer<typeof createWebMediaSchema>;
export type UpdateSitePropertyLinkInput = z.infer<typeof updateSitePropertyLinkSchema>;
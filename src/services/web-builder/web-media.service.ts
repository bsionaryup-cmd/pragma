import "server-only";

import {
  WebContentReviewStatus,
  WebMediaCategory,
  WebMediaProvenance,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  formatMediaFingerprintNote,
  webMediaUrlFingerprint,
} from "@/lib/web-builder/web-media-fingerprint";
import {
  findDuplicateTenantWebMedia,
  importWebMediaRows,
} from "@/services/web-builder/web-media-import.shared";
import {
  requireOrgId,
  resolveTenantSiteId,
} from "@/services/web-builder/web-media-org";

const MAX_URL_LENGTH = 2048;

export type CreateWebMediaInput = {
  url: string;
  category?: WebMediaCategory;
  alt?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  propertyId?: string | null;
  provenance?: WebMediaProvenance;
  rightsNote?: string | null;
  sortOrder?: number;
};

export type CreateWebMediaFromJsonInput = {
  items: Array<{
    url: string;
    category?: WebMediaCategory;
    alt?: string | null;
    description?: string | null;
    thumbnailUrl?: string | null;
    propertyId?: string | null;
    sortOrder?: number;
  }>;
};

export type ImportFromPropertiesOptions = {
  overwritePublishedSiteHero?: boolean;
};

function assertValidHttpUrl(url: string): void {
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) {
    throw new Error("URL inválida");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("URL inválida");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Solo se permiten URLs http o https");
  }
}

export async function listTenantWebMedia(options?: {
  category?: WebMediaCategory;
  siteOnly?: boolean;
}) {
  const organizationId = await requireOrgId();
  const siteId = options?.siteOnly ? await resolveTenantSiteId(organizationId) : undefined;

  return db.tenantWebMedia.findMany({
    where: {
      organizationId,
      ...(options?.category ? { category: options.category } : {}),
      ...(siteId ? { siteId } : {}),
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function createTenantWebMedia(input: CreateWebMediaInput) {
  assertValidHttpUrl(input.url);
  const organizationId = await requireOrgId();
  const siteId = await resolveTenantSiteId(organizationId);

  if (input.propertyId) {
    const property = await db.property.findFirst({
      where: { id: input.propertyId, organizationId },
      select: { id: true },
    });
    if (!property) throw new Error("Propiedad no encontrada en la organización");
  }

  if (input.thumbnailUrl) assertValidHttpUrl(input.thumbnailUrl);

  const fingerprint = webMediaUrlFingerprint(input.url);
  const duplicate = await findDuplicateTenantWebMedia({
    organizationId,
    url: input.url,
    contentFingerprint: fingerprint,
  });
  if (duplicate) {
    throw new Error(
      "Ya existe un medio con la misma URL o huella en la organización",
    );
  }

  return db.tenantWebMedia.create({
    data: {
      organizationId,
      siteId,
      url: input.url.trim(),
      thumbnailUrl: input.thumbnailUrl?.trim() || null,
      category: input.category ?? WebMediaCategory.GALLERY,
      alt: input.alt?.trim() || null,
      description: input.description?.trim() || null,
      propertyId: input.propertyId ?? null,
      provenance: input.provenance ?? WebMediaProvenance.EXTERNAL_URL,
      rightsNote:
        input.rightsNote?.trim() || formatMediaFingerprintNote(fingerprint),
      sortOrder: input.sortOrder ?? 0,
      reviewStatus: WebContentReviewStatus.PENDING_REVIEW,
      isPublished: false,
    },
  });
}

export async function createTenantWebMediaFromJson(input: CreateWebMediaFromJsonInput) {
  const organizationId = await requireOrgId();
  const siteId = await resolveTenantSiteId(organizationId);
  if (input.items.length === 0) {
    return { created: [], skippedDuplicates: 0, skippedInvalid: 0 };
  }

  const batch = await importWebMediaRows(
    input.items.map((item, index) => ({
      ...item,
      provenance: WebMediaProvenance.JSON_IMPORT,
      sortOrder: item.sortOrder ?? index,
    })),
    { organizationId, siteId },
  );

  const created =
    batch.mediaIds.length > 0
      ? await db.tenantWebMedia.findMany({
          where: { id: { in: batch.mediaIds } },
          orderBy: { sortOrder: "asc" },
        })
      : [];

  return {
    created,
    skippedDuplicates: batch.skippedDuplicates,
    skippedInvalid: batch.skippedInvalid,
  };
}

export async function importWebMediaFromProperties(
  options: ImportFromPropertiesOptions = {},
) {
  const organizationId = await requireOrgId();
  const site = await db.tenantWebSite.findUnique({
    where: { organizationId },
    select: { id: true, heroImageUrl: true },
  });
  if (!site) throw new Error("Sitio no encontrado");

  const properties = await db.property.findMany({
    where: {
      organizationId,
      coverImageUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      coverImageUrl: true,
    },
  });

  const createdIds: string[] = [];

  for (const property of properties) {
    const coverUrl = property.coverImageUrl?.trim();
    if (!coverUrl) continue;
    assertValidHttpUrl(coverUrl);

    const existing = await db.tenantWebMedia.findFirst({
      where: {
        organizationId,
        propertyId: property.id,
        url: coverUrl,
        provenance: WebMediaProvenance.PROPERTY_IMPORT,
      },
      select: { id: true },
    });
    if (existing) continue;

    const media = await db.tenantWebMedia.create({
      data: {
        organizationId,
        siteId: site.id,
        propertyId: property.id,
        url: coverUrl,
        category: WebMediaCategory.PROPERTY,
        alt: property.name,
        provenance: WebMediaProvenance.PROPERTY_IMPORT,
        reviewStatus: WebContentReviewStatus.APPROVED,
        isPublished: true,
      },
    });
    createdIds.push(media.id);
  }

  if (
    options.overwritePublishedSiteHero &&
    properties.some((p) => p.coverImageUrl)
  ) {
    const heroSource = properties.find((p) => p.coverImageUrl?.trim());
    if (heroSource?.coverImageUrl) {
      await db.tenantWebSite.update({
        where: { id: site.id },
        data: { heroImageUrl: heroSource.coverImageUrl.trim() },
      });
    }
  } else if (!site.heroImageUrl && properties.length > 0) {
    const firstCover = properties.find((p) => p.coverImageUrl?.trim())?.coverImageUrl;
    if (firstCover) {
      await db.tenantWebSite.update({
        where: { id: site.id },
        data: { heroImageUrl: firstCover.trim() },
      });
    }
  }

  return { imported: createdIds.length, mediaIds: createdIds };
}

export async function approveTenantWebMedia(mediaId: string) {
  const organizationId = await requireOrgId();
  const row = await db.tenantWebMedia.findFirst({
    where: { id: mediaId, organizationId },
  });
  if (!row) throw new Error("Medio no encontrado");
  return db.tenantWebMedia.update({
    where: { id: row.id },
    data: { reviewStatus: WebContentReviewStatus.APPROVED },
  });
}

export async function rejectTenantWebMedia(mediaId: string) {
  const organizationId = await requireOrgId();
  const row = await db.tenantWebMedia.findFirst({
    where: { id: mediaId, organizationId },
  });
  if (!row) throw new Error("Medio no encontrado");
  return db.tenantWebMedia.update({
    where: { id: row.id },
    data: {
      reviewStatus: WebContentReviewStatus.REJECTED,
      isPublished: false,
    },
  });
}

export async function publishTenantWebMedia(mediaId: string, isPublished: boolean) {
  const organizationId = await requireOrgId();
  const row = await db.tenantWebMedia.findFirst({
    where: { id: mediaId, organizationId },
  });
  if (!row) throw new Error("Medio no encontrado");
  if (isPublished && row.reviewStatus !== WebContentReviewStatus.APPROVED) {
    throw new Error("Solo se publican medios aprobados");
  }
  return db.tenantWebMedia.update({
    where: { id: row.id },
    data: { isPublished },
  });
}

export async function deleteTenantWebMedia(mediaId: string) {
  const organizationId = await requireOrgId();
  const row = await db.tenantWebMedia.findFirst({
    where: { id: mediaId, organizationId },
  });
  if (!row) throw new Error("Medio no encontrado");
  await db.tenantWebMedia.delete({ where: { id: row.id } });
  return { ok: true as const };
}

export async function reorderTenantWebMedia(
  updates: Array<{ id: string; sortOrder: number }>,
) {
  const organizationId = await requireOrgId();
  if (updates.length === 0) return { updated: 0 };

  const ids = updates.map((u) => u.id);
  const rows = await db.tenantWebMedia.findMany({
    where: { organizationId, id: { in: ids } },
    select: { id: true },
  });
  if (rows.length !== ids.length) {
    throw new Error("Algunos medios no pertenecen a la organización");
  }

  await db.$transaction(
    updates.map((item) =>
      db.tenantWebMedia.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      }),
    ),
  );

  return { updated: updates.length };
}

export async function setTenantWebMediaAsSiteHero(mediaId: string) {
  const organizationId = await requireOrgId();
  const row = await db.tenantWebMedia.findFirst({
    where: { id: mediaId, organizationId },
    select: { url: true },
  });
  if (!row) throw new Error("Medio no encontrado");

  const site = await db.tenantWebSite.findUnique({
    where: { organizationId },
    select: { id: true },
  });
  if (!site) throw new Error("Sitio no encontrado");

  await db.tenantWebSite.update({
    where: { id: site.id },
    data: { heroImageUrl: row.url },
  });

  return { heroImageUrl: row.url };
}

export async function setTenantWebMediaAsPropertyCover(input: {
  mediaId: string;
  propertyLinkId: string;
}) {
  const organizationId = await requireOrgId();
  const [media, link] = await Promise.all([
    db.tenantWebMedia.findFirst({
      where: { id: input.mediaId, organizationId },
      select: { url: true, propertyId: true },
    }),
    db.tenantWebSiteProperty.findFirst({
      where: { id: input.propertyLinkId, site: { organizationId } },
      select: { id: true, propertyId: true },
    }),
  ]);

  if (!media) throw new Error("Medio no encontrado");
  if (!link) throw new Error("Enlace de alojamiento no encontrado");
  if (media.propertyId && media.propertyId !== link.propertyId) {
    throw new Error("El medio no pertenece a esta propiedad");
  }

  const updated = await db.tenantWebSiteProperty.update({
    where: { id: link.id },
    data: { customCoverUrl: media.url },
    select: { id: true, customCoverUrl: true },
  });

  return updated;
}
import "server-only";

import {
  WebContentReviewStatus,
  WebMediaCategory,
  WebMediaProvenance,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  formatMediaFingerprintNote,
  normalizeWebMediaUrl,
  parseMediaFingerprintFromRightsNote,
  webMediaUrlFingerprint,
} from "@/lib/web-builder/web-media-fingerprint";

export type ImportWebMediaRowInput = {
  url: string;
  category?: WebMediaCategory;
  alt?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  propertyId?: string | null;
  sortOrder?: number;
  provenance?: WebMediaProvenance;
  rightsNote?: string | null;
};

export type ImportWebMediaBatchResult = {
  created: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  mediaIds: string[];
};

export async function findDuplicateTenantWebMedia(input: {
  organizationId: string;
  url: string;
  contentFingerprint?: string | null;
}): Promise<{ id: string } | null> {
  const trimmedUrl = input.url.trim();
  const byUrl = await db.tenantWebMedia.findFirst({
    where: { organizationId: input.organizationId, url: trimmedUrl },
    select: { id: true },
  });
  if (byUrl) return byUrl;

  const normalized = normalizeWebMediaUrl(trimmedUrl);
  if (normalized !== trimmedUrl.toLowerCase()) {
    const candidates = await db.tenantWebMedia.findMany({
      where: { organizationId: input.organizationId },
      select: { id: true, url: true },
      take: 500,
    });
    const normalizedHit = candidates.find(
      (row) => normalizeWebMediaUrl(row.url) === normalized,
    );
    if (normalizedHit) return { id: normalizedHit.id };
  }

  const fp =
    input.contentFingerprint?.trim() ||
    webMediaUrlFingerprint(trimmedUrl);
  const fpNote = formatMediaFingerprintNote(fp);

  const byFingerprint = await db.tenantWebMedia.findFirst({
    where: {
      organizationId: input.organizationId,
      rightsNote: { contains: fpNote },
    },
    select: { id: true },
  });
  if (byFingerprint) return byFingerprint;

  return null;
}

function assertValidHttpUrl(url: string): void {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("URL vacía");
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Solo http/https");
  }
}

export async function importWebMediaRows(
  rows: ImportWebMediaRowInput[],
  ctx: { organizationId: string; siteId: string | null },
): Promise<ImportWebMediaBatchResult> {
  const mediaIds: string[] = [];
  let created = 0;
  let skippedDuplicates = 0;
  let skippedInvalid = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const item = rows[index]!;
    try {
      assertValidHttpUrl(item.url);
      if (item.thumbnailUrl) assertValidHttpUrl(item.thumbnailUrl);

      const contentFingerprint =
        parseMediaFingerprintFromRightsNote(item.rightsNote) ??
        webMediaUrlFingerprint(item.url);

      const duplicate = await findDuplicateTenantWebMedia({
        organizationId: ctx.organizationId,
        url: item.url,
        contentFingerprint,
      });
      if (duplicate) {
        skippedDuplicates += 1;
        continue;
      }

      if (item.propertyId) {
        const property = await db.property.findFirst({
          where: { id: item.propertyId, organizationId: ctx.organizationId },
          select: { id: true },
        });
        if (!property) {
          skippedInvalid += 1;
          continue;
        }
      }

      const rightsNote =
        item.rightsNote?.trim() ||
        formatMediaFingerprintNote(contentFingerprint);

      const media = await db.tenantWebMedia.create({
        data: {
          organizationId: ctx.organizationId,
          siteId: ctx.siteId,
          url: item.url.trim(),
          thumbnailUrl: item.thumbnailUrl?.trim() || null,
          category: item.category ?? WebMediaCategory.GALLERY,
          alt: item.alt?.trim() || null,
          description: item.description?.trim() || null,
          propertyId: item.propertyId ?? null,
          provenance: item.provenance ?? WebMediaProvenance.EXTERNAL_URL,
          rightsNote,
          sortOrder: item.sortOrder ?? index,
          reviewStatus: WebContentReviewStatus.PENDING_REVIEW,
          isPublished: false,
        },
      });

      mediaIds.push(media.id);
      created += 1;
    } catch {
      skippedInvalid += 1;
    }
  }

  return { created, skippedDuplicates, skippedInvalid, mediaIds };
}
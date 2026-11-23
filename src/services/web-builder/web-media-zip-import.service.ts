import "server-only";

import { WebMediaProvenance } from "@prisma/client";
import {
  formatMediaFingerprintNote,
  webMediaContentFingerprint,
} from "@/lib/web-builder/web-media-fingerprint";
import {
  guessImageContentType,
  isWebMediaImagePath,
  resolveWebMediaObjectStorage,
  uploadWebMediaBufferToObjectStorage,
} from "@/lib/web-builder/web-media-object-storage";
import { requireOrgId, resolveTenantSiteId } from "@/services/web-builder/web-media-org";
import {
  importWebMediaRows,
  type ImportWebMediaRowInput,
} from "@/services/web-builder/web-media-import.shared";

export type WebMediaZipImportResult = {
  created: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  pendingStorage: number;
  errors: string[];
  storageStatus: ReturnType<typeof resolveWebMediaObjectStorage>;
};

type ManifestItem = {
  url?: string;
  file?: string;
  alt?: string | null;
  category?: ImportWebMediaRowInput["category"];
  propertyId?: string | null;
  sortOrder?: number;
};

type JsZipModule = {
  loadAsync(data: Buffer): Promise<import("jszip")>;
};

async function loadJsZip(): Promise<JsZipModule> {
  try {
    const mod = await import("jszip");
    const JSZip = (mod as { default?: JsZipModule }).default ?? (mod as JsZipModule);
    return JSZip;
  } catch {
    throw new Error(
      "PENDING EXTERNAL: instala la dependencia jszip (npm install jszip) para importar archivos ZIP.",
    );
  }
}

function parseManifestJson(raw: string): ManifestItem[] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("manifest.json debe ser un arreglo de objetos");
  }
  return parsed as ManifestItem[];
}

export async function importWebMediaFromZipBuffer(
  zipBuffer: Buffer,
  options?: { orgSlugPrefix?: string },
): Promise<WebMediaZipImportResult> {
  const JSZip = await loadJsZip();
  const storageStatus = resolveWebMediaObjectStorage();
  const zip = await JSZip.loadAsync(zipBuffer);

  let manifestItems: ManifestItem[] = [];
  const manifestPath =
    (zip.file("manifest.json") ? "manifest.json" : null) ??
    Object.keys(zip.files).find((name) => /(^|\/)manifest\.json$/i.test(name));
  if (manifestPath) {
    const manifestFile = zip.file(manifestPath);
    if (manifestFile && !manifestFile.dir) {
      manifestItems = parseManifestJson(await manifestFile.async("string"));
    }
  }

  const rows: ImportWebMediaRowInput[] = [];
  const errors: string[] = [];
  let pendingStorage = 0;
  let skippedInvalid = 0;

  for (const item of manifestItems) {
    if (item.url?.trim()) {
      rows.push({
        url: item.url.trim(),
        alt: item.alt,
        category: item.category,
        propertyId: item.propertyId,
        sortOrder: item.sortOrder,
        provenance: WebMediaProvenance.JSON_IMPORT,
      });
      continue;
    }

    if (item.file?.trim()) {
      const entry = zip.file(item.file) ?? zip.file(item.file.replace(/^\//, ""));
      if (!entry) {
        errors.push(`Archivo no encontrado en ZIP: ${item.file}`);
        skippedInvalid += 1;
        continue;
      }

      if (!isWebMediaImagePath(item.file)) {
        errors.push(`Tipo no soportado: ${item.file}`);
        skippedInvalid += 1;
        continue;
      }

      const body = Buffer.from(await entry.async("uint8array"));
      const fingerprint = webMediaContentFingerprint(body);

      if (!storageStatus.ready) {
        pendingStorage += 1;
        errors.push(
          `${item.file}: ${storageStatus.reason} (fingerprint ${fingerprint.slice(0, 12)}…)`,
        );
        continue;
      }

      const key = [
        options?.orgSlugPrefix?.replace(/[^a-z0-9-]/gi, "") || "tenant",
        "web-media",
        `${fingerprint.slice(0, 16)}-${item.file.split("/").pop()}`,
      ]
        .filter(Boolean)
        .join("/");

      const uploaded = await uploadWebMediaBufferToObjectStorage({
        key,
        body,
        contentType: guessImageContentType(item.file),
      });

      if (!uploaded.ok) {
        pendingStorage += 1;
        errors.push(`${item.file}: ${uploaded.message}`);
        continue;
      }

      rows.push({
        url: uploaded.publicUrl,
        alt: item.alt,
        category: item.category,
        propertyId: item.propertyId,
        sortOrder: item.sortOrder,
        provenance: WebMediaProvenance.UPLOAD,
        rightsNote: formatMediaFingerprintNote(fingerprint),
      });
    }
  }

  if (manifestItems.length === 0) {
    const imageEntries = Object.keys(zip.files).filter(
      (name) => !zip.files[name]?.dir && isWebMediaImagePath(name),
    );

    for (const name of imageEntries) {
      const entry = zip.file(name);
      if (!entry) continue;
      const body = Buffer.from(await entry.async("uint8array"));
      const fingerprint = webMediaContentFingerprint(body);

      if (!storageStatus.ready) {
        pendingStorage += 1;
        errors.push(`${name}: ${storageStatus.reason}`);
        continue;
      }

      const key = [
        options?.orgSlugPrefix || "tenant",
        "web-media",
        `${fingerprint.slice(0, 16)}-${name.split("/").pop()}`,
      ].join("/");

      const uploaded = await uploadWebMediaBufferToObjectStorage({
        key,
        body,
        contentType: guessImageContentType(name),
      });

      if (!uploaded.ok) {
        pendingStorage += 1;
        errors.push(`${name}: ${uploaded.message}`);
        continue;
      }

      rows.push({
        url: uploaded.publicUrl,
        provenance: WebMediaProvenance.UPLOAD,
        rightsNote: formatMediaFingerprintNote(fingerprint),
      });
    }
  }

  const organizationId = await requireOrgId();
  const siteId = await resolveTenantSiteId(organizationId);
  const batch = await importWebMediaRows(rows, { organizationId, siteId });

  return {
    created: batch.created,
    skippedDuplicates: batch.skippedDuplicates,
    skippedInvalid: skippedInvalid + batch.skippedInvalid,
    pendingStorage,
    errors,
    storageStatus,
  };
}
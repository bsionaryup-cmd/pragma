"use server";

import { WebSiteStatus } from "@prisma/client";
import { hasPermission, requirePermission } from "@/lib/auth";
import { PILOT_PMS_ORGANIZATION_ID } from "@/lib/platform/constants.client";
import { requireTenantContext } from "@/lib/platform/tenant-context";
import type { AppUserRole } from "@/types/auth";
import { ensureUrbanovaPilotWebSite } from "@/services/web-builder/ensure-urbanova-pilot.service";
import {
  createTenantWebMedia,
  createTenantWebMediaFromJson,
  importWebMediaFromProperties,
  listTenantWebMedia,
  reorderTenantWebMedia,
  setTenantWebMediaAsPropertyCover,
  setTenantWebMediaAsSiteHero,
} from "@/services/web-builder/web-media.service";
import { importWebMediaFromZipBuffer } from "@/services/web-builder/web-media-zip-import.service";
import {
  archiveTenantWebPage,
  createTenantWebPage,
  deleteTenantWebPage,
  getOrCreateTenantWebSite,
  getTenantWebSiteAdmin,
  setWebSiteStatus,
  syncSitePropertiesFromOrg,
  updateSitePropertyLink,
  updateTenantWebPage,
  updateTenantWebSite,
} from "@/services/web-builder/web-site.service";
import {
  createWebMediaSchema,
  createWebPageSchema,
  deleteWebPageSchema,
  importWebMediaJsonSchema,
  reorderWebMediaSchema,
  setWebSiteStatusSchema,
  setWebMediaHeroSchema,
  setWebMediaPropertyCoverSchema,
  updateSitePropertyLinkSchema,
  updateWebPageSchema,
  updateWebSiteSchema,
} from "@/features/web-builder/schemas/web-builder.schema";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type WebBuilderHubSite = NonNullable<
  Awaited<ReturnType<typeof getTenantWebSiteAdmin>>
>;
export type WebBuilderHubMedia = Awaited<
  ReturnType<typeof listTenantWebMedia>
>;

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

async function maybeEnsurePilotSite(organizationId: string | null) {
  if (organizationId === PILOT_PMS_ORGANIZATION_ID) {
    await ensureUrbanovaPilotWebSite().catch(() => undefined);
  }
}

export async function loadWebBuilderHubAction(): Promise<
  ActionResult<{
    site: NonNullable<Awaited<ReturnType<typeof getTenantWebSiteAdmin>>>;
    media: Awaited<ReturnType<typeof listTenantWebMedia>>;
    canManage: boolean;
  }>
> {
  try {
    const auth = await requirePermission("website:read");
    const ctx = await requireTenantContext();
    await maybeEnsurePilotSite(ctx.organizationId);
    await getOrCreateTenantWebSite();

    const [site, media] = await Promise.all([
      getTenantWebSiteAdmin(),
      listTenantWebMedia({ siteOnly: true }),
    ]);

    if (!site) {
      return fail("No se pudo cargar el sitio");
    }

    const canManage = hasPermission(auth.role as AppUserRole, "website:manage");

    return {
      ok: true,
      data: { site, media, canManage },
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Error al cargar");
  }
}

export async function updateWebSiteAction(
  input: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    await requirePermission("website:manage");
    const parsed = updateWebSiteSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
    }
    const site = await updateTenantWebSite(parsed.data);
    return { ok: true, data: { id: site.id, slug: site.slug } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo guardar");
  }
}

export async function setWebSiteStatusAction(
  input: unknown,
): Promise<ActionResult<{ status: WebSiteStatus }>> {
  try {
    await requirePermission("website:manage");
    const parsed = setWebSiteStatusSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Estado inválido");
    }
    const site = await setWebSiteStatus(parsed.data.status);
    return { ok: true, data: { status: site.status } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo publicar");
  }
}

export async function updateSitePropertyLinkAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("website:manage");
    const parsed = updateSitePropertyLinkSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
    }
    const link = await updateSitePropertyLink(parsed.data);
    return { ok: true, data: { id: link.id } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo actualizar");
  }
}

export async function createWebMediaAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("website:manage");
    const parsed = createWebMediaSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "URL inválida");
    }
    const media = await createTenantWebMedia(parsed.data);
    return { ok: true, data: { id: media.id } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo crear el medio");
  }
}

export async function reorderWebMediaAction(
  input: unknown,
): Promise<ActionResult<{ updated: number }>> {
  try {
    await requirePermission("website:manage");
    const parsed = reorderWebMediaSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Orden inválido");
    }
    const result = await reorderTenantWebMedia(parsed.data.updates);
    return { ok: true, data: { updated: result.updated } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo reordenar");
  }
}

export async function setWebMediaHeroAction(
  input: unknown,
): Promise<ActionResult<{ heroImageUrl: string }>> {
  try {
    await requirePermission("website:manage");
    const parsed = setWebMediaHeroSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Medio inválido");
    }
    const result = await setTenantWebMediaAsSiteHero(parsed.data.mediaId);
    return { ok: true, data: result };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo asignar hero");
  }
}

export async function setWebMediaPropertyCoverAction(
  input: unknown,
): Promise<ActionResult<{ id: string; customCoverUrl: string | null }>> {
  try {
    await requirePermission("website:manage");
    const parsed = setWebMediaPropertyCoverSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Datos inválidos");
    }
    const result = await setTenantWebMediaAsPropertyCover(parsed.data);
    return { ok: true, data: result };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo asignar portada");
  }
}

export async function importWebMediaJsonAction(
  input: unknown,
): Promise<
  ActionResult<{
    created: number;
    skippedDuplicates: number;
    skippedInvalid: number;
  }>
> {
  try {
    await requirePermission("website:manage");
    const parsed = importWebMediaJsonSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "JSON inválido");
    }
    const batch = await createTenantWebMediaFromJson({ items: parsed.data.items });
    return {
      ok: true,
      data: {
        created: batch.created.length,
        skippedDuplicates: batch.skippedDuplicates,
        skippedInvalid: batch.skippedInvalid,
      },
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Importación fallida");
  }
}

export async function importWebMediaZipAction(
  formData: FormData,
): Promise<
  ActionResult<{
    created: number;
    skippedDuplicates: number;
    skippedInvalid: number;
    pendingStorage: number;
    storageReady: boolean;
    storageReason?: string;
    errors: string[];
  }>
> {
  try {
    await requirePermission("website:manage");
    const file = formData.get("file");
    if (!(file instanceof Blob)) {
      return fail("Archivo ZIP requerido");
    }
    if (file.size > 50 * 1024 * 1024) {
      return fail("ZIP demasiado grande (máx. 50 MB)");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importWebMediaFromZipBuffer(buffer);
    return {
      ok: true,
      data: {
        created: result.created,
        skippedDuplicates: result.skippedDuplicates,
        skippedInvalid: result.skippedInvalid,
        pendingStorage: result.pendingStorage,
        storageReady: result.storageStatus.ready,
        storageReason: result.storageStatus.ready
          ? undefined
          : result.storageStatus.reason,
        errors: result.errors.slice(0, 20),
      },
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "ZIP inválido");
  }
}

export async function importFromPropertiesAction(): Promise<
  ActionResult<{ imported: number }>
> {
  try {
    await requirePermission("website:manage");
    const [sync, media] = await Promise.all([
      syncSitePropertiesFromOrg(),
      importWebMediaFromProperties({ overwritePublishedSiteHero: false }),
    ]);
    return {
      ok: true,
      data: {
        imported: media.imported + (sync.added ?? 0),
      },
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Importación fallida");
  }
}

export async function createWebPageAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("website:manage");
    const parsed = createWebPageSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
    }
    const page = await createTenantWebPage(parsed.data);
    return { ok: true, data: { id: page.id } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo crear la página");
  }
}

export async function updateWebPageAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("website:manage");
    const parsed = updateWebPageSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
    }
    const page = await updateTenantWebPage(parsed.data);
    return { ok: true, data: { id: page.id } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo actualizar");
  }
}

export async function deleteWebPageAction(
  input: unknown,
): Promise<ActionResult<{ id: string; archived: boolean }>> {
  try {
    await requirePermission("website:manage");
    const parsed = deleteWebPageSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
    }
    const page = await deleteTenantWebPage(parsed.data.pageId);
    return { ok: true, data: { id: page.id, archived: page.archived } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo eliminar");
  }
}

export async function archiveWebPageAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("website:manage");
    const parsed = deleteWebPageSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
    }
    const page = await archiveTenantWebPage(parsed.data.pageId);
    return { ok: true, data: { id: page.id } };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo archivar");
  }
}
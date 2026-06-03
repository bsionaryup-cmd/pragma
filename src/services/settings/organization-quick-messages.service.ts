import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  formFieldsToQuickMessageTemplates,
  parseQuickMessageTemplates,
  quickMessageTemplatesToFormFields,
  type QuickMessageTemplates,
} from "@/lib/reservations/quick-message-templates";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";

export type QuickMessageSettingsForm = ReturnType<
  typeof quickMessageTemplatesToFormFields
>;

/** Lectura/escritura vía SQL para no depender del DMMF si el cliente Prisma en dev quedó obsoleto. */
async function loadQuickMessageTemplates(
  organizationId: string,
): Promise<QuickMessageTemplates> {
  const rows = await db.$queryRaw<{ quickMessageTemplates: unknown }[]>(
    Prisma.sql`
      SELECT "quickMessageTemplates"
      FROM "organizations"
      WHERE "id" = ${organizationId}
      LIMIT 1
    `,
  );
  return parseQuickMessageTemplates(rows[0]?.quickMessageTemplates);
}

async function persistQuickMessageTemplates(
  organizationId: string,
  templates: QuickMessageTemplates | null,
): Promise<void> {
  await db.$executeRaw(
    Prisma.sql`
      UPDATE "organizations"
      SET
        "quickMessageTemplates" = ${templates === null ? null : templates},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${organizationId}
    `,
  );
}

export async function getOrganizationQuickMessageSettings(): Promise<QuickMessageSettingsForm> {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    return quickMessageTemplatesToFormFields({});
  }

  const templates = await loadQuickMessageTemplates(scope.organizationId);
  return quickMessageTemplatesToFormFields(templates);
}

export async function getOrganizationQuickMessageTemplates(): Promise<QuickMessageTemplates> {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) return {};
  return loadQuickMessageTemplates(scope.organizationId);
}

export async function saveOrganizationQuickMessageSettings(
  input: QuickMessageSettingsForm,
): Promise<QuickMessageSettingsForm> {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    throw new Error("No hay organización activa para guardar los mensajes.");
  }

  const templates = formFieldsToQuickMessageTemplates(input);
  await persistQuickMessageTemplates(scope.organizationId, templates);

  return quickMessageTemplatesToFormFields(templates ?? {});
}

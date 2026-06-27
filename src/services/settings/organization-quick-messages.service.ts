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

async function loadOrgQuickMessageTemplates(
  organizationId: string,
): Promise<QuickMessageTemplates> {
  const property = await db.property.findFirst({
    where: {
      organizationId,
      status: "ACTIVE",
      quickMessageTemplates: { not: Prisma.DbNull },
    },
    orderBy: { updatedAt: "desc" },
    select: { quickMessageTemplates: true },
  });

  if (property?.quickMessageTemplates) {
    return parseQuickMessageTemplates(property.quickMessageTemplates);
  }

  const fallback = await db.property.findFirst({
    where: { organizationId, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    select: { quickMessageTemplates: true },
  });

  return parseQuickMessageTemplates(fallback?.quickMessageTemplates);
}

export async function getOrganizationQuickMessageSettings(): Promise<QuickMessageSettingsForm> {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    return quickMessageTemplatesToFormFields({});
  }

  const templates = await loadOrgQuickMessageTemplates(scope.organizationId);
  return quickMessageTemplatesToFormFields(templates);
}

export async function getOrganizationQuickMessageTemplates(): Promise<QuickMessageTemplates> {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) return {};
  return loadOrgQuickMessageTemplates(scope.organizationId);
}

export async function saveOrganizationQuickMessageSettings(
  input: QuickMessageSettingsForm,
): Promise<QuickMessageSettingsForm> {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    throw new Error("No hay organización activa para guardar los mensajes.");
  }

  const templates = formFieldsToQuickMessageTemplates(input);

  await db.property.updateMany({
    where: { organizationId: scope.organizationId, status: "ACTIVE" },
    data: {
      quickMessageTemplates:
        templates === null ? Prisma.JsonNull : (templates as Prisma.InputJsonValue),
    },
  });

  return quickMessageTemplatesToFormFields(templates ?? {});
}

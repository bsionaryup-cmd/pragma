import { db } from "@/lib/db";
import { PLATFORM_OWNER_EMAIL } from "@/lib/platform/constants";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import type { User } from "@prisma/client";

export const PLATFORM_EPAYCO_ORG_NAME = "PRAGMA Platform (Epayco)";

/** Internal organization that stores platform-wide ePayco credentials (SaaS billing). */
export async function getOrCreatePlatformEpaycoOrganizationId(): Promise<string> {
  const existing = await db.organization.findFirst({
    where: { name: PLATFORM_EPAYCO_ORG_NAME },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.organization.create({
    data: { name: PLATFORM_EPAYCO_ORG_NAME },
    select: { id: true },
  });
  return created.id;
}

export async function resolvePlatformEpaycoOrganizationId(): Promise<string | null> {
  const row = await db.organization.findFirst({
    where: { name: PLATFORM_EPAYCO_ORG_NAME },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function requirePlatformOwnerForEpaycoSettings(): Promise<User> {
  const user = await db.user.findFirst({
    where: { email: PLATFORM_OWNER_EMAIL },
  });
  if (!user || !isSuperAdminOwner(user)) {
    throw new Error("Acceso denegado: configuración ePayco solo para Owner de plataforma");
  }
  return user;
}

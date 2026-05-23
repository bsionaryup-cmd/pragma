import { db } from "@/lib/db";
import { PLATFORM_OWNER_EMAIL } from "@/lib/platform/constants";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import type { User } from "@prisma/client";

const PLATFORM_WOMPI_ORG_NAME = "PRAGMA Platform (Wompi)";

/** Internal organization that stores platform-wide Wompi credentials (SaaS billing). */
export async function getOrCreatePlatformWompiOrganizationId(): Promise<string> {
  const existing = await db.organization.findFirst({
    where: { name: PLATFORM_WOMPI_ORG_NAME },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.organization.create({
    data: { name: PLATFORM_WOMPI_ORG_NAME },
    select: { id: true },
  });
  return created.id;
}

export async function resolvePlatformWompiOrganizationId(): Promise<string | null> {
  const row = await db.organization.findFirst({
    where: { name: PLATFORM_WOMPI_ORG_NAME },
    select: { id: true },
  });
  return row?.id ?? null;
}

export function isPlatformOwnerUser(user: Pick<User, "email" | "platformRole">): boolean {
  return isSuperAdminOwner(user);
}

export async function requirePlatformOwnerForWompiSettings(): Promise<User> {
  const user = await db.user.findFirst({
    where: { email: PLATFORM_OWNER_EMAIL },
  });
  if (!user || !isSuperAdminOwner(user)) {
    throw new Error("Acceso denegado: configuración Wompi solo para Owner de plataforma");
  }
  return user;
}

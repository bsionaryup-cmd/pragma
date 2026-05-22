import { OrganizationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { User } from "@prisma/client";
import { buildTenantContext } from "@/lib/platform/tenant-context";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";

export async function assertActiveTenantAccess(user: User): Promise<void> {
  if (isSuperAdminOwner(user)) {
    const ctx = await buildTenantContext(user);
    if (!ctx.isImpersonating) return;
    if (!ctx.organizationId) return;

    const org = await db.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { status: true },
    });
    if (org?.status === OrganizationStatus.SUSPENDED) {
      throw new Error("Tenant suspendido");
    }
    return;
  }

  if (!user.organizationId) return;

  const org = await db.organization.findUnique({
    where: { id: user.organizationId },
    select: { status: true },
  });

  if (org?.status === OrganizationStatus.SUSPENDED) {
    throw new Error("Tenant suspendido");
  }
}

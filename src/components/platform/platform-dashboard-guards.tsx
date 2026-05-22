import { redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import { buildTenantContext } from "@/lib/platform/tenant-context";
import { db } from "@/lib/db";
import { OrganizationStatus } from "@prisma/client";
import { ImpersonationBanner } from "@/components/platform/impersonation-banner";

export async function PlatformImpersonationBanner() {
  const user = await requireDbUser();
  if (!isSuperAdminOwner(user)) return null;

  const ctx = await buildTenantContext(user);
  if (!ctx.isImpersonating || !ctx.organizationId) return null;

  const org = await db.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { name: true },
  });

  return <ImpersonationBanner organizationName={org?.name ?? ""} />;
}

export async function enforceTenantDashboardAccess(user: Awaited<ReturnType<typeof requireDbUser>>) {
  if (isSuperAdminOwner(user)) {
    const ctx = await buildTenantContext(user);
    if (!ctx.isImpersonating) {
      redirect("/owner-dashboard");
    }
    return ctx;
  }

  if (user.organizationId) {
    const org = await db.organization.findUnique({
      where: { id: user.organizationId },
      select: { status: true },
    });
    if (org?.status === OrganizationStatus.SUSPENDED) {
      redirect("/account-suspended");
    }
  }

  return buildTenantContext(user);
}

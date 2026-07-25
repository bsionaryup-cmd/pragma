import { redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { resolvePostAuthHomePath } from "@/lib/auth/role-definitions.server";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import {
  isPlatformOwnerSelfServicePath,
  platformOwnerCanUseOwnTenantSettings,
} from "@/lib/platform/platform-owner-self-service";
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

export async function enforceTenantDashboardAccess(
  user: Awaited<ReturnType<typeof requireDbUser>>,
  pathname = "",
) {
  if (isSuperAdminOwner(user)) {
    const ctx = await buildTenantContext(user);
    if (!ctx.isImpersonating) {
      if (
        platformOwnerCanUseOwnTenantSettings(user) &&
        pathname &&
        isPlatformOwnerSelfServicePath(pathname)
      ) {
        return ctx;
      }
      redirect(resolvePostAuthHomePath(user));
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

    // Retail-only orgs must not enter PMS dashboards (shared Organization model).
    // Soft-fail when retail tables were eradicated from this DB (P2021) — PMS tenants
    // must still reach /panel after login.
    let retailStoreId: string | null = null;
    let propertyCount = 0;
    try {
      const [retailStore, count] = await Promise.all([
        db.retailStore.findFirst({
          where: {
            organizationId: user.organizationId,
            deletedAt: null,
            status: "ACTIVE",
          },
          select: { id: true },
        }),
        db.property.count({
          where: { organizationId: user.organizationId },
        }),
      ]);
      retailStoreId = retailStore?.id ?? null;
      propertyCount = count;
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: string }).code)
          : "";
      if (code !== "P2021") throw error;
      propertyCount = await db.property.count({
        where: { organizationId: user.organizationId },
      });
    }
    if (retailStoreId && propertyCount === 0) {
      redirect("/intiendas/dashboard");
    }
  }

  return buildTenantContext(user);
}

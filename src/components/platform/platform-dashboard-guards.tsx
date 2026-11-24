import { redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { resolvePostAuthHomePath } from "@/lib/auth/role-definitions.server";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import {
  isPlatformOwnerSelfServicePath,
  platformOwnerCanUseOwnTenantSettings,
} from "@/lib/platform/platform-owner-self-service";
import { resolveOwnerDashboardAccess } from "@/lib/platform/owner-dashboard-access";
import { buildTenantContext } from "@/lib/platform/tenant-context";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants";
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

function expectsImpersonationFromPath(pathname: string): boolean {
  // `/panel?impersonating=1` may arrive as pathname with query when proxy forwards it,
  // or as a marker segment from the continue bridge.
  return (
    pathname.includes("impersonating=1") ||
    pathname.includes("impersonation=1")
  );
}

export async function enforceTenantDashboardAccess(
  user: Awaited<ReturnType<typeof requireDbUser>>,
  pathname = "",
) {
  if (isSuperAdminOwner(user)) {
    const ctx = await buildTenantContext(user);
    const decision = resolveOwnerDashboardAccess({
      isImpersonating: ctx.isImpersonating,
      hasOwnOrganization: platformOwnerCanUseOwnTenantSettings(user),
      expectsImpersonation: expectsImpersonationFromPath(pathname),
      pathname,
      isSelfServicePath: Boolean(
        pathname && isPlatformOwnerSelfServicePath(pathname.split("?")[0] ?? ""),
      ),
    });

    if (decision.action === "allow-impersonation") {
      return ctx;
    }
    if (decision.action === "allow-own-tenant") {
      return ctx;
    }
    if (decision.action === "redirect-impersonation-failed") {
      redirect(
        `${OWNER_DASHBOARD_PATH}?impersonation_error=${encodeURIComponent("cookie_missing")}`,
      );
    }
    redirect(resolvePostAuthHomePath(user));
  }

  if (user.organizationId) {
    const org = await db.organization.findUnique({
      where: { id: user.organizationId },
      select: { status: true },
    });
    if (org?.status === OrganizationStatus.SUSPENDED) {
      redirect("/account-suspended");
    }

    // INTIENDAS retired: never divert PMS tenants to /intiendas even if a
    // legacy retail_store row still exists for the organization.
  }

  return buildTenantContext(user);
}

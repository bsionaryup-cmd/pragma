import { redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants";
import { readImpersonationSessionIdFromCookies } from "@/lib/platform/impersonation-cookie";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import { buildTenantContext } from "@/lib/platform/tenant-context";

export const dynamic = "force-dynamic";

/**
 * Bridge after Owner "Impersonar": verify the HttpOnly impersonation cookie
 * before entering /panel so a missing cookie cannot open the Owner's own tenant.
 */
export default async function ImpersonationContinuePage() {
  const user = await requireDbUser();
  if (!isSuperAdminOwner(user)) {
    redirect("/unauthorized");
  }

  const sessionId = await readImpersonationSessionIdFromCookies();
  if (!sessionId) {
    redirect(
      `${OWNER_DASHBOARD_PATH}?impersonation_error=${encodeURIComponent("cookie_missing")}`,
    );
  }

  const ctx = await buildTenantContext(user);
  if (!ctx.isImpersonating || !ctx.organizationId) {
    redirect(
      `${OWNER_DASHBOARD_PATH}?impersonation_error=${encodeURIComponent("session_inactive")}`,
    );
  }

  redirect("/panel?impersonating=1");
}

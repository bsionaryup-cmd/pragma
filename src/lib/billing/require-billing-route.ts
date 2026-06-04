import { redirect } from "next/navigation";
import {
  isBillingPathAllowed,
  isBillingRestrictedPath,
} from "@/lib/billing/billing-access";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";

/** Redirects to billing center when path is restricted and account is locked. */
export async function redirectIfBillingLocked(pathname: string): Promise<void> {
  if (!isBillingRestrictedPath(pathname)) return;
  const access = await getBillingAccessSnapshot();
  if (access.locked) {
    redirect("/settings/billing");
  }
}

/** Blocks the whole dashboard (except billing self-service) when subscription is locked. */
export async function enforceBillingAccessForDashboard(
  pathname: string,
): Promise<void> {
  if (!pathname || isBillingPathAllowed(pathname)) return;
  const access = await getBillingAccessSnapshot();
  if (access.locked) {
    redirect("/settings/billing");
  }
}

import { redirect } from "next/navigation";
import { isBillingRestrictedPath } from "@/lib/billing/billing-access";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";

/** Redirects to billing center when path is restricted and account is locked. */
export async function redirectIfBillingLocked(pathname: string): Promise<void> {
  if (!isBillingRestrictedPath(pathname)) return;
  const access = await getBillingAccessSnapshot();
  if (access.locked) {
    redirect("/settings/billing");
  }
}

import { redirect } from "next/navigation";
import {
  BILLING_PAYWALL_PATH,
  isBillingLockedAllowedPath,
  isBillingRestrictedPath,
} from "@/lib/billing/billing-access";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";

/** Redirects to billing center when path is restricted and account is locked. */
export async function redirectIfBillingLocked(pathname: string): Promise<void> {
  if (!isBillingRestrictedPath(pathname)) return;
  const access = await getBillingAccessSnapshot();
  if (access.locked) {
    redirect(BILLING_PAYWALL_PATH);
  }
}

/** Cuenta bloqueada: solo Mi Suscripción (pago). Cualquier otra ruta redirige al cobro. */
export async function enforceBillingAccessForDashboard(
  pathname: string,
): Promise<void> {
  const access = await getBillingAccessSnapshot();
  if (!access.locked) return;

  const path = pathname?.trim() || "/panel";
  if (isBillingLockedAllowedPath(path)) return;

  redirect(BILLING_PAYWALL_PATH);
}

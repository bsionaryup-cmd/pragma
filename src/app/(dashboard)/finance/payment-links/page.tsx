import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PaymentLinksHub } from "@/features/payments/components/payment-links-hub";
import { hasPermission, requirePermission } from "@/lib/auth";
import { redirectIfMissingPlanFeature } from "@/lib/billing/require-plan-feature";
import { loadGuestPaymentLinksForHub } from "@/services/payments/guest-payment-link.service";
import type { AppUserRole } from "@/types/auth";

export default async function PaymentLinksPage() {
  const auth = await requirePermission("finance:read");
  await redirectIfMissingPlanFeature("finance");

  const links = await loadGuestPaymentLinksForHub();
  const canWrite = hasPermission(auth.role as AppUserRole, "finance:write");

  return (
    <ModuleShellFlow>
      <PaymentLinksHub initialLinks={links} canWrite={canWrite} />
    </ModuleShellFlow>
  );
}

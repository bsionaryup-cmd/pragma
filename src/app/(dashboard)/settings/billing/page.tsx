import dynamic from "next/dynamic";
import { hasPermission, requireDbUser, requirePermission } from "@/lib/auth";
import { BillingPaywallContactAdmin } from "@/components/billing/billing-paywall-contact-admin";
import { BillingCheckoutFeedback } from "@/features/billing/components/billing-checkout-feedback";
import { reconcileBillingPaymentReturnAction } from "@/features/billing/actions/billing.actions";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import { getBillingDashboard } from "@/modules/billing/services/dashboard.service";
import { PragmaLoader } from "@/components/brand/pragma-loader";
import type { AppUserRole } from "@/types/auth";

const BillingDashboard = dynamic(
  () =>
    import("@/features/billing/components/billing-dashboard").then((m) => ({
      default: m.BillingDashboard,
    })),
  {
    loading: () => (
      <div className="flex min-h-[50vh] items-center justify-center">
        <PragmaLoader size="lg" />
      </div>
    ),
  },
);

type BillingSettingsPageProps = {
  searchParams: Promise<{
    paid?: string;
    upgrade?: string;
    checkout?: string;
    ref?: string;
    x_cod_response?: string;
    x_cod_respuesta?: string;
  }>;
};

export default async function BillingSettingsPage({
  searchParams,
}: BillingSettingsPageProps) {
  const user = await requireDbUser();
  const params = await searchParams;
  const canManageBilling = hasPermission(user.role as AppUserRole, "billing:manage");

  if (params.paid === "1" && canManageBilling) {
    await reconcileBillingPaymentReturnAction({
      reference: params.ref,
      epaycoResponseCode: params.x_cod_response ?? params.x_cod_respuesta,
    });
  }

  const access = await getBillingAccessSnapshot();

  if (access.locked && !canManageBilling) {
    return <BillingPaywallContactAdmin />;
  }

  if (!canManageBilling) {
    await requirePermission("billing:manage");
  }

  const data = await getBillingDashboard();

  return (
    <>
      <BillingCheckoutFeedback
        paid={params.paid === "1"}
        paymentReference={params.ref}
        epaycoResponseCode={params.x_cod_response ?? params.x_cod_respuesta}
      />
      <BillingDashboard
        data={data}
        upgradeFeature={params.upgrade}
        showDevActivate={process.env.NODE_ENV !== "production"}
        autoCheckout={params.checkout === "1"}
      />
    </>
  );
}

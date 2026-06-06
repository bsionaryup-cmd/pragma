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
    ref_payco?: string;
    x_ref_payco?: string;
    x_id_invoice?: string;
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

  const epaycoRefPayco = params.ref_payco ?? params.x_ref_payco;
  const paymentReference = params.ref ?? params.x_id_invoice;
  const shouldReconcileReturn =
    canManageBilling &&
    (params.paid === "1" || Boolean(epaycoRefPayco) || Boolean(paymentReference));

  if (shouldReconcileReturn) {
    await reconcileBillingPaymentReturnAction({
      reference: paymentReference,
      epaycoResponseCode: params.x_cod_response ?? params.x_cod_respuesta,
      epaycoRefPayco,
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
        paid={params.paid === "1" || Boolean(epaycoRefPayco)}
        paymentReference={paymentReference}
        epaycoResponseCode={params.x_cod_response ?? params.x_cod_respuesta}
        epaycoRefPayco={epaycoRefPayco}
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

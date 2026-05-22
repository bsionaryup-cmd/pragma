import { requirePermission } from "@/lib/auth";
import { BillingCheckoutFeedback } from "@/features/billing/components/billing-checkout-feedback";
import { BillingDashboard } from "@/features/billing/components/billing-dashboard";
import { getBillingDashboard } from "@/modules/billing/services/dashboard.service";

type BillingSettingsPageProps = {
  searchParams: Promise<{ paid?: string }>;
};

export default async function BillingSettingsPage({
  searchParams,
}: BillingSettingsPageProps) {
  await requirePermission("billing:manage");
  const params = await searchParams;
  const data = await getBillingDashboard();

  return (
    <>
      <BillingCheckoutFeedback paid={params.paid === "1"} />
      <BillingDashboard
        data={data}
        showDevActivate={process.env.NODE_ENV !== "production"}
      />
    </>
  );
}

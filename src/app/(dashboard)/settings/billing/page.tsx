import dynamic from "next/dynamic";
import { requirePermission } from "@/lib/auth";
import { BillingCheckoutFeedback } from "@/features/billing/components/billing-checkout-feedback";
import { getBillingDashboard } from "@/modules/billing/services/dashboard.service";
import { PragmaLoader } from "@/components/brand/pragma-loader";

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
  searchParams: Promise<{ paid?: string; upgrade?: string }>;
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
        upgradeFeature={params.upgrade}
        showDevActivate={process.env.NODE_ENV !== "production"}
      />
    </>
  );
}

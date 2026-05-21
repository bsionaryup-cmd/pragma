import { requireRole } from "@/lib/auth";
import { BillingCenter } from "@/features/billing/components/billing-center";
import { getBillingOverview } from "@/services/billing/billing.service";

export default async function BillingSettingsPage() {
  await requireRole("ADMIN");
  const overview = await getBillingOverview();
  return (
    <BillingCenter
      overview={overview}
      showDevActivate={process.env.NODE_ENV !== "production"}
    />
  );
}

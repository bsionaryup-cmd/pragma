import { requirePermission } from "@/lib/auth";
import { redirectIfBillingLocked } from "@/lib/billing/require-billing-route";

export default async function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("integrations:read");
  await redirectIfBillingLocked("/integrations");
  return children;
}

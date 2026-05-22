import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FinanceView } from "@/components/finance/finance-view";
import { hasPermission, requireAnyPermission } from "@/lib/auth";
import { getServerLocale } from "@/i18n/locale.server";
import { getFinanceOverview } from "@/services/finance/finance.service";
import type { AppUserRole } from "@/types/auth";
import { redirectIfBillingLocked } from "@/lib/billing/require-billing-route";

export const metadata: Metadata = {
  title: "Finanzas",
  robots: { index: false, follow: false },
};

export default async function FinancePage() {
  const locale = await getServerLocale();
  const [auth, data] = await Promise.all([
    requireAnyPermission("finance:read", "finance:operations:read"),
    getFinanceOverview(locale),
  ]);
  await redirectIfBillingLocked("/finance");

  const role = auth.role as AppUserRole;
  const hasFullFinance = hasPermission(role, "finance:read");

  if (!hasFullFinance && !hasPermission(role, "finance:operations:read")) {
    redirect("/unauthorized");
  }

  const canWrite = hasPermission(role, "finance:write");
  const scope = hasFullFinance ? "full" : "operations";

  return <FinanceView data={data} canWrite={canWrite} scope={scope} />;
}

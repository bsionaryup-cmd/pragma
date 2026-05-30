import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { hasPermission, requireAnyPermission } from "@/lib/auth";
import { isBillingRestrictedPath } from "@/lib/billing/billing-access";
import { getServerLocale } from "@/i18n/locale.server";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import { getFinanceOverview } from "@/services/finance/finance.service";
import type { AppUserRole } from "@/types/auth";
import { redirectIfMissingPlanFeature } from "@/lib/billing/require-plan-feature";
import FinanceLoading from "./loading";

const FinanceView = dynamic(
  () =>
    import("@/components/finance/finance-view").then((m) => ({
      default: m.FinanceView,
    })),
  { loading: () => <FinanceLoading /> },
);

export const metadata: Metadata = {
  title: "Finanzas",
  robots: { index: false, follow: false },
};

type FinancePageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function FinancePage({ searchParams }: FinancePageProps) {
  await redirectIfMissingPlanFeature("finance", "/finance");

  const [locale, billing, params] = await Promise.all([
    getServerLocale(),
    getBillingAccessSnapshot(),
    searchParams,
  ]);

  if (billing.locked && isBillingRestrictedPath("/finance")) {
    redirect("/settings/billing");
  }

  const [auth, data] = await Promise.all([
    requireAnyPermission("finance:read", "finance:operations:read"),
    getFinanceOverview(locale, { month: params.month }),
  ]);

  const role = auth.role as AppUserRole;
  const hasFullFinance = hasPermission(role, "finance:read");

  if (!hasFullFinance && !hasPermission(role, "finance:operations:read")) {
    redirect("/unauthorized");
  }

  const canWrite = hasPermission(role, "finance:write");
  const scope = hasFullFinance ? "full" : "operations";

  return <FinanceView data={data} canWrite={canWrite} scope={scope} />;
}

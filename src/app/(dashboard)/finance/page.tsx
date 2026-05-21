import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FinanceView } from "@/components/finance/finance-view";
import { hasPermission, requireDbUser } from "@/lib/auth";
import { getServerLocale } from "@/i18n/locale.server";
import { getFinanceOverview } from "@/services/finance/finance.service";

export const metadata: Metadata = {
  title: "Finanzas",
  robots: { index: false, follow: false },
};

export default async function FinancePage() {
  const user = await requireDbUser();
  if (!hasPermission(user.role, "finance:read")) {
    redirect("/unauthorized");
  }

  const locale = await getServerLocale();
  const data = await getFinanceOverview(locale);

  const canWrite = hasPermission(user.role, "finance:write");

  return <FinanceView data={data} canWrite={canWrite} />;
}

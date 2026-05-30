import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentHistoryPanel } from "@/features/payments/components/payment-history-panel";
import { listOrganizationPaymentHistory } from "@/services/payments/payment-history.service";
import { getServerLocale } from "@/i18n/locale.server";
import { getDictionary } from "@/i18n/get-dictionary";
import { createTranslator } from "@/i18n/translate";

export default async function PaymentHistoryPage() {
  await requirePermission("finance:read");
  const locale = await getServerLocale();
  const t = createTranslator(await getDictionary(locale));
  const rows = await listOrganizationPaymentHistory(locale);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-5 pb-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow={t("finance.eyebrow")}
        title={t("payments.historyTitle")}
        description={t("payments.historyDescription")}
        actions={
          <Link
            href="/finance/payment-links"
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
          >
            {t("finance.links.chargeLinks")}
          </Link>
        }
      />
      <PaymentHistoryPanel initialRows={rows} />
    </div>
  );
}

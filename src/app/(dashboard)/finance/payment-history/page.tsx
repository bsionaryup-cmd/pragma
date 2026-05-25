import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentHistoryPanel } from "@/features/payments/components/payment-history-panel";
import { listOrganizationPaymentHistory } from "@/services/payments/payment-history.service";
import { getServerLocale } from "@/i18n/locale.server";

export default async function PaymentHistoryPage() {
  await requirePermission("finance:read");
  const locale = await getServerLocale();
  const rows = await listOrganizationPaymentHistory(locale);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-5 pb-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Finanzas"
        title="Historial de cobros"
        description="Todos los Payment Links del tenant con categoría contable y estado."
        actions={
          <Link
            href="/finance/payment-links"
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50"
          >
            Payment Links
          </Link>
        }
      />
      <PaymentHistoryPanel initialRows={rows} />
    </div>
  );
}

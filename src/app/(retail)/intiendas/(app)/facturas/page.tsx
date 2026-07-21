import { getInvoicesData } from "@/domains/retail/services/retail-ui.service";
import { TiendasOnInvoicesTable } from "@/domains/retail/ui/tiendas-on/invoices-table";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export const dynamic = "force-dynamic";

export default async function RetailInvoicesPage() {
  const invoices = await getInvoicesData();
  return (
    <TiendasOnScreen title="Facturas">
      <TiendasOnInvoicesTable invoices={invoices} />
    </TiendasOnScreen>
  );
}

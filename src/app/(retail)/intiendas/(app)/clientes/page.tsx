import { getCustomersData } from "@/domains/retail/services/retail-ui.service";
import { TiendasOnCustomersTable } from "@/domains/retail/ui/tiendas-on/customers-table";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default async function RetailCustomersPage() {
  const customers = await getCustomersData();
  return (
    <TiendasOnScreen title="Clientes">
      <TiendasOnCustomersTable
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          alias: c.alias,
          documentId: c.documentId,
          phone: c.phone,
          creditBalance: c.creditBalance,
          lastPaymentAt: c.lastPaymentAt,
        }))}
      />
    </TiendasOnScreen>
  );
}

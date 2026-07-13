import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";
import { TiendasOnHub } from "@/domains/retail/ui/tiendas-on/hub";

export default async function RetailDashboardPage() {
  const ctx = await requireRetailContext();
  return (
    <TiendasOnHub
      storeName={ctx.storeName}
      storeCode={ctx.store.id.slice(-8).toUpperCase()}
      userLabel={ctx.firstName ?? ctx.email}
    />
  );
}

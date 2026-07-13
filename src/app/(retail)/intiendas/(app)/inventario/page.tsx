import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";
import { TiendasOnProductsHub } from "@/domains/retail/ui/tiendas-on/products-hub";

export default async function RetailInventoryHubPage() {
  const ctx = await requireRetailContext();
  return <TiendasOnProductsHub storeCode={ctx.store.id.slice(-8).toUpperCase()} />;
}

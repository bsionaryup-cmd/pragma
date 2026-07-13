import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";
import { getCustomersData, getProductsData, getSettingsData } from "@/domains/retail/services/retail-ui.service";
import { TiendasOnPos } from "@/domains/retail/ui/tiendas-on/pos";

export default async function RetailSalesPage() {
  const ctx = await requireRetailContext();
  const [{ products }, customers, settings] = await Promise.all([
    getProductsData(),
    getCustomersData(),
    getSettingsData(),
  ]);
  const openSession = settings.registers.flatMap((register) => register.sessions)[0];

  return (
    <TiendasOnPos
      products={products.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        barcode: product.barcode,
        isFavorite: product.isFavorite,
      }))}
      customers={customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        creditBalance: customer.creditBalance,
        documentId: customer.documentId,
      }))}
      cashSessionId={openSession?.id}
      storeCode={ctx.store.id.slice(-8).toUpperCase()}
    />
  );
}

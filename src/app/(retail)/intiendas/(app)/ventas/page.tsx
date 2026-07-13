import { CashGateBanner, hasOpenCash } from "@/domains/retail/ui/tiendas-on/cash-gate";
import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";
import {
  getCustomersData,
  getProductsData,
  getSettingsData,
  getSuspendedSalesData,
} from "@/domains/retail/services/retail-ui.service";
import { TiendasOnPos } from "@/domains/retail/ui/tiendas-on/pos";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default async function RetailSalesPage() {
  const ctx = await requireRetailContext();
  const cashOpen = await hasOpenCash();
  if (!cashOpen) {
    return (
      <TiendasOnScreen title="Ventas">
        <CashGateBanner moduleLabel="Ventas" />
      </TiendasOnScreen>
    );
  }

  const [{ products }, customers, settings, suspendedSales] = await Promise.all([
    getProductsData(),
    getCustomersData(),
    getSettingsData(),
    getSuspendedSalesData(),
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
        sku: product.sku,
        imageUrl: product.imageUrl,
      }))}
      customers={customers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        creditBalance: customer.creditBalance,
        documentId: customer.documentId,
      }))}
      suspendedSales={suspendedSales}
      cashSessionId={openSession?.id}
      storeCode={ctx.store.id.slice(-8).toUpperCase()}
    />
  );
}

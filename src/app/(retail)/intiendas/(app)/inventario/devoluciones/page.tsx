import { adjustStockAction } from "@/domains/retail/actions/retail.actions";
import { getProductsData } from "@/domains/retail/services/retail-ui.service";
import { TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default async function RetailReturnsPage() {
  const { products } = await getProductsData();
  return (
    <TiendasOnScreen title="Devoluciones" backHref="/intiendas/inventario">
      <div className="mx-auto max-w-lg p-4">
        <section className="rounded-lg border border-[#d5dce6] bg-white p-5">
          <h2 className="mb-2 text-lg font-semibold text-[#2d3748]">Devolver a inventario</h2>
          <p className="mb-4 text-base text-[#718096]">
            Registra unidades que regresan al stock en un solo paso.
          </p>
          <form action={adjustStockAction} className="space-y-3">
            <select name="productId" required className="h-11 w-full rounded-md border px-3 text-base">
              <option value="">Producto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · stock {p.stock}
                </option>
              ))}
            </select>
            <input type="hidden" name="note" value="Devolución" />
            <input
              name="quantity"
              type="number"
              min="1"
              required
              placeholder="Cantidad a devolver"
              className="h-11 w-full rounded-md border px-3 text-base"
            />
            <TiendasOnPrimaryButton type="submit" className="w-full text-base">
              Registrar devolución
            </TiendasOnPrimaryButton>
          </form>
        </section>
      </div>
    </TiendasOnScreen>
  );
}

import { adjustStockAction } from "@/domains/retail/actions/retail.actions";
import { getProductsData } from "@/domains/retail/services/retail-ui.service";
import {
  TiendasOnTable,
  TiendasOnTableHead,
  TiendasOnTd,
  TiendasOnTh,
} from "@/domains/retail/ui/tiendas-on/data-display";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default async function RetailInventoryAdjustPage() {
  const { products } = await getProductsData();
  return (
    <TiendasOnScreen title="Ajuste de inventario" backHref="/intiendas/inventario">
      <TiendasOnTable>
        <TiendasOnTableHead>
          <TiendasOnTh className="text-base">Producto</TiendasOnTh>
          <TiendasOnTh className="text-base">Stock actual</TiendasOnTh>
          <TiendasOnTh className="text-base">Ajuste (+/-)</TiendasOnTh>
        </TiendasOnTableHead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <TiendasOnTd className="text-base font-medium uppercase">{product.name}</TiendasOnTd>
              <TiendasOnTd className="text-base">{product.stock}</TiendasOnTd>
              <TiendasOnTd>
                <form action={adjustStockAction} className="flex items-center gap-2">
                  <input type="hidden" name="productId" value={product.id} />
                  <input
                    name="quantity"
                    type="number"
                    required
                    placeholder="0"
                    className="h-10 w-24 rounded border border-[#c5ced8] px-3 text-base"
                  />
                  <button
                    type="submit"
                    className="h-10 rounded-md bg-pragma-electric px-4 text-base font-semibold text-white"
                  >
                    Aplicar
                  </button>
                </form>
              </TiendasOnTd>
            </tr>
          ))}
        </tbody>
      </TiendasOnTable>
    </TiendasOnScreen>
  );
}

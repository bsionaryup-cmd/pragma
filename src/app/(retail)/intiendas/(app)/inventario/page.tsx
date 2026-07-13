import {
  adjustStockAction,
  createCategoryAction,
  createProductAction,
} from "@/domains/retail/actions/retail.actions";
import { getProductsData } from "@/domains/retail/services/retail-ui.service";
import {
  TiendasOnTable,
  TiendasOnTableHead,
  TiendasOnTd,
  TiendasOnTh,
} from "@/domains/retail/ui/tiendas-on/data-display";
import { formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import { TiendasOnActionBar, TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default async function RetailInventoryPage() {
  const { products, categories } = await getProductsData();
  return (
    <TiendasOnScreen title="Productos">
      <TiendasOnActionBar>
        <p className="text-sm text-[#718096]">{products.length} productos registrados</p>
        <TiendasOnPrimaryButton type="button">Nuevo Producto</TiendasOnPrimaryButton>
      </TiendasOnActionBar>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <TiendasOnTable>
          <TiendasOnTableHead>
            <TiendasOnTh>Producto</TiendasOnTh>
            <TiendasOnTh>Categoría</TiendasOnTh>
            <TiendasOnTh>Precio</TiendasOnTh>
            <TiendasOnTh>Stock</TiendasOnTh>
            <TiendasOnTh>Ajuste</TiendasOnTh>
          </TiendasOnTableHead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <TiendasOnTd>
                  <p className="font-medium uppercase">{product.name}</p>
                  <p className="text-xs text-[#94a3b8]">{product.sku || product.barcode || "—"}</p>
                </TiendasOnTd>
                <TiendasOnTd>{product.category?.name ?? "—"}</TiendasOnTd>
                <TiendasOnTd>{formatIntiendasMoney(product.price)}</TiendasOnTd>
                <TiendasOnTd>{product.stock}</TiendasOnTd>
                <TiendasOnTd>
                  <form action={adjustStockAction} className="flex gap-2">
                    <input type="hidden" name="productId" value={product.id} />
                    <input
                      name="quantity"
                      type="number"
                      className="h-8 w-16 rounded border px-2 text-sm"
                      placeholder="+/-"
                      required
                    />
                    <button type="submit" className="text-sm text-pragma-electric">
                      Aplicar
                    </button>
                  </form>
                </TiendasOnTd>
              </tr>
            ))}
          </tbody>
        </TiendasOnTable>

        <div className="space-y-4">
          <div className="rounded-md border border-[#d5dce6] bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-[#2d3748]">Nuevo producto</h3>
            <form action={createProductAction} className="space-y-3">
              <input name="name" required placeholder="Nombre" className="h-9 w-full rounded border px-3 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input name="sku" placeholder="SKU" className="h-9 rounded border px-3 text-sm" />
                <input name="barcode" placeholder="Barras" className="h-9 rounded border px-3 text-sm" />
              </div>
              <select name="categoryId" className="h-9 w-full rounded border px-3 text-sm">
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="cost" type="number" min="0" step="0.01" placeholder="Costo" className="h-9 rounded border px-3 text-sm" />
                <input name="price" type="number" min="0" step="0.01" placeholder="Precio" required className="h-9 rounded border px-3 text-sm" />
                <input name="stock" type="number" placeholder="Stock" className="h-9 rounded border px-3 text-sm" />
                <input name="minStock" type="number" placeholder="Mínimo" className="h-9 rounded border px-3 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isFavorite" /> Favorito en POS
              </label>
              <TiendasOnPrimaryButton type="submit" className="w-full">
                Guardar producto
              </TiendasOnPrimaryButton>
            </form>
          </div>

          <div className="rounded-md border border-[#d5dce6] bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-[#2d3748]">Categorías</h3>
            <form action={createCategoryAction} className="flex gap-2">
              <input name="name" required placeholder="Nueva categoría" className="h-9 flex-1 rounded border px-3 text-sm" />
              <TiendasOnPrimaryButton type="submit" className="h-9 px-4">
                Agregar
              </TiendasOnPrimaryButton>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((category) => (
                <span
                  key={category.id}
                  className="rounded-full border border-[#c5ced8] px-2 py-1 text-xs text-[#4a5568]"
                >
                  {category.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TiendasOnScreen>
  );
}

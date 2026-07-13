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

export default async function RetailProductsListPage() {
  const { products, categories } = await getProductsData();
  return (
    <TiendasOnScreen title="Productos" backHref="/intiendas/inventario">
      <TiendasOnActionBar>
        <p className="text-base text-[#718096]">{products.length} productos registrados</p>
        <TiendasOnPrimaryButton type="button" className="text-base">
          Nuevo Producto
        </TiendasOnPrimaryButton>
      </TiendasOnActionBar>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <TiendasOnTable>
          <TiendasOnTableHead>
            <TiendasOnTh className="text-base">Producto</TiendasOnTh>
            <TiendasOnTh className="text-base">Categoría</TiendasOnTh>
            <TiendasOnTh className="text-base">Precio</TiendasOnTh>
            <TiendasOnTh className="text-base">Stock</TiendasOnTh>
            <TiendasOnTh className="text-base">Ajuste</TiendasOnTh>
          </TiendasOnTableHead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <TiendasOnTd>
                  <p className="text-base font-medium uppercase">{product.name}</p>
                  <p className="text-sm text-[#94a3b8]">{product.sku || product.barcode || "—"}</p>
                </TiendasOnTd>
                <TiendasOnTd className="text-base">{product.category?.name ?? "—"}</TiendasOnTd>
                <TiendasOnTd className="text-base">{formatIntiendasMoney(product.price)}</TiendasOnTd>
                <TiendasOnTd className="text-base">{product.stock}</TiendasOnTd>
                <TiendasOnTd>
                  <form action={adjustStockAction} className="flex gap-2">
                    <input type="hidden" name="productId" value={product.id} />
                    <input
                      name="quantity"
                      type="number"
                      className="h-9 w-20 rounded border px-2 text-base"
                      placeholder="+/-"
                      required
                    />
                    <button type="submit" className="text-base text-pragma-electric">
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
            <h3 className="mb-3 text-base font-semibold text-[#2d3748]">Nuevo producto</h3>
            <form action={createProductAction} className="space-y-3">
              <input
                name="name"
                required
                placeholder="Nombre"
                className="h-11 w-full rounded border px-3 text-base"
              />
              <div className="grid grid-cols-2 gap-2">
                <input name="sku" placeholder="SKU" className="h-11 rounded border px-3 text-base" />
                <input
                  name="barcode"
                  placeholder="Barras"
                  className="h-11 rounded border px-3 text-base"
                />
              </div>
              <select name="categoryId" className="h-11 w-full rounded border px-3 text-base">
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Costo"
                  className="h-11 rounded border px-3 text-base"
                />
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Precio"
                  required
                  className="h-11 rounded border px-3 text-base"
                />
                <input
                  name="stock"
                  type="number"
                  placeholder="Stock"
                  className="h-11 rounded border px-3 text-base"
                />
                <input
                  name="minStock"
                  type="number"
                  placeholder="Mínimo"
                  className="h-11 rounded border px-3 text-base"
                />
              </div>
              <label className="flex items-center gap-2 text-base">
                <input type="checkbox" name="isFavorite" /> Favorito en POS
              </label>
              <TiendasOnPrimaryButton type="submit" className="w-full text-base">
                Guardar producto
              </TiendasOnPrimaryButton>
            </form>
          </div>

          <div className="rounded-md border border-[#d5dce6] bg-white p-4">
            <h3 className="mb-3 text-base font-semibold text-[#2d3748]">Categorías</h3>
            <form action={createCategoryAction} className="flex gap-2">
              <input
                name="name"
                required
                placeholder="Nueva categoría"
                className="h-11 flex-1 rounded border px-3 text-base"
              />
              <TiendasOnPrimaryButton type="submit" className="h-11 px-4 text-base">
                Agregar
              </TiendasOnPrimaryButton>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((category) => (
                <span
                  key={category.id}
                  className="rounded-full border border-[#c5ced8] px-3 py-1.5 text-sm text-[#4a5568]"
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

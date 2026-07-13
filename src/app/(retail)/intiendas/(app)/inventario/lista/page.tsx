import {
  adjustStockAction,
  createCategoryAction,
  createProductAction,
  deleteProductAction,
  updateProductAction,
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
  const { products, categories, suppliers } = await getProductsData();
  return (
    <TiendasOnScreen title="Productos" backHref="/intiendas/inventario">
      <TiendasOnActionBar>
        <p className="text-base text-[#718096]">{products.length} productos</p>
        <a href="#nuevo-producto">
          <TiendasOnPrimaryButton type="button" className="text-base">
            Nuevo Producto
          </TiendasOnPrimaryButton>
        </a>
      </TiendasOnActionBar>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_340px]">
        <TiendasOnTable>
          <TiendasOnTableHead>
            <TiendasOnTh className="text-base">Producto</TiendasOnTh>
            <TiendasOnTh className="text-base">Precio</TiendasOnTh>
            <TiendasOnTh className="text-base">Stock</TiendasOnTh>
            <TiendasOnTh className="text-base">Mín / Ideal</TiendasOnTh>
            <TiendasOnTh className="text-base">Acciones</TiendasOnTh>
          </TiendasOnTableHead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <TiendasOnTd>
                  <div className="flex items-center gap-3">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="size-12 rounded object-cover"
                      />
                    ) : (
                      <div className="flex size-12 items-center justify-center rounded bg-[#eef3f9] text-xs text-[#94a3b8]">
                        Sin foto
                      </div>
                    )}
                    <div>
                      <p className="text-base font-medium uppercase">{product.name}</p>
                      <p className="text-sm text-[#94a3b8]">
                        {product.sku || product.barcode || "—"} ·{" "}
                        {product.category?.name ?? "Sin categoría"}
                      </p>
                    </div>
                  </div>
                </TiendasOnTd>
                <TiendasOnTd className="text-base">{formatIntiendasMoney(product.price)}</TiendasOnTd>
                <TiendasOnTd className="text-base">{product.stock}</TiendasOnTd>
                <TiendasOnTd className="text-base">
                  {product.minStock} / {product.idealStock}
                </TiendasOnTd>
                <TiendasOnTd>
                  <div className="space-y-2">
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
                        Ajuste
                      </button>
                    </form>
                    <details className="text-sm">
                      <summary className="cursor-pointer text-pragma-electric">Editar</summary>
                      <form action={updateProductAction} className="mt-2 space-y-2 rounded border p-2">
                        <input type="hidden" name="id" value={product.id} />
                        <input name="name" defaultValue={product.name} required className="h-9 w-full rounded border px-2" />
                        <div className="grid grid-cols-2 gap-2">
                          <input name="sku" defaultValue={product.sku ?? ""} placeholder="SKU" className="h-9 rounded border px-2" />
                          <input name="barcode" defaultValue={product.barcode ?? ""} placeholder="Barras" className="h-9 rounded border px-2" />
                          <input name="cost" type="number" step="0.01" defaultValue={product.cost} className="h-9 rounded border px-2" />
                          <input name="price" type="number" step="0.01" defaultValue={product.price} required className="h-9 rounded border px-2" />
                          <input name="minStock" type="number" defaultValue={product.minStock} className="h-9 rounded border px-2" />
                          <input name="idealStock" type="number" defaultValue={product.idealStock} className="h-9 rounded border px-2" />
                        </div>
                        <input name="imageUrl" defaultValue={product.imageUrl ?? ""} placeholder="URL foto" className="h-9 w-full rounded border px-2" />
                        <select name="categoryId" defaultValue={product.categoryId ?? ""} className="h-9 w-full rounded border px-2">
                          <option value="">Sin categoría</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <select name="primarySupplierId" defaultValue={product.primarySupplierId ?? ""} className="h-9 w-full rounded border px-2">
                          <option value="">Sin proveedor</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="isFavorite" defaultChecked={product.isFavorite} /> Favorito
                        </label>
                        <TiendasOnPrimaryButton type="submit" className="h-9 w-full text-sm">Guardar</TiendasOnPrimaryButton>
                      </form>
                    </details>
                    <form action={deleteProductAction}>
                      <input type="hidden" name="id" value={product.id} />
                      <button type="submit" className="text-sm text-red-500">Eliminar</button>
                    </form>
                  </div>
                </TiendasOnTd>
              </tr>
            ))}
          </tbody>
        </TiendasOnTable>

        <div className="space-y-4" id="nuevo-producto">
          <div className="rounded-md border border-[#d5dce6] bg-white p-4">
            <h3 className="mb-3 text-base font-semibold text-[#2d3748]">Nuevo producto</h3>
            <form action={createProductAction} className="space-y-3">
              <input name="name" required placeholder="Nombre" className="h-11 w-full rounded border px-3 text-base" />
              <div className="grid grid-cols-2 gap-2">
                <input name="sku" placeholder="Código / SKU" className="h-11 rounded border px-3 text-base" />
                <input name="barcode" placeholder="Barras" className="h-11 rounded border px-3 text-base" />
              </div>
              <input name="imageUrl" placeholder="URL fotografía" className="h-11 w-full rounded border px-3 text-base" />
              <select name="categoryId" className="h-11 w-full rounded border px-3 text-base">
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select name="primarySupplierId" className="h-11 w-full rounded border px-3 text-base">
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="cost" type="number" min="0" step="0.01" placeholder="Costo" className="h-11 rounded border px-3 text-base" />
                <input name="price" type="number" min="0" step="0.01" placeholder="Precio" required className="h-11 rounded border px-3 text-base" />
                <input name="stock" type="number" placeholder="Existencia" className="h-11 rounded border px-3 text-base" />
                <input name="minStock" type="number" placeholder="Stock mínimo" className="h-11 rounded border px-3 text-base" />
                <input name="idealStock" type="number" placeholder="Stock ideal" className="h-11 rounded border px-3 text-base" />
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
              <input name="name" required placeholder="Nueva categoría" className="h-11 flex-1 rounded border px-3 text-base" />
              <TiendasOnPrimaryButton type="submit" className="h-11 px-4 text-base">Agregar</TiendasOnPrimaryButton>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((category) => (
                <span key={category.id} className="rounded-full border border-pragma-electric/30 bg-pragma-electric/5 px-3 py-1.5 text-sm text-pragma-electric">
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

import {
  createWarehouseAction,
  deleteWarehouseAction,
  transferStockAction,
  updateWarehouseAction,
} from "@/domains/retail/actions/retail.actions";
import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";
import { getProductsData } from "@/domains/retail/services/retail-ui.service";
import { listWarehouses } from "@/domains/retail/services/warehouse.service";
import { TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default async function RetailTransferPage() {
  const ctx = await requireRetailContext();
  const [warehouses, { products }] = await Promise.all([
    listWarehouses(ctx.store.id),
    getProductsData(),
  ]);

  return (
    <TiendasOnScreen title="Traslado de Productos" backHref="/intiendas/inventario">
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[#d5dce6] bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-[#2d3748]">Trasladar</h2>
          <form action={transferStockAction} className="space-y-3">
            <select name="productId" required className="h-11 w-full rounded-md border px-3 text-base">
              <option value="">Producto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · stock {p.stock}
                </option>
              ))}
            </select>
            <select name="fromWarehouseId" required className="h-11 w-full rounded-md border px-3 text-base">
              <option value="">Desde bodega</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}{w.isDefault ? " (Principal)" : ""}
                </option>
              ))}
            </select>
            <select name="toWarehouseId" required className="h-11 w-full rounded-md border px-3 text-base">
              <option value="">Hacia bodega</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}{w.isDefault ? " (Principal)" : ""}
                </option>
              ))}
            </select>
            <input
              name="quantity"
              type="number"
              min="1"
              required
              placeholder="Cantidad"
              className="h-11 w-full rounded-md border px-3 text-base"
            />
            <TiendasOnPrimaryButton type="submit" className="w-full text-base">
              Trasladar
            </TiendasOnPrimaryButton>
          </form>
        </section>

        <section className="rounded-lg border border-[#d5dce6] bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-[#2d3748]">Bodegas</h2>
          <form action={createWarehouseAction} className="mb-4 flex gap-2">
            <input
              name="name"
              required
              placeholder="Nueva bodega"
              className="h-11 flex-1 rounded-md border px-3 text-base"
            />
            <TiendasOnPrimaryButton type="submit" className="h-11 text-base">
              Crear
            </TiendasOnPrimaryButton>
          </form>
          <ul className="space-y-3">
            {warehouses.map((warehouse) => (
              <li key={warehouse.id} className="rounded-md border border-[#edf2f7] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-medium text-[#2d3748]">
                    {warehouse.name}
                    {warehouse.isDefault ? (
                      <span className="ml-2 text-sm text-pragma-electric">Principal</span>
                    ) : null}
                  </p>
                  {!warehouse.isDefault ? (
                    <form action={deleteWarehouseAction}>
                      <input type="hidden" name="id" value={warehouse.id} />
                      <button type="submit" className="text-sm text-red-500">
                        Eliminar
                      </button>
                    </form>
                  ) : null}
                </div>
                <form action={updateWarehouseAction} className="mt-2 flex gap-2">
                  <input type="hidden" name="id" value={warehouse.id} />
                  <input
                    name="name"
                    defaultValue={warehouse.name}
                    className="h-9 flex-1 rounded border px-2 text-sm"
                  />
                  <button type="submit" className="text-sm text-pragma-electric">
                    Renombrar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </TiendasOnScreen>
  );
}

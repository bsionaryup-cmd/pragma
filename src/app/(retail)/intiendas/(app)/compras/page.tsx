import Link from "next/link";
import {
  createSimplePurchaseAction,
  resolveSuggestionAction,
  updatePurchaseStatusAction,
} from "@/domains/retail/actions/retail.actions";
import { getPurchasesData } from "@/domains/retail/services/retail-ui.service";
import { CashGateBanner, hasOpenCash } from "@/domains/retail/ui/tiendas-on/cash-gate";
import {
  TiendasOnTable,
  TiendasOnTableHead,
  TiendasOnTd,
  TiendasOnTh,
} from "@/domains/retail/ui/tiendas-on/data-display";
import { formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import { TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";
import { analyzeAndSuggestPurchases } from "@/domains/retail/services/ai-engine.service";
import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";

export default async function RetailPurchasesPage() {
  const ctx = await requireRetailContext();
  await analyzeAndSuggestPurchases(ctx.store.id).catch(() => null);
  const cashOpen = await hasOpenCash();
  const { orders, suggestions, suppliers, products } = await getPurchasesData();

  return (
    <TiendasOnScreen title="Compras">
      <CashGateBanner moduleLabel="Compras" />

      <div className="grid gap-4 p-4 xl:grid-cols-[360px_1fr]">
        <section className="rounded-lg border border-[#d5dce6] bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-[#2d3748]">Registrar compra</h2>
          <form action={createSimplePurchaseAction} className="space-y-3">
            <fieldset disabled={!cashOpen} className="space-y-3 disabled:opacity-50">
              <select
                name="concept"
                className="h-11 w-full rounded-md border border-[#c5ced8] px-3 text-base"
                defaultValue="MERCANCIA"
              >
                <option value="MERCANCIA">Mercancía</option>
                <option value="SERVICIO">Servicios</option>
                <option value="ARRIENDO">Arriendo</option>
                <option value="PAPELERIA">Papelería</option>
                <option value="OTRO">Otros gastos</option>
              </select>
              <input
                name="description"
                required
                placeholder="Descripción"
                className="h-11 w-full rounded-md border border-[#c5ced8] px-3 text-base"
              />
              <input
                name="amount"
                type="number"
                min="1"
                step="0.01"
                required
                placeholder="Monto"
                className="h-11 w-full rounded-md border border-[#c5ced8] px-3 text-base"
              />
              <select name="supplierId" className="h-11 w-full rounded-md border border-[#c5ced8] px-3 text-base">
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select name="productId" className="h-11 w-full rounded-md border border-[#c5ced8] px-3 text-base">
                <option value="">Gasto sin inventario</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (stock {p.stock})
                  </option>
                ))}
              </select>
              <input
                name="quantity"
                type="number"
                min="1"
                defaultValue={1}
                placeholder="Cantidad (si hay producto)"
                className="h-11 w-full rounded-md border border-[#c5ced8] px-3 text-base"
              />
              <TiendasOnPrimaryButton type="submit" className="w-full text-base">
                Guardar compra
              </TiendasOnPrimaryButton>
            </fieldset>
          </form>
          <Link href="/intiendas/proveedores" className="mt-3 inline-block text-base text-pragma-electric">
            Gestionar proveedores
          </Link>
        </section>

        <div className="space-y-4">
          <section className="rounded-lg border border-pragma-electric/20 bg-white p-4">
            <h2 className="mb-3 text-lg font-semibold text-[#2d3748]">Sugerencias de compra</h2>
            {suggestions.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {suggestions.map((item) => (
                  <div key={item.id} className="rounded-md border border-[#d5dce6] p-4">
                    <p className="text-base font-semibold uppercase text-[#2d3748]">{item.product.name}</p>
                    <p className="mt-1 text-sm text-[#718096]">
                      Stock {item.product.stock} · sugerido {item.suggestedQty} ·{" "}
                      {item.supplierName} · {item.leadTimeDays} días
                    </p>
                    <p className="mt-2 text-base font-medium text-pragma-electric">
                      {formatIntiendasMoney(item.estimatedCost)}
                    </p>
                    <form action={resolveSuggestionAction} className="mt-3 flex gap-2">
                      <input type="hidden" name="id" value={item.id} />
                      <TiendasOnPrimaryButton
                        type="submit"
                        name="intent"
                        value="approve"
                        className="h-9 px-3 text-sm"
                        disabled={!cashOpen}
                      >
                        Crear pedido
                      </TiendasOnPrimaryButton>
                      <button
                        type="submit"
                        name="intent"
                        value="dismiss"
                        disabled={!cashOpen}
                        className="text-sm text-[#718096]"
                      >
                        Descartar
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-base text-[#718096]">No hay sugerencias pendientes.</p>
            )}
          </section>

          <TiendasOnTable>
            <TiendasOnTableHead>
              <TiendasOnTh className="text-base">Orden</TiendasOnTh>
              <TiendasOnTh className="text-base">Proveedor</TiendasOnTh>
              <TiendasOnTh className="text-base">Estado</TiendasOnTh>
              <TiendasOnTh className="text-base">Total</TiendasOnTh>
              <TiendasOnTh className="text-base">Acción</TiendasOnTh>
            </TiendasOnTableHead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <TiendasOnTd className="text-base font-medium">{order.code}</TiendasOnTd>
                  <TiendasOnTd className="text-base">{order.supplier?.name ?? "Sin asignar"}</TiendasOnTd>
                  <TiendasOnTd className="text-base">{order.status}</TiendasOnTd>
                  <TiendasOnTd className="text-base">{formatIntiendasMoney(order.totalCost)}</TiendasOnTd>
                  <TiendasOnTd>
                    <form action={updatePurchaseStatusAction} className="flex gap-2">
                      <input type="hidden" name="id" value={order.id} />
                      {order.status === "DRAFT" || order.status === "SUGGESTED" ? (
                        <button
                          type="submit"
                          name="intent"
                          value="approve"
                          disabled={!cashOpen}
                          className="text-base text-pragma-electric disabled:opacity-40"
                        >
                          Aprobar
                        </button>
                      ) : null}
                      {order.status === "APPROVED" || order.status === "SENT" ? (
                        <TiendasOnPrimaryButton
                          type="submit"
                          name="intent"
                          value="receive"
                          className="h-9 px-3 text-sm"
                          disabled={!cashOpen}
                        >
                          Recibir
                        </TiendasOnPrimaryButton>
                      ) : null}
                    </form>
                  </TiendasOnTd>
                </tr>
              ))}
            </tbody>
          </TiendasOnTable>
        </div>
      </div>
    </TiendasOnScreen>
  );
}

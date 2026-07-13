import Link from "next/link";
import {
  createSimplePurchaseAction,
  updatePurchaseStatusAction,
} from "@/domains/retail/actions/retail.actions";
import { getPurchasesData } from "@/domains/retail/services/retail-ui.service";
import { CashGateBanner, hasOpenCash } from "@/domains/retail/ui/tiendas-on/cash-gate";
import { formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import { TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import {
  TiendasOnTable,
  TiendasOnTableHead,
  TiendasOnTd,
  TiendasOnTh,
} from "@/domains/retail/ui/tiendas-on/data-display";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";
import { formatIntiendasDateTime } from "@/domains/retail/ui/tiendas-on/format";
import { purchaseStatusLabel } from "@/domains/retail/ui/tiendas-on/labels";

export default async function RetailPurchasesPage() {
  const cashOpen = await hasOpenCash();
  const { orders, suppliers, products } = await getPurchasesData();
  const historial = orders.filter(
    (o) => o.status === "RECEIVED" || (!o.aiGenerated && o.status !== "SUGGESTED"),
  );

  return (
    <TiendasOnScreen title="Compras">
      <CashGateBanner moduleLabel="Compras" />

      <div className="grid gap-4 p-4 xl:grid-cols-[360px_1fr]">
        <section className="rounded-lg border border-[#d5dce6] bg-white p-4">
          <h2 className="mb-1 text-lg font-semibold text-[#2d3748]">Registrar compra</h2>
          <p className="mb-3 text-sm text-[#718096]">
            Historial financiero. Mercancía, servicios y gastos. Sin sugerencias automáticas.
          </p>
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
                <option value="TRANSPORTE">Transporte</option>
                <option value="PAPELERIA">Papelería</option>
                <option value="OPERATIVO">Gastos operativos</option>
                <option value="OTRO">Otros</option>
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
                    {p.name} (existencia {p.stock})
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
          <Link href="/intiendas/pedidos" className="mt-3 inline-block text-base text-pragma-electric">
            Ir a Centro de Abastecimiento
          </Link>
        </section>

        <section className="rounded-lg border border-[#d5dce6] bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-[#2d3748]">Historial de compras</h2>
          <TiendasOnTable>
            <TiendasOnTableHead>
              <TiendasOnTh>Código</TiendasOnTh>
              <TiendasOnTh>Detalle</TiendasOnTh>
              <TiendasOnTh>Estado</TiendasOnTh>
              <TiendasOnTh>Total</TiendasOnTh>
              <TiendasOnTh>Fecha</TiendasOnTh>
              <TiendasOnTh>Acción</TiendasOnTh>
            </TiendasOnTableHead>
            <tbody>
              {historial.map((order) => (
                <tr key={order.id}>
                  <TiendasOnTd className="font-medium">{order.code}</TiendasOnTd>
                  <TiendasOnTd>
                    {order.supplier?.name ?? "Sin proveedor"}
                    {order.notes ? ` · ${order.notes}` : ""}
                  </TiendasOnTd>
                  <TiendasOnTd>{purchaseStatusLabel(order.status)}</TiendasOnTd>
                  <TiendasOnTd>{formatIntiendasMoney(order.totalCost)}</TiendasOnTd>
                  <TiendasOnTd>{formatIntiendasDateTime(order.createdAt)}</TiendasOnTd>
                  <TiendasOnTd>
                    {(order.status === "APPROVED" || order.status === "SENT") && (
                      <form action={updatePurchaseStatusAction}>
                        <input type="hidden" name="id" value={order.id} />
                        <button
                          type="submit"
                          name="intent"
                          value="receive"
                          disabled={!cashOpen}
                          className="text-pragma-electric disabled:opacity-40"
                        >
                          Recibir
                        </button>
                      </form>
                    )}
                  </TiendasOnTd>
                </tr>
              ))}
              {!historial.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-[#718096]">
                    Aún no hay compras registradas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </TiendasOnTable>
        </section>
      </div>
    </TiendasOnScreen>
  );
}

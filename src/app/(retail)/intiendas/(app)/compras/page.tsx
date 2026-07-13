import Link from "next/link";
import { resolveSuggestionAction, updatePurchaseStatusAction } from "@/domains/retail/actions/retail.actions";
import { getPurchasesData } from "@/domains/retail/services/retail-ui.service";
import {
  TiendasOnTable,
  TiendasOnTableHead,
  TiendasOnTd,
  TiendasOnTh,
} from "@/domains/retail/ui/tiendas-on/data-display";
import { formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import { TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default async function RetailPurchasesPage() {
  const { orders, suggestions } = await getPurchasesData();
  return (
    <TiendasOnScreen title="Compras">
      <div className="flex justify-end px-4 pt-4">
        <Link href="/intiendas/proveedores" className="text-sm text-pragma-electric hover:underline">
          Gestionar proveedores
        </Link>
      </div>
      {suggestions.length ? (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {suggestions.map((item) => (
            <div key={item.id} className="rounded-md border border-[#d5dce6] bg-white p-4">
              <p className="font-semibold text-[#2d3748]">{item.product.name}</p>
              <p className="mt-1 text-sm text-[#718096]">
                Stock {item.product.stock} · sugerido {item.suggestedQty}
              </p>
              <p className="mt-2 font-medium">{formatIntiendasMoney(item.estimatedCost)}</p>
              <form action={resolveSuggestionAction} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={item.id} />
                <TiendasOnPrimaryButton type="submit" name="intent" value="approve" className="h-8 px-3 text-xs">
                  Aprobar
                </TiendasOnPrimaryButton>
                <button type="submit" name="intent" value="dismiss" className="text-sm text-[#718096]">
                  Descartar
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : null}

      <TiendasOnTable>
        <TiendasOnTableHead>
          <TiendasOnTh>Orden</TiendasOnTh>
          <TiendasOnTh>Proveedor</TiendasOnTh>
          <TiendasOnTh>Estado</TiendasOnTh>
          <TiendasOnTh>Total</TiendasOnTh>
          <TiendasOnTh>Acción</TiendasOnTh>
        </TiendasOnTableHead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <TiendasOnTd className="font-medium">{order.code}</TiendasOnTd>
              <TiendasOnTd>{order.supplier?.name ?? "Sin asignar"}</TiendasOnTd>
              <TiendasOnTd>{order.status}</TiendasOnTd>
              <TiendasOnTd>{formatIntiendasMoney(order.totalCost)}</TiendasOnTd>
              <TiendasOnTd>
                <form action={updatePurchaseStatusAction} className="flex gap-2">
                  <input type="hidden" name="id" value={order.id} />
                  {order.status === "DRAFT" || order.status === "SUGGESTED" ? (
                    <button type="submit" name="intent" value="approve" className="text-sm text-pragma-electric">
                      Aprobar
                    </button>
                  ) : null}
                  {order.status === "APPROVED" || order.status === "SENT" ? (
                    <TiendasOnPrimaryButton type="submit" name="intent" value="receive" className="h-8 px-3 text-xs">
                      Recibir
                    </TiendasOnPrimaryButton>
                  ) : null}
                </form>
              </TiendasOnTd>
            </tr>
          ))}
        </tbody>
      </TiendasOnTable>
    </TiendasOnScreen>
  );
}

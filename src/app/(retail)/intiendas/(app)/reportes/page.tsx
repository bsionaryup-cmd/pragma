import { getReportsData } from "@/domains/retail/services/retail-ui.service";
import {
  TiendasOnSummaryCard,
  TiendasOnTable,
  TiendasOnTableHead,
  TiendasOnTd,
  TiendasOnTh,
} from "@/domains/retail/ui/tiendas-on/data-display";
import { formatIntiendasDateTime, formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";
import { FileText, Receipt, ShoppingBag, Wallet } from "lucide-react";

export default async function RetailReportsPage() {
  const data = await getReportsData();
  return (
    <TiendasOnScreen title="Informes">
      <div className="grid gap-4 p-4 xl:grid-cols-2">
        <TiendasOnSummaryCard
          title="Ventas recientes"
          accent="pragma"
          icon={<Receipt className="size-5 text-pragma-electric" />}
        >
          <TiendasOnTable>
            <TiendasOnTableHead>
              <TiendasOnTh>Fecha</TiendasOnTh>
              <TiendasOnTh>Venta</TiendasOnTh>
              <TiendasOnTh>Cliente</TiendasOnTh>
              <TiendasOnTh>Total</TiendasOnTh>
            </TiendasOnTableHead>
            <tbody>
              {data.sales.map((row) => (
                <tr key={row.id}>
                  <TiendasOnTd>{formatIntiendasDateTime(row.createdAt)}</TiendasOnTd>
                  <TiendasOnTd>{row.code}</TiendasOnTd>
                  <TiendasOnTd>{row.customer?.name ?? "Consumidor final"}</TiendasOnTd>
                  <TiendasOnTd>{formatIntiendasMoney(row.total)}</TiendasOnTd>
                </tr>
              ))}
            </tbody>
          </TiendasOnTable>
        </TiendasOnSummaryCard>

        <TiendasOnSummaryCard
          title="Compras recientes"
          accent="rose"
          icon={<ShoppingBag className="size-5 text-red-500" />}
        >
          <TiendasOnTable>
            <TiendasOnTableHead>
              <TiendasOnTh>Fecha</TiendasOnTh>
              <TiendasOnTh>Orden</TiendasOnTh>
              <TiendasOnTh>Proveedor</TiendasOnTh>
              <TiendasOnTh>Total</TiendasOnTh>
            </TiendasOnTableHead>
            <tbody>
              {data.purchases.map((row) => (
                <tr key={row.id}>
                  <TiendasOnTd>{formatIntiendasDateTime(row.createdAt)}</TiendasOnTd>
                  <TiendasOnTd>{row.code}</TiendasOnTd>
                  <TiendasOnTd>{row.supplier?.name ?? "—"}</TiendasOnTd>
                  <TiendasOnTd>{formatIntiendasMoney(row.totalCost)}</TiendasOnTd>
                </tr>
              ))}
            </tbody>
          </TiendasOnTable>
        </TiendasOnSummaryCard>

        <TiendasOnSummaryCard
          title="Movimientos de inventario"
          accent="pragma"
          icon={<FileText className="size-5 text-pragma-electric" />}
        >
          <TiendasOnTable>
            <TiendasOnTableHead>
              <TiendasOnTh>Fecha</TiendasOnTh>
              <TiendasOnTh>Producto</TiendasOnTh>
              <TiendasOnTh>Tipo</TiendasOnTh>
              <TiendasOnTh>Cantidad</TiendasOnTh>
            </TiendasOnTableHead>
            <tbody>
              {data.movements.map((row) => (
                <tr key={row.id}>
                  <TiendasOnTd>{formatIntiendasDateTime(row.createdAt)}</TiendasOnTd>
                  <TiendasOnTd>{row.product.name}</TiendasOnTd>
                  <TiendasOnTd>{row.type}</TiendasOnTd>
                  <TiendasOnTd>{row.quantity > 0 ? `+${row.quantity}` : row.quantity}</TiendasOnTd>
                </tr>
              ))}
            </tbody>
          </TiendasOnTable>
        </TiendasOnSummaryCard>

        <TiendasOnSummaryCard
          title="Sesiones de caja"
          accent="amber"
          icon={<Wallet className="size-5 text-[#d69e2e]" />}
        >
          <TiendasOnTable>
            <TiendasOnTableHead>
              <TiendasOnTh>Apertura</TiendasOnTh>
              <TiendasOnTh>Caja</TiendasOnTh>
              <TiendasOnTh>Estado</TiendasOnTh>
              <TiendasOnTh>Base</TiendasOnTh>
            </TiendasOnTableHead>
            <tbody>
              {data.sessions.map((row) => (
                <tr key={row.id}>
                  <TiendasOnTd>{formatIntiendasDateTime(row.openedAt)}</TiendasOnTd>
                  <TiendasOnTd>{row.register.name}</TiendasOnTd>
                  <TiendasOnTd>{row.status}</TiendasOnTd>
                  <TiendasOnTd>{formatIntiendasMoney(row.openingAmount)}</TiendasOnTd>
                </tr>
              ))}
            </tbody>
          </TiendasOnTable>
        </TiendasOnSummaryCard>
      </div>
    </TiendasOnScreen>
  );
}

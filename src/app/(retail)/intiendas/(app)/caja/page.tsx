import Link from "next/link";
import { HelpCircle, Receipt, ShoppingBag, Wallet } from "lucide-react";
import { closeCashAction } from "@/domains/retail/actions/retail.actions";
import { getCashSummaryData } from "@/domains/retail/services/retail-ui.service";
import {
  TiendasOnSummaryCard,
  TiendasOnSummaryRow,
} from "@/domains/retail/ui/tiendas-on/data-display";
import { formatIntiendasDate, formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export default async function RetailCashSummaryPage() {
  const data = await getCashSummaryData();

  return (
    <TiendasOnScreen title="Resumen de caja" storeCode={data.storeCode}>
      <div className="grid gap-4 p-4 xl:grid-cols-3">
        <TiendasOnSummaryCard
          title={data.registerName}
          accent="amber"
          icon={<Wallet className="size-5 text-[#d69e2e]" />}
          action={<HelpCircle className="size-4 text-[#94a3b8]" />}
        >
          <TiendasOnSummaryRow label="Usuario" value={data.userName} />
          <TiendasOnSummaryRow
            label="Fecha de Apertura"
            value={formatIntiendasDate(data.openedAt)}
          />
          <TiendasOnSummaryRow label="Caja Inicial" value={formatIntiendasMoney(data.openingAmount)} />
          <TiendasOnSummaryRow label="Ingresos" value={formatIntiendasMoney(data.income)} tone="positive" />
          <TiendasOnSummaryRow label="Egresos" value={formatIntiendasMoney(data.expenses)} tone="negative" />
          <TiendasOnSummaryRow label="Gastos" value={formatIntiendasMoney(data.expensesCost)} tone="negative" />
          <TiendasOnSummaryRow
            label="Caja Actual"
            value={formatIntiendasMoney(data.currentCash)}
            tone="strong-positive"
          />
        </TiendasOnSummaryCard>

        <TiendasOnSummaryCard
          title="Ventas"
          accent="pragma"
          icon={<Receipt className="size-5 text-pragma-electric" />}
          action={
            <Link href="/intiendas/reportes" className="text-xs text-pragma-electric">
              Ver detalle
            </Link>
          }
        >
          <TiendasOnSummaryRow
            label="Ventas en Efectivo"
            value={formatIntiendasMoney(data.cashSales)}
            tone="positive"
          />
          <TiendasOnSummaryRow label="Ventas a Crédito" value={formatIntiendasMoney(data.creditSales)} />
          <TiendasOnSummaryRow label="Total Ventas" value={formatIntiendasMoney(data.totalSales)} />
          <TiendasOnSummaryRow label="Total Autoconsumo" value={formatIntiendasMoney(data.autoConsumption)} />
          <TiendasOnSummaryRow label="Total devoluciones" value={formatIntiendasMoney(data.returns)} />
        </TiendasOnSummaryCard>

        <div className="space-y-4">
          <TiendasOnSummaryCard
            title="Compras"
            accent="rose"
            icon={<ShoppingBag className="size-5 text-red-500" />}
            action={<HelpCircle className="size-4 text-[#94a3b8]" />}
          >
            <TiendasOnSummaryRow
              label="Compras en Efectivo"
              value={formatIntiendasMoney(data.cashPurchases)}
              tone="negative"
            />
            <TiendasOnSummaryRow
              label="Compras Crédito"
              value={formatIntiendasMoney(data.creditPurchases)}
              tone="negative"
            />
            <TiendasOnSummaryRow
              label="Total Compras"
              value={formatIntiendasMoney(data.totalPurchases)}
              tone="negative"
            />
            <TiendasOnSummaryRow
              label="Total abonos realizados"
              value={formatIntiendasMoney(data.purchasePayments)}
              tone="negative"
            />
          </TiendasOnSummaryCard>

          <TiendasOnSummaryCard
            title="Cartera"
            accent="rose"
            icon={<Wallet className="size-5 text-red-500" />}
            action={
              <Link href="/intiendas/clientes" className="text-xs text-pragma-electric">
                Ver clientes
              </Link>
            }
          >
            <TiendasOnSummaryRow
              label="Cartera Inicial"
              value={formatIntiendasMoney(data.carteraInicial)}
              tone="negative"
            />
            <TiendasOnSummaryRow
              label="Pagos recibidos en efectivo"
              value={formatIntiendasMoney(data.paymentsCash)}
              tone="positive"
            />
            <TiendasOnSummaryRow
              label="Pagos recibidos con datáfono"
              value={formatIntiendasMoney(data.paymentsCard)}
            />
            <TiendasOnSummaryRow
              label="Pagos recibidos con transferencia"
              value={formatIntiendasMoney(data.paymentsTransfer)}
            />
            <TiendasOnSummaryRow
              label="Cartera Final"
              value={formatIntiendasMoney(data.carteraFinal)}
              tone="negative"
            />
          </TiendasOnSummaryCard>
        </div>
      </div>

      <div className="grid gap-3 px-4 pb-6 sm:grid-cols-2">
        <Link
          href="/intiendas/reportes"
          className="flex h-12 items-center justify-center rounded-md bg-pragma-electric text-sm font-semibold text-white hover:bg-pragma-electric/90"
        >
          Historial de ventas
        </Link>
        {data.sessionId ? (
          <form action={closeCashAction} className="contents">
            <input type="hidden" name="sessionId" value={data.sessionId} />
            <input type="hidden" name="closingAmount" value={String(data.currentCash)} />
            <button
              type="submit"
              className="h-12 rounded-md bg-pragma-electric text-sm font-semibold text-white hover:bg-pragma-electric/90"
            >
              Cerrar caja
            </button>
          </form>
        ) : (
          <Link
            href="/intiendas/configuracion"
            className="flex h-12 items-center justify-center rounded-md bg-pragma-electric text-sm font-semibold text-white hover:bg-pragma-electric/90"
          >
            Abrir caja
          </Link>
        )}
      </div>
    </TiendasOnScreen>
  );
}

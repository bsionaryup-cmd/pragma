import { notFound } from "next/navigation";
import { getInvoiceDetailData } from "@/domains/retail/services/retail-ui.service";
import {
  TiendasOnSummaryCard,
  TiendasOnSummaryRow,
  TiendasOnTable,
  TiendasOnTableHead,
  TiendasOnTd,
  TiendasOnTh,
} from "@/domains/retail/ui/tiendas-on/data-display";
import { formatIntiendasDateTime, formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import { TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";
import { Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RetailInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data;
  try {
    data = await getInvoiceDetailData(id);
  } catch {
    notFound();
  }

  return (
    <TiendasOnScreen title={`Factura ${data.number}`}>
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <TiendasOnSummaryCard
          title="Datos de la factura"
          accent="pragma"
          icon={<Receipt className="size-5 text-pragma-electric" />}
          action={
            <a
              href={`/intiendas/facturas/${data.id}/imprimir`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-pragma-electric"
            >
              Reimprimir
            </a>
          }
        >
          <TiendasOnSummaryRow label="Número" value={data.number} />
          <TiendasOnSummaryRow label="Estado" value={data.status === "ISSUED" ? "Emitida" : "Anulada"} />
          <TiendasOnSummaryRow label="Fecha" value={formatIntiendasDateTime(data.issuedAt)} />
          <TiendasOnSummaryRow label="Venta" value={data.sale.code} />
          <TiendasOnSummaryRow label="Negocio" value={data.issuerName} />
          {data.issuerTaxId ? <TiendasOnSummaryRow label="NIT" value={data.issuerTaxId} /> : null}
          {data.issuerAddress ? (
            <TiendasOnSummaryRow label="Dirección" value={data.issuerAddress} />
          ) : null}
          {data.issuerPhone ? <TiendasOnSummaryRow label="Teléfono" value={data.issuerPhone} /> : null}
          <TiendasOnSummaryRow label="Cliente" value={data.buyerName ?? "Consumidor final"} />
          {data.buyerTaxId ? <TiendasOnSummaryRow label="Doc. cliente" value={data.buyerTaxId} /> : null}
          <div className="pt-3">
            <a href={`/intiendas/facturas/${data.id}/imprimir`} target="_blank" rel="noopener noreferrer">
              <TiendasOnPrimaryButton type="button">Reimprimir factura</TiendasOnPrimaryButton>
            </a>
          </div>
        </TiendasOnSummaryCard>

        <TiendasOnSummaryCard
          title="Productos de la venta"
          accent="amber"
          icon={<Receipt className="size-5 text-[#d69e2e]" />}
        >
          <TiendasOnTable className="min-w-0">
            <TiendasOnTableHead>
              <TiendasOnTh>Producto</TiendasOnTh>
              <TiendasOnTh>Cant</TiendasOnTh>
              <TiendasOnTh>P. unit</TiendasOnTh>
              <TiendasOnTh>Total</TiendasOnTh>
            </TiendasOnTableHead>
            <tbody>
              {data.sale.items.map((item, index) => (
                <tr key={`${item.productName}-${index}`}>
                  <TiendasOnTd>{item.productName}</TiendasOnTd>
                  <TiendasOnTd>{item.quantity}</TiendasOnTd>
                  <TiendasOnTd>{formatIntiendasMoney(item.unitPrice)}</TiendasOnTd>
                  <TiendasOnTd>{formatIntiendasMoney(item.lineTotal)}</TiendasOnTd>
                </tr>
              ))}
            </tbody>
          </TiendasOnTable>
          <div className="mt-4 space-y-1 border-t border-[#e2e8f0] pt-3">
            <TiendasOnSummaryRow label="Subtotal" value={formatIntiendasMoney(data.sale.subtotal)} />
            {data.sale.discount > 0 ? (
              <TiendasOnSummaryRow
                label="Descuento"
                value={`-${formatIntiendasMoney(data.sale.discount)}`}
              />
            ) : null}
            <TiendasOnSummaryRow label="Total" value={formatIntiendasMoney(data.sale.total)} />
          </div>
        </TiendasOnSummaryCard>
      </div>
    </TiendasOnScreen>
  );
}

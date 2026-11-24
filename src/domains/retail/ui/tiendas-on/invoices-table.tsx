import Link from "next/link";
import {
  TiendasOnTable,
  TiendasOnTableHead,
  TiendasOnTd,
  TiendasOnTh,
} from "@/domains/retail/ui/tiendas-on/data-display";
import { formatIntiendasDateTime, formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";

export type InvoiceListRow = {
  id: string;
  number: string;
  status: string;
  issuedAt: Date | string;
  buyerName: string;
  total: number;
  saleCode: string;
};

const STATUS_LABEL: Record<string, string> = {
  ISSUED: "Emitida",
  VOID: "Anulada",
};

export function TiendasOnInvoicesTable({ invoices }: { invoices: InvoiceListRow[] }) {
  return (
    <div className="p-4">
      <TiendasOnTable>
        <TiendasOnTableHead>
          <TiendasOnTh>Número</TiendasOnTh>
          <TiendasOnTh>Fecha</TiendasOnTh>
          <TiendasOnTh>Cliente</TiendasOnTh>
          <TiendasOnTh>Total</TiendasOnTh>
          <TiendasOnTh>Estado</TiendasOnTh>
          <TiendasOnTh>Acciones</TiendasOnTh>
        </TiendasOnTableHead>
        <tbody>
          {invoices.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="border-t border-[#e2e8f0] px-4 py-8 text-center text-sm text-[#718096]"
              >
                Aún no hay facturas. Al finalizar una venta puedes elegir imprimir factura.
              </td>
            </tr>
          ) : (
            invoices.map((invoice) => (
              <tr key={invoice.id}>
                <TiendasOnTd className="font-medium text-[#2d3748]">{invoice.number}</TiendasOnTd>
                <TiendasOnTd>{formatIntiendasDateTime(invoice.issuedAt)}</TiendasOnTd>
                <TiendasOnTd>{invoice.buyerName}</TiendasOnTd>
                <TiendasOnTd>{formatIntiendasMoney(invoice.total)}</TiendasOnTd>
                <TiendasOnTd>{STATUS_LABEL[invoice.status] ?? invoice.status}</TiendasOnTd>
                <TiendasOnTd>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/intiendas/facturas/${invoice.id}`}
                      prefetch={false}
                      className="text-sm font-semibold text-pragma-electric hover:underline"
                    >
                      Ver
                    </Link>
                    {/* Native <a>: print must not use App Router RSC prefetch */}
                    <a
                      href={`/intiendas/facturas/${invoice.id}/imprimir`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-pragma-electric hover:underline"
                    >
                      Reimprimir
                    </a>
                  </div>
                </TiendasOnTd>
              </tr>
            ))
          )}
        </tbody>
      </TiendasOnTable>
    </div>
  );
}

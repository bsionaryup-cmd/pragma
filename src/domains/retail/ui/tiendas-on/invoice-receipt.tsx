import { formatIntiendasDateTime, formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import { cn } from "@/lib/utils";

export type InvoiceReceiptData = {
  invoice: {
    number: string;
    issuedAt: Date | string;
    issuerName: string;
    issuerTaxId: string | null;
    issuerAddress: string | null;
    issuerPhone: string | null;
    buyerName: string | null;
    buyerTaxId: string | null;
  };
  sale: {
    code: string;
    subtotal: number;
    discount: number;
    total: number;
    items: Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  };
  thankYouMessage?: string;
};

export type InvoicePrintWidth = "58mm" | "80mm" | "sheet";

export function InvoiceReceipt({
  data,
  width = "80mm",
  className,
}: {
  data: InvoiceReceiptData;
  width?: InvoicePrintWidth;
  className?: string;
}) {
  const { invoice, sale } = data;
  const thankYou = data.thankYouMessage ?? "¡Gracias por su compra!";
  const isThermal = width === "58mm" || width === "80mm";

  return (
    <article
      className={cn(
        "invoice-receipt bg-white text-black",
        width === "58mm" && "w-[58mm] text-[10px]",
        width === "80mm" && "w-[80mm] text-[11px]",
        width === "sheet" && "mx-auto w-full max-w-[720px] text-sm",
        className,
      )}
      data-print-width={width}
    >
      <header className={cn("text-center", isThermal ? "mb-2 space-y-0.5" : "mb-6 space-y-1")}>
        <h1 className={cn("font-bold uppercase leading-tight", isThermal ? "text-[12px]" : "text-xl")}>
          {invoice.issuerName}
        </h1>
        {invoice.issuerTaxId ? <p>NIT: {invoice.issuerTaxId}</p> : null}
        {invoice.issuerAddress ? <p>{invoice.issuerAddress}</p> : null}
        {invoice.issuerPhone ? <p>Tel: {invoice.issuerPhone}</p> : null}
      </header>

      <section className={cn("border-y border-dashed border-black/40 py-2", isThermal ? "mb-2" : "mb-4")}>
        <p>
          <span className="font-semibold">Factura:</span> {invoice.number}
        </p>
        <p>
          <span className="font-semibold">Fecha:</span> {formatIntiendasDateTime(invoice.issuedAt)}
        </p>
        <p>
          <span className="font-semibold">Venta:</span> {sale.code}
        </p>
        <p>
          <span className="font-semibold">Cliente:</span> {invoice.buyerName ?? "Consumidor final"}
        </p>
        {invoice.buyerTaxId ? (
          <p>
            <span className="font-semibold">Doc:</span> {invoice.buyerTaxId}
          </p>
        ) : null}
      </section>

      <table className="mb-2 w-full border-collapse">
        <thead>
          <tr className="border-b border-black/30 text-left">
            <th className="py-1 pr-1 font-semibold">Producto</th>
            <th className="py-1 px-1 text-right font-semibold">Cant</th>
            <th className="py-1 px-1 text-right font-semibold">P.Unit</th>
            <th className="py-1 pl-1 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, index) => (
            <tr key={`${item.productName}-${index}`} className="align-top">
              <td className="py-1 pr-1">{item.productName}</td>
              <td className="py-1 px-1 text-right">{item.quantity}</td>
              <td className="py-1 px-1 text-right whitespace-nowrap">
                {formatIntiendasMoney(item.unitPrice)}
              </td>
              <td className="py-1 pl-1 text-right whitespace-nowrap">
                {formatIntiendasMoney(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className={cn("border-t border-dashed border-black/40 pt-2", isThermal ? "space-y-0.5" : "space-y-1")}>
        <div className="flex justify-between gap-2">
          <span>Subtotal</span>
          <span>{formatIntiendasMoney(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 ? (
          <div className="flex justify-between gap-2">
            <span>Descuento</span>
            <span>-{formatIntiendasMoney(sale.discount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-2 text-[1.05em] font-bold">
          <span>Total</span>
          <span>{formatIntiendasMoney(sale.total)}</span>
        </div>
      </section>

      <footer className={cn("text-center", isThermal ? "mt-3" : "mt-8")}>
        <p className="font-medium">{thankYou}</p>
      </footer>
    </article>
  );
}

import { notFound } from "next/navigation";
import { getInvoiceDetailData } from "@/domains/retail/services/retail-ui.service";
import { InvoicePrintClient } from "@/domains/retail/ui/tiendas-on/invoice-print-client";
import type { InvoicePrintWidth } from "@/domains/retail/ui/tiendas-on/invoice-receipt";

export const dynamic = "force-dynamic";

function parseWidth(value: string | undefined): InvoicePrintWidth {
  if (value === "58mm" || value === "80mm" || value === "sheet") return value;
  return "80mm";
}

export default async function RetailInvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ width?: string; auto?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  let data;
  try {
    data = await getInvoiceDetailData(id);
  } catch {
    notFound();
  }

  const issuedAt =
    data.issuedAt instanceof Date ? data.issuedAt.toISOString() : String(data.issuedAt);

  return (
    <InvoicePrintClient
      autoPrint={query.auto === "1"}
      width={parseWidth(query.width)}
      data={{
        invoice: {
          number: data.number,
          issuedAt,
          issuerName: data.issuerName,
          issuerTaxId: data.issuerTaxId,
          issuerAddress: data.issuerAddress,
          issuerPhone: data.issuerPhone,
          buyerName: data.buyerName,
          buyerTaxId: data.buyerTaxId,
        },
        sale: {
          code: data.sale.code,
          subtotal: data.sale.subtotal,
          discount: data.sale.discount,
          total: data.sale.total,
          items: data.sale.items,
        },
      }}
    />
  );
}

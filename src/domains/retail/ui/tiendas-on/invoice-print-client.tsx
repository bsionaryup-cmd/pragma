"use client";

import { useEffect } from "react";
import { InvoiceReceipt, type InvoicePrintWidth, type InvoiceReceiptData } from "./invoice-receipt";
import { TiendasOnPrimaryButton } from "./controls";
import { cn } from "@/lib/utils";

export function InvoicePrintClient({
  data,
  autoPrint = false,
  width = "80mm",
}: {
  data: InvoiceReceiptData;
  autoPrint?: boolean;
  width?: InvoicePrintWidth;
}) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  const pageMargin = width === "sheet" ? "12mm" : "2mm";
  const pageSize =
    width === "58mm" ? "58mm auto" : width === "80mm" ? "80mm auto" : "A4";

  return (
    <div className="min-h-screen bg-[#f3f6fa] p-4 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-4xl flex-wrap items-center gap-2 print:hidden">
        <p className="mr-auto text-sm text-[#4a5568]">Vista de impresión</p>
        <WidthLink width="58mm" current={width} label="Térmica 58 mm" />
        <WidthLink width="80mm" current={width} label="Térmica 80 mm" />
        <WidthLink width="sheet" current={width} label="Hoja" />
        <TiendasOnPrimaryButton type="button" onClick={() => window.print()}>
          Imprimir
        </TiendasOnPrimaryButton>
      </div>

      <div
        className={cn(
          "mx-auto rounded-md border border-[#d5dce6] bg-white p-4 shadow-sm print:border-0 print:p-0 print:shadow-none",
          width === "sheet" ? "max-w-[800px]" : "w-fit",
        )}
      >
        <InvoiceReceipt data={data} width={width} />
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { margin: ${pageMargin}; size: ${pageSize}; }
              body * { visibility: hidden; }
              .invoice-receipt, .invoice-receipt * { visibility: visible; }
              .invoice-receipt { position: absolute; left: 0; top: 0; }
            }
          `,
        }}
      />
    </div>
  );
}

function WidthLink({
  width,
  current,
  label,
}: {
  width: InvoicePrintWidth;
  current: InvoicePrintWidth;
  label: string;
}) {
  return (
    <a
      href={`?width=${width}`}
      className={cn(
        "inline-flex h-10 items-center rounded-md border px-3 text-sm font-medium",
        current === width
          ? "border-pragma-electric bg-pragma-electric/10 text-pragma-electric"
          : "border-[#c5ced8] bg-white text-[#4a5568] hover:border-pragma-electric/50",
      )}
    >
      {label}
    </a>
  );
}

import "server-only";

import { db } from "@/lib/db";
import { toNumber } from "@/domains/retail/lib/money";

function padInvoiceSeq(seq: number) {
  return String(seq).padStart(6, "0");
}

/** Issue a retail invoice for an existing completed sale. Idempotent per saleId. */
export async function issueInvoiceForSale(storeId: string, saleId: string) {
  const existing = await db.retailInvoice.findFirst({
    where: { storeId, saleId },
  });
  if (existing) return existing;

  const sale = await db.retailSale.findFirst({
    where: { id: saleId, storeId, status: "COMPLETED" },
    include: { customer: { select: { name: true, documentId: true } } },
  });
  if (!sale) throw new Error("Venta no encontrada o no completada.");

  return db.$transaction(async (tx) => {
    const again = await tx.retailInvoice.findFirst({ where: { storeId, saleId } });
    if (again) return again;

    const store = await tx.retailStore.update({
      where: { id: storeId },
      data: { invoiceSeq: { increment: 1 } },
    });

    const prefix = (store.invoicePrefix || "FV").trim() || "FV";
    const number = `${prefix}-${padInvoiceSeq(store.invoiceSeq)}`;

    return tx.retailInvoice.create({
      data: {
        storeId,
        saleId,
        number,
        issuerName: (store.legalName || store.name).trim(),
        issuerTaxId: store.taxId?.trim() || null,
        issuerAddress: store.address?.trim() || null,
        issuerPhone: store.phone?.trim() || null,
        buyerName: sale.customer?.name?.trim() || "Consumidor final",
        buyerTaxId: sale.customer?.documentId?.trim() || null,
      },
    });
  });
}

export function listInvoices(storeId: string, take = 100) {
  return db.retailInvoice.findMany({
    where: { storeId },
    orderBy: { issuedAt: "desc" },
    take,
    include: {
      sale: {
        select: {
          id: true,
          code: true,
          total: true,
          status: true,
          customer: { select: { name: true } },
        },
      },
    },
  });
}

export async function getInvoice(storeId: string, id: string) {
  const invoice = await db.retailInvoice.findFirst({
    where: { id, storeId },
    include: {
      sale: {
        include: {
          customer: true,
          items: true,
        },
      },
    },
  });
  if (!invoice) throw new Error("Factura no encontrada");
  return invoice;
}

export async function getInvoicePrintPayload(storeId: string, id: string) {
  const invoice = await getInvoice(storeId, id);
  const sale = invoice.sale;
  return {
    invoice: {
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      issuerName: invoice.issuerName,
      issuerTaxId: invoice.issuerTaxId,
      issuerAddress: invoice.issuerAddress,
      issuerPhone: invoice.issuerPhone,
      buyerName: invoice.buyerName,
      buyerTaxId: invoice.buyerTaxId,
    },
    sale: {
      id: sale.id,
      code: sale.code,
      subtotal: toNumber(sale.subtotal),
      discount: toNumber(sale.discount),
      total: toNumber(sale.total),
      paymentMethod: sale.paymentMethod,
      note: sale.note,
      createdAt: sale.createdAt,
      items: sale.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: toNumber(item.unitPrice),
        lineTotal: toNumber(item.lineTotal),
      })),
    },
  };
}

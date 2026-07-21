"use server";

import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";
import { issueInvoiceForSale } from "@/domains/retail/services/invoice.service";

/**
 * Emite factura para una venta ya guardada.
 * No revalida el layout de INTIENDAS: la venta ya refresca; evitar doble
 * revalidate + window.open (causa Failed to fetch en el App Router).
 */
export async function issueInvoiceForSaleAction(saleId: string) {
  const { store } = await requireRetailContext();
  if (!saleId?.trim()) throw new Error("Venta inválida.");
  const invoice = await issueInvoiceForSale(store.id, saleId.trim());
  return { id: invoice.id, number: invoice.number };
}

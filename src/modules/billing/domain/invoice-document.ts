/** IVA incluido en precios de suscripción PRAGMA (Colombia). */
export const SUBSCRIPTION_VAT_RATE = 0.19;

export type BillingInvoiceDocumentLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type BillingInvoiceDocument = {
  invoiceNumber: string;
  issueDate: Date;
  dueAt: Date;
  paidAt: Date | null;
  periodStart: Date;
  periodEnd: Date;
  isPreview: boolean;
  issuer: {
    legalName: string;
    nit: string;
    email: string;
    address: string;
  };
  customer: {
    displayName: string;
    companyName: string | null;
    email: string;
  };
  lineItems: BillingInvoiceDocumentLine[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  plan: {
    code: string;
    name: string;
    features: string[];
  };
  paymentMethod: string;
  paymentReference: string | null;
  statusLabel: string;
};

export function splitTaxIncludedTotal(total: number, taxRate = SUBSCRIPTION_VAT_RATE) {
  const subtotal = Math.round(total / (1 + taxRate));
  const taxAmount = total - subtotal;
  return { subtotal, taxAmount };
}

export function formatInvoiceMoney(amount: number, currency: string) {
  return `$${amount.toLocaleString("es-CO")} ${currency}`;
}

export function formatInvoiceDate(date: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeZone: "America/Bogota",
  }).format(date);
}

export function formatInvoicePeriod(start: Date, end: Date) {
  const fmt = new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  });
  const startLabel = fmt.format(start);
  const endLabel = fmt.format(end);
  if (startLabel === endLabel) return startLabel;
  return `${startLabel} – ${endLabel}`;
}

export function buildInvoiceNumber(invoiceId: string) {
  return `PRG-${invoiceId.slice(-8).toUpperCase()}`;
}

import type {
  PaymentInvoiceLedgerStatus,
  PaymentMethodType,
  PaymentProviderCode,
  PaymentTransactionStatus,
} from "@prisma/client";

export type PaymentProviderCheckoutInput = {
  invoiceId: string;
  paymentInvoiceId: string;
  amountInCents: number;
  currency: string;
  customerEmail: string;
  redirectUrl: string;
  reference: string;
};

export type PaymentProviderCheckoutResult = {
  ok: boolean;
  message: string;
  checkoutUrl?: string;
  reference?: string;
};

export type WompiWebhookEvent = {
  event: string;
  data?: {
    transaction?: {
      id?: string;
      status?: string;
      reference?: string;
      amount_in_cents?: number;
      payment_method_type?: string;
    };
  };
  environment?: string;
  timestamp?: number;
};

export type PaymentDashboardMetrics = {
  revenueApproved: number;
  pendingCount: number;
  approvedCount: number;
  failedCount: number;
  refundedCount: number;
  feesTotal: number;
  reconciliationRate: number;
};

export type PaymentDashboardTransaction = {
  id: string;
  amount: number;
  currency: string;
  status: PaymentTransactionStatus;
  provider: PaymentProviderCode;
  providerReference: string | null;
  paymentMethod: PaymentMethodType;
  invoiceId: string | null;
  reservationId: string | null;
  createdAt: string;
};

export type PaymentDashboardInvoice = {
  id: string;
  total: number;
  currency: string;
  status: PaymentInvoiceLedgerStatus;
  description: string | null;
  dueAt: string;
  paidAt: string | null;
};

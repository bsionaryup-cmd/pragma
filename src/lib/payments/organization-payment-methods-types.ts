export type OrganizationPaymentMethodType =
  | "payment_link"
  | "cash"
  | "bank_transfer"
  | "other";

export type OrganizationPaymentMethod = {
  id: string;
  enabled: boolean;
  type: OrganizationPaymentMethodType;
  label?: string;
  account_holder?: string;
};

export const DEFAULT_ORGANIZATION_PAYMENT_METHODS: OrganizationPaymentMethod[] = [
  { id: "payment_link", enabled: true, type: "payment_link" },
  { id: "cash", enabled: true, type: "cash" },
  { id: "other", enabled: true, type: "other" },
];

export type SerializedReservationPayment = {
  id: string;
  amount: number;
  amountFormatted: string;
  currency: string;
  method: string;
  methodLabel: string;
  paymentReference: string | null;
  accountMethodLabel: string | null;
  receivedAt: string;
  notes: string | null;
  createdAt: string;
};

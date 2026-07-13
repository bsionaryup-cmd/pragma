import type {
  RetailInventoryMovementType,
  RetailPaymentMethod,
} from "@prisma/client";

export type MoneyInput = number | string;

export type ProductInput = {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  categoryId?: string | null;
  primarySupplierId?: string | null;
  secondarySupplierId?: string | null;
  cost?: MoneyInput;
  price?: MoneyInput;
  stock?: number;
  minStock?: number;
  idealStock?: number;
  isFavorite?: boolean;
};

export type CategoryInput = {
  name: string;
  sortOrder?: number;
};

export type SupplierInput = {
  name: string;
  contactName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  leadTimeDays?: number;
  usualDeliveryDows?: string | null;
  notes?: string | null;
};

export type SupplierProductInput = {
  supplierId: string;
  productId: string;
  cost: MoneyInput;
  leadTimeDays?: number;
  minPurchaseQty?: number;
  suggestedPurchaseQty?: number;
};

export type CustomerInput = {
  name: string;
  alias?: string | null;
  documentId?: string | null;
  phone?: string | null;
  creditLimit?: MoneyInput;
};

export type CustomerPaymentInput = {
  customerId: string;
  amount: MoneyInput;
  method?: RetailPaymentMethod;
  note?: string | null;
};

export type SaleItemInput = {
  productId: string;
  quantity: number;
  unitPrice?: MoneyInput;
};

export type SaleInput = {
  items: SaleItemInput[];
  cashSessionId?: string | null;
  customerId?: string | null;
  paymentMethod?: RetailPaymentMethod;
  discount?: MoneyInput;
  deliveryFee?: MoneyInput;
  amountPaid?: MoneyInput;
  note?: string | null;
};

export type PurchaseItemInput = {
  productId: string;
  quantity: number;
  unitCost?: MoneyInput;
};

export type PurchaseOrderInput = {
  supplierId?: string | null;
  items: PurchaseItemInput[];
  notes?: string | null;
  aiGenerated?: boolean;
};

export type ReceivePurchaseItemInput = {
  itemId: string;
  receivedQuantity: number;
};

export type InventoryChangeInput = {
  productId: string;
  quantity: number;
  type?: Extract<RetailInventoryMovementType, "ADJUSTMENT" | "RETURN" | "LOSS">;
  unitCost?: MoneyInput;
  note?: string | null;
  referenceId?: string | null;
};

export type OpenCashSessionInput = {
  registerId: string;
  openingAmount?: MoneyInput;
};

"use server";

import { revalidatePath } from "next/cache";
import { requireRetailContext } from "../auth/require-retail-context";
import {
  createCustomer,
  recordPayment,
  softDeleteCustomer,
  updateCustomer,
} from "../services/customer.service";
import type { CustomerInput, CustomerPaymentInput } from "../types";

function refresh() {
  revalidatePath("/intiendas", "layout");
}

export async function createCustomerAction(input: CustomerInput) {
  const ctx = await requireRetailContext();
  const result = await createCustomer(ctx.storeId, input);
  refresh();
  return result;
}

export async function updateCustomerAction(id: string, input: Partial<CustomerInput>) {
  const ctx = await requireRetailContext();
  const result = await updateCustomer(ctx.storeId, id, input);
  refresh();
  return result;
}

export async function softDeleteCustomerAction(id: string) {
  const ctx = await requireRetailContext();
  const result = await softDeleteCustomer(ctx.storeId, id);
  refresh();
  return result;
}

export async function recordCustomerPaymentAction(input: CustomerPaymentInput) {
  const ctx = await requireRetailContext();
  const result = await recordPayment(ctx.storeId, input, ctx.userId);
  refresh();
  return result;
}

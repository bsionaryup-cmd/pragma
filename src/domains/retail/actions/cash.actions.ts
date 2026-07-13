"use server";

import { revalidatePath } from "next/cache";
import { requireRetailContext } from "../auth/require-retail-context";
import { closeSession, openSession } from "../services/cash.service";
import type { OpenCashSessionInput } from "../types";

function refresh() {
  revalidatePath("/intiendas", "layout");
}

export async function openCashSessionAction(input: OpenCashSessionInput) {
  const ctx = await requireRetailContext();
  const result = await openSession(
    ctx.storeId,
    input.registerId,
    input.openingAmount,
    ctx.userId,
  );
  refresh();
  return result;
}

export async function closeCashSessionAction(id: string, closingAmount: number | string) {
  const ctx = await requireRetailContext();
  const result = await closeSession(ctx.storeId, id, closingAmount);
  refresh();
  return result;
}

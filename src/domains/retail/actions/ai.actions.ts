"use server";

import { revalidatePath } from "next/cache";
import { requireRetailContext } from "../auth/require-retail-context";
import {
  analyzeAndSuggestPurchases,
  approveSuggestion,
  dismissSuggestion,
} from "../services/ai-engine.service";

function refresh() {
  revalidatePath("/intiendas", "layout");
}

export async function analyzePurchasesAction() {
  const ctx = await requireRetailContext();
  const result = await analyzeAndSuggestPurchases(ctx.storeId);
  refresh();
  return result;
}

export async function approveSuggestionAction(id: string) {
  const ctx = await requireRetailContext();
  const result = await approveSuggestion(ctx.storeId, id, ctx.userId);
  refresh();
  return result;
}

export async function dismissSuggestionAction(id: string) {
  const ctx = await requireRetailContext();
  const result = await dismissSuggestion(ctx.storeId, id);
  refresh();
  return result;
}

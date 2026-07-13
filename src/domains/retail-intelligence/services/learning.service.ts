import { db } from "@/lib/db";
import { clamp } from "../lib/math";

export type DecisionFeedbackInput = {
  storeId: string;
  orderId: string;
  productId?: string | null;
  action:
    | "APPROVE_ORDER"
    | "DISMISS_ORDER"
    | "QTY_ADJUSTED"
    | "PRODUCT_REMOVED"
    | "PRODUCT_ADDED"
    | "SUPPLIER_CHANGED"
    | "NOTES_UPDATED";
  suggestedQty?: number | null;
  approvedQty?: number | null;
  note?: string | null;
};

/** Persist tender decisions so reorder qty can bias over time (no LLM). */
export async function recordDecisionFeedback(rows: DecisionFeedbackInput[]) {
  if (!rows.length) return;
  await db.retailIntelFeedback.createMany({
    data: rows.map((row) => ({
      storeId: row.storeId,
      productId: row.productId ?? null,
      suggestionId: null,
      action: row.action,
      note: JSON.stringify({
        orderId: row.orderId,
        suggestedQty: row.suggestedQty ?? null,
        approvedQty: row.approvedQty ?? null,
        note: row.note ?? null,
      }),
    })),
  });
}

/**
 * Learning bias from historical qty adjustments (approved / suggested).
 * Returns 1 when insufficient data. Clamped to avoid extreme swings.
 */
export async function getProductQtyBias(storeId: string, productId: string): Promise<number> {
  const rows = await db.retailIntelFeedback.findMany({
    where: {
      storeId,
      productId,
      action: { in: ["QTY_ADJUSTED", "APPROVE_ORDER"] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const ratios: number[] = [];
  for (const row of rows) {
    if (!row.note) continue;
    try {
      const parsed = JSON.parse(row.note) as {
        suggestedQty?: number | null;
        approvedQty?: number | null;
      };
      const suggested = Number(parsed.suggestedQty);
      const approved = Number(parsed.approvedQty);
      if (suggested > 0 && approved >= 0) {
        ratios.push(approved / suggested);
      }
    } catch {
      // ignore legacy free-text notes
    }
  }

  if (ratios.length < 2) return 1;
  const avg = ratios.reduce((s, n) => s + n, 0) / ratios.length;
  return clamp(avg, 0.5, 1.5);
}

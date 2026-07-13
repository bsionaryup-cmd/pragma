import "server-only";

import { db } from "@/lib/db";
import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";

export async function getOpenCashSession(storeId: string) {
  return db.retailCashSession.findFirst({
    where: { storeId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
    include: { register: { select: { id: true, name: true } } },
  });
}

/** Obliga caja abierta para ventas / compras / movimientos. */
export async function requireOpenCashSession() {
  const ctx = await requireRetailContext();
  const session = await getOpenCashSession(ctx.store.id);
  if (!session) {
    throw new Error("Debes abrir caja antes de continuar con esta operación.");
  }
  return { ...ctx, cashSession: session };
}

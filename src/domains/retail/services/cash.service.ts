import { db } from "@/lib/db";
import { roundMoney } from "../lib/money";

export function listRegisters(storeId: string) {
  return db.retailCashRegister.findMany({
    where: { storeId, status: "ACTIVE" },
    orderBy: { name: "asc" },
  });
}

export async function ensureDefaultRegister(storeId: string) {
  const existing = await db.retailCashRegister.findFirst({
    where: { storeId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  return existing ?? db.retailCashRegister.create({ data: { storeId, name: "Caja 1" } });
}

export function getOpenSession(storeId: string, registerId?: string) {
  return db.retailCashSession.findFirst({
    where: { storeId, registerId, status: "OPEN" },
    include: { register: true },
    orderBy: { openedAt: "desc" },
  });
}

export async function openSession(
  storeId: string,
  registerId: string,
  openingAmount: number | string = 0,
  userId?: string,
) {
  const register = await db.retailCashRegister.findFirst({
    where: { id: registerId, storeId, status: "ACTIVE" },
  });
  if (!register) throw new Error("Caja no encontrada");
  if (await getOpenSession(storeId, registerId)) throw new Error("La caja ya está abierta");

  return db.retailCashSession.create({
    data: { storeId, registerId, openingAmount: roundMoney(openingAmount), openedByUserId: userId },
  });
}

export async function closeSession(
  storeId: string,
  sessionId: string,
  closingAmount: number | string,
) {
  const session = await db.retailCashSession.findFirst({
    where: { id: sessionId, storeId, status: "OPEN" },
  });
  if (!session) throw new Error("Sesión de caja abierta no encontrada");

  const sales = await db.retailSale.aggregate({
    where: {
      storeId,
      cashSessionId: sessionId,
      status: "COMPLETED",
      paymentMethod: "CASH",
    },
    _sum: { total: true },
  });
  const expectedAmount = roundMoney(
    Number(session.openingAmount) + Number(sales._sum.total ?? 0),
  );

  return db.retailCashSession.update({
    where: { id: session.id },
    data: {
      status: "CLOSED",
      closingAmount: roundMoney(closingAmount),
      expectedAmount,
      closedAt: new Date(),
    },
  });
}

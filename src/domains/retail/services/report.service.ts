import { db } from "@/lib/db";

export async function salesReport(storeId: string, from: Date, to: Date) {
  const sales = await db.retailSale.findMany({
    where: { storeId, status: "COMPLETED", createdAt: { gte: from, lte: to } },
    include: { items: true, customer: true },
    orderBy: { createdAt: "desc" },
  });
  return {
    sales,
    count: sales.length,
    total: sales.reduce((sum, sale) => sum + Number(sale.total), 0),
    cost: sales.flatMap((sale) => sale.items).reduce(
      (sum, item) => sum + Number(item.unitCost) * item.quantity,
      0,
    ),
  };
}

export async function purchasesReport(storeId: string, from: Date, to: Date) {
  const orders = await db.retailPurchaseOrder.findMany({
    where: { storeId, status: "RECEIVED", receivedAt: { gte: from, lte: to } },
    include: { supplier: true, items: true },
    orderBy: { receivedAt: "desc" },
  });
  return {
    orders,
    count: orders.length,
    total: orders.reduce((sum, order) => sum + Number(order.totalCost), 0),
  };
}

export async function inventoryReport(storeId: string) {
  const products = await db.retailProduct.findMany({
    where: { storeId, deletedAt: null },
    include: { category: true },
    orderBy: { name: "asc" },
  });
  return {
    products,
    units: products.reduce((sum, product) => sum + product.stock, 0),
    costValue: products.reduce(
      (sum, product) => sum + product.stock * Number(product.cost),
      0,
    ),
    retailValue: products.reduce(
      (sum, product) => sum + product.stock * Number(product.price),
      0,
    ),
  };
}

export function cashReport(storeId: string, from: Date, to: Date) {
  return db.retailCashSession.findMany({
    where: { storeId, openedAt: { gte: from, lte: to } },
    include: { register: true, sales: { where: { status: "COMPLETED" } } },
    orderBy: { openedAt: "desc" },
  });
}

export async function topProducts(storeId: string, from: Date, to: Date, take = 10) {
  const rows = await db.retailSaleItem.groupBy({
    by: ["productId", "productName"],
    where: {
      sale: { storeId, status: "COMPLETED", createdAt: { gte: from, lte: to } },
    },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { quantity: "desc" } },
    take,
  });
  return rows.map((row) => ({
    ...row,
    quantity: row._sum.quantity ?? 0,
    total: Number(row._sum.lineTotal ?? 0),
  }));
}

export async function customersReport(storeId: string, from: Date, to: Date) {
  return db.retailCustomer.findMany({
    where: { storeId, deletedAt: null },
    include: {
      sales: {
        where: { status: "COMPLETED", createdAt: { gte: from, lte: to } },
        select: { total: true, createdAt: true },
      },
      payments: {
        where: { createdAt: { gte: from, lte: to } },
        select: { amount: true, createdAt: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

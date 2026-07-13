import "server-only";

import { db } from "@/lib/db";
import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";
import { startOfDayInTimezone } from "@/lib/timezone";

const money = (value: { toNumber(): number } | number | null | undefined) =>
  value == null ? 0 : typeof value === "number" ? value : value.toNumber();

export async function getDashboardData() {
  const { store } = await requireRetailContext();
  const start = startOfDayInTimezone();
  const [sales, critical, suggestions, debt, openCash] = await Promise.all([
    db.retailSale.aggregate({
      where: { storeId: store.id, status: "COMPLETED", createdAt: { gte: start } },
      _sum: { total: true },
      _count: true,
    }),
    db.retailProduct.count({
      where: { storeId: store.id, deletedAt: null, status: "ACTIVE", stock: { lte: 0 } },
    }),
    db.retailPurchaseSuggestion.count({ where: { storeId: store.id, status: "PENDING" } }),
    db.retailCustomer.aggregate({
      where: { storeId: store.id, deletedAt: null, creditBalance: { gt: 0 } },
      _sum: { creditBalance: true },
      _count: true,
    }),
    db.retailCashSession.findFirst({
      where: { storeId: store.id, status: "OPEN" },
      orderBy: { openedAt: "desc" },
      select: { id: true, openingAmount: true, openedAt: true, register: { select: { name: true } } },
    }),
  ]);
  return {
    salesToday: money(sales._sum.total),
    salesCount: sales._count,
    critical,
    suggestions,
    debtCustomers: debt._count,
    debtTotal: money(debt._sum.creditBalance),
    openCash: openCash
      ? { ...openCash, openingAmount: money(openCash.openingAmount) }
      : null,
  };
}

export async function getProductsData() {
  const { store } = await requireRetailContext();
  const [products, categories, suppliers] = await Promise.all([
    db.retailProduct.findMany({
      where: { storeId: store.id, deletedAt: null },
      orderBy: { name: "asc" },
      include: { category: { select: { name: true } }, primarySupplier: { select: { id: true, name: true } } },
    }),
    db.retailCategory.findMany({
      where: { storeId: store.id, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.retailSupplier.findMany({
      where: { storeId: store.id, deletedAt: null, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return {
    products: products.map((p) => ({ ...p, cost: money(p.cost), price: money(p.price) })),
    categories,
    suppliers,
  };
}

export async function getSuppliersData() {
  const { store } = await requireRetailContext();
  return db.retailSupplier.findMany({
    where: { storeId: store.id, deletedAt: null },
    orderBy: { name: "asc" },
    include: { _count: { select: { supplierProducts: true, purchaseOrders: true } } },
  });
}

export async function getCustomersData() {
  const { store } = await requireRetailContext();
  const customers = await db.retailCustomer.findMany({
    where: { storeId: store.id, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      payments: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });
  return customers.map((c) => ({
    ...c,
    creditBalance: money(c.creditBalance),
    creditLimit: money(c.creditLimit),
    lastPaymentAt: c.payments[0]?.createdAt ?? null,
  }));
}

export async function getPurchasesData() {
  const { store } = await requireRetailContext();
  const [orders, suggestions, suppliers, products] = await Promise.all([
    db.retailPurchaseOrder.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { supplier: { select: { name: true, leadTimeDays: true } }, items: true },
    }),
    db.retailPurchaseSuggestion.findMany({
      where: { storeId: store.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: {
            name: true,
            stock: true,
            minStock: true,
            idealStock: true,
            primarySupplier: { select: { id: true, name: true, leadTimeDays: true } },
          },
        },
      },
    }),
    db.retailSupplier.findMany({
      where: { storeId: store.id, deletedAt: null, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, leadTimeDays: true },
    }),
    db.retailProduct.findMany({
      where: { storeId: store.id, deletedAt: null, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, cost: true, stock: true },
    }),
  ]);
  return {
    orders: orders.map((o) => ({
      ...o,
      totalCost: money(o.totalCost),
      aiGenerated: o.aiGenerated,
    })),
    suggestions: suggestions.map((s) => ({
      ...s,
      estimatedCost: money(s.estimatedCost),
      supplierName:
        s.product.primarySupplier?.name ??
        suppliers.find((sup) => sup.id === s.supplierId)?.name ??
        "Sin proveedor",
      leadTimeDays:
        s.product.primarySupplier?.leadTimeDays ??
        suppliers.find((sup) => sup.id === s.supplierId)?.leadTimeDays ??
        0,
    })),
    suppliers,
    products: products.map((p) => ({ ...p, cost: money(p.cost) })),
  };
}

export async function getReportsData() {
  const { store } = await requireRetailContext();
  const [sales, purchases, movements, sessions] = await Promise.all([
    db.retailSale.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { customer: { select: { name: true } } },
    }),
    db.retailPurchaseOrder.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { supplier: { select: { name: true } } },
    }),
    db.retailInventoryMovement.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { product: { select: { name: true } } },
    }),
    db.retailCashSession.findMany({
      where: { storeId: store.id },
      orderBy: { openedAt: "desc" },
      take: 20,
      include: { register: { select: { name: true } } },
    }),
  ]);
  return {
    sales: sales.map((r) => ({ ...r, total: money(r.total) })),
    purchases: purchases.map((r) => ({ ...r, totalCost: money(r.totalCost) })),
    movements,
    sessions: sessions.map((r) => ({
      ...r,
      openingAmount: money(r.openingAmount),
      closingAmount: money(r.closingAmount),
    })),
  };
}

export async function getSettingsData() {
  const { store } = await requireRetailContext();
  const registers = await db.retailCashRegister.findMany({
    where: { storeId: store.id, status: "ACTIVE" },
    orderBy: { name: "asc" },
    include: {
      sessions: { where: { status: "OPEN" }, orderBy: { openedAt: "desc" }, take: 1 },
    },
  });
  return {
    store,
    registers: registers.map((r) => ({
      ...r,
      sessions: r.sessions.map((s) => ({ ...s, openingAmount: money(s.openingAmount) })),
    })),
  };
}

export async function getSuspendedSalesData() {
  const { store } = await requireRetailContext();
  const sales = await db.retailSale.findMany({
    where: { storeId: store.id, status: "SUSPENDED" },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      customer: { select: { id: true, name: true, documentId: true } },
      items: true,
    },
  });
  return sales.map((sale) => ({
    id: sale.id,
    code: sale.code,
    customerId: sale.customerId,
    customerName: sale.customer?.name ?? "Cliente Rápido",
    discount: money(sale.discount),
    total: money(sale.total),
    note: sale.note,
    createdAt: sale.createdAt,
    items: sale.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: money(item.unitPrice),
      lineTotal: money(item.lineTotal),
    })),
  }));
}

export async function getCashSummaryData() {
  const context = await requireRetailContext();
  const { store, userId, firstName, email } = context;

  const openSession = await db.retailCashSession.findFirst({
    where: { storeId: store.id, status: "OPEN" },
    orderBy: { openedAt: "desc" },
    include: { register: { select: { id: true, name: true } } },
  });

  const todayStart = startOfDayInTimezone();

  const [cashSales, creditSales, cashPurchases, customerPayments, debt] = await Promise.all([
    db.retailSale.aggregate({
      where: {
        storeId: store.id,
        status: "COMPLETED",
        paymentMethod: "CASH",
        ...(openSession ? { cashSessionId: openSession.id } : { createdAt: { gte: todayStart } }),
      },
      _sum: { total: true },
    }),
    db.retailSale.aggregate({
      where: {
        storeId: store.id,
        status: "COMPLETED",
        isCredit: true,
        ...(openSession ? { cashSessionId: openSession.id } : { createdAt: { gte: todayStart } }),
      },
      _sum: { total: true },
    }),
    db.retailPurchaseOrder.aggregate({
      where: {
        storeId: store.id,
        status: { in: ["RECEIVED", "APPROVED", "SENT"] },
        createdAt: { gte: openSession?.openedAt ?? todayStart },
      },
      _sum: { totalCost: true },
    }),
    db.retailCustomerPayment.aggregate({
      where: {
        storeId: store.id,
        method: "CASH",
        createdAt: { gte: openSession?.openedAt ?? todayStart },
      },
      _sum: { amount: true },
    }),
    db.retailCustomer.aggregate({
      where: { storeId: store.id, deletedAt: null },
      _sum: { creditBalance: true },
    }),
  ]);

  const cashSalesTotal = money(cashSales._sum.total);
  const creditSalesTotal = money(creditSales._sum.total);
  const purchasesTotal = money(cashPurchases._sum.totalCost);
  const paymentsCash = money(customerPayments._sum.amount);
  const carteraFinal = money(debt._sum.creditBalance);
  const openingAmount = openSession ? money(openSession.openingAmount) : 0;
  const currentCash = openingAmount + cashSalesTotal - purchasesTotal + paymentsCash;

  const user = userId
    ? await db.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, email: true },
      })
    : null;

  return {
    registerName: openSession?.register.name ?? "Sin caja abierta",
    sessionId: openSession?.id ?? null,
    userName:
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") || firstName || email || "Usuario",
    openedAt: openSession?.openedAt ?? null,
    openingAmount,
    income: 0,
    expenses: 0,
    expensesCost: 0,
    currentCash,
    cashSales: cashSalesTotal,
    creditSales: creditSalesTotal,
    totalSales: cashSalesTotal + creditSalesTotal,
    autoConsumption: 0,
    returns: 0,
    cashPurchases: purchasesTotal,
    creditPurchases: 0,
    totalPurchases: purchasesTotal,
    purchasePayments: 0,
    carteraInicial: carteraFinal,
    paymentsCash,
    paymentsCard: 0,
    paymentsTransfer: 0,
    carteraFinal,
    storeCode: store.id.slice(-8).toUpperCase(),
  };
}

export async function getStatisticsData() {
  const { store } = await requireRetailContext();
  const todayStart = startOfDayInTimezone();
  const start = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [sales, purchases, topProducts] = await Promise.all([
    db.retailSale.aggregate({
      where: { storeId: store.id, status: "COMPLETED", createdAt: { gte: start } },
      _sum: { total: true },
      _count: true,
    }),
    db.retailPurchaseOrder.aggregate({
      where: { storeId: store.id, status: "RECEIVED", createdAt: { gte: start } },
      _sum: { totalCost: true },
      _count: true,
    }),
    db.retailSaleItem.groupBy({
      by: ["productName"],
      where: { sale: { storeId: store.id, status: "COMPLETED", createdAt: { gte: start } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    }),
  ]);

  return {
    salesTotal: money(sales._sum.total),
    salesCount: sales._count,
    purchasesTotal: money(purchases._sum.totalCost),
    purchasesCount: purchases._count,
    topProducts: topProducts.map((row) => ({
      name: row.productName,
      quantity: row._sum.quantity ?? 0,
    })),
  };
}

export async function getMovementsData() {
  const { store } = await requireRetailContext();
  const movements = await db.retailInventoryMovement.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { product: { select: { name: true, sku: true } } },
  });
  return movements;
}

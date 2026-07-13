import "server-only";

import { db } from "@/lib/db";

const storeSelect = {
  id: true,
  organizationId: true,
  name: true,
  currency: true,
  status: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function normalizeName(name: string) {
  const value = name.trim();
  if (!value) throw new Error("El nombre de la tienda es obligatorio");
  if (value.length > 160) throw new Error("El nombre de la tienda es demasiado largo");
  return value;
}

export async function listRetailStores(options: { q?: string } = {}) {
  const stores = await db.retailStore.findMany({
    select: storeSelect,
    orderBy: { createdAt: "desc" },
  });
  const organizationIds = stores.map((store) => store.organizationId);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [organizations, userGroups, saleGroups] = await Promise.all([
    db.organization.findMany({
      where: { id: { in: organizationIds } },
      select: { id: true, name: true },
    }),
    db.user.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: organizationIds }, deletedAt: null },
      _count: { _all: true },
    }),
    db.retailSale.groupBy({
      by: ["storeId"],
      where: { storeId: { in: stores.map((store) => store.id) }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  const orgNames = new Map(organizations.map((org) => [org.id, org.name]));
  const userCounts = new Map(userGroups.map((group) => [group.organizationId, group._count._all]));
  const saleCounts = new Map(saleGroups.map((group) => [group.storeId, group._count._all]));
  const query = options.q?.trim().toLocaleLowerCase("es") ?? "";

  return stores
    .map((store) => ({
      ...store,
      organizationName: orgNames.get(store.organizationId) ?? "Organización no encontrada",
      usersCount: userCounts.get(store.organizationId) ?? 0,
      salesLast30Days: saleCounts.get(store.id) ?? 0,
    }))
    .filter(
      (store) =>
        !query ||
        store.name.toLocaleLowerCase("es").includes(query) ||
        store.organizationName.toLocaleLowerCase("es").includes(query),
    );
}

export async function getRetailStoreDetail(storeId: string) {
  const store = await db.retailStore.findUnique({
    where: { id: storeId },
    select: {
      ...storeSelect,
      cashRegisters: { orderBy: { createdAt: "asc" } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 20 },
      _count: { select: { products: true, sales: true, customers: true, suppliers: true } },
    },
  });
  if (!store) throw new Error("Tienda no encontrada");

  const [organization, users] = await Promise.all([
    db.organization.findUnique({
      where: { id: store.organizationId },
      select: { id: true, name: true, status: true },
    }),
    db.user.findMany({
      where: { organizationId: store.organizationId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isAccountOwner: true,
      },
      orderBy: [{ isAccountOwner: "desc" }, { email: "asc" }],
    }),
  ]);

  return { ...store, organization, users };
}

export async function createRetailStore(input: {
  organizationId: string;
  name: string;
  createdByUserId: string;
}) {
  const organization = await db.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true },
  });
  if (!organization) throw new Error("Organización no encontrada");
  const existing = await db.retailStore.findUnique({
    where: { organizationId: input.organizationId },
    select: { id: true },
  });
  if (existing) throw new Error("La organización ya tiene una tienda INTIENDAS");

  return db.$transaction(async (tx) => {
    const store = await tx.retailStore.create({
      data: {
        organizationId: input.organizationId,
        name: normalizeName(input.name),
        createdByUserId: input.createdByUserId,
      },
    });
    await tx.retailCashRegister.create({ data: { storeId: store.id, name: "Caja 1" } });
    await tx.retailAuditLog.create({
      data: {
        storeId: store.id,
        action: "admin_store_create",
        entityType: "RetailStore",
        entityId: store.id,
        actorUserId: input.createdByUserId,
      },
    });
    return store;
  });
}

export async function updateRetailStore(input: { id: string; name: string; currency?: string }) {
  const currency = input.currency?.trim().toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) throw new Error("Moneda no válida");
  return db.retailStore.update({
    where: { id: input.id },
    data: { name: normalizeName(input.name), ...(currency ? { currency } : {}) },
  });
}

export async function suspendRetailStore(id: string) {
  return db.retailStore.update({ where: { id }, data: { status: "INACTIVE" } });
}

export async function activateRetailStore(id: string) {
  return db.retailStore.update({
    where: { id },
    data: { status: "ACTIVE", deletedAt: null },
  });
}

export async function softDeleteRetailStore(id: string) {
  return db.retailStore.update({
    where: { id },
    data: { status: "INACTIVE", deletedAt: new Date() },
  });
}

export async function listOrganizationsWithoutStore() {
  const stores = await db.retailStore.findMany({ select: { organizationId: true } });
  return db.organization.findMany({
    where: { id: { notIn: stores.map((store) => store.organizationId) }, deletedAt: null },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });
}

export async function listRetailOrganizations() {
  const [organizations, stores, userGroups] = await Promise.all([
    db.organization.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
    db.retailStore.findMany({
      select: { id: true, organizationId: true, name: true, status: true, deletedAt: true },
    }),
    db.user.groupBy({
      by: ["organizationId"],
      where: { deletedAt: null, organizationId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const storeByOrg = new Map(stores.map((store) => [store.organizationId, store]));
  const usersByOrg = new Map(
    userGroups.map((group) => [group.organizationId!, group._count._all]),
  );
  return organizations.map((org) => ({
    ...org,
    store: storeByOrg.get(org.id) ?? null,
    usersCount: usersByOrg.get(org.id) ?? 0,
  }));
}

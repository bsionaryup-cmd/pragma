import "server-only";

import { db } from "@/lib/db";

export type RetailAdminDashboardStats = Awaited<
  ReturnType<typeof getRetailAdminDashboardStats>
>;

export async function getRetailAdminDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    storesTotal,
    storesActive,
    storesSuspended,
    productsTotal,
    salesToday,
    orgGroups,
    recentStores,
  ] = await Promise.all([
    db.retailStore.count(),
    db.retailStore.count({ where: { status: "ACTIVE", deletedAt: null } }),
    db.retailStore.count({
      where: { OR: [{ status: "INACTIVE" }, { deletedAt: { not: null } }] },
    }),
    db.retailProduct.count({ where: { deletedAt: null } }),
    db.retailSale.aggregate({
      where: { status: "COMPLETED", createdAt: { gte: today } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    db.retailStore.groupBy({ by: ["organizationId"] }),
    db.retailStore.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        organizationId: true,
        name: true,
        status: true,
        deletedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const organizations = await db.organization.findMany({
    where: { id: { in: recentStores.map((store) => store.organizationId) } },
    select: { id: true, name: true },
  });
  const organizationNames = new Map(organizations.map((org) => [org.id, org.name]));

  return {
    storesTotal,
    storesActive,
    storesSuspended,
    productsTotal,
    salesTodayCount: salesToday._count._all,
    salesTodayAmount: Number(salesToday._sum.total ?? 0),
    orgsWithStore: orgGroups.length,
    recentStores: recentStores.map((store) => ({
      ...store,
      organizationName: organizationNames.get(store.organizationId) ?? "Organización no encontrada",
    })),
  };
}

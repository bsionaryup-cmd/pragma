import type { Prisma } from "@prisma/client";
import { BillingSubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";

export type OwnerClientSortField =
  | "createdAt"
  | "name"
  | "properties"
  | "users"
  | "reservations";

export type OwnerClientsQuery = {
  search?: string;
  status?: "ACTIVE" | "SUSPENDED" | "ALL";
  plan?: "STARTER" | "PRO" | "ALL";
  billingStatus?: BillingSubscriptionStatus | "ALL";
  sortBy?: OwnerClientSortField;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type OwnerClientRow = {
  id: string;
  name: string;
  mainEmail: string | null;
  status: string;
  createdAt: string;
  propertyCount: number;
  reservationCount: number;
  userCount: number;
  plan: string | null;
  billingStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  monthlyAmount: number | null;
  currency: string | null;
  openInvoiceAmount: number | null;
  reservationRevenueCop: number;
  estimatedMrrCop: number | null;
};

export type OwnerDashboardAnalytics = {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  trialTenants: number;
  activeSubscriptions: number;
  totalProperties: number;
  totalUsers: number;
  totalReservations: number;
  mrrEstimateCop: number;
};

function buildOrderBy(
  sortBy: OwnerClientSortField,
  sortDir: "asc" | "desc",
): Prisma.OrganizationOrderByWithRelationInput {
  if (sortBy === "name") return { name: sortDir };
  if (sortBy === "createdAt") return { createdAt: sortDir };
  return { createdAt: sortDir };
}

export async function listOwnerClients(
  query: OwnerClientsQuery,
): Promise<{ items: OwnerClientRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(Math.max(query.pageSize ?? 20, 5), 50);
  const skip = (page - 1) * pageSize;
  const sortBy = query.sortBy ?? "createdAt";
  const sortDir = query.sortDir ?? "desc";

  const where: Prisma.OrganizationWhereInput = {
    ...(query.status && query.status !== "ALL" ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { id: { contains: query.search, mode: "insensitive" } },
            {
              users: {
                some: {
                  email: { contains: query.search, mode: "insensitive" },
                  isAccountOwner: true,
                },
              },
            },
          ],
        }
      : {}),
    ...(query.plan && query.plan !== "ALL"
      ? { billingAccount: { plan: query.plan } }
      : {}),
    ...(query.billingStatus && query.billingStatus !== "ALL"
      ? { billingAccount: { status: query.billingStatus } }
      : {}),
  };

  const [organizations, total] = await Promise.all([
    db.organization.findMany({
      where,
      orderBy: buildOrderBy(sortBy, sortDir),
      skip,
      take: pageSize,
      include: {
        billingAccount: {
          include: {
            invoices: {
              where: { status: "OPEN" },
              take: 1,
              orderBy: { dueAt: "desc" },
            },
          },
        },
        users: {
          where: { deletedAt: null },
          select: {
            id: true,
            email: true,
            isAccountOwner: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            properties: true,
            users: { where: { deletedAt: null } },
          },
        },
      },
    }),
    db.organization.count({ where }),
  ]);

  const orgIds = organizations.map((o) => o.id);
  const reservationCounts = orgIds.length
    ? await db.reservation.groupBy({
        by: ["propertyId"],
        where: {
          property: { organizationId: { in: orgIds } },
          status: { not: "CANCELLED" },
        },
        _count: { _all: true },
      })
    : [];

  const propertyOrgMap = orgIds.length
    ? await db.property.findMany({
        where: { organizationId: { in: orgIds } },
        select: { id: true, organizationId: true },
      })
    : [];

  const reservationsByOrg = new Map<string, number>();
  for (const row of reservationCounts) {
    const prop = propertyOrgMap.find((p) => p.id === row.propertyId);
    if (!prop?.organizationId) continue;
    reservationsByOrg.set(
      prop.organizationId,
      (reservationsByOrg.get(prop.organizationId) ?? 0) + row._count._all,
    );
  }

  const revenueByProperty = orgIds.length
    ? await db.reservation.groupBy({
        by: ["propertyId"],
        where: {
          property: { organizationId: { in: orgIds } },
          status: { not: "CANCELLED" },
        },
        _sum: { totalAmount: true },
      })
    : [];

  const revenueByOrg = new Map<string, number>();
  for (const row of revenueByProperty) {
    const prop = propertyOrgMap.find((p) => p.id === row.propertyId);
    if (!prop?.organizationId) continue;
    revenueByOrg.set(
      prop.organizationId,
      (revenueByOrg.get(prop.organizationId) ?? 0) +
        Number(row._sum.totalAmount ?? 0),
    );
  }

  const planPrices: Record<string, number> = { STARTER: 199_000, PRO: 399_000 };

  let items: OwnerClientRow[] = organizations.map((org) => {
    const owner = org.users.find((u) => u.isAccountOwner) ?? org.users[0];
    const billing = org.billingAccount;
    const openInvoice = billing?.invoices[0];

    return {
      id: org.id,
      name: org.name,
      mainEmail: owner?.email ?? null,
      status: org.status,
      createdAt: org.createdAt.toISOString(),
      propertyCount: org._count.properties,
      reservationCount: reservationsByOrg.get(org.id) ?? 0,
      userCount: org._count.users,
      plan: billing?.plan ?? null,
      billingStatus: billing?.status ?? null,
      trialEndsAt: billing?.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: billing?.currentPeriodEnd?.toISOString() ?? null,
      monthlyAmount: openInvoice ? Number(openInvoice.amount) : null,
      currency: openInvoice?.currency ?? billing?.invoices[0]?.currency ?? "COP",
      openInvoiceAmount: openInvoice ? Number(openInvoice.amount) : null,
      reservationRevenueCop: revenueByOrg.get(org.id) ?? 0,
      estimatedMrrCop:
        billing?.status === BillingSubscriptionStatus.ACTIVE && billing.plan
          ? (planPrices[billing.plan] ?? null)
          : null,
    };
  });

  if (sortBy === "properties") {
    items = items.sort((a, b) =>
      sortDir === "asc"
        ? a.propertyCount - b.propertyCount
        : b.propertyCount - a.propertyCount,
    );
  } else if (sortBy === "users") {
    items = items.sort((a, b) =>
      sortDir === "asc" ? a.userCount - b.userCount : b.userCount - a.userCount,
    );
  } else if (sortBy === "reservations") {
    items = items.sort((a, b) =>
      sortDir === "asc"
        ? a.reservationCount - b.reservationCount
        : b.reservationCount - a.reservationCount,
    );
  }

  return { items, total, page, pageSize };
}

export async function getOwnerClientDetail(organizationId: string) {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      billingAccount: {
        include: {
          invoices: { orderBy: { dueAt: "desc" }, take: 10 },
        },
      },
      users: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isAccountOwner: true,
          lastLoginAt: true,
          createdAt: true,
        },
      },
      _count: {
        select: { properties: true, users: { where: { deletedAt: null } } },
      },
    },
  });

  if (!org) return null;

  const reservationCount = await db.reservation.count({
    where: {
      property: { organizationId },
      status: { not: "CANCELLED" },
    },
  });

  const revenueAgg = await db.reservation.aggregate({
    where: {
      property: { organizationId },
      status: { not: "CANCELLED" },
    },
    _sum: { totalAmount: true },
  });

  const recentActivity = await db.platformAuditLog.findMany({
    where: { targetTenantId: organizationId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const owner = org.users.find((u) => u.isAccountOwner) ?? org.users[0];

  return {
    id: org.id,
    name: org.name,
    status: org.status,
    suspendedAt: org.suspendedAt?.toISOString() ?? null,
    createdAt: org.createdAt.toISOString(),
    mainEmail: owner?.email ?? null,
    propertyCount: org._count.properties,
    userCount: org._count.users,
    reservationCount,
    reservationRevenueCop: Number(revenueAgg._sum.totalAmount ?? 0),
    billing: org.billingAccount
      ? {
          plan: org.billingAccount.plan,
          status: org.billingAccount.status,
          trialEndsAt: org.billingAccount.trialEndsAt?.toISOString() ?? null,
          currentPeriodEnd:
            org.billingAccount.currentPeriodEnd?.toISOString() ?? null,
          invoices: org.billingAccount.invoices.map((inv) => ({
            id: inv.id,
            amount: inv.amount.toString(),
            currency: inv.currency,
            status: inv.status,
            dueAt: inv.dueAt.toISOString(),
            paidAt: inv.paidAt?.toISOString() ?? null,
            description: inv.description,
          })),
        }
      : null,
    users: org.users,
    recentActivity: recentActivity.map((log) => ({
      id: log.id,
      action: log.action,
      ownerEmail: log.ownerEmail,
      createdAt: log.createdAt.toISOString(),
      metadata: log.metadata,
    })),
  };
}

export async function getOwnerDashboardAnalytics(): Promise<OwnerDashboardAnalytics> {
  const [
    totalTenants,
    activeTenants,
    suspendedTenants,
    trialTenants,
    activeSubscriptions,
    totalProperties,
    totalUsers,
    totalReservations,
    billingAccounts,
  ] = await Promise.all([
    db.organization.count(),
    db.organization.count({ where: { status: "ACTIVE" } }),
    db.organization.count({ where: { status: "SUSPENDED" } }),
    db.billingAccount.count({ where: { status: BillingSubscriptionStatus.TRIAL } }),
    db.billingAccount.count({ where: { status: BillingSubscriptionStatus.ACTIVE } }),
    db.property.count(),
    db.user.count({ where: { deletedAt: null } }),
    db.reservation.count({ where: { status: { not: "CANCELLED" } } }),
    db.billingAccount.findMany({
      where: { status: BillingSubscriptionStatus.ACTIVE },
      select: { plan: true },
    }),
  ]);

  const planPrices: Record<string, number> = { STARTER: 199_000, PRO: 399_000 };
  const mrrEstimateCop = billingAccounts.reduce(
    (sum, acc) => sum + (planPrices[acc.plan] ?? 199_000),
    0,
  );

  return {
    totalTenants,
    activeTenants,
    suspendedTenants,
    trialTenants,
    activeSubscriptions,
    totalProperties,
    totalUsers,
    totalReservations,
    mrrEstimateCop,
  };
}

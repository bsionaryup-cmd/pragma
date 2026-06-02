import type { Prisma } from "@prisma/client";
import { BillingPlanCode, BillingSubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { calculateSubscriptionAmount, getPlanDefinition } from "@/modules/billing/domain/plan-catalog";
import {
  parseBillingAccountMetadata,
  resolveBillablePropertyCount,
} from "@/modules/billing/domain/subscription-property-count";

import { PLATFORM_EPAYCO_ORG_NAME } from "@/modules/billing/services/epayco-platform.service";

const PLATFORM_WOMPI_ORG_NAME = "PRAGMA Platform (Wompi)";
const PLATFORM_INTERNAL_ORG_NAMES = [PLATFORM_WOMPI_ORG_NAME, PLATFORM_EPAYCO_ORG_NAME];

export type OwnerClientSortField =
  | "createdAt"
  | "name"
  | "properties"
  | "users"
  | "reservations"
  | "revenue";

export type OwnerClientsQuery = {
  search?: string;
  status?: "ACTIVE" | "SUSPENDED" | "ALL";
  plan?: "STARTER" | "PRO" | "SCALE" | "ALL";
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
  pastDueCount: number;
  lockedCount: number;
  canceledCount: number;
  trialsExpiring7d: number;
  starterActiveCount: number;
  proActiveCount: number;
  scaleActiveCount: number;
  totalProperties: number;
  totalUsers: number;
  totalReservations: number;
  mrrEstimateCop: number;
  arrEstimateCop: number;
  openInvoicesTotalCop: number;
  openInvoicesCount: number;
  paidRevenue30dCop: number;
  paidRevenueAllTimeCop: number;
  platformReservationRevenueCop: number;
};

export type OwnerUpcomingRenewal = {
  organizationId: string;
  organizationName: string;
  mainEmail: string | null;
  plan: string;
  billingStatus: string;
  renewsAt: string;
  amountCop: number;
};

export type OwnerInvoiceRow = {
  id: string;
  organizationId: string;
  organizationName: string;
  amount: number;
  currency: string;
  status: string;
  dueAt: string;
  paidAt: string | null;
  description: string | null;
};

export type OwnerStatusBreakdown = {
  status: string;
  count: number;
};

export type OwnerPlanBreakdown = {
  plan: string;
  count: number;
  mrrCop: number;
};

export type OwnerDashboardSnapshot = {
  analytics: OwnerDashboardAnalytics;
  subscriptionByStatus: OwnerStatusBreakdown[];
  subscriptionByPlan: OwnerPlanBreakdown[];
  upcomingRenewals: OwnerUpcomingRenewal[];
  openInvoices: OwnerInvoiceRow[];
  recentPayments: OwnerInvoiceRow[];
};

function planMrr(
  plan: BillingPlanCode | string | null | undefined,
  activePropertyCount: number,
  metadata?: unknown,
  userPropertyCount?: number | null,
): number {
  if (
    plan !== BillingPlanCode.STARTER &&
    plan !== BillingPlanCode.PRO &&
    plan !== BillingPlanCode.SCALE
  ) {
    return 0;
  }
  const propertyCount = resolveBillablePropertyCount({
    propertySlots: parseBillingAccountMetadata(metadata).propertySlots,
    activePropertyCount,
    userPropertyCount,
  });
  return calculateSubscriptionAmount(plan, propertyCount);
}

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
    // Internal platform org must not appear as a commercial tenant.
    name: { notIn: PLATFORM_INTERNAL_ORG_NAMES },
    deletedAt: null,
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
            propertyCount: true,
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
          ? planMrr(
              billing.plan,
              org._count.properties,
              billing.metadata,
              owner?.propertyCount,
            )
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
  } else if (sortBy === "revenue") {
    items = items.sort((a, b) =>
      sortDir === "asc"
        ? a.reservationRevenueCop - b.reservationRevenueCop
        : b.reservationRevenueCop - a.reservationRevenueCop,
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
          metadata: org.billingAccount.metadata,
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
  const snapshot = await getOwnerDashboardSnapshot();
  return snapshot.analytics;
}

export async function getOwnerDashboardSnapshot(): Promise<OwnerDashboardSnapshot> {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const platformOrg = await db.organization.findFirst({
    where: { name: PLATFORM_WOMPI_ORG_NAME },
    select: { id: true },
  });
  const platformOrgId = platformOrg?.id;

  const billingAccountExclusion = platformOrgId
    ? { organizationId: { not: platformOrgId } }
    : {};
  const propertyExclusion = platformOrgId
    ? { organizationId: { not: platformOrgId } }
    : {};

  const [
    totalTenants,
    activeTenants,
    suspendedTenants,
    trialTenants,
    activeSubscriptions,
    pastDueCount,
    lockedCount,
    canceledCount,
    trialsExpiring7d,
    starterActiveCount,
    proActiveCount,
    scaleActiveCount,
    totalProperties,
    totalUsers,
    totalReservations,
    activeBillingAccounts,
    openInvoicesAgg,
    openInvoicesList,
    paid30dAgg,
    paidAllTimeAgg,
    reservationRevenueAgg,
    statusGroups,
    upcomingBillingAccounts,
    recentPaidInvoices,
  ] = await Promise.all([
    db.organization.count({
      where: { name: { notIn: PLATFORM_INTERNAL_ORG_NAMES }, deletedAt: null },
    }),
    db.organization.count({
      where: { status: "ACTIVE", name: { notIn: PLATFORM_INTERNAL_ORG_NAMES }, deletedAt: null },
    }),
    db.organization.count({
      where: { status: "SUSPENDED", name: { notIn: PLATFORM_INTERNAL_ORG_NAMES }, deletedAt: null },
    }),
    db.billingAccount.count({
      where: { status: BillingSubscriptionStatus.TRIAL, ...billingAccountExclusion },
    }),
    db.billingAccount.count({
      where: { status: BillingSubscriptionStatus.ACTIVE, ...billingAccountExclusion },
    }),
    db.billingAccount.count({
      where: { status: BillingSubscriptionStatus.PAST_DUE, ...billingAccountExclusion },
    }),
    db.billingAccount.count({
      where: { status: BillingSubscriptionStatus.LOCKED, ...billingAccountExclusion },
    }),
    db.billingAccount.count({
      where: { status: BillingSubscriptionStatus.CANCELED, ...billingAccountExclusion },
    }),
    db.billingAccount.count({
      where: {
        status: BillingSubscriptionStatus.TRIAL,
        trialEndsAt: { lte: in7Days, gte: now },
        ...billingAccountExclusion,
      },
    }),
    db.billingAccount.count({
      where: { status: BillingSubscriptionStatus.ACTIVE, plan: "STARTER", ...billingAccountExclusion },
    }),
    db.billingAccount.count({
      where: { status: BillingSubscriptionStatus.ACTIVE, plan: "PRO", ...billingAccountExclusion },
    }),
    db.billingAccount.count({
      where: { status: BillingSubscriptionStatus.ACTIVE, plan: "SCALE", ...billingAccountExclusion },
    }),
    db.property.count({ where: propertyExclusion }),
    db.user.count({ where: { deletedAt: null } }),
    db.reservation.count({
      where: {
        status: { not: "CANCELLED" },
        ...(platformOrgId
          ? { property: { organizationId: { not: platformOrgId } } }
          : {}),
      },
    }),
    db.billingAccount.findMany({
      where: { status: BillingSubscriptionStatus.ACTIVE, ...billingAccountExclusion },
      select: {
        plan: true,
        metadata: true,
        organization: {
          select: {
            _count: { select: { properties: true } },
            users: {
              where: { isAccountOwner: true, deletedAt: null },
              take: 1,
              select: { propertyCount: true },
            },
          },
        },
      },
    }),
    db.billingInvoice.aggregate({
      where: {
        status: "OPEN",
        ...(platformOrgId
          ? { account: { organizationId: { not: platformOrgId } } }
          : {}),
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.billingInvoice.findMany({
      where: {
        status: "OPEN",
        ...(platformOrgId
          ? { account: { organizationId: { not: platformOrgId } } }
          : {}),
      },
      orderBy: { dueAt: "asc" },
      take: 15,
      include: {
        account: {
          include: {
            organization: { select: { id: true, name: true } },
          },
        },
      },
    }),
    db.billingInvoice.aggregate({
      where: { status: "PAID", paidAt: { gte: thirtyDaysAgo } },
      _sum: { amount: true },
    }),
    db.billingInvoice.aggregate({
      where: {
        status: "PAID",
        ...(platformOrgId
          ? { account: { organizationId: { not: platformOrgId } } }
          : {}),
      },
      _sum: { amount: true },
    }),
    db.reservation.aggregate({
      where: {
        status: { not: "CANCELLED" },
        ...(platformOrgId
          ? { property: { organizationId: { not: platformOrgId } } }
          : {}),
      },
      _sum: { totalAmount: true },
    }),
    db.billingAccount.groupBy({
      by: ["status"],
      where: Object.keys(billingAccountExclusion).length ? billingAccountExclusion : undefined,
      _count: { _all: true },
    }),
    db.billingAccount.findMany({
      where: {
        OR: [
          { currentPeriodEnd: { lte: in7Days, gte: now } },
          { trialEndsAt: { lte: in7Days, gte: now } },
        ],
        ...billingAccountExclusion,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            _count: { select: { properties: true } },
            users: {
              where: { isAccountOwner: true, deletedAt: null },
              take: 1,
              select: { email: true, propertyCount: true },
            },
          },
        },
      },
      orderBy: { currentPeriodEnd: "asc" },
      take: 12,
    }),
    db.billingInvoice.findMany({
      where: {
        status: "PAID",
        ...(platformOrgId
          ? { account: { organizationId: { not: platformOrgId } } }
          : {}),
      },
      orderBy: { paidAt: "desc" },
      take: 12,
      include: {
        account: {
          include: {
            organization: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  const mrrEstimateCop = activeBillingAccounts.reduce((sum, acc) => {
    return (
      sum +
      planMrr(
        acc.plan,
        acc.organization?._count.properties ?? 0,
        acc.metadata,
        acc.organization?.users[0]?.propertyCount,
      )
    );
  }, 0);

  const analytics: OwnerDashboardAnalytics = {
    totalTenants,
    activeTenants,
    suspendedTenants,
    trialTenants,
    activeSubscriptions,
    pastDueCount,
    lockedCount,
    canceledCount,
    trialsExpiring7d,
    starterActiveCount,
    proActiveCount,
    scaleActiveCount,
    totalProperties,
    totalUsers,
    totalReservations,
    mrrEstimateCop,
    arrEstimateCop: mrrEstimateCop * 12,
    openInvoicesTotalCop: Number(openInvoicesAgg._sum.amount ?? 0),
    openInvoicesCount: openInvoicesAgg._count._all,
    paidRevenue30dCop: Number(paid30dAgg._sum.amount ?? 0),
    paidRevenueAllTimeCop: Number(paidAllTimeAgg._sum.amount ?? 0),
    platformReservationRevenueCop: Number(reservationRevenueAgg._sum.totalAmount ?? 0),
  };

  return {
    analytics,
    subscriptionByStatus: statusGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
    })),
    subscriptionByPlan: (["STARTER", "PRO", "SCALE"] as const)
      .map((plan) => {
        const accounts = activeBillingAccounts.filter((acc) => acc.plan === plan);
        return {
          plan,
          count: accounts.length,
          mrrCop: accounts.reduce(
            (sum, acc) =>
              sum +
              planMrr(
                acc.plan,
                acc.organization?._count.properties ?? 0,
                acc.metadata,
                acc.organization?.users[0]?.propertyCount,
              ),
            0,
          ),
        };
      })
      .filter((entry) => entry.count > 0),
    upcomingRenewals: upcomingBillingAccounts
      .filter((acc) => acc.organization)
      .map((acc) => {
        const renewsAt = acc.currentPeriodEnd ?? acc.trialEndsAt ?? now;
        return {
          organizationId: acc.organization!.id,
          organizationName: acc.organization!.name,
          mainEmail: acc.organization!.users[0]?.email ?? null,
          plan: acc.plan,
          billingStatus: acc.status,
          renewsAt: renewsAt.toISOString(),
          amountCop: planMrr(
            acc.plan,
            acc.organization!._count.properties,
            acc.metadata,
            acc.organization!.users[0]?.propertyCount,
          ),
        };
      }),
    openInvoices: openInvoicesList
      .filter((inv) => inv.account.organization)
      .map((inv) => ({
        id: inv.id,
        organizationId: inv.account.organization!.id,
        organizationName: inv.account.organization!.name,
        amount: Number(inv.amount),
        currency: inv.currency,
        status: inv.status,
        dueAt: inv.dueAt.toISOString(),
        paidAt: inv.paidAt?.toISOString() ?? null,
        description: inv.description,
      })),
    recentPayments: recentPaidInvoices
      .filter((inv) => inv.account.organization)
      .map((inv) => ({
        id: inv.id,
        organizationId: inv.account.organization!.id,
        organizationName: inv.account.organization!.name,
        amount: Number(inv.amount),
        currency: inv.currency,
        status: inv.status,
        dueAt: inv.dueAt.toISOString(),
        paidAt: inv.paidAt?.toISOString() ?? null,
        description: inv.description,
      })),
  };
}

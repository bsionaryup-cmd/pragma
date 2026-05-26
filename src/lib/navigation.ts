import {
  hasAnyPermission,
  hasPermission,
  type Permission,
} from "@/lib/auth/permissions";
import {
  planHasFeature,
  resolveRoutePlanFeature,
  type PlanFeature,
} from "@/lib/billing/plan-entitlements";
import type { BillingPlanCode } from "@prisma/client";
import type { TranslationKey } from "@/i18n/translate";
import type { AppUserRole } from "@/types/auth";

export type NavIconName =
  | "layout-dashboard"
  | "clipboard-list"
  | "message-circle"
  | "calendar-days"
  | "building-2"
  | "ribbon"
  | "wallet"
  | "line-chart"
  | "settings"
  | "key-round"
  | "credit-card"
  | "list-checks";

export type NavItem = {
  /** Clave i18n bajo `nav.*` */
  labelKey: TranslationKey;
  href: string;
  icon: NavIconName;
  permission: Permission;
  badge?: string;
  /** Si se define, el ítem solo aparece cuando el plan incluye este feature. */
  planFeature?: PlanFeature;
  /** Ocultar para roles operativos (ej. recepcionista). */
  hiddenForRoles?: AppUserRole[];
};

const mainNavItems: NavItem[] = [
  {
    labelKey: "nav.overview",
    href: "/panel",
    icon: "layout-dashboard",
    permission: "dashboard:read",
  },
  {
    labelKey: "nav.reservations",
    href: "/reservations",
    icon: "clipboard-list",
    permission: "reservations:read",
  },
  {
    labelKey: "nav.calendar",
    href: "/calendar",
    icon: "calendar-days",
    permission: "calendar:read",
  },
  {
    labelKey: "nav.tasks",
    href: "/tasks",
    icon: "list-checks",
    permission: "tasks:read",
    planFeature: "tasks",
  },
  {
    labelKey: "nav.messages",
    href: "/inbox",
    icon: "message-circle",
    permission: "reservations:read",
    hiddenForRoles: ["RECEPTIONIST"],
  },
  {
    labelKey: "nav.properties",
    href: "/properties",
    icon: "building-2",
    permission: "properties:read",
  },
  {
    labelKey: "nav.revenue",
    href: "/revenue",
    icon: "line-chart",
    permission: "finance:revenue:read",
    planFeature: "revenue",
  },
  {
    labelKey: "nav.smartAccess",
    href: "/smart-access",
    icon: "key-round",
    permission: "access:read",
    planFeature: "ttlock",
  },
  {
    labelKey: "nav.integrations",
    href: "/integrations",
    icon: "ribbon",
    permission: "integrations:read",
  },
];

const financeNavItem: NavItem = {
  labelKey: "nav.finance",
  href: "/finance",
  icon: "wallet",
  permission: "finance:read",
  planFeature: "finance",
};

const paymentLinksNavItem: NavItem = {
  labelKey: "nav.paymentLinks",
  href: "/finance/payment-links",
  icon: "credit-card",
  permission: "finance:read",
  planFeature: "finance",
};

/** Rutas secundarias bajo Finanzas (solo ADMIN con finance:read). */
export const financeSecondaryLinks: Pick<NavItem, "labelKey" | "href" | "permission">[] =
  [
    {
      labelKey: "nav.financeOverview",
      href: "/finance",
      permission: "finance:read",
    },
    {
      labelKey: "nav.paymentLinks",
      href: "/finance/payment-links",
      permission: "finance:read",
    },
    {
      labelKey: "nav.paymentHistory",
      href: "/finance/payment-history",
      permission: "finance:read",
    },
  ];

const usersNavItem: NavItem = {
  labelKey: "nav.users",
  href: "/users",
  icon: "clipboard-list",
  permission: "users:read",
};

const settingsNavItem: NavItem = {
  labelKey: "nav.settings",
  href: "/settings",
  icon: "settings",
  permission: "settings:read",
};

export const secondaryRouteLinks: Pick<NavItem, "labelKey" | "href" | "permission">[] =
  financeSecondaryLinks;

export function getSecondaryRouteLinksForRole(
  role: AppUserRole,
): Pick<NavItem, "labelKey" | "href">[] {
  return secondaryRouteLinks
    .filter((item) => hasPermission(role, item.permission))
    .map(({ labelKey, href }) => ({ labelKey, href }));
}

function navItemAllowedForPlan(
  item: NavItem,
  plan: BillingPlanCode | null | undefined,
): boolean {
  if (!item.planFeature) return true;
  if (!plan) return true;
  return planHasFeature(plan, item.planFeature);
}

export function getMainNavigationForRole(
  role: AppUserRole,
  plan?: BillingPlanCode | null,
): NavItem[] {
  const items = mainNavItems.filter(
    (item) =>
      hasPermission(role, item.permission) &&
      navItemAllowedForPlan(item, plan) &&
      !(item.hiddenForRoles?.includes(role)),
  );

  if (
    hasAnyPermission(role, ["finance:read", "finance:operations:read"]) &&
    navItemAllowedForPlan(financeNavItem, plan)
  ) {
    items.push(paymentLinksNavItem);
    items.push(financeNavItem);
  }

  if (hasPermission(role, "users:read")) {
    items.push(usersNavItem);
  }

  return items;
}

export function isNavHrefAllowedForPlan(
  href: string,
  plan: BillingPlanCode | null | undefined,
): boolean {
  if (!plan) return true;
  const feature = resolveRoutePlanFeature(href);
  if (!feature) return true;
  return planHasFeature(plan, feature);
}

export function getSettingsNavItem(role: AppUserRole): NavItem | null {
  return hasPermission(role, settingsNavItem.permission) ? settingsNavItem : null;
}

/** @deprecated Usar getMainNavigationForRole + getSettingsNavItem */
export function getNavigationForRole(role: AppUserRole): NavItem[] {
  const settings = getSettingsNavItem(role);
  return settings
    ? [...getMainNavigationForRole(role), settings]
    : getMainNavigationForRole(role);
}

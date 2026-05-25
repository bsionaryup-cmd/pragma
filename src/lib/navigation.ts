import {
  hasAnyPermission,
  hasPermission,
  type Permission,
} from "@/lib/auth/permissions";
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
  },
  {
    labelKey: "nav.smartAccess",
    href: "/smart-access",
    icon: "key-round",
    permission: "access:read",
  },
  {
    labelKey: "nav.integrations",
    href: "/integrations",
    icon: "ribbon",
    permission: "integrations:read",
  },
  {
    labelKey: "nav.messages",
    href: "/inbox",
    icon: "message-circle",
    permission: "reservations:read",
  },
];

const financeNavItem: NavItem = {
  labelKey: "nav.finance",
  href: "/finance",
  icon: "wallet",
  permission: "finance:read",
};

const billingNavItem: NavItem = {
  labelKey: "nav.billing",
  href: "/settings/billing",
  icon: "credit-card",
  permission: "billing:manage",
};

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
  [];

export function getSecondaryRouteLinksForRole(
  role: AppUserRole,
): Pick<NavItem, "labelKey" | "href">[] {
  return secondaryRouteLinks
    .filter((item) => hasPermission(role, item.permission))
    .map(({ labelKey, href }) => ({ labelKey, href }));
}

export function getMainNavigationForRole(role: AppUserRole): NavItem[] {
  const items = mainNavItems.filter((item) =>
    hasPermission(role, item.permission),
  );

  if (
    hasAnyPermission(role, ["finance:read", "finance:operations:read"])
  ) {
    items.push(financeNavItem);
  }

  if (hasPermission(role, "billing:manage")) {
    items.push(billingNavItem);
  }

  if (hasPermission(role, "users:read")) {
    items.push(usersNavItem);
  }

  return items;
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

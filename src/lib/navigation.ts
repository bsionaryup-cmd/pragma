import { hasPermission, type Permission } from "@/lib/auth/permissions";
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
  | "settings";

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
    labelKey: "nav.properties",
    href: "/properties",
    icon: "building-2",
    permission: "properties:read",
  },
  {
    labelKey: "nav.calendar",
    href: "/calendar",
    icon: "calendar-days",
    permission: "calendar:read",
  },
  {
    labelKey: "nav.integrations",
    href: "/integrations",
    icon: "ribbon",
    permission: "properties:read",
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

export const secondaryRouteLinks: Pick<NavItem, "labelKey" | "href" | "permission">[] =
  [
    {
      labelKey: "nav.users",
      href: "/users",
      permission: "users:read",
    },
  ];

export function getSecondaryRouteLinksForRole(
  role: AppUserRole,
): Pick<NavItem, "labelKey" | "href">[] {
  return secondaryRouteLinks
    .filter((item) => hasPermission(role, item.permission))
    .map(({ labelKey, href }) => ({ labelKey, href }));
}

const settingsNavItem: NavItem = {
  labelKey: "nav.settings",
  href: "/settings",
  icon: "settings",
  permission: "dashboard:read",
};

export function getMainNavigationForRole(role: AppUserRole): NavItem[] {
  const items = mainNavItems.filter((item) =>
    hasPermission(role, item.permission),
  );
  if (hasPermission(role, "finance:read")) {
    items.push(financeNavItem);
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

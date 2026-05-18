import { hasPermission, type Permission } from "@/lib/auth/permissions";
import type { AppUserRole } from "@/types/auth";

/** Identificador serializable (Server → Client). */
export type NavIconName =
  | "layout-dashboard"
  | "clipboard-list"
  | "message-circle"
  | "calendar-days"
  | "ribbon"
  | "settings";

export type NavItem = {
  title: string;
  href: string;
  icon: NavIconName;
  permission: Permission;
  /** Badge opcional (p. ej. "Nuevo" en Ajustes). */
  badge?: string;
};

const mainNavItems: NavItem[] = [
  {
    title: "Panel de control",
    href: "/panel",
    icon: "layout-dashboard",
    permission: "dashboard:read",
  },
  {
    title: "Reservas",
    href: "/reservations",
    icon: "clipboard-list",
    permission: "reservations:read",
  },
  {
    title: "Bandeja de entrada",
    href: "/inbox",
    icon: "message-circle",
    permission: "reservations:read",
  },
  {
    title: "Calendario",
    href: "/calendar",
    icon: "calendar-days",
    permission: "calendar:read",
  },
  {
    title: "Integraciones",
    href: "/integrations",
    icon: "ribbon",
    permission: "properties:read",
  },
];

const settingsNavItem: NavItem = {
  title: "Ajustes",
  href: "/settings",
  icon: "settings",
  permission: "dashboard:read",
  badge: "Nuevo",
};

export function getMainNavigationForRole(role: AppUserRole): NavItem[] {
  return mainNavItems.filter((item) => hasPermission(role, item.permission));
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

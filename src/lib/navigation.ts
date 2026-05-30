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
import { isNavPathActive } from "@/lib/navigation-active";

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

export type NavChildLink = {
  labelKey: TranslationKey;
  href: string;
  permission: Permission;
  planFeature?: PlanFeature;
  /** Solo visible con permiso integrations:manage (SIRE, Wompi, TRAA). */
  requiresIntegrationsManage?: boolean;
  hiddenForRoles?: AppUserRole[];
};

export type NavLinkModule = NavItem & { type: "link" };

export type NavGroupModule = {
  type: "group";
  id: string;
  labelKey: TranslationKey;
  href: string;
  icon: NavIconName;
  permission: Permission;
  planFeature?: PlanFeature;
  hiddenForRoles?: AppUserRole[];
  /** Si es false, abrir el grupo solo muestra el submenú sin navegar. */
  navigateOnOpen?: boolean;
  children: NavChildLink[];
};

export type NavModule = NavLinkModule | NavGroupModule;

const panelNavItem: NavItem = {
  labelKey: "nav.overview",
  href: "/panel",
  icon: "layout-dashboard",
  permission: "dashboard:read",
};

const reservationsNavItem: NavItem = {
  labelKey: "nav.reservations",
  href: "/reservations",
  icon: "clipboard-list",
  permission: "reservations:read",
};

const novedadesNavItem: NavItem = {
  labelKey: "nav.novedades",
  href: "/novedades",
  icon: "message-circle",
  permission: "reservations:read",
};

const calendarNavItem: NavItem = {
  labelKey: "nav.calendar",
  href: "/calendar",
  icon: "calendar-days",
  permission: "calendar:read",
};

const tasksNavGroup: Omit<NavGroupModule, "children"> = {
  type: "group",
  id: "tasks",
  labelKey: "nav.tasks",
  href: "/tasks/compras",
  icon: "list-checks",
  permission: "tasks:read",
  planFeature: "tasks",
};

const tasksNavChildren: NavChildLink[] = [
  {
    labelKey: "nav.purchases",
    href: "/tasks/compras",
    permission: "tasks:read",
    planFeature: "tasks",
  },
  {
    labelKey: "nav.maintenance",
    href: "/tasks/mantenimiento",
    permission: "tasks:read",
    planFeature: "tasks",
  },
  {
    labelKey: "nav.cleaning",
    href: "/tasks/limpieza",
    permission: "tasks:read",
    planFeature: "tasks",
  },
  {
    labelKey: "nav.inventory",
    href: "/tasks/inventario",
    permission: "tasks:read",
    planFeature: "tasks",
  },
];

const propertiesNavItem: NavItem = {
  labelKey: "nav.properties",
  href: "/properties",
  icon: "building-2",
  permission: "properties:read",
};

const revenueNavItem: NavItem = {
  labelKey: "nav.revenue",
  href: "/revenue",
  icon: "line-chart",
  permission: "finance:revenue:read",
  planFeature: "revenue",
};

const financeNavGroup: Omit<NavGroupModule, "children"> = {
  type: "group",
  id: "finance",
  labelKey: "nav.finance",
  href: "/finance",
  icon: "wallet",
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

const configurationNavGroup: Omit<NavGroupModule, "children"> = {
  type: "group",
  id: "configuration",
  labelKey: "nav.settings",
  href: "/settings",
  icon: "settings",
  permission: "settings:read",
  navigateOnOpen: false,
};

const configurationNavChildren: NavChildLink[] = [
  {
    labelKey: "nav.integrations",
    href: "/integrations",
    permission: "integrations:read",
  },
  {
    labelKey: "nav.smartAccess",
    href: "/smart-access",
    permission: "access:read",
    planFeature: "ttlock",
  },
  {
    labelKey: "nav.users",
    href: "/users",
    permission: "users:read",
  },
  {
    labelKey: "nav.configuration",
    href: "/settings",
    permission: "settings:read",
  },
];

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
  item: Pick<NavItem, "planFeature">,
  plan: BillingPlanCode | null | undefined,
): boolean {
  if (!item.planFeature) return true;
  if (!plan) return true;
  return planHasFeature(plan, item.planFeature);
}

function navChildAllowedForRole(
  child: NavChildLink,
  role: AppUserRole,
  plan: BillingPlanCode | null | undefined,
): boolean {
  if (child.hiddenForRoles?.includes(role)) return false;
  if (!hasPermission(role, child.permission)) return false;
  if (!navItemAllowedForPlan(child, plan)) return false;
  if (
    child.requiresIntegrationsManage &&
    !hasPermission(role, "integrations:manage")
  ) {
    return false;
  }
  return true;
}

function filterNavChildren(
  children: NavChildLink[],
  role: AppUserRole,
  plan: BillingPlanCode | null | undefined,
): NavChildLink[] {
  return children.filter((child) => navChildAllowedForRole(child, role, plan));
}

function navLinkModule(item: NavItem): NavLinkModule {
  return { type: "link", ...item };
}

function navLinkAllowed(
  item: NavItem,
  role: AppUserRole,
  plan: BillingPlanCode | null | undefined,
): boolean {
  if (item.hiddenForRoles?.includes(role)) return false;
  if (!hasPermission(role, item.permission)) return false;
  return navItemAllowedForPlan(item, plan);
}

export function isNavGroupModule(module: NavModule): module is NavGroupModule {
  return module.type === "group";
}

/** Hijo activo único por grupo (ruta más específica gana). */
export function getActiveNavChild(
  pathname: string,
  children: NavChildLink[],
): NavChildLink | null {
  let best: NavChildLink | null = null;

  for (const child of children) {
    if (!isNavPathActive(pathname, child.href)) continue;
    if (!best || child.href.length > best.href.length) {
      best = child;
    }
  }

  return best;
}

export function isNavModuleActive(pathname: string, module: NavModule): boolean {
  if (module.type === "link") {
    return isNavPathActive(pathname, module.href);
  }

  if (getActiveNavChild(pathname, module.children)) return true;
  return isNavPathActive(pathname, module.href);
}

/** Id del grupo que contiene la ruta actual, si aplica. */
export function getActiveNavGroupId(
  pathname: string,
  modules: NavModule[],
): string | null {
  for (const module of modules) {
    if (!isNavGroupModule(module)) continue;
    if (isNavModuleActive(pathname, module)) return module.id;
  }
  return null;
}

export function getNavigationModulesForRole(
  role: AppUserRole,
  plan?: BillingPlanCode | null,
): NavModule[] {
  const modules: NavModule[] = [];

  if (navLinkAllowed(panelNavItem, role, plan)) {
    modules.push(navLinkModule(panelNavItem));
  }

  if (navLinkAllowed(reservationsNavItem, role, plan)) {
    modules.push(navLinkModule(reservationsNavItem));
  }

  if (navLinkAllowed(novedadesNavItem, role, plan)) {
    modules.push(navLinkModule(novedadesNavItem));
  }

  if (navLinkAllowed(calendarNavItem, role, plan)) {
    modules.push(navLinkModule(calendarNavItem));
  }

  const tasksChildren = filterNavChildren(tasksNavChildren, role, plan);
  if (tasksChildren.length > 0) {
    modules.push({ ...tasksNavGroup, children: tasksChildren });
  }

  if (navLinkAllowed(propertiesNavItem, role, plan)) {
    modules.push(navLinkModule(propertiesNavItem));
  }

  if (navLinkAllowed(revenueNavItem, role, plan)) {
    modules.push(navLinkModule(revenueNavItem));
  }

  if (
    hasAnyPermission(role, ["finance:read", "finance:operations:read"]) &&
    navItemAllowedForPlan(financeNavGroup, plan)
  ) {
    const financeChildren = filterNavChildren(
      financeSecondaryLinks as NavChildLink[],
      role,
      plan,
    );
    if (financeChildren.length > 0) {
      modules.push({ ...financeNavGroup, children: financeChildren });
    }
  }

  const configurationChildren: NavChildLink[] = [];

  if (hasPermission(role, "integrations:read")) {
    configurationChildren.push(
      ...filterNavChildren(
        configurationNavChildren.filter((child) =>
          child.href.startsWith("/integrations"),
        ),
        role,
        plan,
      ),
    );
  }

  const smartAccessChild = configurationNavChildren.find(
    (child) => child.href === "/smart-access",
  );
  if (
    smartAccessChild &&
    navChildAllowedForRole(smartAccessChild, role, plan)
  ) {
    configurationChildren.push(smartAccessChild);
  }

  const usersChild = configurationNavChildren.find(
    (child) => child.href === "/users",
  );
  if (usersChild && navChildAllowedForRole(usersChild, role, plan)) {
    configurationChildren.push(usersChild);
  }

  const settingsChild = configurationNavChildren.find(
    (child) => child.href === "/settings",
  );
  if (settingsChild && navChildAllowedForRole(settingsChild, role, plan)) {
    configurationChildren.push(settingsChild);
  }

  if (configurationChildren.length > 0) {
    const canReadSettings = hasPermission(role, "settings:read");
    modules.push({
      ...configurationNavGroup,
      permission: canReadSettings ? "settings:read" : "integrations:read",
      children: configurationChildren,
    });
  }

  return modules;
}

export function getMainNavigationForRole(
  role: AppUserRole,
  plan?: BillingPlanCode | null,
): NavItem[] {
  return getNavigationModulesForRole(role, plan)
    .filter((module): module is NavLinkModule => module.type === "link")
    .map(({ type: _type, ...item }) => item);
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

/** Configuración vive en el grupo principal; no duplicar en el pie del sidebar. */
export function getSettingsNavItem(_role: AppUserRole): NavItem | null {
  return null;
}

/** @deprecated Usar getMainNavigationForRole + getSettingsNavItem */
export function getNavigationForRole(role: AppUserRole): NavItem[] {
  return getMainNavigationForRole(role);
}

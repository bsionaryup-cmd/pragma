import type { BillingPlanCode } from "@prisma/client";

/** Módulos y capacidades controlados por plan comercial. */
export type PlanFeature =
  | "calendar"
  | "reservations"
  | "properties"
  | "inbox"
  | "ical"
  | "tasks"
  | "finance"
  | "revenue"
  | "ttlock"
  | "pricelabs"
  | "reports"
  | "sire"
  | "traa";

export type PlanLimits = {
  maxProperties: number;
  maxUsers: number;
};

const PLAN_LIMITS: Record<BillingPlanCode, PlanLimits> = {
  STARTER: { maxProperties: 5, maxUsers: 2 },
  PRO: { maxProperties: 25, maxUsers: 5 },
  SCALE: { maxProperties: 999, maxUsers: 999 },
};

const PLAN_FEATURES: Record<BillingPlanCode, ReadonlySet<PlanFeature>> = {
  STARTER: new Set([
    "calendar",
    "reservations",
    "properties",
    "inbox",
    "ical",
  ]),
  PRO: new Set([
    "calendar",
    "reservations",
    "properties",
    "inbox",
    "ical",
    "tasks",
    "finance",
    "revenue",
    "ttlock",
    "pricelabs",
    "reports",
    "sire",
    "traa",
  ]),
  SCALE: new Set([
    "calendar",
    "reservations",
    "properties",
    "inbox",
    "ical",
    "tasks",
    "finance",
    "revenue",
    "ttlock",
    "pricelabs",
    "reports",
    "sire",
    "traa",
  ]),
};

/** Rutas del dashboard → feature requerida (null = siempre permitido con permiso RBAC). */
export const ROUTE_PLAN_FEATURE: Record<string, PlanFeature | null> = {
  "/panel": null,
  "/reservations": "reservations",
  "/calendar": "calendar",
  "/tasks": "tasks",
  "/inbox": "inbox",
  "/properties": "properties",
  "/revenue": "revenue",
  "/smart-access": "ttlock",
  "/finance": "finance",
  "/integrations": null,
  "/integrations/airbnb": "ical",
  "/integrations/ttlock": "ttlock",
  "/integrations/ttlock/connect": "ttlock",
  "/integrations/pricelabs": "pricelabs",
  "/integrations/sire": "sire",
  "/integrations/traa": "traa",
  "/users": null,
  "/settings": null,
  "/settings/billing": null,
};

export function getPlanLimits(plan: BillingPlanCode): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.STARTER;
}

export function getEffectivePropertyLimit(
  plan: BillingPlanCode,
  propertySlots: number | null | undefined,
): number {
  const planMax = getPlanLimits(plan).maxProperties;
  if (typeof propertySlots === "number" && propertySlots >= 1) {
    return Math.min(planMax, propertySlots);
  }
  return planMax;
}

export function clampPropertyCountForPlan(
  plan: BillingPlanCode,
  count: number,
): number {
  const max = getPlanLimits(plan).maxProperties;
  return Math.min(max, Math.max(1, Math.round(count)));
}

export function planHasFeature(
  plan: BillingPlanCode,
  feature: PlanFeature,
): boolean {
  return PLAN_FEATURES[plan]?.has(feature) ?? false;
}

export function getRequiredPlanForFeature(
  feature: PlanFeature,
): BillingPlanCode {
  if (PLAN_FEATURES.STARTER.has(feature)) return "STARTER";
  if (PLAN_FEATURES.PRO.has(feature)) return "PRO";
  return "SCALE";
}

export function getCommercialPlanLabel(plan: BillingPlanCode): string {
  switch (plan) {
    case "STARTER":
      return "Start";
    case "PRO":
      return "Pro";
    case "SCALE":
      return "Scale";
    default:
      return "Start";
  }
}

export function resolveRoutePlanFeature(pathname: string): PlanFeature | null {
  const normalized = pathname.split("?")[0] ?? pathname;
  const entries = Object.entries(ROUTE_PLAN_FEATURE).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [prefix, feature] of entries) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return feature;
    }
  }
  return null;
}

export function isRouteAllowedForPlan(
  pathname: string,
  plan: BillingPlanCode,
): boolean {
  const feature = resolveRoutePlanFeature(pathname);
  if (!feature) return true;
  return planHasFeature(plan, feature);
}

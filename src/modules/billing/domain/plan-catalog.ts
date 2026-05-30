import type { BillingPlanCode } from "@prisma/client";
import { getCommercialPlanLabel } from "@/lib/billing/plan-entitlements";
import { clampPropertyCountForPlan } from "@/lib/billing/plan-entitlements";

export type PlanDefinition = {
  code: BillingPlanCode;
  name: string;
  tagline: string;
  description: string;
  /** Precio mensual por propiedad activa (COP). */
  pricePerPropertyCop: number;
  currency: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  /** Tope de propiedades del plan (referencia comercial). */
  maxProperties: number;
  /** Tope de usuarios del plan. */
  maxUsers: number;
};

export const PLAN_CATALOG: Record<BillingPlanCode, PlanDefinition> = {
  STARTER: {
    code: "STARTER",
    name: "Starter",
    tagline: "Para propietarios pequeños",
    description:
      "Calendario, reservas y propiedades para empezar a centralizar tu operación.",
    pricePerPropertyCop: 49_900,
    currency: "COP",
    maxProperties: 5,
    maxUsers: 2,
    features: [
      "Calendario y reservas multi-propiedad",
      "Sync iCal Airbnb",
      "Panel operativo y registro de huéspedes",
      "Hasta 5 propiedades · 2 usuarios",
    ],
  },
  PRO: {
    code: "PRO",
    name: "Pro",
    tagline: "El equilibrio ideal para crecer",
    description:
      "TTLock, PriceLabs, finanzas y tareas para operadores que escalan con control.",
    pricePerPropertyCop: 79_900,
    currency: "COP",
    highlighted: true,
    badge: "Más popular",
    maxProperties: 25,
    maxUsers: 5,
    features: [
      "Todo lo del plan Starter",
      "TTLock — códigos por reserva",
      "PriceLabs — tarifas y overrides",
      "Finanzas, tareas y reportes",
      "SIRE y TRAA — reportes gubernamentales",
      "Hasta 25 propiedades · 5 usuarios",
    ],
  },
  SCALE: {
    code: "SCALE",
    name: "Scale",
    tagline: "Para operadores con mayor volumen",
    description:
      "Capacidad ampliada, soporte prioritario y herramientas para portafolios grandes.",
    pricePerPropertyCop: 129_900,
    currency: "COP",
    maxProperties: 999,
    maxUsers: 999,
    features: [
      "Todo lo del plan Pro",
      "Capacidad ampliada (999+ propiedades)",
      "Usuarios ilimitados en la organización",
      "Onboarding asistido y soporte prioritario",
      "Consola de ventas y ofertas comerciales",
    ],
  },
};

export const MIN_BILLABLE_PROPERTIES = 1;
export const MAX_BILLABLE_PROPERTIES = 999;

export function getPlanDefinition(code: BillingPlanCode): PlanDefinition {
  return PLAN_CATALOG[code] ?? PLAN_CATALOG.STARTER;
}

export function getPlanDisplayName(code: BillingPlanCode): string {
  return getPlanDefinition(code).name || getCommercialPlanLabel(code);
}

export function getPlanPricePerProperty(code: BillingPlanCode): number {
  return getPlanDefinition(code).pricePerPropertyCop;
}

/** @deprecated Use calculateSubscriptionAmount(plan, propertyCount) */
export function getPlanMonthlyAmount(code: BillingPlanCode): number {
  return calculateSubscriptionAmount(code, 1);
}

export function clampPropertyCount(count: number): number {
  if (!Number.isFinite(count)) return MIN_BILLABLE_PROPERTIES;
  return Math.min(
    MAX_BILLABLE_PROPERTIES,
    Math.max(MIN_BILLABLE_PROPERTIES, Math.round(count)),
  );
}

export function clampPropertyCountForBillingPlan(
  plan: BillingPlanCode,
  count: number,
): number {
  return clampPropertyCountForPlan(plan, clampPropertyCount(count));
}

export function calculateSubscriptionAmount(
  code: BillingPlanCode,
  propertyCount: number,
): number {
  return getPlanPricePerProperty(code) * clampPropertyCountForBillingPlan(code, propertyCount);
}

export function formatCop(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function proPlanMonthlySavingsVsStarter(propertyCount: number): number {
  const count = clampPropertyCount(propertyCount);
  const starterTotal = calculateSubscriptionAmount("STARTER", count);
  const proTotal = calculateSubscriptionAmount("PRO", count);
  return proTotal - starterTotal;
}

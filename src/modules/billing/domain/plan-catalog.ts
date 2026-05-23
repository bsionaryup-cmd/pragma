import type { BillingPlanCode } from "@prisma/client";

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
};

export const PLAN_CATALOG: Record<BillingPlanCode, PlanDefinition> = {
  STARTER: {
    code: "STARTER",
    name: "Básico",
    tagline: "Esencial para empezar",
    description: "Operación centralizada para anfitriones que inician o consolidan su portafolio.",
    pricePerPropertyCop: 79_999,
    currency: "COP",
    features: [
      "Calendario y reservas multi-propiedad",
      "Sync iCal Airbnb",
      "Panel de ingresos",
      "Registro de huéspedes",
      "Integración TTLock",
    ],
  },
  PRO: {
    code: "PRO",
    name: "Pro",
    tagline: "Más control, más ingresos",
    description: "Automatización avanzada, reportes y soporte prioritario para escalar sin fricción.",
    pricePerPropertyCop: 89_999,
    currency: "COP",
    highlighted: true,
    badge: "Recomendado",
    features: [
      "Todo lo del plan Básico",
      "PriceLabs — precios dinámicos",
      "Reportes avanzados de ocupación e ingresos",
      "Automatizaciones operativas",
      "Soporte prioritario y onboarding asistido",
    ],
  },
};

export const MIN_BILLABLE_PROPERTIES = 1;
export const MAX_BILLABLE_PROPERTIES = 999;

export function getPlanDefinition(code: BillingPlanCode): PlanDefinition {
  return PLAN_CATALOG[code] ?? PLAN_CATALOG.STARTER;
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

export function calculateSubscriptionAmount(
  code: BillingPlanCode,
  propertyCount: number,
): number {
  return getPlanPricePerProperty(code) * clampPropertyCount(propertyCount);
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

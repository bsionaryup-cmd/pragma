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
    name: "Start",
    tagline: "Opera tus Airbnb sin Excel",
    description:
      "Calendario, reservas y propiedades para anfitriones que inician en Medellín y LatAm.",
    pricePerPropertyCop: 79_999,
    currency: "COP",
    maxProperties: 5,
    maxUsers: 2,
    features: [
      "Calendario y reservas multi-propiedad",
      "Sync iCal Airbnb",
      "Mensajes y panel operativo",
      "Registro de huéspedes",
      "Hasta 5 propiedades · 2 usuarios",
    ],
  },
  PRO: {
    code: "PRO",
    name: "Pro",
    tagline: "Escala ingresos y operación",
    description:
      "Automatización, TTLock, PriceLabs y finanzas para property managers en crecimiento.",
    pricePerPropertyCop: 89_999,
    currency: "COP",
    highlighted: true,
    badge: "Recomendado",
    maxProperties: 25,
    maxUsers: 5,
    features: [
      "Todo lo del plan Start",
      "TTLock — códigos por reserva",
      "PriceLabs — precios dinámicos",
      "Finanzas, tareas y reportes",
      "Hasta 25 propiedades · 5 usuarios",
    ],
  },
  SCALE: {
    code: "SCALE",
    name: "Scale",
    tagline: "Property manager profesional",
    description:
      "Operación enterprise, cumplimiento SIRE/TRAA y capacidad ampliada para portafolios grandes.",
    pricePerPropertyCop: 74_999,
    currency: "COP",
    maxProperties: 999,
    maxUsers: 999,
    features: [
      "Todo lo del plan Pro",
      "SIRE y TRAA — reportes gubernamentales",
      "Capacidad ampliada (999+ propiedades)",
      "Usuarios ilimitados en la organización",
      "Onboarding asistido y soporte prioritario",
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

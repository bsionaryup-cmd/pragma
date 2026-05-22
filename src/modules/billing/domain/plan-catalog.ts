import type { BillingPlanCode } from "@prisma/client";

export type PlanDefinition = {
  code: BillingPlanCode;
  name: string;
  description: string;
  monthlyAmountCop: number;
  currency: string;
  features: string[];
  highlighted?: boolean;
};

export const PLAN_CATALOG: Record<BillingPlanCode, PlanDefinition> = {
  STARTER: {
    code: "STARTER",
    name: "Starter",
    description: "Operación centralizada para anfitriones en crecimiento",
    monthlyAmountCop: 199_000,
    currency: "COP",
    highlighted: true,
    features: [
      "Calendario multi-propiedad",
      "Reservas e inbox operativo",
      "Sync iCal Airbnb",
      "Panel de ingresos",
      "Integraciones TTLock y PriceLabs",
    ],
  },
  PRO: {
    code: "PRO",
    name: "Pro",
    description: "Escala con más propiedades y soporte prioritario",
    monthlyAmountCop: 399_000,
    currency: "COP",
    features: [
      "Todo lo de Starter",
      "Hasta 25 propiedades",
      "Reportes avanzados",
      "Soporte prioritario",
      "Onboarding asistido",
    ],
  },
};

export function getPlanDefinition(code: BillingPlanCode): PlanDefinition {
  return PLAN_CATALOG[code] ?? PLAN_CATALOG.STARTER;
}

export function getPlanMonthlyAmount(code: BillingPlanCode): number {
  return getPlanDefinition(code).monthlyAmountCop;
}

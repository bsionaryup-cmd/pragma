import { BillingSubscriptionStatus } from "@prisma/client";
import { resolveBillingLocked } from "@/lib/billing/billing-access";

export type TenantValidityKind = "subscription" | "trial";

export type TenantAccountStateCode =
  | "SUSPENDED"
  | "CANCELED"
  | "LOCKED"
  | "PAST_DUE"
  | "TRIAL"
  | "ACTIVE"
  | "ACTIVE_EXPIRED"
  | "NO_BILLING";

export type TenantAccountStateInput = {
  organizationStatus: string;
  billing: {
    status: BillingSubscriptionStatus;
    trialEndsAt: Date | string | null;
    currentPeriodEnd: Date | string | null;
    gracePeriodEndsAt: Date | string | null;
    billingLockedAt: Date | string | null;
  } | null;
  now?: Date;
};

export type TenantAccountState = {
  code: TenantAccountStateCode;
  label: string;
  tone: "ok" | "warn" | "danger";
  /** El tenant no puede usar el PMS (desactivado o bloqueado por billing). */
  accessBlocked: boolean;
  /** Bloqueo por suscripción (independiente de la desactivación por el Owner). */
  billingLocked: boolean;
  validityKind: TenantValidityKind;
  /** Fecha de vigencia editable (fin de prueba o fin de período pagado). */
  validUntil: string | null;
  /** Fecha en que una cuenta vencida pasa a bloqueada. */
  gracePeriodEndsAt: string | null;
};

const BOGOTA_TIME_ZONE = "America/Bogota";
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value: Date | string | null | undefined): string | null {
  return toDate(value)?.toISOString() ?? null;
}

export function resolveTenantValidityKind(
  billing: NonNullable<TenantAccountStateInput["billing"]>,
): TenantValidityKind {
  if (billing.status === BillingSubscriptionStatus.TRIAL) return "trial";
  if (
    billing.status === BillingSubscriptionStatus.LOCKED &&
    !billing.currentPeriodEnd &&
    billing.trialEndsAt
  ) {
    return "trial";
  }
  return "subscription";
}

export function resolveTenantAccountState(
  input: TenantAccountStateInput,
): TenantAccountState {
  const now = input.now ?? new Date();
  const suspended = input.organizationStatus === "SUSPENDED";
  const billing = input.billing;

  if (!billing) {
    return {
      code: suspended ? "SUSPENDED" : "NO_BILLING",
      label: suspended ? "Desactivado por el Owner" : "Sin cuenta de facturación",
      tone: suspended ? "danger" : "warn",
      accessBlocked: suspended,
      billingLocked: false,
      validityKind: "subscription",
      validUntil: null,
      gracePeriodEndsAt: null,
    };
  }

  const billingLocked = resolveBillingLocked({
    status: billing.status,
    trialEndsAt: toDate(billing.trialEndsAt),
    gracePeriodEndsAt: toDate(billing.gracePeriodEndsAt),
    billingLockedAt: toDate(billing.billingLockedAt),
  });
  const validityKind = resolveTenantValidityKind(billing);
  const validUntil =
    validityKind === "trial"
      ? toIso(billing.trialEndsAt)
      : toIso(billing.currentPeriodEnd);
  const base = {
    billingLocked,
    accessBlocked: suspended || billingLocked,
    validityKind,
    validUntil,
    gracePeriodEndsAt: toIso(billing.gracePeriodEndsAt),
  };

  if (suspended) {
    return { ...base, code: "SUSPENDED", label: "Desactivado por el Owner", tone: "danger" };
  }
  if (billing.status === BillingSubscriptionStatus.CANCELED) {
    return { ...base, code: "CANCELED", label: "Suscripción cancelada", tone: "danger" };
  }
  if (billingLocked) {
    return {
      ...base,
      code: "LOCKED",
      label:
        validityKind === "trial"
          ? "Bloqueado: prueba vencida"
          : "Bloqueado por falta de pago",
      tone: "danger",
    };
  }
  if (billing.status === BillingSubscriptionStatus.PAST_DUE) {
    return { ...base, code: "PAST_DUE", label: "Vencido (en período de gracia)", tone: "warn" };
  }
  if (billing.status === BillingSubscriptionStatus.TRIAL) {
    return { ...base, code: "TRIAL", label: "En prueba", tone: "ok" };
  }

  const periodEnd = toDate(billing.currentPeriodEnd);
  if (periodEnd && periodEnd.getTime() < now.getTime()) {
    return {
      ...base,
      code: "ACTIVE_EXPIRED",
      label: "Vencido (pendiente de procesar)",
      tone: "warn",
    };
  }
  return { ...base, code: "ACTIVE", label: "Activo", tone: "ok" };
}

/** `YYYY-MM-DD` (input date) → fin de ese día en Bogotá. */
export function parseValidUntilDateInput(value: unknown): Date | null {
  if (typeof value !== "string" || !DATE_INPUT_PATTERN.test(value)) return null;
  const date = new Date(`${value}T23:59:59.999-05:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (toBogotaDateInputValue(date) !== value) return null;
  return date;
}

/** ISO/Date → `YYYY-MM-DD` en hora de Bogotá (valor para `<input type="date">`). */
export function toBogotaDateInputValue(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

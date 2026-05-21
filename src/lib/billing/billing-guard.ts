import { getBillingAccessSnapshot } from "@/services/billing/billing.service";

export class BillingLockedError extends Error {
  readonly code = "BILLING_LOCKED" as const;

  constructor(message: string) {
    super(message);
    this.name = "BillingLockedError";
  }
}

export function isBillingLockedError(error: unknown): error is BillingLockedError {
  return error instanceof BillingLockedError;
}

const DEFAULT_MESSAGE =
  "Tu cuenta está en modo restringido. Actualiza el pago en el centro de facturación para continuar.";

/** Throws when subscription is locked (server actions / pipelines). */
export async function assertBillingUnlocked(): Promise<void> {
  const access = await getBillingAccessSnapshot();
  if (access.locked) {
    throw new BillingLockedError(access.reason ?? DEFAULT_MESSAGE);
  }
}

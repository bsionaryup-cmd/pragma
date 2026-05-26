import "server-only";

import { db } from "@/lib/db";
import { normalizeUserEmail } from "@/lib/auth/clerk-user-upsert-policy";

export { buildTrialBillingMetadata } from "@/lib/billing/trial-eligibility-metadata";

export class TrialAlreadyConsumedError extends Error {
  constructor(
    message = "Este correo ya utilizó la prueba gratuita de PRAGMA. Inicia sesión para suscribirte o gestionar tu cuenta.",
  ) {
    super(message);
    this.name = "TrialAlreadyConsumedError";
  }
}

/** True si el correo ya fue dueño de un tenant que recibió cuenta de facturación (trial SaaS). */
export async function hasEmailConsumedSaasTrial(email: string): Promise<boolean> {
  const normalized = normalizeUserEmail(email);
  if (!normalized) return false;

  const ownerWithBilling = await db.user.findFirst({
    where: {
      email: { equals: normalized, mode: "insensitive" },
      isAccountOwner: true,
      organizationId: { not: null },
      organization: {
        is: {
          billingAccount: { isNot: null },
        },
      },
    },
    select: { id: true },
  });

  return Boolean(ownerWithBilling);
}

export async function assertEmailEligibleForNewSaasTrial(email: string): Promise<void> {
  if (await hasEmailConsumedSaasTrial(email)) {
    throw new TrialAlreadyConsumedError();
  }
}

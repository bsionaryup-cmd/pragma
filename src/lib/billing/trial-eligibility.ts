import "server-only";

import type { TrialRetrialPolicy } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeUserEmail } from "@/lib/auth/clerk-user-upsert-policy";
import {
  normalizeTrialOwnerEmail,
  parseTrialBillingMetadata,
} from "@/lib/billing/trial-retrial-policy";

export { buildTrialBillingMetadata } from "@/lib/billing/trial-eligibility-metadata";

export class TrialAlreadyConsumedError extends Error {
  constructor(
    message = "Este correo ya utilizó la prueba gratuita de PRAGMA. Inicia sesión para suscribirte o gestionar tu cuenta.",
  ) {
    super(message);
    this.name = "TrialAlreadyConsumedError";
  }
}

export class TrialBlockedByOwnerError extends Error {
  constructor(
    message = "La prueba gratuita no está disponible para este correo. Contacta a soporte PRAGMA.",
  ) {
    super(message);
    this.name = "TrialBlockedByOwnerError";
  }
}

async function listBillingAccountsForTrialEmail(email: string) {
  const normalized = normalizeUserEmail(email);
  if (!normalized) return [];

  const [byOwner, byMetadata] = await Promise.all([
    db.billingAccount.findMany({
      where: {
        organization: {
          users: {
            some: {
              email: { equals: normalized, mode: "insensitive" },
              isAccountOwner: true,
            },
          },
        },
      },
      select: {
        id: true,
        trialRetrialPolicy: true,
        metadata: true,
      },
    }),
    db.billingAccount.findMany({
      where: {
        metadata: {
          path: ["trialOwnerEmail"],
          equals: normalized,
        },
      },
      select: {
        id: true,
        trialRetrialPolicy: true,
        metadata: true,
      },
    }),
  ]);

  const merged = new Map<string, (typeof byOwner)[number]>();
  for (const row of [...byOwner, ...byMetadata]) {
    merged.set(row.id, row);
  }
  return [...merged.values()];
}

export async function resolveSaasTrialEligibility(email: string): Promise<{
  eligible: boolean;
  policy: TrialRetrialPolicy | null;
  reason: string;
}> {
  const normalized = normalizeUserEmail(email);
  if (!normalized) {
    return { eligible: false, policy: null, reason: "Correo inválido" };
  }

  const accounts = await listBillingAccountsForTrialEmail(normalized);
  if (accounts.some((row) => row.trialRetrialPolicy === "BLOCK")) {
    return {
      eligible: false,
      policy: "BLOCK",
      reason: "Prueba bloqueada por el owner de plataforma",
    };
  }

  if (accounts.some((row) => row.trialRetrialPolicy === "ALLOW")) {
    return {
      eligible: true,
      policy: "ALLOW",
      reason: "Owner autorizó una nueva prueba gratuita",
    };
  }

  if (accounts.length > 0) {
    return {
      eligible: false,
      policy: "DEFAULT",
      reason: "Este correo ya utilizó la prueba gratuita de PRAGMA",
    };
  }

  return { eligible: true, policy: null, reason: "Elegible para prueba gratuita" };
}

/** True si el correo ya fue dueño de un tenant que recibió cuenta de facturación (trial SaaS). */
export async function hasEmailConsumedSaasTrial(email: string): Promise<boolean> {
  const result = await resolveSaasTrialEligibility(email);
  return !result.eligible;
}

export async function assertEmailEligibleForNewSaasTrial(email: string): Promise<void> {
  const result = await resolveSaasTrialEligibility(email);
  if (result.eligible) return;

  if (result.policy === "BLOCK") {
    throw new TrialBlockedByOwnerError();
  }

  throw new TrialAlreadyConsumedError();
}

export async function getTenantTrialRetrialPolicy(organizationId: string) {
  const account = await db.billingAccount.findUnique({
    where: { organizationId },
    select: {
      trialRetrialPolicy: true,
      trialEndsAt: true,
      status: true,
      metadata: true,
    },
  });

  if (!account) return null;

  const meta = parseTrialBillingMetadata(account.metadata);
  const owner = await db.user.findFirst({
    where: { organizationId, isAccountOwner: true, deletedAt: null },
    select: { email: true },
  });

  const trialEmail =
    normalizeTrialOwnerEmail(meta.trialOwnerEmail) ??
    normalizeTrialOwnerEmail(owner?.email);

  const eligibility = trialEmail
    ? await resolveSaasTrialEligibility(trialEmail)
    : null;

  return {
    policy: account.trialRetrialPolicy,
    trialEmail,
    trialEndsAt: account.trialEndsAt?.toISOString() ?? null,
    billingStatus: account.status,
    eligibility,
  };
}

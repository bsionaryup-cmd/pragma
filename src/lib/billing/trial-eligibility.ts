import "server-only";

import { Prisma, type TrialRetrialPolicy } from "@prisma/client";
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

type TrialEmailBillingRow = {
  id: string;
  trialRetrialPolicy: TrialRetrialPolicy;
  metadata: unknown;
};

async function fetchBillingAccountsForTrialEmail(
  normalized: string,
  includeRetrialPolicy: boolean,
): Promise<TrialEmailBillingRow[]> {
  const policySelect = includeRetrialPolicy ? { trialRetrialPolicy: true } : {};

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
        metadata: true,
        ...policySelect,
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
        metadata: true,
        ...policySelect,
      },
    }),
  ]);

  const merged = new Map<string, TrialEmailBillingRow>();
  for (const row of [...byOwner, ...byMetadata]) {
    const policy =
      "trialRetrialPolicy" in row && row.trialRetrialPolicy
        ? row.trialRetrialPolicy
        : "DEFAULT";
    merged.set(row.id, {
      id: row.id,
      metadata: row.metadata,
      trialRetrialPolicy: policy,
    });
  }
  return [...merged.values()];
}

async function listBillingAccountsForTrialEmail(email: string) {
  const normalized = normalizeUserEmail(email);
  if (!normalized) return [];

  try {
    return await fetchBillingAccountsForTrialEmail(normalized, true);
  } catch (error) {
    if (!isMissingTrialRetrialPolicyField(error)) throw error;
    return fetchBillingAccountsForTrialEmail(normalized, false);
  }
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

function isMissingTrialRetrialPolicyField(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientValidationError &&
    String(error.message).includes("trialRetrialPolicy")
  );
}

async function loadTenantTrialRetrialPolicy(
  organizationId: string,
  options?: { includeRetrialPolicy?: boolean },
) {
  const account = await db.billingAccount.findUnique({
    where: { organizationId },
    select: {
      ...(options?.includeRetrialPolicy !== false
        ? { trialRetrialPolicy: true }
        : {}),
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

  const policy =
    "trialRetrialPolicy" in account && account.trialRetrialPolicy
      ? account.trialRetrialPolicy
      : ("DEFAULT" as TrialRetrialPolicy);

  return {
    policy,
    trialEmail,
    trialEndsAt: account.trialEndsAt?.toISOString() ?? null,
    billingStatus: account.status,
    eligibility,
  };
}

export async function getTenantTrialRetrialPolicy(organizationId: string) {
  try {
    return await loadTenantTrialRetrialPolicy(organizationId);
  } catch (error) {
    if (!isMissingTrialRetrialPolicyField(error)) throw error;
    return loadTenantTrialRetrialPolicy(organizationId, {
      includeRetrialPolicy: false,
    });
  }
}

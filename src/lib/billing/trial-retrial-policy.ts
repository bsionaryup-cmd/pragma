import type { TrialRetrialPolicy } from "@prisma/client";
import { normalizeUserEmail } from "@/lib/auth/clerk-user-upsert-policy";

export type TrialBillingMetadata = {
  trialOwnerEmail?: string;
  trialStartedAt?: string;
};

export function parseTrialBillingMetadata(metadata: unknown): TrialBillingMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const raw = metadata as Record<string, unknown>;
  return {
    trialOwnerEmail:
      typeof raw.trialOwnerEmail === "string" ? raw.trialOwnerEmail : undefined,
    trialStartedAt:
      typeof raw.trialStartedAt === "string" ? raw.trialStartedAt : undefined,
  };
}

export function trialRetrialPolicyLabel(policy: TrialRetrialPolicy): string {
  switch (policy) {
    case "ALLOW":
      return "Nueva prueba permitida";
    case "BLOCK":
      return "Prueba bloqueada";
    default:
      return "Regla estándar";
  }
}

export function normalizeTrialOwnerEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return normalizeUserEmail(email);
}

import { normalizeUserEmail } from "@/lib/auth/clerk-user-upsert-policy";

export function buildTrialBillingMetadata(ownerEmail: string) {
  return {
    trialOwnerEmail: normalizeUserEmail(ownerEmail),
    trialStartedAt: new Date().toISOString(),
  };
}

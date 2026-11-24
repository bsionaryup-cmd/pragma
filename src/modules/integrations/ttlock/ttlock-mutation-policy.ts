/**
 * Platform Owner impersonation must never create/reassign TTLock rows under the
 * Owner's userId — that races @@unique([userId]) / organizationId @unique and
 * can crash read-only routes like /panel.
 */
export function shouldAllowTTLockIntegrationMutation(input: {
  isImpersonating: boolean;
}): boolean {
  return !input.isImpersonating;
}

/**
 * Pure decision helper for platform-owner access to tenant PMS routes.
 * Keeps Owner self-service (own org) distinct from cross-tenant impersonation.
 */

export type OwnerDashboardAccessDecision =
  | { action: "allow-impersonation" }
  | { action: "allow-own-tenant" }
  | { action: "redirect-owner-home" }
  | { action: "redirect-impersonation-failed" };

export function resolveOwnerDashboardAccess(input: {
  isImpersonating: boolean;
  hasOwnOrganization: boolean;
  /** True when the request expects an active impersonation (cookie bridge / query). */
  expectsImpersonation?: boolean;
  pathname?: string;
  isSelfServicePath?: boolean;
}): OwnerDashboardAccessDecision {
  if (input.isImpersonating) {
    return { action: "allow-impersonation" };
  }

  if (input.expectsImpersonation) {
    // Impersonate CTA succeeded on the client but the HttpOnly cookie was not
    // present on the next document request — do not silently open own-tenant PMS.
    return { action: "redirect-impersonation-failed" };
  }

  if (input.hasOwnOrganization) {
    return { action: "allow-own-tenant" };
  }

  if (input.isSelfServicePath) {
    return { action: "allow-own-tenant" };
  }

  return { action: "redirect-owner-home" };
}

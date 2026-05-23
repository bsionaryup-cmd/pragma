/**
 * SaaS subscription billing access policy (Wompi — platform-owned).
 * Hospitality operational payments (reservations, guests, OTA) are out of scope.
 */

export const BILLING_PLATFORM_OWNER_CAPABILITIES = [
  "wompi:credentials:manage",
  "wompi:environment:switch",
  "billing:global:revenue",
  "billing:global:subscriptions",
  "billing:webhooks:monitor",
  "billing:failed-payments:view",
  "billing:retry:manage",
  "billing:tenant:override",
] as const;

export const BILLING_TENANT_CAPABILITIES = [
  "billing:subscription:view",
  "billing:subscription:pay",
  "billing:subscription:cancel",
  "billing:invoices:view",
  "billing:invoices:download",
  "billing:payment:retry",
] as const;

export type BillingPlatformCapability =
  (typeof BILLING_PLATFORM_OWNER_CAPABILITIES)[number];

export type BillingTenantCapability = (typeof BILLING_TENANT_CAPABILITIES)[number];

/** Paths that remain accessible when subscription is locked. */
export const BILLING_SELF_SERVICE_PATHS = [
  "/settings/billing",
  "/onboarding",
] as const;

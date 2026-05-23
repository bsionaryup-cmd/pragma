/** Tenant self-service paths a platform owner may use for their linked organization. */
export const PLATFORM_OWNER_SELF_SERVICE_PREFIXES = [
  "/settings",
  "/integrations",
  "/users",
] as const;

export function isPlatformOwnerSelfServicePath(pathname: string): boolean {
  return PLATFORM_OWNER_SELF_SERVICE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function platformOwnerCanUseOwnTenantSettings(user: {
  organizationId: string | null;
}): boolean {
  return Boolean(user.organizationId);
}

const RESERVED_SLUG_SEGMENTS = [
  "panel",
  "calendar",
  "reservations",
  "properties",
  "finance",
  "revenue",
  "integrations",
  "settings",
  "users",
  "tasks",
  "inbox",
  "novedades",
  "smart-access",
  "prospecting",
  "onboarding",
  "unauthorized",
  "sign-in",
  "sign-up",
  "owner-login",
  "owner-dashboard",
  "intiendas",
  "api",
  "w",
  "web-builder",
  "pricing",
  "contact",
  "demo",
  "guest-registration",
  "offer",
  "legal",
  "pay",
  "m",
  "account-suspended",
  "forgot-password",
  "post-login",
  "login",
] as const;

export const RESERVED_PUBLIC_SLUGS = new Set<string>(RESERVED_SLUG_SEGMENTS);

export function isReservedPublicSlug(slug: string): boolean {
  const normalized = normalizeSiteSlug(slug);
  if (!normalized) return true;
  return RESERVED_PUBLIC_SLUGS.has(normalized);
}

export function normalizeSiteSlug(input: string): string {
  const lowered = input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const alnum = lowered.replace(/[^a-z0-9-]/g, "-");
  const collapsed = alnum.replace(/-+/g, "-").replace(/^-|-$/g, "");
  return collapsed;
}
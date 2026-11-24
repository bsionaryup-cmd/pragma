import { redirect } from "next/navigation";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants";
import { sanitizeAuthRedirectPath } from "@/lib/auth/verification-flow";

type LegacyOwnerLoginProps = {
  searchParams: Promise<{
    next?: string;
    redirect_url?: string;
    error?: string;
  }>;
};

/**
 * Legacy Owner Login used `@clerk/nextjs/legacy` useSignIn — on production
 * Custom Domains `isLoaded` stays false forever and the CTA never enables.
 * Canonical access is `/sign-in` (SignInFuture) with next → owner-dashboard.
 */
export default async function LegacyOwnerLoginRedirect({
  searchParams,
}: LegacyOwnerLoginProps) {
  const params = await searchParams;
  const next = sanitizeAuthRedirectPath(
    params.next || params.redirect_url,
    OWNER_DASHBOARD_PATH,
  );
  const qs = new URLSearchParams();
  qs.set("next", next);
  if (params.error) qs.set("error", params.error);
  redirect(`/sign-in?${qs.toString()}`);
}

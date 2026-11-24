import { redirect } from "next/navigation";
import { APP_LOGIN_PATH } from "@/lib/auth/auth-paths";
import { sanitizeAuthRedirectPath } from "@/lib/auth/verification-flow";

export const dynamic = "force-dynamic";

type AuthContinuePageProps = {
  searchParams: Promise<{ next?: string }>;
};

/**
 * Legacy URL only. Bounce to unified /login — never settle UI here.
 */
export default async function AuthContinuePage({
  searchParams,
}: AuthContinuePageProps) {
  const params = await searchParams;
  const next = sanitizeAuthRedirectPath(params.next, "/panel");
  redirect(`${APP_LOGIN_PATH}?redirect_url=${encodeURIComponent(next)}`);
}

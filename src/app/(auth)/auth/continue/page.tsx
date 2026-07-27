import { redirect } from "next/navigation";
import { sanitizeAuthRedirectPath } from "@/lib/auth/verification-flow";

export const dynamic = "force-dynamic";

type AuthContinuePageProps = {
  searchParams: Promise<{ next?: string }>;
};

/**
 * Legacy URL only. Always bounce to /sign-in or /owner-login — never settle UI here.
 */
export default async function AuthContinuePage({
  searchParams,
}: AuthContinuePageProps) {
  const params = await searchParams;
  const next = sanitizeAuthRedirectPath(params.next, "/panel");
  const isOwner =
    next.startsWith("/owner") || next.includes("owner-dashboard");
  if (isOwner) {
    redirect(`/owner-login?next=${encodeURIComponent(next)}`);
  }
  redirect(`/sign-in?redirect_url=${encodeURIComponent(next)}`);
}

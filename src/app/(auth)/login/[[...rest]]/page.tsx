import { redirect } from "next/navigation";
import { sanitizeAuthRedirectPath } from "@/lib/auth/verification-flow";

type LoginAliasPageProps = {
  searchParams: Promise<{
    next?: string;
    redirect_url?: string;
  }>;
};

/**
 * Alias de compatibilidad: Clerk / bookmarks a veces usan `/login`.
 * La app canónica es `/sign-in`.
 */
export default async function LoginAliasPage({
  searchParams,
}: LoginAliasPageProps) {
  const params = await searchParams;
  const next = sanitizeAuthRedirectPath(
    params.next || params.redirect_url,
    "/panel",
  );
  redirect(`/sign-in?next=${encodeURIComponent(next)}`);
}

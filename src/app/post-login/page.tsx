import { redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { resolvePostAuthHomePathForUser } from "@/lib/billing/post-auth-redirect";

export const dynamic = "force-dynamic";

/**
 * Post-login settle: one entry for Owner + tenants.
 * Resolves home by role (Owner → /owner-dashboard, Admin/Receptionist → /panel…).
 * The login form navigates here after Clerk session cookies are ready.
 */
export default async function PostLoginPage() {
  const user = await requireDbUser();
  redirect(await resolvePostAuthHomePathForUser(user));
}

import { redirect } from "next/navigation";
import { APP_LOGIN_PATH } from "@/lib/auth/auth-paths";

type LegacyOwnerLoginProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy alias — permanent redirect to unified /login. */
export default async function LegacyOwnerLoginRedirect({
  searchParams,
}: LegacyOwnerLoginProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    }
  }
  // Owner historically used `next`; unified login accepts both next and redirect_url.
  const q = qs.toString();
  redirect(q ? `${APP_LOGIN_PATH}?${q}` : APP_LOGIN_PATH);
}

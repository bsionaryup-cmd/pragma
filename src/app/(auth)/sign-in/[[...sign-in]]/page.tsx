import { redirect } from "next/navigation";
import { APP_LOGIN_PATH } from "@/lib/auth/auth-paths";

type LegacySignInProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy alias — permanent redirect to unified /login. */
export default async function LegacySignInRedirect({
  searchParams,
}: LegacySignInProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    }
  }
  const q = qs.toString();
  redirect(q ? `${APP_LOGIN_PATH}?${q}` : APP_LOGIN_PATH);
}

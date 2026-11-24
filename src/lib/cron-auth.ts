/**
 * Shared cron authorization. Fail-closed when CRON_SECRET is unset.
 * Production: Bearer header only (query `?secret=` rejected — leaks to logs).
 * Non-production: Bearer or query secret for local tooling.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  if (process.env.NODE_ENV === "production") return false;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

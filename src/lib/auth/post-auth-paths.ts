/** Shared post-auth path helpers (safe for server + client). */

export function buildAuthContinuePath(nextPath: string): string {
  const next = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
  return `/auth/continue?next=${encodeURIComponent(next)}`;
}

export function isPublicPostAuthPath(path: string): boolean {
  return (
    path === "/auth/continue" ||
    path.startsWith("/auth/continue?") ||
    path === "/sign-in" ||
    path.startsWith("/sign-in?") ||
    path === "/owner-login" ||
    path.startsWith("/owner-login?")
  );
}

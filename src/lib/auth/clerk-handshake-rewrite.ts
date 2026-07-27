/**
 * Pure helper: rewrite Clerk handshake Location that points at the broken
 * direct FAPI host onto the same-origin `/__clerk` proxy.
 */
export function rewriteClerkFapiHandshakeLocationUrl(
  location: string,
  requestOrigin: string,
  proxyPath = "/__clerk",
): string | null {
  try {
    const loc = new URL(location, requestOrigin);
    const host = loc.hostname.toLowerCase();
    const isDirectFapi =
      host === "clerk.pragmapms.com" ||
      host.startsWith("clerk.") ||
      host.endsWith(".clerk.accounts.dev") ||
      host === "frontend-api.clerk.dev" ||
      host.endsWith(".frontend-api.clerk.dev");

    if (!isDirectFapi) return null;
    if (loc.pathname.startsWith(`${proxyPath}/`) || loc.pathname === proxyPath) {
      return null;
    }

    const rewritten = new URL(requestOrigin);
    rewritten.pathname = `${proxyPath}${loc.pathname.startsWith("/") ? "" : "/"}${loc.pathname}`;
    rewritten.search = loc.search;
    rewritten.hash = loc.hash;
    return rewritten.toString();
  } catch {
    return null;
  }
}

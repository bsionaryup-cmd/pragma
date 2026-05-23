export const DASHBOARD_DATA_REFRESH_EVENT = "pragma-dashboard-data-refresh";

export const DASHBOARD_DATA_POLL_MS = 12_000;
export const DASHBOARD_DATA_REFRESH_COOLDOWN_MS = 4_000;

const LIVE_DASHBOARD_PREFIXES = [
  "/panel",
  "/calendar",
  "/reservations",
  "/inbox",
  "/smart-access",
] as const;

export function isLiveDashboardPath(pathname: string): boolean {
  return LIVE_DASHBOARD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

let lastGlobalRefreshAt = 0;

export function canRunDashboardRefresh(now = Date.now()): boolean {
  return now - lastGlobalRefreshAt >= DASHBOARD_DATA_REFRESH_COOLDOWN_MS;
}

export function markDashboardRefresh(now = Date.now()): void {
  lastGlobalRefreshAt = now;
}

export function dispatchDashboardDataRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DASHBOARD_DATA_REFRESH_EVENT));
}

export function subscribeDashboardDataRefresh(
  listener: () => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(DASHBOARD_DATA_REFRESH_EVENT, listener);
  return () => window.removeEventListener(DASHBOARD_DATA_REFRESH_EVENT, listener);
}

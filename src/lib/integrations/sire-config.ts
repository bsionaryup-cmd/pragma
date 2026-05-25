/** SIRE (Migración Colombia) — server-only configuration. */

export const SIRE_PORTAL_DEFAULT_BASE = "https://apps.migracioncolombia.gov.co";
export const SIRE_PORTAL_DEFAULT_LOGIN_PATH = "/sire/public/login.jsf";
export const SIRE_DEFAULT_DOCUMENT_TYPE = "10";

const DEFAULT_TIMEOUT_MS = 30_000;

export type SireAuthMode = "portal" | "api";

export function getSirePortalBaseUrl(): string {
  const raw = process.env.SIRE_PORTAL_BASE_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, "") : SIRE_PORTAL_DEFAULT_BASE;
}

export function getSirePortalLoginPath(): string {
  const raw = process.env.SIRE_PORTAL_LOGIN_PATH?.trim();
  if (raw && raw.startsWith("/")) return raw;
  return SIRE_PORTAL_DEFAULT_LOGIN_PATH;
}

export function getSireRequestTimeoutMs(): number {
  const raw = Number(process.env.SIRE_REQUEST_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

export function getSireApiBaseUrl(): string | null {
  const raw = process.env.SIRE_API_BASE_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, "") : null;
}

export function getSireApiTokenPath(): string {
  const raw = process.env.SIRE_API_TOKEN_PATH?.trim();
  return raw && raw.startsWith("/") ? raw : "/oauth/token";
}

export function getSireApiTestPath(): string | null {
  const raw = process.env.SIRE_API_TEST_PATH?.trim();
  return raw && raw.length > 0 ? (raw.startsWith("/") ? raw : `/${raw}`) : null;
}

export function getSireDefaultDocumentType(): string {
  return process.env.SIRE_DEFAULT_DOCUMENT_TYPE?.trim() || SIRE_DEFAULT_DOCUMENT_TYPE;
}

/** portal = JSF login Migración; api = OAuth/REST cuando SIRE_API_BASE_URL está definida. */
export function resolveSireAuthMode(): SireAuthMode {
  const explicit = process.env.SIRE_AUTH_MODE?.trim().toLowerCase();
  if (explicit === "api") return "api";
  if (explicit === "portal") return "portal";
  return getSireApiBaseUrl() ? "api" : "portal";
}

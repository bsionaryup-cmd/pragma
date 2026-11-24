/** Canonical unified login (Owner + tenant). */
export const APP_LOGIN_PATH = "/login";

/** Post-logout entry — forces residual Clerk session cleanup on the form. */
export const APP_SIGNED_OUT_LOGIN_PATH = `${APP_LOGIN_PATH}?signed_out=1`;

/**
 * After credentials succeed, land here so the server picks Owner vs tenant home.
 * Do not send Owner straight to /panel (tenant guard would bounce awkwardly).
 */
export const APP_POST_LOGIN_PATH = "/post-login";

/** Legacy alias paths that permanently redirect to APP_LOGIN_PATH. */
export const APP_LOGIN_ALIASES = ["/sign-in", "/owner-login"] as const;

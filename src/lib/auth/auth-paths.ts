/** Canonical login for this deploy (Owner + tenant). */
export const APP_LOGIN_PATH = "/sign-in";

/** Post-logout entry — forces residual Clerk session cleanup on the form. */
export const APP_SIGNED_OUT_LOGIN_PATH = `${APP_LOGIN_PATH}?signed_out=1`;

/**
 * After credentials succeed, prefer an explicit next= from the form.
 * Owner bookmarks use /sign-in?next=/owner-dashboard.
 */
export const APP_POST_LOGIN_PATH = "/owner-dashboard";

/** Legacy alias paths. */
export const APP_LOGIN_ALIASES = ["/login", "/owner-login"] as const;

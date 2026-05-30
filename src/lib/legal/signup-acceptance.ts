export const SIGNUP_LEGAL_ACCEPTANCE_STORAGE_KEY = "pragma-signup-legal-accepted";

export function markSignupLegalAcceptedPending() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SIGNUP_LEGAL_ACCEPTANCE_STORAGE_KEY, "1");
}

export function consumeSignupLegalAcceptedPending(): boolean {
  if (typeof window === "undefined") return false;
  const value = sessionStorage.getItem(SIGNUP_LEGAL_ACCEPTANCE_STORAGE_KEY);
  if (value !== "1") return false;
  sessionStorage.removeItem(SIGNUP_LEGAL_ACCEPTANCE_STORAGE_KEY);
  return true;
}

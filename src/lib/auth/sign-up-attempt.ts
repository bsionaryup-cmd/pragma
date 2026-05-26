import type { SignUpFutureResource } from "@clerk/shared/types";

/** Clerk sign-up resource exists but there is no in-progress server attempt. */
export function hasActiveSignUpAttempt(
  signUp: SignUpFutureResource | null | undefined,
): boolean {
  if (!signUp) return false;

  return Boolean(
    signUp.id ||
      signUp.emailAddress ||
      signUp.status === "missing_requirements" ||
      signUp.unverifiedFields.length > 0 ||
      signUp.hasPassword,
  );
}

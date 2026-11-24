import type { ClerkAPIError, SignInErrors, SignUpErrors } from "@clerk/shared/types";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";

export function isMissingSignUpAttemptMessage(message: string): boolean {
  return /no sign up attempt was found/i.test(message);
}

const CLERK_ERROR_MESSAGES: Record<string, string> = {
  client_state_invalid:
    "Tu registro expiró o se reinició. Vuelve a completar el formulario e intenta de nuevo.",
  form_password_incorrect:
    "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo. Si entras como Owner, también puedes usar «Entrar con código al correo».",
  form_password_or_identifier_incorrect:
    "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo. Si entras como Owner, también puedes usar «Entrar con código al correo».",
  form_identifier_not_found:
    "No encontramos una cuenta con ese correo. Revisa el email o crea una cuenta nueva.",
  session_exists:
    "Había una sesión residual. Cerrándola para que puedas entrar de nuevo…",
  form_param_format_invalid:
    "El formato del correo no es válido. Revisa e intenta de nuevo.",
  too_many_requests:
    "Demasiados intentos. Espera un momento e intenta de nuevo.",
  strategy_for_user_invalid:
    "Tu cuenta no admite este método. Prueba «Entrar con código al correo» o contacta al administrador.",
  form_code_incorrect:
    "Código incorrecto. Revisa el correo e intenta de nuevo.",
  form_password_pwned:
    "Esa contraseña no se puede usar. Restablécela o entra con código al correo.",
  form_password_compromised:
    "Esa contraseña no se puede usar. Restablécela o entra con código al correo.",
};

const PASSWORD_INCORRECT_RE =
  /password is incorrect|incorrect password|try again, or use another method|form_password_incorrect|form_password_or_identifier_incorrect/i;

function localizeClerkMessage(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  if (PASSWORD_INCORRECT_RE.test(raw)) {
    return CLERK_ERROR_MESSAGES.form_password_incorrect;
  }
  return null;
}

function messageFromClerkError(error: ClerkAPIError | null | undefined): string | null {
  if (!error) return null;
  const code = error.code;
  if (code && CLERK_ERROR_MESSAGES[code]) {
    return CLERK_ERROR_MESSAGES[code];
  }
  const fromText =
    localizeClerkMessage(error.longMessage) ||
    localizeClerkMessage(error.message);
  if (fromText) return fromText;
  if (error.longMessage) return error.longMessage;
  if (error.message) return error.message;
  return null;
}

export function getSignInFlowErrorMessage(
  result: { error: ClerkAPIError | null } | null | undefined,
  fieldErrors: SignInErrors | undefined,
  fallback: string,
): string {
  const direct = messageFromClerkError(result?.error ?? null);
  if (direct) return direct;

  const fields = fieldErrors?.fields;
  const fieldMessage =
    fields?.password?.message ??
    fields?.identifier?.message ??
    fields?.code?.message ??
    fieldErrors?.global?.[0]?.message;

  if (fieldMessage) {
    return localizeClerkMessage(fieldMessage) ?? fieldMessage;
  }

  return fallback;
}

export function getSignUpFlowErrorMessage(
  result: { error: ClerkAPIError | null } | null | undefined,
  fieldErrors: SignUpErrors | undefined,
  fallback: string,
): string {
  const direct = messageFromClerkError(result?.error ?? null);
  if (direct) return direct;

  const fields = fieldErrors?.fields;
  const fieldMessage =
    fields?.password?.message ??
    fields?.emailAddress?.message ??
    fields?.code?.message ??
    fieldErrors?.global?.[0]?.message;

  if (fieldMessage) return fieldMessage;

  return fallback;
}

export function getClerkAuthErrorMessage(error: unknown, fallback: string): string {
  if (isClerkAPIResponseError(error)) {
    const first = error.errors[0];
    const code = first?.code;

    if (code && CLERK_ERROR_MESSAGES[code]) {
      return CLERK_ERROR_MESSAGES[code];
    }

    const localized =
      localizeClerkMessage(first?.longMessage) ||
      localizeClerkMessage(first?.message);
    if (localized) return localized;

    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }

  if (error instanceof Error && error.message.trim()) {
    if (isMissingSignUpAttemptMessage(error.message)) {
      return CLERK_ERROR_MESSAGES.client_state_invalid ?? error.message;
    }
    return localizeClerkMessage(error.message) ?? error.message;
  }

  return fallback;
}

export function getSignUpGlobalErrorMessage(
  fieldErrors: SignUpErrors | undefined,
  fallback: string,
): string | null {
  const globalMessage = fieldErrors?.global?.[0]?.message;
  if (!globalMessage) return null;
  if (isMissingSignUpAttemptMessage(globalMessage)) {
    return CLERK_ERROR_MESSAGES.client_state_invalid ?? globalMessage;
  }
  return localizeClerkMessage(globalMessage) ?? globalMessage ?? fallback;
}

export function isAlreadySignedInAuthError(error: unknown): boolean {
  if (isClerkAPIResponseError(error)) {
    const code = error.errors[0]?.code;
    if (code === "session_exists" || code === "identifier_already_signed_in") {
      return true;
    }
    const message = `${error.errors[0]?.message ?? ""} ${error.errors[0]?.longMessage ?? ""}`;
    if (/already signed in/i.test(message)) return true;
  }

  if (error && typeof error === "object" && "error" in error) {
    const nested = (error as { error?: ClerkAPIError | null }).error;
    if (nested?.code === "session_exists" || nested?.code === "identifier_already_signed_in") {
      return true;
    }
    if (/already signed in/i.test(`${nested?.message ?? ""} ${nested?.longMessage ?? ""}`)) {
      return true;
    }
  }

  if (error instanceof Error && /already signed in|session_exists/i.test(error.message)) {
    return true;
  }

  if (typeof error === "string" && /already signed in|session_exists/i.test(error)) {
    return true;
  }

  return false;
}

export function incompleteSignInStatusMessage(status: string | null | undefined): string {
  switch (status) {
    case "needs_second_factor":
    case "needs_client_trust":
      return "Completa la verificación de seguridad para continuar.";
    case "needs_new_password":
      return "Debes restablecer tu contraseña antes de continuar.";
    case "needs_identifier":
      return "Ingresa tu correo electrónico para continuar.";
    default:
      return "No se pudo completar el inicio de sesión. Intenta de nuevo.";
  }
}

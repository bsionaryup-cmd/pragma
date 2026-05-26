"use client";

import { useAuth, useClerk, useSignIn } from "@clerk/nextjs";
import type { SignInFutureResource } from "@clerk/shared/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { KeyRound, Mail } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSignInFlowErrorMessage } from "@/lib/clerk-auth-errors";
import {
  formatResendCooldown,
  isVerificationCodeActive,
  sanitizeAuthRedirectPath,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from "@/lib/auth/verification-flow";

const SIGN_IN_REDIRECT = "/sign-in?signed_out=1";
const DEFAULT_POST_AUTH_PATH = "/panel";

type Step = "credentials" | "verification";
type VerificationStrategy = "email_code" | "phone_code" | "totp" | "backup_code";
type VerificationReason = "client_trust" | "second_factor";

type EmailPasswordSignInFormProps = {
  postAuthPath?: string;
  clearStaleSession?: boolean;
};

function requiresSecondFactor(status: SignInFutureResource["status"]): boolean {
  return status === "needs_client_trust" || status === "needs_second_factor";
}

function verificationReason(
  status: SignInFutureResource["status"],
): VerificationReason | null {
  if (status === "needs_client_trust") return "client_trust";
  if (status === "needs_second_factor") return "second_factor";
  return null;
}

function resolveSecondFactorStrategy(
  signIn: SignInFutureResource,
): VerificationStrategy | null {
  const priority: VerificationStrategy[] = [
    "email_code",
    "phone_code",
    "totp",
    "backup_code",
  ];

  for (const strategy of priority) {
    if (signIn.supportedSecondFactors.some((factor) => factor.strategy === strategy)) {
      return strategy;
    }
  }

  return null;
}

function verificationHint(
  strategy: VerificationStrategy,
  email: string,
  reason: VerificationReason | null,
): string {
  if (reason === "client_trust") {
    switch (strategy) {
      case "email_code":
        return `Detectamos un nuevo dispositivo. Enviamos un código de verificación a ${email || "tu correo"}.`;
      case "phone_code":
        return "Detectamos un nuevo dispositivo. Enviamos un código de verificación a tu teléfono.";
      default:
        return "Detectamos un nuevo dispositivo. Completa la verificación para continuar.";
    }
  }

  switch (strategy) {
    case "email_code":
      return `Enviamos un código de verificación a ${email || "tu correo"}.`;
    case "phone_code":
      return "Enviamos un código de verificación a tu teléfono.";
    case "totp":
      return "Ingresa el código de 6 dígitos de tu app de autenticación.";
    case "backup_code":
      return "Ingresa uno de tus códigos de respaldo.";
    default:
      return "Completa la verificación para continuar.";
  }
}

function verificationTitle(
  strategy: VerificationStrategy,
  reason: VerificationReason | null,
): string {
  if (reason === "client_trust") {
    return "Confirma tu dispositivo";
  }

  switch (strategy) {
    case "totp":
      return "Verificación en dos pasos";
    case "backup_code":
      return "Código de respaldo";
    default:
      return "Verifica tu acceso";
  }
}

function verificationDescription(
  strategy: VerificationStrategy,
  reason: VerificationReason | null,
): string {
  if (reason === "client_trust") {
    return "Por seguridad, confirma que eres tú con el código enviado a tu correo.";
  }

  switch (strategy) {
    case "totp":
      return "Confirma tu identidad con tu app de autenticación.";
    case "backup_code":
      return "Usa uno de los códigos de respaldo de tu cuenta.";
    default:
      return "Por seguridad, confirma tu identidad con el código enviado a tu correo.";
  }
}

export function EmailPasswordSignInForm({
  postAuthPath = DEFAULT_POST_AUTH_PATH,
  clearStaleSession = false,
}: EmailPasswordSignInFormProps) {
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email")?.trim().toLowerCase() ?? "";

  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { signIn, errors, fetchStatus } = useSignIn();

  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>("credentials");
  const [verificationStrategy, setVerificationStrategy] =
    useState<VerificationStrategy | null>(null);
  const [verificationReasonState, setVerificationReasonState] =
    useState<VerificationReason | null>(null);
  const [email, setEmail] = useState(emailFromQuery);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const loginSucceededRef = useRef(false);
  const verificationSendStartedRef = useRef(false);
  const restoredVerificationRef = useRef(false);

  const clerkReady = authLoaded && Boolean(signIn);
  const isFetching = fetchStatus === "fetching" || pending;
  const normalizedEmail = email.trim().toLowerCase();
  const redirectPath = sanitizeAuthRedirectPath(postAuthPath, DEFAULT_POST_AUTH_PATH);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setResendCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!authLoaded) return;

    if (loginSucceededRef.current) {
      queueMicrotask(() => setReady(true));
      return;
    }

    if (!isSignedIn) {
      queueMicrotask(() => setReady(true));
      return;
    }

    if (!clearStaleSession) {
      queueMicrotask(() => setReady(true));
      return;
    }

    queueMicrotask(() => setReady(false));
    let cancelled = false;

    void signOut({ redirectUrl: SIGN_IN_REDIRECT }).finally(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [authLoaded, clearStaleSession, isSignedIn, signOut]);

  useEffect(() => {
    if (!signIn || !ready || restoredVerificationRef.current) return;
    if (!requiresSecondFactor(signIn.status)) return;

    const strategy = resolveSecondFactorStrategy(signIn);
    if (!strategy) return;

    restoredVerificationRef.current = true;
    queueMicrotask(() => {
      setStep("verification");
      setVerificationStrategy(strategy);
      setVerificationReasonState(verificationReason(signIn.status));
    });

    void ensureVerificationCodeSent(strategy).then((sent) => {
      setInfo(
        sent
          ? verificationHint(strategy, normalizedEmail, verificationReason(signIn.status))
          : `Ingresa el código enviado a ${normalizedEmail || "tu correo"}.`,
      );
    }).catch((err) => {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo enviar el código de verificación.",
      );
    });
  }, [ready, signIn, signIn?.status, normalizedEmail]);

  function startResendCooldown() {
    setResendCooldown(Math.ceil(VERIFICATION_RESEND_COOLDOWN_MS / 1000));
  }

  async function finalizeSignIn() {
    if (!signIn) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    const result = await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          return;
        }

        const url = decorateUrl(redirectPath);
        if (url.startsWith("http")) {
          window.location.href = url;
        } else {
          window.location.assign(url);
        }
      },
    });

    const message = getSignInFlowErrorMessage(
      result,
      errors,
      "No se pudo activar la sesión. Intenta de nuevo.",
    );

    if (result.error) {
      throw new Error(message);
    }
  }

  async function sendVerificationCode(strategy: VerificationStrategy) {
    if (!signIn) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    if (strategy === "email_code") {
      const result = await signIn.mfa.sendEmailCode();
      const message = getSignInFlowErrorMessage(
        result,
        errors,
        "No se pudo enviar el código de verificación.",
      );
      if (result.error) throw new Error(message);
      return;
    }

    if (strategy === "phone_code") {
      const result = await signIn.mfa.sendPhoneCode();
      const message = getSignInFlowErrorMessage(
        result,
        errors,
        "No se pudo enviar el código al teléfono.",
      );
      if (result.error) throw new Error(message);
    }
  }

  async function ensureVerificationCodeSent(
    strategy: VerificationStrategy,
    options?: { force?: boolean },
  ): Promise<boolean> {
    if (!signIn) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    if (
      !options?.force &&
      (isVerificationCodeActive(signIn.secondFactorVerification) ||
        verificationSendStartedRef.current)
    ) {
      return false;
    }

    if (strategy !== "email_code" && strategy !== "phone_code") {
      return false;
    }

    verificationSendStartedRef.current = true;

    try {
      await sendVerificationCode(strategy);
      if (options?.force) {
        startResendCooldown();
      }
      return true;
    } catch (error) {
      verificationSendStartedRef.current = false;
      throw error;
    }
  }

  async function enterVerificationStep() {
    if (!signIn) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    restoredVerificationRef.current = true;

    const strategy = resolveSecondFactorStrategy(signIn);
    const reason = verificationReason(signIn.status);

    if (!strategy) {
      throw new Error(
        "No se pudo iniciar la verificación de seguridad. Intenta de nuevo o contacta soporte.",
      );
    }

    setVerificationStrategy(strategy);
    setVerificationReasonState(reason);
    setStep("verification");

    const sent = await ensureVerificationCodeSent(strategy);
    if (sent) {
      startResendCooldown();
    }

    setInfo(verificationHint(strategy, normalizedEmail, reason));
  }

  async function completeSignInIfReady() {
    if (!signIn) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    if (signIn.status === "complete") {
      loginSucceededRef.current = true;
      await finalizeSignIn();
      return;
    }

    if (requiresSecondFactor(signIn.status)) {
      await enterVerificationStep();
      return;
    }

    if (signIn.status === "needs_new_password") {
      throw new Error("Debes restablecer tu contraseña antes de continuar.");
    }

    throw new Error("No se pudo completar el inicio de sesión. Intenta de nuevo.");
  }

  function handleCredentialsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clerkReady || !ready || !signIn) return;

    if (isSignedIn && clearStaleSession) {
      setError("Cierra la sesión anterior antes de iniciar sesión de nuevo.");
      return;
    }

    if (!normalizedEmail || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }

    setError(null);
    setInfo(null);
    verificationSendStartedRef.current = false;
    restoredVerificationRef.current = false;

    startTransition(async () => {
      try {
        if (signIn.status !== "needs_identifier") {
          await signIn.reset();
        }

        const result = await signIn.password({
          emailAddress: normalizedEmail,
          password,
        });

        const message = getSignInFlowErrorMessage(
          result,
          errors,
          "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.",
        );

        if (result.error) {
          setError(message);
          return;
        }

        await completeSignInIfReady();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.",
        );
      }
    });
  }

  async function verifySecondFactor(trimmedCode: string) {
    if (!signIn || !verificationStrategy) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    switch (verificationStrategy) {
      case "email_code":
        return signIn.mfa.verifyEmailCode({ code: trimmedCode });
      case "phone_code":
        return signIn.mfa.verifyPhoneCode({ code: trimmedCode });
      case "totp":
        return signIn.mfa.verifyTOTP({ code: trimmedCode });
      case "backup_code":
        return signIn.mfa.verifyBackupCode({ code: trimmedCode });
      default:
        throw new Error("Método de verificación no soportado.");
    }
  }

  function handleVerificationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clerkReady || !signIn || !verificationStrategy) return;

    const trimmedCode = code.trim();
    const minLength = verificationStrategy === "backup_code" ? 4 : 6;
    if (trimmedCode.length < minLength) {
      setError(
        verificationStrategy === "backup_code"
          ? "Ingresa tu código de respaldo."
          : "Ingresa el código de 6 dígitos.",
      );
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const result = await verifySecondFactor(trimmedCode);
        const message = getSignInFlowErrorMessage(
          result,
          errors,
          "Código inválido o expirado. Intenta de nuevo.",
        );

        if (result.error) {
          setError(message);
          return;
        }

        if (signIn.status !== "complete") {
          if (requiresSecondFactor(signIn.status)) {
            setError("Verificación incompleta. Revisa el código e intenta de nuevo.");
          } else {
            setError("No se pudo completar el inicio de sesión. Intenta de nuevo.");
          }
          return;
        }

        loginSucceededRef.current = true;
        await finalizeSignIn();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Código inválido o expirado. Intenta de nuevo.",
        );
      }
    });
  }

  function resendVerificationCode() {
    if (!signIn || !verificationStrategy || resendCooldown > 0) return;
    if (verificationStrategy !== "email_code" && verificationStrategy !== "phone_code") {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        verificationSendStartedRef.current = false;
        const sent = await ensureVerificationCodeSent(verificationStrategy, {
          force: true,
        });
        if (sent) {
          setInfo(
            `Reenviamos el código a ${
              verificationStrategy === "phone_code"
                ? "tu teléfono"
                : normalizedEmail || "tu correo"
            }.`,
          );
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo reenviar el código.",
        );
      }
    });
  }

  async function startOver() {
    if (!signIn) return;

    setError(null);
    setInfo(null);
    setCode("");
    setStep("credentials");
    setVerificationStrategy(null);
    setVerificationReasonState(null);
    verificationSendStartedRef.current = false;
    restoredVerificationRef.current = false;
    await signIn.reset();
  }

  if (!clerkReady || !ready) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
        Preparando acceso…
      </div>
    );
  }

  if (
    step === "verification" ||
    (signIn && requiresSecondFactor(signIn.status))
  ) {
    const strategy =
      verificationStrategy ??
      (signIn ? resolveSecondFactorStrategy(signIn) : null);
    const reason =
      verificationReasonState ??
      (signIn ? verificationReason(signIn.status) : null);
    const resendLabel =
      resendCooldown > 0
        ? `Reenviar código (${formatResendCooldown(resendCooldown)})`
        : "Reenviar código";

    return (
      <form className="space-y-5" onSubmit={handleVerificationSubmit}>
        <div className="space-y-1 text-center">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            {strategy ? verificationTitle(strategy, reason) : "Verifica tu acceso"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {strategy
              ? verificationDescription(strategy, reason)
              : "Por seguridad, confirma tu identidad con el código enviado a tu correo."}
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-center text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {info ? (
          <div className="rounded-xl border border-pragma-cyan/30 bg-pragma-soft-cyan/40 px-3 py-2.5 text-center text-sm text-foreground">
            {info}
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor="sign-in-verification-code">
            {strategy === "backup_code" ? "Código de respaldo" : "Código de verificación"}
          </Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="sign-in-verification-code"
              inputMode={strategy === "backup_code" ? "text" : "numeric"}
              autoComplete="one-time-code"
              value={code}
              onChange={(event) =>
                setCode(
                  strategy === "backup_code"
                    ? event.target.value.trim()
                    : event.target.value.replace(/\D/g, "").slice(0, 6),
                )
              }
              className="pl-9 tracking-[0.3em]"
              placeholder={strategy === "backup_code" ? "código" : "000000"}
              maxLength={strategy === "backup_code" ? 32 : 6}
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="brand"
          className="h-11 w-full"
          disabled={isFetching || !strategy}
        >
          {isFetching ? "Verificando…" : "Confirmar e ingresar"}
        </Button>

        <div className="flex flex-col gap-2">
          {strategy === "email_code" || strategy === "phone_code" ? (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={isFetching || resendCooldown > 0}
              onClick={resendVerificationCode}
            >
              {resendLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={isFetching}
            onClick={() => void startOver()}
          >
            Volver al inicio de sesión
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleCredentialsSubmit} autoComplete="off">
      <div className="space-y-1 text-center">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Iniciar sesión
        </h1>
        <p className="text-sm text-muted-foreground">
          Accede con el correo y la contraseña de tu cuenta.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-center text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="sign-in-email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="sign-in-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="pl-9"
              placeholder="tu@correo.com"
              required
            />
          </div>
        </div>

        <PasswordInput
          id="sign-in-password"
          label="Contraseña"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>

      <Button type="submit" variant="brand" className="h-11 w-full" disabled={isFetching}>
        {isFetching ? "Ingresando…" : "Iniciar sesión"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/sign-up" className="font-medium text-pragma-electric hover:underline">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}

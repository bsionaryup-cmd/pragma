"use client";

import { useAuth, useClerk, useSignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Shield, Mail, KeyRound } from "lucide-react";
import Link from "next/link";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getSignInFlowErrorMessage,
  isAlreadySignedInAuthError,
} from "@/lib/clerk-auth-errors";
import { sanitizeAuthRedirectPath } from "@/lib/auth/verification-flow";
import { settleClerkSessionThenGo } from "@/lib/auth/post-auth-navigation";
import {
  PLATFORM_OWNER_EMAIL,
  OWNER_DASHBOARD_PATH,
} from "@/lib/platform/constants.client";

type Step = "credentials" | "code";
type CodeMode = "first_factor" | "second_factor";

/**
 * Owner login must use Clerk SignInFuture (same stack as /sign-in).
 * The legacy `@clerk/nextjs/legacy` hook gated the CTA on `isLoaded`, which
 * can stay false forever on production Custom Domains → botón nunca habilita.
 */
export function OwnerLoginForm({
  serverSessionActive = false,
  postAuthPath,
}: {
  serverSessionActive?: boolean;
  postAuthPath?: string;
} = {}) {
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth();
  const { session } = useClerk();
  const { signIn, errors, fetchStatus } = useSignIn();
  const searchParams = useSearchParams();
  const nextPath = sanitizeAuthRedirectPath(
    postAuthPath ?? searchParams.get("next"),
    OWNER_DASHBOARD_PATH,
  );

  const [authBootstrapTimedOut, setAuthBootstrapTimedOut] = useState(false);
  const [step, setStep] = useState<Step>("credentials");
  const [codeMode, setCodeMode] = useState<CodeMode>("first_factor");
  const [email] = useState(PLATFORM_OWNER_EMAIL);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const authBootstrapComplete = authLoaded || authBootstrapTimedOut;
  const clerkReady = Boolean(signIn);
  const isFetching = fetchStatus === "fetching" || pending;
  const normalizedEmail = email.trim().toLowerCase();

  useEffect(() => {
    const timer = window.setTimeout(() => setAuthBootstrapTimedOut(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  function assertOwnerEmail(value: string): boolean {
    if (value === PLATFORM_OWNER_EMAIL) return true;
    setError("Este acceso está restringido al Super Admin Owner autorizado.");
    return false;
  }

  async function goAfterAuth(path: string = nextPath) {
    setError(null);
    setInfo("Entrando…");
    await settleClerkSessionThenGo({
      getToken,
      touchSession: () => session?.touch?.() ?? Promise.resolve(null),
      path,
      onPending: () => {
        setInfo(null);
        setError(
          "No se pudo sincronizar la sesión. Intenta Entrar de nuevo.",
        );
      },
    });
  }

  async function finalizeAndGo() {
    if (!signIn) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    const result = await signIn.finalize({
      navigate: async () => undefined,
    });

    const message = getSignInFlowErrorMessage(
      result,
      errors,
      "No se pudo activar la sesión. Intenta de nuevo.",
    );
    if (result.error) {
      throw new Error(message);
    }

    await goAfterAuth(nextPath);
  }

  async function completeIfReady() {
    if (!signIn) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    if (signIn.status === "complete") {
      await finalizeAndGo();
      return;
    }

    if (
      signIn.status === "needs_second_factor" ||
      signIn.status === "needs_client_trust"
    ) {
      const result = await signIn.mfa.sendEmailCode();
      const message = getSignInFlowErrorMessage(
        result,
        errors,
        "Se requiere verificación adicional. No se pudo enviar el código.",
      );
      if (result.error) throw new Error(message);

      setCodeMode("second_factor");
      setStep("code");
      setInfo(`Enviamos un código de verificación a ${normalizedEmail}`);
      return;
    }

    if (signIn.status === "needs_first_factor") {
      setCodeMode("first_factor");
      setStep("code");
      setInfo(`Ingresa el código enviado a ${normalizedEmail}`);
      return;
    }

    throw new Error(
      "No se pudo completar el inicio de sesión. Verifica tus datos e intenta de nuevo.",
    );
  }

  function signInWithPassword() {
    if (!clerkReady || !signIn) {
      setError(
        "La autenticación aún no está lista. Espera un momento o recarga la página.",
      );
      return;
    }
    if (!assertOwnerEmail(normalizedEmail)) return;
    if (!password) {
      setError("Ingresa tu contraseña.");
      return;
    }

    setError(null);
    setInfo(null);

    startTransition(async () => {
      try {
        if (isSignedIn) {
          await goAfterAuth(nextPath);
          return;
        }
        if (signIn.status !== "needs_identifier") {
          await signIn.reset();
        }

        let result = await signIn.password({
          emailAddress: normalizedEmail,
          password,
        });

        if (result.error && isAlreadySignedInAuthError(result)) {
          // Never signOut here: wiping cookies mid-login caused bounce to /owner-login.
          if (isSignedIn) {
            await goAfterAuth(nextPath);
            return;
          }
          await signIn.reset().catch(() => undefined);
          result = await signIn.password({
            emailAddress: normalizedEmail,
            password,
          });
        }

        const message = getSignInFlowErrorMessage(
          result,
          errors,
          "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.",
        );
        if (result.error) {
          setError(message);
          return;
        }

        await completeIfReady();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.",
        );
      }
    });
  }

  function sendCode() {
    if (!clerkReady || !signIn) {
      setError(
        "La autenticación aún no está lista. Espera un momento o recarga la página.",
      );
      return;
    }
    if (!assertOwnerEmail(normalizedEmail)) return;

    setError(null);
    setInfo(null);

    startTransition(async () => {
      try {
        if (signIn.status !== "needs_identifier") {
          await signIn.reset();
        }

        const result = await signIn.emailCode.sendCode({
          emailAddress: normalizedEmail,
        });
        const message = getSignInFlowErrorMessage(
          result,
          errors,
          "No se pudo enviar el código. En Clerk, habilita Email verification code.",
        );
        if (result.error) {
          setError(message);
          return;
        }

        setCodeMode("first_factor");
        setStep("code");
        setInfo(`Enviamos un código de verificación a ${normalizedEmail}`);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo enviar el código. Intenta de nuevo.",
        );
      }
    });
  }

  function verifyCode() {
    if (!clerkReady || !signIn) {
      setError(
        "La autenticación aún no está lista. Espera un momento o recarga la página.",
      );
      return;
    }

    const trimmed = code.trim();
    if (trimmed.length < 6) {
      setError("Ingresa el código de 6 dígitos enviado a tu correo.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const result =
          codeMode === "second_factor"
            ? await signIn.mfa.verifyEmailCode({ code: trimmed })
            : await signIn.emailCode.verifyCode({ code: trimmed });

        const message = getSignInFlowErrorMessage(
          result,
          errors,
          "Código inválido o expirado.",
        );
        if (result.error) {
          setError(message);
          return;
        }

        await completeIfReady();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Código inválido o expirado.",
        );
      }
    });
  }

  function resendCode() {
    if (!clerkReady || !signIn) return;
    if (!assertOwnerEmail(normalizedEmail)) return;

    setError(null);
    startTransition(async () => {
      try {
        const result =
          codeMode === "second_factor"
            ? await signIn.mfa.sendEmailCode()
            : await signIn.emailCode.sendCode({
                emailAddress: normalizedEmail,
              });

        const message = getSignInFlowErrorMessage(
          result,
          errors,
          "No se pudo reenviar el código.",
        );
        if (result.error) {
          setError(message);
          return;
        }
        setInfo(`Reenviamos un código a ${normalizedEmail}`);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo reenviar el código.",
        );
      }
    });
  }

  if (!authBootstrapComplete) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Cargando autenticación…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-pragma-soft-cyan text-pragma-electric">
          <Shield className="h-5 w-5" />
        </div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Owner Login
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acceso exclusivo Super Admin · correo y contraseña o código por email
        </p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {PLATFORM_OWNER_EMAIL}
        </p>
      </div>

      {!clerkReady ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          No se pudo conectar con Clerk. Recarga la página o revisa el dominio
          de producción en el Dashboard de Clerk.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {info ? (
        <div className="rounded-xl border border-pragma-cyan/30 bg-pragma-soft-cyan/40 px-3 py-2.5 text-sm text-foreground">
          {info}
        </div>
      ) : null}

      {serverSessionActive || isSignedIn ? (
        <div className="space-y-2 rounded-xl border border-pragma-cyan/30 bg-pragma-soft-cyan/40 px-3 py-3 text-center">
          <p className="text-sm text-foreground">Ya hay una sesión owner activa.</p>
          <Button
            type="button"
            variant="brand"
            className="w-full"
            disabled={isFetching}
            onClick={() => void goAfterAuth(nextPath)}
          >
            Continuar al panel owner
          </Button>
        </div>
      ) : null}

      {step === "credentials" ? (
        <div className="space-y-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Correo autorizado</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                autoComplete="email"
                value={email}
                readOnly
                className="pl-9"
                placeholder={PLATFORM_OWNER_EMAIL}
              />
            </div>
          </label>
          <PasswordInput
            id="owner-login-password"
            label="Contraseña"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
          <Button
            type="button"
            className="w-full"
            variant="brand"
            disabled={isFetching || !clerkReady}
            onClick={signInWithPassword}
          >
            {isFetching ? "Ingresando…" : "Iniciar sesión"}
          </Button>
          <Button
            type="button"
            className="w-full"
            variant="ghost"
            disabled={isFetching || !clerkReady}
            onClick={sendCode}
          >
            Enviar código de verificación
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Código de verificación</span>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="pl-9 tracking-[0.3em]"
                placeholder="000000"
                maxLength={6}
              />
            </div>
          </label>
          <Button
            type="button"
            className="w-full"
            variant="brand"
            disabled={isFetching || !clerkReady}
            onClick={verifyCode}
          >
            {isFetching ? "Verificando…" : "Verificar e ingresar"}
          </Button>
          <Button
            type="button"
            className="w-full"
            variant="ghost"
            disabled={isFetching}
            onClick={resendCode}
          >
            Reenviar código
          </Button>
          <Button
            type="button"
            className="w-full"
            variant="ghost"
            disabled={isFetching}
            onClick={() => {
              setStep("credentials");
              setCode("");
              setCodeMode("first_factor");
              setError(null);
              setInfo(null);
            }}
          >
            Volver
          </Button>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        ¿Eres cliente del PMS?{" "}
        <Link href="/sign-in" className="font-medium text-pragma-electric hover:underline">
          Inicia sesión aquí
        </Link>
      </p>
    </div>
  );
}

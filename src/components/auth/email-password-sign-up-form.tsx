"use client";

import { useSignUp } from "@clerk/nextjs";
import type { SignUpFutureResource } from "@clerk/shared/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { KeyRound, Mail } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getClerkAuthErrorMessage,
  getSignUpFlowErrorMessage,
} from "@/lib/clerk-auth-errors";
import {
  PASSWORD_MIN_LENGTH,
  validateNewAccountPassword,
} from "@/lib/auth/password-rules";
import {
  formatResendCooldown,
  isVerificationCodeActive,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from "@/lib/auth/verification-flow";

const POST_SIGNUP_PATH = "/onboarding";

type Step = "register" | "verify";

function needsEmailVerification(signUp: SignUpFutureResource): boolean {
  return (
    signUp.status !== "complete" &&
    signUp.unverifiedFields.includes("email_address")
  );
}

export function EmailPasswordSignUpForm() {
  const searchParams = useSearchParams();
  const offerToken = searchParams.get("offer_token")?.trim();
  const offerEmail = searchParams.get("email")?.trim();
  const postSignupPath = offerToken
    ? `/onboarding?offer_token=${encodeURIComponent(offerToken)}`
    : "/onboarding";

  const { signUp, errors, fetchStatus } = useSignUp();

  const [step, setStep] = useState<Step>("register");
  const [email, setEmail] = useState(offerEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const verificationSendStartedRef = useRef(false);

  const clerkReady = Boolean(signUp);
  const isFetching = fetchStatus === "fetching" || pending;
  const showPasswordRules = passwordFocused || password.length > 0;
  const normalizedEmail = email.trim().toLowerCase();

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setResendCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  function startResendCooldown() {
    setResendCooldown(Math.ceil(VERIFICATION_RESEND_COOLDOWN_MS / 1000));
  }

  async function finalizeSignUp() {
    if (!signUp) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    const result = await signUp.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          return;
        }

        const url = decorateUrl(postSignupPath);
        if (url.startsWith("http")) {
          window.location.href = url;
        } else {
          window.location.assign(url);
        }
      },
    });

    const message = getSignUpFlowErrorMessage(
      result,
      errors,
      "No se pudo activar la sesión. Intenta de nuevo.",
    );

    if (result.error) {
      throw new Error(message);
    }
  }

  async function sendSignupEmailCode(options?: { force?: boolean }) {
    if (!signUp) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    const emailVerification = signUp.verifications.emailAddress;
    if (
      !options?.force &&
      (isVerificationCodeActive(emailVerification) || verificationSendStartedRef.current)
    ) {
      return false;
    }

    verificationSendStartedRef.current = true;

    const sendResult = await signUp.verifications.sendEmailCode();
    const message = getSignUpFlowErrorMessage(
      sendResult,
      errors,
      "No se pudo enviar el código de verificación.",
    );

    if (sendResult.error) {
      verificationSendStartedRef.current = false;
      throw new Error(message);
    }

    return true;
  }

  async function enterVerifyStep(options?: { forceSend?: boolean }) {
    const sent = await sendSignupEmailCode({ force: options?.forceSend });
    setStep("verify");

    if (sent) {
      startResendCooldown();
      setInfo(`Enviamos un código de verificación a ${normalizedEmail}`);
      return;
    }

    setInfo(
      `Ingresa el código de verificación enviado a ${normalizedEmail}.`,
    );
  }

  async function completeSignUpIfReady() {
    if (!signUp) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    if (signUp.status === "complete") {
      await finalizeSignUp();
      return;
    }

    if (needsEmailVerification(signUp)) {
      await enterVerifyStep();
      return;
    }

    throw new Error("No se pudo completar el registro. Intenta de nuevo.");
  }

  function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clerkReady || !signUp) return;

    if (!normalizedEmail || !password) {
      setError("Completa correo y contraseña.");
      return;
    }

    const passwordError = validateNewAccountPassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setError(null);
    setInfo(null);
    verificationSendStartedRef.current = false;

    startTransition(async () => {
      try {
        await signUp.reset();

        const result = await signUp.password({
          emailAddress: normalizedEmail,
          password,
        });

        const message = getSignUpFlowErrorMessage(
          result,
          errors,
          "No se pudo crear la cuenta. Revisa los datos e intenta de nuevo.",
        );

        if (result.error) {
          setError(message);
          return;
        }

        await completeSignUpIfReady();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : getClerkAuthErrorMessage(
                err,
                "No se pudo crear la cuenta. Revisa los datos e intenta de nuevo.",
              ),
        );
      }
    });
  }

  function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clerkReady || !signUp) return;

    const trimmedCode = code.trim();
    if (trimmedCode.length < 6) {
      setError("Ingresa el código de 6 dígitos enviado a tu correo.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const result = await signUp.verifications.verifyEmailCode({
          code: trimmedCode,
        });

        const message = getSignUpFlowErrorMessage(
          result,
          errors,
          "Código inválido o expirado. Intenta de nuevo.",
        );

        if (result.error) {
          setError(message);
          return;
        }

        if (signUp.status !== "complete") {
          setError("Verificación incompleta. Revisa el código e intenta de nuevo.");
          return;
        }

        await finalizeSignUp();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : getClerkAuthErrorMessage(err, "Código inválido o expirado. Intenta de nuevo."),
        );
      }
    });
  }

  function resendCode() {
    if (!clerkReady || !signUp || resendCooldown > 0) return;

    setError(null);
    startTransition(async () => {
      try {
        verificationSendStartedRef.current = false;
        await enterVerifyStep({ forceSend: true });
        setInfo(`Reenviamos el código a ${normalizedEmail}`);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : getClerkAuthErrorMessage(err, "No se pudo reenviar el código."),
        );
      }
    });
  }

  if (!clerkReady) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
        Preparando registro…
      </div>
    );
  }

  if (step === "verify") {
    const resendLabel =
      resendCooldown > 0
        ? `Reenviar código (${formatResendCooldown(resendCooldown)})`
        : "Reenviar código";

    return (
      <form className="space-y-5" onSubmit={handleVerify}>
        <div className="space-y-1 text-center">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            Verifica tu correo
          </h1>
          <p className="text-sm text-muted-foreground">
            Ingresa el código que enviamos a tu correo para activar tu cuenta.
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
          <Label htmlFor="sign-up-code">Código de verificación</Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="sign-up-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="pl-9 tracking-[0.3em]"
              placeholder="000000"
              maxLength={6}
              required
            />
          </div>
        </div>

        <Button type="submit" variant="brand" className="h-11 w-full" disabled={isFetching}>
          {isFetching ? "Verificando…" : "Activar cuenta"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={isFetching || resendCooldown > 0}
          onClick={resendCode}
        >
          {resendLabel}
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleRegister}>
      <div className="space-y-1 text-center">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Crear cuenta
        </h1>
        <p className="text-sm text-muted-foreground">
          Regístrate con correo y contraseña para empezar tu prueba gratis.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-center text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="sign-up-email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="sign-up-email"
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

        <div className="space-y-2">
          <PasswordInput
            id="sign-up-password"
            label="Contraseña"
            value={password}
            onChange={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            autoComplete="new-password"
            placeholder="Crea tu contraseña"
            minLength={PASSWORD_MIN_LENGTH}
            required
          />
          <PasswordRequirements password={password} visible={showPasswordRules} />
        </div>

        <PasswordInput
          id="sign-up-confirm-password"
          label="Confirmar contraseña"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          placeholder="Repite tu contraseña"
          minLength={PASSWORD_MIN_LENGTH}
          required
        />
      </div>

      <Button type="submit" variant="brand" className="h-11 w-full" disabled={isFetching}>
        {isFetching ? "Creando cuenta…" : "Crear cuenta"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/sign-in" className="font-medium text-pragma-electric hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}

"use client";

import { useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { KeyRound, Mail } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSignInFlowErrorMessage } from "@/lib/clerk-auth-errors";
import {
  PASSWORD_MIN_LENGTH,
  validateNewAccountPassword,
} from "@/lib/auth/password-rules";
import {
  formatResendCooldown,
  sanitizeAuthRedirectPath,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from "@/lib/auth/verification-flow";

type Step = "email" | "reset";

const DEFAULT_POST_AUTH_PATH = "/panel";

export function EmailPasswordForgotPasswordForm() {
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email")?.trim().toLowerCase() ?? "";

  const { signIn, errors, fetchStatus } = useSignIn();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [codeVerified, setCodeVerified] = useState(false);
  const [pending, startTransition] = useTransition();

  const clerkReady = Boolean(signIn);
  const isFetching = fetchStatus === "fetching" || pending;
  const normalizedEmail = email.trim().toLowerCase();
  const showPasswordRules = passwordFocused || password.length > 0;
  const redirectPath = sanitizeAuthRedirectPath(
    searchParams.get("next"),
    DEFAULT_POST_AUTH_PATH,
  );

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

  async function sendResetCode() {
    if (!signIn) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    if (!normalizedEmail) {
      throw new Error("Ingresa el correo de tu cuenta.");
    }

    const createResult = await signIn.create({ identifier: normalizedEmail });
    const createMessage = getSignInFlowErrorMessage(
      createResult,
      errors,
      "No se pudo iniciar la recuperación de contraseña.",
    );
    if (createResult.error) {
      throw new Error(createMessage);
    }

    const sendResult = await signIn.resetPasswordEmailCode.sendCode();
    const sendMessage = getSignInFlowErrorMessage(
      sendResult,
      errors,
      "No se pudo enviar el código de verificación.",
    );
    if (sendResult.error) {
      throw new Error(sendMessage);
    }
  }

  async function verifyResetCode() {
    if (!signIn) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    const trimmedCode = code.replace(/\D/g, "").slice(0, 6);
    if (trimmedCode.length < 6) {
      throw new Error("Ingresa el código de 6 dígitos.");
    }

    const verifyResult = await signIn.resetPasswordEmailCode.verifyCode({
      code: trimmedCode,
    });
    const verifyMessage = getSignInFlowErrorMessage(
      verifyResult,
      errors,
      "Código incorrecto o expirado.",
    );
    if (verifyResult.error) {
      throw new Error(verifyMessage);
    }

    if (signIn.status !== "needs_new_password") {
      throw new Error("No se pudo validar el código. Intenta de nuevo.");
    }

    setCodeVerified(true);
  }

  async function submitNewPassword() {
    if (!signIn) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    const passwordError = validateNewAccountPassword(password);
    if (passwordError) {
      throw new Error(passwordError);
    }

    if (password !== confirmPassword) {
      throw new Error("Las contraseñas no coinciden.");
    }

    if (!codeVerified) {
      await verifyResetCode();
    }

    const submitResult = await signIn.resetPasswordEmailCode.submitPassword({
      password,
      signOutOfOtherSessions: true,
    });
    const submitMessage = getSignInFlowErrorMessage(
      submitResult,
      errors,
      "No se pudo actualizar la contraseña.",
    );
    if (submitResult.error) {
      throw new Error(submitMessage);
    }

    if (signIn.status !== "complete") {
      throw new Error("No se pudo completar el restablecimiento. Intenta de nuevo.");
    }

    const finalizeResult = await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) return;

        const url = decorateUrl(redirectPath);
        if (url.startsWith("http")) {
          window.location.href = url;
        } else {
          window.location.assign(url);
        }
      },
    });

    const finalizeMessage = getSignInFlowErrorMessage(
      finalizeResult,
      errors,
      "Contraseña actualizada, pero no se pudo iniciar sesión.",
    );
    if (finalizeResult.error) {
      throw new Error(finalizeMessage);
    }
  }

  function handleSendCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    startTransition(async () => {
      try {
        await sendResetCode();
        setStep("reset");
        setCode("");
        setPassword("");
        setConfirmPassword("");
        setCodeVerified(false);
        startResendCooldown();
        setInfo(`Enviamos un código de verificación a ${normalizedEmail}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al enviar el código.");
      }
    });
  }

  function handleResetPassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await submitNewPassword();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al restablecer la contraseña.");
      }
    });
  }

  function handleResendCode() {
    setError(null);
    setInfo(null);

    startTransition(async () => {
      try {
        await sendResetCode();
        startResendCooldown();
        setInfo(`Reenviamos el código a ${normalizedEmail}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo reenviar el código.");
      }
    });
  }

  function handleStartOver() {
    setError(null);
    setInfo(null);
    setCode("");
    setPassword("");
    setConfirmPassword("");
    setCodeVerified(false);
    setStep("email");
    void signIn?.reset();
  }

  if (!clerkReady) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
        Preparando recuperación…
      </div>
    );
  }

  if (step === "email") {
    return (
      <form className="space-y-4" onSubmit={handleSendCode}>
        <div className="space-y-1 text-center">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            Recuperar contraseña
          </h1>
          <p className="text-sm text-muted-foreground">
            Ingresa el correo de tu cuenta. Te enviaremos un código para crear una
            contraseña nueva.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-center text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor="forgot-password-email">Correo electrónico</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="forgot-password-email"
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

        <Button type="submit" variant="brand" className="h-11 w-full" disabled={isFetching}>
          {isFetching ? "Enviando…" : "Enviar código de verificación"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/sign-in" className="font-medium text-pragma-electric hover:underline">
            Volver al inicio de sesión
          </Link>
        </p>
      </form>
    );
  }

  const resendLabel =
    resendCooldown > 0
      ? `Reenviar código (${formatResendCooldown(resendCooldown)})`
      : "Reenviar código";

  return (
    <form className="space-y-4" onSubmit={handleResetPassword}>
      <div className="space-y-1 text-center">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
          Nueva contraseña
        </h1>
        <p className="text-sm text-muted-foreground">
          Escribe el código enviado a{" "}
          <span className="font-medium text-foreground">{normalizedEmail}</span> y elige tu
          nueva contraseña.
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
        <Label htmlFor="forgot-password-code">Código de verificación</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="forgot-password-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => {
              setCodeVerified(false);
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
            }}
            className="pl-9 tracking-[0.3em]"
            placeholder="000000"
            maxLength={6}
            required
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <PasswordInput
            id="forgot-password-new"
            label="Nueva contraseña"
            value={password}
            onChange={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            autoComplete="new-password"
            placeholder="Crea tu nueva contraseña"
            minLength={PASSWORD_MIN_LENGTH}
            required
          />
          <PasswordRequirements password={password} visible={showPasswordRules} />
        </div>

        <PasswordInput
          id="forgot-password-confirm"
          label="Confirmar contraseña"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          placeholder="Repite tu nueva contraseña"
          minLength={PASSWORD_MIN_LENGTH}
          required
        />
      </div>

      <Button type="submit" variant="brand" className="h-11 w-full" disabled={isFetching}>
        {isFetching ? "Guardando…" : "Restablecer contraseña"}
      </Button>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full"
          disabled={isFetching || resendCooldown > 0}
          onClick={handleResendCode}
        >
          {resendLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full text-muted-foreground"
          disabled={isFetching}
          onClick={handleStartOver}
        >
          Usar otro correo
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/sign-in" className="font-medium text-pragma-electric hover:underline">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </form>
  );
}

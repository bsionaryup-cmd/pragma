"use client";

import { useSignUp } from "@clerk/nextjs/legacy";
import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useState, useTransition } from "react";
import { KeyRound, Mail } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getClerkAuthErrorMessage } from "@/lib/clerk-auth-errors";
import {
  PASSWORD_MIN_LENGTH,
  validateNewAccountPassword,
} from "@/lib/auth/password-rules";

type Step = "register" | "verify";

export function EmailPasswordSignUpForm() {
  const { isLoaded, signUp } = useSignUp();
  const { setActive } = useClerk();

  const [step, setStep] = useState<Step>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showPasswordRules = passwordFocused || password.length > 0;

  async function completeSignUp(sessionId: string | null | undefined) {
    if (!sessionId) {
      setError("No se pudo crear la sesión. Intenta de nuevo.");
      return;
    }

    await setActive({ session: sessionId, redirectUrl: "/onboarding" });
  }

  function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded || !signUp) return;

    const normalizedEmail = email.trim().toLowerCase();
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

    startTransition(async () => {
      try {
        await signUp.create({
          emailAddress: normalizedEmail,
          password,
        });

        if (signUp.status === "complete") {
          await completeSignUp(signUp.createdSessionId);
          return;
        }

        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setStep("verify");
        setInfo(`Enviamos un código de verificación a ${normalizedEmail}`);
      } catch (err) {
        setError(
          getClerkAuthErrorMessage(
            err,
            "No se pudo crear la cuenta. Revisa los datos e intenta de nuevo.",
          ),
        );
      }
    });
  }

  function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded || !signUp) return;

    const trimmedCode = code.trim();
    if (trimmedCode.length < 6) {
      setError("Ingresa el código de 6 dígitos enviado a tu correo.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const result = await signUp.attemptEmailAddressVerification({
          code: trimmedCode,
        });

        if (result.status !== "complete") {
          setError("Verificación incompleta. Revisa el código e intenta de nuevo.");
          return;
        }

        await completeSignUp(result.createdSessionId);
      } catch (err) {
        setError(
          getClerkAuthErrorMessage(err, "Código inválido o expirado. Intenta de nuevo."),
        );
      }
    });
  }

  function resendCode() {
    if (!isLoaded || !signUp) return;

    setError(null);
    startTransition(async () => {
      try {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setInfo(`Reenviamos el código a ${email.trim().toLowerCase()}`);
      } catch (err) {
        setError(getClerkAuthErrorMessage(err, "No se pudo reenviar el código."));
      }
    });
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
        Preparando registro…
      </div>
    );
  }

  if (step === "verify") {
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

        <Button type="submit" variant="brand" className="h-11 w-full" disabled={pending}>
          {pending ? "Verificando…" : "Activar cuenta"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={pending}
          onClick={resendCode}
        >
          Reenviar código
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

      <Button type="submit" variant="brand" className="h-11 w-full" disabled={pending}>
        {pending ? "Creando cuenta…" : "Crear cuenta"}
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

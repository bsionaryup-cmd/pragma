"use client";

import { useSignIn } from "@clerk/nextjs/legacy";
import { useAuth, useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getClerkAuthErrorMessage } from "@/lib/clerk-auth-errors";

export function EmailPasswordSignInForm() {
  const { isLoaded: authLoaded } = useAuth();
  const { signOut, setActive, session } = useClerk();
  const { isLoaded, signIn } = useSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function ensureSignedOut() {
    if (session) {
      await signOut();
    }
  }

  async function signInWithPassword(normalizedEmail: string, plainPassword: string) {
    if (!signIn) {
      throw new Error("El servicio de autenticación no está listo.");
    }

    try {
      return await signIn.create({
        strategy: "password",
        identifier: normalizedEmail,
        password: plainPassword,
      });
    } catch (passwordStrategyError) {
      let result = await signIn.create({ identifier: normalizedEmail });

      if (result.status === "needs_first_factor") {
        const passwordFactor = signIn.supportedFirstFactors?.find(
          (factor) => factor.strategy === "password",
        );

        if (!passwordFactor || passwordFactor.strategy !== "password") {
          throw passwordStrategyError;
        }

        result = await signIn.attemptFirstFactor({
          strategy: "password",
          password: plainPassword,
        });
      }

      return result;
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded || !signIn || !authLoaded) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        await ensureSignedOut();

        const result = await signInWithPassword(normalizedEmail, password);

        if (result.status !== "complete" || !result.createdSessionId) {
          setError("No se pudo completar el inicio de sesión. Intenta de nuevo.");
          return;
        }

        await setActive({
          session: result.createdSessionId,
          redirectUrl: "/panel",
        });
      } catch (err) {
        setError(
          getClerkAuthErrorMessage(
            err,
            "Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.",
          ),
        );
      }
    });
  }

  if (!authLoaded || !isLoaded) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
        Preparando acceso…
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} autoComplete="off">
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

      <Button type="submit" variant="brand" className="h-11 w-full" disabled={pending}>
        {pending ? "Ingresando…" : "Iniciar sesión"}
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

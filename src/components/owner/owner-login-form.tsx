"use client";

import { useSignIn } from "@clerk/nextjs/legacy";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Shield, Mail, KeyRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PLATFORM_OWNER_EMAIL,
  OWNER_DASHBOARD_PATH,
} from "@/lib/platform/constants.client";

type Step = "email" | "code";

export function OwnerLoginForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? OWNER_DASHBOARD_PATH;

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(PLATFORM_OWNER_EMAIL);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function validateOwnerEmail(value: string): boolean {
    return value.trim().toLowerCase() === PLATFORM_OWNER_EMAIL;
  }

  async function prepareEmailCode(normalized: string): Promise<boolean> {
    if (!signIn) return false;

    await signIn.create({ identifier: normalized });

    const emailFactor = signIn.supportedFirstFactors?.find(
      (factor) => factor.strategy === "email_code",
    );

    if (!emailFactor || emailFactor.strategy !== "email_code") {
      setError(
        "No se pudo iniciar verificación por correo. En Clerk, habilita Email verification code para este usuario.",
      );
      return false;
    }

    await signIn.prepareFirstFactor({
      strategy: "email_code",
      emailAddressId: emailFactor.emailAddressId,
    });

    setStep("code");
    setInfo(`Enviamos un código de verificación a ${normalized}`);
    return true;
  }

  function sendCode() {
    if (!isLoaded || !signIn) return;

    const normalized = email.trim().toLowerCase();
    if (!validateOwnerEmail(normalized)) {
      setError("Este acceso está restringido al Super Admin Owner autorizado.");
      return;
    }

    setError(null);
    setInfo(null);

    startTransition(async () => {
      try {
        await prepareEmailCode(normalized);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "No se pudo enviar el código. Intenta de nuevo.";
        setError(message);
      }
    });
  }

  function verifyCode() {
    if (!isLoaded || !signIn) return;

    const trimmed = code.trim();
    if (trimmed.length < 6) {
      setError("Ingresa el código de 6 dígitos enviado a tu correo.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const result = await signIn.attemptFirstFactor({
          strategy: "email_code",
          code: trimmed,
        });

        if (result.status !== "complete" || !result.createdSessionId) {
          setError("Verificación incompleta. Revisa el código e intenta de nuevo.");
          return;
        }

        await setActive({ session: result.createdSessionId });
        router.push(nextPath.startsWith("/") ? nextPath : OWNER_DASHBOARD_PATH);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Código inválido o expirado.";
        setError(message);
      }
    });
  }

  function resendCode() {
    if (!isLoaded || !signIn) return;
    const normalized = email.trim().toLowerCase();
    if (!validateOwnerEmail(normalized)) return;

    setError(null);
    startTransition(async () => {
      try {
        await prepareEmailCode(normalized);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "No se pudo reenviar el código.";
        setError(message);
      }
    });
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
          Acceso exclusivo Super Admin · verificación por código en correo
        </p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          {PLATFORM_OWNER_EMAIL}
        </p>
      </div>

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

      {step === "email" ? (
        <div className="space-y-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Correo autorizado</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                placeholder={PLATFORM_OWNER_EMAIL}
                readOnly
              />
            </div>
          </label>
          <Button
            type="button"
            className="w-full"
            variant="brand"
            disabled={pending || !isLoaded}
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
            disabled={pending || !isLoaded}
            onClick={verifyCode}
          >
            Verificar e ingresar
          </Button>
          <Button
            type="button"
            className="w-full"
            variant="ghost"
            disabled={pending}
            onClick={resendCode}
          >
            Reenviar código
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

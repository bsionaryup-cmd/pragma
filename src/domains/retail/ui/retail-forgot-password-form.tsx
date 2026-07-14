"use client";

import { useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordRequirements } from "@/components/auth/password-requirements";
import { TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import { validateNewAccountPassword } from "@/lib/auth/password-rules";
import {
  formatResendCooldown,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from "@/lib/auth/verification-flow";

type Step = "email" | "reset";

/**
 * Recuperación de contraseña INTIENDAS vía Clerk (código por correo).
 * No revela si el correo existe: mensaje genérico siempre.
 */
export function RetailForgotPasswordForm() {
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email")?.trim().toLowerCase() ?? "";
  const { signIn, fetchStatus } = useSignIn();

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

  const isFetching = fetchStatus === "fetching" || pending;
  const normalizedEmail = email.trim().toLowerCase();
  const showPasswordRules = passwordFocused || password.length > 0;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  function startResendCooldown() {
    setResendCooldown(Math.ceil(VERIFICATION_RESEND_COOLDOWN_MS / 1000));
  }

  function handleSendCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      try {
        if (!signIn) throw new Error("El servicio de autenticación no está listo.");
        if (!normalizedEmail) throw new Error("Ingresa el correo de tu cuenta.");

        // Intentamos el flujo Clerk; el mensaje al usuario siempre es genérico.
        try {
          await signIn.create({ identifier: normalizedEmail });
          await signIn.resetPasswordEmailCode.sendCode();
        } catch {
          // Swallow — no filtramos existencia de cuenta.
        }
        setStep("reset");
        setCodeVerified(false);
        startResendCooldown();
        setInfo(
          "Si el correo está registrado en INTIENDAS, recibirás un código. Revisa también spam.",
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo iniciar la recuperación.");
      }
    });
  }

  function handleSubmitPassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (!signIn) throw new Error("El servicio de autenticación no está listo.");

        const trimmedCode = code.replace(/\D/g, "").slice(0, 6);
        if (trimmedCode.length < 6) throw new Error("Ingresa el código de 6 dígitos.");

        if (!codeVerified) {
          const verifyResult = await signIn.resetPasswordEmailCode.verifyCode({
            code: trimmedCode,
          });
          if (verifyResult.error) {
            throw new Error("Código incorrecto o expirado. Solicita uno nuevo.");
          }
          if (signIn.status !== "needs_new_password") {
            throw new Error("No se pudo validar el código. Intenta de nuevo.");
          }
          setCodeVerified(true);
        }

        const passwordError = validateNewAccountPassword(password);
        if (passwordError) throw new Error(passwordError);
        if (password !== confirmPassword) throw new Error("Las contraseñas no coinciden.");

        const submitResult = await signIn.resetPasswordEmailCode.submitPassword({
          password,
          signOutOfOtherSessions: true,
        });
        if (submitResult.error) {
          throw new Error(submitResult.error.message || "No se pudo actualizar la contraseña.");
        }

        if (signIn.status !== "complete") {
          throw new Error("Contraseña actualizada. Inicia sesión con la nueva clave.");
        }

        await signIn.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            const url = decorateUrl("/intiendas/dashboard");
            if (url.startsWith("http")) window.location.href = url;
            else window.location.assign(url);
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo restablecer la contraseña.");
      }
    });
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
          {info}
        </div>
      ) : null}

      {step === "email" ? (
        <form className="space-y-4" onSubmit={handleSendCode}>
          <div>
            <label htmlFor="retail-forgot-email" className="text-sm font-medium text-[#4a5568]">
              Correo electrónico
            </label>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
              <input
                id="retail-forgot-email"
                type="email"
                autoComplete="username"
                className="h-10 w-full rounded-md border border-[#c5ced8] bg-white pl-9 pr-3 text-sm outline-none focus:border-pragma-electric"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <TiendasOnPrimaryButton type="submit" className="h-11 w-full" disabled={isFetching}>
            {isFetching ? "Enviando…" : "Enviar código"}
          </TiendasOnPrimaryButton>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmitPassword}>
          <div>
            <label htmlFor="retail-forgot-code" className="text-sm font-medium text-[#4a5568]">
              Código de 6 dígitos
            </label>
            <input
              id="retail-forgot-code"
              inputMode="numeric"
              className="mt-1 h-10 w-full rounded-md border border-[#c5ced8] px-3 text-sm tracking-widest"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </div>
          <PasswordInput
            id="retail-forgot-new"
            label="Nueva contraseña"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            onFocus={() => setPasswordFocused(true)}
            required
          />
          {showPasswordRules ? (
            <PasswordRequirements password={password} visible={showPasswordRules} />
          ) : null}
          <PasswordInput
            id="retail-forgot-confirm"
            label="Confirmar contraseña"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            required
          />
          <TiendasOnPrimaryButton type="submit" className="h-11 w-full" disabled={isFetching}>
            {isFetching ? "Guardando…" : "Guardar nueva contraseña"}
          </TiendasOnPrimaryButton>
          <button
            type="button"
            disabled={resendCooldown > 0 || isFetching}
            className="w-full text-sm text-pragma-electric disabled:text-[#a0aec0]"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  if (!signIn) return;
                  try {
                    await signIn.resetPasswordEmailCode.sendCode();
                  } catch {
                    /* generic */
                  }
                  startResendCooldown();
                  setInfo("Si el correo está registrado, enviamos un nuevo código.");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "No se pudo reenviar.");
                }
              });
            }}
          >
            {resendCooldown > 0
              ? `Reenviar en ${formatResendCooldown(resendCooldown)}`
              : "Reenviar código"}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-[#718096]">
        <Link href="/intiendas/login" className="text-pragma-electric hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </div>
  );
}

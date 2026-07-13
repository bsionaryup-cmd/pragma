"use client";

import { useAuth, useClerk, useSignIn } from "@clerk/nextjs";
import { useEffect, useRef, useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { createRetailSignInTicketAction } from "@/domains/retail/actions/auth.actions";
import { PasswordInput } from "@/components/auth/password-input";
import { TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import { sanitizeAuthRedirectPath } from "@/lib/auth/verification-flow";

type RetailPasswordSignInFormProps = {
  postAuthPath: string;
};

/**
 * Login INTIENDAS: correo + contraseña sin código de verificación de dispositivo.
 * Usa ticket de Backend API (solo cuentas con tienda retail activa).
 */
export function RetailPasswordSignInForm({ postAuthPath }: RetailPasswordSignInFormProps) {
  const redirectPath = sanitizeAuthRedirectPath(postAuthPath, "/intiendas/dashboard");
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { signIn } = useSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [bootstrapTimedOut, setBootstrapTimedOut] = useState(false);
  const staleCleanupRef = useRef(false);

  const ready = authLoaded || bootstrapTimedOut;
  const isFetching = pending;

  useEffect(() => {
    const timer = window.setTimeout(() => setBootstrapTimedOut(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!authLoaded || staleCleanupRef.current) return;
    staleCleanupRef.current = true;
    if (isSignedIn) {
      void signOut().catch(() => {
        // El formulario debe seguir usable.
      });
    }
  }, [authLoaded, isSignedIn, signOut]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !signIn) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const issued = await createRetailSignInTicketAction({
          email: normalizedEmail,
          password,
        });
        if (!issued.success) {
          setError(issued.error);
          return;
        }

        if (signIn.status !== "needs_identifier") {
          await signIn.reset().catch(() => undefined);
        }

        const created = await signIn.create({
          strategy: "ticket",
          ticket: issued.ticket,
        });
        if (created.error) {
          setError(created.error.message || "No se pudo activar la sesión.");
          return;
        }

        if (signIn.status !== "complete") {
          setError("No se pudo completar el inicio de sesión. Intenta de nuevo.");
          return;
        }

        const finalized = await signIn.finalize({
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

        if (finalized.error) {
          setError(finalized.error.message || "No se pudo activar la sesión.");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo iniciar sesión. Intenta de nuevo.",
        );
      }
    });
  }

  if (!ready) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-slate-600">
        Preparando acceso…
      </div>
    );
  }

  if (!signIn) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-red-700">
          No se pudo cargar el inicio de sesión. Verifica tu conexión e intenta de nuevo.
        </p>
        <button
          type="button"
          className="h-10 w-full rounded-md border border-[#c5ced8] text-sm text-[#4a5568]"
          onClick={() => window.location.reload()}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-center text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <label htmlFor="retail-sign-in-email" className="text-sm font-medium text-[#4a5568]">
            Correo electrónico
          </label>
          <div className="relative mt-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
            <input
              id="retail-sign-in-email"
              type="email"
              autoComplete="username"
              className="h-10 w-full rounded-md border border-[#c5ced8] bg-white pl-9 pr-3 text-sm outline-none focus:border-pragma-electric focus:ring-1 focus:ring-pragma-electric/30"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tienda@correo.com"
              required
            />
          </div>
        </div>

        <PasswordInput
          id="retail-sign-in-password"
          label="Contraseña"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>

      <TiendasOnPrimaryButton type="submit" className="h-11 w-full" disabled={isFetching}>
        {isFetching ? "Ingresando…" : "Iniciar sesión"}
      </TiendasOnPrimaryButton>

      <p className="text-center text-sm text-[#718096]">
        El acceso lo crea el administrador desde el panel Owner.
      </p>
    </form>
  );
}

"use client";

import { useClerk } from "@clerk/nextjs";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };

type State = { hasError: boolean };

function isClerkNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("clerkjs") ||
    msg.includes("failed to fetch") ||
    msg.includes("network error")
  );
}

export class ClerkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State | null {
    return isClerkNetworkError(error) ? { hasError: true } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isClerkNetworkError(error)) {
      console.warn("[clerk] Error de red en el cliente:", error.message, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return <ClerkRecoveryPanel onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

function ClerkRecoveryPanel({ onRetry }: { onRetry: () => void }) {
  const { signOut } = useClerk();

  return (
    <div
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <PragmaLogo variant="mark" symbolClassName="h-10 w-10 opacity-90" />
      <h2 className="text-lg font-semibold text-foreground">
        No se pudo conectar con la autenticación
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Suele deberse a bloqueadores de anuncios, sesión caducada o red inestable.
        Prueba recargar o volver a iniciar sesión.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={() => window.location.reload()}>
          Recargar
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onRetry();
            void signOut({ redirectUrl: "/sign-in?session_reset=1" });
          }}
        >
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useClerk } from "@clerk/nextjs";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { performFullSignOut } from "@/lib/auth/full-sign-out";

type OwnerWrongSessionProps = {
  email: string;
};

/**
 * Legacy residual UI. Unified /login accepts Owner + tenants; this only asks
 * to sign out and return to the same login form (no "owner-only" gate).
 */
export function OwnerWrongSession({ email }: OwnerWrongSessionProps) {
  const { signOut } = useClerk();

  return (
    <div className="space-y-4 text-center">
      <div className="flex justify-center">
        <BackLink href="/login" label="Volver al inicio de sesión" />
      </div>
      <p className="text-sm text-muted-foreground">
        Sesión activa como <span className="font-medium">{email}</span>. Cierra
        sesión si quieres entrar con otra cuenta. Owner y usuarios del PMS usan
        la misma página de acceso.
      </p>
      <Button
        type="button"
        variant="brand"
        className="w-full"
        onClick={() => void performFullSignOut(signOut)}
      >
        Cerrar sesión
      </Button>
    </div>
  );
}

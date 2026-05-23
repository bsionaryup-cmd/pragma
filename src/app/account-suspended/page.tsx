import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { ClerkSignOutButton } from "@/components/auth/clerk-sign-out-button";
import { requireDbUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Cuenta suspendida | PRAGMA",
};

export default async function AccountSuspendedPage() {
  await requireDbUser();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-pragma-soft-gray p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-pragma-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="font-heading text-xl font-semibold text-foreground">
          Cuenta suspendida
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu organización ha sido suspendida temporalmente. Contacta a soporte
          para más información.
        </p>
        <ClerkSignOutButton className="mt-6">
          Cerrar sesión e ir al inicio
        </ClerkSignOutButton>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { PragmaAuthLayout } from "@/components/auth/pragma-auth-layout";
import { OwnerLoginForm } from "@/components/owner/owner-login-form";
import { OwnerWrongSession } from "@/components/owner/owner-wrong-session";
import { currentDbUser } from "@/lib/auth";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import { sanitizeAuthRedirectPath } from "@/lib/auth/verification-flow";

export const metadata: Metadata = {
  title: "Owner Login | PRAGMA",
  robots: { index: false, follow: false },
};

type OwnerLoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function OwnerLoginPage({ searchParams }: OwnerLoginPageProps) {
  const params = await searchParams;
  const { userId } = await auth();
  const nextPath = sanitizeAuthRedirectPath(
    params.next,
    OWNER_DASHBOARD_PATH,
  );

  if (userId) {
    const user = await currentDbUser();
    if (user && isSuperAdminOwner(user)) {
      // Form + Continuar — no hard redirect to dashboard (cookie race).
      return (
        <PragmaAuthLayout backHref="/sign-in" backLabel="Acceso clientes">
          <Suspense
            fallback={
              <div className="py-8 text-center text-sm text-muted-foreground">
                Cargando…
              </div>
            }
          >
            <OwnerLoginForm
              serverSessionActive
              postAuthPath={nextPath}
            />
          </Suspense>
        </PragmaAuthLayout>
      );
    }

    if (user) {
      return (
        <PragmaAuthLayout
          backHref="/sign-in"
          backLabel="Acceso clientes"
          hint={
            params.error === "forbidden" ? (
              <p className="mb-4 text-center text-sm text-destructive">
                No tienes permisos de Super Admin Owner.
              </p>
            ) : null
          }
        >
          <OwnerWrongSession email={user.email} />
        </PragmaAuthLayout>
      );
    }
  }

  return (
    <PragmaAuthLayout backHref="/sign-in" backLabel="Acceso clientes">
      <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Cargando…</div>}>
        <OwnerLoginForm postAuthPath={nextPath} />
      </Suspense>
    </PragmaAuthLayout>
  );
}

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ClerkSignOutButton } from "@/components/auth/clerk-sign-out-button";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { findStoreForOrg } from "@/domains/retail/services/store.service";
import { RetailPasswordSignInForm } from "@/domains/retail/ui/retail-password-sign-in-form";
import { INTIENDAS_VERSION } from "@/domains/retail/ui/tiendas-on/modules";
import { sanitizeAuthRedirectPath } from "@/lib/auth/verification-flow";
import { getUserByClerkId } from "@/services/users/user.service";

type RetailLoginPageProps = {
  searchParams: Promise<{
    no_org?: string;
    store_inactive?: string;
    next?: string;
  }>;
};

const POS_HOME = "/intiendas/dashboard";

export default async function RetailLoginPage({ searchParams }: RetailLoginPageProps) {
  const params = await searchParams;
  const requestedPath = sanitizeAuthRedirectPath(params.next, POS_HOME);
  const postAuthPath =
    requestedPath.startsWith("/intiendas") && !requestedPath.startsWith("/intiendas/login")
      ? requestedPath
      : POS_HOME;
  const { userId } = await auth();
  const dbUser = userId ? await getUserByClerkId(userId) : null;
  const isInactiveUser = Boolean(dbUser && (!dbUser.isActive || dbUser.deletedAt));

  let hasNoBusiness = Boolean(userId && (!dbUser || !dbUser.organizationId));
  let hasInactiveStore = false;

  if (dbUser?.isActive && !dbUser.deletedAt && dbUser.organizationId) {
    const store = await findStoreForOrg(dbUser.organizationId);
    if (!store) {
      hasNoBusiness = true;
    } else if (store.status === "INACTIVE" || store.deletedAt) {
      hasInactiveStore = true;
    } else {
      redirect(postAuthPath);
    }
  }

  const blockedMessage = isInactiveUser
    ? "Tu cuenta está inactiva. Contacta a PRAGMA para reactivarla."
    : hasNoBusiness
      ? "Esta cuenta no tiene acceso a INTIENDAS. Pide al administrador que te cree desde el panel Owner."
      : hasInactiveStore
        ? "Tu acceso está suspendido. Contacta a PRAGMA para reactivarlo."
        : params.store_inactive === "1"
          ? "Tu acceso está suspendido. Cierra sesión e intenta con otra cuenta."
          : params.no_org === "1"
            ? "Esta cuenta no tiene acceso a INTIENDAS."
            : null;
  const authenticatedBlocked = Boolean(
    userId && (isInactiveUser || hasNoBusiness || hasInactiveStore),
  );

  return (
    <main className="flex min-h-dvh flex-col bg-[#eef1f4] text-[#2d3748]">
      <header className="flex h-14 items-center justify-center border-b border-[#d9dee5] bg-white px-4">
        <div className="flex items-center gap-3">
          <PragmaLogo variant="mark" symbolClassName="h-9 w-8" priority />
          <div>
            <PragmaLogo variant="full" tone="light" fullClassName="h-5 w-auto" />
            <p className="text-[10px] font-bold tracking-[0.24em] text-pragma-electric">INTIENDAS</p>
          </div>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-md border border-[#d5dce6] bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-[#2d3748]">Iniciar sesión</h1>
            <p className="mt-1 text-sm text-[#718096]">
              Ingresa con el usuario y la contraseña asignados por tu administrador.
            </p>
          </div>

          {blockedMessage ? (
            <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">{blockedMessage}</p>
            </div>
          ) : null}

          {authenticatedBlocked ? (
            <div className="flex justify-center">
              <ClerkSignOutButton redirectUrl="/intiendas/login">Cerrar sesión</ClerkSignOutButton>
            </div>
          ) : (
            <Suspense fallback={<p className="text-center text-sm text-[#718096]">Cargando formulario…</p>}>
              <RetailPasswordSignInForm postAuthPath={postAuthPath} />
            </Suspense>
          )}
        </div>
      </section>

      <footer className="border-t border-[#d9dee5] bg-white px-4 py-2 text-center text-xs text-[#94a3b8]">
        PRAGMA INTIENDAS v{INTIENDAS_VERSION}
      </footer>
    </main>
  );
}

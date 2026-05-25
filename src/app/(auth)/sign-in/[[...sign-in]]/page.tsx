import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ClerkSignOutButton } from "@/components/auth/clerk-sign-out-button";
import { EmailPasswordSignInForm } from "@/components/auth/email-password-sign-in-form";
import { PragmaAuthLayout } from "@/components/auth/pragma-auth-layout";
import { resolvePostAuthHomePath } from "@/lib/auth/role-definitions.server";
import { sanitizeAuthRedirectPath } from "@/lib/auth/verification-flow";
import { getUserByClerkId } from "@/services/users/user.service";

type SignInPageProps = {
  searchParams: Promise<{
    inactive?: string;
    signed_out?: string;
    clerk_unavailable?: string;
    next?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const showInactiveHint = params.inactive === "1";
  const showSignedOutHint = params.signed_out === "1";
  const showClerkUnavailableHint = params.clerk_unavailable === "1";
  const postAuthPath = sanitizeAuthRedirectPath(params.next, "/panel");
  const { userId } = await auth();

  // After logout, allow the sign-in form even if a stale server session cookie lingers.
  if (userId && !showInactiveHint && !showSignedOutHint) {
    const dbUser = await getUserByClerkId(userId);

    if (dbUser && !dbUser.isActive) {
      redirect("/sign-in?inactive=1");
    }

    if (dbUser?.isActive) {
      redirect(resolvePostAuthHomePath(dbUser));
    }

    redirect(postAuthPath);
  }

  return (
    <PragmaAuthLayout
      backHref="/"
      backLabel="Inicio"
      hint={
        showInactiveHint ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              Tu cuenta fue desactivada. Contacta al administrador de PRAGMA.
            </p>
            <div className="flex justify-center">
              <ClerkSignOutButton>Cerrar sesión</ClerkSignOutButton>
            </div>
          </div>
        ) : showSignedOutHint ? (
          <p className="text-sm text-muted-foreground">
            Sesión cerrada correctamente. Puedes iniciar sesión de nuevo.
          </p>
        ) : showClerkUnavailableHint ? (
          <p className="text-sm text-destructive">
            No se pudo conectar con el servicio de autenticación. Intenta de nuevo en unos
            momentos.
          </p>
        ) : null
      }
    >
      <EmailPasswordSignInForm
        postAuthPath={postAuthPath}
        clearStaleSession={showSignedOutHint}
      />
    </PragmaAuthLayout>
  );
}

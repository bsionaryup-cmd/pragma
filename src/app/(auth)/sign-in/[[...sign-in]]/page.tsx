import { EmailPasswordSignInForm } from "@/components/auth/email-password-sign-in-form";
import { PragmaAuthLayout } from "@/components/auth/pragma-auth-layout";

type SignInPageProps = {
  searchParams: Promise<{
    session_reset?: string;
    clerk_unavailable?: string;
    inactive?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const showRecoveryHint =
    params.session_reset === "1" || params.clerk_unavailable === "1";
  const showInactiveHint = params.inactive === "1";

  return (
    <PragmaAuthLayout
      hint={
        showInactiveHint ? (
          <p className="text-sm text-destructive">
            Tu cuenta fue desactivada. Contacta al administrador de PRAGMA.
          </p>
        ) : showRecoveryHint ? (
          <p className="text-sm text-muted-foreground">
            La sesión anterior no pudo renovarse. Inicia sesión de nuevo.
          </p>
        ) : null
      }
    >
      <EmailPasswordSignInForm />
    </PragmaAuthLayout>
  );
}

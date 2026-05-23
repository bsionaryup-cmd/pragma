import { EmailPasswordSignInForm } from "@/components/auth/email-password-sign-in-form";
import { PragmaAuthLayout } from "@/components/auth/pragma-auth-layout";

type SignInPageProps = {
  searchParams: Promise<{
    inactive?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const showInactiveHint = params.inactive === "1";

  return (
    <PragmaAuthLayout
      hint={
        showInactiveHint ? (
          <p className="text-sm text-destructive">
            Tu cuenta fue desactivada. Contacta al administrador de PRAGMA.
          </p>
        ) : null
      }
    >
      <EmailPasswordSignInForm />
    </PragmaAuthLayout>
  );
}

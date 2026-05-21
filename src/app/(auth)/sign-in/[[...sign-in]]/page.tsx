import { SignIn } from "@clerk/nextjs";
import { PragmaAuthLayout } from "@/components/auth/pragma-auth-layout";
import { pragmaClerkAppearance } from "@/lib/clerk-appearance";

type SignInPageProps = {
  searchParams: Promise<{ session_reset?: string; clerk_unavailable?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const showRecoveryHint =
    params.session_reset === "1" || params.clerk_unavailable === "1";

  return (
    <PragmaAuthLayout
      hint={
        showRecoveryHint ? (
          <p className="mb-4 max-w-sm text-center text-sm text-muted-foreground">
            La sesión anterior no pudo renovarse. Inicia sesión de nuevo.
          </p>
        ) : null
      }
    >
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/panel"
        fallbackRedirectUrl="/panel"
        appearance={pragmaClerkAppearance}
      />
    </PragmaAuthLayout>
  );
}

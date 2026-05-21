import { SignIn } from "@clerk/nextjs";
import { PragmaAuthLayout } from "@/components/auth/pragma-auth-layout";

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
        forceRedirectUrl="/panel"
        signUpForceRedirectUrl="/panel"
        appearance={{
          elements: {
            rootBox: "w-full",
            card: "shadow-none border-0 p-0 bg-transparent",
            headerTitle: "font-heading text-xl",
            formButtonPrimary:
              "bg-pragma-electric hover:bg-pragma-electric/90 text-sm font-semibold",
            formFieldInput: "rounded-xl",
            footerActionLink: "text-pragma-electric",
          },
        }}
      />
    </PragmaAuthLayout>
  );
}

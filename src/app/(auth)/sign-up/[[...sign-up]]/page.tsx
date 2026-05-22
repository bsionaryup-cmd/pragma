import { SignUp } from "@clerk/nextjs";
import { AuthPageCta } from "@/components/brand/auth-cta-buttons";
import { PragmaAuthLayout } from "@/components/auth/pragma-auth-layout";
import { SUBSCRIPTION_TRIAL_LABEL } from "@/lib/constants";
import { pragmaClerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <PragmaAuthLayout
      hint={
        <p className="mb-4 max-w-md text-center text-sm text-muted-foreground">
          Crea tu cuenta con correo y contraseña. {SUBSCRIPTION_TRIAL_LABEL} — sin tarjeta
          para empezar.
        </p>
      }
    >
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/onboarding"
        fallbackRedirectUrl="/onboarding"
        appearance={pragmaClerkAppearance}
      />
      <AuthPageCta mode="sign-up" />
    </PragmaAuthLayout>
  );
}

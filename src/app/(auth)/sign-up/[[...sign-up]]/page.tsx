import { SignUp } from "@clerk/nextjs";
import { PragmaAuthLayout } from "@/components/auth/pragma-auth-layout";
import { pragmaClerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <PragmaAuthLayout>
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/panel"
        fallbackRedirectUrl="/panel"
        appearance={pragmaClerkAppearance}
      />
    </PragmaAuthLayout>
  );
}

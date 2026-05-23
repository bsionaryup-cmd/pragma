import { EmailPasswordSignUpForm } from "@/components/auth/email-password-sign-up-form";
import { PragmaAuthLayout } from "@/components/auth/pragma-auth-layout";
import { SUBSCRIPTION_TRIAL_LABEL } from "@/lib/constants";

export default function SignUpPage() {
  return (
    <PragmaAuthLayout
      hint={
        <p className="text-sm text-muted-foreground">
          Crea tu cuenta con correo y contraseña. {SUBSCRIPTION_TRIAL_LABEL} — sin tarjeta
          para empezar.
        </p>
      }
    >
      <EmailPasswordSignUpForm />
    </PragmaAuthLayout>
  );
}

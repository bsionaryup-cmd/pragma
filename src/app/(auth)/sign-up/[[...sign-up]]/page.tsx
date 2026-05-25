import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { EmailPasswordSignUpForm } from "@/components/auth/email-password-sign-up-form";
import { PragmaAuthLayout } from "@/components/auth/pragma-auth-layout";
import { resolvePostAuthHomePath } from "@/lib/auth/role-definitions.server";
import { SUBSCRIPTION_TRIAL_LABEL } from "@/lib/constants";
import { getUserByClerkId } from "@/services/users/user.service";

type SignUpPageProps = {
  searchParams: Promise<{ offer_token?: string; email?: string }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { userId } = await auth();
  const params = await searchParams;
  const offerQuery = params.offer_token
    ? `?offer_token=${encodeURIComponent(params.offer_token)}${params.email ? `&email=${encodeURIComponent(params.email)}` : ""}`
    : "";

  if (userId) {
    const dbUser = await getUserByClerkId(userId);

    if (dbUser && !dbUser.isActive) {
      redirect("/sign-in?inactive=1");
    }

    if (dbUser?.isActive) {
      redirect(resolvePostAuthHomePath(dbUser));
    }

    redirect(`/onboarding${offerQuery}`);
  }

  return (
    <PragmaAuthLayout
      backHref="/sign-in"
      backLabel="Iniciar sesión"
      hint={
        <p className="text-sm text-muted-foreground">
          Crea tu cuenta con correo y contraseña. {SUBSCRIPTION_TRIAL_LABEL} — sin tarjeta
          para empezar.
        </p>
      }
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <EmailPasswordSignUpForm />
      </Suspense>
    </PragmaAuthLayout>
  );
}

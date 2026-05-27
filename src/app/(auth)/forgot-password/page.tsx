import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { EmailPasswordForgotPasswordForm } from "@/components/auth/email-password-forgot-password-form";
import { PragmaAuthLayout } from "@/components/auth/pragma-auth-layout";
import { resolvePostAuthHomePath } from "@/lib/auth/role-definitions.server";
import { getUserByClerkId } from "@/services/users/user.service";

export default async function ForgotPasswordPage() {
  const { userId } = await auth();

  if (userId) {
    const dbUser = await getUserByClerkId(userId);
    if (dbUser?.isActive) {
      redirect(resolvePostAuthHomePath(dbUser));
    }
  }

  return (
    <PragmaAuthLayout backHref="/sign-in" backLabel="Iniciar sesión">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <EmailPasswordForgotPasswordForm />
      </Suspense>
    </PragmaAuthLayout>
  );
}

import { SignIn } from "@clerk/nextjs";

type SignInPageProps = {
  searchParams: Promise<{ session_reset?: string; clerk_unavailable?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const showRecoveryHint =
    params.session_reset === "1" || params.clerk_unavailable === "1";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      {showRecoveryHint ? (
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          La sesión anterior no pudo renovarse. Inicia sesión de nuevo. Si el
          error continúa, desactiva bloqueadores en este sitio o usa otro
          navegador.
        </p>
      ) : null}
      <SignIn forceRedirectUrl="/panel" signUpForceRedirectUrl="/panel" />
    </div>
  );
}

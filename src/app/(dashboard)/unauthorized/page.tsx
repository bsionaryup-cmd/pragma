import { BackLink } from "@/components/ui/back-link";
import { requireDbUser } from "@/lib/auth";

export default async function UnauthorizedPage() {
  await requireDbUser();

  return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <BackLink href="/panel" label="Volver al panel" />
        <h2 className="text-lg font-semibold">No tienes permiso</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Tu rol no permite acceder a esta sección. Si crees que es un error,
          contacta a un administrador.
        </p>
      </main>
  );
}

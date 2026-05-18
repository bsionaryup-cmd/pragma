import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { requireDbUser } from "@/lib/auth";

export default async function UnauthorizedPage() {
  await requireDbUser();

  return (
    <>
      <Topbar title="Acceso restringido" />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h2 className="text-lg font-semibold">No tienes permiso</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Tu rol no permite acceder a esta sección. Si crees que es un error,
          contacta a un administrador.
        </p>
        <Button asChild>
          <Link href="/panel">Volver al panel de control</Link>
        </Button>
      </main>
    </>
  );
}

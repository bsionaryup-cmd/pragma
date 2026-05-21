import Link from "next/link";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TTLockLoadError({ message }: { message: string }) {
  return (
    <ModuleShellFlow className="bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>TTLock no disponible temporalmente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{message}</p>
            <p>
              Si eres administrador del entorno, sincroniza la base de datos con:
            </p>
            <code className="block rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
              npx prisma migrate deploy
            </code>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/integrations">Volver a integraciones</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModuleShellFlow>
  );
}

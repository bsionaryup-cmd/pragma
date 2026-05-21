import Link from "next/link";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { Button } from "@/components/ui/button";

type PriceLabsLoadErrorProps = {
  message: string;
};

export function PriceLabsLoadError({ message }: PriceLabsLoadErrorProps) {
  return (
    <ModuleShellFlow className="bg-background px-4 py-6 pb-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-destructive/30 bg-card p-6">
        <h1 className="text-xl font-semibold">PriceLabs</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button asChild variant="outline">
          <Link href="/integrations">Volver a integraciones</Link>
        </Button>
      </div>
    </ModuleShellFlow>
  );
}

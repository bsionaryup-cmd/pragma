import Link from "next/link";
import { KeyRound, RadioTower } from "lucide-react";
import { ModuleShellFlow } from "@/components/layout/module-shell";

export default function IntegrationsPage() {
  return (
    <ModuleShellFlow className="bg-background px-4 py-6 pb-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
            Integrations
          </p>
          <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Integraciones Airbnb
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Conecta Airbnb, smart locks, calendario y automatizaciones en tu
            Command Center — sin herramientas dispersas.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <Link
            href="/integrations/ttlock"
            className="group rounded-2xl border border-border bg-card p-5 shadow-pragma-soft transition-all hover:-translate-y-0.5 hover:border-primary/35"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <KeyRound className="h-6 w-6" />
              </span>
              <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                Native
              </span>
            </div>
            <h2 className="mt-5 text-lg font-semibold text-foreground">
              TTLock Smart Access
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Base para credenciales TTLock, sync de cerraduras, mapeo por
              propiedad y automatización futura de códigos por reserva.
            </p>
            <p className="mt-4 text-sm font-semibold text-primary group-hover:underline">
              Abrir integración
            </p>
          </Link>

          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <RadioTower className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-foreground">
              Canales y PMS externos
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Airbnb, iCal y próximos conectores se seguirán consolidando en
              este módulo.
            </p>
          </div>
        </section>
      </div>
    </ModuleShellFlow>
  );
}

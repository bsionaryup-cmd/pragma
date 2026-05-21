import Link from "next/link";
import { FileText, KeyRound, Shield } from "lucide-react";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import type { AppUserRole } from "@/types/auth";

export default async function IntegrationsPage() {
  const auth = await requirePermission("integrations:read");
  const canManage = hasPermission(auth.role as AppUserRole, "integrations:manage");

  return (
    <ModuleShellFlow className="bg-background px-4 py-6 pb-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
            Integraciones
          </p>
          <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Conectores PRAGMA
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Smart locks, reportes gubernamentales y canales de reserva en un solo
            módulo.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/integrations/ttlock"
            className="group rounded-2xl border border-border bg-card p-5 shadow-pragma-soft transition-all hover:-translate-y-0.5 hover:border-primary/35"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-lg font-semibold">TTLock Smart Access</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              OAuth EU, cerraduras y códigos por reserva.
            </p>
          </Link>

          {canManage ? (
            <>
              <Link
                href="/integrations/sire"
                className="group rounded-2xl border border-border bg-card p-5 shadow-pragma-soft transition-all hover:-translate-y-0.5 hover:border-primary/35"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-pragma-light-blue text-pragma-electric">
                  <FileText className="h-6 w-6" />
                </span>
                <h2 className="mt-5 text-lg font-semibold">SIRE</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Reporte de huéspedes — API y credenciales.
                </p>
              </Link>
              <Link
                href="/integrations/traa"
                className="group rounded-2xl border border-border bg-card p-5 shadow-pragma-soft transition-all hover:-translate-y-0.5 hover:border-primary/35"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-pragma-light-blue text-pragma-electric">
                  <Shield className="h-6 w-6" />
                </span>
                <h2 className="mt-5 text-lg font-semibold">TRAA</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Turismo registrado — conexión preparada.
                </p>
              </Link>
            </>
          ) : null}
        </section>
      </div>
    </ModuleShellFlow>
  );
}

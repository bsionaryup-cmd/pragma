import Image from "next/image";
import Link from "next/link";
import { CreditCard, FileText, KeyRound, LineChart, Lock, Shield } from "lucide-react";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { BackLink } from "@/components/ui/back-link";
import { requirePermission, requireDbUser } from "@/lib/auth";
import { hasPermission } from "@/lib/auth/permissions";
import { planHasFeature } from "@/lib/billing/plan-entitlements";
import { getOrganizationPlanContextForUser } from "@/lib/billing/organization-plan";
import { BRAND_ASSETS } from "@/lib/brand-assets";
import type { AppUserRole } from "@/types/auth";

export default async function IntegrationsPage() {
  const auth = await requirePermission("integrations:read");
  const user = await requireDbUser();
  const planContext = await getOrganizationPlanContextForUser(user.id);
  const plan = planContext?.plan ?? "STARTER";
  const canManage = hasPermission(auth.role as AppUserRole, "integrations:manage");

  const showTtlock = planHasFeature(plan, "ttlock");
  const showPriceLabs = planHasFeature(plan, "pricelabs");
  const showSire = planHasFeature(plan, "sire");
  const showTraa = planHasFeature(plan, "traa");
  const showFinance = planHasFeature(plan, "finance");

  return (
    <ModuleShellFlow className="bg-background px-4 py-6 pb-10 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <BackLink href="/panel" label="Panel" />
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
            Integraciones
          </p>
          <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Conectores PRAGMA
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Canales de reserva, smart locks y reportes gubernamentales en un solo
            módulo.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/integrations/airbnb"
            prefetch={false}
            className="group rounded-2xl border border-border bg-card p-5 shadow-pragma-soft transition-all hover:-translate-y-0.5 hover:border-primary/35"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger/10">
              <Image
                src={BRAND_ASSETS.airbnbMark}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
            </span>
            <h2 className="mt-5 text-lg font-semibold">Airbnb</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Importación de listings, sync iCal y calendario de exportación.
            </p>
          </Link>

          {showTtlock ? (
            <Link
              href="/integrations/ttlock"
              prefetch={false}
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
          ) : (
            <LockedIntegrationCard
              title="TTLock Smart Access"
              description="Disponible en plan Pro o Scale."
            />
          )}

          {showPriceLabs ? (
            <Link
              href="/integrations/pricelabs"
              prefetch={false}
              className="group rounded-2xl border border-border bg-card p-5 shadow-pragma-soft transition-all hover:-translate-y-0.5 hover:border-primary/35"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-pragma-light-blue text-pragma-electric">
                <LineChart className="h-6 w-6" />
              </span>
              <h2 className="mt-5 text-lg font-semibold">PriceLabs</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Listings, precios dinámicos e inteligencia de tarifas.
              </p>
            </Link>
          ) : (
            <LockedIntegrationCard
              title="PriceLabs"
              description="Disponible en plan Pro o Scale."
            />
          )}

          {canManage && showSire ? (
            <Link
              href="/integrations/sire"
              prefetch={false}
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
          ) : canManage ? (
            <LockedIntegrationCard
              title="SIRE"
              description="Disponible en plan Pro o Scale."
            />
          ) : null}

          {canManage && showFinance ? (
            <Link
              href="/integrations/wompi"
              prefetch={false}
              className="group rounded-2xl border border-border bg-card p-5 shadow-pragma-soft transition-all hover:-translate-y-0.5 hover:border-primary/35"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-pragma-light-blue text-pragma-electric">
                <CreditCard className="h-6 w-6" />
              </span>
              <h2 className="mt-5 text-lg font-semibold">Wompi</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Payment Links del tenant — cobros a huéspedes (no suscripción SaaS).
              </p>
            </Link>
          ) : canManage ? (
            <LockedIntegrationCard
              title="Wompi"
              description="Disponible con módulo Finanzas (plan Pro+)."
            />
          ) : null}

          {canManage && showTraa ? (
            <Link
              href="/integrations/traa"
              prefetch={false}
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
          ) : canManage ? (
            <LockedIntegrationCard
              title="TRAA"
              description="Disponible en plan Pro o Scale."
            />
          ) : null}
        </section>
      </div>
    </ModuleShellFlow>
  );
}

function LockedIntegrationCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 opacity-90">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Lock className="h-6 w-6" />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-muted-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <Link
        href="/settings/billing"
        className="mt-4 inline-block text-sm font-medium text-pragma-electric hover:underline"
      >
        Ver planes
      </Link>
    </div>
  );
}

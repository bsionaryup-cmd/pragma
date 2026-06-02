import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OwnerBillingInfraView } from "@/components/owner/owner-billing-infra-view";
import { Button } from "@/components/ui/button";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants";
import { getOwnerBillingInfraSnapshot } from "@/services/platform/owner-billing-infra.service";

export const metadata = {
  title: "Infraestructura de cobro | PRAGMA Owner",
};

export default async function OwnerBillingInfraPage() {
  const snapshot = await getOwnerBillingInfraSnapshot();

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link href={OWNER_DASHBOARD_PATH}>
            <ArrowLeft className="h-4 w-4" />
            Owner Dashboard
          </Link>
        </Button>
      </div>

      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-pragma-electric">
          Plataforma · SaaS
        </p>
        <h1 className="mt-1 font-heading text-2xl font-semibold">
          Infraestructura Wompi, ePayco y cobros
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Cuentas centralizadas de PRAGMA para suscripciones SaaS — no pagos de
          reservas ni operación hotelera.
        </p>
      </header>

      <OwnerBillingInfraView snapshot={snapshot} />
    </div>
  );
}

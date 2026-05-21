import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import { Button } from "@/components/ui/button";

export async function BillingLockBanner() {
  const access = await getBillingAccessSnapshot();
  if (!access.locked) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 font-medium">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {access.reason ??
              "Tu cuenta está en modo restringido. Puedes iniciar sesión y pagar facturas pendientes."}
          </span>
        </p>
        <Button asChild size="sm" variant="default" className="shrink-0 bg-[#0E9F8D] hover:bg-[#0c8a7a]">
          <Link href="/settings/billing">Ir al centro de facturación</Link>
        </Button>
      </div>
    </div>
  );
}

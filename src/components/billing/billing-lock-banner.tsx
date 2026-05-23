import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { BillingAccessSnapshot } from "@/lib/billing/billing-access";
import { getBillingAccessSnapshot } from "@/services/billing/billing.service";
import { hasPermission } from "@/lib/auth/permissions";
import { requireDbUser } from "@/lib/auth";
import type { AppUserRole } from "@/types/auth";
import { Button } from "@/components/ui/button";

type BillingLockBannerProps = {
  access?: BillingAccessSnapshot;
  isAdmin?: boolean;
};

export async function BillingLockBanner({
  access,
  isAdmin,
}: BillingLockBannerProps = {}) {
  const snapshot = access ?? (await getBillingAccessSnapshot());
  if (!snapshot.locked) return null;

  let canManageBilling = isAdmin;
  if (canManageBilling === undefined) {
    const user = await requireDbUser();
    canManageBilling = hasPermission(user.role as AppUserRole, "billing:manage");
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 font-medium">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {canManageBilling
              ? (snapshot.reason ??
                "Tu cuenta está en modo restringido. Puedes iniciar sesión y pagar facturas pendientes.")
              : "La cuenta está en modo restringido. Contacta al administrador para renovar la suscripción."}
          </span>
        </p>
        {canManageBilling ? (
          <Button asChild size="sm" variant="default" className="shrink-0">
            <Link href="/settings/billing">Ir al centro de facturación</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

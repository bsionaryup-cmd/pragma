import { CreditCard } from "lucide-react";
import { ClerkSignOutButton } from "@/components/auth/clerk-sign-out-button";
import type { BillingAccessSnapshot } from "@/lib/billing/billing-access";

type BillingPaywallNoticeProps = {
  access: BillingAccessSnapshot;
  isAdmin: boolean;
};

export function BillingPaywallNotice({ access, isAdmin }: BillingPaywallNoticeProps) {
  return (
    <div className="border-b border-red-300/80 bg-red-50 px-4 py-5 text-red-950 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <CreditCard className="mt-0.5 h-6 w-6 shrink-0 text-red-600 dark:text-red-400" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-base font-semibold">Cuenta bloqueada — prueba gratuita finalizada</p>
          <p className="text-sm leading-relaxed text-red-900/90 dark:text-red-100/90">
            {access.reason ??
              "Tu período de prueba terminó. Debes activar y pagar la suscripción para volver a usar PRAGMA."}
          </p>
          {isAdmin ? (
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Completa el pago en esta pantalla. Hasta entonces no podrás acceder al calendario,
              reservas ni otras secciones.
            </p>
          ) : (
            <p className="text-sm text-red-800/90 dark:text-red-200/90">
              Contacta al administrador de la cuenta para realizar el pago de la suscripción.
            </p>
          )}
        </div>
        <ClerkSignOutButton variant="outline" className="shrink-0 border-red-300/80 bg-white text-red-950 hover:bg-red-100/80 dark:border-red-800 dark:bg-red-950 dark:text-red-50 dark:hover:bg-red-900/60">
          Cerrar sesión
        </ClerkSignOutButton>
      </div>
    </div>
  );
}

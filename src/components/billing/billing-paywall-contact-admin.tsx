import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/ui/page-header";

export function BillingPaywallContactAdmin() {
  return (
    <ModuleShellFlow>
      <PageHeader
        title="Suscripción requerida"
        description="La prueba gratuita de esta cuenta terminó. Solo el administrador puede activar y pagar la suscripción en PRAGMA."
      />
      <p className="text-sm text-muted-foreground">
        Si necesitas acceso urgente, pídele al titular de la cuenta que ingrese a Mi
        Suscripción y complete el pago.
      </p>
    </ModuleShellFlow>
  );
}

"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CreditCard, Receipt } from "lucide-react";
import { toast } from "sonner";
import {
  activateSubscriptionManualAction,
  payOpenInvoiceAction,
} from "@/features/billing/actions/billing.actions";
import type { BillingOverviewDto } from "@/services/billing/billing.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BillingCenterProps = {
  overview: BillingOverviewDto;
  showDevActivate?: boolean;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { dateStyle: "medium" });
}

const statusLabels: Record<string, string> = {
  TRIAL: "Prueba",
  ACTIVE: "Activa",
  PAST_DUE: "Pago vencido",
  CANCELED: "Cancelada",
  LOCKED: "Restringida",
};

export function BillingCenter({
  overview,
  showDevActivate = false,
}: BillingCenterProps) {
  const { account, access, invoices, paymentMethods, ready } = overview;
  const [pending, startTransition] = useTransition();
  const openInvoice = invoices.find((i) => i.status === "OPEN");

  const payInvoice = (invoiceId: string) => {
    startTransition(async () => {
      try {
        const result = await payOpenInvoiceAction(invoiceId);
        if (result.ok && result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al iniciar pago");
      }
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Configuración
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Centro de facturación</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Suscripción PRAGMA · pagos tokenizados vía Wompi (sin almacenar tarjetas en
          PRAGMA).
        </p>
      </header>

      {!ready ? (
        <Card>
          <CardContent className="py-6 text-sm text-amber-800">
            Ejecuta las migraciones de base de datos para activar facturación (
            <code className="rounded bg-muted px-1">npm run db:migrate</code>).
          </CardContent>
        </Card>
      ) : null}

      {access.locked ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Modo restringido</p>
          <p className="mt-1">
            Puedes iniciar sesión, ver facturas y actualizar tu método de pago. Las
            reservas nuevas, integraciones y el motor de revenue están pausados hasta
            regularizar el pago.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan actual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estado</span>
              <Badge variant="outline">{statusLabels[account.status] ?? account.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{account.plan}</span>
            </div>
            {account.status === "TRIAL" ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fin de prueba</span>
                <span className="font-medium">{formatDate(account.trialEndsAt)}</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Próxima renovación</span>
                <span className="font-medium">
                  {account.nextRenewalLabel ?? formatDate(account.currentPeriodEnd)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Métodos de pago
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Tarjetas débito/crédito, PSE, Nequi y métodos compatibles Bancolombia vía
              Wompi.
            </p>
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              <li>PSE {paymentMethods.pse ? "✓" : "—"}</li>
              <li>Nequi {paymentMethods.nequi ? "✓" : "—"}</li>
              <li>Tarjetas tokenizadas {paymentMethods.cards ? "✓" : "—"}</li>
            </ul>
            {openInvoice ? (
              <Button
                disabled={pending || !paymentMethods.wompiEnabled}
                className="bg-[#0E9F8D] hover:bg-[#0c8a7a]"
                onClick={() => payInvoice(openInvoice.id)}
              >
                Pagar factura (PSE / Nequi / tarjeta)
              </Button>
            ) : (
              <Button
                disabled={pending || !paymentMethods.wompiEnabled}
                className="bg-[#0E9F8D] hover:bg-[#0c8a7a]"
              >
                {paymentMethods.wompiEnabled
                  ? "Sin facturas abiertas"
                  : "Configura WOMPI_PUBLIC_KEY"}
              </Button>
            )}
            {showDevActivate && !paymentMethods.wompiEnabled ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await activateSubscriptionManualAction();
                    if (r.ok) toast.success(r.message);
                    else toast.error(r.message);
                  })
                }
              >
                Activar (solo dev sin Wompi)
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            Historial de facturas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin facturas aún.</p>
          ) : (
            <ul className="divide-y text-sm">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">
                      {inv.description ?? "Suscripción PRAGMA"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vence {formatDate(inv.dueAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">
                      {Number(inv.amount).toLocaleString("es-CO")} {inv.currency}
                    </p>
                    <div className="mt-1 flex flex-col items-end gap-1">
                      <Badge variant="outline">{inv.status}</Badge>
                      {inv.status === "OPEN" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => payInvoice(inv.id)}
                        >
                          Pagar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        ¿Necesitas ayuda?{" "}
        <Link href="mailto:soporte@pragma.co" className="text-[#0E9F8D] underline">
          Contactar soporte
        </Link>
      </p>
    </div>
  );
}

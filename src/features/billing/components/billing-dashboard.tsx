"use client";

import Link from "next/link";
import { useEffect, useRef, useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  activateSubscriptionManualAction,
  cancelSubscriptionAction,
  payOpenInvoiceAction,
} from "@/features/billing/actions/billing.actions";
import { PlanSelector } from "@/features/billing/components/plan-selector";
import type { BillingDashboardDto } from "@/modules/billing/services/dashboard.service";
import type { BillingPlanCode } from "@prisma/client";
import { PlanUpgradeBanner } from "@/components/billing/plan-upgrade-banner";
import { getPlanDefinition } from "@/modules/billing/domain/plan-catalog";
import type { PlanFeature } from "@/lib/billing/plan-entitlements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/helpers/date";

type BillingDashboardProps = {
  data: BillingDashboardDto;
  upgradeFeature?: string;
  showDevActivate?: boolean;
  autoCheckout?: boolean;
};

const UPGRADE_FEATURES = new Set([
  "calendar",
  "reservations",
  "properties",
  "inbox",
  "ical",
  "tasks",
  "finance",
  "revenue",
  "ttlock",
  "pricelabs",
  "reports",
  "sire",
  "traa",
]);

const STATUS_LABELS: Record<string, string> = {
  TRIAL: "Prueba",
  ACTIVE: "Activa",
  PAST_DUE: "Pago vencido",
  LOCKED: "Restringida",
  PAID: "Pagada",
};

function formatBillingDate(iso: string | null) {
  if (!iso) return null;
  return formatDate(iso);
}

function formatAmount(amount: string | number, currency: string) {
  return `${Number(amount).toLocaleString("es-CO")} ${currency}`;
}

function StatusBadge({ status }: { status: string }) {
  const ok = ["PAID", "ACTIVE"].includes(status);
  const pending = ["OPEN", "TRIAL", "PENDING"].includes(status);
  return (
    <Badge variant={ok ? "default" : pending ? "outline" : "destructive"}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function BillingDashboard({
  data,
  upgradeFeature,
  showDevActivate = false,
  autoCheckout = false,
}: BillingDashboardProps) {
  const upgrade =
    upgradeFeature && UPGRADE_FEATURES.has(upgradeFeature)
      ? (upgradeFeature as PlanFeature)
      : null;
  const { account, access, invoices, paymentMethods, ready } = data;
  const [pending, startTransition] = useTransition();
  const autoCheckoutStarted = useRef(false);

  const payableInvoice =
    invoices.find((i) => i.status === "OPEN") ??
    invoices.find((i) => i.status === "FAILED");

  const paidInvoices = invoices.filter((i) => i.status === "PAID");
  const canSelectPlan = account.status !== "ACTIVE";
  const needsActivation = account.status !== "ACTIVE";
  const planName = getPlanDefinition(account.plan as BillingPlanCode).name;
  const trialEnd = formatBillingDate(account.trialEndsAt);

  const payInvoice = (invoiceId: string) => {
    startTransition(async () => {
      try {
        const result = await payOpenInvoiceAction(invoiceId);
        if (result.ok && result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
          return;
        }
        if (result.ok) {
          toast.success(result.message);
          return;
        }
        toast.error(result.message);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al iniciar pago");
      }
    });
  };

  const paymentGatewayLabel =
    paymentMethods.subscriptionGateway === "EPAYCO" ? "ePayco" : "Wompi";

  useEffect(() => {
    if (!autoCheckout || autoCheckoutStarted.current) return;
    autoCheckoutStarted.current = true;

    if (!payableInvoice) {
      toast.error("Elige tu plan y vuelve a pulsar Activar suscripción.");
      return;
    }
    if (!paymentMethods.onlinePaymentsEnabled) {
      toast.error(
        "Ninguna pasarela configurada. Configura Wompi o ePayco en Owner Dashboard.",
      );
      return;
    }

    payInvoice(payableInvoice.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckout, payableInvoice?.id, paymentMethods.onlinePaymentsEnabled]);

  const downloadPdf = (url: string) => {
    startTransition(async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error ?? "No se pudo descargar la factura");
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = window.document.createElement("a");
        anchor.href = objectUrl;
        anchor.download =
          response.headers
            .get("Content-Disposition")
            ?.match(/filename="([^"]+)"/)?.[1] ?? "pragma-factura.pdf";
        anchor.click();
        URL.revokeObjectURL(objectUrl);
        toast.success("Factura descargada");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al descargar PDF");
      }
    });
  };

  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-4 pb-8 sm:px-6">
        <PageHeader
          backHref="/settings"
          backLabel="Configuración"
          eyebrow="Configuración"
          title="Mi Suscripción"
          description="Plan, pago con Wompi o ePayco e historial de facturas."
        />

        {!ready ? (
          <p className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
            Facturación no disponible. Contacta a soporte.
          </p>
        ) : null}

        {access.locked ? (
          <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning">
            <p className="font-medium">Acceso restringido</p>
            <p className="mt-0.5 text-xs opacity-90">{access.reason}</p>
          </div>
        ) : null}

        {ready ? (
          <div className="space-y-4">
            {upgrade ? <PlanUpgradeBanner feature={upgrade} /> : null}

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-pragma-soft">
              <div className="border-b border-border px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={account.status} />
                      <span className="text-sm font-semibold">{planName}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {account.propertyCount} propiedad
                      {account.propertyCount === 1 ? "" : "es"} ·{" "}
                      {formatAmount(account.monthlyAmount, account.monthlyCurrency)}/mes
                      {trialEnd ? ` · prueba hasta ${trialEnd}` : null}
                      {account.nextRenewalLabel
                        ? ` · renueva ${account.nextRenewalLabel}`
                        : null}
                    </p>
                  </div>
                  {account.status === "ACTIVE" && !payableInvoice ? (
                    <p className="text-xs font-medium text-success">Al día</p>
                  ) : null}
                </div>
              </div>

              {canSelectPlan ? (
                <div className="border-b border-border px-4 py-4 sm:px-5">
                  <PlanSelector
                    currentPlan={account.plan as BillingPlanCode}
                    propertyCount={account.propertyCount}
                  />
                </div>
              ) : null}

              {payableInvoice ? (
                <div className="space-y-3 px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Total a pagar</p>
                      <p className="text-xl font-semibold tabular-nums">
                        {formatAmount(payableInvoice.amount, payableInvoice.currency)}
                      </p>
                    </div>
                    <Button
                      disabled={pending || !paymentMethods.onlinePaymentsEnabled}
                      className="min-w-[180px]"
                      onClick={() => payInvoice(payableInvoice.id)}
                    >
                      {needsActivation
                        ? `Activar · Pagar con ${paymentGatewayLabel}`
                        : payableInvoice.status === "FAILED"
                          ? "Reintentar pago"
                          : `Pagar con ${paymentGatewayLabel}`}
                    </Button>
                  </div>
                  {!paymentMethods.onlinePaymentsEnabled ? (
                    <p className="text-xs text-muted-foreground">
                      Pasarela no disponible. El owner debe configurar Wompi o ePayco.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Pago seguro con tarjeta, PSE u otros medios vía {paymentGatewayLabel}.
                    </p>
                  )}
                  {showDevActivate && !paymentMethods.onlinePaymentsEnabled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await activateSubscriptionManualAction();
                          if (r.ok) toast.success(r.message);
                          else toast.error(r.message);
                        })
                      }
                    >
                      Activar (dev)
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {["ACTIVE", "PAST_DUE", "TRIAL"].includes(account.status) ? (
                <div className="border-t border-border px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                    disabled={pending}
                    onClick={() => {
                      if (
                        !window.confirm(
                          "¿Confirmas la cancelación de tu suscripción PRAGMA?",
                        )
                      ) {
                        return;
                      }
                      startTransition(async () => {
                        const result = await cancelSubscriptionAction();
                        if (result.ok) toast.success(result.message);
                        else toast.error(result.message);
                      });
                    }}
                  >
                    Cancelar suscripción
                  </button>
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border border-border bg-card px-4 py-3 sm:px-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Facturas pagadas</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs"
                  disabled={pending}
                  onClick={() => downloadPdf("/api/billing/invoices/current/pdf")}
                >
                  <Download className="h-3.5 w-3.5" />
                  Vista previa PDF
                </Button>
              </div>

              {paidInvoices.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sin facturas pagadas aún.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {paidInvoices.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {formatBillingDate(inv.paidAt ?? inv.dueAt)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {inv.description ?? "Suscripción PRAGMA"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-semibold tabular-nums">
                          {formatAmount(inv.amount, inv.currency)}
                        </span>
                        <button
                          type="button"
                          className="text-xs text-pragma-electric hover:underline"
                          disabled={pending}
                          onClick={() =>
                            downloadPdf(`/api/billing/invoices/${inv.id}/pdf`)
                          }
                        >
                          PDF
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="mailto:soporte@pragma.co" className="text-pragma-electric hover:underline">
            Soporte
          </Link>
        </p>
      </div>
    </ModuleShellFlow>
  );
}

/** Alias para compatibilidad con imports legacy. */
export const BillingCenter = BillingDashboard;

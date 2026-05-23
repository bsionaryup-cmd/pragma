"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CreditCard, Download, Receipt } from "lucide-react";
import { toast } from "sonner";
import {
  activateSubscriptionManualAction,
  payOpenInvoiceAction,
} from "@/features/billing/actions/billing.actions";
import { PlanSelector } from "@/features/billing/components/plan-selector";
import { BankTransferPanel } from "@/features/billing/components/bank-transfer-panel";
import { WompiCredentialsCard } from "@/features/billing/components/wompi-credentials-card";
import type { BillingDashboardDto } from "@/modules/billing/services/dashboard.service";
import type { BillingPlanCode } from "@prisma/client";
import { getPlanDefinition } from "@/modules/billing/domain/plan-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/ui/page-header";

type BillingDashboardProps = {
  data: BillingDashboardDto;
  showDevActivate?: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  TRIAL: "Prueba",
  ACTIVE: "Activa",
  PAST_DUE: "Pago vencido",
  LOCKED: "Restringida",
  OPEN: "Pendiente",
  PAID: "Pagada",
  FAILED: "Fallida",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { dateStyle: "medium" });
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
  showDevActivate = false,
}: BillingDashboardProps) {
  const { account, access, invoices, paymentMethods, wompi, canManageWompiSettings, ready } = data;
  const [pending, startTransition] = useTransition();

  const payableInvoice =
    invoices.find((i) => i.status === "OPEN") ??
    invoices.find((i) => i.status === "FAILED");

  const paidInvoices = invoices.filter((i) => i.status === "PAID");
  const canSelectPlan = account.status !== "ACTIVE";

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

  const downloadPdf = (url: string, label: string) => {
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
        toast.success(`${label} descargada`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al descargar PDF");
      }
    });
  };

  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-5 pb-10 sm:px-6">
        <PageHeader
          backHref="/settings"
          backLabel="Configuración"
          eyebrow="Configuración"
          title="Facturación"
          description="Consulta tu suscripción, realiza el pago y revisa tus facturas."
        />

        {!ready ? (
          <Card className="mb-6">
            <CardContent className="py-6 text-sm text-muted-foreground">
              La facturación no está disponible en este momento. Contacta a soporte si
              necesitas ayuda.
            </CardContent>
          </Card>
        ) : null}

        {access.locked ? (
          <div className="mb-6 rounded-xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning">
            <p className="font-medium">Acceso restringido</p>
            <p className="mt-1">{access.reason}</p>
          </div>
        ) : null}

        {ready ? (
          <>
            {canManageWompiSettings && wompi ? (
              <WompiCredentialsCard wompi={wompi} canManage />
            ) : null}

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Tu suscripción</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
                    <dt className="text-muted-foreground">Estado</dt>
                    <dd>
                      <StatusBadge status={account.status} />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
                    <dt className="text-muted-foreground">Plan</dt>
                    <dd className="font-medium">{getPlanDefinition(account.plan as BillingPlanCode).name}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
                    <dt className="text-muted-foreground">Propiedades</dt>
                    <dd className="font-medium tabular-nums">{account.propertyCount}</dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
                    <dt className="text-muted-foreground">Precio por propiedad</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatAmount(account.pricePerProperty, account.monthlyCurrency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
                    <dt className="text-muted-foreground">Total mensual</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatAmount(account.monthlyAmount, account.monthlyCurrency)}
                    </dd>
                  </div>
                  {account.trialEndsAt ? (
                    <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
                      <dt className="text-muted-foreground">Fin de prueba</dt>
                      <dd>{formatDate(account.trialEndsAt)}</dd>
                    </div>
                  ) : null}
                  {account.nextRenewalLabel ? (
                    <div className="flex justify-between gap-4 sm:flex-col sm:justify-start">
                      <dt className="text-muted-foreground">Próxima renovación</dt>
                      <dd>{account.nextRenewalLabel}</dd>
                    </div>
                  ) : null}
                </dl>

                {canSelectPlan ? (
                  <div className="border-t pt-4">
                    <p className="mb-3 text-sm text-muted-foreground">
                      Elige el plan antes de pagar tu suscripción.
                    </p>
                    <PlanSelector
                      currentPlan={account.plan as BillingPlanCode}
                      propertyCount={account.propertyCount}
                      disabled={false}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {payableInvoice ? (
              <div className="mb-6 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CreditCard className="h-4 w-4" />
                      Realizar pago
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="rounded-xl border bg-muted/30 px-4 py-3">
                      <p className="text-muted-foreground">Monto a pagar</p>
                      <p className="text-xl font-semibold tabular-nums">
                        {formatAmount(payableInvoice.amount, payableInvoice.currency)}
                      </p>
                      {payableInvoice.description ? (
                        <p className="mt-1 text-muted-foreground">
                          {payableInvoice.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Button
                        disabled={pending || !paymentMethods.wompiEnabled}
                        className="w-full"
                        onClick={() => payInvoice(payableInvoice.id)}
                      >
                        {payableInvoice.status === "FAILED"
                          ? "Reintentar pago en línea"
                          : "Pagar en línea"}
                      </Button>
                      {!paymentMethods.wompiEnabled ? (
                        <p className="text-center text-xs text-muted-foreground">
                          Pago en línea no disponible · usa transferencia bancaria
                        </p>
                      ) : null}
                    </div>

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
                        Activar (dev)
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>

                <BankTransferPanel
                  invoiceId={payableInvoice.id}
                  amount={payableInvoice.amount}
                  currency={payableInvoice.currency}
                  referenceHint={payableInvoice.manualPaymentRef}
                  submitted={Boolean(payableInvoice.manualSubmittedAt)}
                />
              </div>
            ) : account.status === "ACTIVE" ? (
              <Card className="mb-6">
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  Tu suscripción está al día. No hay pagos pendientes.
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Receipt className="h-4 w-4" />
                    Facturas
                  </CardTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={pending}
                    onClick={() =>
                      downloadPdf(
                        "/api/billing/invoices/current/pdf",
                        "Factura del plan actual",
                      )
                    }
                  >
                    <Download className="h-4 w-4" />
                    Factura del plan actual
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {paidInvoices.length === 0 ? (
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>Aún no tienes facturas pagadas registradas.</p>
                    <p>
                      Usa <strong>Factura del plan actual</strong> arriba para
                      descargar una vista previa con el formato oficial.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y text-sm">
                    {paidInvoices.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex flex-wrap items-start justify-between gap-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {inv.description ?? "Suscripción PRAGMA"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Pagada el {formatDate(inv.paidAt ?? inv.dueAt)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right">
                            <p className="font-semibold tabular-nums">
                              {formatAmount(inv.amount, inv.currency)}
                            </p>
                            <StatusBadge status={inv.status} />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={pending}
                            onClick={() =>
                              downloadPdf(
                                `/api/billing/invoices/${inv.id}/pdf`,
                                "Factura",
                              )
                            }
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Necesitas ayuda?{" "}
          <Link href="mailto:soporte@pragma.co" className="text-pragma-electric underline">
            Contacta soporte
          </Link>
        </p>
      </div>
    </ModuleShellFlow>
  );
}

/** Alias para compatibilidad con imports legacy. */
export const BillingCenter = BillingDashboard;

"use client";

import { AlertTriangle, Radio, ShieldAlert } from "lucide-react";
import { WompiCredentialsCard } from "@/features/billing/components/wompi-credentials-card";
import type { OwnerBillingInfraSnapshot } from "@/services/platform/owner-billing-infra.service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatOwnerCop } from "@/components/owner/owner-dashboard-utils";
import { formatDateTime } from "@/lib/helpers/date";

type OwnerBillingInfraViewProps = {
  snapshot: OwnerBillingInfraSnapshot;
};

export function OwnerBillingInfraView({ snapshot }: OwnerBillingInfraViewProps) {
  const { wompi, webhookStats, failedPayments, recentWebhooks } = snapshot;

  return (
    <div className="space-y-6">
      <WompiCredentialsCard wompi={wompi} canManage />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Webhooks (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{webhookStats.total24h}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Firma inválida (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-destructive">
              {webhookStats.invalidSignature24h}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sin procesar (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-warning">
              {webhookStats.unprocessed24h}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Duplicados (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {webhookStats.duplicate24h}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" />
            Pagos fallidos y pendientes vencidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {failedPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay facturas fallidas ni vencidas sin cobrar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organización</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedPayments.map((row) => (
                    <TableRow key={row.invoiceId}>
                      <TableCell>
                        <div className="font-medium">
                          {row.organizationName ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.organizationId}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.status === "FAILED" ? "destructive" : "outline"
                          }
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatOwnerCop(row.amount)} {row.currency}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDateTime(row.dueAt, "—", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {row.failureReason ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4" />
            Monitor de webhooks Wompi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentWebhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay eventos registrados. Configura la URL en Wompi y realiza
              un pago de prueba en sandbox.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentWebhooks.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">
                        {row.eventType}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate font-mono text-xs">
                        {row.eventId}
                      </TableCell>
                      <TableCell>
                        {row.signatureValid ? (
                          <Badge variant="default">OK</Badge>
                        ) : (
                          <Badge variant="destructive">Inválida</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.processed ? (
                            <Badge variant="secondary">Procesado</Badge>
                          ) : (
                            <Badge variant="outline">Pendiente</Badge>
                          )}
                          {row.duplicate ? (
                            <Badge variant="outline">Dup</Badge>
                          ) : null}
                          {row.errorMessage ? (
                            <span
                              className="flex items-center gap-1 text-xs text-destructive"
                              title={row.errorMessage}
                            >
                              <AlertTriangle className="h-3 w-3" />
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(row.createdAt, "—", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  approveAccessCodeAction,
  generateAccessCodeAction,
  revokeAccessCodeAction,
} from "@/features/smart-access/actions/smart-access.actions";
import type { SmartAccessOverview } from "@/services/access/smart-access.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

type SmartAccessDashboardProps = {
  data: SmartAccessOverview;
  canManage: boolean;
};

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof LockKeyhole;
}) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </Card>
  );
}

function stageBadgeClass(stage: SmartAccessOverview["items"][number]["stage"]) {
  switch (stage) {
    case "generated":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "awaiting_registration":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "pending_approval":
    case "ready_to_generate":
      return "border-sky-200 bg-sky-50 text-sky-900";
    case "revoked":
    case "expired":
      return "border-border bg-muted text-muted-foreground";
    default:
      return "border-orange-200 bg-orange-50 text-orange-900";
  }
}

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-CO", {
    dateStyle: "medium",
  });
}

export function SmartAccessDashboard({ data, canManage }: SmartAccessDashboardProps) {
  const [pending, startTransition] = useTransition();
  const { items, metrics } = data;

  function runAction(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error inesperado");
      }
    });
  }

  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-10 sm:px-6">
        <PageHeader
          eyebrow="Operación"
          title="Llaves Inteligentes"
          description="Gestiona códigos TTLock automáticamente cuando el huésped completa el registro de la reserva. Hasta entonces, PRAGMA no envía instrucciones a la cerradura."
        />

        {!metrics.integrationConnected ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">TTLock no está conectado</p>
            <p className="mt-1">
              Conecta tu cuenta en{" "}
              <Link href="/integrations/ttlock" className="underline">
                Integraciones → TTLock
              </Link>{" "}
              y vincula cada propiedad con su cerradura.
            </p>
          </div>
        ) : null}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Reservas activas"
            value={String(metrics.total)}
            detail="Con acceso en seguimiento"
            icon={LockKeyhole}
          />
          <MetricCard
            label="Registro pendiente"
            value={String(metrics.awaitingRegistration)}
            detail="Sin datos del huésped aún"
            icon={UserCheck}
          />
          <MetricCard
            label="Listas para código"
            value={String(metrics.readyForCode)}
            detail="Registro completo, esperando TTLock"
            icon={Zap}
          />
          <MetricCard
            label="Códigos activos"
            value={String(metrics.codesActive)}
            detail={`${metrics.locksMapped} cerradura(s) vinculada(s)`}
            icon={KeyRound}
          />
        </section>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Accesos por reserva</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                El código se genera con el nombre del titular y las fechas de la
                reserva una vez completado el formulario de registro.
              </p>
            </div>
            <Badge variant="outline" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              TTLock
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay reservas activas con acceso inteligente en este momento.
              </p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border px-4 py-4 sm:px-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.guestName}</p>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", stageBadgeClass(item.stage))}
                        >
                          {item.stageLabel}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.propertyName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.checkIn)} → {formatDate(item.checkOut)}
                      </p>
                      {item.credential?.code ? (
                        <p className="pt-1 font-mono text-sm font-semibold tracking-widest">
                          Código: {item.credential.code}
                        </p>
                      ) : null}
                    </div>

                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        {item.stage === "pending_approval" && item.credential ? (
                          <Button
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              runAction(() =>
                                approveAccessCodeAction(item.credential!.id),
                              )
                            }
                          >
                            Aprobar y generar
                          </Button>
                        ) : null}

                        {(item.stage === "ready_to_generate" ||
                          item.stage === "awaiting_lock" ||
                          item.stage === "revoked") &&
                        item.registrationComplete ? (
                          <Button
                            size="sm"
                            disabled={pending}
                            onClick={() =>
                              runAction(() =>
                                generateAccessCodeAction(item.id),
                              )
                            }
                          >
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            Generar código
                          </Button>
                        ) : null}

                        {item.stage === "generated" && item.credential ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                              runAction(() => revokeAccessCodeAction(item.id))
                            }
                          >
                            Revocar
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleShellFlow>
  );
}

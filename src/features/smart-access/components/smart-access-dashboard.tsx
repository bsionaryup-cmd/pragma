"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { AccessCodeDisplay } from "@/components/access/access-code-display";
import {
  activateAccessCodeAction,
  approveAccessCodeAction,
  generateAccessCodeAction,
  revokeAccessCodeAction,
  suspendAccessCodeAction,
} from "@/features/smart-access/actions/smart-access.actions";
import type { SmartAccessOverview } from "@/services/access/smart-access.service";
import { AccessCredentialStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/ui/page-header";
import { getAccessStageBadgeClass } from "@/lib/ui/status-badge-styles";
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
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pragma-soft-cyan text-pragma-electric">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </Card>
  );
}

function stageBadgeClass(stage: SmartAccessOverview["items"][number]["stage"]) {
  return getAccessStageBadgeClass(stage);
}

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-CO", {
    dateStyle: "medium",
  });
}

function credentialIsActive(status: AccessCredentialStatus) {
  return (
    status === AccessCredentialStatus.GENERATED ||
    status === AccessCredentialStatus.SENT ||
    status === AccessCredentialStatus.ACTIVE
  );
}

export function SmartAccessDashboard({ data, canManage }: SmartAccessDashboardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { items, metrics } = data;

  function runAction(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message);
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error inesperado");
      }
    });
  }

  return (
    <ModuleShellFlow className="bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-10 sm:px-6">
        <PageHeader
          eyebrow="TTLock"
          title="TTLock"
          description="Códigos de acceso automáticos cuando el huésped completa el registro. Hasta entonces, PRAGMA no envía instrucciones a la cerradura."
        />

        {!metrics.integrationConnected ? (
          <div className="mb-6 rounded-xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning">
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
          <CardContent className="space-y-2">
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay reservas activas con acceso inteligente en este momento.
              </p>
            ) : (
              items.map((item) => {
                const hasCode = Boolean(item.credential?.code);
                const codeIsActive = item.credential
                  ? credentialIsActive(item.credential.status)
                  : false;
                const canToggleCode =
                  item.stage === "generated" || item.stage === "suspended";

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/80 px-3 py-2.5 sm:px-4"
                  >
                    <div className="space-y-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {item.guestName}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px]", stageBadgeClass(item.stage))}
                          >
                            {item.stageLabel}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.propertyName}
                          <span className="mx-1.5" aria-hidden>
                            ·
                          </span>
                          {formatDate(item.checkIn)} → {formatDate(item.checkOut)}
                        </p>
                        {item.registrationProgress ? (
                          <p className="mt-0.5 text-[11px] font-medium text-warning">
                            Registro: {item.registrationProgress} huéspedes
                          </p>
                        ) : null}
                      </div>

                      {hasCode ? (
                        <AccessCodeDisplay
                          variant="inline"
                          code={item.credential!.code}
                          status={item.credential!.status}
                          isActive={codeIsActive}
                        />
                      ) : null}

                      {canManage ? (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {item.stage === "pending_approval" && item.credential ? (
                            <Button
                              size="xs"
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
                              size="xs"
                              disabled={pending}
                              onClick={() =>
                                runAction(() => generateAccessCodeAction(item.id))
                              }
                            >
                              <RefreshCw className="mr-1 h-3.5 w-3.5" />
                              Generar código
                            </Button>
                          ) : null}

                          {canToggleCode && item.credential ? (
                            <>
                              {item.stage === "generated" ? (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  disabled={pending}
                                  onClick={() =>
                                    runAction(() =>
                                      suspendAccessCodeAction(item.id),
                                    )
                                  }
                                >
                                  Desactivar
                                </Button>
                              ) : null}
                              {item.stage === "suspended" ? (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  disabled={pending}
                                  onClick={() =>
                                    runAction(() =>
                                      activateAccessCodeAction(item.id),
                                    )
                                  }
                                >
                                  Activar
                                </Button>
                              ) : null}
                              <Button
                                size="xs"
                                variant="outline"
                                className="border-danger/20 text-danger/70 hover:border-danger/30 hover:bg-danger/5 hover:text-danger"
                                disabled={pending}
                                onClick={() =>
                                  runAction(() => revokeAccessCodeAction(item.id))
                                }
                              >
                                Revocar
                              </Button>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleShellFlow>
  );
}

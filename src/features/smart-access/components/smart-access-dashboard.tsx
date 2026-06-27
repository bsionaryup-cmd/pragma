"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ClipboardList, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatCalendarUnitDisplay } from "@/features/calendar/lib/property-unit";
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
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/ui/page-header";
import { getAccessStageBadgeClass } from "@/lib/ui/status-badge-styles";
import { formatDate } from "@/lib/helpers/date";
import { cn } from "@/lib/utils";

type SmartAccessDashboardProps = {
  data: SmartAccessOverview;
  canManage: boolean;
};

function formatStayDate(iso: string) {
  return formatDate(new Date(`${iso}T12:00:00`));
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
      <div className="mx-auto w-full max-w-4xl px-4 py-4 pb-8 sm:px-6">
        <PageHeader
          title="Códigos de acceso"
          description="Códigos de cerradura por reserva. Se generan cuando el huésped completa el registro."
        />

        {!metrics.integrationConnected ? (
          <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            Conecta TTLock en{" "}
            <Link href="/integrations/ttlock" className="font-medium underline">
              Integraciones
            </Link>{" "}
            y vincula cada propiedad con su cerradura.
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{metrics.total}</span>{" "}
            reservas
          </span>
          <span aria-hidden>·</span>
          <span>
            <span className="font-semibold text-foreground">
              {metrics.awaitingRegistration}
            </span>{" "}
            sin registro
          </span>
          <span aria-hidden>·</span>
          <span>
            <span className="font-semibold text-foreground">{metrics.readyForCode}</span>{" "}
            listas
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <KeyRound className="h-3 w-3" aria-hidden />
            <span className="font-semibold text-foreground">{metrics.codesActive}</span>{" "}
            códigos activos
          </span>
          {metrics.locksMapped > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span>
                {metrics.locksMapped} cerradura{metrics.locksMapped === 1 ? "" : "s"}
              </span>
            </>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-pragma-soft">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No hay reservas activas con código de acceso en seguimiento.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const hasCode = Boolean(item.credential?.code);
                const codeIsActive = item.credential
                  ? credentialIsActive(item.credential.status)
                  : false;
                const canToggleCode =
                  item.stage === "generated" || item.stage === "suspended";
                const unitNumber = item.propertyUnitNumber
                  ? formatCalendarUnitDisplay(item.propertyUnitNumber)
                  : null;
                const showStageBadge = item.stage !== "awaiting_registration";

                return (
                  <li key={item.id} className="px-3 py-2.5 sm:px-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-foreground">
                            {item.guestName}
                          </p>
                          {showStageBadge ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 text-[10px]",
                                getAccessStageBadgeClass(item.stage),
                              )}
                            >
                              {item.stageLabel}
                            </Badge>
                          ) : null}
                          {item.registrationProgress ? (
                            <span className="text-[10px] font-medium text-warning">
                              Registro {item.registrationProgress}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {unitNumber ? (
                            <>
                              <span className="font-semibold tabular-nums text-foreground/80">
                                {unitNumber}
                              </span>
                              <span className="mx-1" aria-hidden>
                                ·
                              </span>
                            </>
                          ) : null}
                          {item.propertyName}
                          <span className="mx-1" aria-hidden>
                            ·
                          </span>
                          {formatStayDate(item.checkIn)} – {formatStayDate(item.checkOut)}
                        </p>
                        {item.lockMapped ? (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {item.lockAlias ? `${item.lockAlias} · ` : null}
                            {item.lockOnlineState === "ONLINE"
                              ? "En línea"
                              : item.lockOnlineState === "OFFLINE"
                                ? "Fuera de línea"
                                : "Estado desconocido"}
                            {item.lockBatteryLevel != null
                              ? ` · Batería ${item.lockBatteryLevel}%`
                              : null}
                          </p>
                        ) : null}
                      </div>

                      {hasCode ? (
                        <div className="shrink-0 sm:max-w-[220px]">
                          <AccessCodeDisplay
                            variant="inline"
                            code={item.credential!.code}
                            status={item.credential!.status}
                            isActive={codeIsActive}
                            copyContext={{
                              propertyType: item.propertyType,
                              propertyName: item.propertyName,
                              unitNumber: item.propertyUnitNumber,
                              checkIn: item.checkIn,
                              checkOut: item.checkOut,
                              checkInTime: item.checkInTime,
                              checkOutTime: item.checkOutTime,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {canManage ? (
                        <>
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
                              Aprobar
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
                              Generar
                            </Button>
                          ) : null}

                          {canToggleCode && item.credential ? (
                            item.stage === "generated" ? (
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={pending}
                                onClick={() =>
                                  runAction(() => suspendAccessCodeAction(item.id))
                                }
                              >
                                Desactivar
                              </Button>
                            ) : item.stage === "suspended" ? (
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={pending}
                                onClick={() =>
                                  runAction(() => activateAccessCodeAction(item.id))
                                }
                              >
                                Activar
                              </Button>
                            ) : null
                          ) : null}

                          {canToggleCode && item.credential ? (
                            <Button
                              size="xs"
                              variant="outline"
                              className="border-danger/20 text-danger/70 shadow-none hover:border-danger/30 hover:bg-danger/5 hover:text-danger"
                              disabled={pending}
                              onClick={() =>
                                runAction(() => revokeAccessCodeAction(item.id))
                              }
                            >
                              Revocar
                            </Button>
                          ) : null}
                        </>
                      ) : null}

                      <Button
                        size="xs"
                        variant="outline"
                        className="border-border bg-muted/30 text-foreground shadow-none hover:bg-muted/50"
                        asChild
                      >
                        <Link href={`/reservations?reservation=${item.id}`}>
                          <ClipboardList className="mr-1 h-3.5 w-3.5" />
                          Reserva
                        </Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </ModuleShellFlow>
  );
}

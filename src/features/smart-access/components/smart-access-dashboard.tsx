"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Clock, ClipboardList, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatCalendarUnitDisplay } from "@/features/calendar/lib/property-unit";
import { AccessCodeDisplay } from "@/components/access/access-code-display";
import {
  activateAccessCodeAction,
  adjustAccessWindowAction,
  approveAccessCodeAction,
  generateAccessCodeAction,
  revokeAccessCodeAction,
  suspendAccessCodeAction,
} from "@/features/smart-access/actions/smart-access.actions";
import type { SmartAccessOverview } from "@/services/access/smart-access.service";
import type { OperationalAccessOverview } from "@/services/integrations/ttlock/ttlock-operational-access.service";
import { OperationalAccessPanel } from "@/features/smart-access/components/operational-access-panel";
import { AccessCredentialStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { PageHeader } from "@/components/ui/page-header";
import { getAccessStageBadgeClass } from "@/lib/ui/status-badge-styles";
import { formatDate } from "@/lib/helpers/date";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SmartAccessDashboardProps = {
  data: SmartAccessOverview;
  operationalData: OperationalAccessOverview;
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

function AccessWindowAdjustForm({
  reservationId,
  currentValidFrom,
  currentValidTo,
  disabled,
  onDone,
}: {
  reservationId: string;
  currentValidFrom: string | null;
  currentValidTo: string | null;
  disabled: boolean;
  onDone: (result: { ok: boolean; message: string }) => void;
}) {
  const extractTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const h = d.getUTCHours() - 5;
    const adjH = h < 0 ? h + 24 : h;
    return `${String(adjH).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  };

  const [earlyTime, setEarlyTime] = useState(extractTime(currentValidFrom));
  const [lateTime, setLateTime] = useState(extractTime(currentValidTo));
  const [submitting, startSubmit] = useTransition();

  const handleSubmit = () => {
    const overrides: { earlyCheckInTime?: string; lateCheckOutTime?: string } = {};
    const origEarly = extractTime(currentValidFrom);
    const origLate = extractTime(currentValidTo);
    if (earlyTime && earlyTime !== origEarly) overrides.earlyCheckInTime = earlyTime;
    if (lateTime && lateTime !== origLate) overrides.lateCheckOutTime = lateTime;
    if (!overrides.earlyCheckInTime && !overrides.lateCheckOutTime) return;

    startSubmit(async () => {
      try {
        const result = await adjustAccessWindowAction(reservationId, overrides);
        onDone(result);
      } catch (error) {
        onDone({ ok: false, message: error instanceof Error ? error.message : "Error inesperado" });
      }
    });
  };

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-muted/20 p-2">
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] font-medium text-muted-foreground">Check-in</label>
        <Input
          type="time"
          value={earlyTime}
          onChange={(e) => setEarlyTime(e.target.value)}
          className="h-7 w-28 text-xs"
          disabled={disabled || submitting}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] font-medium text-muted-foreground">Check-out</label>
        <Input
          type="time"
          value={lateTime}
          onChange={(e) => setLateTime(e.target.value)}
          className="h-7 w-28 text-xs"
          disabled={disabled || submitting}
        />
      </div>
      <Button
        size="xs"
        disabled={disabled || submitting}
        onClick={handleSubmit}
        className="h-7"
      >
        {submitting ? "Guardando…" : "Guardar"}
      </Button>
    </div>
  );
}

export function SmartAccessDashboard({
  data,
  operationalData,
  canManage,
}: SmartAccessDashboardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
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
          description="Administra accesos operativos y códigos vinculados a reservas."
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

        <OperationalAccessPanel
          data={operationalData}
          canManage={canManage}
        />

        <div className="mb-3">
          <h2 className="font-semibold text-foreground">
            Accesos de huéspedes
          </h2>
          <p className="text-xs text-muted-foreground">
            Códigos generados desde reservas y Guest Registration.
          </p>
        </div>

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
                            validFrom={item.credential!.validFrom}
                            validTo={item.credential!.validTo}
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

                      {canManage && codeIsActive && item.credential ? (
                        <Button
                          size="xs"
                          variant="outline"
                          className="border-border bg-muted/30 text-foreground shadow-none hover:bg-muted/50"
                          disabled={pending}
                          onClick={() =>
                            setAdjustingId(adjustingId === item.id ? null : item.id)
                          }
                        >
                          <Clock className="mr-1 h-3.5 w-3.5" />
                          Ajustar horario
                        </Button>
                      ) : null}

                      <Button
                        size="xs"
                        variant="outline"
                        className="border-border bg-muted/30 text-foreground shadow-none hover:bg-muted/50"
                        asChild
                      >
                        <Link href={`/calendar?reservation=${item.id}`}>
                          <ClipboardList className="mr-1 h-3.5 w-3.5" />
                          Reserva
                        </Link>
                      </Button>
                    </div>

                    {adjustingId === item.id && item.credential ? (
                      <AccessWindowAdjustForm
                        reservationId={item.id}
                        currentValidFrom={item.credential.validFrom}
                        currentValidTo={item.credential.validTo}
                        disabled={pending}
                        onDone={(result) => {
                          setAdjustingId(null);
                          if (result.ok) {
                            toast.success(result.message);
                            router.refresh();
                          } else {
                            toast.error(result.message);
                          }
                        }}
                      />
                    ) : null}
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

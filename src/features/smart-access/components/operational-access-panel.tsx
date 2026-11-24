"use client";

import { AccessCodeType, AccessCredentialStatus } from "@prisma/client";
import {
  Copy,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createOperationalAccessCodeAction,
  revokeOperationalAccessCodeAction,
} from "@/features/smart-access/actions/operational-access.actions";
import type { OperationalAccessOverview } from "@/services/integrations/ttlock/ttlock-operational-access.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OperationalAccessPanelProps = {
  data: OperationalAccessOverview;
  canManage: boolean;
};

const TYPE_LABELS: Record<AccessCodeType, string> = {
  [AccessCodeType.CLEANER]: "Camarería",
  [AccessCodeType.MAINTENANCE]: "Mantenimiento / técnico",
  [AccessCodeType.OWNER]: "Propietario",
  [AccessCodeType.GUEST]: "Visitante",
};

const STATUS_LABELS: Record<AccessCredentialStatus, string> = {
  [AccessCredentialStatus.PENDING]: "Creando",
  [AccessCredentialStatus.GENERATED]: "Activo",
  [AccessCredentialStatus.SENT]: "Activo",
  [AccessCredentialStatus.ACTIVE]: "Activo",
  [AccessCredentialStatus.SUSPENDED]: "Suspendido",
  [AccessCredentialStatus.EXPIRED]: "Vencido",
  [AccessCredentialStatus.REVOKED]: "Revocado",
};

function formatBogotaDateTimeInput(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}

function makeDefaultWindow(): { from: string; to: string } {
  const now = new Date();
  const rounded = new Date(now);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(Math.ceil(rounded.getMinutes() / 15) * 15);
  const end = new Date(rounded.getTime() + 2 * 60 * 60 * 1000);
  return {
    from: formatBogotaDateTimeInput(rounded),
    to: formatBogotaDateTimeInput(end),
  };
}

function formatBogotaDateTime(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isOperationalCodeActive(status: AccessCredentialStatus): boolean {
  return (
    status === AccessCredentialStatus.GENERATED ||
    status === AccessCredentialStatus.ACTIVE ||
    status === AccessCredentialStatus.SENT ||
    status === AccessCredentialStatus.SUSPENDED
  );
}

export function OperationalAccessPanel({
  data,
  canManage,
}: OperationalAccessPanelProps) {
  const router = useRouter();
  const defaults = useMemo(makeDefaultWindow, []);
  const [propertyId, setPropertyId] = useState(
    data.properties[0]?.id ?? "",
  );
  const [label, setLabel] = useState("");
  const [type, setType] = useState<AccessCodeType>(
    AccessCodeType.MAINTENANCE,
  );
  const [customCode, setCustomCode] = useState("");
  const [validFromLocal, setValidFromLocal] = useState(defaults.from);
  const [validToLocal, setValidToLocal] = useState(defaults.to);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [pending, startTransition] = useTransition();

  function createCode() {
    if (!propertyId || !label.trim()) {
      toast.error("Selecciona una propiedad e indica para quién es el código");
      return;
    }
    const requestKey = idempotencyKey || crypto.randomUUID();
    setIdempotencyKey(requestKey);
    startTransition(async () => {
      try {
        const result = await createOperationalAccessCodeAction({
          propertyId,
          label,
          type,
          validFromLocal,
          validToLocal,
          customCode,
          idempotencyKey: requestKey,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(
          result.code
            ? `Código ${result.code} creado en TTLock`
            : result.message,
        );
        setLabel("");
        setCustomCode("");
        setIdempotencyKey("");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo crear el código",
        );
      }
    });
  }

  function revokeCode(credentialId: string) {
    if (
      !window.confirm(
        "¿Revocar este código? Dejará de funcionar inmediatamente en TTLock.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const result =
          await revokeOperationalAccessCodeAction(credentialId);
        if (result.ok) {
          toast.success(result.message);
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo revocar el código",
        );
      }
    });
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado");
    } catch {
      toast.error("No se pudo copiar el código");
    }
  }

  return (
    <section className="mb-6 space-y-3">
      <div className="flex items-start gap-2">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <ShieldCheck className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">
            Accesos operativos
          </h2>
          <p className="text-xs text-muted-foreground">
            Códigos independientes de reservas para técnicos, camarería y
            visitantes. Horario de Colombia.
          </p>
        </div>
      </div>

      {canManage ? (
        <div className="rounded-xl border border-border bg-card p-3 shadow-pragma-soft">
          {data.properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay propiedades con una cerradura TTLock conectada y
              vinculada.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs font-medium">
                Propiedad
                <select
                  value={propertyId}
                  onChange={(event) => setPropertyId(event.target.value)}
                  disabled={pending}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {data.properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.label}
                      {property.lockAlias
                        ? ` · ${property.lockAlias}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-medium">
                Para quién / motivo
                <Input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Ej. Técnico aire acondicionado"
                  maxLength={50}
                  disabled={pending}
                  className="h-9"
                />
              </label>

              <label className="space-y-1 text-xs font-medium">
                Tipo de acceso
                <select
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as AccessCodeType)
                  }
                  disabled={pending}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {Object.entries(TYPE_LABELS).map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs font-medium">
                Código personalizado (opcional)
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={customCode}
                  onChange={(event) =>
                    setCustomCode(
                      event.target.value.replace(/\D/g, "").slice(0, 9),
                    )
                  }
                  placeholder="Vacío = código aleatorio"
                  minLength={4}
                  maxLength={9}
                  disabled={pending}
                  className="h-9 font-mono tracking-widest"
                />
                <span className="block font-normal text-muted-foreground">
                  Entre 4 y 9 dígitos.
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2 md:col-span-2">
                <label className="space-y-1 text-xs font-medium">
                  Válido desde
                  <Input
                    type="datetime-local"
                    value={validFromLocal}
                    onChange={(event) =>
                      setValidFromLocal(event.target.value)
                    }
                    disabled={pending}
                    className="h-9"
                  />
                </label>
                <label className="space-y-1 text-xs font-medium">
                  Válido hasta
                  <Input
                    type="datetime-local"
                    value={validToLocal}
                    onChange={(event) =>
                      setValidToLocal(event.target.value)
                    }
                    disabled={pending}
                    className="h-9"
                  />
                </label>
              </div>

              <div className="md:col-span-2">
                <Button
                  type="button"
                  onClick={createCode}
                  disabled={pending || !propertyId}
                >
                  <Plus className="h-4 w-4" />
                  {pending ? "Procesando…" : "Crear código en TTLock"}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-pragma-soft">
        {data.credentials.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Aún no hay códigos operativos.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.credentials.map((credential) => {
              const active = isOperationalCodeActive(credential.status);
              return (
                <li
                  key={credential.id}
                  className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {credential.label}
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          active
                            ? "border-success/30 bg-success/10 text-success"
                            : "text-muted-foreground"
                        }
                      >
                        {STATUS_LABELS[credential.status]}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {TYPE_LABELS[credential.type]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {credential.propertyLabel}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {formatBogotaDateTime(credential.validFrom)} –{" "}
                      {formatBogotaDateTime(credential.validTo)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {credential.code ? (
                      <>
                        <div className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 font-mono text-sm font-semibold tracking-widest">
                          <KeyRound className="h-3.5 w-3.5" aria-hidden />
                          {credential.code}
                        </div>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => copyCode(credential.code!)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copiar
                        </Button>
                      </>
                    ) : null}
                    {canManage && active ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="border-danger/20 text-danger/80 hover:bg-danger/5"
                        disabled={pending}
                        onClick={() => revokeCode(credential.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Revocar
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}


"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Cable,
  CircleAlert,
  CircleCheck,
  Clock3,
  Pause,
  Play,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Square,
  Unplug,
} from "lucide-react";
import { ModuleShellFlow } from "@/components/layout/module-shell";
import { cn } from "@/lib/utils";

type OperationMode = "observe" | "manual" | "assisted" | "autonomous";

type DashboardData = {
  config: {
    enabled: boolean;
    paused: boolean;
    mode: string;
    whatsappEnabled: boolean;
    airbnbEnabled: boolean;
    allowedPropertyIds: string[];
    allowedTools: unknown;
    aiEnabled: boolean;
    auditorEnabled: boolean;
  } | null;
  links: Array<{
    id: string;
    status: string;
    version: string | null;
    lastHeartbeatAt: string | null;
    lastSyncAt: string | null;
    lastError: string | null;
    channelStatus: unknown;
    revokedAt: string | null;
  }>;
  /** Frozen clock from the API/SSR payload — avoids Date.now() hydration drift. */
  serverTime?: string;
  conversations: {
    active: number;
    escalated: number;
    completed: number;
    messagesProcessed: number;
    pending: number;
  };
  metrics: {
    deterministic: number;
    llm: number;
    escalations: number;
    errors: number;
    averageResponseMs: number;
  };
  audits: Array<{
    id: string;
    eventType: string;
    result: string;
    toolName: string | null;
    durationMs: number | null;
    createdAt: string;
  }>;
};

type ChromeRuntime = {
  lastError?: { message?: string };
  sendMessage(
    extensionId: string,
    message: unknown,
    callback: (response: unknown) => void,
  ): void;
};

type ExternalResponse = {
  ok?: boolean;
  deviceId?: string;
  version?: string;
  error?: string;
};

function getChromeRuntime(): ChromeRuntime | null {
  const candidate = (
    globalThis as typeof globalThis & {
      chrome?: { runtime?: ChromeRuntime };
    }
  ).chrome?.runtime;
  return candidate ?? null;
}

function sendExternal(
  extensionId: string,
  message: unknown,
): Promise<ExternalResponse> {
  return new Promise((resolve, reject) => {
    const runtime = getChromeRuntime();
    if (!runtime) {
      reject(new Error("Chrome runtime no disponible"));
      return;
    }
    runtime.sendMessage(extensionId, message, (response) => {
      const error = runtime.lastError?.message;
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve((response ?? {}) as ExternalResponse);
    });
  });
}

function modeToRuntime(mode: string | undefined): OperationMode {
  const normalized = (mode ?? "MANUAL").toLowerCase();
  return normalized === "observe" ||
    normalized === "assisted" ||
    normalized === "autonomous"
    ? normalized
    : "manual";
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "Sin registro";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function isRecentlyConnected(
  value: string | null | undefined,
  nowMs: number,
): boolean {
  return Boolean(value && nowMs - new Date(value).getTime() < 90_000);
}

export function AiConciergeDashboard({
  initialDashboard,
  extensionId,
  properties,
  tools,
}: {
  initialDashboard: DashboardData;
  extensionId: string;
  properties: Array<{ id: string; name: string }>;
  tools: Array<{ name: string; description: string; risk: string }>;
}) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [extensionDetected, setExtensionDetected] = useState(false);

  const config = dashboard.config;
  const allowedTools = Array.isArray(config?.allowedTools)
    ? config.allowedTools.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const activeLink = dashboard.links.find(
    (link) => link.status === "ACTIVE" && !link.revokedAt,
  );
  // Use payload clock (SSR + refresh), never Date.now() during render.
  const clockMs = dashboard.serverTime
    ? new Date(dashboard.serverTime).getTime()
    : 0;
  const connected = isRecentlyConnected(activeLink?.lastHeartbeatAt, clockMs);
  const channelConnected = (channel: "whatsapp_web" | "airbnb_web") => {
    if (!activeLink?.channelStatus || typeof activeLink.channelStatus !== "object") {
      return false;
    }
    const value = (
      activeLink.channelStatus as Record<
        string,
        { connected?: unknown; at?: unknown }
      >
    )[channel];
    return (
      value?.connected === true &&
      typeof value.at === "string" &&
      isRecentlyConnected(value.at, clockMs)
    );
  };
  const overallActive = Boolean(config?.enabled && !config?.paused);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/concierge/control", {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as { dashboard: DashboardData };
    setDashboard(data.dashboard);
  }, []);

  const patch = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true);
      setNotice(null);
      try {
        const response = await fetch("/api/concierge/control", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await response.json()) as {
          dashboard?: DashboardData;
          error?: string;
        };
        if (!response.ok || !data.dashboard) {
          throw new Error(data.error ?? `HTTP ${response.status}`);
        }
        setDashboard(data.dashboard);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const connectExtension = useCallback(async () => {
    if (!extensionId) {
      setNotice(
        "NEXT_PUBLIC_CONCIERGE_EXTENSION_ID no está configurado en PRAGMA.",
      );
      return;
    }
    setLinking(true);
    setNotice(null);
    try {
      const discovered = await sendExternal(extensionId, {
        type: "PRAGMA_CONCIERGE_DISCOVER",
      });
      if (!discovered.ok || !discovered.deviceId) {
        throw new Error(discovered.error ?? "Extensión no detectada");
      }
      setExtensionDetected(true);

      const response = await fetch("/api/concierge/link/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId: discovered.deviceId,
          version: discovered.version,
        }),
      });
      const session = (await response.json()) as {
        ok?: boolean;
        kind?: "session" | "pairing";
        token?: string;
        expiresAt?: string;
        pairingToken?: string;
        error?: string;
      };
      if (!response.ok || !session.ok) {
        throw new Error(session.error ?? `HTTP ${response.status}`);
      }

      const apiBase = window.location.origin;
      const linked =
        session.kind === "session"
          ? await sendExternal(extensionId, {
              type: "PRAGMA_CONCIERGE_SESSION",
              payload: {
                apiBase,
                token: session.token,
                expiresAt: session.expiresAt,
              },
            })
          : await sendExternal(extensionId, {
              type: "PRAGMA_CONCIERGE_PAIR",
              payload: {
                apiBase,
                pairingToken: session.pairingToken,
              },
            });
      if (!linked.ok) {
        throw new Error(linked.error ?? "No fue posible vincular la extensión");
      }
      setNotice("Extensión vinculada y autenticada.");
      await refresh();
    } catch (error) {
      setExtensionDetected(false);
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setLinking(false);
    }
  }, [extensionId, refresh]);

  const reconnectChannels = useCallback(async () => {
    if (!extensionId) return;
    try {
      const response = await sendExternal(extensionId, {
        type: "PRAGMA_CONCIERGE_RECONNECT",
      });
      if (!response.ok) throw new Error(response.error ?? "No conectado");
      setNotice("Reconexión de canales solicitada.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, [extensionId]);

  const revokeExtension = useCallback(async () => {
    if (!activeLink) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/concierge/link/${encodeURIComponent(activeLink.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      setNotice("Extensión desvinculada. Las sesiones activas quedaron revocadas.");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [activeLink, refresh]);

  useEffect(() => {
    void connectExtension();
    const id = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(id);
  }, [connectExtension, refresh]);

  const totalResolved = useMemo(
    () =>
      dashboard.metrics.deterministic +
      dashboard.metrics.llm +
      dashboard.metrics.escalations,
    [dashboard.metrics],
  );
  const deterministicRate =
    totalResolved > 0
      ? Math.round((dashboard.metrics.deterministic / totalResolved) * 100)
      : 0;

  return (
    <ModuleShellFlow className="bg-background px-4 py-6 pb-12 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pragma-electric">
              Operación nativa PRAGMA
            </p>
            <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              AI Concierge
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Controla canales, motor, extensión y auditoría sin salir de PRAGMA.
            </p>
          </div>
          <StatusBadge
            active={overallActive}
            label={overallActive ? "Activo" : "Inactivo"}
          />
        </header>

        {notice ? (
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
            {notice}
          </div>
        ) : null}

        <section className="flex flex-wrap gap-2">
          <ActionButton
            icon={Play}
            label="Activar AI"
            disabled={busy || overallActive}
            onClick={() => void patch({ enabled: true, paused: false })}
          />
          <ActionButton
            icon={Square}
            label="Desactivar AI"
            disabled={busy || !config?.enabled}
            onClick={() => void patch({ enabled: false })}
          />
          <ActionButton
            icon={config?.paused ? Play : Pause}
            label={config?.paused ? "Reanudar respuestas" : "Pausar respuestas"}
            disabled={busy || !config?.enabled}
            onClick={() => void patch({ paused: !config?.paused })}
          />
          <ActionButton
            icon={Cable}
            label={linking ? "Conectando…" : "Reconectar extensión"}
            disabled={linking}
            onClick={() => void connectExtension()}
          />
          <ActionButton
            icon={RefreshCw}
            label="Reconectar canales"
            onClick={() => void reconnectChannels()}
          />
          <ActionButton
            icon={Unplug}
            label="Desvincular extensión"
            disabled={busy || !activeLink}
            onClick={() => void revokeExtension()}
          />
          <ActionButton
            icon={ScrollText}
            label="Ver logs"
            onClick={() =>
              document
                .getElementById("concierge-logs")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Estado general"
            value={overallActive ? "Activo" : "Inactivo"}
            detail={config?.paused ? "Respuestas pausadas" : modeToRuntime(config?.mode)}
            good={overallActive}
          />
          <SummaryCard
            title="Extensión"
            value={connected ? "Conectada" : extensionDetected ? "Detectada" : "Sin conexión"}
            detail={`v${activeLink?.version ?? "—"} · ${formatTime(activeLink?.lastHeartbeatAt)}`}
            good={connected}
          />
          <SummaryCard
            title="Motor"
            value="Determinístico activo"
            detail={`Auditor ${config?.auditorEnabled ? "activo" : "inactivo"} · LLM ${config?.aiEnabled ? "habilitado" : "bloqueado"}`}
            good={Boolean(config?.auditorEnabled)}
          />
          <SummaryCard
            title="Tiempo promedio"
            value={`${dashboard.metrics.averageResponseMs} ms`}
            detail={`${dashboard.metrics.errors} errores registrados`}
            good={dashboard.metrics.errors === 0}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
            <h2 className="text-lg font-semibold">Configuración operativa</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium">Modo</span>
                <select
                  value={modeToRuntime(config?.mode)}
                  onChange={(event) =>
                    void patch({ mode: event.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3"
                >
                  <option value="observe">Observe</option>
                  <option value="manual">Manual</option>
                  <option value="assisted">Assisted</option>
                  <option value="autonomous">Autonomous</option>
                </select>
              </label>
              <ToggleRow
                label="Auditor de respuestas"
                checked={Boolean(config?.auditorEnabled)}
                onChange={(checked) => void patch({ auditorEnabled: checked })}
              />
              <ToggleRow
                label="WhatsApp Web"
                checked={Boolean(config?.whatsappEnabled)}
                onChange={(checked) => void patch({ whatsappEnabled: checked })}
              />
              <ToggleRow
                label="Airbnb Web"
                checked={Boolean(config?.airbnbEnabled)}
                onChange={(checked) => void patch({ airbnbEnabled: checked })}
              />
              <ToggleRow
                label="LLM (último recurso)"
                checked={Boolean(config?.aiEnabled)}
                onChange={(checked) => void patch({ aiEnabled: checked })}
              />
            </div>
            <div className="mt-6">
              <p className="text-sm font-medium">Propiedades autorizadas</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sin selección = todas las propiedades del tenant.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {properties.map((property) => {
                  const selected =
                    config?.allowedPropertyIds.includes(property.id) ?? false;
                  return (
                    <label
                      key={property.id}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          const current = config?.allowedPropertyIds ?? [];
                          const next = selected
                            ? current.filter((id) => id !== property.id)
                            : [...current, property.id];
                          void patch({ allowedPropertyIds: next });
                        }}
                      />
                      <span className="truncate">{property.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="mt-6">
              <p className="text-sm font-medium">Herramientas autorizadas</p>
              <p className="mt-1 text-xs text-muted-foreground">
                La allowlist se aplica en servidor antes de invocar cada tool.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {tools.map((tool) => {
                  const allEnabled = allowedTools.length === 0;
                  const selected =
                    allEnabled || allowedTools.includes(tool.name);
                  return (
                    <label
                      key={tool.name}
                      className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          const current = allEnabled
                            ? tools.map((item) => item.name)
                            : allowedTools;
                          const next = selected
                            ? current.filter((name) => name !== tool.name)
                            : [...current, tool.name];
                          void patch({
                            allowedTools:
                              next.length === tools.length ? [] : next,
                          });
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {tool.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {tool.risk} · {tool.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
              <h2 className="text-lg font-semibold">Canales</h2>
              <div className="mt-4 space-y-3">
                <ChannelRow
                  name="WhatsApp"
                  enabled={Boolean(config?.whatsappEnabled)}
                  connected={channelConnected("whatsapp_web")}
                />
                <ChannelRow
                  name="Airbnb"
                  enabled={Boolean(config?.airbnbEnabled)}
                  connected={channelConnected("airbnb_web")}
                />
                <ChannelRow name="Futuros canales" enabled={false} connected={false} />
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
              <h2 className="text-lg font-semibold">Conversaciones</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="Activas" value={dashboard.conversations.active} />
                <Metric label="Escaladas" value={dashboard.conversations.escalated} />
                <Metric label="Finalizadas" value={dashboard.conversations.completed} />
                <Metric label="Pendientes" value={dashboard.conversations.pending} />
                <Metric
                  label="Mensajes procesados"
                  value={dashboard.conversations.messagesProcessed}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
          <h2 className="text-lg font-semibold">Estadísticas</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Determinístico" value={`${deterministicRate}%`} />
            <Metric label="Turnos determinísticos" value={dashboard.metrics.deterministic} />
            <Metric label="LLM" value={dashboard.metrics.llm} />
            <Metric label="Escalamientos" value={dashboard.metrics.escalations} />
            <Metric label="Errores" value={dashboard.metrics.errors} />
          </div>
        </section>

        <section
          id="concierge-logs"
          className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft"
        >
          <h2 className="text-lg font-semibold">Logs y auditoría</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-3">Fecha</th>
                  <th className="pb-3">Evento</th>
                  <th className="pb-3">Resultado</th>
                  <th className="pb-3">Tool</th>
                  <th className="pb-3 text-right">Tiempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dashboard.audits.map((audit) => (
                  <tr key={audit.id}>
                    <td className="py-3 text-muted-foreground">
                      {formatTime(audit.createdAt)}
                    </td>
                    <td className="py-3 font-medium">{audit.eventType}</td>
                    <td className="py-3">{audit.result}</td>
                    <td className="py-3">{audit.toolName ?? "—"}</td>
                    <td className="py-3 text-right">
                      {audit.durationMs === null ? "—" : `${audit.durationMs} ms`}
                    </td>
                  </tr>
                ))}
                {dashboard.audits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Aún no hay eventos para esta organización.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ModuleShellFlow>
  );
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold",
        active
          ? "bg-emerald-500/10 text-emerald-700"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          active ? "bg-emerald-500" : "bg-muted-foreground/60",
        )}
      />
      {label}
    </span>
  );
}

function ActionButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: typeof Play;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function SummaryCard({
  title,
  value,
  detail,
  good,
}: {
  title: string;
  value: string;
  detail: string;
  good: boolean;
}) {
  const Icon = good ? CircleCheck : CircleAlert;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-pragma-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 text-lg font-semibold">{value}</p>
        </div>
        <Icon
          className={cn(
            "h-5 w-5",
            good ? "text-emerald-600" : "text-amber-600",
          )}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}

function ChannelRow({
  name,
  enabled,
  connected,
}: {
  name: string;
  enabled: boolean;
  connected: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">
          {!enabled ? "Desactivado" : connected ? "Conectado" : "Esperando canal"}
        </p>
      </div>
      <StatusBadge
        active={enabled && connected}
        label={enabled && connected ? "Online" : "Offline"}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

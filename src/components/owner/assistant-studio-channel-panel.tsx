"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cable,
  Loader2,
  Power,
  PowerOff,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { cn } from "@/lib/utils";

type OperationMode = "observe" | "manual" | "assisted" | "autonomous";

type DashboardData = {
  config: {
    enabled: boolean;
    paused: boolean;
    mode: string;
    whatsappEnabled: boolean;
    airbnbEnabled: boolean;
    runtimeDesiredOn?: boolean;
    runtimeStatus?: string;
    runtimeLastError?: string | null;
    runtimeWatchdogAt?: string | null;
  } | null;
  links: Array<{
    id: string;
    status: string;
    version: string | null;
    lastHeartbeatAt: string | null;
    lastError: string | null;
    channelStatus: unknown;
  }>;
  serverTime?: string;
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
      reject(
        new Error(
          "Abre este panel en Google Chrome con la extensión PRAGMA instalada.",
        ),
      );
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

function modeToUi(mode: string | undefined): OperationMode {
  const n = (mode ?? "MANUAL").toLowerCase();
  if (
    n === "observe" ||
    n === "manual" ||
    n === "assisted" ||
    n === "autonomous"
  ) {
    return n;
  }
  return "manual";
}

function isRecentlyConnected(
  at: string | null | undefined,
  nowMs: number,
  windowMs = 90_000,
): boolean {
  if (!at) return false;
  const t = Date.parse(at);
  if (Number.isNaN(t)) return false;
  return nowMs - t < windowMs;
}

function channelConnected(
  channelStatus: unknown,
  channel: "whatsapp_web" | "airbnb_web",
  nowMs: number,
): boolean {
  if (!channelStatus || typeof channelStatus !== "object") return false;
  const value = (
    channelStatus as Record<
      string,
      {
        connected?: unknown;
        at?: unknown;
        tabAliveAt?: unknown;
        needs_auth?: unknown;
        network_down?: unknown;
        phone_disconnected?: unknown;
        disconnectReason?: unknown;
      }
    >
  )[channel];
  if (!value || value.connected !== true) return false;
  if (value.needs_auth === true || value.network_down === true) return false;
  if (value.phone_disconnected === true) return false;
  if (channel === "whatsapp_web") {
    const aliveAt =
      typeof value.tabAliveAt === "string" ? value.tabAliveAt : null;
    if (!aliveAt || !isRecentlyConnected(aliveAt, nowMs)) return false;
  }
  return (
    typeof value.at === "string" && isRecentlyConnected(value.at, nowMs)
  );
}

function channelDetail(
  channelStatus: unknown,
  channel: "whatsapp_web" | "airbnb_web",
  nowMs: number,
): string {
  if (!channelStatus || typeof channelStatus !== "object") {
    return channel === "whatsapp_web"
      ? "Abre web.whatsapp.com"
      : "Canal inactivo";
  }
  const value = (
    channelStatus as Record<string, Record<string, unknown>>
  )[channel];
  if (!value) {
    return channel === "whatsapp_web"
      ? "Abre web.whatsapp.com"
      : "Canal inactivo";
  }
  if (value.needs_auth === true) return "Sesión cerrada · escanea QR";
  if (value.phone_disconnected === true) return "Teléfono desconectado";
  if (value.network_down === true) return "Sin internet / PRAGMA";
  if (value.disconnectReason === "no_tab") return "Pestaña WA cerrada";
  if (value.disconnectReason === "tab_discarded") {
    return "Pestaña descartada (Memory Saver)";
  }
  if (value.disconnectReason === "tab_unresponsive") {
    return "Pestaña sin respuesta";
  }
  if (channelConnected(channelStatus, channel, nowMs)) {
    return channel === "whatsapp_web" ? "Pestaña viva" : "Canal vivo";
  }
  return channel === "whatsapp_web"
    ? "Abre web.whatsapp.com"
    : "Canal inactivo";
}

export function AssistantStudioChannelPanel(props: {
  organizationId: string;
  extensionId: string;
}) {
  const { organizationId, extensionId } = props;
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [clockMs, setClockMs] = useState(() => Date.now());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const id = window.setInterval(() => setClockMs(Date.now()), 5_000);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    try {
      const res = await fetch(
        `/api/concierge/control?organizationId=${encodeURIComponent(organizationId)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        dashboard?: DashboardData;
        error?: string;
      };
      if (!res.ok || !data.dashboard) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      if (mountedRef.current) {
        setDashboard(data.dashboard);
        setError(null);
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "No se pudo cargar el canal");
      }
    }
  }, [organizationId]);

  const tickRuntime = useCallback(async () => {
    if (!organizationId) return;
    try {
      await fetch(
        `/api/concierge/runtime?organizationId=${encodeURIComponent(organizationId)}`,
        { cache: "no-store" },
      );
    } catch {
      // best-effort
    }
  }, [organizationId]);

  const patchControl = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/concierge/control", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ organizationId, ...payload }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          dashboard?: DashboardData;
          error?: string;
        };
        if (!res.ok || !data.dashboard) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setDashboard(data.dashboard);
        setNotice("Configuración del canal actualizada.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar");
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [organizationId],
  );

  const patchRuntime = useCallback(
    async (desiredOn: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/concierge/runtime", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ organizationId, desiredOn }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          dashboard?: DashboardData;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        if (data.dashboard) setDashboard(data.dashboard);
        else await refresh();
        setNotice(
          desiredOn
            ? "Runtime encendido. El bot opera mientras la extensión esté viva."
            : "Runtime apagado. El bot ya no opera de forma autónoma.",
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error de runtime");
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [organizationId, refresh],
  );

  const connectExtension = useCallback(async () => {
    if (!extensionId) {
      setError(
        "Falta NEXT_PUBLIC_CONCIERGE_EXTENSION_ID. Configúralo y reinicia el servidor.",
      );
      return;
    }
    setLinking(true);
    setError(null);
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
          organizationId,
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
      setNotice("Extensión vinculada. Abre WhatsApp Web en esta misma Chrome.");
      await refresh();
    } catch (e) {
      setExtensionDetected(false);
      setError(e instanceof Error ? e.message : "Error al vincular");
      throw e;
    } finally {
      setLinking(false);
    }
  }, [extensionId, organizationId, refresh]);

  const revokeExtension = useCallback(async () => {
    const active = dashboard?.links.find((l) => l.status === "ACTIVE");
    if (!active) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/concierge/link/${encodeURIComponent(active.id)}?organizationId=${encodeURIComponent(organizationId)}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNotice("Extensión desvinculada.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo desvincular");
    } finally {
      setBusy(false);
    }
  }, [dashboard?.links, organizationId, refresh]);

  /** Un clic: modo autónomo + enabled + runtime ON + intentar vincular. */
  const turnBotOn = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await patchControl({
        enabled: true,
        paused: false,
        mode: "autonomous",
        whatsappEnabled: true,
      });
      await patchRuntime(true);
      try {
        await connectExtension();
        setNotice(
          "Bot listo para responder solo. Deja WhatsApp Web abierto en esta Chrome.",
        );
      } catch {
        setNotice(
          "Canal autónomo activado, pero la extensión no se vinculó. Pulsa «Vincular extensión» en Chrome con la extensión instalada.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo encender");
    } finally {
      setBusy(false);
    }
  }, [patchControl, patchRuntime, connectExtension]);

  const turnBotOff = useCallback(async () => {
    setBusy(true);
    try {
      await patchRuntime(false);
      await patchControl({ paused: true });
      setNotice("Bot apagado / pausado. No enviará respuestas automáticas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo apagar");
    } finally {
      setBusy(false);
    }
  }, [patchControl, patchRuntime]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
      void tickRuntime();
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [refresh, tickRuntime]);

  const config = dashboard?.config ?? null;
  const activeLink = dashboard?.links.find((l) => l.status === "ACTIVE");
  const hbOk = isRecentlyConnected(activeLink?.lastHeartbeatAt, clockMs);
  const waOk = channelConnected(
    activeLink?.channelStatus,
    "whatsapp_web",
    clockMs,
  );
  const mode = modeToUi(config?.mode);
  const runtimeOn = Boolean(config?.runtimeDesiredOn);
  const botLive =
    Boolean(config?.enabled) &&
    !config?.paused &&
    mode === "autonomous" &&
    runtimeOn &&
    hbOk;

  const card =
    "rounded-lg border border-border bg-card p-3 space-y-2 text-sm";
  const btn =
    "inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50";
  const btnPrimary =
    "inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm text-background disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
        <div className="text-sm font-medium">Canal y operación</div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Aquí se enciende o apaga el bot real. El Estudio solo define qué dice;
          este panel controla si responde solo por WhatsApp Web + extensión
          Chrome.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusTile
          label="Bot listo"
          ok={botLive}
          detail={botLive ? "Respondiendo solo" : "No autónomo aún"}
        />
        <StatusTile
          label="Runtime"
          ok={runtimeOn}
          detail={
            runtimeOn
              ? String(config?.runtimeStatus ?? "ON")
              : "Apagado"
          }
        />
        <StatusTile
          label="Extensión"
          ok={hbOk}
          detail={
            hbOk
              ? "Heartbeat OK"
              : extensionDetected
                ? "Detectada · sin heartbeat"
                : "Sin vínculo"
          }
        />
        <StatusTile
          label="WhatsApp Web"
          ok={waOk}
          detail={channelDetail(
            activeLink?.channelStatus,
            "whatsapp_web",
            clockMs,
          )}
        />
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Host dedicado (bridge)</p>
        <p>
          El bot opera mientras el PC esté despierto, Chrome abierto y la
          pestaña de WhatsApp Web viva. No es Cloud API: Runtime ON no garantiza
          100% uptime.
        </p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Desactivar suspensión / hibernación en este PC</li>
          <li>Desactivar Memory Saver para web.whatsapp.com</li>
          <li>Una sola pestaña de WhatsApp Web</li>
          <li>Extensión v1.0.19+ recargada tras actualizar</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnPrimary}
          disabled={busy || linking}
          onClick={() => void turnBotOn()}
        >
          {busy || linking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Power className="h-4 w-4" />
          )}
          Encender bot (autónomo)
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy}
          onClick={() => void turnBotOff()}
        >
          <PowerOff className="h-4 w-4" />
          Apagar bot
        </button>
        <button
          type="button"
          className={btn}
          disabled={linking || !extensionId}
          onClick={() => void connectExtension()}
        >
          {linking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Cable className="h-4 w-4" />
          )}
          Vincular extensión
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy || !activeLink}
          onClick={() => void revokeExtension()}
        >
          <Unplug className="h-4 w-4" />
          Desvincular
        </button>
        <button
          type="button"
          className={btn}
          disabled={busy}
          onClick={() => {
            void refresh();
            void tickRuntime();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      {notice && (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className={card}>
        <div className="font-medium">Modo de respuesta</div>
        <p className="text-xs text-muted-foreground">
          Solo <strong>Autónomo</strong> envía mensajes solo. Los demás modos
          calculan respuesta pero no la mandan por WhatsApp.
        </p>
        <select
          className="mt-2 w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm"
          value={mode}
          disabled={busy}
          onChange={(e) =>
            void patchControl({ mode: e.target.value as OperationMode })
          }
        >
          <option value="observe">Observar (no responde)</option>
          <option value="manual">Manual (no envía solo)</option>
          <option value="assisted">Asistido (no envía solo)</option>
          <option value="autonomous">Autónomo (responde solo)</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={card}>
          <label className="flex items-center justify-between gap-2">
            <span>
              <span className="font-medium">Canal activo</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                enabled / paused
              </span>
            </span>
            <input
              type="checkbox"
              checked={Boolean(config?.enabled) && !config?.paused}
              disabled={busy}
              onChange={(e) =>
                void patchControl(
                  e.target.checked
                    ? { enabled: true, paused: false }
                    : { paused: true },
                )
              }
            />
          </label>
        </div>
        <div className={card}>
          <label className="flex items-center justify-between gap-2">
            <span>
              <span className="font-medium">WhatsApp</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Permite el canal whatsapp_web
              </span>
            </span>
            <input
              type="checkbox"
              checked={Boolean(config?.whatsappEnabled ?? true)}
              disabled={busy}
              onChange={(e) =>
                void patchControl({ whatsappEnabled: e.target.checked })
              }
            />
          </label>
        </div>
        <div className={card}>
          <label className="flex items-center justify-between gap-2">
            <span>
              <span className="font-medium">Runtime deseado</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Interruptor de operación continua
              </span>
            </span>
            <input
              type="checkbox"
              checked={runtimeOn}
              disabled={busy}
              onChange={(e) => void patchRuntime(e.target.checked)}
            />
          </label>
        </div>
        <div className={card}>
          <label className="flex items-center justify-between gap-2">
            <span>
              <span className="font-medium">Airbnb Web</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Canal opcional
              </span>
            </span>
            <input
              type="checkbox"
              checked={Boolean(config?.airbnbEnabled)}
              disabled={busy}
              onChange={(e) =>
                void patchControl({ airbnbEnabled: e.target.checked })
              }
            />
          </label>
        </div>
      </div>

      <div className={card}>
        <div className="font-medium">Checklist para prueba con celular</div>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
          <li>
            Chrome con extensión cargada desde{" "}
            <code className="rounded bg-muted px-1">extensions/pragma-ai-concierge</code>
          </li>
          <li>WhatsApp Web con la cuenta del negocio en esta misma Chrome</li>
          <li>
            Pulsa <strong>Encender bot (autónomo)</strong> y confirma los 4
            indicadores en verde
          </li>
          <li>
            Desde el celular ajeno escribe al número del negocio (ej. «Hola»)
          </li>
          <li>
            Publica el playbook en Studio si quieres textos personalizados
            (si no, usa defaults)
          </li>
        </ol>
        {!extensionId && (
          <p className="mt-2 text-xs text-destructive">
            Variable NEXT_PUBLIC_CONCIERGE_EXTENSION_ID ausente.
          </p>
        )}
        {activeLink?.lastError && (
          <p className="mt-2 text-xs text-destructive">
            Último error extensión: {activeLink.lastError}
          </p>
        )}
        {config?.runtimeLastError && (
          <p className="mt-2 text-xs text-destructive">
            Runtime: {config.runtimeLastError}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusTile(props: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm",
        props.ok
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-border bg-card",
      )}
    >
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="mt-1 font-medium">{props.ok ? "OK" : "Pendiente"}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{props.detail}</div>
    </div>
  );
}

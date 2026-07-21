"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ACTIONS,
  DEFAULT_INSTRUCTIONS,
  DEFAULT_MESSAGES,
  DEFAULT_PROTOCOLS,
  SYSTEM_RULES,
  newId,
  type StudioAction,
  type StudioInstruction,
  type StudioMessage,
  type StudioProtocol,
  type StudioRule,
} from "@/modules/assistant-platform/studio/studio-model";
import type {
  AssistantGuardRailsConfig,
  AssistantIdentityConfig,
  AssistantMessageTemplates,
  AssistantPromptConfig,
} from "@/modules/assistant-platform/types";
import {
  MessagePreview,
  readStudioJson,
} from "@/components/owner/assistant-studio-ops-panels";
import { AssistantStudioChannelPanel } from "@/components/owner/assistant-studio-channel-panel";
import {
  DEFAULT_RECEPTION_MENU,
  RECEPTION_SYSTEM_VARIABLES,
  buildDefaultReceptionWorkflows,
  type ReceptionMenuItem,
  type ReceptionWorkflow,
} from "@/modules/digital-receptionist";

type StudioTab =
  | "channel"
  | "identity"
  | "menu"
  | "messages"
  | "workflows"
  | "variables"
  | "actions";

type OrgRow = { id: string; name: string };

type VersionRow = {
  id: string;
  version: number;
  label: string | null;
  publishedAt: string | null;
  createdAt: string;
};

const TABS: Array<{ id: StudioTab; label: string; hint: string }> = [
  {
    id: "channel",
    label: "Panel",
    hint: "Activar recepcionista, estado de WhatsApp y conector.",
  },
  {
    id: "identity",
    label: "Bienvenida",
    hint: "Único mensaje inicial (Hola → pide nombre). Fuente de verdad.",
  },
  {
    id: "menu",
    label: "Menú principal",
    hint: "Opciones numeradas; el huésped avanza solo eligiendo 1–6.",
  },
  {
    id: "workflows",
    label: "Workflows",
    hint: "Cada paso = un mensaje configurado. Sin IA inventando textos.",
  },
];

function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-muted-foreground">{children}</p>;
}

function SectionIntro({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <div className="text-sm font-medium">{title}</div>
      <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

export function AssistantStudioView({
  organizations,
  extensionId,
}: {
  organizations: OrgRow[];
  extensionId: string;
}) {
  const [tab, setTab] = useState<StudioTab>("channel");
  const [organizationId, setOrganizationId] = useState(
    organizations[0]?.id ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const [lastVersionId, setLastVersionId] = useState<string | null>(null);
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(
    null,
  );
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [providers, setProviders] = useState<
    Array<{
      providerKey: string;
      displayName: string;
      enabled: boolean;
      configJson?: unknown;
    }>
  >([]);

  const [identity, setIdentity] = useState<AssistantIdentityConfig>({
    displayName: "Asistente Virtual de Recepción",
    presentation: "",
    language: "es",
    tone: "profesional y cálido",
    formality: "warm",
    useEmojis: true,
    signature: "",
    welcomeMessage: "",
    farewellMessage: "",
  });
  const [promptStudio, setPromptStudio] = useState({
    globalBehavior: "",
    objectives: "",
    priorities: "",
    style: "",
    behavior: "",
    restrictions: "",
    escalation: "",
  });
  const [instructions, setInstructions] =
    useState<StudioInstruction[]>(DEFAULT_INSTRUCTIONS);
  const [rules, setRules] = useState<StudioRule[]>(SYSTEM_RULES);
  const [protocols, setProtocols] =
    useState<StudioProtocol[]>(DEFAULT_PROTOCOLS);
  const [messages, setMessages] = useState<StudioMessage[]>(DEFAULT_MESSAGES);
  const [actions, setActions] = useState<StudioAction[]>(DEFAULT_ACTIONS);
  const [menuItems, setMenuItems] = useState<ReceptionMenuItem[]>(
    DEFAULT_RECEPTION_MENU,
  );
  const [workflowFlags, setWorkflowFlags] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(DEFAULT_RECEPTION_MENU.map((m) => [m.workflowKey, true])),
  );
  const [workflows, setWorkflows] = useState<ReceptionWorkflow[]>(() =>
    buildDefaultReceptionWorkflows(),
  );
  const [selectedWorkflowKey, setSelectedWorkflowKey] = useState("booking");
  const [articles, setArticles] = useState<
    Array<{ id: string; title: string; category: string; body: string }>
  >([]);
  const [faqTitle, setFaqTitle] = useState("");
  const [faqBody, setFaqBody] = useState("");
  const [bizTitle, setBizTitle] = useState("");
  const [bizBody, setBizBody] = useState("");
  const [templateBodies, setTemplateBodies] = useState<AssistantMessageTemplates>(
    {},
  );

  const load = useCallback(async (orgId: string) => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/owner/assistant-studio?organizationId=${encodeURIComponent(orgId)}`,
      );
      const data = await readStudioJson(res);
      if (!data.ok) throw new Error(String(data.error || "No se pudo cargar"));
      const a = data.assistant as {
        id: string;
        status: string;
        publishedVersionId?: string | null;
        publishedVersion?: {
          id: string;
          version: number;
          identityJson?: unknown;
          promptJson?: unknown;
          guardRailsJson?: unknown;
          messageTemplatesJson?: unknown;
          protocolsJson?: unknown;
        } | null;
        versions?: Array<{
          id: string;
          version?: number;
          identityJson?: unknown;
          promptJson?: unknown;
          guardRailsJson?: unknown;
          messageTemplatesJson?: unknown;
          protocolsJson?: unknown;
        }>;
        articles?: Array<{
          id: string;
          title: string;
          category: string;
          body: string;
        }>;
        providers?: Array<{
          providerKey: string;
          displayName: string;
          enabled: boolean;
          configJson?: unknown;
        }>;
      };
      const d = data.defaults as {
        identity: AssistantIdentityConfig;
        prompt: AssistantPromptConfig;
        guardRails: AssistantGuardRailsConfig;
        messages: AssistantMessageTemplates;
        protocols: unknown;
      };
      setAssistantId(a.id);
      setPublishedVersionId(a.publishedVersionId ?? a.publishedVersion?.id ?? null);
      setVersions(
        (
          (data.versions as VersionRow[] | undefined) ?? []
        ).map((v) => ({
          ...v,
          publishedAt: v.publishedAt,
          createdAt: v.createdAt,
        })),
      );
      setProviders(a.providers ?? []);
      const ver = a.publishedVersion || a.versions?.[0];
      const idn = (ver?.identityJson ?? d.identity) as AssistantIdentityConfig;
      const prompt = (ver?.promptJson ?? d.prompt) as AssistantPromptConfig;
      const guards = (ver?.guardRailsJson ??
        d.guardRails) as AssistantGuardRailsConfig;
      const msgs = (ver?.messageTemplatesJson ??
        d.messages) as AssistantMessageTemplates;
      setIdentity({ ...d.identity, ...idn });
      setPromptStudio({
        globalBehavior: prompt.globalBehavior ?? d.prompt.globalBehavior ?? "",
        objectives: prompt.objectives ?? d.prompt.objectives ?? "",
        priorities: prompt.priorities ?? d.prompt.priorities ?? "",
        style: prompt.style ?? d.prompt.style ?? "",
        behavior: prompt.behavior ?? d.prompt.behavior ?? "",
        restrictions: prompt.restrictions ?? d.prompt.restrictions ?? "",
        escalation: prompt.escalation ?? d.prompt.escalation ?? "",
      });
      setInstructions(
        prompt.instructions?.length ? prompt.instructions : DEFAULT_INSTRUCTIONS,
      );
      setRules(guards.rules?.length ? guards.rules : SYSTEM_RULES);
      setTemplateBodies(msgs);
      setMessages(
        DEFAULT_MESSAGES.map((m) => {
          const key = m.key as keyof AssistantMessageTemplates;
          const fromVer = msgs[key]?.trim();
          const fromDefaults = d.messages[key]?.trim();
          return {
            ...m,
            body: fromVer || fromDefaults || m.body,
          };
        }),
      );
      const meta = prompt.studioMeta;
      if (Array.isArray(meta?.protocolsList) && meta.protocolsList.length) {
        setProtocols(meta.protocolsList as StudioProtocol[]);
      } else if (Array.isArray(ver?.protocolsJson)) {
        setProtocols(ver.protocolsJson as StudioProtocol[]);
      } else {
        setProtocols(DEFAULT_PROTOCOLS);
      }
      if (Array.isArray(meta?.actions) && meta.actions.length) {
        setActions(meta.actions as StudioAction[]);
      } else {
        setActions(DEFAULT_ACTIONS);
      }
      const receptionMeta = meta as {
        menuItems?: ReceptionMenuItem[];
        workflowFlags?: Record<string, boolean>;
      } | undefined;
      if (Array.isArray(receptionMeta?.menuItems) && receptionMeta.menuItems.length) {
        setMenuItems(receptionMeta.menuItems);
      } else {
        setMenuItems(DEFAULT_RECEPTION_MENU);
      }
      if (
        receptionMeta?.workflowFlags &&
        typeof receptionMeta.workflowFlags === "object"
      ) {
        setWorkflowFlags({
          ...Object.fromEntries(
            DEFAULT_RECEPTION_MENU.map((m) => [m.workflowKey, true]),
          ),
          ...receptionMeta.workflowFlags,
        });
      }
      const wfMeta = meta as { workflows?: ReceptionWorkflow[] } | undefined;
      if (Array.isArray(wfMeta?.workflows) && wfMeta.workflows.length) {
        setWorkflows(wfMeta.workflows as ReceptionWorkflow[]);
      } else {
        setWorkflows(buildDefaultReceptionWorkflows(orgId));
      }
      setArticles(a.articles ?? []);
      const versionRows = (data.versions as VersionRow[] | undefined) ?? [];
      setLastVersionId(ver?.id ?? versionRows[0]?.id ?? null);
      setStatus(
        a.status === "PUBLISHED"
          ? `Activo (versión ${a.publishedVersion?.version ?? "—"})`
          : a.status === "ARCHIVED"
            ? "Archivado — no responde en producción"
            : "Sin publicar — guarda para activar",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(organizationId);
  }, [organizationId, load]);

  const buildPayload = () => {
    const messageMap: AssistantMessageTemplates = { ...templateBodies };
    for (const m of messages) {
      if (m.enabled && m.body.trim()) {
        messageMap[m.key as keyof AssistantMessageTemplates] = m.body;
      }
    }
    const prompt: AssistantPromptConfig = {
      globalBehavior:
        promptStudio.globalBehavior || identity.presentation || identity.displayName,
      objectives: promptStudio.objectives,
      priorities: promptStudio.priorities,
      style: promptStudio.style,
      behavior: promptStudio.behavior,
      restrictions: promptStudio.restrictions,
      escalation: promptStudio.escalation,
      howToAsk:
        instructions.find((i) => i.id === "ask_info")?.text ??
        DEFAULT_INSTRUCTIONS[2]!.text,
      howToFinish:
        instructions.find((i) => i.id === "close")?.text ??
        DEFAULT_INSTRUCTIONS[4]!.text,
      whenConfused:
        instructions.find((i) => i.id === "confused")?.text ??
        DEFAULT_INSTRUCTIONS[3]!.text,
      whenAmbiguous:
        instructions.find((i) => i.id === "topic_change")?.text ??
        DEFAULT_INSTRUCTIONS[5]!.text,
      instructions,
      studioMeta: {
        protocolsList: protocols,
        actions,
        menuItems,
        workflowFlags,
        workflows,
      },
    };
    const guardRails: AssistantGuardRailsConfig = {
      neverInventFacts: rules.find((r) => r.id === "never_invent")?.enabled ?? true,
      neverConfirmWithoutValidation:
        rules.find((r) => r.id === "never_confirm_without_validation")
          ?.enabled ?? true,
      neverCrossSessionContext:
        rules.find((r) => r.id === "never_cross_session")?.enabled ?? true,
      neverMultiSend:
        rules.find((r) => r.id === "never_duplicate_messages")?.enabled ?? true,
      neverDoubleReply:
        rules.find((r) => r.id === "never_double_reply")?.enabled ?? true,
      neverCreateFakeReservations:
        rules.find((r) => r.id === "never_fake_reservation")?.enabled ?? true,
      neverSwitchWorkflowWithoutAuth:
        rules.find((r) => r.id === "never_action_without_confirm")?.enabled ??
        true,
      extraRules: rules
        .filter((r) => r.enabled && !r.system)
        .map((r) => r.title),
      rules,
    };
    const protocolsMap = Object.fromEntries(
      protocols
        .filter((p) => p.enabled)
        .map((p) => [
          p.id,
          {
            objective: p.objective,
            finishWhen: p.finishWhen,
            escalateWhen: p.escalateWhen,
            messagesByStep: {},
          },
        ]),
    );
    return {
      identity,
      prompt,
      guardRails,
      messages: messageMap,
      protocols: protocolsMap,
    };
  };

  const save = async () => {
    if (!assistantId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      const res = await fetch("/api/owner/assistant-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          assistantId,
          identity: payload.identity,
          prompt: payload.prompt,
          guardRails: payload.guardRails,
          messages: payload.messages,
          protocols: payload.protocols,
        }),
      });
      const data = await readStudioJson(res);
      if (!data.ok) throw new Error(String(data.error || "No se pudo guardar"));
      const version = data.version as { id: string; version: number };
      const assistant = data.assistant as { publishedVersionId?: string | null };
      setLastVersionId(version.id);
      setPublishedVersionId(
        assistant?.publishedVersionId ?? version.id,
      );
      setStatus(`Guardado y activo (versión ${version.version})`);
      await load(organizationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    await save();
  };

  const publish = async (versionId?: string) => {
    const target = versionId ?? lastVersionId;
    if (!assistantId || !target) {
      setError("Primero guarda un borrador");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/assistant-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          assistantId,
          versionId: target,
        }),
      });
      const data = await readStudioJson(res);
      if (!data.ok) throw new Error(String(data.error || "No se pudo publicar"));
      setStatus("Publicado: el asistente ya usa esta configuración");
      await load(organizationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al publicar");
    } finally {
      setSaving(false);
    }
  };

  const restore = async (versionId: string) => {
    if (!assistantId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/assistant-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          assistantId,
          versionId,
        }),
      });
      const data = await readStudioJson(res);
      if (!data.ok) throw new Error(String(data.error || "No se pudo restaurar"));
      const version = data.version as { id: string; version: number };
      setLastVersionId(version.id);
      setStatus(`Restaurado como borrador v${version.version}`);
      await load(organizationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al restaurar");
    } finally {
      setSaving(false);
    }
  };

  const saveArticle = async (
    category: string,
    title: string,
    body: string,
    clear: () => void,
  ) => {
    if (!assistantId || !title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/owner/assistant-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert_article",
          assistantId,
          article: { category, title: title.trim(), body: body.trim() },
        }),
      });
      const data = await readStudioJson(res);
      if (!data.ok) throw new Error(String(data.error || "No se pudo guardar"));
      clear();
      await load(organizationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const deleteArticle = async (articleId: string) => {
    if (!assistantId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/owner/assistant-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_article",
          assistantId,
          articleId,
        }),
      });
      const data = await readStudioJson(res);
      if (!data.ok) throw new Error(String(data.error || "No se pudo eliminar"));
      await load(organizationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
  const cardCls = "rounded-lg border border-border bg-card p-3 space-y-2";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" />
            <Link href="/owner-dashboard" className="hover:underline">
              Owner
            </Link>
            <span>/</span>
            <span>Recepcionista Digital</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Recepcionista Digital
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Empleado digital para WhatsApp: saluda, pregunta, ejecuta procedimientos
            y escala a humano. Sin prompts abiertos — solo workflows.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="org-select">
            Organización
          </label>
          <select
            id="org-select"
            className={inputCls}
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm text-background"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar
          </button>
        </div>
      </div>

      {status && (
        <div className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          {status}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.hint}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium",
              tab === t.id
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        {tab === "channel" ? (
          <AssistantStudioChannelPanel
            organizationId={organizationId}
            extensionId={extensionId}
          />
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando configuración…
          </div>
        ) : (
          <>
            {tab === "identity" && (
              <div className="space-y-4">
                <SectionIntro
                  title="Bienvenida"
                  text="Mensaje inicial del recepcionista digital. Al guardar queda activo en WhatsApp."
                />
                <div>
                  <label className="text-sm font-medium">Nombre del recepcionista</label>
                  <FieldHelp>
                    Nombre corto que verás en reportes y configuración.
                  </FieldHelp>
                  <input
                    className={cn(inputCls, "mt-1")}
                    value={identity.displayName}
                    onChange={(e) =>
                      setIdentity({ ...identity, displayName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Cargo mostrado</label>
                  <FieldHelp>
                    Frase con la que se presenta (ej. Asistente Virtual de
                    Recepción).
                  </FieldHelp>
                  <textarea
                    className={cn(inputCls, "mt-1")}
                    rows={2}
                    value={identity.presentation}
                    onChange={(e) =>
                      setIdentity({ ...identity, presentation: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Idioma</label>
                    <FieldHelp>Idioma por defecto de las respuestas.</FieldHelp>
                    <select
                      className={cn(inputCls, "mt-1")}
                      value={identity.language}
                      onChange={(e) =>
                        setIdentity({ ...identity, language: e.target.value })
                      }
                    >
                      <option value="es">Español</option>
                      <option value="en">Inglés</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Formalidad</label>
                    <FieldHelp>
                      Influye en el estilo (usted / tono cercano).
                    </FieldHelp>
                    <select
                      className={cn(inputCls, "mt-1")}
                      value={identity.formality}
                      onChange={(e) =>
                        setIdentity({
                          ...identity,
                          formality: e.target
                            .value as AssistantIdentityConfig["formality"],
                        })
                      }
                    >
                      <option value="formal">Formal</option>
                      <option value="neutral">Neutro</option>
                      <option value="warm">Cálido</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Tono</label>
                  <FieldHelp>
                    Descripción libre del estilo (ej. profesional, breve,
                    amable).
                  </FieldHelp>
                  <input
                    className={cn(inputCls, "mt-1")}
                    value={identity.tone}
                    onChange={(e) =>
                      setIdentity({ ...identity, tone: e.target.value })
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={identity.useEmojis}
                    onChange={(e) =>
                      setIdentity({ ...identity, useEmojis: e.target.checked })
                    }
                  />
                  Permitir emojis en mensajes de bienvenida
                </label>
                <div>
                  <label className="text-sm font-medium">
                    Mensaje de bienvenida (opcional)
                  </label>
                  <FieldHelp>
                    Si lo completas, sustituye la plantilla «Saludo y solicitud
                    de nombre» al guardar. Variables: {"{{nombre}}"}{" "}
                    {"{{propiedad}}"}.
                  </FieldHelp>
                  <textarea
                    className={cn(inputCls, "mt-1")}
                    rows={3}
                    value={identity.welcomeMessage}
                    onChange={(e) =>
                      setIdentity({
                        ...identity,
                        welcomeMessage: e.target.value,
                      })
                    }
                  />
                  <div className="mt-2">
                    <MessagePreview body={identity.welcomeMessage} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Mensaje de despedida</label>
                  <FieldHelp>
                    Texto de cierre cuando la conversación termina con éxito.
                  </FieldHelp>
                  <input
                    className={cn(inputCls, "mt-1")}
                    value={identity.farewellMessage}
                    onChange={(e) =>
                      setIdentity({
                        ...identity,
                        farewellMessage: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            )}

            {tab === "menu" && (
              <div className="space-y-3">
                <SectionIntro
                  title="Menú principal"
                  text="Opciones numeradas que el huésped ve tras la bienvenida. Cada opción abre un workflow."
                />
                {menuItems.map((item, idx) => (
                  <div key={item.id} className={cardCls}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-lg">{item.icon}</span>
                      <input
                        className={cn(inputCls, "max-w-md flex-1")}
                        value={item.label}
                        onChange={(e) => {
                          const next = [...menuItems];
                          next[idx] = { ...item, label: e.target.value };
                          setMenuItems(next);
                        }}
                      />
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(e) => {
                            const next = [...menuItems];
                            next[idx] = { ...item, enabled: e.target.checked };
                            setMenuItems(next);
                          }}
                        />
                        Activo
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Workflow: {item.workflowKey} · Orden {item.n}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {tab === "workflows" && (
              <div className="space-y-3">
                <SectionIntro
                  title="Workflows"
                  text="Procedimientos deterministas por nodos. Edita el mensaje de cada paso y activa/desactiva el flujo. Al guardar, WhatsApp usa este motor (sin prompts abiertos)."
                />
                <div className="flex flex-wrap gap-2">
                  {workflows.map((w) => (
                    <button
                      key={w.key}
                      type="button"
                      onClick={() => setSelectedWorkflowKey(w.key)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium",
                        selectedWorkflowKey === w.key
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {w.name}
                    </button>
                  ))}
                </div>
                {workflows
                  .filter((w) => w.key === selectedWorkflowKey)
                  .map((w) => (
                    <div key={w.id} className="space-y-3">
                      <div className={cardCls}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{w.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {w.description} · {w.nodes.length} nodos
                            </div>
                          </div>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={workflowFlags[w.key] !== false}
                              onChange={(e) =>
                                setWorkflowFlags({
                                  ...workflowFlags,
                                  [w.key]: e.target.checked,
                                })
                              }
                            />
                            Activo
                          </label>
                        </div>
                      </div>
                      {w.nodes.map((node, nIdx) => (
                        <div key={node.id} className={cardCls}>
                          <div className="text-xs font-medium text-muted-foreground">
                            {node.type.toUpperCase()} · {node.name} · {node.id}
                          </div>
                          <textarea
                            className={inputCls}
                            rows={3}
                            value={node.message}
                            onChange={(e) => {
                              setWorkflows((prev) =>
                                prev.map((wf) => {
                                  if (wf.key !== w.key) return wf;
                                  const nodes = [...wf.nodes];
                                  nodes[nIdx] = {
                                    ...node,
                                    message: e.target.value,
                                  };
                                  return { ...wf, nodes };
                                }),
                              );
                            }}
                          />
                          {node.action ? (
                            <p className="text-xs text-muted-foreground">
                              Acción: {node.action}
                            </p>
                          ) : null}
                          {node.nextNodeId ? (
                            <p className="text-xs text-muted-foreground">
                              Siguiente: {node.nextNodeId}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            )}

            {tab === "variables" && (
              <div className="space-y-3">
                <SectionIntro
                  title="Variables del sistema"
                  text="Úsalas en mensajes como {{nombre}}. El motor las rellena desde la conversación y el PMS."
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {RECEPTION_SYSTEM_VARIABLES.map((v) => (
                    <div key={v} className={cardCls}>
                      <code className="text-sm">{"{{" + v + "}}"}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "messages" && (
              <div className="space-y-3">
                <SectionIntro
                  title="Biblioteca de mensajes"
                  text="Textos que el bot envía al huésped. Al guardar, quedan activos de inmediato."
                />
                <p className="text-xs text-muted-foreground">
                  Variables: {"{{nombre}}"} {"{{propiedad}}"}{" "}
                  {"{{fecha_entrada}}"} {"{{fecha_salida}}"} {"{{total}}"}{" "}
                  {"{{guestName}}"} {"{{menuLines}}"}
                </p>
                {messages.map((m, idx) => (
                  <div key={m.id} className={cardCls}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{m.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {m.category} · {m.description}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          onChange={(e) => {
                            const next = [...messages];
                            next[idx] = { ...m, enabled: e.target.checked };
                            setMessages(next);
                          }}
                        />
                        Activo
                      </label>
                    </div>
                    <textarea
                      className={inputCls}
                      rows={4}
                      placeholder="Escribe el mensaje que verá el huésped…"
                      value={m.body}
                      onChange={(e) => {
                        const next = [...messages];
                        next[idx] = { ...m, body: e.target.value };
                        setMessages(next);
                      }}
                    />
                    <MessagePreview body={m.body} />
                  </div>
                ))}
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  onClick={() =>
                    setMessages([
                      ...messages,
                      {
                        id: newId("msg"),
                        key: newId("custom"),
                        category: "Personalizado",
                        title: "Nuevo mensaje",
                        description: "Indica cuándo se utilizará.",
                        body: "",
                        enabled: true,
                      },
                    ])
                  }
                >
                  <Plus className="h-4 w-4" /> Añadir mensaje
                </button>
              </div>
            )}

            {tab === "actions" && (
              <div className="space-y-3">
                <SectionIntro
                  title="Acciones del sistema"
                  text="Operaciones que el recepcionista puede ejecutar (reserva, incidencia, transferir). Documentación operativa; el motor las invocará desde nodos de workflow."
                />
                {actions.map((a, idx) => (
                  <div key={a.id} className={cardCls}>
                    <div className="flex items-center justify-between">
                      <input
                        className={cn(inputCls, "max-w-sm font-medium")}
                        value={a.name}
                        onChange={(e) => {
                          const next = [...actions];
                          next[idx] = { ...a, name: e.target.value };
                          setActions(next);
                        }}
                      />
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={a.enabled}
                          onChange={(e) => {
                            const next = [...actions];
                            next[idx] = { ...a, enabled: e.target.checked };
                            setActions(next);
                          }}
                        />
                        Activa
                      </label>
                    </div>
                    {(
                      [
                        ["description", "Descripción"],
                        ["when", "Cuándo se ejecuta"],
                        ["needs", "Información que necesita"],
                        ["expects", "Resultado esperado"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <label className="text-xs font-medium">{label}</label>
                        <textarea
                          className={cn(inputCls, "mt-0.5")}
                          rows={2}
                          value={a[key]}
                          onChange={(e) => {
                            const next = [...actions];
                            next[idx] = { ...a, [key]: e.target.value };
                            setActions(next);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ))}
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  onClick={() =>
                    setActions([
                      ...actions,
                      {
                        id: newId("act"),
                        name: "Nueva acción",
                        description: "",
                        when: "",
                        needs: "",
                        expects: "",
                        enabled: true,
                      },
                    ])
                  }
                >
                  <Plus className="h-4 w-4" /> Añadir acción
                </button>
              </div>
            )}

                      </>
        )}
      </div>
    </div>
  );
}

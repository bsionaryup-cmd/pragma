/**
 * Owner Studio service — ensure Concierge assistant + CRUD playbook versions.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  buildDefaultPlaybook,
  DEFAULT_GUARD_RAILS,
  DEFAULT_IDENTITY,
  DEFAULT_PROMPT,
  DEFAULT_PROTOCOLS,
  defaultMessageTemplates,
} from "@/modules/assistant-platform/defaults/concierge-defaults";
import {
  CONCIERGE_SLUG,
  resolveAssistantPlaybook,
  resolvePlaybookFromVersionId,
} from "@/modules/assistant-platform/resolve-playbook";
import { PRAGMA_PMS_PROVIDER_META } from "@/modules/assistant-platform/knowledge/provider";
import { pragmaPmsKnowledgeProvider } from "@/modules/assistant-platform/knowledge/pragma-pms-provider";
import type {
  AssistantGuardRailsConfig,
  AssistantIdentityConfig,
  AssistantMessageTemplates,
  AssistantPromptConfig,
  AssistantProtocolsConfig,
} from "@/modules/assistant-platform/types";

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function ensureConciergeAssistant(organizationId: string) {
  const existing = await db.assistantDefinition.findFirst({
    where: { organizationId, slug: CONCIERGE_SLUG },
    include: {
      publishedVersion: true,
      versions: { orderBy: { version: "desc" }, take: 5 },
      articles: { orderBy: [{ sortOrder: "asc" }, { title: "asc" }], take: 50 },
      providers: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (existing) return existing;

  const created = await db.assistantDefinition.create({
    data: {
      organizationId,
      slug: CONCIERGE_SLUG,
      name: "PRAGMA Concierge",
      description:
        "Asistente de hospitalidad (primer asistente de Assistant Platform).",
      status: "DRAFT",
      versions: {
        create: {
          version: 1,
          label: "defaults-from-code",
          identityJson: asJson(DEFAULT_IDENTITY),
          promptJson: asJson(DEFAULT_PROMPT),
          guardRailsJson: asJson(DEFAULT_GUARD_RAILS),
          messageTemplatesJson: asJson(defaultMessageTemplates()),
          protocolsJson: asJson(DEFAULT_PROTOCOLS),
          publishedAt: new Date(),
        },
      },
      providers: {
        create: {
          providerKey: PRAGMA_PMS_PROVIDER_META.key,
          displayName: PRAGMA_PMS_PROVIDER_META.displayName,
          enabled: true,
          configJson: asJson({
            description: PRAGMA_PMS_PROVIDER_META.description,
            capabilities: PRAGMA_PMS_PROVIDER_META.capabilities,
          }),
          sortOrder: 0,
        },
      },
    },
    include: {
      publishedVersion: true,
      versions: { orderBy: { version: "desc" }, take: 5 },
      articles: { orderBy: [{ sortOrder: "asc" }, { title: "asc" }], take: 50 },
      providers: { orderBy: { sortOrder: "asc" } },
    },
  });

  const v1 = created.versions[0];
  if (!v1) return created;

  return db.assistantDefinition.update({
    where: { id: created.id },
    data: {
      status: "PUBLISHED",
      publishedVersionId: v1.id,
    },
    include: {
      publishedVersion: true,
      versions: { orderBy: { version: "desc" }, take: 5 },
      articles: { orderBy: [{ sortOrder: "asc" }, { title: "asc" }], take: 50 },
      providers: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function listOwnerAssistants() {
  return db.assistantDefinition.findMany({
    where: { organizationId: { not: null } },
    orderBy: { updatedAt: "desc" },
    include: {
      organization: { select: { id: true, name: true } },
      publishedVersion: { select: { id: true, version: true, publishedAt: true } },
    },
    take: 100,
  });
}

export async function savePlaybookDraft(input: {
  assistantId: string;
  createdById?: string | null;
  identity: AssistantIdentityConfig;
  prompt: AssistantPromptConfig;
  guardRails: AssistantGuardRailsConfig;
  messages: AssistantMessageTemplates;
  protocols: AssistantProtocolsConfig;
  label?: string;
}) {
  const latest = await db.assistantPlaybookVersion.findFirst({
    where: { assistantId: input.assistantId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;
  return db.assistantPlaybookVersion.create({
    data: {
      assistantId: input.assistantId,
      version: nextVersion,
      label: input.label ?? `draft-v${nextVersion}`,
      identityJson: asJson(input.identity),
      promptJson: asJson(input.prompt),
      guardRailsJson: asJson(input.guardRails),
      messageTemplatesJson: asJson(input.messages),
      protocolsJson: asJson(input.protocols),
      createdById: input.createdById ?? null,
    },
  });
}

/** Guardar y publicar en un paso — lo que el Owner edita queda activo al instante. */
export async function saveAndPublishPlaybook(input: {
  assistantId: string;
  createdById?: string | null;
  identity: AssistantIdentityConfig;
  prompt: AssistantPromptConfig;
  guardRails: AssistantGuardRailsConfig;
  messages: AssistantMessageTemplates;
  protocols: AssistantProtocolsConfig;
  label?: string;
}) {
  const version = await savePlaybookDraft({
    ...input,
    label: input.label ?? "saved",
  });
  const assistant = await publishPlaybookVersion({
    assistantId: input.assistantId,
    versionId: version.id,
  });
  return { version, assistant };
}

export async function publishPlaybookVersion(input: {
  assistantId: string;
  versionId: string;
}) {
  const ver = await db.assistantPlaybookVersion.findFirst({
    where: { id: input.versionId, assistantId: input.assistantId },
  });
  if (!ver) throw new Error("VERSION_NOT_FOUND");

  const validation = validatePlaybookForPublish({
    identity: ver.identityJson,
    messages: ver.messageTemplatesJson,
    guardRails: ver.guardRailsJson,
  });
  if (!validation.ok) {
    throw new Error(`PUBLISH_BLOCKED:${validation.errors.join("|")}`);
  }

  await db.assistantPlaybookVersion.update({
    where: { id: ver.id },
    data: { publishedAt: new Date() },
  });

  return db.assistantDefinition.update({
    where: { id: input.assistantId },
    data: {
      status: "PUBLISHED",
      publishedVersionId: ver.id,
    },
    include: { publishedVersion: true },
  });
}

export function validatePlaybookForPublish(input: {
  identity: unknown;
  messages: unknown;
  guardRails: unknown;
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const identity = (input.identity ?? {}) as Record<string, unknown>;
  if (
    typeof identity.displayName !== "string" ||
    !identity.displayName.trim()
  ) {
    errors.push("Falta el nombre del asistente");
  }
  const guards = (input.guardRails ?? {}) as Record<string, unknown>;
  if (guards.neverInventFacts === false) {
    errors.push(
      "La regla «Nunca inventar información» no puede desactivarse para publicar",
    );
  }
  return { ok: errors.length === 0, errors };
}

export async function listPlaybookVersions(assistantId: string) {
  return db.assistantPlaybookVersion.findMany({
    where: { assistantId },
    orderBy: { version: "desc" },
    take: 40,
    select: {
      id: true,
      version: true,
      label: true,
      publishedAt: true,
      createdAt: true,
      createdById: true,
    },
  });
}

export async function restorePlaybookVersion(input: {
  assistantId: string;
  versionId: string;
  createdById?: string | null;
}) {
  const source = await db.assistantPlaybookVersion.findFirst({
    where: { id: input.versionId, assistantId: input.assistantId },
  });
  if (!source) throw new Error("VERSION_NOT_FOUND");
  const draft = await savePlaybookDraft({
    assistantId: input.assistantId,
    createdById: input.createdById,
    identity: source.identityJson as never,
    prompt: source.promptJson as never,
    guardRails: source.guardRailsJson as never,
    messages: source.messageTemplatesJson as never,
    protocols: source.protocolsJson as never,
    label: `restore-from-v${source.version}`,
  });
  return draft;
}

export async function archiveAssistant(assistantId: string) {
  return db.assistantDefinition.update({
    where: { id: assistantId },
    data: { status: "ARCHIVED" },
  });
}

export async function deleteKnowledgeArticle(input: {
  assistantId: string;
  articleId: string;
}) {
  return db.assistantKnowledgeArticle.deleteMany({
    where: { id: input.articleId, assistantId: input.assistantId },
  });
}

export async function upsertKnowledgeArticle(input: {
  assistantId: string;
  id?: string;
  category: string;
  title: string;
  body: string;
  tags?: string[];
  propertyId?: string | null;
  enabled?: boolean;
  sortOrder?: number;
}) {
  if (input.id) {
    return db.assistantKnowledgeArticle.update({
      where: { id: input.id },
      data: {
        category: input.category,
        title: input.title,
        body: input.body,
        tags: input.tags ?? [],
        propertyId: input.propertyId ?? null,
        enabled: input.enabled ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }
  return db.assistantKnowledgeArticle.create({
    data: {
      assistantId: input.assistantId,
      category: input.category,
      title: input.title,
      body: input.body,
      tags: input.tags ?? [],
      propertyId: input.propertyId ?? null,
      enabled: input.enabled ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function listTrainingThreads(organizationId: string) {
  const rows = await db.conciergeConversationState.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: {
      id: true,
      channel: true,
      threadHash: true,
      status: true,
      recentMessagesJson: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => {
    const recent = Array.isArray(row.recentMessagesJson)
      ? (row.recentMessagesJson as Array<{ role?: string; body?: string; at?: string }>)
      : [];
    return {
      id: row.id,
      channel: row.channel,
      status: row.status,
      updatedAt: row.updatedAt,
      preview: recent
        .slice(-4)
        .map((m) => `${m.role ?? "?"}: ${String(m.body ?? "").slice(0, 80)}`)
        .join("\n"),
      messages: recent.slice(-12),
    };
  });
}

export async function simulateStudioTurn(input: {
  organizationId: string;
  guestMessage: string;
  versionId?: string | null;
}) {
  const playbook = input.versionId
    ? await resolvePlaybookFromVersionId(input.versionId, input.organizationId)
    : await resolveAssistantPlaybook({ organizationId: input.organizationId });

  const knowledgeHits =
    playbook.assistantId != null
      ? await pragmaPmsKnowledgeProvider.search({
          organizationId: input.organizationId,
          assistantId: playbook.assistantId,
          query: input.guestMessage,
          limit: 5,
        })
      : [];

  const { composeConciergeReply } = await import(
    "@/modules/ai-concierge/engine/compose-reply"
  );
  const now = new Date().toISOString();
  const threadId = `studio-sim:${input.organizationId}`;
  const result = await composeConciergeReply({
    conversation: {
      id: `sim-${Date.now()}`,
      organizationId: input.organizationId,
      channel: "whatsapp_web",
      propertyId: null,
      reservationId: null,
      guestLabel: "Simulador",
      messages: [],
      createdAt: now,
      updatedAt: now,
    },
    guestMessage: input.guestMessage,
    threadId,
    mode: "manual",
    playbookOverride: playbook,
    scope: {
      organizationId: input.organizationId,
      userId: "studio-simulator",
    } as never,
  });

  return {
    playbookSource: playbook.source,
    playbookVersion: playbook.version,
    knowledgeHits,
    suggestedReply: result.suggestedReply,
    path: result.observability?.path ?? result.run?.decision?.path ?? null,
    toolsUsed: result.observability?.toolsUsed ?? [],
    activeProtocol:
      typeof result.run?.context?.knownFacts?.activeProtocol === "string"
        ? result.run.context.knownFacts.activeProtocol
        : null,
    decisionReason: result.run?.decision?.reason ?? null,
    guardRailsActive: playbook.guardRails.rules?.filter((r) => r.enabled) ?? [],
    systemPromptPreview: playbook.systemPrompt.slice(0, 500),
  };
}

export function studioDefaultsPayload() {
  const pb = buildDefaultPlaybook();
  return {
    identity: pb.identity,
    prompt: pb.prompt,
    guardRails: pb.guardRails,
    messages: pb.messages,
    protocols: pb.protocols,
  };
}


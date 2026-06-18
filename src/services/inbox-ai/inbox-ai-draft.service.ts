import "server-only";

import {
  InboxAiDraftAuditAction,
  InboxAiDraftStatus,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { assertReservationInScope } from "@/lib/platform/tenant-access";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { buildInboxAiContext } from "@/services/inbox-ai/inbox-context.engine";
import { generateInboxAiDraftText } from "@/services/inbox-ai/inbox-ai-generation.service";
import {
  detectInboxMessageIntent,
  inboxIntentLabel,
} from "@/services/inbox-ai/inbox-intent.service";

export type InboxAiDraftView = {
  id: string;
  reservationId: string;
  guestMessageId: string | null;
  guestMessageBody: string;
  detectedIntent: string;
  intentLabel: string;
  intentConfidence: number | null;
  generatedText: string;
  editedText: string | null;
  displayText: string;
  generationProvider: string;
  generationModel: string | null;
  status: InboxAiDraftStatus;
  createdAt: string;
  updatedAt: string;
};

function toDraftView(row: {
  id: string;
  reservationId: string;
  guestMessageId: string | null;
  guestMessageBody: string;
  detectedIntent: string;
  intentConfidence: { toString(): string } | null;
  generatedText: string;
  editedText: string | null;
  generationProvider: string;
  generationModel: string | null;
  status: InboxAiDraftStatus;
  createdAt: Date;
  updatedAt: Date;
}): InboxAiDraftView {
  return {
    id: row.id,
    reservationId: row.reservationId,
    guestMessageId: row.guestMessageId,
    guestMessageBody: row.guestMessageBody,
    detectedIntent: row.detectedIntent,
    intentLabel: inboxIntentLabel(row.detectedIntent as never),
    intentConfidence: row.intentConfidence
      ? Number(row.intentConfidence.toString())
      : null,
    generatedText: row.generatedText,
    editedText: row.editedText,
    displayText: row.editedText?.trim() || row.generatedText,
    generationProvider: row.generationProvider,
    generationModel: row.generationModel,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildContextSnapshot(context: Awaited<ReturnType<typeof buildInboxAiContext>>) {
  if (!context) return {};
  return {
    version: context.version,
    builtAt: context.builtAt,
    stayStage: context.stayStage,
    knownFacts: context.knownFacts,
    missingFacts: context.missingFacts,
    latestGuestIntent: context.latestGuestIntent,
    knowledgeSectionCount: context.knowledge.sections.length,
  };
}

async function recordDraftAudit(input: {
  draftId: string;
  actorUserId: string;
  action: InboxAiDraftAuditAction;
  payload?: Prisma.InputJsonValue;
}) {
  await db.inboxAiDraftAuditEvent.create({
    data: {
      draftId: input.draftId,
      actorUserId: input.actorUserId,
      action: input.action,
      payload: input.payload,
    },
  });
}

export async function generateInboxAiDraft(input: {
  scope: TenantDataScope;
  organizationId: string;
  actorUserId: string;
  reservationId: string;
  guestMessageId?: string | null;
  guestMessageBody: string;
}): Promise<InboxAiDraftView | null> {
  await assertReservationInScope(input.scope, input.reservationId);

  const context = await buildInboxAiContext(input.scope, input.reservationId);
  if (!context) return null;

  const intentDetection = detectInboxMessageIntent(input.guestMessageBody);
  const generation = await generateInboxAiDraftText({
    context,
    guestMessageId: input.guestMessageId,
    guestMessageBody: input.guestMessageBody,
    intent: intentDetection.intent,
  });

  const draft = await db.inboxAiDraft.create({
    data: {
      organizationId: input.organizationId,
      reservationId: input.reservationId,
      guestMessageId: input.guestMessageId ?? null,
      guestMessageBody: input.guestMessageBody,
      detectedIntent: intentDetection.intent,
      intentConfidence: intentDetection.confidence,
      intentSource: intentDetection.source,
      contextSnapshot: buildContextSnapshot(context) as Prisma.InputJsonValue,
      generatedText: generation.text,
      generationProvider: generation.provider,
      generationModel: generation.model,
      createdById: input.actorUserId,
    },
  });

  await recordDraftAudit({
    draftId: draft.id,
    actorUserId: input.actorUserId,
    action: InboxAiDraftAuditAction.GENERATED,
    payload: {
      intent: intentDetection.intent,
      provider: generation.provider,
      model: generation.model,
    },
  });

  return toDraftView(draft);
}

export async function updateInboxAiDraftText(input: {
  scope: TenantDataScope;
  actorUserId: string;
  draftId: string;
  editedText: string;
}): Promise<InboxAiDraftView | null> {
  const existing = await db.inboxAiDraft.findFirst({
    where: {
      id: input.draftId,
      ...(input.scope.organizationId
        ? { organizationId: input.scope.organizationId }
        : {}),
    },
    select: { id: true, reservationId: true, generatedText: true },
  });
  if (!existing) return null;

  await assertReservationInScope(input.scope, existing.reservationId);

  const trimmed = input.editedText.trim();
  if (!trimmed) return null;

  const updated = await db.inboxAiDraft.update({
    where: { id: input.draftId },
    data: {
      editedText: trimmed,
      status:
        trimmed === existing.generatedText.trim()
          ? InboxAiDraftStatus.GENERATED
          : InboxAiDraftStatus.EDITED,
    },
  });

  await recordDraftAudit({
    draftId: updated.id,
    actorUserId: input.actorUserId,
    action: InboxAiDraftAuditAction.EDITED,
    payload: { length: trimmed.length },
  });

  return toDraftView(updated);
}

export async function recordInboxAiDraftCopied(input: {
  scope: TenantDataScope;
  actorUserId: string;
  draftId: string;
}): Promise<void> {
  const existing = await db.inboxAiDraft.findFirst({
    where: {
      id: input.draftId,
      ...(input.scope.organizationId
        ? { organizationId: input.scope.organizationId }
        : {}),
    },
    select: { id: true, reservationId: true },
  });
  if (!existing) return;

  await assertReservationInScope(input.scope, existing.reservationId);
  await recordDraftAudit({
    draftId: existing.id,
    actorUserId: input.actorUserId,
    action: InboxAiDraftAuditAction.COPIED,
  });
}

export async function listInboxAiDraftsForReservation(
  scope: TenantDataScope,
  reservationId: string,
  limit = 10,
): Promise<InboxAiDraftView[]> {
  await assertReservationInScope(scope, reservationId);

  const rows = await db.inboxAiDraft.findMany({
    where: {
      reservationId,
      status: { not: InboxAiDraftStatus.DISCARDED },
      ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map(toDraftView);
}

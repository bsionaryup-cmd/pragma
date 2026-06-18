"use server";

import { requirePermission } from "@/lib/auth";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import {
  generateInboxAiDraft,
  listInboxAiDraftsForReservation,
  recordInboxAiDraftCopied,
  updateInboxAiDraftText,
} from "@/services/inbox-ai/inbox-ai-draft.service";

export async function generateInboxAiDraftAction(input: {
  reservationId: string;
  guestMessageId?: string | null;
  guestMessageBody: string;
}) {
  const auth = await requirePermission("reservations:read");
  const scope = await requireTenantDataScope();

  if (!scope.organizationId) {
    return { success: false as const, error: "Organización no disponible" };
  }

  try {
    const draft = await generateInboxAiDraft({
      scope,
      organizationId: scope.organizationId,
      actorUserId: auth.dbUserId,
      reservationId: input.reservationId,
      guestMessageId: input.guestMessageId,
      guestMessageBody: input.guestMessageBody,
    });

    if (!draft) {
      return { success: false as const, error: "No se pudo generar el borrador" };
    }

    return { success: true as const, draft };
  } catch {
    return { success: false as const, error: "Error al generar con IA" };
  }
}

export async function updateInboxAiDraftAction(input: {
  draftId: string;
  editedText: string;
}) {
  const auth = await requirePermission("reservations:read");
  const scope = await requireTenantDataScope();

  try {
    const draft = await updateInboxAiDraftText({
      scope,
      actorUserId: auth.dbUserId,
      draftId: input.draftId,
      editedText: input.editedText,
    });

    if (!draft) {
      return { success: false as const, error: "Borrador no encontrado" };
    }

    return { success: true as const, draft };
  } catch {
    return { success: false as const, error: "No se pudo guardar el borrador" };
  }
}

export async function recordInboxAiDraftCopiedAction(draftId: string) {
  const auth = await requirePermission("reservations:read");
  const scope = await requireTenantDataScope();

  try {
    await recordInboxAiDraftCopied({
      scope,
      actorUserId: auth.dbUserId,
      draftId,
    });
    return { success: true as const };
  } catch {
    return { success: false as const };
  }
}

export async function listInboxAiDraftsAction(reservationId: string) {
  await requirePermission("reservations:read");
  const scope = await requireTenantDataScope();

  try {
    const drafts = await listInboxAiDraftsForReservation(scope, reservationId);
    return { success: true as const, drafts };
  } catch {
    return { success: false as const, drafts: [] as const };
  }
}

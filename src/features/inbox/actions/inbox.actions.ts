"use server";

import { requirePermission } from "@/lib/auth";
import {
  getInboxConversationById,
  listInboxConversations,
} from "@/services/inbox/inbox.service";

export async function listInboxConversationsAction() {
  await requirePermission("reservations:read");

  try {
    const result = await listInboxConversations();
    return { success: true as const, ...result };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las conversaciones",
      conversations: [],
      unreadCount: 0,
    };
  }
}

export async function getInboxConversationAction(id: string) {
  await requirePermission("reservations:read");

  try {
    const conversation = await getInboxConversationById(id);
    if (!conversation) {
      return {
        success: false as const,
        error: "Conversación no encontrada",
      };
    }
    return { success: true as const, conversation };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo cargar la conversación",
    };
  }
}

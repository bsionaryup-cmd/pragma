"use client";

import type { ProspectingLeadRow } from "@/services/prospecting/prospecting-lead.service";
import { buildWhatsAppLinkWithMessage } from "@/lib/prospecting/whatsapp-link";

export type QuickContactResult = {
  lead: ProspectingLeadRow;
  message: string;
};

/** Generate outreach if missing, then return lead + message for WhatsApp. */
export async function ensureOutreachMessage(
  lead: ProspectingLeadRow,
  openAiConfigured: boolean,
): Promise<QuickContactResult> {
  if (lead.outreachMessage?.trim()) {
    return { lead, message: lead.outreachMessage.trim() };
  }

  if (!openAiConfigured) {
    throw new Error("Genera un mensaje manualmente o configura OPENAI_API_KEY");
  }

  const response = await fetch(`/api/prospecting/leads/${lead.id}/outreach`, {
    method: "POST",
  });
  const payload = (await response.json()) as {
    success?: boolean;
    message?: string;
    lead?: ProspectingLeadRow;
    error?: string;
  };

  if (!response.ok || !payload.success || !payload.lead || !payload.message?.trim()) {
    throw new Error(payload.error ?? "No se pudo generar el mensaje");
  }

  return { lead: payload.lead, message: payload.message.trim() };
}

export async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

export function openWhatsApp(phone: string | null, message: string): void {
  const link = buildWhatsAppLinkWithMessage(phone, message);
  if (!link) {
    throw new Error("Teléfono inválido para WhatsApp");
  }
  window.open(link, "_blank", "noopener,noreferrer");
}

export async function patchLeadContact(
  leadId: string,
  status: ProspectingLeadRow["status"],
): Promise<ProspectingLeadRow> {
  const response = await fetch(`/api/prospecting/leads/${leadId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      activity: { type: "CONTACT_WHATSAPP" },
      status: status === "NEW" ? "CONTACTED" : status,
    }),
  });
  const payload = (await response.json()) as {
    success?: boolean;
    lead?: ProspectingLeadRow;
    error?: string;
  };
  if (!response.ok || !payload.success || !payload.lead) {
    throw new Error(payload.error ?? "No se pudo registrar el contacto");
  }
  return payload.lead;
}

/**
 * One-action contact flow: ensure message → copy → open WhatsApp → log contact.
 * User clicks once; optional OpenAI generation happens inside.
 */
export async function runQuickContactFlow(
  lead: ProspectingLeadRow,
  openAiConfigured: boolean,
): Promise<ProspectingLeadRow> {
  if (!lead.phone?.trim()) {
    throw new Error("Este prospecto no tiene teléfono");
  }

  const { lead: withMessage, message } = await ensureOutreachMessage(lead, openAiConfigured);
  await copyText(message);
  openWhatsApp(withMessage.phone, message);
  return patchLeadContact(withMessage.id, withMessage.status);
}

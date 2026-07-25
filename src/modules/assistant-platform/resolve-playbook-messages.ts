/**
 * Playbook message helpers — client-safe (no database imports).
 */
import { defaultMessageTemplates } from "@/modules/assistant-platform/defaults/default-message-templates";
import type {
  MessageTemplateKey,
  ResolvedAssistantPlaybook,
} from "@/modules/assistant-platform/types";

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    return vars[key] ?? "";
  });
}

export function resolveMessage(
  playbook: ResolvedAssistantPlaybook,
  key: MessageTemplateKey,
  vars: Record<string, string> = {},
): string {
  const raw = playbook.messages[key];
  if (!raw?.trim()) {
    const fallback = defaultMessageTemplates()[key] ?? "";
    return renderTemplate(fallback, vars);
  }
  return renderTemplate(raw, vars);
}

/** Welcome ask-name: identity.welcomeMessage overrides template when set. */
export function resolveWelcomeAskName(
  playbook: ResolvedAssistantPlaybook,
  vars: Record<string, string> = {},
): string {
  const custom = playbook.identity.welcomeMessage?.trim();
  if (custom) return renderTemplate(custom, vars);
  return resolveMessage(playbook, "welcome_ask_name", vars);
}

/** Post-name menu — Studio `welcome_post_name` with {{guestName}} {{menuLines}}. */
export function resolvePostNameMenu(
  playbook: ResolvedAssistantPlaybook,
  guestName: string,
  menuLines: string[],
): string {
  return resolveMessage(playbook, "welcome_post_name", {
    guestName: guestName.trim() || "allí",
    menuLines: menuLines.join("\n"),
  });
}

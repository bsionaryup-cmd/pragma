import type { CommandCenterData } from "@/services/dashboard/command-center.service";
import type { OperationsAttentionItem } from "@/services/dashboard/operations-center.types";

export function buildAttentionItems(input: {
  commandCenter: Pick<CommandCenterData, "alerts" | "operational">;
  inboxAttentionCount: number;
  smartAccessPending: number;
  pendingIncome: number;
}): OperationsAttentionItem[] {
  const items: OperationsAttentionItem[] = [];

  if (input.inboxAttentionCount > 0) {
    items.push({
      id: "messages",
      kind: "messages",
      count: input.inboxAttentionCount,
      href: "/novedades",
      severity: input.inboxAttentionCount > 2 ? "critical" : "warning",
    });
  }

  for (const alert of input.commandCenter.alerts) {
    if (alert.type === "registration") {
      if (input.smartAccessPending > 0) continue;
      items.push({
        id: alert.id,
        kind: "registration",
        count: 1,
        href: "/novedades",
        severity: alert.severity,
      });
    }
    if (alert.type === "cleaning") {
      items.push({
        id: alert.id,
        kind: "cleaning",
        count: input.commandCenter.operational.pendingCleaning,
        href: "/tasks",
        severity: alert.severity,
      });
    }
    if (alert.type === "sync") {
      items.push({
        id: alert.id,
        kind: "sync",
        count: 1,
        href: "/integrations/airbnb",
        severity: alert.severity,
      });
    }
  }

  if (input.smartAccessPending > 0) {
    items.push({
      id: "ttlock",
      kind: "ttlock",
      count: input.smartAccessPending,
      href: "/smart-access",
      severity: "warning",
    });
  }

  if (input.pendingIncome > 0) {
    items.push({
      id: "payment",
      kind: "payment",
      count: 1,
      href: "/finance",
      severity: "warning",
    });
  }

  return items;
}

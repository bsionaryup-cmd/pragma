/**
 * Motor de Conversaciones — stub Fase 1.
 * No envía mensajes; no conoce WhatsApp.
 * Fase 3: máquina de estados persistente sobre nodos.
 */

import type {
  ReceptionNode,
  ReceptionRuntimeState,
  ReceptionWorkflow,
} from "@/modules/digital-receptionist/types";

export function renderReceptionTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    return vars[key] ?? "";
  });
}

export function getNode(
  workflow: ReceptionWorkflow,
  nodeId: string | null,
): ReceptionNode | null {
  if (!nodeId) return null;
  return workflow.nodes.find((n) => n.id === nodeId) ?? null;
}

/**
 * Avanza un paso cuando el huésped responde (Fase 3: validaciones + acciones).
 * Stub: botones / nextNodeId lineal.
 */
export function advanceReceptionNode(input: {
  workflow: ReceptionWorkflow;
  state: ReceptionRuntimeState;
  guestMessage: string;
}): { state: ReceptionRuntimeState; outboundMessage: string | null } {
  const node = getNode(input.workflow, input.state.nodeId);
  if (!node) {
    return { state: input.state, outboundMessage: null };
  }

  const text = input.guestMessage.trim();
  const byButton = node.buttons.find(
    (b) =>
      b.enabled !== false &&
      (b.value === text ||
        b.label === text ||
        String(b.sortOrder ?? "") === text ||
        new RegExp(`^${b.sortOrder ?? ""}[.)\\s]?$`).test(text)),
  );

  const nextId = byButton?.nextNodeId ?? node.nextNodeId;
  const next = getNode(input.workflow, nextId);

  const nextState: ReceptionRuntimeState = {
    ...input.state,
    nodeId: next?.id ?? null,
    status:
      next?.type === "end"
        ? "FINISHED"
        : next?.type === "transfer"
          ? "HUMAN"
          : input.state.status,
    updatedAt: new Date().toISOString(),
  };

  const outboundMessage = next
    ? renderReceptionTemplate(next.message, flattenVars(input.state.variables))
    : null;

  return { state: nextState, outboundMessage };
}

function flattenVars(
  vars: ReceptionRuntimeState["variables"],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (v == null) continue;
    out[k] = String(v);
  }
  return out;
}

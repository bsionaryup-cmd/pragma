/**
 * Motor de Conversaciones — Recepcionista Digital.
 * Determinista: estados + nodos. No genera copy con LLM.
 */
import {
  buildDefaultReceptionWorkflows,
} from "@/modules/digital-receptionist/default-workflows";
import {
  DEFAULT_RECEPTION_MENU,
  type ReceptionConversationStatus,
  type ReceptionMenuItem,
  type ReceptionNode,
  type ReceptionRuntimeState,
  type ReceptionWorkflow,
} from "@/modules/digital-receptionist/types";
import { renderReceptionTemplate } from "@/modules/digital-receptionist/conversation-engine";
import type { ResolvedAssistantPlaybook } from "@/modules/assistant-platform/types";
import {
  resolvePostNameMenu,
  resolveWelcomeAskName,
} from "@/modules/assistant-platform/resolve-playbook-messages";
import { isPureAckMessage } from "@/modules/ai-concierge/engine/conversational-guards";

export type ReceptionistTurnResult = {
  handled: boolean;
  reply: string | null;
  state: ReceptionRuntimeState;
  escalate: boolean;
  path: string;
};

type StoredReception = {
  status?: ReceptionConversationStatus;
  workflowKey?: string | null;
  nodeId?: string | null;
  variables?: Record<string, string | number | boolean | null>;
  guestName?: string | null;
  menuOffered?: boolean;
};

function menuLinesFromItems(items: ReceptionMenuItem[]): string[] {
  return items
    .filter((m) => m.enabled)
    .sort((a, b) => a.n - b.n)
    .map((m) => `${m.icon || `${m.n}.`} ${m.label}`);
}

function loadWorkflows(
  playbook: ResolvedAssistantPlaybook,
  organizationId: string,
): ReceptionWorkflow[] {
  const meta = playbook.prompt.studioMeta as
    | {
        workflows?: ReceptionWorkflow[];
        workflowFlags?: Record<string, boolean>;
      }
    | undefined;
  const defaults = buildDefaultReceptionWorkflows(organizationId);
  if (Array.isArray(meta?.workflows) && meta.workflows.length > 0) {
    return meta.workflows.map((w) => ({
      ...w,
      organizationId,
      enabled: meta.workflowFlags?.[w.key] !== false && w.enabled !== false,
    }));
  }
  return defaults.map((w) => ({
    ...w,
    enabled: meta?.workflowFlags?.[w.key] !== false,
  }));
}

function loadMenu(playbook: ResolvedAssistantPlaybook): ReceptionMenuItem[] {
  const meta = playbook.prompt.studioMeta as
    | { menuItems?: ReceptionMenuItem[] }
    | undefined;
  if (Array.isArray(meta?.menuItems) && meta.menuItems.length) {
    return meta.menuItems;
  }
  return DEFAULT_RECEPTION_MENU;
}

function getNode(
  workflow: ReceptionWorkflow,
  nodeId: string | null | undefined,
): ReceptionNode | null {
  if (!nodeId) return null;
  return workflow.nodes.find((n) => n.id === nodeId) ?? null;
}

function wantsMenu(text: string): boolean {
  return /^(men[uú]|volver( al men[uú])?|inicio|opciones|0)[\s!.?]*$/i.test(
    text.trim(),
  );
}

function isGreeting(text: string): boolean {
  return (
    isPureAckMessage(text) &&
    /^(hola+|holi+|ola+|wenas+|buenas?(?: (?:tardes|noches|días|dias))?|hey+|hi+|hello+)[\s!.?]*$/i.test(
      text.trim(),
    )
  );
}

function tryCaptureName(text: string): string | null {
  const t = text
    .trim()
    .replace(/^(me llamo|soy|mi nombre es)\s+/i, "")
    .trim();
  if (t.length < 2 || t.length > 48) return null;
  if (/^[0-9]/.test(t)) return null;
  if (
    /disponib|wifi|reserva|pago|check|cancel|asesor|men[uú]|hola|ok|gracias/i.test(
      t,
    )
  ) {
    return null;
  }
  if (!/^[a-záéíóúñü\s'.-]+$/i.test(t)) return null;
  if (t.split(/\s+/).filter(Boolean).length > 4) return null;
  return t.replace(/\s+/g, " ");
}

function matchMenuDigit(
  text: string,
  menu: ReceptionMenuItem[],
): ReceptionMenuItem | null {
  const m = text.trim().match(/^([1-9])(?:[.)\s]|️⃣)?$/u);
  if (!m) return null;
  const n = Number(m[1]);
  return menu.find((item) => item.enabled && item.n === n) ?? null;
}

function matchButton(node: ReceptionNode, text: string) {
  const t = text.trim();
  return (
    node.buttons.find((b) => {
      if (b.enabled === false) return false;
      if (b.value && b.value === t) return true;
      if (b.label && b.label.toLowerCase() === t.toLowerCase()) return true;
      if (
        b.sortOrder != null &&
        new RegExp(`^${b.sortOrder}(?:[.)\\s]|️⃣)?$`, "u").test(t)
      ) {
        return true;
      }
      return false;
    }) ?? null
  );
}

function classifyOutOfFlow(_text: string): string | null {
  // Disabled: free-text must not jump workflows. Digits/buttons only.
  return null;
}

function buildMenuReply(
  playbook: ResolvedAssistantPlaybook,
  guestName: string | null,
  menu: ReceptionMenuItem[],
): string {
  if (guestName?.trim()) {
    return resolvePostNameMenu(
      playbook,
      guestName.trim(),
      menuLinesFromItems(menu),
    );
  }
  return resolveWelcomeAskName(playbook, {});
}

function emptyState(
  organizationId: string,
  conversationId: string,
  threadId: string,
): ReceptionRuntimeState {
  return {
    conversationId,
    organizationId,
    threadId,
    status: "WELCOME",
    workflowKey: null,
    nodeId: null,
    variables: {},
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Turno del recepcionista — autoridad exclusiva (sin passthrough a Concierge LLM).
 */
export function runReceptionistTurn(input: {
  organizationId: string;
  conversationId: string;
  threadId: string;
  guestMessage: string;
  playbook: ResolvedAssistantPlaybook;
  stored?: StoredReception | null;
  propertyName?: string | null;
}): ReceptionistTurnResult {
  const menu = loadMenu(input.playbook);
  const workflows = loadWorkflows(input.playbook, input.organizationId).filter(
    (w) => w.enabled,
  );
  const text = input.guestMessage.trim();
  const stored = input.stored ?? {};

  let state: ReceptionRuntimeState = {
    ...emptyState(
      input.organizationId,
      input.conversationId,
      input.threadId,
    ),
    status: stored.status ?? "WELCOME",
    workflowKey: stored.workflowKey ?? null,
    nodeId: stored.nodeId ?? null,
    variables: { ...(stored.variables ?? {}) },
  };
  if (stored.guestName) {
    state.variables.nombre = stored.guestName;
  }

  const guestName =
    typeof state.variables.nombre === "string"
      ? String(state.variables.nombre)
      : stored.guestName ?? null;

  const stamp = (s: ReceptionRuntimeState): ReceptionRuntimeState => ({
    ...s,
    updatedAt: new Date().toISOString(),
  });

  // Explicit menu reset
  if (wantsMenu(text)) {
    const reply = buildMenuReply(input.playbook, guestName, menu);
    return {
      handled: true,
      reply,
      escalate: false,
      path: "reception:menu",
      state: stamp({
        ...state,
        status: "MENU",
        workflowKey: null,
        nodeId: null,
      }),
    };
  }

  // Cold start / greeting → welcome ask name
  if (
    (state.status === "WELCOME" || !stored.menuOffered) &&
    !guestName &&
    isGreeting(text)
  ) {
    const reply = resolveWelcomeAskName(input.playbook, {
      propertyName: input.propertyName ?? "",
    });
    return {
      handled: true,
      reply,
      escalate: false,
      path: "reception:welcome",
      state: stamp({
        ...state,
        status: "WELCOME",
        workflowKey: null,
        nodeId: null,
      }),
    };
  }

  // Capture name while welcoming
  if ((state.status === "WELCOME" || !guestName) && !guestName) {
    const name = tryCaptureName(text);
    if (name) {
      const reply = buildMenuReply(input.playbook, name, menu);
      return {
        handled: true,
        reply,
        escalate: false,
        path: "reception:name_then_menu",
        state: stamp({
          ...state,
          status: "MENU",
          workflowKey: null,
          nodeId: null,
          variables: { ...state.variables, nombre: name },
        }),
      };
    }
    if (state.status === "WELCOME" && !classifyOutOfFlow(text)) {
      const reply = resolveWelcomeAskName(input.playbook, {
        propertyName: input.propertyName ?? "",
      });
      return {
        handled: true,
        reply,
        escalate: false,
        path: "reception:welcome_need_name",
        state: stamp(state),
      };
    }
  }

  // Active workflow node
  if (state.workflowKey && state.nodeId) {
    const workflow = workflows.find((w) => w.key === state.workflowKey);
    const node = workflow ? getNode(workflow, state.nodeId) : null;
    if (workflow && node) {
      return advanceInWorkflow({
        workflow,
        node,
        state,
        text,
        playbook: input.playbook,
        menu,
        guestName,
      });
    }
  }

  // Menu selection
  if (state.status === "MENU" || state.status === "WELCOME" || !state.workflowKey) {
    const item = matchMenuDigit(text, menu);
    if (item) {
      const workflow = workflows.find((w) => w.key === item.workflowKey);
      if (!workflow || !workflow.entryNodeId) {
        return {
          handled: true,
          reply: buildMenuReply(input.playbook, guestName, menu),
          escalate: false,
          path: "reception:menu_disabled",
          state: stamp({ ...state, status: "MENU" }),
        };
      }
      const entry = getNode(workflow, workflow.entryNodeId);
      const reply = entry
        ? renderReceptionTemplate(entry.message, flatten(state.variables))
        : buildMenuReply(input.playbook, guestName, menu);
      const escalate = entry?.type === "transfer" || entry?.action === "transfer_human";
      return {
        handled: true,
        reply,
        escalate,
        path: `reception:open:${workflow.key}`,
        state: stamp({
          ...state,
          status: escalate
            ? "HUMAN"
            : statusForWorkflow(workflow.key),
          workflowKey: escalate ? null : workflow.key,
          nodeId: escalate ? null : entry?.id ?? null,
        }),
      };
    }

    // NL classify intentionally disabled — only digits / buttons advance.

    // On menu without match: re-offer menu only (configured copy, no extra invent)
    if (state.status === "MENU" || guestName) {
      return {
        handled: true,
        reply: buildMenuReply(input.playbook, guestName, menu),
        escalate: false,
        path: "reception:menu_reprompt",
        state: stamp({ ...state, status: "MENU", workflowKey: null, nodeId: null }),
      };
    }
  }

  // Always handle — never passthrough to Concierge compose/LLM.
  const reply = guestName
    ? buildMenuReply(input.playbook, guestName, menu)
    : resolveWelcomeAskName(input.playbook, {
        propertyName: input.propertyName ?? "",
      });
  return {
    handled: true,
    reply,
    escalate: false,
    path: guestName ? "reception:fallback_menu" : "reception:fallback_welcome",
    state: stamp({
      ...state,
      status: guestName ? "MENU" : "WELCOME",
    }),
  };
}

function statusForWorkflow(key: string): ReceptionConversationStatus {
  switch (key) {
    case "booking":
      return "BOOKING";
    case "my_reservation":
    case "checkin":
      return "CHECKIN";
    case "stay":
      return "STAY";
    case "room_issue":
      return "SUPPORT";
    case "human":
      return "HUMAN";
    default:
      return "MENU";
  }
}

function flatten(
  vars: ReceptionRuntimeState["variables"],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (v == null) continue;
    out[k] = String(v);
  }
  return out;
}

function advanceInWorkflow(input: {
  workflow: ReceptionWorkflow;
  node: ReceptionNode;
  state: ReceptionRuntimeState;
  text: string;
  playbook: ResolvedAssistantPlaybook;
  menu: ReceptionMenuItem[];
  guestName: string | null;
}): ReceptionistTurnResult {
  const { workflow, node, state, text, playbook, menu, guestName } = input;

  const btn = matchButton(node, text);
  let nextId = btn?.nextNodeId ?? null;
  let vars = { ...state.variables };

  if (btn?.label && node.id === "issue_cat") {
    vars.issue_category = btn.label;
  }

  // Free-text question / message nodes without button match
  if (!btn && (node.type === "question" || node.type === "message")) {
    if (node.validations.includes("has_text") && text.length >= 2) {
      if (node.variables[0]) vars[node.variables[0]] = text;
      nextId = node.nextNodeId;
    } else if (
      node.validations.includes("has_dates_or_guests") ||
      node.id.includes("dates")
    ) {
      vars.raw_dates = text;
      nextId = node.nextNodeId;
    } else if (node.buttons.length === 0 && node.nextNodeId) {
      // Acknowledge and move forward when guest sends anything meaningful
      if (text.length >= 2 && !isGreeting(text)) {
        nextId = node.nextNodeId;
      }
    }
  }

  // Button "volver al menú" → nextNodeId null
  if (btn && btn.nextNodeId === null) {
    const reply = buildMenuReply(playbook, guestName, menu);
    return {
      handled: true,
      reply,
      escalate: false,
      path: "reception:back_menu",
      state: {
        ...state,
        status: "MENU",
        workflowKey: null,
        nodeId: null,
        variables: vars,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  if (!nextId && node.type === "transfer") {
    return {
      handled: true,
      reply: renderReceptionTemplate(node.message, flatten(vars)),
      escalate: true,
      path: "reception:transfer",
      state: {
        ...state,
        status: "HUMAN",
        workflowKey: null,
        nodeId: null,
        variables: vars,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  if (!nextId) {
    // Stay on node, re-send prompt
    return {
      handled: true,
      reply: renderReceptionTemplate(node.message, flatten(vars)),
      escalate: false,
      path: "reception:node_reprompt",
      state: {
        ...state,
        variables: vars,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  const next = getNode(workflow, nextId);
  if (!next) {
    const reply = buildMenuReply(playbook, guestName, menu);
    return {
      handled: true,
      reply,
      escalate: false,
      path: "reception:workflow_end_menu",
      state: {
        ...state,
        status: "MENU",
        workflowKey: null,
        nodeId: null,
        variables: vars,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  let reply = renderReceptionTemplate(next.message, flatten(vars));
  let escalate =
    next.type === "transfer" || next.action === "transfer_human";

  // Action nodes: send ONLY the configured node message (no invented copy).
  if (next.type === "action" && next.action === "search_availability") {
    const resultNode = getNode(workflow, next.nextNodeId);
    return {
      handled: true,
      reply: resultNode
        ? renderReceptionTemplate(resultNode.message, flatten(vars))
        : renderReceptionTemplate(next.message, flatten(vars)),
      escalate: false,
      path: "reception:action:search_availability",
      state: {
        ...state,
        status: "BOOKING",
        workflowKey: workflow.key,
        nodeId: resultNode?.id ?? next.id,
        variables: vars,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  if (next.type === "end") {
    return {
      handled: true,
      reply,
      escalate: false,
      path: "reception:finished",
      state: {
        ...state,
        status: "FINISHED",
        workflowKey: null,
        nodeId: null,
        variables: vars,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  if (escalate) {
    return {
      handled: true,
      reply,
      escalate: true,
      path: "reception:transfer",
      state: {
        ...state,
        status: "HUMAN",
        workflowKey: null,
        nodeId: null,
        variables: vars,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  return {
    handled: true,
    reply,
    escalate: false,
    path: `reception:node:${next.id}`,
    state: {
      ...state,
      status: statusForWorkflow(workflow.key),
      workflowKey: workflow.key,
      nodeId: next.id,
      variables: vars,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function receptionStateFromFacts(facts: Record<string, unknown>): StoredReception {
  const raw = facts.reception;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as StoredReception;
  }
  return {
    status: typeof facts.activeProtocol === "string" && facts.activeProtocol === "WELCOME"
      ? "WELCOME"
      : typeof facts.guestName === "string"
        ? "MENU"
        : "WELCOME",
    guestName: typeof facts.guestName === "string" ? facts.guestName : null,
    menuOffered: facts.menuOffered === true,
    workflowKey: null,
    nodeId: null,
    variables: {},
  };
}

export function receptionFactsPatch(state: ReceptionRuntimeState): Record<
  string,
  unknown
> {
  const guestName =
    typeof state.variables.nombre === "string"
      ? state.variables.nombre
      : null;
  return {
    reception: {
      status: state.status,
      workflowKey: state.workflowKey,
      nodeId: state.nodeId,
      variables: state.variables,
      guestName,
      menuOffered: state.status !== "WELCOME",
    },
    guestName,
    menuOffered: state.status !== "WELCOME",
    flowTopic: state.status.toLowerCase(),
    activeProtocol: state.status,
  };
}

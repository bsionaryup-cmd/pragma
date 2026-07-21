import type { ConciergeConversation } from "@/modules/ai-concierge/types/conversation";
import type { ConciergeAgentRun } from "@/modules/ai-concierge/types/run";
import type { ConciergeOperationMode } from "@/modules/ai-concierge/channel/session-store";
import type { TenantDataScope } from "@/lib/platform/tenant-data-scope";
import { runConciergeTurn } from "@/modules/ai-concierge/engine/orchestrator";
import { createPhase6ReadToolRegistry } from "@/modules/ai-concierge/tools/read/wire";
import {
  getConciergeIntentDefinition,
  renderIntentTemplate,
} from "@/modules/ai-concierge/intent/library";
import { auditConciergeCandidate } from "@/modules/ai-concierge/engine/auditor";
import { recordLearningProposal } from "@/modules/ai-concierge/learning/proposals";
import { recordConciergeTurnMetric } from "@/modules/ai-concierge/engine/metrics";
import { matchContextualAck } from "@/modules/ai-concierge/engine/deterministic-ack";
import {
  humanClarifyMissingFacts,
  humanSoftHandoff,
  sanitizeGuestOutbound,
  guestCopyLooksUnsafe,
} from "@/modules/ai-concierge/engine/guest-copy";
import {
  callConciergeLlm,
  isConciergeLlmConfigured,
} from "@/modules/ai-concierge/engine/llm";
import {
  getConciergeAiProvider,
  resolveDefaultConciergeAiProvider,
  setConciergeAiProvider,
} from "@/modules/ai-concierge/runtime/ai-provider";
import {
  buildIntentAwareContext,
  formatContextForLlm,
} from "@/modules/ai-concierge/context/context-engine";
import {
  deriveFlowFromIntent,
  loadConciergeThreadMemory,
  mergeFacts,
  saveConciergeThreadMemory,
  type ConciergeFactMap,
  type ConciergeRecentSnippet,
} from "@/modules/ai-concierge/memory/fact-memory";
import { appendMessage } from "@/modules/ai-concierge/memory/conversation-memory";
import { runAvailabilityDialogue } from "@/modules/ai-concierge/dialogue/availability-flow";
import {
  isLikelyAgentEcho,
  shouldIgnoreSlotSource,
  isLikelyMainMenuEcho,
} from "@/modules/ai-concierge/dialogue/slot-extract";
import { detectConciergeIntent } from "@/modules/ai-concierge/intent/detect";
import {
  confidenceClarification,
  mapToolOutcomes,
  resolveFollowUpIntent,
  validateConversationalCoherence,
} from "@/modules/ai-concierge/engine/conversational-guards";
import {
  WORKFLOW_MENU_STEP,
  WELCOME_NAME_STEP,
  buildMainMenuOptionLines,
  hasActiveWorkflow,
  isAwaitingGuestName,
  isAwaitingMenuChoice,
  isAwaitingSubmenu,
  isBareMainMenuDigit,
  lastAgentOfferedMainMenu,
  resolveCancelConfirm,
  resolveContextLockSwitch,
  resolveSubmenuRoute,
  resolveWorkflowRoute,
  tryCaptureGuestName,
  unlockStaleWorkflow,
  workflowEntryReply,
} from "@/modules/ai-concierge/dialogue/workflow-menu";
import {
  protocolFactsPatch,
  protocolFromPendingAction,
  protocolFromWorkflowId,
} from "@/modules/ai-concierge/hospitality-protocols";
import { getChannelOutboundAck } from "@/modules/ai-concierge/channel/operational-state";
import {
  closeConciergeSession,
  shouldCloseConciergeSession,
  stripWorkflowEphemeralFacts,
} from "@/modules/ai-concierge/memory/session-lifecycle";
import {
  resolveAssistantPlaybook,
  resolveMessage,
  resolvePostNameMenu,
  resolveWelcomeAskName,
  type ResolvedAssistantPlaybook,
} from "@/modules/assistant-platform";
import { isPureAckMessage } from "@/modules/ai-concierge/engine/deterministic-ack";
import {
  receptionFactsPatch,
  receptionStateFromFacts,
  runReceptionistTurn,
} from "@/modules/digital-receptionist";

function softContinueFromPlaybook(
  playbook: ResolvedAssistantPlaybook,
  pendingAction: string | null,
  fallback: string,
): string {
  if (
    pendingAction === "booking_created" ||
    pendingAction === "done"
  ) {
    return resolveMessage(playbook, "soft_continue_post_booking");
  }
  if (
    pendingAction === "ask_dates_guests" ||
    pendingAction === "ask_check_in" ||
    pendingAction === "ask_check_out" ||
    pendingAction === "ask_guests" ||
    pendingAction === "ask_dates"
  ) {
    return resolveMessage(playbook, "soft_continue_ask_dates");
  }
  if (pendingAction === "await_confirm") {
    return resolveMessage(playbook, "soft_continue_await_confirm");
  }
  if (pendingAction === "ask_guest_name") {
    return resolveMessage(playbook, "soft_continue_ask_guest_name");
  }
  if (pendingAction === "ask_guest_email") {
    return resolveMessage(playbook, "soft_continue_ask_guest_email");
  }
  if (pendingAction === "await_final_confirm") {
    return resolveMessage(playbook, "soft_continue_await_final_confirm");
  }
  const custom = resolveMessage(playbook, "soft_continue_default");
  return custom || fallback;
}

/** Anti-flood window when the channel actually dispatched the same text. */
const DUPLICATE_OUTBOUND_WINDOW_MS = 45_000;
/** Soft guard against double-tick before heartbeat can report send status. */
const DUPLICATE_SOFT_WINDOW_MS = 8_000;

type OutboundAck = {
  sent: boolean;
  outboundDispatched: boolean;
  suggestedPreview: string | null;
};

function previewMatchesReply(
  reply: string,
  preview: string | null | undefined,
): boolean {
  if (!preview?.trim()) return true;
  const a = reply.trim().slice(0, 48);
  const b = preview.trim().slice(0, 48);
  return a.startsWith(b.slice(0, 24)) || b.startsWith(a.slice(0, 24));
}

/**
 * Block mayAutoSend for identical agent text only when:
 * - very recent soft window (<8s), OR
 * - channel heartbeat confirms the same reply was dispatched/sent (<45s).
 * Memory alone must NOT block retries (WA silence root cause).
 */
function isRecentDuplicateOutbound(
  recent: ConciergeRecentSnippet[],
  reply: string | null | undefined,
  ack: OutboundAck | null,
): boolean {
  if (!reply?.trim()) return false;
  const lastAgent = [...recent].reverse().find((m) => m.role === "agent");
  if (!lastAgent || lastAgent.body.trim() !== reply.trim()) return false;
  const at = Date.parse(lastAgent.at);
  if (!Number.isFinite(at)) return true;
  const age = Date.now() - at;
  if (age >= DUPLICATE_OUTBOUND_WINDOW_MS) return false;
  if (age < DUPLICATE_SOFT_WINDOW_MS) return true;

  const dispatched =
    Boolean(ack) &&
    (ack!.sent === true || ack!.outboundDispatched === true) &&
    previewMatchesReply(reply, ack!.suggestedPreview);
  return dispatched;
}

function extractFactsFromToolData(data: unknown): ConciergeFactMap {
  if (!data || typeof data !== "object") return {};
  const row = data as Record<string, unknown>;
  const out: ConciergeFactMap = {};
  for (const [k, v] of Object.entries(row)) {
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean" ||
      v === null
    ) {
      out[k] = v;
    }
  }
  return out;
}

export type ConciergeComposeResult = {
  conversation: ConciergeConversation;
  run: ConciergeAgentRun;
  suggestedReply: string | null;
  autoEligible: boolean;
  mayAutoSend: boolean;
  mode: ConciergeOperationMode;
  usedLlm: boolean;
  learningRecorded: boolean;
  observability: {
    toolsUsed: string[];
    factKeys: string[];
    llmTokens: number | null;
    path: string;
    toolOutcomes?: Array<{
      toolName: string;
      outcome: "SUCCESS" | "FAILED" | "PENDING";
      ok: boolean;
    }>;
    silent?: boolean;
    buffered?: boolean;
  };
};

/**
 * Compone respuesta: ack determinístico → L1/L2 tools → L3 LLM (needs_llm).
 * SSOT = PRAGMA facts + tools. Nunca inventa.
 */
export async function composeConciergeReply(input: {
  conversation: ConciergeConversation;
  guestMessage: string;
  scope: TenantDataScope;
  mode: ConciergeOperationMode;
  threadId: string;
  knownFacts?: ConciergeFactMap;
  allowedPropertyIds?: string[];
  allowedTools?: string[];
  externalMessageId?: string | null;
  /** Studio simulator: force a draft/published playbook without publishing. */
  playbookOverride?: ResolvedAssistantPlaybook;
}): Promise<ConciergeComposeResult> {
  const organizationId = input.conversation.organizationId;
  const channel = input.conversation.channel;
  let conversation: ConciergeConversation = { ...input.conversation };

  let loaded = await loadConciergeThreadMemory({
    organizationId,
    channel,
    threadId: input.threadId,
  });

  const outboundAck = await getChannelOutboundAck({
    organizationId,
    channel,
    threadId: input.threadId,
  });

  // REGLA 1–2: closed session → wipe ephemeral + recent; keep only permanent PMS ids.
  let sessionClosed = false;
  if (
    shouldCloseConciergeSession({
      expired: loaded.expired,
      recent: loaded.recent,
    })
  ) {
    const closed = closeConciergeSession({
      facts: loaded.facts,
      reservationId: loaded.reservationId,
    });
    sessionClosed = true;
    loaded = {
      ...loaded,
      facts: closed.facts,
      flow: closed.flow,
      recent: closed.recent,
      expired: true,
    };
    await saveConciergeThreadMemory({
      organizationId,
      channel,
      threadId: input.threadId,
      facts: closed.facts,
      flow: closed.flow,
      recent: closed.recent,
      propertyId: conversation.propertyId ?? loaded.propertyId,
      reservationId: conversation.reservationId ?? loaded.reservationId,
    });
  }

  // Expire zombie Context Lock after idle so "Hola" returns welcome / menu.
  const unlockedFlow = unlockStaleWorkflow({
    flow: loaded.flow,
    recent: loaded.recent,
  });
  const idleUnlocked = unlockedFlow !== loaded.flow;
  const needsNameOnUnlock =
    sessionClosed ||
    typeof loaded.facts.guestName !== "string" ||
    !String(loaded.facts.guestName).trim();
  const flowAfterUnlock =
    (idleUnlocked || sessionClosed) && needsNameOnUnlock
      ? {
          ...unlockedFlow,
          pendingAction: WELCOME_NAME_STEP,
          topic: "welcome",
        }
      : unlockedFlow;
  const memory = {
    ...loaded,
    flow: flowAfterUnlock,
    facts:
      idleUnlocked || sessionClosed
        ? mergeFacts(
            idleUnlocked
              ? stripWorkflowEphemeralFacts(loaded.facts)
              : loaded.facts,
            {
              contextLocked: false,
              bookingConfirmed: false,
              activeWorkflow: null,
              flowTopic: needsNameOnUnlock ? "welcome" : "menu",
              activeProtocol: needsNameOnUnlock ? "WELCOME" : "MAIN_MENU",
            },
          )
        : loaded.facts,
  };

  // Assistant Platform — published playbook (fallback = Concierge code defaults).
  const playbook =
    input.playbookOverride ??
    (await resolveAssistantPlaybook({ organizationId }));

  const lastAgentBodyForEcho =
    [...memory.recent].reverse().find((m) => m.role === "agent")?.body ?? null;
  if (
    input.mode !== "observe" &&
    (isLikelyAgentEcho(input.guestMessage, lastAgentBodyForEcho) ||
      isLikelyMainMenuEcho(input.guestMessage) ||
      (shouldIgnoreSlotSource(input.guestMessage) &&
        lastAgentOfferedMainMenu(memory.recent)))
  ) {
    const guestAppend = appendMessage(conversation, {
      role: "guest",
      body: input.guestMessage,
      externalMessageId: input.externalMessageId,
    });
    await saveConciergeThreadMemory({
      organizationId,
      channel,
      threadId: input.threadId,
      facts: memory.facts,
      flow: memory.flow,
      recent: [
        ...memory.recent,
        {
          role: "guest",
          body: input.guestMessage,
          at: new Date().toISOString(),
        },
      ],
      propertyId: conversation.propertyId ?? memory.propertyId,
      reservationId: conversation.reservationId ?? memory.reservationId,
    });
    recordConciergeTurnMetric("deterministic");
    const fakeRun = {
      id: `silence_echo_${Date.now().toString(36)}`,
      conversationId: guestAppend.conversation.id,
      organizationId,
      inboundMessageId: guestAppend.message.id,
      intent: {
        intent: "OTHER" as const,
        confidence: 1,
        level: "L1" as const,
        source: "concierge-rules" as const,
      },
      decision: {
        path: "deterministic" as const,
        reason: "agent_echo_suppressed",
        draftResponse: null,
        requiredToolNames: [] as string[],
      },
      toolInvocations: [],
      auditor: { verified: true, issues: [] as string[] },
      context: {
        organizationId,
        propertyId: conversation.propertyId ?? null,
        reservationId: conversation.reservationId ?? null,
        knownFacts: memory.facts,
        missingFacts: [],
        recentGuestMessages: [],
        builtAt: new Date().toISOString(),
      },
      outboundBlocked: true as const,
      createdAt: new Date().toISOString(),
    } satisfies ConciergeAgentRun;

    return {
      conversation: guestAppend.conversation,
      run: fakeRun,
      suggestedReply: null,
      autoEligible: false,
      mayAutoSend: false,
      mode: input.mode,
      usedLlm: false,
      learningRecorded: false,
      observability: {
        toolsUsed: [],
        factKeys: Object.keys(memory.facts),
        llmTokens: null,
        path: "no_reply",
        silent: true,
      },
    };
  }

  // Recepcionista Digital — autoridad exclusiva (sin LLM / hospitality / compose legacy).
  if (input.mode !== "observe") {
    const reception = runReceptionistTurn({
      organizationId,
      conversationId: conversation.id,
      threadId: input.threadId,
      guestMessage: input.guestMessage,
      playbook,
      stored: receptionStateFromFacts(memory.facts as Record<string, unknown>),
      propertyName:
        typeof memory.facts.name === "string" ? memory.facts.name : null,
    });
    if (reception.handled) {
      if (!reception.reply?.trim()) {
        const guestAppend = appendMessage(conversation, {
          role: "guest",
          body: input.guestMessage,
          externalMessageId: input.externalMessageId,
        });
        const silentRun = {
          id: `reception_silent_${Date.now().toString(36)}`,
          conversationId: guestAppend.conversation.id,
          organizationId,
          inboundMessageId: guestAppend.message.id,
          intent: {
            intent: "OTHER" as const,
            confidence: 1,
            level: "L1" as const,
            source: "concierge-rules" as const,
          },
          decision: {
            path: "deterministic" as const,
            reason: `Recepcionista Digital silent: ${reception.path}`,
            draftResponse: null,
            requiredToolNames: [] as string[],
          },
          toolInvocations: [],
          auditor: { verified: true, issues: [] as string[] },
          context: {
            organizationId,
            propertyId: conversation.propertyId ?? null,
            reservationId: conversation.reservationId ?? null,
            knownFacts: memory.facts,
            missingFacts: [],
            recentGuestMessages: [],
            builtAt: new Date().toISOString(),
          },
          outboundBlocked: true as const,
          createdAt: new Date().toISOString(),
        } satisfies ConciergeAgentRun;
        return {
          conversation: guestAppend.conversation,
          run: silentRun,
          suggestedReply: null,
          autoEligible: false,
          mayAutoSend: false,
          mode: input.mode,
          usedLlm: false,
          learningRecorded: false,
          observability: {
            toolsUsed: [],
            factKeys: Object.keys(memory.facts),
            llmTokens: null,
            path: reception.path,
            silent: true,
          },
        };
      }
      const reply = sanitizeGuestOutbound(
        reception.reply,
        reception.reply,
      )!;
      const guestAppend = appendMessage(conversation, {
        role: "guest",
        body: input.guestMessage,
        externalMessageId: input.externalMessageId,
      });
      const withAssistant = appendMessage(guestAppend.conversation, {
        role: "agent",
        body: reply,
      }).conversation;
      const recent: ConciergeRecentSnippet[] = reception.resetSession
        ? [
            {
              role: "guest",
              body: input.guestMessage,
              at: new Date().toISOString(),
            },
            { role: "agent", body: reply, at: new Date().toISOString() },
          ]
        : [
            ...memory.recent,
            {
              role: "guest",
              body: input.guestMessage,
              at: new Date().toISOString(),
            },
            { role: "agent", body: reply, at: new Date().toISOString() },
          ];
      const patch = receptionFactsPatch(reception.state);
      const protocolLabel =
        reception.state.status === "HUMAN"
          ? "RECEPTION"
          : reception.state.status === "WELCOME"
            ? "WELCOME"
            : reception.state.status === "BOOKING"
              ? "BOOKINGS"
              : reception.state.status === "STAY"
                ? "STAY"
                : reception.state.status === "SUPPORT"
                  ? "RECEPTION"
                  : "MAIN_MENU";
      const baseFacts = reception.resetSession
        ? { language: "es" as const }
        : memory.facts;
      await saveConciergeThreadMemory({
        organizationId,
        channel,
        threadId: input.threadId,
        facts: mergeFacts(baseFacts, {
          ...patch,
          language: "es",
          ...protocolFactsPatch({
            protocol: protocolLabel,
            step:
              reception.state.status === "WELCOME"
                ? WELCOME_NAME_STEP
                : reception.state.status === "MENU"
                  ? WORKFLOW_MENU_STEP
                  : reception.state.nodeId,
            lastAction: reception.path,
            nextAction: reception.state.nodeId,
            status: reception.escalate ? "escalated" : "awaiting_guest",
          }),
        }),
        flow: {
          topic: reception.state.status,
          flow: reception.state.workflowKey ?? "menu",
          pendingAction:
            reception.state.status === "WELCOME"
              ? WELCOME_NAME_STEP
              : reception.state.status === "MENU"
                ? WORKFLOW_MENU_STEP
                : reception.state.nodeId,
          awaitingReply: !reception.escalate,
          lastIntent: reception.escalate ? "COMPLAINT" : "OTHER",
        },
        recent,
        propertyId: reception.resetSession
          ? null
          : (conversation.propertyId ?? memory.propertyId),
        reservationId: reception.resetSession
          ? null
          : (conversation.reservationId ?? memory.reservationId),
      });
      recordConciergeTurnMetric(
        reception.escalate ? "escalate" : "deterministic",
      );
      const intent = reception.escalate
        ? ({
            intent: "COMPLAINT" as const,
            confidence: 1,
            level: "L1" as const,
            source: "concierge-rules" as const,
          })
        : ({
            intent: "OTHER" as const,
            confidence: 1,
            level: "L1" as const,
            source: "concierge-rules" as const,
          });
      const fakeRun = {
        id: `reception_${Date.now().toString(36)}`,
        conversationId: withAssistant.id,
        organizationId,
        inboundMessageId: guestAppend.message.id,
        intent,
        decision: {
          path: reception.escalate
            ? ("escalate" as const)
            : ("deterministic" as const),
          reason: `Recepcionista Digital: ${reception.path}`,
          draftResponse: reply,
          requiredToolNames: [] as string[],
        },
        toolInvocations: [],
        auditor: { verified: true, issues: [] as string[] },
        context: {
          organizationId,
          propertyId: conversation.propertyId ?? null,
          reservationId: conversation.reservationId ?? null,
          knownFacts: memory.facts,
          missingFacts: [],
          recentGuestMessages: [],
          builtAt: new Date().toISOString(),
        },
        outboundBlocked: true as const,
        createdAt: new Date().toISOString(),
      } satisfies ConciergeAgentRun;

      return {
        conversation: withAssistant,
        run: fakeRun,
        suggestedReply: reply,
        autoEligible: true,
        mayAutoSend:
          input.mode === "autonomous" &&
          !isRecentDuplicateOutbound(memory.recent, reply, outboundAck),
        mode: input.mode,
        usedLlm: false,
        learningRecorded: false,
        observability: {
          toolsUsed: [],
          factKeys: Object.keys(memory.facts),
          llmTokens: null,
          path: reception.path,
        },
      };
    }
  }

  // Safety net: never fall through to Concierge LLM / hospitality / utterance banks.
  const guestAppendBlocked = appendMessage(conversation, {
    role: "guest",
    body: input.guestMessage,
    externalMessageId: input.externalMessageId,
  });
  const blockedRun = {
    id: `reception_blocked_${Date.now().toString(36)}`,
    conversationId: guestAppendBlocked.conversation.id,
    organizationId,
    inboundMessageId: guestAppendBlocked.message.id,
    intent: {
      intent: "OTHER" as const,
      confidence: 1,
      level: "L1" as const,
      source: "concierge-rules" as const,
    },
    decision: {
      path: "deterministic" as const,
      reason: "Recepcionista Digital: blocked legacy Concierge compose",
      draftResponse: null,
      requiredToolNames: [] as string[],
    },
    toolInvocations: [],
    auditor: { verified: true, issues: [] as string[] },
    context: {
      organizationId,
      propertyId: conversation.propertyId ?? null,
      reservationId: conversation.reservationId ?? null,
      knownFacts: memory.facts,
      missingFacts: [],
      recentGuestMessages: [],
      builtAt: new Date().toISOString(),
    },
    outboundBlocked: true as const,
    createdAt: new Date().toISOString(),
  } satisfies ConciergeAgentRun;
  return {
    conversation: guestAppendBlocked.conversation,
    run: blockedRun,
    suggestedReply: null,
    autoEligible: false,
    mayAutoSend: false,
    mode: input.mode,
    usedLlm: false,
    learningRecorded: false,
    observability: {
      toolsUsed: [],
      factKeys: Object.keys(memory.facts),
      llmTokens: null,
      path: "reception:blocked_legacy",
      silent: true,
    },
  };
}

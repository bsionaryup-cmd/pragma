/**
 * Intent Router — rules only (no LLM).
 * Thin facade over resolveWorkflowRoute + utterance helpers.
 */
export {
  resolveWorkflowRoute,
  type ConciergeWorkflowRoute,
} from "@/modules/ai-concierge/dialogue/workflow-menu";

export {
  detectConciergeIntent,
} from "@/modules/ai-concierge/intent/detect";

export {
  matchGuestUtterance,
} from "@/modules/ai-concierge/intent/utterance-bank";

import { resolveWorkflowRoute } from "@/modules/ai-concierge/dialogue/workflow-menu";
import { PENDING_ACTION_TO_RESERVATION_STEP } from "@/modules/ai-concierge/conversation-engine/types";
import type { ReservationWorkflowStep } from "@/modules/ai-concierge/conversation-engine/types";

/** Route guest text to a menu/workflow leaf without LLM. */
export function routeGuestIntent(text: string) {
  return resolveWorkflowRoute(text);
}

export function mapPendingActionToStep(
  pendingAction: string | null | undefined,
): ReservationWorkflowStep | null {
  if (!pendingAction) return null;
  return PENDING_ACTION_TO_RESERVATION_STEP[pendingAction] ?? null;
}

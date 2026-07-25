/**
 * Workflow Engine — step transitions only (no send, no Prisma).
 */
import { RESERVATION_STEP_MACHINE } from "@/modules/ai-concierge/conversation-engine/workflow-registry";
import {
  PENDING_ACTION_TO_RESERVATION_STEP,
  type ReservationWorkflowStep,
} from "@/modules/ai-concierge/conversation-engine/types";

export function getNextReservationStep(
  current: ReservationWorkflowStep,
): ReservationWorkflowStep | null {
  return RESERVATION_STEP_MACHINE[current]?.next ?? null;
}

export function advanceReservationStep(
  current: ReservationWorkflowStep,
): ReservationWorkflowStep | null {
  return getNextReservationStep(current);
}

/** Map runtime pendingAction → formal step; default MENU. */
export function resolveReservationStepFromPending(
  pendingAction: string | null | undefined,
): ReservationWorkflowStep {
  if (!pendingAction) return "MENU";
  return PENDING_ACTION_TO_RESERVATION_STEP[pendingAction] ?? "MENU";
}

/**
 * pendingAction that should be written when entering a formal step.
 * Keeps compatibility with availability-flow / workflow-menu.
 */
export const RESERVATION_STEP_TO_PENDING: Partial<
  Record<ReservationWorkflowStep, string>
> = {
  WELCOME: "await_menu_choice",
  MENU: "await_menu_choice",
  RESERVATION: "ask_dates_guests",
  PEOPLE: "ask_dates_guests",
  CHECKIN: "ask_dates_guests",
  CHECKOUT: "ask_dates_guests",
  AVAILABILITY: "show_availability",
  SUMMARY: "await_book_confirm",
  CONFIRM: "await_final_confirm",
  GUEST_DATA: "ask_guest_name",
  CREATE_RESERVATION: "await_final_confirm",
  FINISHED: "booking_created",
};

export function pendingActionForStep(
  step: ReservationWorkflowStep,
): string | null {
  return RESERVATION_STEP_TO_PENDING[step] ?? null;
}

export type StepTransition = {
  from: ReservationWorkflowStep;
  to: ReservationWorkflowStep | null;
  pendingAction: string | null;
};

export function transitionReservationStep(
  from: ReservationWorkflowStep,
): StepTransition {
  const to = advanceReservationStep(from);
  return {
    from,
    to,
    pendingAction: to ? pendingActionForStep(to) : "booking_created",
  };
}

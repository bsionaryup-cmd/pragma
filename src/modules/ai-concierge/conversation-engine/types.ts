/**
 * Conversation Engine — shared types (rule-based / state machine).
 * No LLM. Persistence lives in ConciergeConversationState via fact-memory.
 */

/** Formal reservation workflow steps (plan Fase 3). */
export const RESERVATION_WORKFLOW_STEPS = [
  "WELCOME",
  "MENU",
  "RESERVATION",
  "PEOPLE",
  "CHECKIN",
  "CHECKOUT",
  "AVAILABILITY",
  "SUMMARY",
  "CONFIRM",
  "GUEST_DATA",
  "CREATE_RESERVATION",
  "FINISHED",
] as const;

export type ReservationWorkflowStep =
  (typeof RESERVATION_WORKFLOW_STEPS)[number];

/**
 * Maps Concierge pendingAction / flow → plan step (documentation + tests).
 * Runtime still uses pendingAction strings in availability-flow / workflow-menu.
 */
export const PENDING_ACTION_TO_RESERVATION_STEP: Record<
  string,
  ReservationWorkflowStep
> = {
  await_menu_choice: "MENU",
  ask_guests: "PEOPLE",
  ask_dates_guests: "PEOPLE",
  ask_check_in: "CHECKIN",
  ask_check_out: "CHECKOUT",
  ask_dates: "CHECKIN",
  show_availability: "AVAILABILITY",
  await_book_confirm: "SUMMARY",
  await_final_confirm: "CONFIRM",
  ask_guest_name: "GUEST_DATA",
  ask_guest_email: "GUEST_DATA",
  booking_created: "FINISHED",
  human_review: "FINISHED",
};

export type ConversationEngineSession = {
  organizationId: string;
  phoneOrThreadId: string;
  workflowId: string | null;
  step: ReservationWorkflowStep | string | null;
  context: Record<string, string | number | boolean | null>;
  lastInteractionAt: string | null;
  status: "active" | "idle" | "escalated" | "finished";
};

export type WorkflowStepDefinition = {
  id: ReservationWorkflowStep;
  messageHint: string;
  validationHint: string;
  next: ReservationWorkflowStep | null;
  onError: "reprompt" | "menu" | "escalate" | "end";
};

/** Shared adapter contract (no server-only) — implemented by reservation-adapter.ts */
export type ReservationAdapterInput = {
  scope: {
    organizationId: string | null;
    userId: string;
  };
  allowedPropertyIds?: string[];
  allowedTools?: string[];
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guestFirstName: string;
  guestLastName?: string;
  guestEmail?: string;
  guestPhone?: string;
  adults?: number;
};

export type ReservationAdapterResult = {
  ok: boolean;
  reservationId?: string;
  quoteSummary?: string;
  steps: Array<{ step: string; ok: boolean; detail?: unknown; error?: string }>;
  via: "commercial_booking_flow";
};

/**
 * Hospitality Protocol Engine — types (v3.0).
 * Additive on fact-memory / workflow-menu. One active protocol per conversation.
 */

export const HOSPITALITY_PROTOCOLS = [
  "WELCOME",
  "MAIN_MENU",
  "BOOKINGS",
  "BOOKING_CREATE",
  "MY_RESERVATION",
  "STAY",
  "PAYMENTS",
  "RECEPTION",
  "IDLE",
] as const;

export type HospitalityProtocolId = (typeof HOSPITALITY_PROTOCOLS)[number];

export type ProtocolStatus =
  | "active"
  | "awaiting_guest"
  | "awaiting_tool"
  | "finished"
  | "escalated";

/** SSOT snapshot persisted in Concierge facts (no new table). */
export type ProtocolRuntimeState = {
  activeProtocol: HospitalityProtocolId;
  objective: string;
  step: string;
  collectedKeys: string[];
  pendingKeys: string[];
  pendingTool: string | null;
  lastAction: string | null;
  nextAction: string | null;
  status: ProtocolStatus;
};

export type HospitalityProtocolDefinition = {
  id: HospitalityProtocolId;
  name: string;
  objective: string;
  required: string[];
  optional: string[];
  validations: string[];
  pmsQueries: string[];
  tools: string[];
  advanceWhen: string;
  finishWhen: string;
  escalateWhen: string;
  /** workflow-menu workflowIds / menuGroups that belong here */
  workflowIds: string[];
};

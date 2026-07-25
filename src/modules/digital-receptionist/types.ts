/**
 * Recepcionista Digital v2 — tipos del motor de workflows (sin IA).
 * Fase 1–2: contratos; persistencia Prisma en Fase 2.
 */

export type ReceptionConversationStatus =
  | "WELCOME"
  | "MENU"
  | "BOOKING"
  | "CHECKIN"
  | "STAY"
  | "SUPPORT"
  | "CHECKOUT"
  | "FINISHED"
  | "HUMAN";

export type ReceptionNodeType =
  | "message"
  | "question"
  | "buttons"
  | "list"
  | "condition"
  | "action"
  | "wait"
  | "transfer"
  | "end";

export type ReceptionActionKey =
  | "send_message"
  | "wait_reply"
  | "request_photo"
  | "request_location"
  | "search_availability"
  | "create_reservation"
  | "lookup_reservation"
  | "create_task"
  | "create_incident"
  | "send_ttlock"
  | "send_email"
  | "send_location"
  | "transfer_human"
  | "close_conversation";

export type ReceptionButton = {
  id: string;
  label: string;
  nextNodeId: string | null;
  value?: string;
  icon?: string;
  enabled?: boolean;
  sortOrder?: number;
};

export type ReceptionNode = {
  id: string;
  name: string;
  type: ReceptionNodeType;
  message: string;
  variables: string[];
  buttons: ReceptionButton[];
  validations: string[];
  action: ReceptionActionKey | null;
  nextNodeId: string | null;
};

export type ReceptionWorkflow = {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  entryNodeId: string | null;
  nodes: ReceptionNode[];
  version: number;
};

export type ReceptionMenuItem = {
  id: string;
  n: number;
  label: string;
  icon: string;
  workflowKey: string;
  enabled: boolean;
};

export type ReceptionWelcomeConfig = {
  message: string;
  buttons: ReceptionButton[];
  showMenuAfter: boolean;
};

export type ReceptionRuntimeState = {
  conversationId: string;
  organizationId: string;
  threadId: string;
  status: ReceptionConversationStatus;
  workflowKey: string | null;
  nodeId: string | null;
  variables: Record<string, string | number | boolean | null>;
  updatedAt: string;
};

/** System variables available for templates. */
export const RECEPTION_SYSTEM_VARIABLES = [
  "nombre",
  "telefono",
  "correo",
  "checkin",
  "checkout",
  "propiedad",
  "codigo",
  "wifi",
  "direccion",
  "recepcion",
  "link_pago",
] as const;

export const DEFAULT_RECEPTION_MENU: ReceptionMenuItem[] = [
  {
    id: "m1",
    n: 1,
    label: "Reservar alojamiento",
    icon: "1️⃣",
    workflowKey: "booking",
    enabled: true,
  },
  {
    id: "m2",
    n: 2,
    label: "Ya tengo reserva",
    icon: "2️⃣",
    workflowKey: "my_reservation",
    enabled: true,
  },
  {
    id: "m3",
    n: 3,
    label: "Estoy hospedado",
    icon: "3️⃣",
    workflowKey: "stay",
    enabled: true,
  },
  {
    id: "m4",
    n: 4,
    label: "Problema habitación",
    icon: "4️⃣",
    workflowKey: "room_issue",
    enabled: true,
  },
  {
    id: "m5",
    n: 5,
    label: "Recomendaciones",
    icon: "5️⃣",
    workflowKey: "recommendations",
    enabled: true,
  },
  {
    id: "m6",
    n: 6,
    label: "Hablar con recepción",
    icon: "6️⃣",
    workflowKey: "human",
    enabled: true,
  },
];

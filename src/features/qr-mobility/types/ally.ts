import type { MobilityAlly, MobilityAllyType, MobilityRecordStatus } from "@prisma/client";

export type MobilityAllyRow = MobilityAlly;

export const MOBILITY_ALLY_TYPES: MobilityAllyType[] = [
  "ACCOMMODATION",
  "AGENCY",
  "TRANSPORT",
  "TOUR_OPERATOR",
  "OTHER",
];

export const MOBILITY_RECORD_STATUSES: MobilityRecordStatus[] = ["ACTIVE", "INACTIVE"];

const ALLY_TYPE_LABELS: Record<MobilityAllyType, string> = {
  ACCOMMODATION: "Alojamiento",
  AGENCY: "Agencia",
  TRANSPORT: "Transporte",
  TOUR_OPERATOR: "Operador turístico",
  OTHER: "Otro",
};

const STATUS_LABELS: Record<MobilityRecordStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
};

export function formatMobilityAllyType(type: MobilityAllyType): string {
  return ALLY_TYPE_LABELS[type];
}

export function formatMobilityRecordStatus(status: MobilityRecordStatus): string {
  return STATUS_LABELS[status];
}

export type MobilityAllyFormValues = {
  name: string;
  type: MobilityAllyType;
  company: string;
  phone: string;
  email: string;
  commissionPercent: string;
  status: MobilityRecordStatus;
  notes: string;
};

export function emptyMobilityAllyFormValues(): MobilityAllyFormValues {
  return {
    name: "",
    type: "OTHER",
    company: "",
    phone: "",
    email: "",
    commissionPercent: "",
    status: "ACTIVE",
    notes: "",
  };
}

export function allyToFormValues(
  ally: MobilityAllyRow | SerializedMobilityAllyRow,
): MobilityAllyFormValues {
  return {
    name: ally.name,
    type: ally.type,
    company: ally.company ?? "",
    phone: ally.phone ?? "",
    email: ally.email ?? "",
    commissionPercent:
      ally.commissionPercent != null ? String(Number(ally.commissionPercent)) : "",
    status: ally.status,
    notes: ally.notes ?? "",
  };
}

export function serializeMobilityAllyForClient(ally: MobilityAllyRow) {
  return {
    ...ally,
    commissionPercent:
      ally.commissionPercent != null ? Number(ally.commissionPercent) : null,
    createdAt: ally.createdAt.toISOString(),
    updatedAt: ally.updatedAt.toISOString(),
    deletedAt: ally.deletedAt?.toISOString() ?? null,
  };
}

export type SerializedMobilityAllyRow = ReturnType<typeof serializeMobilityAllyForClient>;

import "server-only";

import type { Prisma, User } from "@prisma/client";
import { writePlatformAuditLog } from "@/services/platform/platform-audit.service";

export type MobilityAuditAction =
  | "mobility_ally_create"
  | "mobility_ally_update"
  | "mobility_ally_deactivate"
  | "mobility_ally_qr_regenerate"
  | "mobility_service_create"
  | "mobility_service_update"
  | "mobility_service_deactivate";

type MobilityAuditInput = {
  platformUser: Pick<User, "id" | "email">;
  action: MobilityAuditAction;
  previousState?: Prisma.InputJsonValue;
  newState?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

export async function writeMobilityAuditLog(input: MobilityAuditInput): Promise<void> {
  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: input.action,
    previousState: input.previousState,
    newState: input.newState,
    metadata: input.metadata,
  });
}

function serializeAllyState(ally: {
  id: string;
  name: string;
  type: string;
  status: string;
  code: string;
  publicUrl: string;
}) {
  return {
    id: ally.id,
    name: ally.name,
    type: ally.type,
    status: ally.status,
    code: ally.code,
    publicUrl: ally.publicUrl,
  };
}

function serializeServiceState(service: {
  id: string;
  name: string;
  category: string;
  status: string;
  basePrice: unknown;
}) {
  return {
    id: service.id,
    name: service.name,
    category: service.category,
    status: service.status,
    basePrice: String(service.basePrice),
  };
}

export const mobilityAuditSerializers = {
  ally: serializeAllyState,
  service: serializeServiceState,
};

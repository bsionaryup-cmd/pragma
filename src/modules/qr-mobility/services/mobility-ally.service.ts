import "server-only";

import type { MobilityAllyType, MobilityRecordStatus, User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  mobilityAuditSerializers,
  writeMobilityAuditLog,
} from "@/modules/qr-mobility/services/mobility-audit.service";
import {
  buildMobilityPublicUrl,
  generateMobilityQrImageDataUrl,
  generateMobilityQrToken,
  slugifyAllyCode,
} from "@/modules/qr-mobility/services/mobility-qr.service";

const ACTIVE_ALLY_WHERE = { deletedAt: null } as const;

export type MobilityAllyFormInput = {
  name: string;
  type: MobilityAllyType;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  commissionPercent?: number | null;
  status?: MobilityRecordStatus;
  notes?: string | null;
};

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = normalizeOptional(value);
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error("Correo electrónico no válido");
  }
  return trimmed.toLowerCase();
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre es obligatorio");
  if (trimmed.length > 200) throw new Error("El nombre es demasiado largo");
  return trimmed;
}

function validateCommission(value: number | null | undefined): Prisma.Decimal | null {
  if (value == null || Number.isNaN(value)) return null;
  if (value < 0 || value > 100) {
    throw new Error("La comisión debe estar entre 0 y 100");
  }
  return new Prisma.Decimal(value.toFixed(2));
}

function validateStatus(status: MobilityRecordStatus | undefined): MobilityRecordStatus {
  if (!status || (status !== "ACTIVE" && status !== "INACTIVE")) {
    throw new Error("Estado no válido");
  }
  return status;
}

const MAX_NOTES_LENGTH = 16_000;

function normalizeNotes(value: string | null | undefined): string | null {
  const trimmed = normalizeOptional(value);
  if (!trimmed) return null;
  if (trimmed.length <= MAX_NOTES_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_NOTES_LENGTH - 1)}…`;
}

async function ensureUniqueCode(baseName: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = slugifyAllyCode(baseName);
    const existing = await db.mobilityAlly.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error("No fue posible generar un código único");
}

async function buildQrFields() {
  const qrToken = generateMobilityQrToken();
  const publicUrl = buildMobilityPublicUrl(qrToken);
  const qrImageDataUrl = await generateMobilityQrImageDataUrl(publicUrl);
  return { qrToken, publicUrl, qrImageDataUrl };
}

export async function listMobilityAllies(options?: { includeInactive?: boolean }) {
  return db.mobilityAlly.findMany({
    where: {
      ...ACTIVE_ALLY_WHERE,
      ...(options?.includeInactive ? {} : { status: "ACTIVE" }),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMobilityAllyById(id: string) {
  return db.mobilityAlly.findFirst({
    where: { id, ...ACTIVE_ALLY_WHERE },
  });
}

export async function getMobilityAllyByToken(token: string) {
  return db.mobilityAlly.findFirst({
    where: { qrToken: token, deletedAt: null, status: "ACTIVE" },
  });
}

export async function createMobilityAlly(
  input: MobilityAllyFormInput & { createdById: string },
  platformUser: Pick<User, "id" | "email">,
) {
  const name = validateName(input.name);
  const code = await ensureUniqueCode(name);
  const qrFields = await buildQrFields();

  const ally = await db.mobilityAlly.create({
    data: {
      name,
      type: input.type,
      company: normalizeOptional(input.company),
      phone: normalizeOptional(input.phone),
      email: normalizeEmail(input.email),
      commissionPercent: validateCommission(input.commissionPercent),
      status: "ACTIVE",
      code,
      notes: normalizeNotes(input.notes),
      createdById: input.createdById,
      ...qrFields,
    },
  });

  await writeMobilityAuditLog({
    platformUser,
    action: "mobility_ally_create",
    newState: mobilityAuditSerializers.ally(ally),
  });

  return ally;
}

export async function updateMobilityAlly(
  id: string,
  input: MobilityAllyFormInput,
  platformUser: Pick<User, "id" | "email">,
) {
  const existing = await getMobilityAllyById(id);
  if (!existing) throw new Error("Aliado no encontrado");

  const ally = await db.mobilityAlly.update({
    where: { id },
    data: {
      name: validateName(input.name),
      type: input.type,
      company: normalizeOptional(input.company),
      phone: normalizeOptional(input.phone),
      email: normalizeEmail(input.email),
      commissionPercent: validateCommission(input.commissionPercent),
      status: validateStatus(input.status ?? existing.status),
      notes: normalizeNotes(input.notes),
    },
  });

  await writeMobilityAuditLog({
    platformUser,
    action: "mobility_ally_update",
    previousState: mobilityAuditSerializers.ally(existing),
    newState: mobilityAuditSerializers.ally(ally),
  });

  return ally;
}

export async function deactivateMobilityAlly(
  id: string,
  platformUser: Pick<User, "id" | "email">,
) {
  const existing = await getMobilityAllyById(id);
  if (!existing) throw new Error("Aliado no encontrado");

  const ally = await db.mobilityAlly.update({
    where: { id },
    data: { status: "INACTIVE" },
  });

  await writeMobilityAuditLog({
    platformUser,
    action: "mobility_ally_deactivate",
    previousState: mobilityAuditSerializers.ally(existing),
    newState: mobilityAuditSerializers.ally(ally),
  });

  return ally;
}

export async function softDeleteMobilityAlly(
  id: string,
  platformUser: Pick<User, "id" | "email">,
) {
  const existing = await getMobilityAllyById(id);
  if (!existing) throw new Error("Aliado no encontrado");

  const ally = await db.mobilityAlly.update({
    where: { id },
    data: { deletedAt: new Date(), status: "INACTIVE" },
  });

  await writeMobilityAuditLog({
    platformUser,
    action: "mobility_ally_deactivate",
    previousState: mobilityAuditSerializers.ally(existing),
    newState: mobilityAuditSerializers.ally(ally),
    metadata: { softDeleted: true },
  });

  return ally;
}

export async function regenerateMobilityAllyQr(
  id: string,
  platformUser: Pick<User, "id" | "email">,
) {
  const existing = await getMobilityAllyById(id);
  if (!existing) throw new Error("Aliado no encontrado");

  const qrFields = await buildQrFields();
  const ally = await db.mobilityAlly.update({
    where: { id },
    data: qrFields,
  });

  await writeMobilityAuditLog({
    platformUser,
    action: "mobility_ally_qr_regenerate",
    previousState: { publicUrl: existing.publicUrl, qrToken: existing.qrToken },
    newState: { publicUrl: ally.publicUrl, qrToken: ally.qrToken },
  });

  return ally;
}

export async function countMobilityAllies(): Promise<number> {
  return db.mobilityAlly.count({ where: ACTIVE_ALLY_WHERE });
}

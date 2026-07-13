import "server-only";

import type { MobilityRecordStatus, MobilityServiceCategory, User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  mobilityAuditSerializers,
  writeMobilityAuditLog,
} from "@/modules/qr-mobility/services/mobility-audit.service";

const ACTIVE_SERVICE_WHERE = { deletedAt: null } as const;

export type MobilityServiceFormInput = {
  name: string;
  category: MobilityServiceCategory;
  description?: string | null;
  basePrice: number;
  nightPrice?: number | null;
  holidayPrice?: number | null;
  scheduleText?: string | null;
  status?: MobilityRecordStatus;
  sortOrder?: number;
  imageUrl?: string | null;
  recommendedVehicle?: string | null;
  maxCapacity?: number | null;
  luggageAllowed?: string | null;
};

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validateName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre es obligatorio");
  if (trimmed.length > 200) throw new Error("El nombre es demasiado largo");
  return trimmed;
}

function validatePrice(value: number, label: string): Prisma.Decimal {
  if (Number.isNaN(value) || value < 0) {
    throw new Error(`${label} debe ser un número mayor o igual a 0`);
  }
  return new Prisma.Decimal(value.toFixed(2));
}

function validateOptionalPrice(
  value: number | null | undefined,
  label: string,
): Prisma.Decimal | null {
  if (value == null) return null;
  return validatePrice(value, label);
}

function validateStatus(status: MobilityRecordStatus | undefined): MobilityRecordStatus {
  if (!status || (status !== "ACTIVE" && status !== "INACTIVE")) {
    throw new Error("Estado no válido");
  }
  return status;
}

function validateSortOrder(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("El orden debe ser un entero mayor o igual a 0");
  }
  return value;
}

function validateMaxCapacity(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("La capacidad máxima debe ser un entero positivo");
  }
  return value;
}

const MAX_DESCRIPTION_LENGTH = 16_000;

function normalizeDescription(value: string | null | undefined): string | null {
  const trimmed = normalizeOptional(value);
  if (!trimmed) return null;
  if (trimmed.length <= MAX_DESCRIPTION_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`;
}

export async function listMobilityServices(options?: { includeInactive?: boolean }) {
  return db.mobilityService.findMany({
    where: {
      ...ACTIVE_SERVICE_WHERE,
      ...(options?.includeInactive ? {} : { status: "ACTIVE" }),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function getMobilityServiceById(id: string) {
  return db.mobilityService.findFirst({
    where: { id, ...ACTIVE_SERVICE_WHERE },
  });
}

export async function createMobilityService(
  input: MobilityServiceFormInput & { createdById: string },
  platformUser: Pick<User, "id" | "email">,
) {
  const service = await db.mobilityService.create({
    data: {
      name: validateName(input.name),
      category: input.category,
      description: normalizeDescription(input.description),
      basePrice: validatePrice(input.basePrice, "El precio base"),
      nightPrice: validateOptionalPrice(input.nightPrice, "El precio nocturno"),
      holidayPrice: validateOptionalPrice(input.holidayPrice, "El precio festivo"),
      scheduleText: normalizeOptional(input.scheduleText),
      status: "ACTIVE",
      sortOrder: validateSortOrder(input.sortOrder),
      imageUrl: normalizeOptional(input.imageUrl),
      recommendedVehicle: normalizeOptional(input.recommendedVehicle),
      maxCapacity: validateMaxCapacity(input.maxCapacity),
      luggageAllowed: normalizeOptional(input.luggageAllowed),
      createdById: input.createdById,
    },
  });

  await writeMobilityAuditLog({
    platformUser,
    action: "mobility_service_create",
    newState: mobilityAuditSerializers.service(service),
  });

  return service;
}

export async function updateMobilityService(
  id: string,
  input: MobilityServiceFormInput,
  platformUser: Pick<User, "id" | "email">,
) {
  const existing = await getMobilityServiceById(id);
  if (!existing) throw new Error("Servicio no encontrado");

  const service = await db.mobilityService.update({
    where: { id },
    data: {
      name: validateName(input.name),
      category: input.category,
      description: normalizeDescription(input.description),
      basePrice: validatePrice(input.basePrice, "El precio base"),
      nightPrice: validateOptionalPrice(input.nightPrice, "El precio nocturno"),
      holidayPrice: validateOptionalPrice(input.holidayPrice, "El precio festivo"),
      scheduleText: normalizeOptional(input.scheduleText),
      status: validateStatus(input.status ?? existing.status),
      sortOrder: validateSortOrder(input.sortOrder ?? existing.sortOrder),
      imageUrl: normalizeOptional(input.imageUrl),
      recommendedVehicle: normalizeOptional(input.recommendedVehicle),
      maxCapacity: validateMaxCapacity(input.maxCapacity),
      luggageAllowed: normalizeOptional(input.luggageAllowed),
    },
  });

  await writeMobilityAuditLog({
    platformUser,
    action: "mobility_service_update",
    previousState: mobilityAuditSerializers.service(existing),
    newState: mobilityAuditSerializers.service(service),
  });

  return service;
}

export async function deactivateMobilityService(
  id: string,
  platformUser: Pick<User, "id" | "email">,
) {
  const existing = await getMobilityServiceById(id);
  if (!existing) throw new Error("Servicio no encontrado");

  const service = await db.mobilityService.update({
    where: { id },
    data: { status: "INACTIVE" },
  });

  await writeMobilityAuditLog({
    platformUser,
    action: "mobility_service_deactivate",
    previousState: mobilityAuditSerializers.service(existing),
    newState: mobilityAuditSerializers.service(service),
  });

  return service;
}

export async function softDeleteMobilityService(
  id: string,
  platformUser: Pick<User, "id" | "email">,
) {
  const existing = await getMobilityServiceById(id);
  if (!existing) throw new Error("Servicio no encontrado");

  const service = await db.mobilityService.update({
    where: { id },
    data: { deletedAt: new Date(), status: "INACTIVE" },
  });

  await writeMobilityAuditLog({
    platformUser,
    action: "mobility_service_deactivate",
    previousState: mobilityAuditSerializers.service(existing),
    newState: mobilityAuditSerializers.service(service),
    metadata: { softDeleted: true },
  });

  return service;
}

export async function countMobilityServices(): Promise<number> {
  return db.mobilityService.count({ where: ACTIVE_SERVICE_WHERE });
}

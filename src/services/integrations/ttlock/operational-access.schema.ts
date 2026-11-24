import { AccessCodeType } from "@prisma/client";
import { z } from "zod";
import { localColombiaDateTime } from "@/lib/stay-schedule";

export const OPERATIONAL_ACCESS_MAX_DURATION_MS =
  365 * 24 * 60 * 60 * 1000;
export const OPERATIONAL_ACCESS_START_GRACE_MS = 5 * 60 * 1000;

export const operationalAccessCodeTypes = [
  AccessCodeType.CLEANER,
  AccessCodeType.MAINTENANCE,
  AccessCodeType.OWNER,
  AccessCodeType.GUEST,
] as const;

const localDateTime = z
  .string()
  .trim()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
    "Fecha y hora inválidas",
  );

const optionalCustomCode = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d{4,9}$/.test(value),
    "El código personalizado debe tener entre 4 y 9 dígitos",
  )
  .default("");

export const createOperationalAccessCodeSchema = z.object({
  propertyId: z.string().trim().min(1, "Selecciona una propiedad"),
  label: z
    .string()
    .trim()
    .min(2, "Indica para quién es el código")
    .max(50, "La etiqueta no puede superar 50 caracteres"),
  type: z.enum(operationalAccessCodeTypes),
  validFromLocal: localDateTime,
  validToLocal: localDateTime,
  customCode: optionalCustomCode,
  idempotencyKey: z.string().uuid("Solicitud inválida"),
});

export type CreateOperationalAccessCodeInput = z.infer<
  typeof createOperationalAccessCodeSchema
>;

export function parseOperationalLocalDateTime(value: string): Date | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    dateCheck.getUTCFullYear() !== year ||
    dateCheck.getUTCMonth() !== month - 1 ||
    dateCheck.getUTCDate() !== day
  ) {
    return null;
  }

  return localColombiaDateTime(
    `${match[1]}-${match[2]}-${match[3]}`,
    hours,
    minutes,
  );
}

export function validateOperationalAccessWindow(input: {
  validFrom: Date;
  validTo: Date;
  now?: Date;
}): { ok: true } | { ok: false; message: string } {
  const now = input.now ?? new Date();
  if (
    !Number.isFinite(input.validFrom.getTime()) ||
    !Number.isFinite(input.validTo.getTime())
  ) {
    return { ok: false, message: "Fecha y hora inválidas" };
  }
  if (input.validFrom >= input.validTo) {
    return {
      ok: false,
      message: "La fecha final debe ser posterior a la fecha inicial",
    };
  }
  if (
    input.validFrom.getTime() <
    now.getTime() - OPERATIONAL_ACCESS_START_GRACE_MS
  ) {
    return {
      ok: false,
      message: "La vigencia inicial no puede estar en el pasado",
    };
  }
  if (input.validTo <= now) {
    return { ok: false, message: "La vigencia final debe estar en el futuro" };
  }
  if (
    input.validTo.getTime() - input.validFrom.getTime() >
    OPERATIONAL_ACCESS_MAX_DURATION_MS
  ) {
    return {
      ok: false,
      message: "La vigencia máxima permitida es de 365 días",
    };
  }
  return { ok: true };
}


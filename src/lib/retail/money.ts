import { Prisma } from "@prisma/client";

export type DecimalLike = Prisma.Decimal | number | string;

export function toNumber(value: DecimalLike): number {
  const result = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(result)) throw new Error("Monto inválido");
  return result;
}

export function roundMoney(value: DecimalLike): number {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

export function formatCop(value: DecimalLike): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

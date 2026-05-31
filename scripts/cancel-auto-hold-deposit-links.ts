/**
 * Cancela enlaces de depósito 50% emitidos automáticamente al crear reserva directa.
 * Solo marca CANCELLED; no elimina reservas ni enlaces ya pagados.
 *
 * Uso:
 *   npx tsx scripts/cancel-auto-hold-deposit-links.ts           # dry-run (solo lista)
 *   npx tsx scripts/cancel-auto-hold-deposit-links.ts --execute # aplica cambios
 */
import { config } from "dotenv";
import { BookingPlatform } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ACTIVE_LINK_STATUSES = ["DRAFT", "SENT", "PENDING", "PROCESSING"] as const;
const execute = process.argv.includes("--execute");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function findAutoIssuedHoldDepositLinkIds(): Promise<string[]> {
  const candidates = await db.guestPaymentLink.findMany({
    where: {
      category: "DEPOSIT",
      status: { in: [...ACTIVE_LINK_STATUSES] },
      description: { startsWith: "Depósito 50%" },
      reservationId: { not: null },
      reservation: {
        platform: BookingPlatform.DIRECT,
        holdExpiresAt: { not: null },
      },
    },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      reservationId: true,
      reservation: {
        select: {
          createdAt: true,
          holdExpiresAt: true,
        },
      },
    },
    take: 200,
  });

  return candidates
    .filter((link) => {
      const reservation = link.reservation;
      if (!reservation?.holdExpiresAt || !link.expiresAt) return false;

      const createdDeltaMs = Math.abs(
        link.createdAt.getTime() - reservation.createdAt.getTime(),
      );
      if (createdDeltaMs > 5 * 60 * 1000) return false;

      const expiresDeltaMs = Math.abs(
        link.expiresAt.getTime() - reservation.holdExpiresAt.getTime(),
      );
      return expiresDeltaMs <= 2000;
    })
    .map((link) => link.id);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL requerido");
  }

  let total = 0;
  for (;;) {
    const ids = await findAutoIssuedHoldDepositLinkIds();
    if (ids.length === 0) break;

    console.log(
      execute
        ? `Cancelando ${ids.length} enlace(s): ${ids.join(", ")}`
        : `[dry-run] Se cancelarían ${ids.length} enlace(s): ${ids.join(", ")}`,
    );

    if (execute) {
      const result = await db.guestPaymentLink.updateMany({
        where: { id: { in: ids } },
        data: { status: "CANCELLED" },
      });
      total += result.count;
    } else {
      total += ids.length;
    }
  }

  console.log(
    execute
      ? `Listo. Enlaces cancelados: ${total}`
      : `[dry-run] Total candidatos: ${total}. Ejecuta con --execute para aplicar.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });

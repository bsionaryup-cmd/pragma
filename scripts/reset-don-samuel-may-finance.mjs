/**
 * Reinicia movimientos manuales de mayo 2026 (Don Samuel) y carga lote validado.
 * NO toca reservas ni ingresos de Airbnb/iCal.
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { ManualPaymentMethod, PrismaClient } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG_ID = "cmplxfg0a000105jrs0gqtwyc";
const dryRun = process.argv.includes("--dry-run");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const payload = JSON.parse(
  readFileSync(new URL("../data/don-samuel-may-finance-approved.json", import.meta.url), "utf8"),
);

function dateOnly(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toKey(date) {
  return date.toISOString().slice(0, 10);
}

function may2026Range() {
  return {
    start: dateOnly("2026-05-01"),
    end: dateOnly("2026-05-31"),
  };
}

async function resolveCreatorUserId() {
  const user = await db.user.findFirst({
    where: { organizationId: ORG_ID },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  });
  if (!user) throw new Error("Usuario de organización no encontrado");
  return user;
}

async function main() {
  const creator = await resolveCreatorUserId();
  const { start, end } = may2026Range();

  const mayExpensesBefore = await db.manualExpense.findMany({
    where: {
      createdBy: { organizationId: ORG_ID },
      expenseDate: { gte: start, lte: end },
    },
    select: {
      id: true,
      category: true,
      amount: true,
      expenseDate: true,
      description: true,
    },
  });

  const mayIncomesBefore = await db.otherIncome.findMany({
    where: {
      createdBy: { organizationId: ORG_ID },
      incomeDate: { gte: start, lte: end },
    },
    select: {
      id: true,
      amount: true,
      incomeDate: true,
      description: true,
      incomeType: true,
    },
  });

  console.log(`\nReinicio finanzas mayo 2026 · ${dryRun ? "DRY-RUN" : "ESCRITURA"}`);
  console.log(`Organización: ${ORG_ID}`);
  console.log(`Usuario creador: ${creator.email}`);
  console.log(`Movimientos mayo a eliminar: ${mayExpensesBefore.length} gastos, ${mayIncomesBefore.length} ingresos`);

  if (dryRun) {
    for (const row of mayExpensesBefore) {
      console.log(`  DEL gasto ${toKey(row.expenseDate)} · ${row.category} · ${row.amount}`);
    }
    for (const row of mayIncomesBefore) {
      console.log(`  DEL ingreso ${toKey(row.incomeDate)} · ${row.incomeType} · ${row.amount}`);
    }
    for (const row of payload.records) {
      console.log(`  ADD ${row.type} ${row.date} · ${row.concept} · ${row.amount}`);
    }
    return;
  }

  const deletedExpenses = await db.manualExpense.deleteMany({
    where: {
      id: { in: mayExpensesBefore.map((r) => r.id) },
    },
  });

  const deletedIncomes = await db.otherIncome.deleteMany({
    where: {
      id: { in: mayIncomesBefore.map((r) => r.id) },
    },
  });

  let createdExpenses = 0;
  let createdIncomes = 0;
  let skippedD1 = 0;

  for (const record of payload.records) {
    if (record.type === "expense") {
      if (record.date === "2026-04-30") {
        const existing = await db.manualExpense.findFirst({
          where: {
            createdBy: { organizationId: ORG_ID },
            expenseDate: dateOnly(record.date),
            category: record.category,
            amount: record.amount,
          },
        });
        if (existing) {
          skippedD1 += 1;
          continue;
        }
      }

      await db.manualExpense.create({
        data: {
          createdById: creator.id,
          category: record.category,
          amount: record.amount,
          paymentMethod: record.paymentMethod ?? ManualPaymentMethod.CASH,
          expenseDate: dateOnly(record.date),
          description: record.description,
        },
      });
      createdExpenses += 1;
      continue;
    }

    await db.otherIncome.create({
      data: {
        createdById: creator.id,
        amount: record.amount,
        incomeType: record.concept.slice(0, 80),
        incomeDate: dateOnly(record.date),
        description: record.description,
      },
    });
    createdIncomes += 1;
  }

  const allLoaded = await db.manualExpense.findMany({
    where: {
      createdBy: { organizationId: ORG_ID },
      OR: [
        { expenseDate: { gte: start, lte: end } },
        {
          expenseDate: dateOnly("2026-04-30"),
          category: "D1",
        },
      ],
    },
    select: { amount: true, category: true, expenseDate: true },
  });

  const loadedIncomes = await db.otherIncome.findMany({
    where: {
      createdBy: { organizationId: ORG_ID },
      incomeDate: { gte: start, lte: end },
    },
    select: { amount: true },
  });

  const reservationCount = await db.reservation.count({
    where: { property: { organizationId: ORG_ID } },
  });

  const totalExpenses = allLoaded.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalIncomes = loadedIncomes.reduce((sum, r) => sum + Number(r.amount), 0);
  const d1Total = allLoaded
    .filter((r) => r.category === "D1")
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const cleaningTotal = allLoaded
    .filter((r) => r.category === "Limpieza")
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const netFlow = totalIncomes - totalExpenses;

  console.log("\n════════════════ REPORTE DE VALIDACIÓN ════════════════");
  console.log(`Eliminados:  ${deletedExpenses.count} gastos + ${deletedIncomes.count} ingresos (solo mayo 2026)`);
  console.log(`Creados:     ${createdExpenses} gastos + ${createdIncomes} ingresos`);
  if (skippedD1 > 0) console.log(`D1 abr-30:   conservado (ya existía correcto)`);
  console.log(`\nTotales cargados (lote validado):`);
  console.log(`  Ingresos:        $${totalIncomes.toLocaleString("es-CO")} COP`);
  console.log(`  Gastos D1:       $${d1Total.toLocaleString("es-CO")} COP`);
  console.log(`  Gastos camería:  $${cleaningTotal.toLocaleString("es-CO")} COP`);
  console.log(`  Total gastos:    $${totalExpenses.toLocaleString("es-CO")} COP`);
  console.log(`  Flujo neto:      $${netFlow.toLocaleString("es-CO")} COP`);
  console.log(`\nReservas intactas: ${reservationCount} (ingresos Airbnb no modificados)`);

  const checks = [
    ["Ingresos $70.000", totalIncomes === 70000],
    ["Gastos D1 $45.090", d1Total === 45090],
    ["Camería $250.000", cleaningTotal === 250000],
    ["Total gastos $295.090", totalExpenses === 295090],
    ["Flujo neto -$225.090", netFlow === -225090],
    ["5 gastos mayo + D1", allLoaded.length === 6],
    ["1 ingreso mayo", loadedIncomes.length === 1],
  ];

  console.log("\n── Checklist ──");
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "✓" : "✗"} ${label}`);
    if (!pass) ok = false;
  }
  console.log(`\n${ok ? "RESULTADO: OK" : "RESULTADO: REVISAR"}\n`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });

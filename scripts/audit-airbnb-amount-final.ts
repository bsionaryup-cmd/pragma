/**
 * Auditoría final: stored totalAmount vs payout autoritativo Airbnb.
 * Escanea todas las orgs con integración Airbnb habilitada.
 *
 *   npx tsx scripts/audit-airbnb-amount-final.ts [organizationId]
 *   npx tsx scripts/audit-airbnb-amount-final.ts --repair [organizationId]
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import {
  BookingPlatform,
  PrismaClient,
  ReservationStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { pickFinanceRevenueEmailEvents } from "@/lib/finance/reservation-finance-trace";
import {
  buildReservationRevenueSourcesFromEmailEvent,
  resolveFinanceReservationRevenueAmount,
} from "@/lib/finance/reservation-revenue-amount";
import {
  pickAuthoritativeHostRevenueAmount,
} from "@/modules/airbnb-email/domains/safe-reservation-enrichment";
import { applyFinancialBackfill } from "@/modules/airbnb-email/repair/apply-financial-backfill";
import { refreshAuditSignalsFromRaw } from "@/modules/airbnb-email/repair/refresh-audit-signals-from-raw";
import { extractReservationSignals } from "@/modules/airbnb-email/parsing/extractors";

config();
config({ path: ".env.local", override: true });

const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const repair = process.argv.includes("--repair");
const orgArg = args[0];
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function readAmount(value: unknown): number {
  if (value == null) return 0;
  const n =
    typeof value === "object" && value !== null && "toNumber" in value
      ? Number((value as { toNumber: () => number }).toNumber())
      : Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function resolveOrgIds(singleOrg?: string): Promise<string[]> {
  if (singleOrg?.trim()) return [singleOrg.trim()];
  const rows = await db.tenantAirbnbEmailIntegration.findMany({
    where: { enabled: true },
    select: { organizationId: true },
  });
  return rows.map((r) => r.organizationId);
}

async function auditOrg(organizationId: string) {
  const reservations = await db.reservation.findMany({
    where: {
      platform: BookingPlatform.AIRBNB,
      status: { not: ReservationStatus.CANCELLED },
      property: { organizationId },
    },
    select: {
      id: true,
      guestName: true,
      reservationCode: true,
      totalAmount: true,
      checkIn: true,
      status: true,
      emailEvents: {
        select: {
          eventKind: true,
          reservationId: true,
          enrichedFields: true,
          payload: true,
          audit: {
            select: { parsedPayload: true, rawEmail: true, subject: true },
          },
        },
      },
    },
    orderBy: { checkIn: "desc" },
  });

  const statusById = new Map(reservations.map((r) => [r.id, r.status]));
  const mismatches: Array<Record<string, unknown>> = [];
  let zeroStored = 0;
  let noAuthoritative = 0;
  let aligned = 0;

  for (const row of reservations) {
    const stored = readAmount(row.totalAmount);
    if (stored === 0) zeroStored += 1;

    const picked = pickFinanceRevenueEmailEvents(row.emailEvents, statusById);
    const best = picked.get(row.id);

    let authoritative = 0;
    if (best) {
      const raw = best.audit.rawEmail as Record<string, unknown> | null;
      const fresh = extractReservationSignals({
        subject: String(raw?.subject ?? best.audit.subject ?? ""),
        body: String(raw?.text ?? ""),
        html: typeof raw?.html === "string" ? raw.html : null,
      });
      const refreshed = refreshAuditSignalsFromRaw({
        parsedPayload: best.audit.parsedPayload,
        rawEmail: best.audit.rawEmail,
        subject: best.audit.subject,
      });
      authoritative =
        pickAuthoritativeHostRevenueAmount(fresh) ??
        pickAuthoritativeHostRevenueAmount(refreshed ?? {}) ??
        0;

      const sources = buildReservationRevenueSourcesFromEmailEvent(best);
      const financeAmount = resolveFinanceReservationRevenueAmount(row, sources);

      if (authoritative <= 0 && financeAmount > 0) authoritative = financeAmount;

      const storedVsAuth = Math.abs(stored - authoritative);
      const storedVsFinance = Math.abs(stored - financeAmount);
      const financeVsAuth =
        authoritative > 0 && financeAmount > 0
          ? Math.abs(financeAmount - authoritative)
          : 0;

      if (authoritative <= 0 && financeAmount <= 0) {
        if (stored === 0) noAuthoritative += 1;
        continue;
      }

      if (storedVsAuth < 1 && storedVsFinance < 1 && financeVsAuth < 1) {
        aligned += 1;
        continue;
      }

      mismatches.push({
        kind: "amount_mismatch",
        id: row.id,
        guest: row.guestName,
        checkIn: row.checkIn.toISOString().slice(0, 10),
        status: row.status,
        code: row.reservationCode,
        stored,
        authoritative,
        financeAmount,
        deltaStoredVsAuth: storedVsAuth,
        deltaFinanceVsAuth: financeVsAuth,
        hostPayout: fresh.hostPayoutAmount,
        gross: fresh.grossAmount,
        guestTotal: fresh.guestTotalPaid,
      });
    } else if (stored === 0) {
      noAuthoritative += 1;
    } else if (stored > 0) {
      mismatches.push({
        kind: "unverified_no_email",
        id: row.id,
        guest: row.guestName,
        checkIn: row.checkIn.toISOString().slice(0, 10),
        stored,
        note: "Sin evento email; monto no verificable contra Airbnb",
      });
    }
  }

  const amountMismatches = mismatches.filter((m) => m.kind === "amount_mismatch");
  const unverified = mismatches.filter((m) => m.kind === "unverified_no_email");

  const repaired: Array<Record<string, unknown>> = [];
  if (repair && amountMismatches.length > 0) {
    const runId = randomUUID();
    for (const m of amountMismatches) {
      if (typeof m.id !== "string") continue;
      const result = await applyFinancialBackfill({ runId, reservationId: m.id });
      if (result.status === "applied") {
        repaired.push({ id: m.id, guest: m.guest, amount: result.amount });
      }
    }
  }

  return {
    organizationId,
    scanned: reservations.length,
    aligned,
    zeroStored,
    noAuthoritative,
    amountMismatches: amountMismatches.length,
    unverifiedNoEmail: unverified.length,
    details: mismatches,
    repaired,
  };
}

async function main() {
  const orgIds = await resolveOrgIds(orgArg);
  const results = [];
  for (const orgId of orgIds) {
    results.push(await auditOrg(orgId));
  }

  const summary = {
    orgs: results.length,
    totalScanned: results.reduce((s, r) => s + r.scanned, 0),
    totalAligned: results.reduce((s, r) => s + r.aligned, 0),
    totalAmountMismatches: results.reduce((s, r) => s + r.amountMismatches, 0),
    totalUnverifiedNoEmail: results.reduce((s, r) => s + r.unverifiedNoEmail, 0),
    totalRepaired: results.reduce((s, r) => s + r.repaired.length, 0),
    repairMode: repair,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });

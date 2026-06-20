/**
 * Audit Airbnb finance vs host CSV + optional repair of totalAmount to authoritative Ganas.
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import {
  PrismaClient,
  BookingPlatform,
  ReservationStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { pickFinanceRevenueEmailEventsByQuality } from "@/lib/finance/reservation-finance-trace";
import {
  buildReservationRevenueSourcesFromEmailEvent,
  resolveFinanceReservationRevenueAmount,
} from "@/lib/finance/reservation-revenue-amount";
import { resolveAuthoritativeHostPayout } from "@/lib/finance/resolve-authoritative-host-payout";

config();
config({ path: ".env.local", override: true });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const orgId =
  process.argv.find((a) => a.startsWith("--org="))?.split("=")[1] ||
  "cmplxfg0a000105jrs0gqtwyc";
const csvPath = process.argv.find((a) => a.startsWith("--csv="))?.split("=")[1];
const repair = process.argv.includes("--repair");

type CsvRow = {
  code: string;
  status: string;
  guest: string;
  csvIngresos: number;
};

function parseCsvAmount(raw: string): number {
  const cleaned = raw.replace(/[$"\s]/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseCsv(filePath: string): CsvRow[] {
  const text = readFileSync(filePath, "utf8");
  const lines = text.trim().split(/\r?\n/);
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === "," && !inQ) {
        cols.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    cols.push(cur);
    rows.push({
      code: cols[0]?.trim() ?? "",
      status: cols[1]?.trim() ?? "",
      guest: cols[2]?.trim() ?? "",
      csvIngresos: parseCsvAmount(cols[12] ?? "0"),
    });
  }
  return rows;
}

function readRawEmail(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const html = typeof record.html === "string" ? record.html : undefined;
  const text = typeof record.text === "string" ? record.text : undefined;
  return html || text ? { html, text } : null;
}

function near(a: number, b: number, tol = 1): boolean {
  return Math.abs(a - b) <= tol;
}

async function main() {
  if (!csvPath) throw new Error("Pass --csv=path");
  const csvRows = parseCsv(csvPath);

  const dbRows = await db.reservation.findMany({
    where: {
      property: { organizationId: orgId },
      reservationCode: { in: csvRows.map((r) => r.code).filter(Boolean) },
    },
    select: {
      id: true,
      reservationCode: true,
      guestName: true,
      totalAmount: true,
      platform: true,
      status: true,
      checkIn: true,
      checkOut: true,
      icalUid: true,
    },
  });

  const dbByCode = new Map(dbRows.map((r) => [r.reservationCode!, r]));
  type ResultRow = Record<string, unknown>;
  const results: ResultRow[] = [];
  const repairs: { id: string; code: string; from: number; to: number }[] = [];

  for (const csv of csvRows) {
    const reservation = dbByCode.get(csv.code);
    if (!reservation) {
      results.push({ code: csv.code, guest: csv.guest, issue: "NOT_IN_DB", csv: csv.csvIngresos });
      continue;
    }

    const events = await db.reservationEmailEvent.findMany({
      where: { reservationId: reservation.id },
      select: {
        reservationId: true,
        auditId: true,
        eventKind: true,
        confirmationCode: true,
        enrichedFields: true,
        payload: true,
        audit: { select: { processedAt: true, rawEmail: true } },
      },
    });

    const meta = {
      reservationCode: reservation.reservationCode,
      checkIn: reservation.checkIn.toISOString().slice(0, 10),
      checkOut: reservation.checkOut.toISOString().slice(0, 10),
    };

    const picked = pickFinanceRevenueEmailEventsByQuality(
      events.map((e) => ({
        reservationId: e.reservationId,
        eventKind: e.eventKind,
        enrichedFields: e.enrichedFields,
        payload: e.payload,
        auditId: e.auditId,
        processedAt: e.audit.processedAt,
        rawEmail: readRawEmail(e.audit.rawEmail),
      })),
      new Map([[reservation.id, reservation.status]]),
      new Map([[reservation.id, meta]]),
    );

    const pickedRow = picked.get(reservation.id);
    const sources = pickedRow
      ? buildReservationRevenueSourcesFromEmailEvent({
          enrichedFields: pickedRow.enrichedFields,
          payload: pickedRow.payload,
          confirmationCode: meta.reservationCode,
          checkIn: meta.checkIn,
          checkOut: meta.checkOut,
          emailHtml: pickedRow.rawEmail?.html ?? null,
          emailText: pickedRow.rawEmail?.text ?? null,
        })
      : undefined;

    const finance = resolveFinanceReservationRevenueAmount(reservation, sources);
    const auth = sources
      ? resolveAuthoritativeHostPayout({
          confirmationCode: meta.reservationCode,
          checkIn: meta.checkIn,
          checkOut: meta.checkOut,
          emailMatchBlob: sources.emailMatchBlob,
          emailHtml: sources.emailHtml,
          emailText: sources.emailText,
          payloadSignals: sources.payloadSignals,
          enrichedFields: sources.enrichedFields,
        })
      : null;

    const stored = Number(reservation.totalAmount);
    const ganas = auth?.hostPayoutAmount ?? null;
    const wrongCodeEvents = events.filter(
      (e) =>
        e.confirmationCode &&
        reservation.reservationCode &&
        e.confirmationCode !== reservation.reservationCode,
    ).length;

    const isCancelled =
      /cancel/i.test(csv.status) || reservation.status === ReservationStatus.CANCELLED;
    const isDirect = reservation.platform !== BookingPlatform.AIRBNB;

    let expected = 0;
    let expectedSource = "zero";
    if (isCancelled || csv.csvIngresos === 0) {
      expected = 0;
      expectedSource = "cancelled_or_zero_csv";
    } else if (ganas != null && ganas > 0) {
      expected = ganas;
      expectedSource = "email_ganas";
    } else if (csv.csvIngresos > 0) {
      expected = csv.csvIngresos;
      expectedSource = "csv_fallback";
    } else {
      expected = stored;
      expectedSource = "stored";
    }

    const issues: string[] = [];
    if (!near(finance, expected)) issues.push("FINANCE_MISMATCH");
    if (!isDirect && !near(stored, expected) && !(expected === 0 && stored === 0)) {
      issues.push("STORED_MISMATCH");
    }
    if (wrongCodeEvents > 0) issues.push("WRONG_CODE_EVENTS");
    if (finance === 0 && expected > 0) issues.push("FINANCE_ZERO");
    if (ganas != null && ganas > 0 && !near(finance, ganas)) issues.push("FINANCE_NOT_GANAS");

    const csvVsGanas =
      ganas != null && csv.csvIngresos > 0 && !near(csv.csvIngresos, ganas)
        ? { csv: csv.csvIngresos, ganas, delta: csv.csvIngresos - ganas }
        : null;

    results.push({
      code: csv.code,
      guest: csv.guest,
      dbGuest: reservation.guestName,
      platform: reservation.platform,
      csvIngresos: csv.csvIngresos,
      stored,
      finance,
      ganas,
      expected,
      expectedSource,
      pickedKind: pickedRow?.eventKind ?? null,
      emailEvents: events.length,
      wrongCodeEvents,
      csvVsGanas,
      issues,
    });

    if (
      repair &&
      !isDirect &&
      !isCancelled &&
      expected > 0 &&
      !near(stored, expected)
    ) {
      repairs.push({ id: reservation.id, code: csv.code, from: stored, to: expected });
    }
  }

  if (repair && repairs.length > 0) {
    for (const r of repairs) {
      await db.reservation.update({
        where: { id: r.id },
        data: { totalAmount: r.to },
      });
    }
  }

  const airbnbIssues = results.filter(
    (r) => r.platform === "AIRBNB" && Array.isArray(r.issues) && r.issues.length > 0,
  );

  const report = {
    orgId,
    csvPath,
    repairApplied: repair ? repairs : [],
    summary: {
      csvRows: csvRows.length,
      inDb: results.filter((r) => r.issue !== "NOT_IN_DB").length,
      airbnbWithIssues: airbnbIssues.length,
      financeMismatches: results.filter((r) =>
        (r.issues as string[] | undefined)?.includes("FINANCE_MISMATCH"),
      ).length,
      storedMismatches: results.filter((r) =>
        (r.issues as string[] | undefined)?.includes("STORED_MISMATCH"),
      ).length,
      csvGanasDeltas: results.filter((r) => r.csvVsGanas).length,
    },
    airbnbIssues,
  };

  writeFileSync(
    "scripts/_audit-finance-csv-report.json",
    JSON.stringify({ ...report, all: results }, null, 2),
  );
  console.log(JSON.stringify(report.summary, null, 2));
  if (repair) console.log("repairs", JSON.stringify(repairs, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });

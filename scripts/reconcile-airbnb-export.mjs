/**
 * Full Airbnb CSV ↔ PRAGMA reconciliation audit (read-only by default).
 * node scripts/reconcile-airbnb-export.mjs --csv "C:/Users/R160/Downloads/reservations.csv"
 * node scripts/reconcile-airbnb-export.mjs --csv ... --recover --enrich
 */
import { readFileSync, writeFileSync } from "node:fs";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  BookingPlatform,
  PaymentStatus,
  PrismaClient,
  ReservationStatus,
} from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const ORG = "cmplxfg0a000105jrs0gqtwyc";
const HISTORICAL_PREFIX = "pragma-historical:";
const PLACEHOLDER_RE = /^(hu[eé]sped airbnb|airbnb guest|reserved|reservado|airbnb)$/i;

const args = process.argv.slice(2);
const csvPath = args.find((a) => a.startsWith("--csv="))?.slice(6)
  ?? args[args.indexOf("--csv") + 1];
const recover = args.includes("--recover");
const enrich = args.includes("--enrich");
const dryRun = args.includes("--dry-run") || (!recover && !enrich);

if (!csvPath) {
  console.error("Usage: node scripts/reconcile-airbnb-export.mjs --csv <path> [--recover] [--enrich]");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') { field += '"'; i++; }
      else if (char === '"') inQuotes = false;
      else field += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ",") { row.push(field.trim()); field = ""; }
    else if (char === "\n" || (char === "\r" && next === "\n")) {
      row.push(field.trim());
      if (row.some((c) => c.length)) rows.push(row);
      row = []; field = "";
      if (char === "\r") i++;
    } else if (char !== "\r") field += char;
  }
  if (field.length || row.length) {
    row.push(field.trim());
    if (row.some((c) => c.length)) rows.push(row);
  }
  return rows;
}

function parseDateCell(raw) {
  if (!raw) return null;
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // Airbnb Spanish export uses D/M/YYYY
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = m[3];
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

function parseMoney(raw) {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function dateOnly(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function isCancelledCsv(status) {
  return /cancel/i.test(status ?? "");
}

function normalizeName(n) {
  return n?.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "") ?? "";
}

function namesMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const fa = na.split(/\s+/)[0];
  const fb = nb.split(/\s+/)[0];
  return fa.length > 2 && fa === fb && (na.includes(nb) || nb.includes(na));
}

function resolvePropertyId(listing, properties) {
  const needle = listing.trim().toLowerCase();
  const listingAliases = {
    "loft moderno 4p en laureles | a 10 min de av. 70": "802",
    "loft moderno 4p | laureles | a 10 min de comuna 13": "801",
  };
  const aliasUnit = listingAliases[needle];
  if (aliasUnit) {
    const byUnit = properties.find((p) => p.unitNumber === aliasUnit);
    if (byUnit) return byUnit.id;
  }
  for (const p of properties) {
    const name = p.name.trim().toLowerCase();
    const unit = p.unitNumber?.trim().toLowerCase() ?? "";
    if (
      name === needle || unit === needle ||
      name.includes(needle) || needle.includes(name) ||
      (unit && needle.includes(unit)) ||
      (unit && name.includes(needle.slice(0, 20)))
    ) return p.id;
  }
  return null;
}

function isEnriched(r) {
  const guestOk = r.guestName?.trim() && !PLACEHOLDER_RE.test(r.guestName.trim());
  const codeOk = Boolean(r.reservationCode?.trim());
  const amountOk = Number(r.totalAmount) > 0 || r.paymentStatus === PaymentStatus.PENDING;
  return guestOk && codeOk && amountOk;
}

function buildIcalUid(code) {
  return `${HISTORICAL_PREFIX}${code.toUpperCase()}`;
}

async function main() {
  const table = parseCsv(readFileSync(csvPath, "utf8"));
  const header = table[0];
  const csvRows = table.slice(1).map((cols) => ({
    code: cols[0]?.trim().toUpperCase() ?? "",
    csvStatus: cols[1]?.trim() ?? "",
    guest: cols[2]?.trim() ?? "",
    adults: Number(cols[4]) || 1,
    children: Number(cols[5]) || 0,
    infants: Number(cols[6]) || 0,
    checkIn: parseDateCell(cols[7]),
    checkOut: parseDateCell(cols[8]),
    nights: Number(cols[9]) || 0,
    listing: cols[11]?.trim() ?? "",
    revenue: parseMoney(cols[12]),
    cancelled: isCancelledCsv(cols[1]),
  })).filter((r) => r.code);

  const properties = await db.property.findMany({
    where: { organizationId: ORG, status: "ACTIVE" },
    select: { id: true, name: true, unitNumber: true, currency: true },
  });

  const dbReservations = await db.reservation.findMany({
    where: { property: { organizationId: ORG } },
    select: {
      id: true,
      guestName: true,
      guestFirstName: true,
      guestLastName: true,
      checkIn: true,
      checkOut: true,
      status: true,
      platform: true,
      reservationCode: true,
      icalUid: true,
      totalAmount: true,
      paymentStatus: true,
      adults: true,
      children: true,
      infants: true,
      propertyId: true,
      internalNotes: true,
      property: { select: { unitNumber: true, name: true } },
      emailEvents: {
        select: { id: true, eventKind: true, confirmationCode: true, enrichedFields: true },
      },
    },
  });

  const byCode = new Map();
  for (const r of dbReservations) {
    if (r.reservationCode) byCode.set(r.reservationCode.toUpperCase(), r);
  }

  const matched = [];
  const missing = [];
  const mismatches = [];
  const cancelledInCsvOnly = [];
  const duplicates = [];

  for (const csv of csvRows) {
    csv.propertyId = resolvePropertyId(csv.listing, properties);

    let db = byCode.get(csv.code);
    if (!db) {
      db = dbReservations.find(
        (r) =>
          r.checkIn && csv.checkIn &&
          dateKey(r.checkIn) === csv.checkIn &&
          dateKey(r.checkOut) === csv.checkOut &&
          namesMatch(r.guestName, csv.guest),
      ) ?? null;
    }

    if (csv.cancelled) {
      if (!db) {
        cancelledInCsvOnly.push({ code: csv.code, guest: csv.guest, reason: "Cancelled on Airbnb — not in PRAGMA (expected)" });
      } else if (db.status !== ReservationStatus.CANCELLED) {
        mismatches.push({
          code: csv.code,
          type: "STATUS_NOT_CANCELLED",
          csvStatus: csv.csvStatus,
          dbStatus: db.status,
          id: db.id,
        });
      } else {
        matched.push({ code: csv.code, id: db.id, match: "cancelled" });
      }
      continue;
    }

    if (!db) {
      missing.push({
        code: csv.code,
        guest: csv.guest,
        checkIn: csv.checkIn,
        checkOut: csv.checkOut,
        nights: csv.nights,
        listing: csv.listing,
        propertyId: csv.propertyId,
        revenue: csv.revenue,
        rootCause: inferMissingRootCause(csv),
      });
      continue;
    }

    const issues = [];
    if (csv.checkIn && dateKey(db.checkIn) !== csv.checkIn) issues.push("CHECKIN_MISMATCH");
    if (csv.checkOut && dateKey(db.checkOut) !== csv.checkOut) issues.push("CHECKOUT_MISMATCH");
    if (csv.guest && !namesMatch(db.guestName, csv.guest)) issues.push("GUEST_MISMATCH");
    if (csv.propertyId && db.propertyId !== csv.propertyId) issues.push("PROPERTY_MISMATCH");
    if (csv.revenue > 0 && Math.abs(Number(db.totalAmount) - csv.revenue) > 1) issues.push("REVENUE_MISMATCH");
    if (!isEnriched(db)) issues.push("PENDING_ENRICHMENT");
    if (db.reservationCode?.toUpperCase() !== csv.code) issues.push("CODE_ALIAS");

    if (issues.length) {
      mismatches.push({
        code: csv.code,
        id: db.id,
        guest: csv.guest,
        dbGuest: db.guestName,
        unit: db.property.unitNumber,
        checkIn: csv.checkIn,
        checkOut: csv.checkOut,
        csvRevenue: csv.revenue,
        dbRevenue: Number(db.totalAmount),
        issues,
        enriched: isEnriched(db),
      });
    } else {
      matched.push({ code: csv.code, id: db.id, guest: db.guestName, enriched: true });
    }
  }

  // DB Airbnb rows not in CSV
  const csvCodes = new Set(csvRows.map((r) => r.code));
  const extraInDb = dbReservations.filter(
    (r) =>
      r.platform === BookingPlatform.AIRBNB &&
      r.reservationCode &&
      !csvCodes.has(r.reservationCode.toUpperCase()) &&
      !r.icalUid?.startsWith(HISTORICAL_PREFIX),
  );

  const pendingEnrichment = dbReservations.filter(
    (r) => r.platform === BookingPlatform.AIRBNB && !isEnriched(r) && r.status !== ReservationStatus.CANCELLED,
  );

  const recoveryActions = [];
  const enrichActions = [];

  if (recover || enrich) {
    for (const m of missing) {
      if (m.rootCause === "CANCELLED_ON_AIRBNB") continue;
      if (!m.propertyId || !m.checkIn || !m.checkOut) {
        recoveryActions.push({ code: m.code, action: "skip", reason: "incomplete_csv_mapping" });
        continue;
      }
      const existing = await db.reservation.findFirst({
        where: {
          OR: [{ reservationCode: m.code }, { icalUid: buildIcalUid(m.code) }],
        },
      });
      if (existing) {
        recoveryActions.push({ code: m.code, action: "skip", reason: "already_exists", id: existing.id });
        continue;
      }
      const overlap = await db.reservation.findFirst({
        where: {
          propertyId: m.propertyId,
          checkIn: dateOnly(m.checkIn),
          checkOut: dateOnly(m.checkOut),
          status: { not: ReservationStatus.CANCELLED },
        },
      });
      if (overlap && namesMatch(overlap.guestName, m.guest)) {
        const update = {
          reservationCode: m.code,
          guestName: m.guest,
          guestFirstName: m.guest.split(/\s+/)[0],
          guestLastName: m.guest.split(/\s+/).slice(1).join(" ") || null,
          ...(m.revenue > 0 ? { totalAmount: m.revenue, paymentStatus: PaymentStatus.PAID } : {}),
        };
        if (!dryRun && enrich) {
          await db.reservation.update({ where: { id: overlap.id }, data: update });
        }
        enrichActions.push({ code: m.code, action: dryRun ? "would_link_overlap" : "linked_overlap", id: overlap.id });
        continue;
      }
      const data = {
        propertyId: m.propertyId,
        guestName: m.guest,
        guestFirstName: m.guest.split(/\s+/)[0] || "Huésped",
        guestLastName: m.guest.split(/\s+/).slice(1).join(" ") || null,
        checkIn: dateOnly(m.checkIn),
        checkOut: dateOnly(m.checkOut),
        platform: BookingPlatform.AIRBNB,
        status: m.checkOut <= dateKey(new Date()) ? ReservationStatus.CHECKED_OUT : ReservationStatus.CONFIRMED,
        paymentStatus: m.revenue > 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
        totalAmount: m.revenue,
        currency: "COP",
        reservationCode: m.code,
        icalUid: buildIcalUid(m.code),
        adults: 1,
        children: 0,
        infants: 0,
        internalNotes: `Recuperación CSV Airbnb verificado · ${m.code}`,
      };
      if (!dryRun && recover) {
        const created = await db.reservation.create({ data });
        recoveryActions.push({ code: m.code, action: "created", id: created.id });
      } else {
        recoveryActions.push({ code: m.code, action: "would_create", data: { ...data, checkIn: m.checkIn, checkOut: m.checkOut } });
      }
    }

    for (const row of mismatches.filter((m) => m.issues?.includes("PENDING_ENRICHMENT") || m.issues?.includes("REVENUE_MISMATCH") || m.issues?.includes("CODE_ALIAS"))) {
      const csv = csvRows.find((r) => r.code === row.code);
      if (!csv || csv.cancelled) continue;
      const dbRow = dbReservations.find((r) => r.id === row.id);
      if (!dbRow) continue;

      const update = {};
      if (PLACEHOLDER_RE.test(dbRow.guestName?.trim() ?? "") && csv.guest) {
        update.guestName = csv.guest;
        update.guestFirstName = csv.guest.split(/\s+/)[0];
        update.guestLastName = csv.guest.split(/\s+/).slice(1).join(" ") || null;
      }
      if (!dbRow.reservationCode && csv.code) update.reservationCode = csv.code;
      if (
        dbRow.reservationCode &&
        dbRow.reservationCode !== csv.code &&
        row.issues.includes("CODE_ALIAS") &&
        (dbRow.reservationCode.startsWith("VICTORIA") || !dbRow.reservationCode.match(/^HM[A-Z0-9]{8,10}$/))
      ) {
        update.reservationCode = csv.code;
      }
      if (csv.revenue > 0 && Number(dbRow.totalAmount) === 0) {
        update.totalAmount = csv.revenue;
        update.paymentStatus = PaymentStatus.PAID;
      }
      if (Object.keys(update).length === 0) continue;
      if (!dryRun && enrich) {
        await db.reservation.update({ where: { id: dbRow.id }, data: update });
        enrichActions.push({ code: csv.code, action: "enriched", id: dbRow.id, fields: Object.keys(update) });
      } else {
        enrichActions.push({ code: csv.code, action: "would_enrich", id: dbRow.id, update });
      }
    }

    for (const p of pendingEnrichment) {
      const csv = csvRows.find(
        (r) =>
          !r.cancelled &&
          p.propertyId === r.propertyId &&
          r.checkIn === dateKey(p.checkIn) &&
          r.checkOut === dateKey(p.checkOut),
      );
      if (!csv) continue;
      const update = {};
      if (PLACEHOLDER_RE.test(p.guestName?.trim() ?? "") && csv.guest) {
        update.guestName = csv.guest;
        update.guestFirstName = csv.guest.split(/\s+/)[0];
        update.guestLastName = csv.guest.split(/\s+/).slice(1).join(" ") || null;
      }
      if (!p.reservationCode) update.reservationCode = csv.code;
      if (csv.revenue > 0 && Number(p.totalAmount) === 0) {
        update.totalAmount = csv.revenue;
        update.paymentStatus = PaymentStatus.PAID;
      }
      if (Object.keys(update).length === 0) continue;
      if (!dryRun && enrich) {
        await db.reservation.update({ where: { id: p.id }, data: update });
        enrichActions.push({ code: csv.code, action: "enriched_placeholder", id: p.id, fields: Object.keys(update) });
      }
    }
  }

  const report = {
    auditedAt: new Date().toISOString(),
    csvPath,
    csvSource: "Airbnb host export (authoritative reference)",
    organizationId: ORG,
    summary: {
      csvTotal: csvRows.length,
      csvActive: csvRows.filter((r) => !r.cancelled).length,
      csvCancelled: csvRows.filter((r) => r.cancelled).length,
      pragmaTotal: dbReservations.length,
      matched: matched.length,
      missing: missing.filter((m) => m.rootCause !== "CANCELLED_ON_AIRBNB").length,
      mismatches: mismatches.length,
      pendingEnrichment: pendingEnrichment.length,
      fullyEnriched: dbReservations.filter((r) => isEnriched(r)).length,
      extraAirbnbNotInCsv: extraInDb.length,
    },
    missing,
    mismatches,
    matched,
    cancelledInCsvOnly,
    pendingEnrichment: pendingEnrichment.map((r) => ({
      id: r.id,
      guest: r.guestName,
      code: r.reservationCode,
      unit: r.property.unitNumber,
      checkIn: dateKey(r.checkIn),
      checkOut: dateKey(r.checkOut),
      amount: String(r.totalAmount),
      emailEvents: r.emailEvents.length,
    })),
    recoveryActions,
    enrichActions,
    integrityGuards: {
      ghostPurgeDeletes: false,
      staleIcalPastStayProtection: true,
      historicalPrefixProtection: true,
    },
  };

  const outPath = "scripts/_reconcile-airbnb-export-report.json";
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.error(`\nReport written: ${outPath}`);
}

function inferMissingRootCause(csv) {
  if (csv.cancelled) return "CANCELLED_ON_AIRBNB";
  return "PHYSICALLY_DELETED_OR_NEVER_IMPORTED";
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); await pool.end(); });

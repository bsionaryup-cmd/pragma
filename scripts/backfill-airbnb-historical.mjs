/**
 * Backfill histórico de reservas Airbnb desde CSV exportado del host.
 * Reutiliza la tabla `reservations` existente — sin UI ni nuevas tablas.
 *
 * Idempotencia: icalUid = `pragma-historical:{CONFIRMATION_CODE}`
 *               + reservationCode = código Airbnb
 *
 * Análisis previo (sin escribir):
 *   node scripts/backfill-airbnb-historical.mjs --analyze \
 *     --csv ./data/don-samuel-reservas.csv \
 *     --organization-id cmplxfg0a000105jrs0gqtwyc \
 *     --cutoff 2026-05-25 \
 *     --auto-match-listing
 *
 * Importación (solo check-in < cutoff):
 *   node scripts/backfill-airbnb-historical.mjs --dry-run \
 *     --csv ./data/don-samuel-reservas.csv \
 *     --organization-id <orgId> --cutoff 2026-05-25
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  BookingPlatform,
  PrismaClient,
  ReservationStatus,
  PaymentStatus,
} from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const HISTORICAL_PREFIX = "pragma-historical:";
const DEFAULT_CUTOFF = "2026-05-25";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function parseArgs(argv) {
  const args = {
    dryRun: argv.includes("--dry-run"),
    validate: argv.includes("--validate"),
    analyze: argv.includes("--analyze"),
    autoMatchListing: argv.includes("--auto-match-listing"),
    csv: null,
    organizationId: null,
    ownerEmail: null,
    propertyMapPath: null,
    from: "2026-04-01",
    to: "2026-06-30",
    cutoff: DEFAULT_CUTOFF,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === "--csv" && next) args.csv = next;
    if (key === "--organization-id" && next) args.organizationId = next;
    if (key === "--owner-email" && next) args.ownerEmail = next;
    if (key === "--property-map" && next) args.propertyMapPath = next;
    if (key === "--from" && next) args.from = next;
    if (key === "--to" && next) args.to = next;
    if (key === "--cutoff" && next) args.cutoff = next;
  }

  return args;
}

function dateOnlyFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function prismaDateToKey(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayOperationalKey() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const read = (type) => parts.find((p) => p.type === type)?.value ?? "0";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function deriveStatus(checkInKey, checkOutKey, csvStatus) {
  const cancelled = /cancel/i.test(csvStatus ?? "");
  if (cancelled) return ReservationStatus.CANCELLED;

  const todayKey = todayOperationalKey();
  if (checkOutKey < todayKey) return ReservationStatus.CHECKED_OUT;
  if (checkOutKey === todayKey) return ReservationStatus.CHECKOUT_TODAY;
  if (checkInKey <= todayKey && checkOutKey > todayKey) {
    return ReservationStatus.CHECKED_IN;
  }
  return ReservationStatus.CONFIRMED;
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n" || (char === "\r" && next === "\n")) {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
      if (char === "\r") i += 1;
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  return rows;
}

function normalizeHeader(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "_");
}

const HEADER_ALIASES = {
  confirmation_code: [
    "confirmation_code",
    "codigo_de_confirmacion",
    "codigo_confirmacion",
    "confirmation",
    "codigo",
  ],
  guest_name: ["guest_name", "nombre_del_huesped", "huesped", "guest"],
  listing: ["listing", "anuncio", "propiedad", "listing_name", "nombre_anuncio"],
  check_in: [
    "start_date",
    "fecha_de_inicio",
    "fecha_inicio",
    "check_in",
    "entrada",
  ],
  check_out: [
    "end_date",
    "fecha_de_finalizacion",
    "fecha_fin",
    "check_out",
    "salida",
  ],
  earnings: [
    "earnings",
    "ganancias",
    "total_payout",
    "importe",
    "amount",
    "ingresos",
  ],
  status: ["status", "estado"],
  adults: ["adults", "adultos", "#_of_adults"],
  children: ["children", "ninos", "#_of_children"],
  infants: ["infants", "bebes", "#_of_infants"],
};

function mapHeaders(headerRow) {
  const normalized = headerRow.map(normalizeHeader);
  const index = {};

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx >= 0) index[field] = idx;
  }

  return index;
}

function parseDateCell(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, a, b, yyyy] = slash;
    const aa = Number(a);
    const bb = Number(b);
    const mm = aa <= 12 && bb <= 12 ? a : b;
    const dd = aa <= 12 && bb <= 12 ? b : a;
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return prismaDateToKey(parsed);
  return null;
}

function parseMoney(raw) {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function buildIcalUid(code) {
  return `${HISTORICAL_PREFIX}${code.trim().toUpperCase()}`;
}

function datesOverlap(checkInA, checkOutA, checkInB, checkOutB) {
  return checkInA < checkOutB && checkInB < checkOutA;
}

async function resolveOrganization(args) {
  if (args.organizationId) {
    const org = await db.organization.findUnique({
      where: { id: args.organizationId },
      select: { id: true, name: true },
    });
    if (!org) throw new Error(`Organización no encontrada: ${args.organizationId}`);
    return org;
  }

  if (args.ownerEmail) {
    const user = await db.user.findFirst({
      where: { email: args.ownerEmail.trim().toLowerCase() },
      select: {
        organizationId: true,
        organization: { select: { id: true, name: true } },
      },
    });
    if (!user?.organizationId || !user.organization) {
      throw new Error(`Usuario sin organización: ${args.ownerEmail}`);
    }
    return user.organization;
  }

  throw new Error("Indica --organization-id o --owner-email");
}

async function loadProperties(organizationId) {
  return db.property.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      unitNumber: true,
      currency: true,
    },
  });
}

function resolvePropertyId(listing, properties, propertyMap, autoMatch) {
  if (propertyMap[listing]) return propertyMap[listing];

  if (!autoMatch) return null;

  const needle = listing.trim().toLowerCase();
  const match = properties.find((p) => {
    const name = p.name.trim().toLowerCase();
    const unit = p.unitNumber?.trim().toLowerCase() ?? "";
    return (
      name === needle ||
      unit === needle ||
      `${unit} — ${name}`.toLowerCase() === needle ||
      `${unit} - ${name}`.toLowerCase() === needle ||
      name.includes(needle) ||
      needle.includes(name)
    );
  });

  return match?.id ?? null;
}

function propertyLabel(property) {
  if (!property) return "?";
  return property.unitNumber
    ? `${property.unitNumber} · ${property.name.slice(0, 40)}`
    : property.name.slice(0, 50);
}

async function loadExistingReservations(organizationId) {
  return db.reservation.findMany({
    where: { property: { organizationId } },
    select: {
      id: true,
      propertyId: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      reservationCode: true,
      icalUid: true,
      status: true,
      totalAmount: true,
      platform: true,
      property: { select: { unitNumber: true, name: true } },
    },
  });
}

function parseCsvRecords(args, properties, propertyMap) {
  if (!args.csv) throw new Error("Indica --csv");
  const content = readFileSync(args.csv, "utf8");
  const table = parseCsv(content);
  if (table.length < 2) throw new Error("CSV vacío o sin filas de datos");

  const headerIndex = mapHeaders(table[0]);
  if (headerIndex.confirmation_code === undefined) {
    throw new Error(
      "CSV sin columna de código de confirmación. Headers: " + table[0].join(", "),
    );
  }
  if (headerIndex.check_in === undefined || headerIndex.check_out === undefined) {
    throw new Error("CSV sin columnas de fechas (check-in / check-out)");
  }

  const records = [];
  const errors = [];

  for (let i = 1; i < table.length; i += 1) {
    const row = table[i];
    const code = row[headerIndex.confirmation_code]?.trim();
    if (!code) continue;

    const checkInKey = parseDateCell(row[headerIndex.check_in]);
    const checkOutKey = parseDateCell(row[headerIndex.check_out]);
    if (!checkInKey || !checkOutKey || checkOutKey <= checkInKey) {
      errors.push({ row: i + 1, code, reason: "fechas inválidas" });
      continue;
    }

    const listing =
      headerIndex.listing !== undefined ? row[headerIndex.listing]?.trim() : "";
    const propertyId = resolvePropertyId(
      listing || "default",
      properties,
      propertyMap,
      args.autoMatchListing || !args.propertyMapPath,
    );

    if (!propertyId) {
      errors.push({
        row: i + 1,
        code,
        reason: `sin propiedad para listing "${listing || "(vacío)"}"`,
      });
      continue;
    }

    const property = properties.find((p) => p.id === propertyId);
    const guestName =
      (headerIndex.guest_name !== undefined
        ? row[headerIndex.guest_name]?.trim()
        : "") || "Huésped Airbnb";
    const csvStatus =
      headerIndex.status !== undefined ? row[headerIndex.status]?.trim() : "";
    const earnings =
      headerIndex.earnings !== undefined
        ? parseMoney(row[headerIndex.earnings])
        : 0;

    records.push({
      row: i + 1,
      code: code.toUpperCase(),
      checkInKey,
      checkOutKey,
      guestName,
      csvStatus,
      status: deriveStatus(checkInKey, checkOutKey, csvStatus),
      earnings,
      listing,
      propertyId,
      property,
      icalUid: buildIcalUid(code),
      adults:
        headerIndex.adults !== undefined
          ? Number.parseInt(row[headerIndex.adults] || "1", 10) || 1
          : 1,
      children:
        headerIndex.children !== undefined
          ? Number.parseInt(row[headerIndex.children] || "0", 10) || 0
          : 0,
      infants:
        headerIndex.infants !== undefined
          ? Number.parseInt(row[headerIndex.infants] || "0", 10) || 0
          : 0,
    });
  }

  return { records, errors, headers: table[0], headerIndex };
}

function classifyRecord(record, existing, cutoff) {
  const flags = {
    inScope: record.checkInKey < cutoff,
    duplicate: false,
    duplicateReason: null,
    duplicateMatch: null,
    overlap: [],
    postCutoffOverlap: [],
  };

  if (!flags.inScope) return flags;

  for (const ex of existing) {
    const exCheckIn = prismaDateToKey(ex.checkIn);
    const exCheckOut = prismaDateToKey(ex.checkOut);
    const codeMatch =
      ex.reservationCode &&
      ex.reservationCode.toUpperCase() === record.code;
    const uidMatch = ex.icalUid === record.icalUid;

    if (codeMatch || uidMatch) {
      flags.duplicate = true;
      flags.duplicateReason = uidMatch
        ? "icalUid histórico existente"
        : "reservationCode existente";
      flags.duplicateMatch = ex;
      continue;
    }

    if (
      ex.propertyId !== record.propertyId ||
      ex.status === ReservationStatus.CANCELLED ||
      ex.status === ReservationStatus.BLOCKED
    ) {
      continue;
    }

    if (
      datesOverlap(
        record.checkInKey,
        record.checkOutKey,
        exCheckIn,
        exCheckOut,
      )
    ) {
      const overlapEntry = {
        existingId: ex.id,
        code: ex.reservationCode,
        guest: ex.guestName,
        checkIn: exCheckIn,
        checkOut: exCheckOut,
        status: ex.status,
        unit: ex.property.unitNumber,
        postCutoff: exCheckIn >= cutoff,
      };
      flags.overlap.push(overlapEntry);
      if (exCheckIn >= cutoff) flags.postCutoffOverlap.push(overlapEntry);
    }
  }

  return flags;
}

async function analyzeCsv(args) {
  const org = await resolveOrganization(args);
  const properties = await loadProperties(org.id);
  const propertyMap = args.propertyMapPath
    ? JSON.parse(readFileSync(args.propertyMapPath, "utf8"))
    : {};
  const existing = await loadExistingReservations(org.id);
  const { records, errors, headers } = await parseCsvRecords(
    args,
    properties,
    propertyMap,
  );

  const cutoff = args.cutoff;
  const inScope = records.filter((r) => r.checkInKey < cutoff);
  const excluded = records.filter((r) => r.checkInKey >= cutoff);

  let totalEarnings = 0;
  let accountingEarnings = 0;
  const byMonth = new Map();
  const byProperty = new Map();
  const toImport = [];
  const duplicates = [];
  const conflicts = [];
  const unmappedListings = new Set();

  for (const record of inScope) {
    const flags = classifyRecord(record, existing, cutoff);
    if (flags.duplicate) {
      duplicates.push({ record, flags });
      continue;
    }
    if (flags.overlap.length > 0) {
      conflicts.push({ record, flags });
    }
    toImport.push({ record, flags });

    totalEarnings += record.earnings;
    if (record.status !== ReservationStatus.CANCELLED) {
      accountingEarnings += record.earnings;
    }

    const month = record.checkInKey.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
    const propKey = propertyLabel(record.property);
    byProperty.set(propKey, (byProperty.get(propKey) ?? 0) + 1);
  }

  for (const err of errors) {
    if (err.reason.includes("sin propiedad")) {
      unmappedListings.add(err.reason);
    }
  }

  const existingBefore = existing.filter(
    (r) => prismaDateToKey(r.checkIn) < cutoff,
  );
  const existingAfter = existing.filter(
    (r) => prismaDateToKey(r.checkIn) >= cutoff,
  );

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  ANÁLISIS BACKFILL HISTÓRICO (sin importar)");
  console.log("══════════════════════════════════════════════════════");
  console.log(`Organización:  ${org.name}`);
  console.log(`Org ID:        ${org.id}`);
  console.log(`CSV:           ${args.csv}`);
  console.log(`Fecha corte:   check-in < ${cutoff}`);
  console.log(`Headers CSV:   ${headers.join(" | ")}`);
  console.log("");

  console.log("── Estado actual en PRAGMA ──");
  console.log(`  Reservas totales:              ${existing.length}`);
  console.log(`  Con check-in < ${cutoff}:       ${existingBefore.length}`);
  console.log(`  Con check-in >= ${cutoff} (piloto, NO TOCAR): ${existingAfter.length}`);
  if (existingAfter.length > 0) {
    for (const r of existingAfter) {
      console.log(
        `    · ${r.property.unitNumber ?? "?"} ${prismaDateToKey(r.checkIn)}→${prismaDateToKey(r.checkOut)} · ${r.guestName} · ${r.status}`,
      );
    }
  }

  console.log("\n── CSV completo ──");
  console.log(`  Filas válidas parseadas:       ${records.length}`);
  console.log(`  Errores de parseo:             ${errors.length}`);
  console.log(`  En scope (check-in < corte):   ${inScope.length}`);
  console.log(`  Excluidas (check-in >= corte): ${excluded.length}`);

  console.log("\n── Resumen en scope ──");
  console.log(`  A importar (nuevas):           ${toImport.length}`);
  console.log(`  Duplicados (ya en PRAGMA):     ${duplicates.length}`);
  console.log(`  Con solapamiento de fechas:    ${conflicts.length}`);
  console.log(`  Ingresos brutos CSV:           ${totalEarnings.toLocaleString("es-CO")} COP`);
  console.log(
    `  Ingresos contables (no canceladas): ${accountingEarnings.toLocaleString("es-CO")} COP`,
  );

  if (byMonth.size > 0) {
    console.log("\n  Por mes (check-in):");
    for (const [month, count] of [...byMonth.entries()].sort()) {
      console.log(`    ${month}: ${count} reservas`);
    }
  }

  if (byProperty.size > 0) {
    console.log("\n  Por propiedad:");
    for (const [prop, count] of [...byProperty.entries()].sort()) {
      console.log(`    ${prop}: ${count}`);
    }
  }

  if (excluded.length > 0) {
    console.log("\n── Excluidas del backfill (check-in >= corte) ──");
    for (const r of excluded.slice(0, 15)) {
      console.log(
        `  ${r.code} · ${r.checkInKey}→${r.checkOutKey} · ${r.guestName} · ${propertyLabel(r.property)}`,
      );
    }
    if (excluded.length > 15) {
      console.log(`  ... y ${excluded.length - 15} más`);
    }
  }

  if (duplicates.length > 0) {
    console.log("\n── Duplicados detectados (se omitirían) ──");
    for (const { record, flags } of duplicates) {
      const ex = flags.duplicateMatch;
      console.log(
        `  ${record.code} · ${record.checkInKey}→${record.checkOutKey} · ${flags.duplicateReason}`,
      );
      if (ex) {
        console.log(
          `    ↔ existente: ${ex.property.unitNumber} ${prismaDateToKey(ex.checkIn)}→${prismaDateToKey(ex.checkOut)} · ${ex.guestName}`,
        );
      }
    }
  }

  if (conflicts.length > 0) {
    console.log("\n── Posibles conflictos de disponibilidad ──");
    for (const { record, flags } of conflicts) {
      console.log(
        `  ${record.code} · ${record.checkInKey}→${record.checkOutKey} · ${propertyLabel(record.property)}`,
      );
      for (const o of flags.overlap) {
        const tag = o.postCutoff ? " [POST-CORTE — NO TOCAR]" : "";
        console.log(
          `    ↔ solapa con ${o.code ?? "(sin código)"} · ${o.checkIn}→${o.checkOut} · ${o.guest}${tag}`,
        );
      }
    }
  }

  if (errors.length > 0) {
    console.log("\n── Errores de parseo / mapeo ──");
    for (const err of errors.slice(0, 20)) {
      console.log(`  Fila ${err.row}: ${err.code ?? "?"} — ${err.reason}`);
    }
  }

  if (toImport.length > 0) {
    console.log("\n── Registros propuestos para importar ──");
    console.log(
      "  Código       | Check-in   | Check-out  | Unidad | Huésped                    | Ingreso    | Estado",
    );
    console.log(
      "  " + "-".repeat(95),
    );
    for (const { record } of toImport.sort((a, b) =>
      a.record.checkInKey.localeCompare(b.record.checkInKey),
    )) {
      const r = record;
      console.log(
        `  ${r.code.padEnd(12)} | ${r.checkInKey} | ${r.checkOutKey} | ${(r.property?.unitNumber ?? "?").padEnd(6)} | ${r.guestName.slice(0, 26).padEnd(26)} | ${String(r.earnings).padStart(10)} | ${r.status}`,
      );
    }
  }

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  Importación NO ejecutada. Revisar y confirmar.");
  console.log("══════════════════════════════════════════════════════\n");

  return {
    toImport: toImport.length,
    duplicates: duplicates.length,
    conflicts: conflicts.length,
    excluded: excluded.length,
    accountingEarnings,
  };
}

async function importCsv(args) {
  const org = await resolveOrganization(args);
  const properties = await loadProperties(org.id);
  const propertyMap = args.propertyMapPath
    ? JSON.parse(readFileSync(args.propertyMapPath, "utf8"))
    : {};
  const existing = await loadExistingReservations(org.id);
  const { records, errors } = await parseCsvRecords(args, properties, propertyMap);
  const cutoff = args.cutoff;

  const stats = {
    created: 0,
    updated: 0,
    skipped: 0,
    excluded: 0,
    duplicates: 0,
    errors: [...errors],
    byMonth: new Map(),
  };

  console.log(`\nBackfill histórico · ${org.name} (${org.id})`);
  console.log(`Fecha corte: check-in < ${cutoff}`);
  console.log(`Propiedades activas: ${properties.length}`);
  console.log(args.dryRun ? "MODO dry-run (sin escribir)\n" : "MODO escritura\n");

  for (const record of records) {
    if (record.checkInKey >= cutoff) {
      stats.excluded += 1;
      continue;
    }

    const flags = classifyRecord(record, existing, cutoff);
    if (flags.duplicate) {
      stats.duplicates += 1;
      if (args.dryRun) {
        console.log(
          `[dry-run] SKIP duplicado ${record.code} · ${record.checkInKey}→${record.checkOutKey}`,
        );
      }
      continue;
    }

    const payload = {
      guestName: record.guestName,
      guestFirstName: record.guestName.split(/\s+/)[0] || "Huésped",
      guestLastName: record.guestName.split(/\s+/).slice(1).join(" ") || null,
      checkIn: dateOnlyFromKey(record.checkInKey),
      checkOut: dateOnlyFromKey(record.checkOutKey),
      platform: BookingPlatform.AIRBNB,
      status: record.status,
      paymentStatus:
        record.status === ReservationStatus.CANCELLED
          ? PaymentStatus.PENDING
          : PaymentStatus.PAID,
      totalAmount: record.earnings,
      currency: record.property?.currency ?? "COP",
      reservationCode: record.code,
      icalUid: record.icalUid,
      adults: record.adults,
      children: record.children,
      infants: record.infants,
      internalNotes: `Backfill histórico CSV Airbnb · corte ${cutoff}`,
    };

    const monthKey = record.checkInKey.slice(0, 7);
    stats.byMonth.set(monthKey, (stats.byMonth.get(monthKey) ?? 0) + 1);

    const existingRow = await db.reservation.findFirst({
      where: {
        propertyId: record.propertyId,
        OR: [{ icalUid: record.icalUid }, { reservationCode: record.code }],
      },
      select: { id: true },
    });

    if (args.dryRun) {
      console.log(
        `[dry-run] ${existingRow ? "UPDATE" : "CREATE"} ${record.code} · ${record.checkInKey}→${record.checkOutKey} · ${record.guestName} · ${record.earnings} · ${record.status}`,
      );
      if (existingRow) stats.updated += 1;
      else stats.created += 1;
      continue;
    }

    if (existingRow) {
      await db.reservation.update({
        where: { id: existingRow.id },
        data: payload,
      });
      stats.updated += 1;
    } else {
      await db.reservation.create({
        data: { propertyId: record.propertyId, ...payload },
      });
      stats.created += 1;
    }
  }

  console.log("\n--- Resumen ---");
  console.log(`Creadas:      ${stats.created}`);
  console.log(`Actualizadas: ${stats.updated}`);
  console.log(`Duplicados:   ${stats.duplicates} (omitidos)`);
  console.log(`Excluidas:    ${stats.excluded} (check-in >= ${cutoff})`);
  console.log(`Errores:      ${stats.errors.length}`);
  if (stats.byMonth.size > 0) {
    console.log("\nPor mes (check-in):");
    for (const [month, count] of [...stats.byMonth.entries()].sort()) {
      console.log(`  ${month}: ${count}`);
    }
  }
}

async function validateRange(args) {
  const org = await resolveOrganization(args);
  const from = dateOnlyFromKey(args.from);
  const to = dateOnlyFromKey(args.to);

  const reservations = await db.reservation.findMany({
    where: {
      property: { organizationId: org.id },
      icalUid: { startsWith: HISTORICAL_PREFIX },
      status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.BLOCKED] },
      checkIn: { lte: to },
      checkOut: { gt: from },
    },
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      totalAmount: true,
      status: true,
      reservationCode: true,
      property: { select: { name: true, unitNumber: true } },
    },
    orderBy: { checkIn: "asc" },
  });

  console.log(`\nValidación · ${org.name}`);
  console.log(`Rango: ${args.from} → ${args.to}`);
  console.log(`Reservas backfill visibles: ${reservations.length}`);

  const byMonth = new Map();
  let revenue = 0;
  for (const r of reservations) {
    const key = prismaDateToKey(r.checkIn).slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
    revenue += Number(r.totalAmount);
  }

  for (const [month, count] of [...byMonth.entries()].sort()) {
    console.log(`  ${month}: ${count} reservas`);
  }
  console.log(`Ingresos backfill: ${revenue.toFixed(2)}`);
}

async function main() {
  const args = parseArgs(process.argv);
  try {
    if (args.validate) {
      await validateRange(args);
    } else if (args.analyze) {
      await analyzeCsv(args);
    } else {
      await importCsv(args);
    }
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

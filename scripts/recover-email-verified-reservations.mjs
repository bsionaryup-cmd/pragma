/**
 * Recover reservations verified from PROCESSED email audits (idempotent).
 * - Creates missing rows with pragma-historical:{CODE}
 * - Enriches iCal placeholders when property+dates match
 *
 * node scripts/recover-email-verified-reservations.mjs
 * node scripts/recover-email-verified-reservations.mjs --dry-run
 */
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
const dryRun = process.argv.includes("--dry-run");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Verified from PROCESSED CONFIRMED/UPDATED audits — not fabricated. */
const RECOVERABLE = [
  {
    code: "HMCNCARK3K",
    guestName: "Yuly Correa",
    checkIn: "2026-06-15",
    checkOut: "2026-06-18",
    propertyId: "cmpmqijw0000204jv24dur0i7",
    totalAmount: 310122.68,
    auditId: "cmqfutvyk000304l2bycg9sfd",
  },
  {
    code: "HMYZWPD95M",
    guestName: "Milena Mercedes Barrero Cortes",
    checkIn: "2026-06-15",
    checkOut: "2026-06-18",
    propertyId: "cmpmqfgrs000004jm3a2k4ky2",
    totalAmount: null,
    auditId: "cmpp6ay70000004kt5q16631r",
  },
  {
    code: "HM4SPXSTS2",
    guestName: "Karla Durán",
    checkIn: "2026-06-19",
    checkOut: "2026-06-23",
    propertyId: "cmpmqijw0000204jv24dur0i7",
    totalAmount: 1023779.89,
    auditId: "cmpoupuo3000004kysyf8xumt",
  },
  {
    code: "HMJDFHKS4R",
    guestName: "Roberto Gonzalez Morales",
    checkIn: "2026-06-22",
    checkOut: "2026-06-26",
    propertyId: "cmpm0xani000004jgxfqjnih0",
    totalAmount: 514011.14,
    auditId: "cmpp74ehz000104l7vc7epvav",
  },
  {
    code: "HMZMZBDTKN",
    guestName: "Jairo Tapia",
    checkIn: "2026-06-23",
    checkOut: "2026-06-27",
    propertyId: "cmpmqijw0000204jv24dur0i7",
    totalAmount: 433686.66,
    auditId: "cmqfbg8dj000004jr1fq26zjl",
  },
];

/** Enrich existing iCal placeholder — same property + dates, verified email. */
const PLACEHOLDER_ENRICHMENTS = [
  {
    code: "HMNWHJBYH5",
    guestName: "Chanelva Alidikromo",
    checkIn: "2026-06-25",
    checkOut: "2026-06-30",
    propertyId: "cmpmqaeea000004jvytqozsq1",
    totalAmount: 763913.54,
    auditId: "cmqllqlyn000004l11b3jxjrq",
  },
];

function dateOnlyFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function buildIcalUid(code) {
  return `${HISTORICAL_PREFIX}${code.trim().toUpperCase()}`;
}

function deriveStatus(checkOutKey) {
  const today = new Date().toISOString().slice(0, 10);
  if (checkOutKey <= today) return ReservationStatus.CHECKED_OUT;
  if (checkOutKey > today) return ReservationStatus.CONFIRMED;
  return ReservationStatus.CHECKED_IN;
}

async function findExistingByCode(code) {
  const icalUid = buildIcalUid(code);
  return db.reservation.findFirst({
    where: {
      property: { organizationId: ORG },
      OR: [{ icalUid }, { reservationCode: code.toUpperCase() }],
    },
    select: { id: true, guestName: true, reservationCode: true, icalUid: true },
  });
}

async function findExactStay(propertyId, checkIn, checkOut) {
  return db.reservation.findFirst({
    where: {
      propertyId,
      checkIn: dateOnlyFromKey(checkIn),
      checkOut: dateOnlyFromKey(checkOut),
      status: { not: ReservationStatus.CANCELLED },
    },
    select: {
      id: true,
      guestName: true,
      reservationCode: true,
      totalAmount: true,
      platform: true,
    },
  });
}

async function recoverOne(row) {
  const existing = await findExistingByCode(row.code);
  if (existing) {
    return { action: "skip_exists", code: row.code, id: existing.id };
  }

  const overlap = await findExactStay(row.propertyId, row.checkIn, row.checkOut);
  if (overlap) {
    return {
      action: "skip_overlap",
      code: row.code,
      overlapId: overlap.id,
      overlapGuest: overlap.guestName,
    };
  }

  const status = deriveStatus(row.checkOut);
  const amount = row.totalAmount ?? 0;
  const data = {
    propertyId: row.propertyId,
    guestName: row.guestName,
    guestFirstName: row.guestName.split(/\s+/)[0] || "Huésped",
    guestLastName: row.guestName.split(/\s+/).slice(1).join(" ") || null,
    checkIn: dateOnlyFromKey(row.checkIn),
    checkOut: dateOnlyFromKey(row.checkOut),
    platform: BookingPlatform.AIRBNB,
    status,
    paymentStatus: amount > 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
    totalAmount: amount,
    currency: "COP",
    reservationCode: row.code.toUpperCase(),
    icalUid: buildIcalUid(row.code),
    adults: 1,
    children: 0,
    infants: 0,
    internalNotes: `Recuperación histórica verificada · audit ${row.auditId}`,
  };

  if (dryRun) {
    return { action: "would_create", code: row.code, data: { ...data, checkIn: row.checkIn, checkOut: row.checkOut } };
  }

  const created = await db.reservation.create({ data });
  return { action: "created", code: row.code, id: created.id };
}

async function enrichPlaceholder(row) {
  const placeholder = await db.reservation.findFirst({
    where: {
      propertyId: row.propertyId,
      checkIn: dateOnlyFromKey(row.checkIn),
      checkOut: dateOnlyFromKey(row.checkOut),
      status: { not: ReservationStatus.CANCELLED },
    },
  });

  if (!placeholder) {
    return { action: "no_placeholder", code: row.code };
  }

  if (
    placeholder.reservationCode?.toUpperCase() === row.code.toUpperCase() &&
    placeholder.guestName === row.guestName
  ) {
    return { action: "skip_enriched", code: row.code, id: placeholder.id };
  }

  const update = {
    guestName: row.guestName,
    guestFirstName: row.guestName.split(/\s+/)[0] || placeholder.guestFirstName,
    guestLastName: row.guestName.split(/\s+/).slice(1).join(" ") || placeholder.guestLastName,
    reservationCode: row.code.toUpperCase(),
    ...(row.totalAmount && Number(placeholder.totalAmount) === 0
      ? {
          totalAmount: row.totalAmount,
          paymentStatus: PaymentStatus.PAID,
        }
      : {}),
    internalNotes: placeholder.internalNotes
      ? `${placeholder.internalNotes} · Enriquecido audit ${row.auditId}`
      : `Enriquecido audit ${row.auditId}`,
  };

  if (dryRun) {
    return { action: "would_enrich", code: row.code, id: placeholder.id, update };
  }

  await db.reservation.update({ where: { id: placeholder.id }, data: update });
  return { action: "enriched", code: row.code, id: placeholder.id };
}

async function main() {
  console.log(`\nRecover email-verified reservations · ${dryRun ? "DRY-RUN" : "WRITE"}\n`);

  const results = [];
  for (const row of RECOVERABLE) {
    results.push(await recoverOne(row));
  }
  for (const row of PLACEHOLDER_ENRICHMENTS) {
    results.push(await enrichPlaceholder(row));
  }

  const totalAfter = await db.reservation.count({
    where: { property: { organizationId: ORG } },
  });

  console.log(JSON.stringify({ results, totalAfter }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });

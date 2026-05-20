/**
 * Auditoría iCal multi-propiedad (801–804) contra la base de datos real.
 * Uso: npm run audit:ical
 * Para sync en servidor: GET /api/cron/airbnb-ical-sync con Authorization Bearer CRON_SECRET
 */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, PropertyStatus } from "@prisma/client";
import pg from "pg";

config();
config({ path: ".env.local", override: true });

const UNIT_CODES = ["801", "802", "803", "804"];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function auditExportForProperty(property) {
  const reservations = await db.reservation.findMany({
    where: {
      propertyId: property.id,
      icalUid: null,
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      guestName: true,
      checkIn: true,
      checkOut: true,
      status: true,
      platform: true,
    },
    orderBy: { checkIn: "asc" },
  });

  const issues = [];
  if (!property.icalExportToken) {
    issues.push("sin icalExportToken de exportación");
  }
  if (!property.icalUrl?.trim()) {
    issues.push("sin icalUrl de Airbnb");
  }

  const directOrBooking = reservations.filter(
    (r) => r.platform === "DIRECT" || r.platform === "BOOKING",
  );
  const airbnbImported = reservations.filter((r) => r.platform === "AIRBNB");

  return {
    propertyId: property.id,
    name: property.name,
    icalUrl: Boolean(property.icalUrl?.trim()),
    exportToken: Boolean(property.icalExportToken),
    pragmaReservations: reservations.length,
    directOrBooking: directOrBooking.length,
    airbnbInDb: airbnbImported.length,
    issues,
  };
}

async function main() {
  console.log("\n=== PRAGMA iCal sync audit ===\n");

  const properties = await db.property.findMany({
    where: { status: PropertyStatus.ACTIVE },
    select: {
      id: true,
      name: true,
      ownerId: true,
      icalUrl: true,
      icalExportToken: true,
      lastIcalSyncedAt: true,
    },
    orderBy: { name: "asc" },
  });

  const linked = properties.filter((p) => p.icalUrl?.trim());
  console.log(`Propiedades activas: ${properties.length}`);
  console.log(`Con iCal Airbnb: ${linked.length}\n`);

  const unitMatches = properties.filter((p) =>
    UNIT_CODES.some((code) => p.name.includes(code)),
  );

  console.log("Unidades objetivo (801–804 en nombre):");
  if (unitMatches.length === 0) {
    console.warn("  ⚠ No se encontraron propiedades con 801/802/803/804 en el nombre.");
    console.warn("  Listando todas las vinculadas a iCal:\n");
  }

  const auditTargets = unitMatches.length > 0 ? unitMatches : linked;
  const reports = [];

  for (const property of auditTargets) {
    const report = await auditExportForProperty(property);
    reports.push(report);
    const flag = report.issues.length ? "⚠" : "✓";
    console.log(
      `  ${flag} ${report.name} (${report.propertyId.slice(0, 8)}…)`,
    );
    console.log(
      `      iCal in: ${report.icalUrl ? "sí" : "no"} | export token: ${report.exportToken ? "sí" : "no"} | última sync: ${property.lastIcalSyncedAt?.toISOString() ?? "nunca"}`,
    );
    console.log(
      `      reservas PRAGMA exportables: ${report.pragmaReservations} (Directo/Booking: ${report.directOrBooking}) | Airbnb en DB: ${report.airbnbInDb}`,
    );
    if (report.issues.length) {
      console.log(`      issues: ${report.issues.join(", ")}`);
    }
  }

  assert.ok(linked.length > 0, "Debe haber al menos una propiedad con iCal");

  console.log(
    "\nSync en producción: Vercel Cron → /api/cron/airbnb-ical-sync (cada 5 min).\n",
  );
  console.log("Audit complete.\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });

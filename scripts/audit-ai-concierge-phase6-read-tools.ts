/**
 * Prueba real local Fase 6 — tools de lectura contra Neon/.env.local.
 * Sin deploy. Sin mutaciones.
 *
 * Uso:
 *   npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/audit-ai-concierge-phase6-read-tools.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { db } from "@/lib/db";
import { createPhase6ReadToolRegistry } from "@/modules/ai-concierge/tools/read/wire";
import { listRecentToolAudits } from "@/modules/ai-concierge/tools/read/context";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type Check = { name: string; ok: boolean; detail?: unknown };

async function main() {
  const checks: Check[] = [];

  const property = await db.property.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      organizationId: true,
      ownerId: true,
      wifiName: true,
    },
  });

  if (!property) {
    console.log(JSON.stringify({ allOk: false, error: "No hay propiedades" }, null, 2));
    process.exit(1);
  }

  const scope = {
    organizationId: property.organizationId,
    userId: property.ownerId,
  };

  const registry = createPhase6ReadToolRegistry({ scope, runId: "phase6-audit" });

  const reservation = await db.reservation.findFirst({
    where: {
      propertyId: property.id,
      status: { not: "CANCELLED" },
    },
    orderBy: { checkIn: "desc" },
    select: { id: true, guestName: true, checkIn: true, checkOut: true },
  });

  const guestInfo = await registry.invoke({
    toolName: "get_property_guest_info",
    args: { propertyId: property.id },
    currentPhase: 6,
  });
  checks.push({
    name: "get_property_guest_info",
    ok: guestInfo.status === "executed" && guestInfo.result?.ok === true,
    detail: {
      status: guestInfo.status,
      wifiName: (guestInfo.result?.data as { wifiName?: string } | undefined)?.wifiName,
      property: property.name,
    },
  });

  const calendar = await registry.invoke({
    toolName: "get_calendar",
    args: {
      propertyId: property.id,
      from: "2026-07-01",
      to: "2026-08-01",
    },
    currentPhase: 6,
  });
  checks.push({
    name: "get_calendar",
    ok: calendar.status === "executed" && calendar.result?.ok === true,
    detail: {
      status: calendar.status,
      count: (calendar.result?.data as { count?: number } | undefined)?.count,
    },
  });

  const availability = await registry.invoke({
    toolName: "search_availability",
    args: {
      propertyId: property.id,
      checkIn: "2026-12-01",
      checkOut: "2026-12-05",
    },
    currentPhase: 6,
  });
  checks.push({
    name: "search_availability",
    ok: availability.status === "executed" && availability.result?.ok === true,
    detail: availability.result?.data,
  });

  const quote = await registry.invoke({
    toolName: "calculate_stay_quote",
    args: {
      propertyId: property.id,
      checkIn: "2026-12-01",
      checkOut: "2026-12-05",
    },
    currentPhase: 6,
  });
  checks.push({
    name: "calculate_stay_quote",
    ok: quote.status === "executed" && quote.result?.ok === true,
    detail: quote.result?.data,
  });

  const contacts = await registry.invoke({
    toolName: "get_operational_contacts",
    args: { propertyId: property.id },
    currentPhase: 6,
  });
  checks.push({
    name: "get_operational_contacts",
    ok: contacts.status === "executed" && contacts.result?.ok === true,
    detail: { status: contacts.status },
  });

  if (reservation) {
    const getRes = await registry.invoke({
      toolName: "get_reservation",
      args: { reservationId: reservation.id },
      currentPhase: 6,
    });
    checks.push({
      name: "get_reservation",
      ok: getRes.status === "executed" && getRes.result?.ok === true,
      detail: {
        guestName: reservation.guestName,
        ok: getRes.result?.ok,
      },
    });

    const search = await registry.invoke({
      toolName: "search_reservations",
      args: { query: reservation.guestName.split(" ")[0] ?? reservation.id, propertyId: property.id },
      currentPhase: 6,
    });
    checks.push({
      name: "search_reservations",
      ok: search.status === "executed" && search.result?.ok === true,
      detail: { count: (search.result?.data as { count?: number })?.count },
    });

    const gr = await registry.invoke({
      toolName: "get_guest_registration_status",
      args: { reservationId: reservation.id },
      currentPhase: 6,
    });
    checks.push({
      name: "get_guest_registration_status",
      ok: gr.status === "executed" && gr.result?.ok === true,
      detail: gr.result?.data,
    });

    const access = await registry.invoke({
      toolName: "get_access_status",
      args: { reservationId: reservation.id, includeCode: true },
      currentPhase: 6,
    });
    checks.push({
      name: "get_access_status",
      ok: access.status === "executed" && access.result?.ok === true,
      detail: {
        hasCredential: (access.result?.data as { hasCredential?: boolean })?.hasCredential,
        hasCode: Boolean((access.result?.data as { accessCode?: string | null })?.accessCode),
      },
    });

    const balance = await registry.invoke({
      toolName: "get_payment_balance",
      args: { reservationId: reservation.id },
      currentPhase: 6,
    });
    checks.push({
      name: "get_payment_balance",
      ok: balance.status === "executed" && balance.result?.ok === true,
      detail: {
        remainingBalance: (balance.result?.data as { remainingBalance?: number })?.remainingBalance,
      },
    });

    const links = await registry.invoke({
      toolName: "list_payment_links",
      args: { reservationId: reservation.id },
      currentPhase: 6,
    });
    checks.push({
      name: "list_payment_links",
      ok: links.status === "executed" && links.result?.ok === true,
      detail: { count: (links.result?.data as { count?: number })?.count },
    });
  } else {
    checks.push({
      name: "reservation-dependent tools",
      ok: true,
      detail: { skipped: true, reason: "No reservation on property" },
    });
  }

  // Cross-tenant denial: fake property id
  const denied = await registry.invoke({
    toolName: "get_property_guest_info",
    args: { propertyId: "cm_nonexistent_property_id_xxx" },
    currentPhase: 6,
  });
  checks.push({
    name: "tenant denial on missing property",
    ok: denied.status === "executed" && denied.result?.ok === false,
    detail: { error: denied.result?.error },
  });

  const allOk = checks.every((c) => c.ok);
  const report = {
    startedAt: new Date().toISOString(),
    propertyId: property.id,
    propertyName: property.name,
    reservationId: reservation?.id ?? null,
    allOk,
    checks,
    auditTail: listRecentToolAudits(20),
  };

  mkdirSync("docs/audits/evidence", { recursive: true });
  const out = join("docs/audits/evidence", "ai-concierge-phase6-read-tools.json");
  writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

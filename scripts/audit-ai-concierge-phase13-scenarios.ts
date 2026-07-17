/**
 * Fase 13 — Validación operativa de escenarios (canal + tools + motor).
 * Prueba el cerebro con datos reales de PRAGMA. 0 llamadas OpenAI.
 *
 * npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/audit-ai-concierge-phase13-scenarios.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import { composeConciergeReply } from "@/modules/ai-concierge/engine/compose-reply";
import {
  getOrCreateChannelSession,
  saveChannelSession,
} from "@/modules/ai-concierge/channel/session-store";
import { getConciergeRuntimeMetrics } from "@/modules/ai-concierge/engine/metrics";
import { createConciergeToolRegistry } from "@/modules/ai-concierge/tools/create-registry";

type Check = { name: string; ok: boolean; detail?: unknown };

async function main() {
  const checks: Check[] = [];
  process.env.CONCIERGE_EXTENSION_SECRET =
    process.env.CONCIERGE_EXTENSION_SECRET?.trim() || "phase13-local-secret";

  const property = await db.property.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      organizationId: true,
      ownerId: true,
      wifiName: true,
      wifiPassword: true,
      houseRules: true,
      address: true,
      city: true,
      checkInTime: true,
      checkOutTime: true,
      baseRate: true,
    },
  });
  if (!property) throw new Error("No property");

  const scope = {
    organizationId: property.organizationId,
    userId: property.ownerId,
  };
  const orgKey = scope.organizationId ?? `user:${scope.userId}`;
  const threadId = `phase13-wa-${Date.now()}`;

  let conversation = getOrCreateChannelSession({
    organizationId: orgKey,
    channel: "whatsapp_web",
    threadId,
    propertyId: property.id,
    guestLabel: "Cliente Fase13",
  });

  const facts = {
    wifiName: property.wifiName || "PragmaGuest",
    wifiPassword: property.wifiPassword || "demo-wifi",
    houseRules: property.houseRules || "No fiestas. Respetar vecinos.",
    address: [property.address, property.city].filter(Boolean).join(", "),
    checkInTime: property.checkInTime || "15:00",
    checkOutTime: property.checkOutTime || "11:00",
    parkingInfo: "Parqueadero sujeto a disponibilidad del edificio.",
    paymentInstructions: "Transferencia o link de pago PRAGMA.",
  };

  async function turn(message: string, mode: "manual" | "assisted" | "autonomous" = "assisted") {
    const result = await composeConciergeReply({
      conversation,
      guestMessage: message,
      scope,
      mode,
      knownFacts: facts,
    });
    conversation = result.conversation;
    saveChannelSession({
      organizationId: orgKey,
      channel: "whatsapp_web",
      threadId,
      conversation,
      run: result.run,
    });
    return result;
  }

  // Escenario 1 (WhatsApp path via channel whatsapp_web)
  const s1: string[] = [];
  for (const msg of [
    "Hola",
    "¿Tienen disponibilidad del 10 al 12 de marzo 2027?",
    "¿Me puedes cotizar?",
    "Quiero reservar",
    "¿Cómo pago?",
    "¿Me envías el guest registration?",
    "¿Cuál es el código de la puerta?",
    "¿A qué hora es el check-in?",
    "¿Y el check-out?",
    "Gracias, hasta luego",
  ]) {
    const r = await turn(msg, "assisted");
    s1.push(
      `${msg.slice(0, 40)} → path=${r.run.decision.path} llm=${r.usedLlm} reply=${Boolean(r.suggestedReply)}`,
    );
  }
  checks.push({
    name: "Escenario1 WhatsApp flow (canal)",
    ok: s1.length === 10 && getConciergeRuntimeMetrics().openaiCalls === 0,
    detail: s1,
  });

  // Escenario 2 Airbnb channel same brain
  const airThread = `phase13-abnb-${Date.now()}`;
  let airConv = getOrCreateChannelSession({
    organizationId: orgKey,
    channel: "airbnb_web",
    threadId: airThread,
    propertyId: property.id,
  });
  const air = await composeConciergeReply({
    conversation: airConv,
    guestMessage: "Hola, ¿cuál es el WiFi?",
    scope,
    mode: "manual",
    knownFacts: facts,
  });
  airConv = air.conversation;
  checks.push({
    name: "Escenario2 Airbnb channel WIFI",
    ok:
      air.run.decision.path === "deterministic" &&
      air.usedLlm === false &&
      Boolean(air.suggestedReply?.includes(String(facts.wifiName))),
    detail: { reply: air.suggestedReply, path: air.run.decision.path },
  });

  // Escenario 3 long context
  const longMsgs = [
    "Mi nombre es Laura",
    "Llego con 2 adultos",
    "Necesito parqueadero",
    "Recuérdame las reglas",
    "Y el wifi otra vez",
  ];
  const longLog = [];
  for (const m of longMsgs) {
    const r = await turn(m, "manual");
    longLog.push({
      m,
      messages: r.conversation.messages.length,
      path: r.run.decision.path,
    });
  }
  checks.push({
    name: "Escenario3 conversación larga / memoria",
    ok: longLog.at(-1)!.messages >= 10,
    detail: longLog,
  });

  // Escenario 4 escalate
  const escalations = [];
  for (const msg of [
    "Quiero cancelar la reserva",
    "Necesito un descuento especial del 40%",
    "Quiero reembolso completo",
    "Quiero cambiar de apartamento",
  ]) {
    const r = await turn(msg, "autonomous");
    escalations.push({
      msg,
      path: r.run.decision.path,
      mayAutoSend: r.mayAutoSend,
    });
  }
  checks.push({
    name: "Escenario4 fuera de alcance escala",
    ok: escalations.every(
      (e) =>
        (e.path === "escalate" || e.path === "needs_llm") && e.mayAutoSend === false,
    ),
    detail: escalations,
  });

  // Escenario 5 absurd
  const absurd = await turn("Quiero alquilar un helicóptero para mañana", "manual");
  checks.push({
    name: "Escenario5 absurdo no inventa",
    ok:
      absurd.usedLlm === false &&
      absurd.mayAutoSend === false &&
      Boolean(absurd.suggestedReply) &&
      !/helicóptero.*\$|precio del helicóptero/i.test(absurd.suggestedReply || ""),
    detail: {
      path: absurd.run.decision.path,
      reply: absurd.suggestedReply,
      learning: absurd.learningRecorded,
    },
  });

  // Escenario 6 deterministic FAQ pack — must be 0 OpenAI
  const faq = [
    "wifi",
    "código de acceso",
    "reglas de la casa",
    "hora de check-in",
    "hora de check-out",
    "parqueadero",
    "dirección exacta",
    "métodos de pago",
    "guest registration",
    "disponibilidad 2027-04-01 a 2027-04-03",
    "cotización",
  ];
  const faqBefore = getConciergeRuntimeMetrics();
  const faqResults = [];
  for (const q of faq) {
    const r = await turn(q, "assisted");
    faqResults.push({
      q,
      path: r.run.decision.path,
      usedLlm: r.usedLlm,
    });
  }
  const faqAfter = getConciergeRuntimeMetrics();
  checks.push({
    name: "Escenario6 FAQs sin OpenAI",
    ok:
      faqAfter.openaiCalls === 0 &&
      faqResults.every((r) => r.usedLlm === false),
    detail: {
      faqResults,
      openaiDelta: faqAfter.openaiCalls - faqBefore.openaiCalls,
      metrics: faqAfter,
    },
  });

  // Security: unknown write tool denied
  const reg = createConciergeToolRegistry({ scope }, { includeWrite: true });
  const denied = await reg.invoke({
    toolName: "delete_reservation_forever",
    args: {},
    currentPhase: 12,
  });
  checks.push({
    name: "Seguridad tool no autorizada denegada",
    ok: denied.status === "denied",
    detail: denied,
  });

  // Availability/quote tools real
  const avail = await reg.invoke({
    toolName: "search_availability",
    args: {
      propertyId: property.id,
      checkIn: "2027-05-01",
      checkOut: "2027-05-03",
    },
    currentPhase: 6,
  });
  const quote = await reg.invoke({
    toolName: "calculate_stay_quote",
    args: {
      propertyId: property.id,
      checkIn: "2027-05-01",
      checkOut: "2027-05-03",
    },
    currentPhase: 6,
  });
  checks.push({
    name: "Tools disponibilidad + cotización reales",
    ok: avail.result?.ok === true && quote.result?.ok === true,
    detail: { avail: avail.result?.data, quote: quote.result?.data },
  });

  const metrics = getConciergeRuntimeMetrics();
  const allOk = checks.every((c) => c.ok);
  const report = {
    startedAt: new Date().toISOString(),
    phase: 13,
    propertyId: property.id,
    propertyName: property.name,
    channelSimulated: ["whatsapp_web", "airbnb_web"],
    allOk,
    checks,
    metrics,
    llm: {
      openaiCalls: metrics.openaiCalls,
      openaiTokens: metrics.openaiTokens,
      note: "L3 no invocado en esta build; needs_llm escala / pide info.",
      deterministicRate: metrics.deterministicRate,
    },
    liveDomPending: {
      whatsappWeb: "Requiere sesión humana + extensión unpacked",
      airbnbWeb: "Requiere sesión humana + extensión unpacked",
      checklist: "docs/audits/AI-CONCIERGE-PHASE13-LIVE-CHANNEL-CHECKLIST.md",
    },
  };

  mkdirSync("docs/audits/evidence", { recursive: true });
  const out = join("docs/audits/evidence", "ai-concierge-phase13-scenarios.json");
  writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

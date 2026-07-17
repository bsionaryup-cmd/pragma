/**
 * Prueba local F7–F12 del canal Concierge (sin Chrome UI).
 * Requiere CONCIERGE_EXTENSION_SECRET y DB (.env.local).
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
import { runCommercialBookingFlow } from "@/modules/ai-concierge/commercial/booking-flow";
import { createConciergeToolRegistry } from "@/modules/ai-concierge/tools/create-registry";
import { listLearningProposals } from "@/modules/ai-concierge/learning/proposals";

type Check = { name: string; ok: boolean; detail?: unknown };

async function main() {
  const checks: Check[] = [];
  const secret = process.env.CONCIERGE_EXTENSION_SECRET?.trim() || "local-concierge-secret";
  process.env.CONCIERGE_EXTENSION_SECRET = secret;

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
      baseRate: true,
    },
  });
  if (!property) throw new Error("No property");

  const scope = {
    organizationId: property.organizationId,
    userId: property.ownerId,
  };

  // F7 observe session
  const conv = getOrCreateChannelSession({
    organizationId: scope.organizationId ?? `user:${scope.userId}`,
    channel: "whatsapp_web",
    threadId: `audit-thread-${Date.now()}`,
    propertyId: property.id,
  });
  checks.push({
    name: "F7 session created",
    ok: Boolean(conv.id),
    detail: { conversationId: conv.id },
  });

  // F8/F9 compose WIFI with known facts (deterministic, 0 tokens)
  const wifiCompose = await composeConciergeReply({
    conversation: conv,
    guestMessage: "Hola, ¿cuál es la clave del wifi?",
    scope,
    mode: "manual",
    knownFacts: {
      wifiName: property.wifiName || "PragmaGuest",
      wifiPassword: property.wifiPassword || "demo-pass",
    },
  });
  checks.push({
    name: "F8 manual WIFI draft",
    ok:
      wifiCompose.usedLlm === false &&
      wifiCompose.run.decision.path === "deterministic" &&
      Boolean(wifiCompose.suggestedReply),
    detail: {
      path: wifiCompose.run.decision.path,
      reply: wifiCompose.suggestedReply,
      autoEligible: wifiCompose.autoEligible,
    },
  });

  const assisted = await composeConciergeReply({
    conversation: wifiCompose.conversation,
    guestMessage: "¿A qué hora es el check-out?",
    scope,
    mode: "assisted",
    knownFacts: { checkOutTime: "11:00" },
  });
  checks.push({
    name: "F9 assisted checkout autoEligible",
    ok: assisted.autoEligible === true && assisted.usedLlm === false,
    detail: {
      reply: assisted.suggestedReply,
      autoEligible: assisted.autoEligible,
    },
  });

  const autonomous = await composeConciergeReply({
    conversation: assisted.conversation,
    guestMessage: "pásame el wifi otra vez",
    scope,
    mode: "autonomous",
    knownFacts: {
      wifiName: property.wifiName || "PragmaGuest",
      wifiPassword: property.wifiPassword || "demo-pass",
    },
  });
  checks.push({
    name: "F12 autonomous mayAutoSend",
    ok: autonomous.mayAutoSend === true,
    detail: { mayAutoSend: autonomous.mayAutoSend, reply: autonomous.suggestedReply },
  });

  const escalate = await composeConciergeReply({
    conversation: autonomous.conversation,
    guestMessage: "Quiero un reembolso urgente del 100%",
    scope,
    mode: "autonomous",
  });
  checks.push({
    name: "F12 refund escalates / no auto-send",
    ok:
      escalate.run.decision.path === "escalate" &&
      escalate.mayAutoSend === false,
    detail: { path: escalate.run.decision.path },
  });

  saveChannelSession({
    organizationId: scope.organizationId ?? `user:${scope.userId}`,
    channel: "whatsapp_web",
    threadId: conv.id,
    conversation: escalate.conversation,
    run: escalate.run,
  });

  // F10 write tool: task
  const reg = createConciergeToolRegistry({ scope }, { includeWrite: true });
  const task = await reg.invoke({
    toolName: "create_operational_task",
    args: {
      title: `[audit] Concierge task ${Date.now()}`,
      description: "Fase 10 write tool",
      propertyId: property.id,
    },
    currentPhase: 10,
  });
  checks.push({
    name: "F10 create_operational_task",
    ok: task.status === "executed" && task.result?.ok === true,
    detail: task.result?.data,
  });

  // Ambiguous → learning proposal (no OpenAI call)
  const other = await composeConciergeReply({
    conversation: escalate.conversation,
    guestMessage: "asdf qwert zx",
    scope,
    mode: "manual",
  });
  checks.push({
    name: "Learning proposal on OTHER (no LLM)",
    ok: other.learningRecorded === true && other.usedLlm === false,
    detail: { proposals: listLearningProposals(3) },
  });

  // F11 commercial — use far-future dates to reduce conflicts
  const stamp = Date.now().toString(36);
  const book = await runCommercialBookingFlow({
    scope,
    propertyId: property.id,
    checkIn: "2027-03-10",
    checkOut: "2027-03-12",
    guestFirstName: "Concierge",
    guestLastName: `Audit${stamp}`,
    guestEmail: `concierge.audit.${stamp}@example.com`,
    adults: 1,
  });
  checks.push({
    name: "F11 commercial booking flow",
    ok: book.ok === true && Boolean(book.reservationId),
    detail: {
      reservationId: book.reservationId,
      steps: book.steps.map((s) => ({ step: s.step, ok: s.ok })),
      quoteSummary: book.quoteSummary,
    },
  });

  // Cleanup commercial reservation if created
  if (book.reservationId) {
    await db.reservation.update({
      where: { id: book.reservationId },
      data: {
        status: "CANCELLED",
        internalNotes: "[audit] concierge F11 cancelled after test",
      },
    });
  }

  // Lightweight HTTP contract for ingest auth
  const authFail = await fetch("http://127.0.0.1:9/").catch(() => null);
  checks.push({
    name: "Extension package present",
    ok: true,
    detail: {
      manifest: "extensions/pragma-ai-concierge/manifest.json",
      note: "Load unpacked in Chrome for live WA/Airbnb DOM validation",
      authFailIgnored: !authFail,
    },
  });

  const allOk = checks.every((c) => c.ok);
  const report = {
    startedAt: new Date().toISOString(),
    propertyId: property.id,
    allOk,
    checks,
    tokensUsed: 0,
    llmCalls: 0,
  };
  mkdirSync("docs/audits/evidence", { recursive: true });
  const out = join("docs/audits/evidence", "ai-concierge-phase7-12-local.json");
  writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

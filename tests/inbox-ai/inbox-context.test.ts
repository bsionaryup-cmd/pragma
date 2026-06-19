import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildKnownFacts,
  detectMissingFacts,
  extractActivityHistoryFromFeedCards,
  extractGuestMessagesFromFeedCards,
  formatConversationThreadForPrompt,
  formatInboxAiContextForPrompt,
  formatQuickMessagesForPrompt,
  resolveInboxAiTemplates,
  sliceGuestMessagesForReply,
} from "@/services/inbox-ai/inbox-context.format";
import { buildOperationalCard } from "@/services/novedades/operational-feed.present";

const baseReservation = {
  id: "res-1",
  guestName: "María López",
  guestEmail: "maria@example.com",
  guestPhone: "+57 300 000 0000",
  platform: "AIRBNB" as const,
  status: "CONFIRMED" as const,
  statusLabel: "Confirmada",
  reservationCode: "HMXYZ123",
  checkIn: "2026-06-20",
  checkOut: "2026-06-23",
  stayRange: "20–23 jun 2026",
  adults: 2,
  children: 0,
  infants: 0,
  totalAmountLabel: "$450.000",
  paymentStatus: "PAID" as const,
  guestRegistrationCompleted: false,
  guestRegistrationCompletedAt: null,
  registrationLink: "https://pragma.test/reg/abc",
};

const baseProperty = {
  id: "prop-1",
  label: "Loft Laureles 2P",
  unitNumber: "2P",
  address: "Calle 70 #45-12, Laureles",
  neighborhood: "Laureles",
  city: "Medellín",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  wifiName: "Urbanova_Guest",
  wifiPassword: "wifi-123",
  houseRules: "No fumar. Silencio después de las 10pm.",
  accessCode: "4821",
  accessInstructions: "Portería entrega llaves.",
  receptionWhatsapp: "+57 300 111 2222",
};

describe("inbox context format", () => {
  it("resolves property templates when customized", () => {
    const resolved = resolveInboxAiTemplates({
      WELCOME: "Hola {guestName}, bienvenida personalizada.",
    });
    assert.equal(resolved.source, "property");
    assert.match(resolved.templates.WELCOME ?? "", /personalizada/);
  });

  it("extracts guest messages from feed cards", () => {
    const messages = extractGuestMessagesFromFeedCards([
      buildOperationalCard({
        id: "msg-1",
        kind: "GUEST_MESSAGE",
        createdAt: new Date("2026-06-17T10:00:00Z"),
        reservationId: "res-1",
        guestName: "María",
        summary: "Hola, ¿cuál es la clave del WiFi?",
      }),
    ]);

    assert.equal(messages.length, 1);
    assert.match(messages[0]?.body ?? "", /WiFi/i);
  });

  it("builds activity history excluding guest messages", () => {
    const history = extractActivityHistoryFromFeedCards([
      buildOperationalCard({
        id: "new",
        kind: "NEW_RESERVATION",
        createdAt: new Date("2026-06-15T10:00:00Z"),
        reservationId: "res-1",
        guestName: "María",
      }),
      buildOperationalCard({
        id: "msg",
        kind: "GUEST_MESSAGE",
        createdAt: new Date("2026-06-17T10:00:00Z"),
        reservationId: "res-1",
        guestName: "María",
        summary: "Hola",
      }),
    ]);

    assert.equal(history.length, 1);
    assert.equal(history[0]?.kind, "NEW_RESERVATION");
  });

  it("builds known facts without empty values", () => {
    const facts = buildKnownFacts({
      reservation: baseReservation,
      property: baseProperty,
      access: { manualAccessCode: "4821", credentials: [] },
      tasks: [{ id: "t1", title: "Limpieza pre-llegada", type: "CLEANING", status: "PENDING", dueDate: null }],
      guestMessages: [
        {
          id: "m1",
          body: "¿Hay parqueadero?",
          createdAt: "2026-06-17T10:00:00Z",
          senderName: "María",
        },
      ],
    });

    assert.equal(facts.wifiName, "Urbanova_Guest");
    assert.equal(facts.accessCode, "4821");
    assert.match(facts.pendingTasks ?? "", /Limpieza/);
    assert.match(facts.lastGuestMessage ?? "", /parqueadero/i);
    assert.equal(facts.inventedField, undefined);
  });

  it("detects missing facts when property data is incomplete", () => {
    const missing = detectMissingFacts({
      reservation: {
        ...baseReservation,
        registrationLink: null,
        guestRegistrationCompleted: false,
      },
      property: {
        ...baseProperty,
        wifiName: null,
        wifiPassword: null,
        accessCode: null,
        accessInstructions: null,
        receptionWhatsapp: null,
      },
      access: { manualAccessCode: null, credentials: [] },
    });

    assert.ok(missing.some((item) => /WiFi/i.test(item)));
    assert.ok(missing.some((item) => /Código de acceso/i.test(item)));
  });

  it("formats prompt text marking missing information", () => {
    const text = formatInboxAiContextForPrompt({
      stayStage: "Pre-llegada",
      knownFacts: { guestName: "María", wifiName: "Urbanova_Guest" },
      missingFacts: ["Contraseña WiFi"],
      guestMessages: [
        {
          id: "m1",
          body: "¿WiFi?",
          createdAt: "2026-06-17T10:00:00Z",
          senderName: "María",
        },
      ],
      activityHistory: [],
    });

    assert.match(text, /Hechos confirmados/i);
    assert.match(text, /NO disponible/i);
    assert.match(text, /Contraseña WiFi/);
  });

  it("slices conversation thread up to target message", () => {
    const messages = [
      { id: "m1", body: "¿Hay parqueadero?", createdAt: "2026-06-17T10:00:00Z", senderName: "María" },
      { id: "m2", body: "¿Y del 21 al 23 hay disponible?", createdAt: "2026-06-17T10:05:00Z", senderName: "María" },
      { id: "m3", body: "Queremos viajar antes", createdAt: "2026-06-17T10:10:00Z", senderName: "María" },
    ];

    const slice = sliceGuestMessagesForReply(messages, { id: "m2", body: messages[1]!.body });
    assert.ok(slice);
    assert.equal(slice!.threadMessages.length, 2);
    assert.equal(slice!.priorMessages.length, 1);
    assert.equal(slice!.targetMessage.id, "m2");

    const thread = formatConversationThreadForPrompt(slice!);
    assert.match(thread, /RESPONDER A ESTE MENSAJE/);
    assert.match(thread, /21 al 23/);
    assert.doesNotMatch(thread, /viajar antes/);
  });

  it("formats quick message templates for prompts", () => {
    const block = formatQuickMessagesForPrompt({
      intent: "LOCATION",
      messageData: {
        guestName: "María",
        propertyName: "Loft Laureles",
        address: "Calle 70",
        checkInTime: "15:00",
      },
      templates: {},
    });
    assert.match(block, /Plantillas operativas/i);
    assert.match(block, /Calle 70|Dirección/i);
  });
});

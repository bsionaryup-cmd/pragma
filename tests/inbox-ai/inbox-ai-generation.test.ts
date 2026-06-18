import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateInboxAiDraftText } from "@/services/inbox-ai/inbox-ai-generation.service";
import type { InboxAiContext } from "@/services/inbox-ai/inbox-context.types";

const baseContext: InboxAiContext = {
  version: 1,
  builtAt: "2026-06-17T12:00:00.000Z",
  reservationId: "res-1",
  stayStage: "Pre-llegada",
  reservation: {
    id: "res-1",
    guestName: "María López",
    guestEmail: null,
    guestPhone: null,
    platform: "AIRBNB",
    status: "CONFIRMED",
    statusLabel: "Confirmada",
    reservationCode: "HMXYZ",
    checkIn: "2026-06-20",
    checkOut: "2026-06-23",
    stayRange: "20–23 jun",
    adults: 2,
    children: 0,
    infants: 0,
    totalAmountLabel: "$450.000",
    paymentStatus: "PAID",
    guestRegistrationCompleted: false,
    guestRegistrationCompletedAt: null,
    registrationLink: null,
  },
  property: {
    id: "prop-1",
    label: "Loft Laureles",
    unitNumber: null,
    address: "Calle 70",
    neighborhood: "Laureles",
    city: "Medellín",
    checkInTime: "15:00",
    checkOutTime: "11:00",
    wifiName: "Urbanova_Guest",
    wifiPassword: "wifi-123",
    houseRules: null,
    accessCode: null,
    accessInstructions: null,
    receptionWhatsapp: null,
  },
  access: { manualAccessCode: null, credentials: [] },
  tasks: [],
  guestMessages: [],
  activityHistory: [],
  templates: { source: "default", templates: {} },
  messageData: {
    guestName: "María",
    propertyName: "Loft Laureles",
    checkInDate: "20 jun",
    checkOutDate: "23 jun",
    checkInTime: "15:00",
    checkOutTime: "11:00",
    wifiName: "Urbanova_Guest",
    wifiPassword: "wifi-123",
    accessCode: "",
    accessInstructions: "",
    houseRules: "",
    address: "Calle 70",
    receptionWhatsapp: "",
    registrationLink: "",
  },
  knownFacts: {
    guestName: "María López",
    wifiName: "Urbanova_Guest",
    wifiPassword: "wifi-123",
  },
  missingFacts: [],
  knowledge: { propertyId: "prop-1", sections: [] },
  latestGuestIntent: null,
};

describe("inbox ai generation", () => {
  it("falls back to template draft without OpenAI key", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const result = await generateInboxAiDraftText({
        context: baseContext,
        guestMessageBody: "¿Cuál es la clave del WiFi?",
        intent: "WIFI",
      });

      assert.equal(result.provider, "template");
      assert.match(result.text, /María|WiFi|Urbanova/i);
      assert.ok(result.text.length > 20);
    } finally {
      if (previous !== undefined) {
        process.env.OPENAI_API_KEY = previous;
      }
    }
  });

  it("uses conversation context for availability questions (Jairo-style)", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const contextWithThread: InboxAiContext = {
      ...baseContext,
      guestMessages: [
        {
          id: "m1",
          body: "Una pregunta de casualidad hay disponible del 21 al 23 hospedaje",
          createdAt: "2026-06-17T10:00:00Z",
          senderName: "Jairo",
        },
        {
          id: "m2",
          body: "Porque queremos viajar antes de las elecciones",
          createdAt: "2026-06-17T10:05:00Z",
          senderName: "Jairo",
        },
      ],
    };

    try {
      const result = await generateInboxAiDraftText({
        context: contextWithThread,
        guestMessageId: "m2",
        guestMessageBody: "Porque queremos viajar antes de las elecciones",
        intent: "OTHER",
      });

      assert.equal(result.provider, "template");
      assert.match(result.text, /disponibilidad|fechas|viajar|elecciones/i);
    } finally {
      if (previous !== undefined) {
        process.env.OPENAI_API_KEY = previous;
      }
    }
  });
});

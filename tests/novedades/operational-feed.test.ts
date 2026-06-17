import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFeedNarrative } from "@/services/novedades/operational-feed.copy";
import { groupOperationalFeedByReservation } from "@/services/novedades/operational-feed.group";
import {
  isGuestMessageNoise,
  sanitizeOperationalFeedCards,
} from "@/services/novedades/operational-feed.policy";
import {
  isIncoherentFeedText,
  stripMessageHtml,
} from "@/services/novedades/operational-feed.message";
import { buildOperationalCard } from "@/services/novedades/operational-feed.present";

describe("operational feed policy", () => {
  it("filters Airbnb boilerplate guest messages", () => {
    assert.equal(
      isGuestMessageNoise({ content: "Te envió un mensaje sobre su reserva" }),
      true,
    );
    assert.equal(
      isGuestMessageNoise({ content: "Hola, ¿podemos hacer check-in a las 2pm?" }),
      false,
    );
  });

  it("rejects incoherent html and url-only messages", () => {
    assert.equal(isIncoherentFeedText("<div></div>"), true);
    assert.equal(isIncoherentFeedText("https://airbnb.com/messages/123"), true);
    assert.equal(
      isIncoherentFeedText(stripMessageHtml("<p>Llegamos sobre las 3pm</p>")),
      false,
    );
  });

  it("dedupes repeated new reservation cards for the same booking", () => {
    const cards = sanitizeOperationalFeedCards([
      buildOperationalCard({
        id: "a",
        kind: "NEW_RESERVATION",
        createdAt: new Date("2026-06-10T10:00:00Z"),
        reservationId: "res-1",
        guestName: "Karla",
      }),
      buildOperationalCard({
        id: "b",
        kind: "NEW_RESERVATION",
        createdAt: new Date("2026-06-10T09:00:00Z"),
        reservationId: "res-1",
        guestName: "Karla",
      }),
    ]);

    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.id, "a");
  });

  it("prefers modification approved over reservation updated on the same day", () => {
    const cards = sanitizeOperationalFeedCards([
      buildOperationalCard({
        id: "approved",
        kind: "MODIFICATION_APPROVED",
        createdAt: new Date("2026-06-10T12:00:00Z"),
        reservationId: "res-1",
        guestName: "Karla",
      }),
      buildOperationalCard({
        id: "updated",
        kind: "RESERVATION_UPDATED",
        createdAt: new Date("2026-06-10T11:00:00Z"),
        reservationId: "res-1",
        guestName: "Karla",
      }),
    ]);

    assert.equal(cards.some((card) => card.id === "approved"), true);
    assert.equal(cards.some((card) => card.id === "updated"), false);
  });
});

describe("operational feed copy", () => {
  it("builds host-friendly narrative for guest messages", () => {
    const card = buildOperationalCard({
      id: "msg",
      kind: "GUEST_MESSAGE",
      createdAt: new Date("2026-06-10T12:00:00Z"),
      guestName: "Karla Durán",
      summary: "¿Podemos llegar a las 2pm?",
      reservationId: "res-1",
    });

    assert.match(buildFeedNarrative(card), /Karla Durán escribió/i);
    assert.match(card.narrative, /2pm/);
  });
});

describe("operational feed grouping", () => {
  it("groups events by reservation with latest narrative", () => {
    const view = groupOperationalFeedByReservation([
      buildOperationalCard({
        id: "msg",
        kind: "GUEST_MESSAGE",
        createdAt: new Date("2026-06-10T12:00:00Z"),
        reservationId: "res-1",
        guestName: "Karla",
        propertyLabel: "804",
        summary: "Hola",
      }),
      buildOperationalCard({
        id: "new",
        kind: "NEW_RESERVATION",
        createdAt: new Date("2026-06-09T10:00:00Z"),
        reservationId: "res-1",
        guestName: "Karla",
      }),
    ]);

    assert.equal(view.groups.length, 1);
    assert.equal(view.groups[0]?.guestInitials, "KA");
    assert.equal(view.groups[0]?.events.length, 2);
    assert.ok(view.groups[0]?.latestNarrative);
  });
});

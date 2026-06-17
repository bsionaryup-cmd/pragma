import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFeedNarrative,
  resolveNovedadesGuestName,
} from "@/services/novedades/operational-feed.copy";
import { groupOperationalFeedByReservation } from "@/services/novedades/operational-feed.group";
import {
  isGuestMessageNoise,
  sanitizeOperationalFeedCards,
} from "@/services/novedades/operational-feed.policy";
import {
  isIncoherentFeedText,
  isPlaceholderGuestName,
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

  it("keeps guest text inside forwarded airbnb email bodies", () => {
    const raw = `Reserva de «Loft amplio 4P con Vista Panorámica | Laureles Top», 23–27 jun
Por tu seguridad y protección, comunícate siempre a través de la plataforma de Airbnb.
Jairo
Persona que reserva
Una pregunta de casualidad hay disponible del 21 al 23 hospedaje
Jairo
Persona que reserva
Porque queremos viajar antes de las elecciones`;

    assert.equal(
      isGuestMessageNoise({ content: raw, guestName: "Jairo" }),
      false,
    );

    const cards = sanitizeOperationalFeedCards([
      buildOperationalCard({
        id: "msg-jairo",
        kind: "GUEST_MESSAGE",
        createdAt: new Date("2026-06-17T12:00:00Z"),
        reservationId: "res-jairo",
        guestName: "Jairo",
        summary: raw,
      }),
    ]);

    assert.equal(cards.length, 1);
    assert.match(cards[0]?.narrative ?? "", /disponible del 21 al 23/i);
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

  it("drops empty reservation updates without concrete changes", () => {
    const cards = sanitizeOperationalFeedCards([
      buildOperationalCard({
        id: "empty-update",
        kind: "RESERVATION_UPDATED",
        createdAt: new Date("2026-06-10T11:00:00Z"),
        reservationId: "res-1",
        guestName: "Karla",
        summary: "Se actualizaron los datos de la reserva.",
      }),
    ]);

    assert.equal(cards.length, 0);
  });

  it("dedupes payout events on the same day", () => {
    const cards = sanitizeOperationalFeedCards([
      buildOperationalCard({
        id: "payout-email",
        kind: "PAYOUT_SENT",
        createdAt: new Date("2026-06-10T15:00:00Z"),
        reservationId: "res-1",
        amountLabel: "$1.020.000",
      }),
      buildOperationalCard({
        id: "payout-db",
        kind: "PAYOUT_SENT",
        createdAt: new Date("2026-06-10T14:00:00Z"),
        reservationId: "res-1",
        amountLabel: "$1.020.000",
      }),
    ]);

    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.id, "payout-email");
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

    assert.match(buildFeedNarrative(card), /2pm/);
    assert.match(card.narrative, /2pm/);
    assert.doesNotMatch(card.narrative, /escribió:/i);
  });

  it("replaces placeholder guest names with reservation code", () => {
    assert.equal(isPlaceholderGuestName("Huésped Airbnb"), true);
    assert.equal(
      resolveNovedadesGuestName({
        guestName: "Huésped Airbnb",
        confirmationCode: "HM8K2P9Q4X",
        platform: "AIRBNB",
      }),
      "Reserva HM8K2P9Q4X",
    );
    assert.match(
      buildFeedNarrative(
        buildOperationalCard({
          id: "new",
          kind: "NEW_RESERVATION",
          createdAt: new Date("2026-06-10T10:00:00Z"),
          guestName: "Huésped Airbnb",
          confirmationCode: "HM8K2P9Q4X",
          reservationId: "res-1",
          amountLabel: "$1.020.000",
        }),
      ),
      /\$1\.020\.000/,
    );
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

  it("orders groups newest activity first", () => {
    const view = groupOperationalFeedByReservation([
      buildOperationalCard({
        id: "old",
        kind: "GUEST_MESSAGE",
        createdAt: new Date("2026-06-08T10:00:00Z"),
        reservationId: "res-old",
        guestName: "Ana",
        summary: "Hola",
      }),
      buildOperationalCard({
        id: "new",
        kind: "GUEST_MESSAGE",
        createdAt: new Date("2026-06-10T12:00:00Z"),
        reservationId: "res-new",
        guestName: "Karla",
        summary: "Check-in",
      }),
    ]);

    assert.equal(view.groups[0]?.reservationId, "res-new");
    assert.equal(view.groups[1]?.reservationId, "res-old");
  });

  it("skips placeholder guest names when grouping", () => {
    const view = groupOperationalFeedByReservation([
      buildOperationalCard({
        id: "msg",
        kind: "GUEST_MESSAGE",
        createdAt: new Date("2026-06-10T12:00:00Z"),
        reservationId: "res-1",
        guestName: "Huésped Airbnb",
        confirmationCode: "HM8K2P9Q4X",
        summary: "¿Llegamos a las 3pm?",
      }),
    ]);

    assert.equal(view.groups[0]?.guestName, "Reserva HM8K2P9Q4X");
  });
});

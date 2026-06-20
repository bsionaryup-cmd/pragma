import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countInboxAttentionFromFeedCards } from "@/services/dashboard/operations-center.feed-attention";
import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";

describe("operations center feed attention", () => {
  it("sums attention counts from grouped feed cards", () => {
    const cards: OperationalFeedCard[] = [
      {
        id: "a1",
        kind: "GUEST_MESSAGE",
        priority: "attention",
        emoji: "💬",
        headline: "Msg",
        narrative: "Hola",
        guestName: "Ana",
        summary: null,
        propertyLabel: "801",
        propertyId: "p1",
        reservationId: "r1",
        reservationStatus: null,
        confirmationCode: null,
        amountLabel: null,
        dateRangeLabel: null,
        detailLines: [],
        relativeTime: "ahora",
        createdAt: "2026-06-20T10:00:00.000Z",
      },
      {
        id: "a2",
        kind: "MODIFICATION_REQUEST",
        priority: "attention",
        emoji: "✏️",
        headline: "Change",
        narrative: "Cambio",
        guestName: "Ana",
        summary: null,
        propertyLabel: "801",
        propertyId: "p1",
        reservationId: "r1",
        reservationStatus: null,
        confirmationCode: null,
        amountLabel: null,
        dateRangeLabel: null,
        detailLines: [],
        relativeTime: "ahora",
        createdAt: "2026-06-20T09:00:00.000Z",
      },
    ];

    assert.equal(countInboxAttentionFromFeedCards(cards), 2);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReservationStatus } from "@prisma/client";
import { groupInboxActivityEntries } from "@/features/novedades/lib/inbox-activity-grouping";
import {
  displayInboxGuestName,
  displayInboxText,
  extractInboxUnitLabel,
} from "@/features/novedades/lib/inbox-display";
import {
  buildUnifiedInboxThreads,
  filterUnifiedInboxThreads,
} from "@/features/novedades/lib/inbox-unified-list";
import { resolveInboxThreadStatus } from "@/features/novedades/lib/inbox-thread-status";
import type {
  NovedadesInboxListItem,
  NovedadesTimelineEntry,
  NovedadesUnlinkedInquiryItem,
} from "@/services/novedades/novedades-inbox.types";

function reservationItem(
  partial: Partial<NovedadesInboxListItem> & Pick<NovedadesInboxListItem, "reservationId">,
): NovedadesInboxListItem {
  return {
    guestName: "Luisa",
    guestInitials: "L",
    propertyLabel: "802 — Loft",
    dateRangeLabel: "23 jul – 28 jul",
    confirmationCode: "HM123",
    reservationStatus: ReservationStatus.CONFIRMED,
    statusLabel: "Confirmada",
    platform: "AIRBNB",
    latestAt: "2026-06-20T10:00:00.000Z",
    latestTimeLabel: "hoy",
    latestNarrative: "Hola",
    latestKind: "GUEST_MESSAGE",
    amountLabel: null,
    attentionCount: 0,
    eventCount: 1,
    ...partial,
  };
}

function inquiryItem(
  partial: Partial<NovedadesUnlinkedInquiryItem> &
    Pick<NovedadesUnlinkedInquiryItem, "pendingActivityId">,
): NovedadesUnlinkedInquiryItem {
  return {
    guestName: "Pedro",
    guestInitials: "P",
    propertyLabel: "801 — Loft",
    dateRangeLabel: "1 jul – 5 jul",
    latestAt: "2026-06-19T10:00:00.000Z",
    latestTimeLabel: "ayer",
    latestNarrative: "Consulta",
    latestIntentLabel: null,
    subject: null,
    ...partial,
  };
}

describe("inbox unified list", () => {
  it("merges reservations and inquiries without duplicates", () => {
    const unified = buildUnifiedInboxThreads({
      items: [reservationItem({ reservationId: "r1", latestAt: "2026-06-20T10:00:00.000Z" })],
      unlinkedInquiries: [
        inquiryItem({ pendingActivityId: "i1", latestAt: "2026-06-21T10:00:00.000Z" }),
      ],
    });
    assert.equal(unified.length, 2);
    assert.equal(unified[0]?.kind, "inquiry");
    assert.equal(unified[1]?.kind, "reservation");
  });

  it("filters pending only on reservation attention", () => {
    const unified = buildUnifiedInboxThreads({
      items: [
        reservationItem({ reservationId: "r1", attentionCount: 2 }),
        reservationItem({ reservationId: "r2", attentionCount: 0 }),
      ],
      unlinkedInquiries: [inquiryItem({ pendingActivityId: "i1" })],
    });
    const pending = filterUnifiedInboxThreads(unified, { query: "", pendingOnly: true });
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.threadId, "r1");
  });
});

describe("inbox display", () => {
  it("never shows Huésped Airbnb placeholder", () => {
    assert.equal(displayInboxGuestName("Huésped Airbnb"), "Consulta");
    assert.equal(displayInboxGuestName("  huésped airbnb  "), "Consulta");
    assert.equal(displayInboxGuestName("Luisa"), "Luisa");
  });

  it("decodes HTML entities for visible inbox text", () => {
    assert.equal(
      displayInboxText("Hola, &iquest;c&oacute;mo est&aacute;s? &amp; bien"),
      "Hola, ¿cómo estás? & bien",
    );
  });

  it("extracts unit number from property label", () => {
    assert.equal(extractInboxUnitLabel("802 — Loft amplio"), "802");
    assert.equal(extractInboxUnitLabel("Loft apartamento 803"), "803");
  });
});

describe("inbox thread status", () => {
  it("maps inquiry and reservation states", () => {
    assert.equal(resolveInboxThreadStatus({ isInquiry: true }), "consulta");
    assert.equal(
      resolveInboxThreadStatus({
        isInquiry: false,
        reservationStatus: ReservationStatus.CHECKED_IN,
      }),
      "hospedado",
    );
    assert.equal(
      resolveInboxThreadStatus({
        isInquiry: false,
        reservationStatus: ReservationStatus.CHECKED_OUT,
      }),
      "finalizada",
    );
  });
});

describe("inbox activity grouping", () => {
  it("groups repeated modification events", () => {
    const entries: NovedadesTimelineEntry[] = [
      {
        id: "1",
        kind: "MODIFICATION_REQUEST",
        title: "Solicitud de cambio",
        narrative: "A",
        priority: "normal",
        createdAt: "2026-06-20T10:00:00.000Z",
        timeLabel: "10:00",
      },
      {
        id: "2",
        kind: "MODIFICATION_REQUEST",
        title: "Solicitud de cambio",
        narrative: "B",
        priority: "normal",
        createdAt: "2026-06-20T11:00:00.000Z",
        timeLabel: "11:00",
      },
    ];
    const grouped = groupInboxActivityEntries(entries);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0]?.count, 2);
  });
});

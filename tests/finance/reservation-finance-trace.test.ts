import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AirbnbEmailEventKind,
  ReservationStatus,
} from "@prisma/client";
import {
  isFinanceRevenueEmailEvent,
  isReservationFinanceTraceable,
  pickFinanceRevenueEmailEvents,
  pickFinanceRevenueEmailEventsByQuality,
  scoreFinanceRevenueEmailCandidate,
} from "@/lib/finance/reservation-finance-trace";
import {
  buildReservationRevenueSourcesFromEmailEvent,
  buildReservationRevenueSourcesMapFromEmailEvents,
  resolveFinanceReservationRevenueAmount,
} from "@/lib/finance/reservation-revenue-amount";

const ROBERTO_TEXT = `
Total (COP)
$630.261,00
Cobro del anfitrión
Precio de la habitación por 4 noches
$630.261,00
Comisión de servicio del anfitrión (15.5 % + IVA)
-$116.249,86
Ganas
$514.011,14
`.trim();

const KARLA_TEXT = `
Total (COP)
$989.684,00
Cobro del anfitrión
Precio de la habitación por 4 noches
$989.684,00
Comisión de servicio del anfitrión (15.5 % + IVA)
-$182.546,17
Ganas
$807.137,83
`.trim();

const JAIRO_TEXT = `
Total (COP)
$531.772,00
Cobro del anfitrión
Precio de la habitación por 4 noches
$531.772,00
Ganas
$433.686,66
`.trim();

const MARIANA_TEXT = `
Total (COP)
$496.498,00
Cobro del anfitrión
Ganas
$404.931,50
`.trim();

const TRUNCATED_BLOB = "x".repeat(50_000);

describe("reservation finance trace", () => {
  it("ignores canceled email events for active reservations", () => {
    const reservationId = "res-1";
    const statusById = new Map([[reservationId, ReservationStatus.CHECKED_IN]]);
    const metaById = new Map([
      [reservationId, { reservationCode: "HM123", checkIn: "2026-06-01", checkOut: "2026-06-05" }],
    ]);
    const rows = [
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.CANCELED,
        enrichedFields: { grossAmount: 449400 },
        payload: { signals: { grossAmount: 449400, emailMatchBlob: "canceled" } },
        processedAt: "2026-06-10T00:00:00Z",
        rawEmail: { text: "canceled" },
      },
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        enrichedFields: { hostPayoutAmount: 366508 },
        payload: {
          signals: {
            hostPayoutAmount: 366508,
            emailMatchBlob: "Ganas $366.508",
          },
        },
        processedAt: "2026-06-09T00:00:00Z",
        rawEmail: { text: "Ganas $366.508,00" },
      },
    ];

    const picked = pickFinanceRevenueEmailEventsByQuality(rows, statusById, metaById);
    assert.equal(picked.get(reservationId)?.eventKind, AirbnbEmailEventKind.CONFIRMED);

    const sources = buildReservationRevenueSourcesMapFromEmailEvents(
      rows,
      statusById,
      metaById,
    );
    const merged = sources.get(reservationId)?.payloadSignals as Record<string, unknown>;
    assert.equal(merged.hostPayoutAmount, 366508);
  });

  it("requires iCal uid and confirmation code when totalAmount is zero", () => {
    assert.equal(
      isReservationFinanceTraceable({
        platform: "AIRBNB",
        totalAmount: 0,
        icalUid: "abc",
        reservationCode: "HM123",
      }),
      true,
    );
    assert.equal(
      isReservationFinanceTraceable({
        platform: "AIRBNB",
        totalAmount: 0,
        icalUid: "abc",
        reservationCode: null,
      }),
      false,
    );
  });

  it("allows traceability from email revenue when iCal exists without confirmation code", () => {
    assert.equal(
      isReservationFinanceTraceable({
        platform: "AIRBNB",
        totalAmount: 0,
        icalUid: "abc",
        reservationCode: null,
        emailRevenueAmount: 366508.17,
      }),
      true,
    );
  });

  it("allows canceled email events only for canceled reservations", () => {
    assert.equal(
      isFinanceRevenueEmailEvent(
        AirbnbEmailEventKind.CANCELED,
        ReservationStatus.CANCELLED,
      ),
      true,
    );
    assert.equal(
      isFinanceRevenueEmailEvent(
        AirbnbEmailEventKind.CANCELED,
        ReservationStatus.CONFIRMED,
      ),
      false,
    );
  });

  it("legacy picker still prefers UPDATED by kind priority (backfill path)", () => {
    const reservationId = "karla-res";
    const statusById = new Map([[reservationId, ReservationStatus.CONFIRMED]]);
    const rows = [
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        enrichedFields: { hostPayoutAmount: 247421 },
        payload: { signals: { hostPayoutAmount: 247421 } },
      },
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.UPDATED,
        enrichedFields: { hostPayoutAmount: 1023779.89 },
        payload: { signals: { hostPayoutAmount: 1023779.89 } },
      },
    ];

    const picked = pickFinanceRevenueEmailEvents(rows, statusById);
    assert.equal(picked.get(reservationId)?.eventKind, AirbnbEmailEventKind.UPDATED);
  });
});

describe("pickFinanceRevenueEmailEventsByQuality", () => {
  const meta = (code: string) => ({
    reservationCode: code,
    checkIn: "2026-06-18",
    checkOut: "2026-06-23",
  });

  it("prefers CONFIRMED with authoritative Ganas over UPDATED with corrupt stored payout", () => {
    const reservationId = "karla-res";
    const statusById = new Map([[reservationId, ReservationStatus.CHECKED_IN]]);
    const metaById = new Map([[reservationId, meta("HM4SPXSTS2")]]);
    const rows = [
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.UPDATED,
        enrichedFields: null,
        payload: {
          signals: {
            hostPayoutAmount: 1023779.89,
            guestTotalPaid: 1255324,
            emailMatchBlob: TRUNCATED_BLOB,
          },
        },
        processedAt: "2026-06-16T20:01:37.127Z",
        rawEmail: { html: "<div>Recordatorio check-in sin Ganas</div>" },
      },
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        enrichedFields: null,
        payload: {
          signals: {
            grossAmount: 247421,
            emailMatchBlob: TRUNCATED_BLOB,
          },
        },
        processedAt: "2026-05-28T01:38:02.304Z",
        rawEmail: { text: KARLA_TEXT, html: `<div>${KARLA_TEXT}</div>` },
      },
    ];

    const picked = pickFinanceRevenueEmailEventsByQuality(rows, statusById, metaById);
    assert.equal(picked.get(reservationId)?.eventKind, AirbnbEmailEventKind.CONFIRMED);

    const sources = buildReservationRevenueSourcesFromEmailEvent({
      enrichedFields: picked.get(reservationId)!.enrichedFields,
      payload: picked.get(reservationId)!.payload,
      confirmationCode: "HM4SPXSTS2",
      checkIn: "2026-06-18",
      checkOut: "2026-06-23",
      emailHtml: picked.get(reservationId)!.rawEmail?.html ?? null,
      emailText: picked.get(reservationId)!.rawEmail?.text ?? null,
    });
    const amount = resolveFinanceReservationRevenueAmount(
      {
        totalAmount: 1023779.89,
        platform: "AIRBNB",
        icalUid: "ical-1",
        reservationCode: "HM4SPXSTS2",
        checkIn: "2026-06-18",
        checkOut: "2026-06-23",
      },
      sources,
    );
    assert.equal(amount, 807137.83);
  });

  it("Roberto: blob-only confirmation wins over empty global-style rawEmail", () => {
    const reservationId = "roberto-res";
    const statusById = new Map([[reservationId, ReservationStatus.CONFIRMED]]);
    const metaById = new Map([
      [
        reservationId,
        { reservationCode: "HMJDFHKS4R", checkIn: "2026-06-22", checkOut: "2026-06-26" },
      ],
    ]);
    const rows = [
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        enrichedFields: null,
        payload: {
          signals: {
            grossAmount: 157565.25,
            emailMatchBlob: ROBERTO_TEXT,
          },
        },
        processedAt: "2026-05-28T07:53:05.754Z",
        rawEmail: null,
      },
    ];

    const picked = pickFinanceRevenueEmailEventsByQuality(rows, statusById, metaById);
    const score = scoreFinanceRevenueEmailCandidate(
      picked.get(reservationId)!,
      metaById.get(reservationId)!,
    );
    assert.equal(score.authoritativeHostPayout, 514011.14);

    const sources = buildReservationRevenueSourcesFromEmailEvent({
      enrichedFields: picked.get(reservationId)!.enrichedFields,
      payload: picked.get(reservationId)!.payload,
      confirmationCode: "HMJDFHKS4R",
      checkIn: "2026-06-22",
      checkOut: "2026-06-26",
      emailHtml: null,
      emailText: null,
    });
    assert.equal(
      resolveFinanceReservationRevenueAmount(
        {
          totalAmount: 116249.86,
          platform: "AIRBNB",
          icalUid: "ical-roberto",
          reservationCode: "HMJDFHKS4R",
        },
        sources,
      ),
      514011.14,
    );
  });

  it("Jairo: picks CONFIRMED with linked html over UPDATED when only CONFIRMED resolves Ganas", () => {
    const reservationId = "jairo-res";
    const statusById = new Map([[reservationId, ReservationStatus.CONFIRMED]]);
    const metaById = new Map([
      [
        reservationId,
        { reservationCode: "HMZMZBDTKN", checkIn: "2026-06-23", checkOut: "2026-06-27" },
      ],
    ]);
    const rows = [
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.UPDATED,
        enrichedFields: null,
        payload: {
          signals: {
            hostPayoutAmount: 433686.66,
            guestTotalPaid: 531772,
            emailMatchBlob: TRUNCATED_BLOB,
          },
        },
        processedAt: "2026-06-15T21:47:30.287Z",
        rawEmail: { html: "<div>recordatorio</div>" },
      },
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        enrichedFields: null,
        payload: {
          signals: {
            hostPayoutAmount: 433686.66,
            guestTotalPaid: 531772,
            emailMatchBlob: TRUNCATED_BLOB,
          },
        },
        processedAt: "2026-06-15T14:36:16.795Z",
        rawEmail: { text: JAIRO_TEXT, html: `<div>${JAIRO_TEXT}</div>` },
      },
    ];

    const picked = pickFinanceRevenueEmailEventsByQuality(rows, statusById, metaById);
    assert.equal(picked.get(reservationId)?.eventKind, AirbnbEmailEventKind.CONFIRMED);
    const sources = buildReservationRevenueSourcesFromEmailEvent({
      enrichedFields: picked.get(reservationId)!.enrichedFields,
      payload: picked.get(reservationId)!.payload,
      confirmationCode: "HMZMZBDTKN",
      checkIn: "2026-06-23",
      checkOut: "2026-06-27",
      emailHtml: picked.get(reservationId)!.rawEmail?.html ?? null,
      emailText: picked.get(reservationId)!.rawEmail?.text ?? null,
    });
    assert.equal(
      resolveFinanceReservationRevenueAmount(
        {
          totalAmount: 433686.66,
          platform: "AIRBNB",
          icalUid: "ical-jairo",
          reservationCode: "HMZMZBDTKN",
        },
        sources,
      ),
      433686.66,
    );
  });

  it("Mariana: CONFIRMED with linked confirmation html resolves Ganas", () => {
    const reservationId = "mariana-res";
    const statusById = new Map([[reservationId, ReservationStatus.CONFIRMED]]);
    const metaById = new Map([
      [
        reservationId,
        { reservationCode: "HMYZ3KQAHS", checkIn: "2026-07-20", checkOut: "2026-07-23" },
      ],
    ]);
    const rows = [
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        enrichedFields: null,
        payload: {
          signals: {
            hostPayoutAmount: 404931.5,
            guestTotalPaid: 496498,
            emailMatchBlob: TRUNCATED_BLOB,
          },
        },
        processedAt: "2026-06-19T01:32:50.605Z",
        rawEmail: { text: MARIANA_TEXT, html: `<div>${MARIANA_TEXT}</div>` },
      },
    ];

    const picked = pickFinanceRevenueEmailEventsByQuality(rows, statusById, metaById);
    const sources = buildReservationRevenueSourcesFromEmailEvent({
      enrichedFields: picked.get(reservationId)!.enrichedFields,
      payload: picked.get(reservationId)!.payload,
      confirmationCode: "HMYZ3KQAHS",
      checkIn: "2026-07-20",
      checkOut: "2026-07-23",
      emailHtml: picked.get(reservationId)!.rawEmail?.html ?? null,
      emailText: picked.get(reservationId)!.rawEmail?.text ?? null,
    });
    assert.equal(
      resolveFinanceReservationRevenueAmount(
        {
          totalAmount: 404931.5,
          platform: "AIRBNB",
          icalUid: "ical-mariana",
          reservationCode: "HMYZ3KQAHS",
        },
        sources,
      ),
      404931.5,
    );
  });

  it("prefers independent authoritative Ganas over UPDATED echoing corrupt stored payout", () => {
    const reservationId = "karla-res";
    const statusById = new Map([[reservationId, ReservationStatus.CHECKED_IN]]);
    const metaById = new Map([[reservationId, meta("HM4SPXSTS2")]]);
    const rows = [
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.UPDATED,
        enrichedFields: null,
        payload: {
          signals: {
            hostPayoutAmount: 1023779.89,
            guestTotalPaid: 1255324,
            emailMatchBlob: KARLA_TEXT.replace("807.137,83", "1.023.779,89"),
          },
        },
        processedAt: "2026-06-16T20:01:37.127Z",
        rawEmail: {
          text: KARLA_TEXT.replace("807.137,83", "1.023.779,89"),
        },
      },
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        enrichedFields: null,
        payload: {
          signals: {
            grossAmount: 247421,
            emailMatchBlob: KARLA_TEXT,
          },
        },
        processedAt: "2026-05-28T01:38:02.304Z",
        rawEmail: { text: KARLA_TEXT, html: `<div>${KARLA_TEXT}</div>` },
      },
    ];

    const picked = pickFinanceRevenueEmailEventsByQuality(rows, statusById, metaById);
    assert.equal(picked.get(reservationId)?.eventKind, AirbnbEmailEventKind.CONFIRMED);
  });

  it("uses recency only when multiple candidates share authoritative host payout", () => {
    const reservationId = "res-recency";
    const statusById = new Map([[reservationId, ReservationStatus.CONFIRMED]]);
    const metaById = new Map([
      [
        reservationId,
        { reservationCode: "HM111", checkIn: "2026-06-01", checkOut: "2026-06-04" },
      ],
    ]);
    const rows = [
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.CONFIRMED,
        enrichedFields: null,
        payload: { signals: { emailMatchBlob: KARLA_TEXT } },
        processedAt: "2026-06-01T10:00:00Z",
        rawEmail: { text: KARLA_TEXT },
      },
      {
        reservationId,
        eventKind: AirbnbEmailEventKind.EXTENDED,
        enrichedFields: null,
        payload: { signals: { emailMatchBlob: KARLA_TEXT } },
        processedAt: "2026-06-10T10:00:00Z",
        rawEmail: { text: KARLA_TEXT },
      },
    ];

    const picked = pickFinanceRevenueEmailEventsByQuality(rows, statusById, metaById);
    assert.equal(picked.get(reservationId)?.eventKind, AirbnbEmailEventKind.EXTENDED);
  });
});

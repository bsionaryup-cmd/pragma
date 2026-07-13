import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AirbnbEmailEventKind } from "@prisma/client";
import {
  occupancyMatchesReservation,
  parseOccupancyFromEmailSignals,
  readAppliedOccupancyFromEnrichedFields,
  resolveOccupancyEnrichmentUpdate,
} from "@/lib/reservations/reservation-occupancy-sync";

const BASE_RESERVATION = { adults: 1, children: 0, infants: 0 };

describe("parseOccupancyFromEmailSignals", () => {
  it("parses adult and child breakdown", () => {
    assert.deepEqual(
      parseOccupancyFromEmailSignals({
        adultCount: 2,
        childCount: 1,
        guestCountTotal: 3,
      }),
      { adults: 2, children: 1, infants: 0 },
    );
  });

  it("parses guestCountTotal when no breakdown", () => {
    assert.deepEqual(
      parseOccupancyFromEmailSignals({ guestCountTotal: 4 }),
      { adults: 4, children: 0, infants: 0 },
    );
  });
});

describe("resolveOccupancyEnrichmentUpdate", () => {
  it("CONFIRMED fills placeholder 1/0/0 from breakdown", () => {
    const result = resolveOccupancyEnrichmentUpdate({
      eventKind: AirbnbEmailEventKind.CONFIRMED,
      reservation: BASE_RESERVATION,
      signals: { adultCount: 2, childCount: 2, guestCountTotal: 4 },
    });
    assert.deepEqual(result.updates, { adults: 2, children: 2 });
    assert.equal(result.skipped.length, 0);
  });

  it("CONFIRMED skips when reservation already has occupancy", () => {
    const result = resolveOccupancyEnrichmentUpdate({
      eventKind: AirbnbEmailEventKind.CONFIRMED,
      reservation: { adults: 4, children: 0, infants: 0 },
      signals: { adultCount: 2, childCount: 0, guestCountTotal: 2 },
    });
    assert.deepEqual(result.updates, {});
    assert.ok(result.skipped.includes("occupancy_already_set"));
  });

  it("UPDATED increments occupancy from 1 to 4 guests", () => {
    const result = resolveOccupancyEnrichmentUpdate({
      eventKind: AirbnbEmailEventKind.UPDATED,
      reservation: BASE_RESERVATION,
      signals: { guestCountTotal: 4, adultCount: 4 },
      sourceEventAt: new Date("2026-06-10T12:00:00.000Z"),
      latestAppliedOccupancyEventAt: new Date("2026-06-09T12:00:00.000Z"),
    });
    assert.deepEqual(result.updates, { adults: 4 });
  });

  it("UPDATED decrements occupancy when Airbnb sends lower counts", () => {
    const result = resolveOccupancyEnrichmentUpdate({
      eventKind: AirbnbEmailEventKind.UPDATED,
      reservation: { adults: 4, children: 0, infants: 0 },
      signals: { adultCount: 2, childCount: 0, guestCountTotal: 2 },
      sourceEventAt: new Date("2026-06-11T12:00:00.000Z"),
    });
    assert.deepEqual(result.updates, { adults: 2, children: 0 });
  });

  it("UPDATED applies partial adult change without zeroing unstated children", () => {
    const result = resolveOccupancyEnrichmentUpdate({
      eventKind: AirbnbEmailEventKind.UPDATED,
      reservation: { adults: 2, children: 1, infants: 0 },
      signals: { adultCount: 3, guestCountTotal: 4 },
      sourceEventAt: new Date("2026-06-11T12:00:00.000Z"),
    });
    assert.deepEqual(result.updates, { adults: 3 });
  });

  it("UPDATED is idempotent when occupancy is unchanged", () => {
    const result = resolveOccupancyEnrichmentUpdate({
      eventKind: AirbnbEmailEventKind.UPDATED,
      reservation: { adults: 4, children: 0, infants: 0 },
      signals: { adultCount: 4, guestCountTotal: 4 },
      sourceEventAt: new Date("2026-06-11T12:00:00.000Z"),
    });
    assert.deepEqual(result.updates, {});
    assert.ok(result.skipped.includes("occupancy_unchanged"));
  });

  it("UPDATED skips stale events that are older than the latest applied occupancy", () => {
    const result = resolveOccupancyEnrichmentUpdate({
      eventKind: AirbnbEmailEventKind.UPDATED,
      reservation: { adults: 4, children: 0, infants: 0 },
      signals: { adultCount: 2, guestCountTotal: 2 },
      sourceEventAt: new Date("2026-06-08T12:00:00.000Z"),
      latestAppliedOccupancyEventAt: new Date("2026-06-10T12:00:00.000Z"),
    });
    assert.deepEqual(result.updates, {});
    assert.ok(result.skipped.includes("occupancy_stale_event"));
  });

  it("EXTENDED follows the same lifecycle update rules as UPDATED", () => {
    const result = resolveOccupancyEnrichmentUpdate({
      eventKind: AirbnbEmailEventKind.EXTENDED,
      reservation: { adults: 2, children: 0, infants: 0 },
      signals: { adultCount: 5, guestCountTotal: 5 },
      sourceEventAt: new Date("2026-06-12T12:00:00.000Z"),
    });
    assert.deepEqual(result.updates, { adults: 5 });
  });

  it("returns no updates when signals lack occupancy", () => {
    const result = resolveOccupancyEnrichmentUpdate({
      eventKind: AirbnbEmailEventKind.UPDATED,
      reservation: BASE_RESERVATION,
      signals: {},
    });
    assert.deepEqual(result.updates, {});
    assert.ok(result.skipped.includes("occupancy_signals_missing"));
  });
});

describe("readAppliedOccupancyFromEnrichedFields", () => {
  it("reads applied adults from enriched event snapshot", () => {
    assert.deepEqual(
      readAppliedOccupancyFromEnrichedFields({
        adults: 4,
        children: 1,
        adultCount: 3,
      }),
      { adults: 4, children: 1, infants: 0 },
    );
  });

  it("ignores metadata-only adultCount without applied adults", () => {
    assert.equal(
      readAppliedOccupancyFromEnrichedFields({ adultCount: 4 }),
      null,
    );
  });
});

describe("occupancyMatchesReservation", () => {
  it("compares full occupancy tuples", () => {
    assert.equal(
      occupancyMatchesReservation(
        { adults: 2, children: 1, infants: 0 },
        { adults: 2, children: 1, infants: 0 },
      ),
      true,
    );
    assert.equal(
      occupancyMatchesReservation(
        { adults: 2, children: 1, infants: 0 },
        { adults: 2, children: 0, infants: 0 },
      ),
      false,
    );
  });
});

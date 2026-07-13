import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isHistoricalBackfillUid,
  isSuspiciousEmptyBookableIcalFeed,
  shouldCancelStaleIcalReservation,
} from "@/lib/airbnb/ical-sync-utils";

describe("reservation integrity — iCal stale cancellation guard", () => {
  const today = new Date("2026-06-29T00:00:00.000Z");
  const futureCheckOut = new Date("2026-07-05T00:00:00.000Z");
  const pastCheckOut = new Date("2026-06-20T00:00:00.000Z");
  const liveUid = "1418fb94e984-af1f4ae26c5fd710659a89dbb82c9804@airbnb.com";

  it("cancels future active reservations missing from feed", () => {
    assert.equal(
      shouldCancelStaleIcalReservation({
        icalUid: liveUid,
        seenInFeed: false,
        status: "CONFIRMED",
        checkOut: futureCheckOut,
        today,
      }),
      true,
    );
  });

  it("does not cancel when UID is still in feed", () => {
    assert.equal(
      shouldCancelStaleIcalReservation({
        icalUid: liveUid,
        seenInFeed: true,
        status: "CONFIRMED",
        checkOut: futureCheckOut,
        today,
      }),
      false,
    );
  });

  it("does not cancel historical backfill UIDs", () => {
    const uid = "pragma-historical:HMZXH3MMRD";
    assert.ok(isHistoricalBackfillUid(uid));
    assert.equal(
      shouldCancelStaleIcalReservation({
        icalUid: uid,
        seenInFeed: false,
        status: "CHECKED_OUT",
        checkOut: pastCheckOut,
        today,
      }),
      false,
    );
  });

  it("does not cancel checked-out reservations", () => {
    assert.equal(
      shouldCancelStaleIcalReservation({
        icalUid: liveUid,
        seenInFeed: false,
        status: "CHECKED_OUT",
        checkOut: pastCheckOut,
        today,
      }),
      false,
    );
  });

  it("does not cancel past stays that left the iCal feed", () => {
    assert.equal(
      shouldCancelStaleIcalReservation({
        icalUid: liveUid,
        seenInFeed: false,
        status: "CONFIRMED",
        checkOut: pastCheckOut,
        today,
      }),
      false,
    );
  });

  it("aborts mass-cancel when feed has zero bookable events but local futures exist", () => {
    assert.equal(
      isSuspiciousEmptyBookableIcalFeed({
        bookableEventCount: 0,
        staleCancelCandidateCount: 3,
      }),
      true,
    );
    assert.equal(
      isSuspiciousEmptyBookableIcalFeed({
        bookableEventCount: 0,
        staleCancelCandidateCount: 0,
      }),
      false,
    );
    assert.equal(
      isSuspiciousEmptyBookableIcalFeed({
        bookableEventCount: 2,
        staleCancelCandidateCount: 1,
      }),
      false,
    );
  });
});

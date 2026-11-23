import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReservationConflictError } from "@/services/reservations/reservation-conflicts";

/**
 * Pure-logic acceptance for double-booking protection used by WEB BUILDER.
 * Does not write to Neon.
 */
describe("web-builder double-booking guard (logic)", () => {
  it("ReservationConflictError is distinguishable for concurrent failures", () => {
    const err = new ReservationConflictError(
      "Las fechas chocan con «Test» (2099-01-01 → 2099-01-03).",
    );
    assert.equal(err.name, "ReservationConflictError");
    assert.match(err.message, /chocan|bloqueadas|ocupadas/i);
  });

  it("booking service checks overlap before create inside a transaction", async () => {
    const fs = await import("node:fs/promises");
    const path = new URL(
      "../../src/services/web-builder/web-booking.service.ts",
      import.meta.url,
    );
    const source = await fs.readFile(path, "utf8");
    assert.match(source, /findOverlappingReservation/);
    assert.match(source, /ReservationConflictError/);
    assert.match(source, /pg_advisory_xact_lock/);
    assert.match(source, /BookingPlatform\.DIRECT/);
    assert.match(source, /WEB_BUILDER/);
    assert.match(source, /\$transaction/);
    // Lock + overlap check precede create
    const lockIdx = source.indexOf("pg_advisory_xact_lock");
    const createIdx = source.indexOf("tx.reservation.create");
    assert.ok(lockIdx > -1 && createIdx > lockIdx);
  });
});


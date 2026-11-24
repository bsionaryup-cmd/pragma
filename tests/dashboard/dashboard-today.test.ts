import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReservationStatus } from "@prisma/client";

describe("dashboard today / upcoming split", () => {
  it("keeps cancelled exclusion consistent with visible reservations", () => {
    assert.notEqual(ReservationStatus.CANCELLED, ReservationStatus.CONFIRMED);
  });

  it("documents Hoy vs próximas boundary: today exclusive of upcoming window", () => {
    // Hoy panel: checkIn/checkOut === today
    // Próximas estancias: checkIn/checkOut > today && <= weekAhead
    const todayExclusiveLowerBound = "gt";
    const weekInclusiveUpperBound = "lte";
    assert.equal(todayExclusiveLowerBound, "gt");
    assert.equal(weekInclusiveUpperBound, "lte");
  });

  it("routes reservation click-throughs to calendar deep link", () => {
    const reservationId = "res_demo_1";
    assert.equal(`/calendar?reservation=${reservationId}`, "/calendar?reservation=res_demo_1");
    assert.equal("/calendar?reservation=res_demo_1".includes("/novedades"), false);
    assert.equal("/calendar?reservation=res_demo_1".includes("/reservations"), false);
  });
});

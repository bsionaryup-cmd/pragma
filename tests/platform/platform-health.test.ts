import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyDbHealth,
  classifyEnvFlag,
  classifyOutboxHealth,
  worstStatus,
} from "@/services/platform/platform-health-classify";

describe("platform health classifiers", () => {
  it("ranks FAIL over WARN over PASS", () => {
    assert.equal(worstStatus(["PASS", "WARN"]), "WARN");
    assert.equal(worstStatus(["PASS", "FAIL", "WARN"]), "FAIL");
    assert.equal(worstStatus(["PASS"]), "PASS");
  });

  it("fails outbox when FAILED events exist", () => {
    assert.equal(
      classifyOutboxHealth({
        failed: 2,
        pending: 0,
        oldestPendingAgeMinutes: null,
        lastDoneAt: new Date(),
        hasRetailStores: true,
      }),
      "FAIL",
    );
  });

  it("warns when pending events are stale", () => {
    assert.equal(
      classifyOutboxHealth({
        failed: 0,
        pending: 3,
        oldestPendingAgeMinutes: 90,
        lastDoneAt: new Date(),
        hasRetailStores: true,
      }),
      "WARN",
    );
  });

  it("classifies db and env flags", () => {
    assert.equal(classifyDbHealth(true), "PASS");
    assert.equal(classifyDbHealth(false), "FAIL");
    assert.equal(classifyEnvFlag(true, true), "PASS");
    assert.equal(classifyEnvFlag(false, true), "FAIL");
    assert.equal(classifyEnvFlag(false, false), "WARN");
  });
});

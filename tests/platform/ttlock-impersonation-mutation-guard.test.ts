import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldAllowTTLockIntegrationMutation } from "@/modules/integrations/ttlock/ttlock-mutation-policy";

describe("shouldAllowTTLockIntegrationMutation", () => {
  it("blocks create/reassign while platform Owner is impersonating", () => {
    assert.equal(
      shouldAllowTTLockIntegrationMutation({ isImpersonating: true }),
      false,
    );
  });

  it("allows mutations for normal tenant sessions", () => {
    assert.equal(
      shouldAllowTTLockIntegrationMutation({ isImpersonating: false }),
      true,
    );
  });
});

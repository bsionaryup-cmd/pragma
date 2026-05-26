import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  selfSignupEmailReuseMessage,
  shouldRejectSelfSignupEmailReuse,
  shouldRejectSelfSignupForExistingUser,
} from "../../src/lib/auth/clerk-user-upsert-policy";

const deletedReceptionist = {
  isActive: false,
  isAccountOwner: false,
  organizationId: "org_1",
  clerkId: "user_old",
  deletedAt: new Date(),
};

const activeReceptionist = {
  ...deletedReceptionist,
  isActive: true,
  deletedAt: null,
  clerkId: "user_old",
};

const inactiveOwner = {
  isActive: false,
  isAccountOwner: true,
  organizationId: "org_1",
  clerkId: "owner_old",
  deletedAt: new Date(),
};

describe("shouldRejectSelfSignupForExistingUser", () => {
  it("rejects active non-owner team member with different Clerk id", () => {
    assert.equal(
      shouldRejectSelfSignupForExistingUser(activeReceptionist, "user_new"),
      true,
    );
  });

  it("allows account owner relink with new Clerk id", () => {
    assert.equal(
      shouldRejectSelfSignupForExistingUser(inactiveOwner, "user_new"),
      false,
    );
  });
});

describe("shouldRejectSelfSignupEmailReuse", () => {
  it("rejects self-signup when email belonged to deleted team member", () => {
    assert.equal(
      shouldRejectSelfSignupEmailReuse(deletedReceptionist, "user_new"),
      true,
    );
  });

  it("allows account owner recovery after removal from Clerk", () => {
    assert.equal(
      shouldRejectSelfSignupEmailReuse(inactiveOwner, "owner_new"),
      false,
    );
  });
});

describe("selfSignupEmailReuseMessage", () => {
  it("explains deleted team member must be re-invited", () => {
    assert.match(
      selfSignupEmailReuseMessage(deletedReceptionist),
      /administrador/,
    );
  });
});

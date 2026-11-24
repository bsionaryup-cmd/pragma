import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APP_LOGIN_ALIASES,
  APP_LOGIN_PATH,
  APP_POST_LOGIN_PATH,
  APP_SIGNED_OUT_LOGIN_PATH,
} from "@/lib/auth/auth-paths";
import { OWNER_LOGIN_PATH } from "@/lib/platform/middleware-paths";
import { APP_SIGN_IN_PATH } from "@/lib/constants";

describe("unified login paths", () => {
  it("canonical login and signed-out contract", () => {
    assert.equal(APP_LOGIN_PATH, "/login");
    assert.equal(APP_SIGNED_OUT_LOGIN_PATH, "/login?signed_out=1");
    assert.equal(APP_POST_LOGIN_PATH, "/post-login");
    assert.equal(OWNER_LOGIN_PATH, "/login");
    assert.equal(APP_SIGN_IN_PATH, "/login");
  });

  it("keeps legacy aliases for redirects", () => {
    assert.deepEqual([...APP_LOGIN_ALIASES], ["/sign-in", "/owner-login"]);
  });
});

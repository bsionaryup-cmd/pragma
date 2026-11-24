import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("client sign-out uses full sign-out", () => {
  it("wires useClientSignOut through performFullSignOut", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/auth/use-client-sign-out.ts"),
      "utf8",
    );
    assert.match(source, /performFullSignOut/);
    assert.match(source, /from "@\/lib\/auth\/full-sign-out"/);
  });
});

describe("guest stay security invariants", () => {
  it("stay service rejects short tokens and never looks up by reservationCode", () => {
    const source = readFileSync(
      join(process.cwd(), "src/services/guests/guest-stay.service.ts"),
      "utf8",
    );
    assert.match(source, /raw\.length < 16/);
    assert.doesNotMatch(source, /findUnique\(\s*\{\s*where:\s*\{\s*reservationCode/);
    assert.match(source, /guestRegistrationToken\.findUnique/);
  });

  it("proxy allowlists /stay as public", () => {
    const source = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    assert.match(source, /"\/stay\/\(\.\*\)"/);
  });
});

describe("panel empty banner uses reliable count", () => {
  it("panel page does not gate banner solely on soft-fail zero", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/panel/page.tsx"),
      "utf8",
    );
    assert.match(page, /reliablePropertyCount === 0/);
    assert.doesNotMatch(
      page,
      /showEmptyBanner=\{snapshot\.commandCenter\.totalPropertyCount === 0\}/,
    );
  });
});

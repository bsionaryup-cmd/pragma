# PRAGMA PMS — Regression Audit & Safe Repair

**Date:** 2026-11-23  
**Auditor role:** Staff full-stack / DB reliability / QA  
**Primary objective:** Restore PMS stability; isolate WEB BUILDER side-effects  
**Deploy / merge / PR / publish / production DB writes:** **NONE in this audit**

---

## Executive summary

| Metric | Value |
|--------|------:|
| Regressions / risks identified | **8** |
| Confirmed root causes | **6** |
| Safe code corrections implemented (worktree) | **5** |
| Issues left unresolved (need owner approval) | **3** |
| Production data modified | **0** |
| Production migrations | **0** |
| Merge / PR / deploy | **0** |

**Overall platform condition:** Core reservation/calendar/Airbnb service code was **not** rewritten by WEB BUILDER commits vs `main`. Highest impact regressions were **auth/session settle**, **Owner login (legacy Clerk)**, **impersonation cookies**, and a **web booking payment-total trust** hole. Operative Neon currently shows URBA NOVA site **`PUBLISHED`** (contradicts earlier STOP that required DRAFT) — **not reverted here** (would be a production data change).

---

## Git safety

| Item | Value |
|------|--------|
| Main dirty worktree (preserved, not used for WEB BUILDER) | `C:\Users\R160\Desktop\pragma-pms` · `cursor/apify-prospecting-engine` (many unrelated local changes) |
| WEB BUILDER worktree | `C:\Users\R160\Desktop\pragma-pms-web-builder` · `feat/pragma-web-builder` @ `40f7447` + local repairs |
| Other worktrees | `pragma-pms-tarifas-deploy` (`deploy/tarifas-ux-2026-07-29`) — untouched |
| Baseline merge-base with `main` | `458003a` |
| Commits on branch vs `main` | 6 (WEB BUILDER + owner PMS-first + docs) |
| User WIP preserved | Yes — no reset/checkout discard; no branch switch of dirty trees |
| Merge / PR / deploy this run | **No** |

### Working tree changes in scope (repairs + audit artifacts)

- Auth settle: `src/app/api/auth/*`, `src/lib/auth/post-auth-navigation.ts`, handshake/proxy bridge, `email-password-sign-in-form.tsx`, `clerk-root-provider.tsx`, `owner-login` → `/sign-in`
- Impersonation: cookie helpers, owner API auth, hard redirect client
- Booking integrity: `web-booking.service.ts` server-side quote enforcement + org check
- Tests: `tests/web-builder/booking-total-integrity.test.ts`, hardened `acceptance-isolation.test.ts`
- Audit scripts/docs: `_audit-regression-readonly-once.ts`, this report

---

## Database safety

| Check | Result |
|-------|--------|
| Operative Neon host fingerprint | `ep-purple-block-apuk7v1k.c-7.us-east-1.aws.neon.tech` |
| Staging Neon host fingerprint | `ep-dawn-union-bebo02dx-pooler.c-9.us-east-2.aws.neon.tech` |
| Staging assert (`staging:assert`) | PASS |
| Writes during this audit | **None** |
| Migrations applied this audit | **None** |
| Production untouched | **Yes** (no migrate, no unpublish, no seed) |

### Read-only fingerprints (2026-11-23)

**Staging:** 2 orgs · pilot properties **0** · site **null** · WEB_BUILDER reservation notes **0**  
**Operative:** 5 orgs · pilot properties **4** · pilot reservations **154** · site `urbanovaloft` **`PUBLISHED`** · `bookingEnabled: true` · 4 units 801–804 · media **0** · WEB_BUILDER notes **0**

**STOP note:** Earlier docs required DRAFT + no publish. Operative is already PUBLISHED. Reverting to DRAFT requires **explicit owner authorization** (production data change). Not performed.

---

## Regression matrix

### R1 — Owner / tenant login broken on Custom Domain (CRITICAL → repaired in code)

| Field | Detail |
|-------|--------|
| Module | Authentication |
| Severity | CRITICAL |
| What fails | `/owner-login` CTA stayed disabled; incomplete `__client_uat` without `__session` wiped sessions |
| Expected | Password login settles server cookies then enters Owner/tenant home |
| Actual | Legacy `@clerk/nextjs/legacy` `isLoaded` stuck; finalize navigated without settle APIs |
| Root cause | WEB BUILDER deploy path lacked `establish-session` / `session-ready` / proxyUrl / handshake bypass |
| Files | `owner-login/page.tsx`, `email-password-sign-in-form.tsx`, `clerk-root-provider.tsx`, `proxy.ts`, `src/app/api/auth/*`, `src/lib/auth/*` |
| Correction | Redirect `/owner-login` → `/sign-in`; SignInFuture + `settleClerkSessionThenGo`; Clerk `proxyUrl`; UAT expire; incomplete-session bridge |
| Tests | Impersonation/auth unit tests; APIs exist (`session-ready` 200, `establish-session` validates token) |
| Status | **FIXED in worktree** — **not re-deployed in this audit** (deploy forbidden) |

### R2 — Impersonation cookie not applied (HIGH → repaired)

| Field | Detail |
|-------|--------|
| Module | Platform Owner / multi-tenancy |
| Severity | HIGH |
| What fails | Impersonate appeared to succeed but tenant context missing |
| Root cause | `headers.set("Set-Cookie")` unreliable; soft `router.push` race; `requireDbUser()` redirect in APIs |
| Correction | `response.cookies.set`; `currentDbUser` + 401/403; hard `location.assign` |
| Tests | `tests/platform/impersonation-cookie.test.ts` PASS; DB start/end audit PASS (earlier) |
| Status | **FIXED in worktree** |

### R3 — Web booking trusted client `totalAmount` (HIGH → repaired)

| Field | Detail |
|-------|--------|
| Module | WEB BUILDER booking / payments |
| Severity | HIGH |
| What fails | Client could send `totalAmount: 0` → reservation marked **PAID** |
| Expected | Server computes quote; mismatch rejected; positive totals stay PENDING until Wompi |
| Root cause | `createWebDirectReservation` used `input.totalAmount` directly |
| Files | `src/services/web-builder/web-booking.service.ts` |
| Correction | Server `quoteStay`; reject \|client−server\| > 1; org ownership check |
| Tests | `tests/web-builder/booking-total-integrity.test.ts` + suite 30/30 PASS |
| Status | **FIXED in worktree** |

### R4 — Operative site PUBLISHED contrary to STOP (CRITICAL / ops — unresolved)

| Field | Detail |
|-------|--------|
| Module | WEB BUILDER public |
| Severity | CRITICAL (exposure risk) |
| Evidence | Read-only query: status=`PUBLISHED`, bookingEnabled=true, 4 units |
| Docs said | Keep DRAFT; no publish |
| Correction | **Not applied** — would modify production/operative data |
| Needs | Explicit owner approval to set DRAFT/UNPUBLISHED |
| Status | **UNRESOLVED — awaiting authorization** |

### R5 — Staging incomplete for E2E (HIGH / env — unresolved)

| Field | Detail |
|-------|--------|
| Module | QA / WEB BUILDER |
| Severity | HIGH (blocks safe E2E) |
| Evidence | Staging has 0 pilot properties / null site |
| Impact | Cannot safely prove booking E2E without touching operative units |
| Status | **UNRESOLVED** — seed staging under existing staging scripts when claim still valid |

### R6 — Owner dashboard “PMS-first” removed nav modules (MEDIUM — intentional)

| Field | Detail |
|-------|--------|
| Module | Owner dashboard |
| Severity | MEDIUM |
| Evidence | Commit `40f7447` parks Sales/QR/INTIENDAS/Salud UI; removes `retail-intel-outbox` cron |
| Assessment | Intentional product cut, not accidental corruption of reservations |
| Status | **ACCEPTED / documented** — restore only if product requires those modules |

### R7 — TTLock decrypt soft-fail (LOW/MEDIUM — defensive)

| Field | Detail |
|-------|--------|
| Module | Integrations / TTLock |
| Severity | LOW–MEDIUM |
| Evidence | `ttlock-crypto.ts` catches decrypt errors → `null` instead of crashing shell |
| Assessment | Prevents auth-surface crashes; may hide misconfigured keys |
| Status | **KEPT** — monitor; do not hard-fail login |

### R8 — Shared reservation/calendar services untouched (POSITIVE)

| Field | Detail |
|-------|--------|
| Evidence | `git diff main...feat/pragma-web-builder` — **no** changes under `src/services/reservations`, `features/calendar`, `services/airbnb`, `services/guests` |
| Assessment | WEB BUILDER reuses overlap + DIRECT create path; advisory lock in book txn |
| Status | **NO REGRESSION FOUND in core PMS write path (code)** |

---

## Functional verification

| Area | Result | Evidence |
|------|--------|----------|
| Dashboard | **NOT TESTED** live UI this run | Code path unchanged for tenant dashboard services |
| Reservations | **PASS** (unit) | 34 reservation tests PASS; no service diff vs main |
| Calendar | **PASS** (code) / **NOT TESTED** live | No calendar feature diff vs main |
| Billing / Wompi | **PARTIAL** | Hold path reused; total integrity fixed; webhook E2E not run |
| Authentication | **PASS** (code+API probe) / **BLOCKED** full UI credential E2E | Settle APIs present; no password used in automation |
| Multi-tenancy | **PASS** (unit/read-only) | Org checks on media/site; booking org assert added; pilot units orgOk |
| Integrations (Airbnb/iCal/PriceLabs) | **PASS** (code) | No diff vs main in those services |
| WEB BUILDER admin | **NOT TESTED** live | Staging empty; requires ADMIN session on worktree |
| Public website | **BLOCKED** product decision | Operative PUBLISHED (evidence); code gates DRAFT correctly |
| Booking engine | **PASS** (unit) / **BLOCKED** E2E writes | Double-booking tests PASS; STOP forbids real unit bookings |

---

## Test evidence (this run)

```
tests/web-builder/*.test.ts     → 30 pass / 0 fail
tests/reservations/*.test.ts    → 34 pass / 0 fail
tests/platform/impersonation*   → 2 pass / 0 fail
tsc --noEmit                    → exit 0
staging:assert                  → ok (dawn-union host)
read-only audit script          → staging + operative fingerprints
```

No customer reservations created or modified.

---

## Remaining risks

1. **Operative `urbanovaloft` is PUBLISHED** with booking enabled — public booking surface live on real units until owner authorizes DRAFT/unpublish.
2. **Auth/impersonation/booking repairs are in the worktree only** — this audit did **not** deploy; production may still lag depending on last alias.
3. **Staging claim** may expire (~2026-11-26 per prior docs) — re-seed before E2E.
4. Main worktree `cursor/apify-prospecting-engine` remains heavily dirty with unrelated WIP — do not merge WEB BUILDER into it blindly.
5. Prior production deploys of WEB BUILDER (historical) conflict with “no deploy” policy going forward — treat as already-shipped risk, not as license to redeploy.

---

## Authorized next steps (require explicit approval)

1. Deploy worktree auth + booking integrity fixes to production **or** promote via reviewed PR.
2. Set operative site `urbanovaloft` → `DRAFT` / disable booking.
3. Seed staging with synthetic tenant (not real 801–804) and run booking E2E.
4. Merge `feat/pragma-web-builder` into `main` after review.

---

## Stop condition

Safe corrections and validations for this audit are complete in the isolated WEB BUILDER worktree.

**No merge. No PR. No deploy. No publish. No production DB modification.**

Awaiting explicit authorization before any of the items above.

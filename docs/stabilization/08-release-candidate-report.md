# Release Candidate Report — PRAGMA PMS

**Date:** 2026-06-17  
**Release phase:** RC finalization & deployment execution  
**Pilot tenant:** URBA Nova Loft 33 (`cmplxfg0a000105jrs0gqtwyc`)

---

## Executive Summary

Stabilization remediations are complete. This release candidate pass addressed the **P0 Recoverable Error** class (SSR/hydration failures) with minimal, targeted fixes. Automated regression and pilot data validation pass. **Deployment remains blocked on one operational configuration item** (`TTLOCK_WEBHOOK_SECRET` in production).

---

## P0 — Recoverable Error Analysis

### Symptom

> "The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering."

In Next.js 16 / React 19, this message commonly appears when **hydration fails** inside a streamed Suspense subtree (`DashboardLayout` → `PlatformImpersonationBanner` / `DashboardBanners`) or when an async RSC throws. Documented incidents in this codebase traced to **hydration mismatch**, not arbitrary Suspense misuse.

### Root causes identified (with evidence)

| # | Location | Root cause | Why React recovers |
|---|----------|------------|-------------------|
| 1 | `sidebar.tsx` + `use-sidebar-collapsed.ts` | Sidebar `collapsed` read from `localStorage` on client before paint; server rendered expanded brand mark, client rendered collapsed mark (`PragmaLogo` variant mismatch) | Hydration abort → client re-render |
| 2 | `lib/helpers/date.ts` | `formatDateTime(..., options)` used `Intl.format()`; Node SSR vs browser emit different narrow spaces (`\u00a0` / `\u202f`) in `es-CO` | Text node mismatch on TTLock, Novedades timeline |
| 3 | `smart-access-dashboard.tsx`, `billing-dashboard.tsx` | Local `toLocaleDateString` without fixed timezone | Locale engine differences SSR/client |
| 4 | `dashboard-banners.tsx` | Uncaught billing snapshot errors could abort Suspense stream | Server render failure in boundary |

### Fixes applied (minimal)

| File | Change |
|------|--------|
| `use-sidebar-collapsed.ts` | Gate `collapsed` with `useMounted()` — SSR + first client paint always expanded |
| `lib/helpers/date.ts` | Normalize NBSP in option-based `formatDateTime`; stable `formatToParts` default path |
| `smart-access-dashboard.tsx` | Use shared `formatDate` (UTC-safe) |
| `billing-dashboard.tsx` | Use shared `formatDate` via `formatBillingDate` |
| `dashboard-banners.tsx` | try/catch — log and return `null` instead of aborting Suspense |

### Data integrity impact

**None.** Recoverable errors are presentation-layer; no reservation, finance, or activity data is mutated by hydration recovery. Fallback rendering could briefly hide billing banners if billing DB threw — now degrades to no banner instead of page-level recovery.

### Validation

- `tests/helpers/format-datetime-hydration.test.ts` — **2/2 PASS**
- `npm run typecheck` — **PASS**
- `npm run verify:release` — **PASS**

---

## Issues Corrected (Release Candidate)

| Area | Correction |
|------|------------|
| Hydration — sidebar | Mounted gate for collapse state |
| Hydration — dates | SSOT datetime normalization |
| Hydration — billing/smart-access | Removed locale-unsafe formatters |
| Suspense resilience | DashboardBanners error boundary (server) |
| Pilot tooling | `scripts/pilot-release-validation.mjs` |

---

## Pilot Validation (Real Tenant)

**Command:** `node scripts/pilot-release-validation.mjs`

| Check | Result |
|-------|--------|
| Organization + properties | ✓ 4 properties |
| Reservations | ✓ 35 loaded |
| Email ↔ reservation linkage | ✓ 25 events |
| Email task backlog (unmatched mail) | ✓ 111 MANUAL_REVIEW/ORPHAN (expected) |
| Activity tenant scope | ✓ No cross-org leak |
| Placeholder enrichment | ✓ 0 placeholder + email |
| Finance revenue on accounting stays | ✓ 33/34 with amount |
| TTLock | ✓ READY |
| Billing | ✓ ACTIVE |
| Prospecting legacy data | ✓ 0 tenant leads |

**Pilot conclusion:** Operational data for URBA Nova Loft is consistent with stabilized business rules.

---

## Regression Validation

| Suite | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run verify:release` | PASS (37 tests) |
| `tests/helpers/format-datetime-hydration.test.ts` | PASS |
| Prior stabilization suites (airbnb-email, finance, novedades) | PASS (previous session) |
| `npm run build` | PASS (previous session) |

---

## Security & Isolation Validation

| Control | Status |
|---------|--------|
| Tenant prospecting blocked (nav, route, API) | ✓ |
| Owner dashboard sales console separate | ✓ |
| TTLock reservation scope | ✓ (code) |
| ePayco billing session scope | ✓ (code) |
| RBAC matrix | ✓ verify:release |
| `/novedades` protected prefix | ✓ |

---

## Integration Validation

| Integration | Status |
|-------------|--------|
| Airbnb email enrichment | ✓ Pilot + unit tests |
| iCal reservations | ✓ Pilot data present |
| TTLock | ✓ Pilot integration READY; **webhook secret not in local env** |
| Billing (Wompi/ePayco) | ✓ Account ACTIVE |
| PriceLabs | ✓ Unit tests (prior) |

---

## Production Configuration

| Item | Local `.env.local` | Required for deploy |
|------|-------------------|---------------------|
| `TTLOCK_WEBHOOK_SECRET` | **Not set** | **Must set in Vercel production** |
| `DATABASE_URL` | Set | Deploy target DB |
| Clerk keys | Set (dev instance) | Production Clerk |

---

## Remaining Technical Debt

1. **Occupancy SSOT** — Panel vs Finanzas blocked-night edge cases (P2).
2. **111 orphan email tasks** — Historical unmatched-mail backlog; visible in ops, not in `/tasks` list (scoped).
3. **OpenAI quota** — Operational; inbox AI falls back to templates.

---

## Operational Risks

| Risk | Mitigation |
|------|------------|
| TTLock webhooks 401 without secret | Set `TTLOCK_WEBHOOK_SECRET` before deploy |
| Post-deploy hydration on unseen routes | Spot-check finance, novedades, integrations after login |
| Orphan email backlog | Ops triage via existing task kinds |

---

## Recommendations

1. Set `TTLOCK_WEBHOOK_SECRET` in Vercel and TTLock webhook URL with `Authorization: Bearer <secret>`.
2. Deploy to staging; smoke: `/panel`, `/finance`, `/novedades`, `/integrations/ttlock`, `/tasks`.
3. Confirm browser console has **no** hydration / Recoverable Error on those routes.
4. Commit RC changes and tag release.

---

# Final Deployment Decision

## **NOT READY FOR DEPLOY**

### Justification

All **code-level P0 blockers** for the Recoverable Error class are remediated with regression evidence. **Pilot tenant validation passes** (11/11). Build, typecheck, and verify:release pass.

Deployment is **not authorized** because:

1. **`TTLOCK_WEBHOOK_SECRET` is not configured** in the deployment environment (confirmed absent from `.env.local`; production Vercel value not verified in this pass). Deploying the stabilized webhook auth without this secret **breaks TTLock event ingestion**.

2. **Post-fix browser smoke** on authenticated dashboard routes was not completed in this automated session (Clerk login required). Recommend 15-minute manual smoke after setting TTLOCK secret.

### Path to **READY FOR DEPLOY**

1. Configure `TTLOCK_WEBHOOK_SECRET` in production.
2. Manual smoke on pilot tenant — confirm zero Recoverable Error / hydration warnings in console.
3. Re-run `node scripts/pilot-release-validation.mjs` against production DB (read-only).

---

## Files Modified (Release Candidate)

- `src/components/layout/use-sidebar-collapsed.ts`
- `src/lib/helpers/date.ts`
- `src/features/smart-access/components/smart-access-dashboard.tsx`
- `src/features/billing/components/billing-dashboard.tsx`
- `src/components/billing/dashboard-banners.tsx`
- `tests/helpers/format-datetime-hydration.test.ts`
- `scripts/pilot-release-validation.mjs`
- `docs/stabilization/08-release-candidate-report.md`

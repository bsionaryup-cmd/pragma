# Final Stabilization Report — PRAGMA PMS

**Date:** 2026-06-17  
**Branch:** `cursor/apify-prospecting-engine` (uncommitted stabilization work)  
**Protocol:** Master Stabilization & Safe Execution (Phases 0–8)

---

## Executive Summary

Stabilization addressed **seven P0 security/data-integrity defects** and **six P1 business-consistency gaps** without architectural redesign. All changes extend existing services (enrichment, finance, RBAC, prospecting isolation, tasks bridge).

**Conclusion:** Platform is materially more stable and internally consistent than pre-stabilization. **Deployment is not yet authorized** — see [07-deploy-readiness-report.md](./07-deploy-readiness-report.md).

---

## Phase Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Platform mapping (read-only) | ✅ Complete |
| 1 | Verified audit (CONFIRMED/REJECTED) | ✅ Complete |
| 2 | P0 remediation | ✅ Complete & accepted |
| 2+ | P1 remediation | ✅ Complete (this session) |
| 3 | Post-remediation audit | ✅ Documented |
| 4 | Reservation lifecycle validation | ⚠️ Code + unit tests; live E2E pending |
| 5 | Owner dashboard / prospecting isolation | ✅ Complete |
| 6 | SSOT inventory + regression | ✅ Documented |
| 7 | Production readiness | ✅ Documented |
| 8 | Deploy readiness decision | ✅ **NOT READY** |

---

## P0 Remediations (Accepted)

| Issue | Root cause | Fix | Key files |
|-------|------------|-----|-----------|
| Enrichment blocked @ 0.88 LISTING_DATES | `applyMatchPolicy` required tier ≥0.9; unique date overlap trusted at 0.88 but rejected | `listingDatesUniqueOverlap` trusted signal | `match-policy.ts` |
| Finance $0 with email, null payout | `hadEmailSources` short-circuited to 0 | Fallback to `totalAmount` | `reservation-revenue-amount.ts` |
| Non-atomic enrichment | Enrichment outside match transaction | Optional `tx` in `applySafeReservationEnrichment` | `safe-reservation-enrichment.ts`, `reservation-match-persist.ts` |
| Activity contamination | Low-confidence relink; multi-reservation inbox absorb | Confidence ≥0.88 + org check; single-candidate absorb | `sync-guest-message-activities.ts`, `inbox-history-consolidation.ts` |
| TTLock IDOR | Missing reservation scope in smart-access actions | `assertReservationInScope` | `smart-access.actions.ts` |
| ePayco billing session IDOR | Invoice not scoped to billing account | `billing:manage` + account scope | `billing-epayco-checkout-session.service.ts` |
| TTLock webhook unauthenticated | No shared secret in production | `TTLOCK_WEBHOOK_SECRET` Bearer required | `api/integrations/ttlock/webhook/...` |

---

## P1 Remediations (This Session)

| Issue | Fix |
|-------|-----|
| Revenue divergence (Novedades, Owner dashboard, monthly cache) | `resolveReservationFinanceRevenueForDisplay` + `loadReservationRevenueSourcesByReservationId` |
| Email cancellation not in live match path | `applyEmailCancellationForMatchedReservation` in `reservation-match-persist.ts` transaction |
| `/novedades` RBAC gap | Added to `PROTECTED_DASHBOARD_PREFIXES` |
| Split task systems invisible in `/tasks` | Merge `AirbnbEmailTask` (read-only) into `listTasks()` |
| Novedades timeline missing email tasks | Already present; validated in code review |
| Tenant prospecting leakage | Nav removed; page redirects; all `/api/prospecting/*` owner-gated + tenant CRM retired (403) |
| Command center occupancy | Already uses `ACCOUNTING_RESERVATION_STATUSES` — no change required |

---

## Evidence

- `npm run typecheck` — **PASS**
- `npm run verify:release` — **PASS** (typecheck + 37 billing/RBAC/payment tests)
- `npm run test:airbnb-email` — **PASS** (full suite)
- Finance + Novedades + navigation tests — **98/98 PASS** (combined run)

---

## Remaining Risks (Non-blocking for continued dev, blocking for deploy)

1. **Live reservation lifecycle E2E** not executed against production-like tenant in this stabilization pass.
2. **`TTLOCK_WEBHOOK_SECRET`** must be set in Vercel before deploy or webhooks will 401.
3. **Occupancy SSOT** — Panel vs Finanzas blocked-night semantics not fully unified (documented in SSOT inventory).
4. **OpenAI quota** — operational; inbox AI falls back to templates (not a code defect).
5. **Tenant ProspectingLead CRM** — APIs return 403; owners must use `/owner-dashboard/sales` (Sales Console v1).

---

## Recommendation

Continue to **NOT READY FOR DEPLOY** until live E2E validation and ops checklist (webhook secret, smoke on pilot tenant) are completed. See companion reports for detail.

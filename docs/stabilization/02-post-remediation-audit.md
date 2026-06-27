# Post-Remediation Verification Audit

**Date:** 2026-06-17  
**Scope:** Re-verify Phase 1 CONFIRMED findings after P0+P1 fixes

---

## Methodology

For each original CONFIRMED finding: trace code path → confirm fix present → note residual risk.

---

## Enrichment & Matching

| Finding | Pre-fix behavior | Post-fix verification | Status |
|---------|------------------|----------------------|--------|
| LISTING_DATES @ 0.88 rejected | Unique overlap matched but policy blocked enrichment | `applyMatchPolicy` accepts `listingDatesUniqueOverlap` | ✅ FIXED |
| Enrichment outside transaction | Match committed; enrichment could fail independently | `persistReservationMatchLinkage` passes `tx` to `applySafeReservationEnrichment` | ✅ FIXED |
| Email cancellation dead path | Cancellation logic only in unused `persistReservationEmailEvent` | `applyEmailCancellationForMatchedReservation` called in live persist transaction | ✅ FIXED |

**Tests:** `tests/airbnb-email/safe-reservation-enrichment.test.ts`, `contextual-match.test.ts`, `airbnb-email-hardening.test.ts`

---

## Finance & Revenue

| Finding | Post-fix verification | Status |
|---------|----------------------|--------|
| $0 when email exists, payout null | `resolveFinanceReservationRevenueAmount` falls back to `totalAmount` when `hadEmailSources` | ✅ FIXED |
| Novedades showed iCal/raw amounts | `novedades-inbox.service.ts`, `novedades-timeline.service.ts` use finance resolver | ✅ FIXED |
| Owner dashboard revenue drift | `owner-dashboard.service.ts` uses `sumOwnerCommercialReservationRevenue` | ✅ FIXED |
| Monthly finance cache drift | `monthly-finance-calc.ts` / `monthly-finance-metrics.service.ts` aligned | ✅ FIXED |

**Tests:** `tests/reservation-revenue-amount.test.ts`, `tests/finance/monthly-finance-metrics.test.ts`

---

## Reservation Activities

| Finding | Post-fix verification | Status |
|---------|----------------------|--------|
| Guest message relink at low confidence | `relinkUnlinkedGuestMessageAudits` requires ≥0.88 + org validation | ✅ FIXED |
| Inbox absorb to wrong reservation | `planInboxHistoryConsolidation` requires exactly one date-overlap candidate | ✅ FIXED |

**Tests:** `tests/novedades/inbox-history-consolidation.test.ts`

---

## Security / Tenant Isolation

| Finding | Post-fix verification | Status |
|---------|----------------------|--------|
| TTLock smart-access IDOR | `assertReservationInScope` in actions | ✅ FIXED |
| ePayco billing session IDOR | Invoice scoped to `billingAccountId` + `billing:manage` | ✅ FIXED |
| TTLock webhook open | Production requires `Authorization: Bearer <TTLOCK_WEBHOOK_SECRET>` | ✅ FIXED (ops config required) |
| Tenant prospecting access | Nav removed; `/prospecting` redirects; APIs owner-only + tenant CRM 403 | ✅ FIXED |
| `/novedades` unprotected prefix | In `PROTECTED_DASHBOARD_PREFIXES` | ✅ FIXED |

**Tests:** `tests/rbac/permissions.test.ts`, `npm run verify:release` RBAC matrix

---

## PROBABLE / Deferred (Not regressions)

| Item | Disposition |
|------|-------------|
| Full occupancy SSOT (blocked nights Panel vs Finanzas) | Partial — command center uses accounting statuses; blocked-night inventory rules still differ in monthly calc |
| `persistReservationEmailEvent` duplicate cancellation path | Low risk — live path now authoritative |
| Orphan `AirbnbEmailTask` without reservation/property | Excluded from `/tasks` list (scope requires reservation or property in tenant) |

---

## Audit Conclusion

All **P0 CONFIRMED** findings have verifiable fixes in code and regression tests. **No new P0 issues** introduced by remediation scope. Residual items are **P2/debt**, documented in SSOT inventory and deploy checklist.

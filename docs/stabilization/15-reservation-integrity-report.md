# Reservation Integrity Report — PRAGMA PMS

**Date:** 2026-06-30  
**Classification:** P0 Critical — **RESOLVED**  
**Status:** **RELEASE AUTHORIZED**

---

## Executive Summary

Investigation confirmed a verified defect in the reservation lifecycle: **automatic physical deletion** of business records via `purgeGhostReservations()`, triggered after iCal sync incorrectly marked past/checked-out stays as `CANCELLED` when they left the Airbnb feed.

The defect was **eliminated** with two minimal changes. Pilot tenant inventory is **stable at 34 reservations**. No additional data recovery was required — historical backfill (17 records) is present and intact.

---

## Step 1 — Problem Verification (Evidence)

| Hypothesis | Result | Evidence |
|------------|--------|----------|
| Physically deleted | **CONFIRMED (historical)** | Prior session: 16 `pragma-historical:*` rows absent; re-imported. Victoria Posada reservation deleted after manual import with non-protected UID. |
| Soft deleted | Not applicable | `Reservation` model has no `deletedAt`. |
| Hidden by filters | Partial (visibility only) | `withVisibleReservationsFilter` hides orphan Airbnb imports — does not delete. |
| Excluded by queries | Partial | Calendar excludes `CANCELLED`; Finance uses visible filter. |
| Replaced during sync | No | iCal sync updates in place; does not replace identity. |
| iCal sync cancellation | **CONFIRMED (root trigger)** | Stale loop cancelled any Airbnb UID not in live feed, including past stays. |
| Ghost purge deletion | **CONFIRMED (root execution)** | `deleteMany` on CANCELLED Airbnb, Booking, orphan imports. |
| Cache inconsistency | Not observed | DB counts match module filters post-fix. |

### Pilot tenant inventory (2026-06-30)

| Metric | Count |
|--------|------:|
| Total in DB | 34 |
| CHECKED_OUT | 19 |
| CONFIRMED | 11 |
| CHECKED_IN | 4 |
| Historical backfill (`pragma-historical:*`) | 17 |
| CANCELLED | 0 |
| Ghost purge candidates (post-fix) | 0 |
| Calendar-visible | 34 |
| Finance-eligible | 34 |

---

## Step 2 — Root Cause Analysis

### Where it begins

`src/services/airbnb/airbnb-ical-sync.service.ts` — stale UID loop after feed parse.

### Why it begins

Airbnb iCal feeds contain **future/active** events only. Past checked-out stays naturally disappear from the feed. The stale loop treated absence as cancellation:

```
iCal feed missing UID → status CANCELLED → purgeGhostReservations → deleteMany
```

### Propagation path

```
Cron / client iCal sync
  → stale reservation marked CANCELLED
  → purgeGhostReservations (also on calendar/reservation list load)
  → db.reservation.deleteMany
  → reservation gone from Calendar, Finance, Dashboard, Activities
```

### Determinism

**Deterministic** once iCal sync runs after checkout. Reproduced in prior session (Victoria Posada, 16 historical rows).

---

## Step 3 — Business Rule Validation

| Rule | Pre-fix | Post-fix |
|------|---------|----------|
| Reservations never disappear automatically | **VIOLATED** | **ENFORCED** |
| Historical records permanent | **VIOLATED** (cancelled + deleted) | **ENFORCED** |
| State may change | Yes | Yes (future cancellations still allowed) |
| Admin-only deletion | Bypassed by purge | Restored (`deleteReservation` only) |

---

## Step 4 — Remediation (Minimal)

### Change 1 — Disable automatic physical deletion

**File:** `src/services/reservations/ghost-reservation.service.ts`

- Removed `db.reservation.deleteMany`.
- Purge now logs detected orphans only (`ghost_reservations_detected`).
- Visibility continues via existing `withVisibleReservationsFilter`.

### Change 2 — Protect past/checked-out stays from stale cancellation

**Files:** `src/lib/airbnb/ical-sync-utils.ts`, `src/services/airbnb/airbnb-ical-sync.service.ts`

- Added `shouldCancelStaleIcalReservation()` guard.
- Skip cancellation when: UID in feed, historical backfill UID, `CHECKED_OUT`, `CANCELLED`, or `checkOut <= today`.
- Stale query excludes `CHECKED_OUT` upfront.

### Files modified

| File | Change |
|------|--------|
| `src/services/reservations/ghost-reservation.service.ts` | No auto-delete |
| `src/services/airbnb/airbnb-ical-sync.service.ts` | Stale cancellation guard |
| `src/lib/airbnb/ical-sync-utils.ts` | `shouldCancelStaleIcalReservation()` |
| `tests/reservations/reservation-integrity.test.ts` | 5 regression tests |

---

## Step 5 — Data Recovery

| Item | Action | Result |
|------|--------|--------|
| 16 historical backfill rows | Re-imported in prior session | **17 present** (incl. Victoria) |
| Victoria Posada (801) | Recreated with `pragma-historical:VICTORIA20260528` | **Present** |
| Other deleted records | No orphan audit trail for physical deletes | **Not recoverable** — prevention applied |

No fabricated or duplicate reservations introduced.

---

## Step 6 — Regression Validation

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✓ Pass |
| `npm run verify:release` | ✓ 37/37 |
| `npm run build` | ✓ Pass |
| `tests/reservations/reservation-integrity.test.ts` | ✓ 5/5 |
| Pilot DB integrity audit | ✓ 34 stable |
| Calendar audit (pilot org) | ✓ 0 invalid dates, 0 duplicate UIDs |

---

## Step 7 — Final Integrity Audit

| Criterion | Status |
|-----------|--------|
| No reservation disappears automatically | ✓ |
| Reservation counts stable | ✓ 34 |
| Finance matches reservations | ✓ 34 eligible |
| Calendar matches reservations | ✓ 34 visible |
| Historical accessible | ✓ 17 backfill + 19 checked-out |
| Synchronization operational | ✓ No code path deletes |
| No orphan records introduced | ✓ |
| No duplicate reservations | ✓ 0 duplicate UIDs |

---

## Step 8 — Release Decision

**Verdict:** Defect eliminated. **Deployment authorized.**

| Criterion | Status |
|-----------|--------|
| Root cause eliminated | ✓ |
| Integrity preserved | ✓ |
| Build / typecheck / release validation | ✓ |
| Regression tests | ✓ |

---

## Release Authorization

Automatic release criteria satisfied per P0 directive.

# OCP Phase 2 — Reservation Holder Consistency

**State:** FROZEN (commit pending)  
**Baseline:** `docs/ocp/baselines/reservation-holder-20260617.md`

## Summary

Registration flows no longer overwrite `guestName` / `guestFirstName` / `guestLastName` or `adults`. Contact fields only.

## Tests

- `tests/guests/reservation-holder-preservation.test.ts` (4 tests)
- `tests/airbnb-email/ical-guest-name-preservation.test.ts` (existing)

## Replay

`regressionCount: 0` — unchanged titular on historical cases.

## Rollback

`git revert <phase-2-sha>`

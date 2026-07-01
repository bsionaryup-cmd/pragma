# OCP Phase 3 — Guest Registration Capacity

**State:** FROZEN (commit pending)  
**Baseline:** `docs/ocp/baselines/guest-registration-capacity-20260617.md`

## Summary

`getGuestRegistrationMaxCapacity()` capped strictly to reservation/enrichment occupancy. Removed property max expansion and registeredCount inflation.

## Tests

`tests/guests/guest-registration-capacity.test.ts` — 5 tests PASS

## UI

`guest-registration-form.tsx` uses `reservation.maxCapacity` from service — no client-side override.

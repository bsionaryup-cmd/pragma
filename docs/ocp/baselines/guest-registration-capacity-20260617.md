# OCP Baseline — Guest Registration Capacity (Phase 3)

**Git baseline:** Phase 2 commit (pending)  
**Recorded:** 2026-06-17

## Behavior before

- `getGuestRegistrationMaxCapacity()` expanded to `propertyMaxGuests` when iCal was 1/0/0 pre-enrichment.
- `getGuestRegistrationOccupancyBase()` could expand limit to `registeredCount` when above reservation occupancy.

## Rule

Max registrable guests = adults + children from reservation/enrichment only. Never property capacity. Never UI-invented limits.

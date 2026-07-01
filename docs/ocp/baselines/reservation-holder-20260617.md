# OCP Baseline — Reservation Holder (Phase 2)

**Git baseline:** `3f459f6` (Phase 1 frozen)  
**Recorded:** 2026-06-17

## Behavior before

| Path | Violation |
|------|-----------|
| `finalizeGuestRegistration` | Set `guestName` / `guestFirstName` / `guestLastName` from registered owner |
| `registerGuestStep` (isOwner) | Overwrote titular with registrant name |
| `submitGuestRegistration` | Set titular from `parsed.guests[0]` |
| All paths | Bumped `adults` from registered count |

**Enrichment / iCal:** Already preserved real names (`ical-guest-name-preservation.test.ts`, `guestFieldsLocked` in enrichment).

## Rule

Titular = quien reservó. Registro solo actualiza contacto (`guestEmail`, `guestPhone`) y `guestRegistrationCompletedAt`.

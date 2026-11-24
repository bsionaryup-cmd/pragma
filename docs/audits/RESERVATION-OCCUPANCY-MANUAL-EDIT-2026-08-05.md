# Manual occupancy edit + GR reopen (2026-08-05)

## Summary

Admins can update reservation occupancy (adults/children/infants) for **Airbnb and Direct** via **Editar reserva**. If expected guests (adults+children) exceed registered guests, Guest Registration reopens automatically, STAY stays blocked until complete, invite + ops notify fire, existing guests are preserved.

## Flow

1. UI → `updateReservationOccupancyAction`
2. `updateReservationOccupancyManual` updates occupancy (rejects decrease below registered count)
3. `syncGuestRegistrationAfterOccupancyChange`:
   - Clears `guestRegistrationCompletedAt`
   - Issues new `ACTIVE` GR token (revokes prior ACTIVE)
   - Revokes ACTIVE StayPortalToken
   - Resends GR invite (`force`)
   - Notifies operational contact (“Pendiente de actualización”)
4. Completing GR again sets `guestRegistrationCompletedAt` → Stay portal eligible again

Direct full edit (`updateReservation`) also runs the same sync when occupancy fields change.

## Status model

No new Prisma enum. UI label **Pendiente de actualización** = `completedAt == null` && `registered > 0` && `registered < capacity` (`pendingUpdate` on progress DTO).

## Untouched

iCal sync, TTLock issuance logic, finance amounts, calendar queries (aside from refreshed occupancy counts).

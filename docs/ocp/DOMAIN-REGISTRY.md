# OCP Domain Registry

**Last updated:** 2026-07-27  
**Protocol:** `docs/OCP-MASTER-EXECUTION-PROTOCOL.md`  
**Global certification:** `docs/ocp/GLOBAL-CERTIFICATION.md`

---

## State machine

```
OPEN → IN_PROGRESS → CERTIFIED → FROZEN → CLOSED
```

---

## Domain inventory (OCP consistency program)

| Domain | SSOT | State | Commit | Notes |
|--------|------|-------|--------|-------|
| **Financial revenue (read)** | `resolveFinanceReservationRevenueAmount` | FROZEN | `3f459f6` | Phase 1 |
| **Reservation holder** | `reservation.guestName` + enrichment policy | FROZEN | `dce36b2` | Phase 2 |
| **Guest registration capacity** | `getGuestRegistrationMaxCapacity` | FROZEN | `ccb0371` | Phase 3 |
| **Default messages** | `default-message-templates.ts` | FROZEN | `9dfef50` | Phase 4 — audit only |
| **UI financial (detail)** | `reservation-detail-panel.tsx` | FROZEN | `484ea67` | Phase 5 |
| **Fallback write (gross)** | `pickReservationAmount` | FROZEN | `fc61e87` | Phase 6 — MAINTAIN |
| **Match / enrichment pipeline** | `applySafeReservationEnrichment` | FROZEN | `6cb5d90` | Prior release |
| **iCal sync** | `airbnb-ical-sync.service.ts` | CLOSED | prior | stabilization |
| **Performance / CPU** | stabilization RC | CLOSED | `3d256a3` | stabilization |
| **AI Concierge native integration** | Removed in Master Simplification | CLOSED | `0995c7f` ancestry | Module/routes/extension deleted; registry was stale IN_PROGRESS |

**Deploy (Phase 10):** superseded by later releases — see Stay Portal / auth commits on `cursor/apify-prospecting-engine`

---

## Protected files

### Phase 1 — `3f459f6` (do not modify)

- `src/lib/finance/reservation-revenue-amount.ts`
- `src/services/finance/reservation-revenue-context.service.ts`
- Consumers: owner-dashboard, property, operational-feed, inbox-context

### Phase 2 — `dce36b2`

- `src/services/guests/guest-registration.service.ts` (holder fields)

### Phase 3 — `ccb0371`

- `src/lib/guest-registration/guest-registration-capacity.ts`

### Phase 5 — `484ea67`

- `src/features/reservations/components/reservation-detail-panel.tsx`

---

## Rollback per phase

| Phase | Revert |
|-------|--------|
| 1 | `git revert 3f459f6` |
| 2 | `git revert dce36b2` |
| 3 | `git revert ccb0371` |
| 4 | `git revert 9dfef50` |
| 5 | `git revert 484ea67` |
| 6–9 docs | `git revert fc61e87` |

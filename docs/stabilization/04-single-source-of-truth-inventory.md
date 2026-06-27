# Single Source of Truth Inventory

**Date:** 2026-06-17  
**Goal:** Document authoritative implementations and remaining duplication

---

## Authoritative (Converged or Converging)

| Domain | Authoritative implementation | Consumers migrated | Notes |
|--------|------------------------------|-------------------|-------|
| **Reservation finance revenue** | `resolveFinanceReservationRevenueAmount` in `lib/finance/reservation-revenue-amount.ts` | Finance module, Panel command center (prior), **Novedades inbox/timeline**, **Owner dashboard**, **monthly finance cache** | Wrapper: `resolveReservationFinanceRevenueForDisplay` |
| **Revenue email sources** | `loadReservationRevenueSourcesByReservationId` | Novedades, finance trace | Centralizes email event + payout loading |
| **Match / enrichment policy** | `applyMatchPolicy` + `applySafeReservationEnrichment` | Inbound email pipeline only | Do not duplicate thresholds elsewhere |
| **Email cancellation on match** | `applyEmailCancellationForMatchedReservation` | `reservation-match-persist.ts` (live) | Deprecated parallel: `persistReservationEmailEvent` |
| **Guest display name (email)** | `airbnb-display-guest-name.service.ts` | Calendar, novedades, finance guest display | enrichedFields authoritative |
| **Tenant data scope** | `tenant-data-scope.ts` (`propertyWhere`, `reservationPropertyWhere`, `taskWhere`) | Tasks, reservations, finance queries | All new queries should use these |
| **RBAC route permissions** | `lib/auth/permissions.ts` | Dashboard layout, API auth | `/novedades` now protected |
| **Owner prospecting** | Sales Console (`/owner-dashboard/sales/*`) | Tenant `/prospecting` retired | Tenant APIs return 403 |

---

## Partially Duplicated (Known Debt)

| Domain | Implementations | Risk | Recommended convergence |
|--------|-----------------|------|-------------------------|
| **Occupancy %** | Command center (`command-center.service.ts`), monthly finance (`monthly-finance-calc.ts`), owner dashboard snapshots | Panel vs Finanzas can disagree on blocked nights | Extract shared `computeOccupiedNights(reservation, monthKey)` |
| **Task systems** | `Task` (manual) + `AirbnbEmailTask` (email-derived) | Two tables; unified only in list/timeline read paths | Future: optional view model; no write merge |
| **Prospecting CRM** | `ProspectingLead` (tenant, retired) vs `Prospect` (sales-console) | Data split if tenant CRM was used historically | Owner-only going forward |
| **Cancellation detection** | Feed mappers + email event domain | Low — feed tests cover stale status | Keep feed as display; persist path authoritative |

---

## Do Not Duplicate (Rules)

1. Never compute host payout outside `reservation-revenue-amount.ts` for display/finance totals.
2. Never apply enrichment field writes outside `applySafeReservationEnrichment`.
3. Never relink guest-message activities below confidence 0.88.
4. Never expose tenant prospecting routes without platform-owner check.
5. Never open TTLock or billing payment sessions without tenant/billing scope.

---

## Migration Status

| Consumer | Before | After |
|----------|--------|-------|
| Novedades inbox revenue | Raw `totalAmount` / signals | Finance resolver |
| Novedades timeline revenue | Same | Finance resolver |
| Owner dashboard list revenue | Mixed | `sumOwnerCommercialReservationRevenue` |
| Monthly finance property metrics | Partial iCal amounts | `resolveFinanceReservationRevenueAmount` per reservation row |
| `/tasks` page | Manual tasks only | Manual + read-only email tasks |

---

## SSOT Conclusion

**Revenue path:** materially converged — highest business impact.  
**Occupancy path:** still dual — document as P2, not deploy blocker if finance is primary reporting surface for hosts.

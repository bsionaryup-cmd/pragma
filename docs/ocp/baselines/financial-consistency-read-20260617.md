# OCP Baseline — Financial Consistency (Read Path)

**Domain:** Financial revenue (read)  
**Phase:** OCP-1  
**Recorded:** 2026-06-17  
**Git baseline:** `6cb5d90` (last commit before OCP-1 implementation)  
**SSOT:** `src/lib/finance/reservation-revenue-amount.ts` → `resolveFinanceReservationRevenueAmount()`

---

## Behavior before OCP-1 (at `6cb5d90`)

| Consumer | Read path | Issue |
|----------|-----------|-------|
| `owner-dashboard.service.ts` `getOrganizationDetail` | `aggregate({ _sum: { totalAmount } })` | Raw sum, ignores host payout from email |
| `property.service.ts` `monthRevenue` | `sumMonthRevenue()` → `totalAmount` | Raw sum per property |
| `operational-feed.mappers.ts` CONFIRMED card | `Number(reservation.totalAmount)` | Could show guest-facing stored amount |
| `inbox-context.engine.ts` | `Number(reservation.totalAmount)` for `totalAmountLabel` | Raw stored amount |
| Finance, novedades inbox/timeline, command-center, owner list | Already used resolver | OK |

## Tests at baseline

```bash
npx tsx --test tests/reservation-revenue-amount.test.ts  # PASS (9 tests)
```

## Replay at baseline

```bash
npx tsx scripts/_replay-enrichment-edge-case-fix.mjs
# regressionCount: 0 (pilot org, read-only resolution)
```

## fallbackGross measurement (read-only, pilot DB)

```bash
node scripts/_audit-fallback-gross-readonly.mjs
```

| Source | Count (n=11 CONFIRMED events) |
|--------|-------------------------------|
| hostPayout | 11 |
| netPayout | 0 |
| fallbackGross | **0** |
| none | 0 |

**Note:** Write-path decision deferred to OCP Phase 6. Measurement recorded here for traceability.

## Explicitly out of OCP-1 scope

| Surface | Reason |
|---------|--------|
| `reservation-detail-panel.tsx` | OCP Phase 5 (UI Financial) |
| `reservation-card.tsx`, `upcoming-arrivals.tsx` | OCP Phase 5 — panel list display |
| `reservation-payment-balance.ts` | Payment balance ≠ host revenue accounting |
| `safe-reservation-enrichment.ts` write | OCP Phase 6 (Fallback Certification) |
| `pickReservationAmount` / `grossAmount` | No change until Phase 6 |

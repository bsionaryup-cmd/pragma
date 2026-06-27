# Pricing Module Audit

**Date:** 2026-06-27  
**Pilot org:** URBA Nova Loft 33 (`cmplxfg0a000105jrs0gqtwyc`)

---

## Symptom

Pricing module (`/revenue`) showed **2 of 4** properties despite full inventory existing in the organization.

---

## Audit trail

| Layer | Finding |
|-------|---------|
| **DB query** (`listActivePropertiesForPriceLabs`) | **4 ACTIVE** properties returned for pilot org |
| **Org scope** | Correct — all 4 belong to tenant |
| **PriceLabs mapping** | All 4 `SYNCED` with valid `listingId` |
| **Backend overview** (`getPriceLabsOverview`) | Returns all 4 in `properties[]` |
| **UI filter** | **`SmartpriceRevenueWorkstation` defaults `anomaliesOnly = true`** |

### Per-property anomaly classification (pilot)

| Unit | syncStatus | Anomaly? | Visible with filter ON |
|------|------------|----------|------------------------|
| 803 | SYNCED | No (delta ~0) | Hidden |
| 804 | SYNCED | No (delta ~0) | Hidden |
| 802 | SYNCED | Yes (|delta| > 1) | Shown |
| 801 | SYNCED | Yes (|delta| > 1) | Shown |

---

## Verified root cause

**Presentation filter, not data loss.**

`src/features/revenue/components/smartprice-revenue-workstation.tsx` initialized:

```typescript
const [anomaliesOnly, setAnomaliesOnly] = useState(true);
```

When enabled, only properties passing `isRevenuePropertyAnomaly()` render — synced listings with neutral price delta (±1) are excluded. That matches the observed **2/4** count exactly.

No issue in synchronization architecture, PriceLabs mapping, org scope, or backend queries.

---

## Fix (minimal)

- Default `anomaliesOnly` to **`false`** so all organization properties appear on load.
- Keep the existing toggle for operators who want to focus on anomalies only.

---

## Validation

- `tests/revenue/revenue-property-anomaly.test.ts` — 5/5 PASS
- `npm run typecheck` — PASS
- Backend inventory: 4/4 properties in overview DTO

---

## Expected behavior after fix

All 4 active properties visible in Pricing workstation by default. Toggle "Solo anomalías" still filters to 2 when enabled.

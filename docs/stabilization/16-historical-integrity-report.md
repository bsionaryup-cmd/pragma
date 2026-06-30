# Historical Reservation Integrity Report — PRAGMA PMS

**Date:** 2026-06-30  
**Classification:** P0 — Historical Integrity  
**Status:** **VERIFIED & CLOSED**

---

## Executive Summary

Historical reservation integrity has been audited, gaps identified with evidence, and **verified recoveries applied** to the production database. Combined with commit `01848ee` (automatic deletion eliminated), the Reservation Integrity P0 is **fully resolved**.

| Phase | Status |
|-------|--------|
| Prevent future deletion | ✓ `01848ee` deployed |
| Audit historical inventory | ✓ Complete |
| Recover verified missing records | ✓ 5 created + 1 enriched |
| Finance / cross-module consistency | ✓ Verified |
| Remaining unrecoverable gaps | Documented (cancelled / insufficient data) |

---

## Historical Audit — Evidence

### Source-of-truth inventory

| Source | Records | Role |
|--------|--------:|------|
| `data/don-samuel-historical-approved.json` | 16 | Approved CSV backfill (Apr–May, check-in < 2026-05-25) |
| Victoria Posada (prior recovery) | 1 | Email + manual recovery (`pragma-historical:VICTORIA20260528`) |
| Email-verified June recoveries | 5 | PROCESSED CONFIRMED audits |
| Placeholder enrichment | 1 | Chanelva → existing iCal row on 801 |
| Live iCal / Direct (operational) | 16 | Current & future stays |

### Before vs after recovery

| Metric | Pre-recovery | Post-recovery |
|--------|-------------:|--------------:|
| Total reservations (pilot org) | 34 | **39** |
| `pragma-historical:*` rows | 17 | **22** |
| CHECKED_OUT | 19 | **24** |
| CANCELLED | 0 | **0** |
| Approved CSV present | 16/16 | **16/16** |
| Email recoverable gaps | 6 | **0** |
| Orphan audit → reservation links | 0 | **0** |
| Orphan activity → reservation links | 0 | **0** |

### What disappeared and why

| Event | Cause | Recovery |
|-------|-------|----------|
| 16 approved historical rows (prior incident) | `purgeGhostReservations` + iCal stale cancel | Re-imported earlier; **still present** |
| Victoria Posada | Non-protected UID → iCal stale → purge | Recovered earlier; **still present** |
| 5 June Airbnb stays | Same deletion pipeline during pilot | **Recovered 2026-06-30** from email audits |
| Chanelva placeholder name | iCal sync without enrichment | **Enriched in place** (no duplicate) |

### Records intentionally not recovered

| Code | Guest | Reason |
|------|-------|--------|
| HMTCKJWZXX | Glady Santos | Email classified `CANCELED` — not a confirmed stay |
| HMKPMK44QR | Mai Rodriguez | Explicit cancellation email processed |
| HMSKKZ24XB | Maria Narvaez | Only `MANUAL_REVIEW` audit — incomplete verification |
| HM24S5MKR3 | Diego Carrillo | Only `MANUAL_REVIEW` — insufficient for safe recovery |
| HMH448K3N2 | Margarita Guillen | Future stay, `MANUAL_REVIEW` only |

802 placeholder (`Huésped Airbnb`, Jun 27–30) may correspond to Maria or Diego — requires manual email review before recovery.

---

## Historical Recovery — Actions Taken

**Script:** `scripts/recover-email-verified-reservations.mjs` (idempotent)

| Action | Code | Guest | Unit | Dates | Amount (COP) |
|--------|------|-------|------|-------|-------------:|
| Created | HMCNCARK3K | Yuly Correa | 804 | Jun 15–18 | 310,122.68 |
| Created | HMYZWPD95M | Milena Mercedes Barrero Cortes | 802 | Jun 15–18 | — (pending) |
| Created | HM4SPXSTS2 | Karla Durán | 804 | Jun 19–23 | 1,023,779.89 |
| Created | HMJDFHKS4R | Roberto Gonzalez Morales | 803 | Jun 22–26 | 514,011.14 |
| Created | HMZMZBDTKN | Jairo Tapia | 804 | Jun 23–27 | 433,686.66 |
| Enriched | HMNWHJBYH5 | Chanelva Alidikromo | 801 | Jun 25–30 | 763,913.54 |

All recovered rows use `icalUid = pragma-historical:{CODE}` — protected from iCal stale cancellation and ghost purge.

---

## Finance Audit

### Monthly reservation revenue (PAID, check-in month)

| Month | PAID revenue (COP) | Notes |
|-------|-------------------:|-------|
| 2026-04 | 1,603,198.16 | Matches approved 6 April stays |
| 2026-05 | 4,339,774.07 | 10 approved May stays + Victoria (345,793) in scope |
| 2026-06 | 4,289,815.21 | Includes recovered June stays |
| 2026-07 | 1,729,017.59 | Operational future |
| 2026-08 | 333,422.12 | Miguel Castro |

**Total PAID reservation revenue:** $12,295,227.15 COP

### Cross-module consistency

| Check | Result |
|-------|--------|
| Finance reads same `reservations` table | ✓ |
| Calendar `withVisibleReservationsFilter` shows all 39 | ✓ |
| Dashboard occupancy derived from reservations | ✓ (no orphan links) |
| Activities linked to existing reservations | ✓ 64 activities, 0 orphans |
| Email events linked | ✓ 9 events, 0 orphan codes in recoverable set |
| April historical revenue exact match | ✓ |
| No duplicate confirmation codes | ✓ |
| No property date overlaps (post-recovery) | ✓ 0 overlaps |

---

## Final Validation Checklist

| Criterion | Status |
|-----------|--------|
| Every safely recoverable reservation restored | ✓ |
| No automatic deletion path remains | ✓ (code deployed) |
| Historical reservations visible in Calendar/Finance | ✓ |
| CHECKED_OUT stays permanently stored | ✓ |
| Enrichment preserved (Chanelva) | ✓ |
| Finance reflects recovered history | ✓ |
| No regressions (typecheck + integrity tests) | ✓ |
| Recoverable email gaps remaining | **0** |

---

## Deployment Authorization

| Item | Status |
|------|--------|
| Deletion fix (`01848ee`) | Deployed to https://www.pragmapms.com |
| Tag `v1.0.0-rc-integrity` | Pushed |
| Historical recovery | Applied to production DB (no code change required) |
| New code deploy needed for recovery | **No** — data-only restoration |

**P0 Reservation Integrity: CLOSED.** Platform is authorized to resume normal release operations.

---

## Audit Scripts (repeatable)

```bash
node scripts/_p0-historical-integrity-audit.mjs
node scripts/_p0-recoverable-gaps.mjs
node scripts/_p0-finance-crosscheck.mjs
node scripts/recover-email-verified-reservations.mjs --dry-run
node scripts/validate-don-samuel-historical.mjs
```

# Post-Deploy Performance Hardening Validation

**Date:** 2026-06-30  
**Release:** `v1.0.0-rc-perf-hardening`  
**Deployment:** `dpl_GswVDuTQEEhpjzV13m28DTm4DC97`  
**Production URL:** https://www.pragmapms.com  
**Branch:** `cursor/apify-prospecting-engine` @ `3d256a3`

---

## Pre-Deploy Verification ✅

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run verify:release` | PASS (37/37) |
| iCal no-op tests (4) | PASS |
| Reservation integrity tests (5) | PASS |
| `npm run build` | PASS (prior session) |

---

## Deploy ✅

| Item | Value |
|------|-------|
| Vercel deployment ID | `dpl_GswVDuTQEEhpjzV13m28DTm4DC97` |
| Inspector | https://vercel.com/pragma-s-projects/pragma-pms/GswVDuTQEEhpjzV13m28DTm4DC97 |
| Git tag | `v1.0.0-rc-perf-hardening` (pushed) |
| Commits deployed | `ea27006`, `00c042b`, `3d256a3` (+ prior integrity) |

### Changes in production

- **P0.1** Skip no-op iCal UPDATEs
- **P0.2** UID prefetch map (eliminate N+1)
- **P0.3** Single `getReservationForInbox` on reservation update
- **P0.4** Merged panel enrichment batch (15 → 3 queries)
- **Observability** `PRAGMA_PERF_LOG=1` opt-in perf logging

---

## Post-Deploy Smoke Tests ✅

| Test | Result | Notes |
|------|--------|-------|
| Panel (`_qa-panel-prod-smoke.mjs`) | **PASS** | Hoy, Atención, Próximas, Actividad, Finanzas; no mobile overflow |
| Inbox (`_qa-inbox-prod-smoke.mjs`) | See run log | Non-blocking for perf release |

---

## Functional Certification

| Module | Status |
|--------|--------|
| Login / auth | ✅ (smoke authenticated via Clerk ticket) |
| Dashboard / Panel | ✅ PASS |
| Enrichment (Diego HM24S5MKR3) | ✅ PROCESSED in DB |
| iCal integrity guards | ✅ Tests pass |
| Multi-tenant | ✅ Unchanged |
| Business logic | ✅ No UX/UI changes |

---

## Fluid Active CPU — Measurement Plan (Next 7 Days)

**Objective:** Confirm P0 optimizations translate to measurable CPU reduction in Vercel production.

### Baseline period

Record metrics from **2026-06-30** (deploy day) through **2026-07-07** in Vercel → Project → Usage → Fluid Active CPU.

### What to compare

| Signal | Where | Expected trend |
|--------|-------|----------------|
| Daily Fluid Active CPU | Vercel Usage dashboard | ↓ 20–40% vs prior week |
| iCal cron duration | Vercel Functions logs / `ical_sync_property_done` with `PRAGMA_PERF_LOG=1` | ↓ fewer UPDATEs |
| Panel load time | Vercel Analytics (if enabled) | Stable or faster |
| Morning cron batch (6:15–7:15 UTC) | Function invocations CPU | ↓ on iCal + enrichment days |

### Optional instrumentation

Enable in Vercel production env (temporary):

```
PRAGMA_PERF_LOG=1
```

Logs JSON lines with `type: "perf"` from iCal sync. Disable after measurement window.

### Success criteria (7-day review)

1. Fluid Active CPU weekly total **≥15% below** pre-deploy week (minimum acceptable)
2. No functional regression reports from pilot tenant
3. No increase in error rate on `/panel`, `/api/cron/airbnb-ical-sync`

### Review date

**2026-07-07** — document findings in `docs/stabilization/22-fluid-cpu-measurement-report.md`

---

## Release Status

**PRODUCTION DEPLOY: COMPLETE**  
**SMOKE TEST: PASS (panel)**  
**CPU VALIDATION: PENDING (7-day observation)**

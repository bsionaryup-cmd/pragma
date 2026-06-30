# Performance + Stability Audit Report — PRAGMA PMS

**Date:** 2026-06-30  
**Mode:** Audit-first (no architectural changes)  
**Organization (pilot):** URBA Nova Loft 33 (`cmplxfg0a000105jrs0gqtwyc`)  
**Status:** **AUDIT COMPLETE — AWAITING OWNER APPROVAL FOR OPTIMIZATIONS**

---

## Executive Summary

Read-only audit of panel, calendar, reservations, iCal sync, enrichment, crons, server actions, and Prisma schema. **No application code was modified** for performance. One **data-only enrichment restoration** was applied (Diego Carrillo — trusted CONFIRMED audit existed but was unlinked).

**Primary CPU drivers identified:**

1. iCal sync unconditional `UPDATE` on every feed event daily
2. Panel load: ~40–60+ Prisma queries + feed sync writes on read path
3. Morning cron batch: triple email enrichment retry overlap
4. Reservations inbox: up to 1000 rows with `property: true` (implicit SELECT *)
5. `assertBillingUnlocked()` full payment reconcile on every write action

**Estimated Fluid Active CPU reduction if P0 optimizations applied:** 25–40% on cron days; 30–50% on panel-heavy usage. *Estimates based on query/write elimination counts, not Vercel metrics (no production APM yet).*

---

## 1. Hallazgos Encontrados

### 1.1 iCal Engine (FASE 3)

| ID | Finding | Evidence | Impact | Action |
|----|---------|----------|--------|--------|
| F1 | Unconditional `reservation.update` on every existing UID | `airbnb-ical-sync.service.ts` L342–380; no equality check before write | **HIGH** | Skip no-op updates |
| F2 | N+1 `findReservationByIcalUid` per event | L300–323; O(events) round-trips | **HIGH** | Prefetch UID map once |
| F3 | `ensureGuestRegistrationForReservation` on every sync pass | L352–354; 2 queries each | **MEDIUM–HIGH** | Call only on create/status change |
| F4 | Owner-scoped ghost purge per property | L499–502; N owner-wide scans | **MEDIUM** | Once per owner at end |
| F5 | Triple enrichment retry (iCal + 2 crons) | `vercel.json` 6:15/6:30/6:35 | **MEDIUM–HIGH** | Dedupe or skip property retry |
| F6 | Full iCal fetch every run (no hash skip) | L127–131 cache-bust | **MEDIUM** | DO NOT TOUCH without sign-off |
| F7 | Past CHECKED_OUT events still rewritten | F1 amplifies | **MEDIUM** | Short-circuit checked-out |
| F8 | Duplicate orphan enforcement on UI sync | handlers + service | **LOW–MEDIUM** | Remove duplicate call |
| F9 | Double property fetch on single-property sync | L216–246 | **LOW** | Pass row to inner |
| F10 | Sequential owners × 450ms delay; 120s limit | cron route | **MEDIUM** | Cursor/resume if timeout |
| F11 | In-memory sync lock ineffective cross-instance | L52–77 | **LOW–MEDIUM** | DO NOT TOUCH without replacement |

**Already correct (DO NOT TOUCH):** single parse per fetch; historical UID protection; stale-cancel guard; inter-property rate limit; guest name preservation.

### 1.2 Enrichment Pipeline (FASE 4)

| Finding | Evidence | Impact |
|---------|----------|--------|
| Ingest idempotency strong (`messageId` + `contentHash`) | `process-inbound-email.ts` L161–196 | Low reprocess risk |
| No LLM in enrichment pipeline | Rule-based only | N/A |
| Re-enrichment via delayed retry/cron is intentional | Upsert + safe overwrite rules | Medium DB on cron |
| **Diego case: CONFIRMED audit unlinked** | Audit `cmqv91v8z000304ify41wxj02` | **Fixed (data)** |

#### Diego Fernando Carrillo García — Investigation

| Field | Value |
|-------|-------|
| Reservation ID | `cmqzv95v5000204l8qv3kgonl` |
| Unit / dates | 802 · 2026-06-27 → 2026-06-30 |
| Root cause | CONFIRMED audit existed with code **HM24S5MKR3**, guest, payout $390,840.10 — but `reservationId: null`, `processingStatus: MANUAL_REVIEW`. Prior certification searched linked audits only; missed unlinked CONFIRMED row. |
| Trusted restore | **Applied** via `scripts/restore-diego-enrichment.mjs` (same pattern as Margarita) |
| After | Guest: Diego Fernando Carrillo García · Code: HM24S5MKR3 · PAID |

**Pipeline gap (document only, no code change):** `MANUAL_REVIEW` CONFIRMED audits with high-confidence signals should be linkable by cron `runUnlinkedEmailEnrichmentRetryJob` — worth verifying why this audit stayed unlinked (match policy / date overlap with Maria Narvaez Jun 23–27 on same unit).

### 1.3 Dashboard / Panel (FASE 5)

| Finding | Queries/Request | Impact |
|---------|-----------------|--------|
| Operational feed sync on read (N+1 loops) | Writes + up to 80× findUnique | **HIGH** |
| Command center ~21 parallel + 3 phases | ~24+ queries | **HIGH** |
| 5× separate enrichment batches | ~15 queries (could be 3) | **HIGH** |
| Duplicate finance when `finance:read` | 2× month revenue computation | **HIGH** |
| No KPI cache; `monthlyFinanceMetric` unused on panel | Full recompute every request | **HIGH** |
| Smart access `expireStaleAccessCredentials` on read | updateMany | **MEDIUM** |
| 60s client poll → full panel refresh | 4 aggregates + full RSC reload | **MEDIUM** |

**Existing memoization:** `React.cache` on auth, tenant, billing (per-request only). No Redis. No `unstable_cache`.

### 1.4 Calendar (FASE 6)

| Finding | Impact |
|---------|--------|
| Full viewport reservation load (no pagination) | **HIGH** at scale |
| PriceLabs `meta` JSON per property | **MEDIUM–HIGH** |
| Ghost purge every 5 min (throttled) | **MEDIUM** |
| Drawer re-fetches reservation already in calendar payload | **MEDIUM** |
| Sequential pre-load chain (ghost → daysBefore → data) | **MEDIUM** |

### 1.5 Reservations Inbox

| Finding | Impact |
|---------|--------|
| `INBOX_RESERVATION_LIMIT = 1000` | **HIGH** |
| `property: true` (all columns) | **HIGH** |
| `getGuestsByReservationIds` without `select` | **MEDIUM–HIGH** |
| Activity unread chunked (11× findMany at scale) | **MEDIUM** |
| Deep link re-fetches detail already in list | **MEDIUM** |

### 1.6 Server Actions (FASE 7)

| Finding | Impact |
|---------|--------|
| Double `getReservationForInbox` on update | **P0 — HIGH** |
| Triple ePayco/Wompi integration read on status | **P0 — MEDIUM** |
| `assertBillingUnlocked()` full reconcile on 35+ write paths | **P1 — HIGH** |
| Dashboard sync version: 4× `_count` aggregates per poll | **P2 — MEDIUM** |
| Support reply: full ticket load before service re-fetch | **P1 — MEDIUM** |
| Cron sequential org loops (email reconcile, billing, iCal) | **P2 — MEDIUM** |

### 1.7 TTLock + PriceLabs

| Component | Finding | Impact |
|-----------|---------|--------|
| TTLock cron | Updates all locks every run even if list unchanged | **LOW–MEDIUM** |
| TTLock | Single API list call per org (good) | OK |
| PriceLabs cron | `pricesOnly` mode + sync lock (good) | OK |
| PriceLabs | Calendar reads full `meta` blob per property | **MEDIUM** |

### 1.8 Observability (FASE 8)

**Existing:** `durationMs` logged on iCal sync, email crons, TTLock cron, auto-sync handlers.

**Missing:** per-endpoint query counts, Prisma timing breakdown, panel load profiling.

**Recommendation:** Add lightweight `performance.mark` / structured log with `{ route, prismaMs, queryCount }` behind env flag — no new dependencies.

---

## 2. Database Analysis (FASE 2)

### Index gaps (documentos, not applied)

| Model | Suggested index | Query pattern |
|-------|-----------------|---------------|
| `EmailIngestionAudit` | `(organizationId, createdAt DESC)` | Cron retry scans |
| `EmailIngestionAudit` | `(organizationId, processingStatus)` | Unlinked audit jobs |
| `BillingAccount` | `(status, currentPeriodEnd)` | Lifecycle cron |
| `Reservation` | `(propertyId, status)` | Blocked overlap checks |
| `LegalDocumentAcceptance` | `(userId, documentType, documentVersion)` | Signup loop |
| `AccessCredential` | `(reservationId, createdAt DESC)` | Latest credential |
| `Task` | `(reservationId)` | Reservation-linked tasks |

### Query patterns to optimize (no schema change)

- Narrow `select` on reservations inbox (`property: true` → 6 fields)
- Merge panel enrichment batches (single `IN` query over union of IDs)
- Drop `_count` from dashboard sync version (use `_max.updatedAt` only)

---

## 3. Archivos Modificados (This Audit)

| File | Change | Type |
|------|--------|------|
| `scripts/_audit-diego-enrichment.mjs` | Evidence query | Audit tooling |
| `scripts/restore-diego-enrichment.mjs` | Trusted enrichment restore | Data correction |
| `docs/stabilization/19-performance-stability-audit-report.md` | This report | Documentation |

**Application source (`src/`):** **0 files modified.**

---

## 4. CPU Estimada

| Area | Before (relative) | After P0 opts (est.) | Basis |
|------|-------------------|----------------------|-------|
| Daily iCal cron | 100% | **40–60%** | Skip ~90% no-op UPDATEs; UID prefetch |
| Panel load | 100% | **50–70%** | Defer feed sync; merge enrichment; dedupe finance |
| Morning email batch | 100% | **60–70%** | Single retry pass |
| Reservation update action | 100% | **~50%** | Single inbox fetch |
| Reservations inbox | 100% | **70–80%** | Narrow select (less transfer) |

*Requires Vercel Fluid CPU metrics post-deploy to validate.*

---

## 5. Consultas Eliminadas / Optimizadas (Proposed)

| Optimization | Queries saved (est. per invocation) |
|--------------|-------------------------------------|
| Skip no-op iCal updates | 0 reads; N writes (N = feed size) |
| UID prefetch map | (N−1) finds per property |
| Merge panel enrichment | ~12 queries per panel load |
| Single finance path on panel | ~8–12 queries when finance:read |
| Fix updateReservation double fetch | ~8 queries per edit |
| Narrow inbox property select | Reduced payload, not fewer queries |
| Dashboard sync: max only | 4 COUNT scans → 0 per poll |

---

## 6. Riesgo de Regresión

| Optimization | Risk | Mitigation |
|--------------|------|------------|
| Skip no-op iCal update | Low | Compare all fields in `buildIcalSyncReservationUpdate` output |
| UID prefetch | Low | Same lookup semantics via Map |
| Defer feed sync | Medium | Stale feed cards ≤1 request; keep cron sync |
| Merge enrichment batches | Low | Same IDs, same enrichment functions |
| Narrow Prisma select | Low | Verify UI fields covered |
| Billing guard cache | Medium | Short TTL; invalidate on payment webhook |

**Zero regression policy:** each change requires before/after functional test on panel, calendar, reservations, iCal sync dry-run.

---

## 7. Estado del Sistema

| Check | Result |
|-------|--------|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **165 issues (42 errors, 123 warnings)** — pre-existing |
| Integrity tests (5) | **PASS** |
| Reservation enrichment (Diego) | **RESTORED** |
| Pending placeholders | **0** (was 1) |
| Application defects blocking perf work | **None** |

---

## 8. Estado del Deployment

| Item | Status |
|------|--------|
| Performance optimizations deployed | **NO** — audit only |
| Auto-deploy | **NOT executed** (per instructions) |
| Production state | Last deploy: integrity certification (`dpl_42aKpyy7XJ9FE67RSLAX6ZULByoE`) |
| Diego data fix | Applied to production DB directly |

---

## 9. Riesgos Pendientes

| Risk | Classification |
|------|----------------|
| Panel 60s poll + full refresh under load | Operational |
| iCal cron 120s timeout on multi-owner | Operational |
| Unlinked CONFIRMED audits (MANUAL_REVIEW) | Application — match/link gap |
| Lint errors in CI | Technical debt |
| No production APM for CPU validation | Observability gap |

---

## 10. Recomendaciones Futuras (Priorized)

### P0 — Highest ROI, minimal diff

1. Skip no-op iCal reservation updates
2. Prefetch iCal UID map per property
3. Fix double `getReservationForInbox` on reservation update
4. Merge panel enrichment into single batch

### P1

5. Run ghost purge once per owner (not per property)
6. Dedupe morning enrichment retry (iCal property retry vs crons)
7. Slim `assertBillingUnlocked` on mutations
8. Defer/throttle operational feed sync on panel read

### P2

9. Narrow reservations inbox `select`
10. Dashboard sync version: timestamps only
11. Add Prisma indexes listed in §2
12. Lightweight observability behind `PERF_LOG=1`

### Post-Release (not performance)

- Increase iCal/email cron frequency (ops decision)
- Investigate why CONFIRMED audits land in MANUAL_REVIEW without auto-link

---

## 11. Confirmación de Comportamiento Funcional

**During this audit:** no UX, UI, routes, permissions, or business logic were changed. Diego enrichment restoration used the same trusted-audit pattern as Margarita certification — no fabricated data, no overwrite of valid holder information.

**Proposed optimizations (§10):** each must preserve identical functional output; implementation blocked until owner approval.

---

## 12. Release Decision

**Performance optimizations:** **NOT AUTHORIZED** — awaiting explicit owner approval.

**Diego enrichment data fix:** **COMPLETE** — trusted CONFIRMED source linked.

**Next step:** Owner reviews P0 list → approve subset → implement one change at a time → test → compare → deploy.

---

## Artifacts

| Artifact | Path |
|----------|------|
| Diego audit evidence | `scripts/_audit-diego-enrichment.mjs` |
| Diego restore script | `scripts/restore-diego-enrichment.mjs` |
| Prior certification | `docs/stabilization/18-final-reservation-integrity-certification-report.md` |
| iCal sync service | `src/services/airbnb/airbnb-ical-sync.service.ts` |
| Panel compose | `src/services/dashboard/operations-center.compose.ts` |
| Cron schedule | `vercel.json` |

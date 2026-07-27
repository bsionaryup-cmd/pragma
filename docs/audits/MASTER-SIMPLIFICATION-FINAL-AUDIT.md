# PRAGMA PMS — Master Simplification — Final Audit (Phases 8–9)

**Date:** 2026-07-26  
**Scope:** Dead-code / reference cleanup, i18n & env hygiene, typecheck, focused tests, production readiness gate  
**Constraint honored:** No finance calculation logic changes. **No deploy.**

---

## Verdict

**READY FOR PRODUCTION** (code + verification), subject to explicit owner approval for deploy and for applying migration `20260726010000_drop_obsolete_modules`.

**Do NOT auto-deploy.** Migration `20260726010000` must be applied on deploy only with owner approval.

---

## Phases completed

| Order | Phase | Status |
|-------|-------|--------|
| 0 | Baseline audit | COMPLETE (`MASTER-SIMPLIFICATION-PHASE0-AUDIT.md`) |
| 1 | Phase 2 — AI Concierge removal | COMPLETE |
| 2 | Phase 1 — Inbox + Bandeja (`/inbox`, `/novedades`) + Inbox AI | COMPLETE |
| 3 | Phase 5 — Tasks UI (+ `Task` model drop in migration) | COMPLETE |
| 4 | Phase 3 — Reservations list UI → calendar-only surface | COMPLETE |
| 5 | Phase 4 — HOY / panel retarget to calendar | COMPLETE |
| 6 | Phase 6 — Finanzas UI (surface forms; calcs untouched) | COMPLETE |
| 7 | Phase 7 — Propiedades / default–quick messages UI | COMPLETE |
| 8 | Phase 8 — Dead refs, i18n, env | COMPLETE (this pass) |
| 9 | Phase 9 — Verification + final audit | COMPLETE (this pass) |

---

## What was removed

### Product routes & APIs
- `/inbox`, `/novedades`, `/ai-concierge`, `/tasks` (+ edit/new)
- `/reservations` list UI (proxy redirects legacy URLs → `/calendar`)
- Concierge HTTP APIs under `/api/concierge/**`

### Modules & features
- `extensions/pragma-ai-concierge/**`
- `src/modules/ai-concierge/**`
- `src/modules/assistant-platform/**` (incl. `default-message-templates`)
- `src/modules/digital-receptionist/**`
- `src/features/inbox/**`, `src/features/novedades/**`, `src/features/tasks/**`
- Inbox / Inbox-AI / Tasks / quick-messages services & UI
- Related components (`src/components/inbox/**`, concierge dashboard, quick-messages settings, etc.)

### Data (migration `20260726010000_drop_obsolete_modules`)
- Concierge / Assistant Platform / Inbox AI tables & enums
- Manual product `tasks` table + `TaskType` enum  
  (`AirbnbEmailTask` retained)

### Phase 8 hygiene (this pass)
- Dead i18n: `nav.reservations`, `nav.novedades`, top-level `inbox.*`  
  (**kept** `dashboard.novedades*` for HOY system notices sheet)
- `.env.example`: no `CONCIERGE_*`, `INBOX_*`, or `TASKS_*` (confirmed absent)
- `scripts/verify-permissions.mjs` aligned with current `permissions.ts` (no `/inbox` grant)

### Not renamed (optional, left as-is)
- `src/services/novedades/operational-feed.*` — still used by reservation activity / inquiry logic; folder rename deferred as non-blocking

---

## What was kept (SSOT)

- `Reservation` model, calendar, reservation drawer/detail, finance attribution
- Clerk auth / proxy / multi-tenant
- TTLock, iCal, PriceLabs, Wompi, SIRE, TRAA, guest registration
- `AirbnbEmailTask` + Airbnb email ingestion pipeline
- `ReservationActivity*` timeline
- `src/services/novedades/operational-feed.*` (message/policy helpers for activity)
- Finance calc libs under `src/lib/finance/**` and finance services (**untouched in this verification**)
- Dashboard system notices (`dashboard-novedades-sheet` + `dashboard.novedades*` i18n)

---

## Phase 8 reference sweep

Grep targets checked in live `src/` / `tests/` / scripts (docs audits left historical):

| Target | Result |
|--------|--------|
| Routes `/inbox`, `/novedades`, `/ai-concierge` as app surfaces | Removed; tests assert nav absence |
| `features/inbox`, `features/tasks`, `services/inbox-ai`, `modules/ai-concierge` | Deleted; no live imports |
| `quick-messages`, `default-message-templates` | Removed from product code |
| `db.task` | No call sites |
| `services/novedades/operational-feed.*` | Kept; imports valid |

No broken imports requiring code fixes beyond i18n / verify-permissions sync.

---

## Verification evidence

### Prisma
```text
npx prisma generate
→ ✔ Generated Prisma Client (v7.8.0)
```

### Typecheck
```text
npx tsc --noEmit
→ exit 0 (clean)
```

### Focused tests (`npx tsx --test …`)
| Suite | Result |
|-------|--------|
| `tests/navigation/main-navigation-order.test.ts` | PASS |
| `tests/rbac/permissions.test.ts` | PASS |
| `tests/finance/calculate-occupancy.test.ts` | PASS |
| `tests/finance/finance-month-attribution.test.ts` | PASS |
| `tests/finance/reservation-income-status.test.ts` | PASS |
| `tests/guests/canonical-guest-model.test.ts` | PASS |
| `tests/guests/guest-registration-capacity.test.ts` | PASS |

**Summary:** 24 tests, 7 suites, **0 failures**.

### Static RBAC script
```text
node scripts/verify-permissions.mjs
→ verify-permissions: ok
```

---

## Production gate

| Gate | Status |
|------|--------|
| `tsc --noEmit` clean | PASS |
| Critical nav / RBAC / finance / guest tests | PASS |
| Finance calc logic modified | NO |
| Auto-deploy | **FORBIDDEN** |
| Migration `20260726010000_drop_obsolete_modules` | **Pending owner-approved deploy apply** |

### Blockers
None for code readiness. Deploy blockers (process only):

1. Owner explicit approval to deploy  
2. Owner approval to run `prisma migrate deploy` including `20260726010000`  
3. Confirm production env no longer depends on `CONCIERGE_*` / dead inbox-ai keys (local `.env.local` may still contain legacy vars; they are unused)

---

## Deploy checklist (manual, owner-gated)

1. Review this audit + Phase 0 inventory  
2. Owner approves production deploy  
3. Apply migrations (must include `20260726010000_drop_obsolete_modules`)  
4. Smoke: `/panel`, `/calendar`, `/finance`, `/properties`, auth, guest-registration  
5. Confirm redirects: `/reservations*` → `/calendar`  
6. Confirm 404/redirect for removed `/inbox`, `/novedades`, `/tasks`, `/ai-concierge`

---

## Final status

**READY FOR PRODUCTION** — verification clean; **do not auto-deploy**; apply migration `20260726010000` only with owner approval.

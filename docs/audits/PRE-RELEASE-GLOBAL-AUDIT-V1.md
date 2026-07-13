# PRAGMA — Global Pre-Release Audit v1.0

**Date:** 2026-07-13  
**Scope:** Core · PMS · QR Mobility · INTIENDAS · Owner Dashboard · Auth · Billing · Integraciones · DB · Performance · Seguridad  
**Deploy:** Not performed (requires explicit owner approval)

---

## Executive verdict

| Gate | Result |
|------|--------|
| Architecture isolation (import) | **PASS** (cycle retail↔intel broken) |
| Prisma validate / generate | **PASS** |
| Typecheck | **PASS** |
| Build | **PASS** |
| INTIENDAS tests | **PASS** (20) |
| Key regression suite (52) | **PASS** |
| Airbnb iCal mass-cancel P0 | **FIXED** |
| Retail → PMS cross-entry | **MITIGATED** (retail-only gate) |
| Remaining WARN | Calendar `totalAmount` vs finance SSOT; cron incomplete fleet; inbound Airbnb blocks not persisted |

**READY FOR PILOT** with documented WARNs. Full production gate still needs owner go/no-go after reviewing open WARN items.

---

## Phase scorecard

| Phase | Area | Verdict | Notes |
|-------|------|---------|-------|
| 1 | Architecture | **PASS** | No Retail↔PMS, QR↔Retail, QR↔PMS business imports. Core `db`/`auth` clean. Shared `@/lib/retail/{money,codes}` breaks retail↔intel cycle. |
| 2 | Prisma | **PASS** | `prisma validate` OK; migrations up to date. |
| 3 | PMS | **PASS*** | Regression suite green; deep UAT not substituted. |
| 4 | Airbnb | **PASS** (P0 fixed) | Empty bookable feed no longer mass-cancels; sync timestamp withheld on suspicious feeds. |
| 5 | Inbox | **PASS** | OpenAI fetch now `AbortSignal.timeout(15_000)` + template fallback. |
| 6 | Finance | **WARN** | Finanzas SSOT solid; calendar may still show raw `totalAmount` for Airbnb placeholders. |
| 7 | QR Mobility | **PASS** | Domain isolation clean; owner-only mutations. |
| 8 | INTIENDAS | **PASS** | Hub label / priority / decorative icons cleaned; Abastecimiento RC intact. |
| 9 | Owner Dashboard | **PASS*** | Retail-only orgs excluded from commercial scope; impersonation lands on `/intiendas` when retail-only. |
| 10 | Security | **PASS*** | Retail-only redirected from PMS dashboard layout. Dual-product orgs (store + properties) still share identity by design. |
| 11 | Performance | **WARN** | Serial Airbnb cron / 120s `maxDuration` — incomplete fleet risk (not fixed this pass). |
| 12 | UX | **PASS** | Dead header icons removed; priority “Pronto”; hub “Centro de Abastecimiento”. |
| 13 | Full validation | **PASS** | See suite below. |

\* Mitigated with additive guards; full product discriminator on `Organization` remains architectural debt (documented, not schema-changed to avoid risk).

---

## Fixes applied this audit (additive / reversible)

1. **Domain cycle break** — `src/lib/retail/money.ts`, `src/lib/retail/codes.ts`; intel imports shared helpers; retail domain re-exports.
2. **iCal P0** — `isSuspiciousEmptyBookableIcalFeed` in `src/lib/airbnb/ical-sync-utils.ts`; sync service skips stale cancel + does not bump `lastIcalSyncedAt` when feed has 0 bookable events but local futures would be cancelled.
3. **Inbox AI timeout** — 15s abort on OpenAI generate.
4. **Retail → PMS fence** — `enforceTenantDashboardAccess` redirects retail-only orgs to `/intiendas/dashboard`.
5. **Owner commercial scope** — excludes retail-only org ids.
6. **Impersonation landing** — retail-only → `/intiendas/dashboard`.
7. **INTIENDAS UX** — hub label, priority “Pronto”, remove decorative Printer/Network.

---

## Open WARN (not blocking pilot; track for prod)

1. **Inbound Airbnb “Not available” blocks** never persisted → possible overbooking vs outbound export.
2. **Airbnb cron** serial + `ok: true` with per-owner errors → incomplete fleet can look healthy.
3. **Calendar revenue display** vs Finanzas SSOT for Airbnb placeholders (`totalAmount: 0`).
4. **Organization product discriminator** absent — dual-product orgs intentionally allowed; retail-only is gated.
5. **QR isolation test** — no automated import fence equivalent to INTIENDAS (manual PASS).

---

## Validation evidence

```
prisma validate                         PASS
npx tsx --test (intiendas + integrity +
  owner-scope + qr + inbox-ai)          52/52 PASS
npm run typecheck                       PASS
npm run build                           PASS
```

---

## Deploy

**Do not deploy** until the owner explicitly approves. This document does not constitute production authorization.

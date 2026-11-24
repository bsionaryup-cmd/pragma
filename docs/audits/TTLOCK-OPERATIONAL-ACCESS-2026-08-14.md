# OCP Phase Deliverable — TTLock Operational Access

**Date:** 2026-08-14  
**Domain state:** IN_PROGRESS — deployed, controlled live-lock smoke pending  
**Baseline ref:** `docs/ocp/baselines/ttlock-operational-access-20260814.md`  
**Commit:** pending owner request

## 1. Objetivo

Create and revoke TTLock passcodes for a selected property, label, access type,
and explicit Colombia date/time window without a reservation.

## 2. Alcance

### In scope

- Property-scoped operational passcodes.
- Random PIN or owner-selected TTLock-compatible PIN (4–9 digits).
- Cleaner, maintenance, owner, and visitor labels.
- TTLock add/delete, encrypted PIN storage, idempotency, audit events.
- Smart Access create/list/copy/revoke UI.
- Automated expiry cleanup.

### Out of scope

- Guest Registration, Stay Portal, reservation email sequence.
- Reservation credential schema or lifecycle.
- Creation of a real pilot PIN without an owner-selected property/window.

## 3. Baseline

| Metric / behavior | Before | Source |
|---|---:|---|
| Relevant tests | 5/5 PASS | TTLock integrity + guest message |
| Typecheck | PASS | `npm run typecheck` |
| Reservation-independent credentials | 0 | Schema/source audit |
| Operational UI/actions | Absent | Smart Access audit |

## 4. Auditoría inicial

- `AccessCredential.reservationId` is required and all guest services assume a
  reservation.
- TTLock add/change/delete clients, session resolution, encryption, tenant
  scopes, and event storage are reusable.
- The TTLock cron comment promised 5–10 minute polling while `vercel.json`
  scheduled it once daily.

## 5. Hallazgos

| ID | Severity | Description | Resolution |
|---|---|---|---|
| H1 | P0 | Reusing `AccessCredential` would contaminate guest flows | Separate model |
| H2 | P0 | Local-only/phantom PIN risk | Fail closed; persist GENERATED only after `keyboardPwdId` |
| H3 | P1 | Mutations require property tenant scope | `access:manage` + `propertyWhere(scope)` |
| H4 | P1 | Daily cleanup is unsuitable for short codes | TTLock cron every 10 minutes |
| H5 | P1 | Duplicate submit could create duplicate PINs | Unique idempotency claim |
| H6 | P1 | API succeeds but DB persist fails | Compensating TTLock delete |

## 6. Archivos modificados

- Prisma model + additive migration.
- New operational schema, service, server actions, and Smart Access panel.
- Smart Access page composition.
- TTLock scheduler and Vercel cron frequency.
- Regression tests, baseline, registry, and this report.

## 7. Justificación técnica

The implementation reuses only the stable TTLock infrastructure boundary. It
does not call `generateAccessCodeForReservation`, does not schedule guest
emails, and does not add nullable reservation semantics to existing models.

Overlapping windows are intentionally allowed: a cleaner/technician may need
access while a guest or another authorized worker has a different valid PIN.
TTLock independently enforces every PIN's own validity window.

## 8. Evidencia

```text
Audit → separate model/service → tenant-scoped actions → isolated UI
      → expiry cron → typecheck/tests/build → re-audit
```

## 9. Benchmark antes/después

| Metric | Before | After | PASS |
|---|---:|---:|---|
| Relevant automated tests | 5 | 16 | YES |
| TTLock cleanup frequency | 1/day | every 10 min | YES |
| Added build routes | 0 | 0 | YES |
| Existing generated pages | 125/126 historical | 126/126 | YES |

## 10. Replay

```powershell
npx tsx --test tests/ttlock/access-code-integrity.test.ts tests/ttlock/operational-access.test.ts tests/access/access-code-guest-message.test.ts tests/guests/guest-registration-completion-comms.test.ts
```

- Tests: 16
- Failures: 0
- Guest Registration sequence contract: PASS
- Guest TTLock integrity contract: PASS

## 11. Comparación antes/después

| Behavior | Before | After |
|---|---|---|
| Operational PIN | TTLock app required | PRAGMA Smart Access |
| Reservation dependency | Mandatory | None for operational PINs |
| Validity window | Stay dates | Explicit Colombia date/time |
| Revoke | TTLock app | PRAGMA |
| Guest flow | Existing | Unchanged |

## 12. Riesgos

- Live TTLock behavior cannot be certified before migration deploy and one
  controlled lock pilot.
- A process crash in the narrow API-success/DB-write interval can require
  forensic cleanup; the normal DB failure path performs compensation.
- Production migration order must precede application traffic using the model.

## 13. Mitigaciones

- Additive migration only; no destructive schema change.
- API fail-closed and encrypted PINs.
- Unique idempotency key and no PIN in audit payloads.
- Remote delete before revoke/expire state transition.
- Tenant-scoped reads and writes.
- Cron removes expired PINs; TTLock itself rejects them at `validTo`.

## 14. Pruebas ejecutadas

| Command | Result |
|---|---|
| `npx prisma validate` | PASS |
| `npm run typecheck` | PASS |
| Relevant 16-test replay | PASS |
| IDE lints | 0 errors |
| `npm run verify:release` | PASS, 40/40 release tests |
| `npm run build` | PASS, 126/126 pages |
| `git diff --check` | PASS |
| Production migration `20260815020000_ttlock_operational_access` | PASS |
| Vercel production `dpl_BdqFU7U35fsuhKGxZerJohRDSRyX` | READY |
| Production table probe | PASS |
| Anonymous `/smart-access` auth guard | PASS, 307 to `/login` |

## 15. Reauditoría

| Question | Result |
|---|---|
| Does it modify reservation credentials? | NO |
| Can it create a local fake PIN? | NO |
| Can another tenant access a property/PIN? | Blocked by property scope |
| Are duplicate submissions idempotent? | YES |
| Are PIN values written to logs/events? | NO |
| Does expiry stop hardware access? | TTLock validity window + cleanup cron |
| Are guest emails or Stay Portal invoked? | NO |

## 16. Declaración de Certificación

- [x] Audit PASS
- [x] Measurement PASS
- [x] Implementation PASS
- [x] Replay PASS
- [x] Re-audit PASS
- [ ] Live lock smoke (requires deploy)
- [x] Build PASS
- [x] 0 detected regressions

**CERTIFIED:** NO — code and database are deployed; final live certification is
intentionally blocked until an owner creates and revokes one controlled TTLock
pilot PIN from `/smart-access`.

## 17. Declaración de Congelamiento

Not frozen until live certification.

Proposed protected files after certification:

- `ttlock-operational-access.service.ts`
- `operational-access.schema.ts`
- `operational-access.actions.ts`
- `operational-access-panel.tsx`

## 18. Commit certificado

Pending explicit owner request. Rollback before commit: revert only the files
listed in this deliverable; the migration is additive.


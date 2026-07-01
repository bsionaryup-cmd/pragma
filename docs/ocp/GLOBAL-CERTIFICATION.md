# OCP Global Certification — Phases 7–9

**Date:** 2026-06-17  
**Deploy:** PENDING owner approval (localhost review)

## Phase 7 — Global Replay

```bash
npx tsx scripts/_replay-enrichment-edge-case-fix.mjs
```

| Case | PASS |
|------|------|
| Dennis | ✓ |
| Jared | ✓ |
| Diego | ✓ |
| Alexander | ✓ |
| Marta | ✓ |
| Margarita | ✓ |

**regressionCount: 0**

## Phase 8 — Global Audit

| Question | Answer | Evidence |
|----------|--------|----------|
| Guest Total as **ingreso** in services? | **NO** | Phase 1 resolver; panel detail labels guest paid separately |
| Module changes **titular** on registration? | **NO** | Phase 2; grep `guestName` in guest-registration.service |
| Form exceeds reservation capacity? | **NO** | Phase 3; maxCapacity from service |
| Redundant default messages? | **NO** | Phase 4 tests |
| Consumer ignores Financial Resolver (aggregations)? | **NO** | Phase 1 |
| Local financial **revenue** calc in migrated modules? | **NO** | SSOT inventory |

## Phase 9 — Domain States

| Domain | State | Commit |
|--------|-------|--------|
| Financial read | FROZEN | `3f459f6` |
| Reservation holder | FROZEN | see registry |
| Guest registration | FROZEN | see registry |
| Default messages | FROZEN | see registry |
| UI financial (detail) | FROZEN | see registry |
| Fallback write | FROZEN (maintain) | docs only |

## Test matrix (all PASS)

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run test:airbnb-email` | 160 PASS |
| `npm run verify:release` | PASS |
| OCP unit suites (guests, messages, finance, novedades) | 64+ PASS |

## Phase 10 — Deploy

**Blocked** until owner approves after localhost verification.

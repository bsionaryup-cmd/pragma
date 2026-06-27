# Regression Validation Report

**Date:** 2026-06-17  
**Environment:** Local dev, Windows 10, Node via npm scripts

---

## Commands Executed

| Command | Result | Details |
|---------|--------|---------|
| `npm run typecheck` | ✅ PASS | 0 errors (after `monthly-finance-metrics.test.ts` fixture fix) |
| `npm run verify:release` | ✅ PASS | RBAC matrix + typecheck + `test:billing` |
| `npm run test:billing` | ✅ PASS | 37/37 tests |
| `npm run test:airbnb-email` | ✅ PASS | Full airbnb-email suite |
| Combined finance/novedades/navigation | ✅ PASS | 98/98 tests |

**Combined run command:**
```
npx tsx --test tests/finance/*.test.ts tests/novedades/*.test.ts tests/navigation/*.test.ts tests/reservation-revenue-amount.test.ts
```

---

## Tests Covering Remediation

| Fix area | Test files |
|----------|------------|
| Match policy / enrichment | `safe-reservation-enrichment.test.ts`, `contextual-match.test.ts`, `airbnb-email-hardening.test.ts` |
| Revenue $0 fallback | `reservation-revenue-amount.test.ts` |
| Inbox consolidation | `inbox-history-consolidation.test.ts` |
| Monthly finance alignment | `monthly-finance-metrics.test.ts` |
| Novedades feed | `operational-feed.test.ts`, `novedades-smart-actions.test.ts` |
| RBAC | `permissions.test.ts`, `reservation-mutation-policy.test.ts` |
| Navigation (no prospecting) | `main-navigation-order.test.ts` |
| Billing security | `tests/billing/*`, `tests/payments/*` |

---

## Not Executed (Recommended Pre-Deploy)

| Check | Reason |
|-------|--------|
| `npm run build` | verify:release suggests as next step |
| `npm run validate:ical` | iCal export/sync smoke |
| `npm run validate:ttlock-callback` | TTLock callback smoke |
| Live pilot tenant DB audit | Requires production/staging credentials + read-only scripts |
| Browser E2E (novedades, finance, tasks) | No automated Playwright suite in stabilization scope |

---

## Regressions Found

**None** in executed suites after P1 completion.

---

## Regression Conclusion

Code-level regression risk is **low** for remediated areas. Build + staging smoke remain as standard release gates.

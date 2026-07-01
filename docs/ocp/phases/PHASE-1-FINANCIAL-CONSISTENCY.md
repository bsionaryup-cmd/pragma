# OCP Phase 1 — Financial Consistency (Read Path)

**Date:** 2026-06-17  
**State:** CERTIFIED → FROZEN (pending commit SHA)  
**Baseline:** `docs/ocp/baselines/financial-consistency-read-20260617.md`

---

## 1. Objetivo

Unificar el **consumo de ingreso contable** (ingreso anfitrión) en todos los agregadores y etiquetas de servicio, usando exclusivamente `resolveFinanceReservationRevenueAmount()` como SSOT de lectura. No modificar escritura enrichment.

---

## 2. Auditoría inicial

Grep + inventario SSOT (`docs/stabilization/04-single-source-of-truth-inventory.md`).

**Violaciones encontradas (4):**

| ID | Archivo | Patrón incorrecto |
|----|---------|---------------------|
| H1 | `owner-dashboard.service.ts` | `_sum.totalAmount` en detalle tenant |
| H2 | `property.service.ts` | `sumMonthRevenue` sin resolver |
| H3 | `operational-feed.mappers.ts` | CONFIRMED usa `totalAmount` crudo |
| H4 | `inbox-context.engine.ts` | `totalAmountLabel` desde `totalAmount` |

**Ya conformes:** `finance.service.ts`, `monthly-finance-calc.ts`, `command-center.service.ts`, `novedades-inbox.service.ts`, `novedades-timeline.service.ts`, owner list analytics.

---

## 3. Hallazgos

- Los gaps eran de **lectura** en rutas secundarias (owner detail, property month, feed CONFIRMED, inbox AI context).
- Ningún gap requería cambio de schema ni de escritura.
- `fallbackGross` en pilot: **0/11** eventos CONFIRMED — evidencia para Phase 6, no acción en Phase 1.

---

## 4. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/services/platform/owner-dashboard.service.ts` | `sumOrganizationReservationRevenue()` con resolver |
| `src/services/properties/property.service.ts` | `monthRevenue` + `loadReservationRevenueSources` |
| `src/features/properties/lib/property-stats.ts` | `sumMonthRevenue` callback opcional |
| `src/services/novedades/operational-feed.mappers.ts` | CONFIRMED amount vía resolver |
| `src/services/inbox-ai/inbox-context.engine.ts` | `totalAmountLabel` vía resolver |
| `tests/novedades/operational-feed.test.ts` | Fixture `platform`/`icalUid` |
| `scripts/_audit-fallback-gross-readonly.mjs` | Script medición read-only |

**No incluidos en este commit:** Phase 2–5 files (holder, capacity, UI panel).

---

## 5. Justificación técnica

Cada cambio migra un consumidor al wrapper existente `resolveReservationFinanceRevenueForDisplay()` + `loadReservationRevenueSourcesByReservationId()`, patrón ya validado en Finanzas y Novedades. Implementación mínima: sin nuevo resolver, sin tocar SSOT core.

---

## 6. Evidencia

```
Auditoría (4 gaps) → Medición (fallbackGross=0) → Implementación (4 fixes) → Tests PASS → Replay 0 regresiones
```

**Medición fallbackGross:**

```json
{ "total": 11, "bySource": { "hostPayout": 11, "fallbackGross": 0 } }
```

---

## 7. Benchmarks

| Métrica | Antes | Después | Notas |
|---------|-------|---------|-------|
| Consultas extra por owner detail | 0 | +1 batch email sources | Aceptable; mismo patrón que list analytics |
| Consultas property detail month | 0 | +1 batch | Idem |
| Tiempo build | ~140s | ~140s | Sin regresión (build previo PASS) |
| CPU hot path | N/A | N/A | Sin cambio en cron/parser |

---

## 8. Replay

```bash
npx tsx scripts/_replay-enrichment-edge-case-fix.mjs
```

- **regressionCount:** 0  
- Casos: Jared, Diego, Margarita, Marta, Alexander, Dennis — todos PASS

---

## 9. Comparación Antes / Después

| Comportamiento | Antes | Después |
|----------------|-------|---------|
| Owner tenant `reservationRevenueCop` | SUM(totalAmount) | SUM(resolver) |
| Property `monthRevenue` | totalAmount crudo | resolver por reserva |
| Feed tarjeta nueva reserva | totalAmount | ingreso anfitrión |
| Inbox AI context amount | totalAmount | resolver |
| Escritura enrichment | Sin cambio | Sin cambio |
| UI detalle reserva | Sin cambio en Fase 1 | Phase 5 pendiente |

---

## 10. Riesgos

| Riesgo | Nivel | Mitigación |
|--------|-------|------------|
| Reservas sin email traceable → $0 en agregado | Bajo | Mismo comportamiento que Finanzas module |
| Batch load N+1 | Bajo | `loadReservationRevenueSourcesByReservationId` ya batched |

---

## 11. Mitigaciones

- Reutilizar loader centralizado existente.
- Tests de resolver sin cambios (9 tests PASS).
- Rollback: `git revert <commit-phase-1>`.

---

## 12. Pruebas ejecutadas

| Comando | Resultado |
|---------|-----------|
| `npx tsx --test tests/reservation-revenue-amount.test.ts` | PASS (9) |
| `npx tsx --test tests/novedades/operational-feed.test.ts` | PASS |
| `npx tsx --test tests/finance/*.test.ts` | PASS |
| `npm run build` | PASS (sesión anterior) |
| Replay script | PASS, 0 regresiones |

---

## 13. Reauditoría

| Pregunta | Respuesta | Evidencia |
|----------|-----------|-----------|
| ¿Consumidor de ingreso ignora SSOT en **servicios**? | **NO** (Fase 1 scope) | grep post-fix |
| ¿Guest Total como ingreso en agregadores? | **NO** | resolver prioriza hostPayout |
| ¿Cálculo local de ingreso en servicios migrados? | **NO** | usan resolver |
| ¿UI panel/list aún raw? | Sí — **Phase 5** | documentado out-of-scope |

---

## 14. Declaración de Certificación

- [x] Auditoría PASS  
- [x] Medición PASS  
- [x] Implementación PASS  
- [x] Replay PASS  
- [x] Reauditoría PASS (scope servicios)  
- [x] 0 regresiones replay  
- [ ] Smoke manual post-deploy — pendiente Fase 10  
- [ ] Benchmark formal CPU — N/A sin cambio hot path  

**CERTIFIED:** YES (OCP Phase 1 read path)

---

## 15. Declaración de Congelamiento

**Archivos protegidos (FROZEN):**

- `src/lib/finance/reservation-revenue-amount.ts` (SSOT core)
- `src/services/finance/reservation-revenue-context.service.ts`
- Consumidores migrados en esta fase (ver §4)

**Reapertura:** bug reproducible o cambio de negocio aprobado.

**Commit:** `cert(ocp): phase-1 financial read path — unify SSOT consumers`

**Rollback:** `git revert <SHA>`

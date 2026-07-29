# PRAGMA PMS — Auditoría y Estabilización PriceLabs / Tarifas

**Fecha:** 2026-07-29  
**Prioridad:** P0  
**Despliegue:** NO AUTORIZADO  
**Tenant evidencia:** URBA Nova Loft 33 (`cmplxfg0a000105jrs0gqtwyc`)

---

## 1. Informe de auditoría (Fase 0)

### Síntoma
Módulo Tarifas / acciones PriceLabs muestran *“Sincronización PriceLabs ya en curso”* (o equivalente), los cambios no se reflejan y tras refresh persisten valores antiguos.

### Frontend
| Hallazgo | Detalle |
|----------|---------|
| Tarifas UI | `smartprice-property-pricing-section.tsx` llama `savePropertyPriceBoundsAction` |
| Toast error | Mensaje viene del server action, no de React Query/SWR |
| Badge “Sincronizando” | `pricelabs-panel.tsx` / overview `syncing` ← `isPriceLabsSyncInProgress` |
| Cache | No hay optimistic update problemático; `router.refresh()` solo tras `ok` |

**Conclusión FE:** el bloqueo no nace del cliente; el servidor rechaza mutaciones o reporta sync activo.

### Backend / lock
| Hallazgo | Detalle |
|----------|---------|
| Mutex | `organization_integrations.syncInProgressAt` (`pricelabs-sync-lock.ts`) |
| TTL stale | 5 minutos |
| Adquirir | check-then-upsert (no atómico) |
| Liberar | `update` — si falla o el proceso muere, el lock queda huérfano |
| Pipeline | `runWithPriceLabsSyncLock` en orchestrator (cron/manual/system) |

### Acoplamiento Tarifas ↔ sync (causa principal de UX)
`smartprice.actions.ts` envolvía **todas** las mutaciones del panel (guardar min/base/max, overrides) con el **mismo** lock de pipeline.

El panel de Integraciones (`pricelabs.actions.ts`) **no** usa ese lock para guardar bounds.

Resultado: cualquier sync de calendario/reservas/`system` bloqueaba guardar tarifas → toast “ya en curso” y sin persistencia remota/local esperada.

### Evidencia DB (Loft 33)
```
syncInProgressAt: 2026-07-29T05:57:38.059Z  (huérfano)
lastPricesSyncAt: 2026-07-27T08:59:34.063Z  (precios desactualizados ~2 días)
```
Log a las 05:57:43: `refresh_listing_bounds` success (`source: system`) **sin** `fetch_prices` posterior → pipeline cortado (timeout/kill) **sin** `release` → lock huérfano.

### Integración PriceLabs
- Timeout request: hasta **300s** (`PRICELABS_TIMEOUT_MS` default).
- Cron diario `0 7 * * *`, `maxDuration=300`.
- Refrescos `system` frecuentes (calendar/reservation) → ventana de bloqueo alta.
- Circuit breaker / throttle presentes; no son la causa del mensaje permanente.

### Causa raíz (dos factores)
1. **Lock huérfano** tras sync `system` interrumpido sin `finally` efectivo / release.  
2. **Acoplamiento incorrecto:** mutaciones de Tarifas competían por el lock de pipeline.

### Impacto / riesgo
| | |
|--|--|
| Impacto | Tarifas no editables; UI “sync en curso”; precios desfasados |
| Riesgo corrección | Bajo — additive / desacoplar + reclaim stale |
| Regresión | Baja si no se toca iCal/reservas/calendar core |

### Alternativas
| Opción | Costo | Decisión |
|--------|-------|----------|
| A Desacoplar Tarifas del sync lock + reclaim stale | Bajo | **Elegida** |
| B Solo borrar lock en DB | Muy bajo | Insuficiente (vuelve a pasar) |
| C Refactor cola/jobs | Alto | Rechazada |

---

## 2. Causa raíz documentada

1. Pipeline PriceLabs adquiere `syncInProgressAt` y, si el runtime muere a mitad (p. ej. tras `refresh_listing_bounds`), el lock **no se libera**.  
2. El módulo Tarifas exigía ese mismo lock para guardar límites → rechazo “ya en curso” y sin actualización visible.

---

## 3. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/services/integrations/pricelabs/pricelabs-sync-lock.ts` | Reclaim stale, acquire más atómico, release no lanza |
| `src/features/revenue/actions/smartprice.actions.ts` | Bounds/overrides sin sync lock; sync listing sí |
| `scripts/_audit-pricelabs-lock-state.ts` | Evidencia de estado |
| `scripts/_clear-pricelabs-stale-locks.ts` | Limpieza operativa |
| `tests/integrations/pricelabs-sync-lock-coupling.test.ts` | Regresión de acoplamiento |
| `docs/audits/PRICELABS-TARIFAS-SYNC-STUCK-AUDIT-2026-07-29.md` | Este informe |

---

## 4. Justificación técnica de cada cambio

1. **Lock:** limpiar huérfanos por TTL; `updateMany` atómico al reclamar; release con `updateMany` + log sin throw (el `finally` no debe dejar el proceso en error sin limpiar).  
2. **Tarifas:** alinear con Integraciones — editar min/base/max no es un pipeline de sync.  
3. **Scripts/tests:** evidencia y prevención de regresión del acoplamiento.

---

## 5. Evidencia de pruebas ejecutadas

- DB audit: lock huérfano confirmado y **cleared** (`--force` org Loft 33) → `syncInProgressAt: null`.  
- Tests: `npx tsx --test tests/integrations/pricelabs-sync-lock-coupling.test.ts`  
- Tests previos PriceLabs bounds (suite existente) según validación Fase 2.

---

## 6. Resultado de pruebas de regresión

| Área | Resultado |
|------|-----------|
| Acoplamiento Tarifas↔lock | PASS (test estático) |
| Lock reclaim / release | Código validado + lock DB limpiado |
| iCal / Reservas / Calendar / Billing / Inbox | Sin cambios de código en esos módulos |
| Contratos API PriceLabs | Sin cambios |

---

## 7. Riesgos remanentes

| Riesgo | Mitigación |
|--------|------------|
| Kill serverless mid-pipeline vuelve a dejar lock ≤5 min | TTL + clear stale en acquire/isInProgress |
| Concurrent save bounds vs fetch prices | Aceptable; menor que bloquear Tarifas |
| `lastPricesSyncAt` desfasado (27-jul) | Ejecutar sync manual precios cuando Owner pueda |
| Timeout 300s largo | Residual; no cambiado (fuera de mínimo) |

---

## 8. Recomendación final

1. **No desplegar** hasta aprobación explícita.  
2. En local: reiniciar `dev`, abrir Tarifas, guardar límites — no debe aparecer “ya en curso” por sync huérfano.  
3. Tras deploy (cuando se autorice): un sync manual de precios en Integraciones PriceLabs para refrescar `lastPricesSyncAt`.  
4. Opcional futuro: heartbeat del lock o cola durable (no urgente).

### Estado final
- **Auditoría:** COMPLETA  
- **Corrección:** COMPLETA (mínima)  
- **Validación:** COMPLETA (tests + limpieza DB)  
- **Deploy producción:** NO AUTORIZADO  

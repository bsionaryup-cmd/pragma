# Auditoría Integral de Estabilidad, Rendimiento y Producción

**Fecha:** 2026-07-27  
**Alcance:** PRAGMA PMS completo (sin features nuevas)  
**Entorno objetivo:** Producción (`www.pragmapms.com` / Vercel + Neon + Clerk)

---

## Veredicto ejecutivo

La plataforma **opera**, pero **no está lista para “24/7 sin interrupciones”** con el nivel de riesgo actual.

- **Críticos abiertos (código corregido en esta pasada):** firma Wompi incorrecta, ePayco return confiable en cliente.
- **Críticos abiertos (requieren plan/ops o schema — no desplegados aquí):** Vercel Hobby = 1 cron/día, carrera de overbooking sin lock transaccional, índice `reservationCode` ausente.
- **Observabilidad externa (Sentry/Datadog/uptime multi-vendor):** ausente o insuficiente frente al estándar pedido.

Esta auditoría **documenta**, **clasifica riesgos**, **corrige lo crítico seguro en código**, y deja un backlog priorizado.

---

## Correcciones implementadas (esta pasada)

| ID | Riesgo | Corrección | Evidencia |
|----|--------|------------|-----------|
| SEC-01 | Crítico | ePayco return ya **no** aprueba por `x_cod_response` del cliente; solo `ref_payco` vía API | `payment.service.ts` `tryReconcileEpaycoReturn` |
| SEC-02 | Crítico | Checksum Wompi alineado a docs oficiales (`properties` + `timestamp` + secret) | `wompi.signature.ts` + `tests/billing/wompi-signature.test.ts` 3/3 |
| OPS-01 | Alto | Reconciliación guest payment: try/catch **por link** (no aborta flota) | `guest-payment-reconcile.service.ts` |
| SEC-03 | Alto | Cron auth compartido: en producción **solo Bearer** (sin `?secret=`) | `src/lib/cron-auth.ts` + 8 rutas cron |
| SEC-04 | Alto | TTLock OAuth: fail-closed en prod sin secreto fuerte | `ttlock-oauth-state.ts` |
| OPS-02 | Alto | Outbox retail: reclaim de filas `PROCESSING` stuck | `worker.service.ts` `drainIntelOutbox` |

### Validaciones ejecutadas

| Check | Resultado |
|-------|-----------|
| `tests/billing/wompi-signature.test.ts` | 3/3 PASS |
| Typecheck (src; limpiar stubs `.next` prospecting huérfanos) | Sin errores de fuente en cambios |

**Deploy:** no ejecutado en esta pasada hasta confirmación del owner (OCP + criterio “todas las validaciones”). Los cambios de pagos/webhooks requieren smoke controlado en prod.

---

## Inventario de automatización (prod)

| Cron | Schedule UTC | Notas |
|------|--------------|-------|
| billing-renewal | `0 6 * * *` | Sin `maxDuration`; flota sin aislamiento por cuenta |
| airbnb-ical-sync | `15 6 * * *` | 120s; serial por owner |
| airbnb-email-enrichment-retry | `30 6 * * *` | Comentarios dicen 5 min — realidad diaria |
| airbnb-email-inbound-reconcile | `35 6 * * *` | `ok:true` con fallos parciales posibles |
| guest-payment-reconcile | `45 6 * * *` | Comentarios 10–15 min — realidad diaria |
| pricelabs-sync | `0 7 * * *` | `ok` si ≥1 org OK |
| ttlock-sync | `15 7 * * *` | Heartbeat + purge 40; no sync de estado remoto |
| retail-intel-outbox | `0 8 * * *` | Safety net; reclaim añadido |

**SPOF cadence:** Vercel Hobby → ventana de catch-up hasta ~24h para pagos/email/iCal si fallan webhooks/auto-sync.

---

## Registro de riesgos (residual)

### Crítico

| ID | Hallazgo | Impacto | Prob. | Mitigación |
|----|----------|---------|-------|------------|
| R-C1 | Cadencia diaria Hobby vs expectativa near-real-time | Pagos/email/iCal retrasados | Alta | Upgrade Vercel Pro + crons sub-horarios **o** documentar SLA 24h + alertas de lag |
| R-C2 | Overlap de reservas fuera de transacción / sin advisory lock | Double-booking | Media | `$transaction` + `pg_advisory_xact_lock(propertyId)` |
| R-C3 *(mitigado en código)* | ePayco client-trusted return | Billing falso | — | Corregido; falta deploy + smoke |
| R-C4 *(mitigado en código)* | Wompi checksum ≠ docs | Webhooks inválidos / fallback débil | — | Corregido; falta deploy + evento real |

### Alto

| ID | Hallazgo | Mitigación |
|----|----------|------------|
| R-H1 | Sin índice `Reservation.reservationCode` (lookup público) | Migration index + normalizar uppercase |
| R-H2 | Tokens GR sin TTL / expiry no enforced | TTL + enforce en writes |
| R-H3 | Rate limits in-memory (Stay/GR/webhooks) | Redis/Upstash o WAF |
| R-H4 | Billing renewal sin isolation por cuenta | try/catch por account + `maxDuration` |
| R-H5 | iCal sync lock solo in-process | Advisory lock DB por property |
| R-H6 | AccessCredential sin unicidad ACTIVE | Partial unique + transacción |
| R-H7 | StayPortalToken ACTIVE TOCTOU | Partial unique `(reservationId) WHERE ACTIVE` |
| R-H8 | Sin alertas externas multi-vendor | Sentry + Uptime (Vercel/Neon/Clerk/Wompi/Resend) |
| R-H9 | TTLock cron = heartbeat, no health real | Mapear payload lock-list o documentar |

### Medio / Bajo (resumen)

- Enrichment email triplicado en ventana 06:15–06:35  
- `ok:true` engañoso en varios crons  
- Pool Prisma default 5  
- Migration timestamp duplicado `20260524120000` (historial)  
- IDOR potencial sesión ePayco guest para usuario autenticado  
- Export iCal con PII de huésped  

---

## Observabilidad y monitoreo

| Capacidad | Estado |
|-----------|--------|
| Logs estructurados (iCal, retail intel) | Parcial |
| Platform health UI (`/owner-dashboard/salud`) | Presente |
| Dashboard alerts (sync/GR) | Presente |
| Sentry / Datadog / APM | No evidenciado en repo |
| Uptime sintético Vercel/Neon/Clerk/Wompi/Resend/TTLock | No evidenciado |
| Alertas cron 5xx / `failed > 0` | No automatizadas |

**Brecha vs objetivo:** “detectar problemas antes que los usuarios” requiere alertas externas + métricas de lag de reconcile.

---

## Recuperación

| Tema | Estado |
|------|--------|
| Neon backups | Dependencia del plan Neon (ops) — verificar PITR en consola |
| Rollback Vercel | Deployments previos promovibles |
| Rollback datos | Migraciones drop irreversibles documentadas |
| Outbox reclaim | Mejorado en código |

---

## Criterios de aceptación (checklist)

| Criterio | Estado |
|----------|--------|
| No riesgos críticos abiertos | **NO** — R-C1, R-C2 abiertos; R-C3/C4 corregidos pendientes de deploy |
| Sin regresiones detectadas en tests tocados | PASS (Wompi) |
| Integraciones funcionando | Parcial — Wompi firma ahora correcta en código; validar evento real post-deploy |
| Procesos automáticos sin error | Parcial — aislamiento guest payment; billing/iCal aún frágiles |
| Rendimiento estable | Gap índices + N+1 iCal |
| Disponibilidad continua | Limitada por Hobby + SPOFs |
| Integridad de datos | Riesgo double-book abierto |
| Informe final con evidencia | **Este documento** + canvas |

---

## Próximos pasos recomendados (orden)

1. **Owner:** aprobar deploy de correcciones SEC/OPS de esta pasada + smoke Wompi/ePayco.  
2. **Ops:** Vercel Pro o scheduler externo para `guest-payment-reconcile` + email reconcile.  
3. **Schema (fase dedicada):** index `reservationCode`, `holdExpiresAt`, `AccessCredential(status,validTo)`, uniques parciales ACTIVE.  
4. **Código:** overlap lock transaccional; isolation billing/iCal.  
5. **Observabilidad:** Sentry + uptime checks + alertas cron.  

---

## Fuentes de evidencia

- Exploración automatizada: crons/workers, seguridad, DB/Prisma (2026-07-27)  
- `vercel.json`, `src/lib/db.ts`, módulos billing/TTLock/iCal/payments  
- Tests: `tests/billing/wompi-signature.test.ts`

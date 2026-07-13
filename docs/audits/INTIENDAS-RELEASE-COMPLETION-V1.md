# PRAGMA INTIENDAS — Release Completion Protocol Report

**Date:** 2026-07-13  
**Protocol:** Release Completion Protocol v1.0  
**Product version:** `1.2.2`  
**Deploy history:** Already live for technical validation; this pass adds observability + event-driven drain + Owner Health Check.

---

## Problema

Hobby limit forzó cron diario; el protocolo exige no depender solo de cron para Inventory Intelligence, más observabilidad y panel Owner PASS/WARN/FAIL.

## Causa raíz

Procesamiento intel = enqueue in-TX + drain solo en Pedidos/cron diario. Sin panel de salud de plataforma. Sin logs estructurados de worker.

## Riesgo

- Aumentar frecuencia cron → bloquea Hobby.
- Drain síncrono en POS → latencia de venta.
- Nuevos modelos Core → riesgo PMS.

## Alternativas

1. Cron horario → rechazada (Hobby).  
2. `await drain` en cada venta → más simple pero lenta.  
3. **`after(() => drain)` post-commit + cron safety net + Owner Salud** → elegida.

## Solución elegida

| Capacidad | Implementación |
|-----------|----------------|
| Eventos → worker | `scheduleIntelOutboxDrain()` vía `next/server` `after()` tras venta/compra/stock/traslado |
| Cron | Diario 08:00 UTC permanece como red de seguridad |
| Observabilidad | `logIntelObs` JSON en worker/cron (`scope: retail-intel`) |
| Health Check Owner | `/owner-dashboard/salud` (solo `requirePlatformOwnerUser`) |
| Aislamiento | Sin cambios PMS/QR business; retail → intel sin PMS |

## Archivos principales

- `src/domains/retail-intelligence/services/schedule-drain.ts`
- `src/domains/retail-intelligence/services/observability.ts`
- `src/domains/retail/actions/retail.actions.ts`, `sale.actions.ts`
- `src/services/platform/platform-health*.ts`
- `src/app/(owner)/owner-dashboard/salud/page.tsx`
- `src/components/owner/owner-health-check-view.tsx`
- `src/components/owner/owner-shell-header.tsx` (nav Salud)

## Validaciones (evidencia)

| Check | Resultado |
|-------|-----------|
| Prisma Validate | **PASS** |
| Typecheck | **PASS** |
| Build | **PASS** |
| Unit/arch tests (intiendas+health+qr) | **PASS** 31+ |
| Architecture / Import audit | **PASS** |
| Security (Owner-only health) | **PASS** |
| Observability | **PASS** (logs + outbox + panel) |
| Health Check feature | **PASS** (código + tests clasificadores) |
| Pilot Checklist (manual PO) | **PENDING** — no sustituible por auto |

## Criterios de aprobación del protocolo

| Criterio | Estado |
|----------|--------|
| Arquitectura | **PASS** |
| Core / PMS / QR / Retail isolation | **PASS** |
| Inventory Intelligence (event+worker+cron) | **PASS** técnico |
| Pruebas automáticas | **PASS** |
| Performance | **PASS** (drain no bloquea TX; `after`) |
| Seguridad | **PASS** |
| Observabilidad | **PASS** |
| Health Check | **PASS** |
| Pilot Checklist | **PENDING PO** |
| Sin regresiones auto | **PASS** |

## Estado oficial

```
FEATURE COMPLETE
→ RELEASE CANDIDATE
→ PILOT READY (técnico)
→ PILOT COMPLETED          ← pendiente firma Product Owner
→ PRODUCTION CERTIFIED     ← bloqueado hasta Pilot PASS
→ READY FOR COMMERCIAL OPERATION
```

**Declaración:** Cursor **no** declara PRODUCTION CERTIFIED / READY FOR COMMERCIAL OPERATION hasta Pilot Checklist PASS del PO.

## Git / Deploy alignment (2026-07-13)

| Item | Value |
|------|-------|
| Merge | Fast-forward `cursor/apify-prospecting-engine` → `main` (`661f3b7`) |
| Tag | `v1.0.0-rc.intiendas` |
| Deploy source | **main** via `vercel --prod` |
| Alias | https://www.pragmapms.com |

Post-deploy smoke (unauthenticated): `/` 200, `/intiendas/login` 200, `/owner-dashboard/salud` → auth redirect.

**Bloqueo comercial:** Pilot Checklist manual del Product Owner.


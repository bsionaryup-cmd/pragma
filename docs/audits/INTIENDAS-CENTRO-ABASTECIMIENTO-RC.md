# INTIENDAS — Centro de Abastecimiento RC
## Entregable final

**Fecha:** 2026-07-13  
**Estado:** READY FOR PILOT  
**Deploy:** pendiente de aprobación explícita del owner

---

## Resumen de implementación

Transformación UX del módulo Pedidos → **Centro de Abastecimiento** (ruta pública `/intiendas/pedidos` sin cambio).

- Eliminado Health Score, buckets analíticos y botón de actualización visible en producción.
- Briefing operativo automático (“qué hacer hoy”).
- Tarjetas por proveedor: prioridad visual, costo, cobertura, acción, Revisar.
- Detalle explicable por producto (existencia, IA, motivo, lead time).
- Mejor proveedor por score determinista (lead/costo/cumplimiento).
- Previsualización antes de WhatsApp/Correo/Copiar (no abre WA directo).
- Estados: Sugerido → Editado (DRAFT) → Aprobado → Enviado.
- Recepción: estados existentes Pendiente(Aprobado/Enviado) → Recibido (flujo Compras/receive ya cableado).

---

## Archivos creados

- `src/domains/retail-intelligence/lib/briefing.ts`
- `tests/intiendas/supply-briefing.test.ts`
- `docs/audits/INTIENDAS-CENTRO-ABASTECIMIENTO-RC.md` (este)

## Archivos modificados (principales)

- `src/app/(retail)/intiendas/(app)/pedidos/page.tsx`
- `src/domains/retail/ui/tiendas-on/pedidos-intel.tsx`
- `src/domains/retail/ui/tiendas-on/modules.ts`
- `src/domains/retail/ui/tiendas-on/labels.ts`
- `src/domains/retail/actions/pedidos.actions.ts`
- `src/domains/retail-intelligence/services/read.service.ts`
- `src/domains/retail-intelligence/services/product-profile.service.ts`
- `src/domains/retail-intelligence/index.ts`
- `src/app/(retail)/intiendas/(app)/compras/page.tsx` (copy link)

## Migraciones

Ninguna nueva en este RC (reutiliza schema intel + whatsapp).

---

## Riesgos y alternativas

| Riesgo | Alternativa evaluada | Selección |
|--------|----------------------|-----------|
| Nuevo enum EDITED | Migración Prisma | **Usar DRAFT = “Editado”** (cero schema risk) |
| Health en abastecimiento | Mover a dashboard | **Eliminado de esta pantalla** |
| WA directo | Modal preview | **Preview obligatorio** |
| retail-intel → auth cash | Import require-open-cash | **Query directa `retailCashSession`** |
| Mejor proveedor | Random / solo primary | **Score lead+cost+reliability** |

---

## Auditorías / pruebas

| Check | Resultado |
|-------|-----------|
| Architecture / isolation tests | PASS |
| Import / POS / Compras sin intel | PASS |
| Prisma schema (sin migración RC) | N/A OK |
| Typecheck | PASS |
| Unit tests intiendas | **19/19 PASS** |
| Build | (ejecutado en suite) |
| Regresión dominio Retail | PASS (aislamiento intacto) |

---

## Arquitectura / aislamiento / rendimiento

- Solo dominio Retail + `retail-intelligence`.
- PMS / QR / Core / Clerk / middleware: **sin cambios**.
- Briefing y scores son CPU-local sobre perfiles ya materializados (sin groupBy de ventas en request).
- Refresh manual solo `[dev]`.

---

## Criterios de aceptación

✓ Centro de Abastecimiento  
✓ Sin info innecesaria en pantalla  
✓ Saber qué hacer en <5s (briefing)  
✓ Pedidos automáticos  
✓ Recomendaciones explicables  
✓ Proveedor auto  
✓ Envío con preview  
✓ Inteligencia por eventos  
✓ Sin regresiones de aislamiento  
✓ Tests PASS  

**READY FOR PILOT**

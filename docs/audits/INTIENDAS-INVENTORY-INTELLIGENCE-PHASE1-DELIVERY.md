# INTIENDAS — Inventory Intelligence Phase 1
## Auditoría técnica final de implementación

**Fecha:** 2026-07-13  
**Estado:** READY FOR FINAL HARDENING  
**Alcance:** Solo Retail / INTIENDAS. PMS, QR Mobility, Core, Clerk y middleware no modificados (salvo cron aditivo en `vercel.json`).

---

## Criterios de aceptación

| Criterio | Estado |
|----------|--------|
| Inventory Intelligence Engine operativo | PASS |
| Compras desacoplado de Pedidos | PASS |
| Pedidos generados automáticamente (agrupados por proveedor) | PASS |
| Perfiles inteligentes producto/proveedor | PASS |
| Eventos outbox + worker/cron | PASS |
| Store Health Score | PASS |
| Dispatch adapters desacoplados (prepare only) | PASS |
| Isolation tests | PASS (12/12) |
| Typecheck | PASS |
| Build | PASS |
| Sin LLM en decisiones de compra | PASS |
| POS sin inteligencia | PASS |

---

## Arquitectura entregada

```
Retail write path (sale/purchase/adjust/transfer/product update)
        ↓ same TX
RetailIntelOutbox
        ↓
/api/cron/retail-intel-outbox  OR  ensureStoreIntelligence (Pedidos UI)
        ↓
DemandDay + ProductProfile (+ SupplierProfile)
        ↓
Reorder plan + SUGGESTED PurchaseOrders (1 por proveedor)
        ↓
UI /intiendas/pedidos  (aprobar / editar / enviar)
        ↓
Dispatch adapters (EMAIL/PDF/WHATSAPP/WEB_LINK/API) — prepare only
```

**Dominio:** `src/domains/retail-intelligence/`  
**No vive en POS.** Compras no importa intelligence.

---

## Separación funcional

### Compras (`/intiendas/compras`)
- Solo registro histórico: mercancía, servicios, arriendo, transporte, papelería, operativos, otros.
- Actualiza inventario al registrar mercancía (approve + receive).
- **Sin** sugerencias, **sin** analyze on load.

### Pedidos (`/intiendas/pedidos`)
- Centro de Inventory Intelligence.
- Health Score, buckets (críticos / por agotarse / alta rotación / sobre inventario / sin rotación).
- Pedidos **siempre** agrupados por proveedor.
- Acciones: aprobar, editar cantidades, quitar/agregar producto, cambiar proveedor, enviar, descartar.

### Legacy
- `/intiendas/ia` → redirect a Pedidos.
- `ai-engine.service.ts` → facade hacia retail-intelligence.

---

## Modelos añadidos (migración aditiva)

`20260713160000_intiendas_inventory_intelligence`

- `RetailProductDemandDay`
- `RetailProductIntelProfile`
- `RetailSupplierIntelProfile`
- `RetailIntelOutbox`
- `RetailIntelReorderPlan` + `RetailIntelReorderPlanLine`
- `RetailStoreHealthScore`
- `RetailOrderDispatchJob`
- `RetailIntelFeedback`
- `RetailSupplier.preferredDispatchChannel` (opcional)

---

## Decisiones de menor impacto (durante implementación)

1. **Plan refresh no recalcula todos los perfiles** en cada evento; solo los SKUs afectados. Bootstrap completo solo en cold start / stale / cron.
2. **Pedidos materializados como `RetailPurchaseOrder` SUGGESTED + `aiGenerated`** en lugar de solo líneas sueltas — reutiliza receive/approve existentes.
3. **Dispatch Phase 1 = prepare artifacts**, no envío externo (WhatsApp/Resend) — evita acoplar a PMS email y compliance Meta.
4. **Cron horario** (`0 * * * *`) en vez de cada 5 min — compatibilidad Vercel; UI puede refrescar on-demand.
5. **Hub** pasa a 10 módulos; grid responsive ya lo soporta sin rediseño.

---

## Riesgos residuales (hardening)

| Riesgo | Mitigación recomendada |
|--------|------------------------|
| Bootstrap O(n) en tiendas grandes al abrir Pedidos | Cache freshness + job shard |
| Regenerar SUGGESTED borra edits no aprobados | Persistir DRAFT editados fuera de SUGGESTED o merge |
| Migración no desplegada en prod | `prisma migrate deploy` en release |
| Envío real aún no conectado | Hardening: adapters Email/WhatsApp |

---

## Validación ejecutada

```
npx prisma validate          PASS
npx prisma generate          PASS
npx tsc --noEmit             PASS
npx tsx --test tests/intiendas/*.test.ts   12/12 PASS
npm run build                PASS
```

---

## Archivos clave

- `src/domains/retail-intelligence/**`
- `src/app/(retail)/intiendas/(app)/pedidos/page.tsx`
- `src/app/(retail)/intiendas/(app)/compras/page.tsx` (sin IA)
- `src/app/api/cron/retail-intel-outbox/route.ts`
- `prisma/migrations/20260713160000_intiendas_inventory_intelligence/`

**Listo para FINAL HARDENING** (envío real, UX polish, migrate deploy, observabilidad outbox).

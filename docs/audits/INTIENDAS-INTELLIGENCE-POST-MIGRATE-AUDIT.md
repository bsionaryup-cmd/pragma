# INTIENDAS — Post-migrate hardening audit

**Fecha:** 2026-07-13  
**Acción:** `prisma migrate deploy` + auditoría runtime + fixes de bajo impacto

---

## Migración

Aplicada en Neon: `20260713160000_intiendas_inventory_intelligence` — OK.

Smoke bootstrap (Panadería Marival):

- profiles: 2
- health score: 71
- suggested orders: 0 (inventario no crítico en demo)

---

## Bugs encontrados y corregidos

| # | Severidad | Bug | Fix | Impacto |
|---|-----------|-----|-----|---------|
| 1 | **P0** | `/intiendas/pedidos` 500: `retailProductIntelProfile.count` undefined — singleton Prisma no reciclaba tras migración | `PRISMA_SCHEMA_VERSION` → migración intel + check de delegados intel en `db.ts` | Ninguno negativo; solo corrige 500 |
| 2 | **P1** | Edits en pedidos SUGGESTED se borraban al regenerar plan | Al editar/cambiar proveedor → status `DRAFT` (regen solo borra SUGGESTED) | Preserva trabajo del usuario |
| 3 | **P1** | Devoluciones/ajustes vía `inventory.service` y `adjustStockAction` no emitían outbox | `enqueueStockChanged` en ambos | Aprendizaje completo sin cambiar UX |
| 4 | **P2** | Update proveedor no actualizaba perfil intel | `enqueueSupplierUpdated` | Solo señales |
| 5 | **P2** | Hydration mismatch en hub (footer con `DateTime` live) | Fecha sin hora + `suppressHydrationWarning` | Cosmético |
| 6 | **P2** | Perfiles sin plan activo tras migrate | `ensureStoreIntelligence` crea plan si falta | Evita UI vacía falsa |
| 7 | **P3** | Copy cash-gate no mencionaba Pedidos | Texto actualizado | Solo copy |

---

## No tratados (no bloqueantes / sin síntoma actual)

- Regeneración de SUGGESTED sigue reemplazando sugerencias no editadas (deseado).
- Envío Email/WhatsApp real sigue en mode prepare (fase hardening).
- Hydration residual posible por extensiones del browser.

---

## Validación

- Tests intiendas: re-ejecutados tras fixes
- Typecheck: re-ejecutado
- Smoke DB intel: PASS

**Estado:** errores P0/P1 de Phase 1 cerrados. Listo para uso local de Pedidos tras refresh del dev server (reciclaje automático por nueva `PRISMA_SCHEMA_VERSION`).

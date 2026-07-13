# PRAGMA INTIENDAS — Pre-Production Stabilization Report

**Protocol:** Pre-Production Stabilization Protocol v1.0  
**Date:** 2026-07-13  
**Version product:** `1.2.1`  
**Estado declarado:** RELEASE CANDIDATE → **awaiting Pilot Checklist (manual PO)**  
**Deploy:** **PROHIBIDO** — no ejecutado.

---

## 1. Objetivo cumplido

No se agregaron módulos, pantallas, integraciones ni automatizaciones nuevas.  
Todo el trabajo fue estabilización: seguridad store-scoped, timezone, UX (botones muertos), deuda de archivos huérfanos, validación y documentación.

---

## 2. Aislamiento (PASS permanente)

| Regla | Resultado |
|-------|-----------|
| Retail ↛ PMS | **PASS** |
| PMS ↛ Retail | **PASS** |
| QR ↛ Retail | **PASS** (previo global) |
| Core sin negocio de dominio | **PASS** |
| POS ↛ retail-intelligence | **PASS** |
| retail-intelligence ↛ `@/domains/retail/*` | **PASS** |

Evidencia: `npx tsx --test tests/intiendas/*.test.ts` (arquitectura incluida).

---

## 3. Hallazgos → corrección

### P0 — Cross-store FK (seguridad)

| Campo | Problema | Solución |
|-------|----------|----------|
| `categoryId` / `primarySupplierId` en create/update producto | IDs de otra tienda aceptados | `assertStoreOwnedCategory` / `assertStoreOwnedSupplier` |
| `supplierId` en compra sin mercancía | Igual | assert supplier store-owned |
| `registerId` en `openCashAction` | Igual | `assertStoreOwnedCashRegister` |
| `product.service` create/update | Misma falla en servicio | mismos asserts |

**Archivos:**  
`src/domains/retail/lib/store-owned.ts` (nuevo)  
`src/domains/retail/actions/retail.actions.ts`  
`src/domains/retail/services/product.service.ts`  
`tests/intiendas/architecture-isolation.test.ts`

### P1 — Timezone Estadísticos

| Problema | Causa | Solución |
|----------|-------|----------|
| Ventana 30 días con `setHours` local del servidor | No `America/Bogota` | `startOfDayInTimezone()` − 30 días |

**Archivo:** `src/domains/retail/services/retail-ui.service.ts`

### P2 — UX botones / ruido

| Problema | Solución |
|----------|----------|
| Icono `Network` decorativo en hub | Eliminado |
| `HelpCircle` decorativo en Caja | Eliminado |
| Footer “Pendientes por sincronizar: 0” falso | Eliminado |
| POS: Inicio + Módulos → mismo href | Un solo control “Inicio” |
| `pedidos-table.tsx` huérfano | Eliminado |
| Actions paralelas sin imports (`product/purchase/.../ai.actions`) | Eliminadas |
| `dashboard.service.ts` / `report.service.ts` huérfanos | Eliminados |

**WARN analizado (sin rename de rutas):** hub “Productos” vive en `/intiendas/inventario` e “Informes” en `/intiendas/reportes`. Renombrar rutas rompería bookmarks y no aporta valor RC; labels de UI ya son consistentes.

---

## 4. Validaciones técnicas (evidencia)

| Check | Resultado |
|-------|-----------|
| Prisma Validate | **PASS** |
| Prisma Generate | **PASS** |
| Unit / Architecture / Auth / Intel tests (`tests/intiendas`) | **PASS** 21/21 |
| Typecheck | **PASS** |
| ESLint (retail + retail-intelligence + app retail) | **PASS** (`--max-warnings 0`) |
| Build | **PASS** |
| Architecture Audit | **PASS** |
| Security Audit (cross-store FK + retail-only PMS gate previo) | **PASS** (P0 cerrado) |
| Performance Audit | **PASS*** (sin regresiones nuevas; sin N+1 nuevo introducido) |
| Retail Smoke HTTP | **PASS** login `200`; rutas app `307` → login (auth gate) |

\* Performance profundo (bundle/Lighthouse) no bloquea RC; no se midió Lighthouse en esta pasada.

---

## 5. Validación funcional

| Flujo | Estado | Evidencia |
|-------|--------|-----------|
| Auth gate rutas retail | **PASS** (técnico) | HTTP 307 sin sesión |
| Login UI | **PASS** (técnico) | HTTP 200 `/intiendas/login` |
| Caja / Ventas / Compras / Pedidos / Inventario / … | **PENDING MANUAL** | Requiere sesión retail + datos reales del piloto |
| Inventory Intelligence | **PASS parcial** | Unit + smoke auth; retiro con stock crítico debe confirmarse en piloto |

**El protocolo exige Manual Functional Validation PASS por el Product Owner.**  
Cursor no puede marcar el Pilot Checklist completo sin esa evidencia humana.

---

## 6. Pilot Checklist

| Ítem | Estado |
|------|--------|
| Login | ⬜ Manual PO |
| Logout | ⬜ Manual PO |
| Cambio de Organización | ⬜ N/A o Manual (si aplica multi-org) |
| Owner Dashboard | ⬜ Manual PO |
| Retail Dashboard | ⬜ Manual PO |
| Apertura de Caja | ⬜ Manual PO |
| Cierre de Caja | ⬜ Manual PO |
| Venta Completa | ⬜ Manual PO |
| Compra Completa | ⬜ Manual PO |
| Pedido IA / Abastecimiento | ⬜ Manual PO |
| Inventario / Productos | ⬜ Manual PO |
| Clientes | ⬜ Manual PO |
| Proveedores | ⬜ Manual PO |
| Bodegas | ⬜ Manual PO |
| Reportes | ⬜ Manual PO |
| Performance | ☑ Técnico base PASS |
| Logs | ⬜ Manual PO |
| Seguridad | ☑ P0 store FK cerrado + aislamiento PASS |
| Backup / Restore | ⬜ Infra / Ops (fuera de código) |
| Impersonación | ☑ Retail-only → `/intiendas` (pasada global) |
| Inventory Intelligence | ☑ Engines/tests PASS · ⬜ Manual datos reales |

---

## 7. Criterio de autorización Deploy

| Requisito | ¿Listo? |
|-----------|---------|
| Auditoría técnica PASS | **SÍ** |
| Auditoría de aislamiento PASS | **SÍ** |
| Auditoría seguridad P0 PASS | **SÍ** |
| Auditoría visual (botones muertos conocidos) | **SÍ** (hallazgos RC cerrados) |
| Pilot Checklist completo PASS | **NO** — pendiente PO |
| Deploy authorization | **WAITING FOR HUMAN — Pilot + approval** |

**Estado final:**  
`FEATURE COMPLETE` → `RELEASE CANDIDATE` → **establecido para piloto** →  
`PILOT READY (técnico)` → `WAITING FOR HUMAN PILOT + DEPLOY APPROVAL`

Cursor **no** realizará Deploy.

---

## 8. Cómo reproducir evidencia

```bash
npx prisma validate
npx prisma generate
npx tsx --test tests/intiendas/*.test.ts
npm run typecheck
npx eslint "src/domains/retail/**/*.{ts,tsx}" "src/domains/retail-intelligence/**/*.{ts,tsx}" "src/app/(retail)/**/*.{ts,tsx}" --max-warnings 0
npm run build
```

Smoke (sin sesión): `/intiendas/login` → 200; resto app → redirect auth.

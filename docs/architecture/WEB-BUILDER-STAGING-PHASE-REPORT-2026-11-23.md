# PRAGMA WEB BUILDER — Informe fase aislamiento & staging

**Fecha:** 2026-11-23  
**Rama / worktree:** `feat/pragma-web-builder` · `pragma-pms-web-builder`  
**Merge / PR / deploy / publish producción:** **NO**

---

## 1. Identificación del staging

| Campo | Valor |
|-------|--------|
| Proveedor | Neon **claim** temporal (sin cuenta permanente) |
| Host (fingerprint) | `ep-dawn-union-bebo02dx-pooler.c-9.us-east-2.aws.neon.tech` |
| Región | `aws-us-east-2` |
| Project id | `restless-smoke-07337143` |
| Expiración claim | **2026-11-26** (aprox. 72h si no se reclama) |
| Config local | `.env.staging` (gitignored) · `PRAGMA_WEB_BUILDER_STAGING=1` · puerto **3005** |
| Operativa (prohibida) | `ep-purple-block-apuk7v1k…` — **no usada** en scripts staging |

`DIRECT_URL`: no existía; staging usa `DATABASE_URL` (+ `DATABASE_URL_UNPOOLED` opcional).

Guard: `npm run staging:assert` aborta si el host contiene el fingerprint operativo.

---

## 2. Confirmación de aislamiento

| Check | Resultado |
|-------|-----------|
| Scripts staging cargan `.env.staging` sin override operativo | PASS |
| `prisma.config.ts` respeta `PRAGMA_WEB_BUILDER_STAGING=1` | PASS |
| Migraciones aplicadas **solo** en claim staging (73) | PASS |
| Seed sintético (sin PII real) | PASS · org `stg_web_builder_org_001` · 4 lofts |
| `.env` del worktree restaurado (sin DB claim) | PASS |
| `.env.local` de la otra rama / `pragma-pms` | **No modificado** |
| Migración operativa ya aplicada | **Intacta** (no revertida) |

---

## 3. Estado del worktree

- Rama: `feat/pragma-web-builder`
- Dev staging: `npm run staging:dev` → `http://localhost:3005` (proceso aparte del `:3000` de la otra rama)
- Dependencias: junction a `node_modules` del repo principal
- Código WEB BUILDER cargado (confirmado por ruta pública staging)

Comandos:

```bash
npm run staging:assert
npm run staging:migrate
npm run staging:seed
npm run staging:e2e
npm run staging:dev
```

---

## 4. Smoke test UI

| Ruta | Resultado | Evidencia |
|------|-----------|-----------|
| `/urbanovaloft` (DRAFT) | **404** esperado | Browser |
| `/urbanovaloft` (PUBLISHED temporal) | **PASS** — hero, buscador, Loft 801–804, Laureles, WA | Browser screenshot |
| `/w/urbanovaloft` | **PASS** (misma plantilla) | Browser |
| `/web-builder` | **PARTIAL** | Sesión Owner redirige a `/owner-dashboard` (rutas tenant bloqueadas para platform owner sin impersonación PMS) |
| `/w/.../preview` | **PARTIAL** | Misma redirección Owner |

Tras el smoke público, el sitio staging quedó de nuevo en **DRAFT**.

---

## 5. E2E staging (reserva)

Script: `npm run staging:e2e`

| Paso | Resultado |
|------|-----------|
| Disponibilidad | PASS |
| Crear reserva DIRECT | PASS · unidad 801 |
| Asociación org staging | PASS |
| Doble reserva bloqueada | PASS |
| Overlap detectado | PASS |
| Cancelación + disponibilidad restaurada | PASS |
| Dinero real | N/A (sin Wompi cobro real) |

---

## 6. Regresión

| Suite | Resultado vs auditoría previa |
|-------|-------------------------------|
| `tests/web-builder/*` | **19/19 PASS** (incluye schemas páginas) |
| RBAC / reservations / calendar / payments | **26/26 PASS** |
| Regresiones nuevas | **Ninguna observada** |

---

## 7. Módulo Páginas

**Causa del gap:** la UI solo listaba páginas; el contenido “vivo” de la plantilla URBAN BOUTIQUE sale de campos del `TenantWebSite` (hero/ubicación), no de un CMS de páginas.

**Implementado ahora (CRUD simple, sin editor visual):**

- Crear / editar / ordenar / visibilidad / eliminar
- Scoping por tenant (`requireOrgId` + `siteId`)
- Actions + schemas zod + UI en hub

---

## 8. Riesgos pendientes

1. **Neon claim expira ~2026-11-26** — reclamar proyecto o crear branch permanente con `NEON_API_KEY`.
2. Smoke admin `/web-builder` requiere entrar al PMS como tenant (no como Owner shell) o impersonación; pendiente de flujo UI Owner→PMS en staging.
3. Fotos staging = `placehold.co` sintéticas (correcto para pruebas).
4. No certificar aún producción / publish URBA NOVA real.

---

## Veredicto de esta fase

**Aislamiento + staging + E2E reserva + CRUD páginas + smoke público: CUMPLIDO.**  
**Smoke admin autenticado en `/web-builder`: PARCIAL (bloqueo por shell Owner).**  
**Producción intacta. Sin merge/PR/deploy/publish.**

Esperando autorización para la siguiente fase.
